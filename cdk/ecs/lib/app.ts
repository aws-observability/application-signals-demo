import * as assert from 'assert';
import { App } from 'aws-cdk-lib';

import { getLatestAdotJavaTag, getLatestAdotPythonTag } from './utils';
import { EcsClusterStack } from './stacks/ecsStack';
import { IamRolesStack } from './stacks/iamRolesStack';
import { PetClinicNetworkStack } from './stacks/petClinicNetworkStack';
import { ServiceDiscoveryStack } from './stacks/servicediscoveryStack';
import { LogStack } from './stacks/logStack';
import { LoadBalancerStack } from './stacks/loadbalancerStack';
import { RdsDatabaseStack } from './stacks/databaseStack';

class ApplicationSignalsECSDemo {
    private readonly app: App;

    constructor() {
        this.app = new App();
        this.runApp();
    }

    public async runApp(): Promise<void> {
        const [adotJavaImageTag, adotPythonImageTag] = await Promise.all([
            getLatestAdotJavaTag(),
            getLatestAdotPythonTag(),
        ]);

        assert(adotJavaImageTag !== '', 'ADOT Java Image Tag is empty');
        assert(adotPythonImageTag !== '', 'ADOT Python Image Tag is empty');

        const petClinicNetworkStack = new PetClinicNetworkStack(this.app, 'NetworkStack');

        const logStack = new LogStack(this.app, 'LogStack');

        const loadbalancerStack = new LoadBalancerStack(this.app, 'LoadBalancerStack', {
            vpc: petClinicNetworkStack.vpc,
            securityGroup: petClinicNetworkStack.albSecurityGroup,
        });

        const rdsDatabaseStack = new RdsDatabaseStack(this.app, 'RdsDatabaseStack', {
            vpc: petClinicNetworkStack.vpc,
            rdsSecurityGroup: petClinicNetworkStack.rdsSecurityGroup,
        });

        const iamRolesStack = new IamRolesStack(this.app, 'IamRolesStack');

        // Grant ecsTaskRole access to database
        rdsDatabaseStack.dbSecret.grantRead(iamRolesStack.ecsTaskRole);
        rdsDatabaseStack.dbSecret.grantWrite(iamRolesStack.ecsTaskRole);

        const serviceDiscoveryStack = new ServiceDiscoveryStack(this.app, 'ServiceDiscoveryStack', {
            vpc: petClinicNetworkStack.vpc,
        });

        new EcsClusterStack(this.app, 'EcsClusterStack', {
            vpc: petClinicNetworkStack.vpc,
            securityGroups: [petClinicNetworkStack.ecsSecurityGroup],
            ecsTaskRole: iamRolesStack.ecsTaskRole,
            ecsTaskExecutionRole: iamRolesStack.ecsTaskExecutionRole,
            subnets: petClinicNetworkStack.vpc.publicSubnets,
            serviceDiscoveryStack: serviceDiscoveryStack,
            logStack: logStack,
            adotPythonImageTag: adotPythonImageTag,
            adotJavaImageTag: adotJavaImageTag,
            dbSecret: rdsDatabaseStack.dbSecret,
            dbInstanceEndpointAddress: rdsDatabaseStack.rdsInstance.dbInstanceEndpointAddress,
            loadBalancerTargetGroup: loadbalancerStack.targetGroup,
            loadBalancerDnsName: loadbalancerStack.loadBalancer.loadBalancerDnsName,
        });

        this.app.synth();
    }
}

new ApplicationSignalsECSDemo();
