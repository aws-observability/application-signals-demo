import * as assert from 'assert';
import { App } from 'aws-cdk-lib';

import { getLatestAdotJavaTag, getLatestAdotPythonTag } from './utils';
import { EcsClusterStack } from './stacks/ecsStack';
import { IamRolesStack } from './stacks/iamRolesStack';
import { NetworkStack } from './stacks/networkStack';
import { ServiceDiscoveryStack } from './stacks/servicediscoveryStack';
import { LogStack } from './stacks/logStack';
import { LoadBalancerStack } from './stacks/loadbalancerStack';
import { RdsDatabaseStack } from './stacks/databaseStack';

class ApplicationSignalsECSDemo {
    private readonly app: App;
    private adotJavaImageTag: string;
    private adotPythonImageTag: string;
    private ecsClusterStack: EcsClusterStack;
    private serviceDiscoveryStack: ServiceDiscoveryStack;
    private loadbalancerStack: LoadBalancerStack;
    private logStack: LogStack;
    private rdsDatabaseStack: RdsDatabaseStack;

    constructor() {
        this.app = new App();
        this.adotJavaImageTag = '';
        this.adotPythonImageTag = '';
        this.runApp();
    }

    public async runApp(): Promise<void> {
        const [adotJavaImageTag, adotPythonImageTag] = await Promise.all([
            getLatestAdotJavaTag(),
            getLatestAdotPythonTag(),
        ]);

        assert(adotJavaImageTag !== '', 'ADOT Java Image Tag is empty');
        assert(adotPythonImageTag !== '', 'ADOT Python Image Tag is empty');

        this.adotJavaImageTag = adotJavaImageTag;
        this.adotPythonImageTag = adotPythonImageTag;

        // Execute synchronous operations
        this.createStacks();
        this.createServers();
        this.createApiGateway();
        this.runServices();
        this.generateTraffic();
        this.app.synth();
    }

    private createStacks(): void {
        const networkStack = new NetworkStack(this.app, 'NetworkStack');

        this.logStack = new LogStack(this.app, 'LogStack');

        this.loadbalancerStack = new LoadBalancerStack(this.app, 'LoadBalancerStack', {
            vpc: networkStack.vpc,
            securityGroup: networkStack.albSecurityGroup,
        });

        this.rdsDatabaseStack = new RdsDatabaseStack(this.app, 'RdsDatabaseStack', {
            vpc: networkStack.vpc,
            rdsSecurityGroup: networkStack.rdsSecurityGroup,
        });

        const iamRolesStack = new IamRolesStack(this.app, 'IamRolesStack');

        // Grant ecsTaskRole access to database
        this.rdsDatabaseStack.dbSecret.grantRead(iamRolesStack.ecsTaskRole);
        this.rdsDatabaseStack.dbSecret.grantWrite(iamRolesStack.ecsTaskRole);

        this.serviceDiscoveryStack = new ServiceDiscoveryStack(this.app, 'ServiceDiscoveryStack', {
            vpc: networkStack.vpc,
        });

        this.ecsClusterStack = new EcsClusterStack(this.app, 'EcsClusterStack', {
            vpc: networkStack.vpc,
            securityGroups: [networkStack.ecsSecurityGroup],
            ecsTaskRole: iamRolesStack.ecsTaskRole,
            ecsTaskExecutionRole: iamRolesStack.ecsTaskExecutionRole,
            subnets: networkStack.vpc.publicSubnets,
            serviceDiscoveryStack: this.serviceDiscoveryStack,
            logStack: this.logStack,
        });
    }

    private createServers() {
        this.ecsClusterStack.createConfigServer();
        this.ecsClusterStack.createDiscoveryServer();
        this.ecsClusterStack.createAdminServer();
    }

    private createApiGateway() {
        this.ecsClusterStack.createApiGateway(
            this.loadbalancerStack.loadBalancer.loadBalancerDnsName,
            this.adotJavaImageTag,
            this.loadbalancerStack.targetGroup,
        );
    }

    private runServices() {
        this.ecsClusterStack.runVetsService(this.adotJavaImageTag);
        this.ecsClusterStack.runCustomersService(this.adotJavaImageTag);
        this.ecsClusterStack.runVisitsService(this.adotJavaImageTag);
        this.ecsClusterStack.runInsuranceService(
            this.adotPythonImageTag,
            this.rdsDatabaseStack.dbSecret,
            this.rdsDatabaseStack.rdsInstance.dbInstanceEndpointAddress,
        );
        this.ecsClusterStack.runBillingService(
            this.adotPythonImageTag,
            this.rdsDatabaseStack.dbSecret,
            this.rdsDatabaseStack.rdsInstance.dbInstanceEndpointAddress,
        );
    }

    private generateTraffic() {
        this.ecsClusterStack.generateTraffic(this.loadbalancerStack.loadBalancer.loadBalancerDnsName);
    }
}

new ApplicationSignalsECSDemo();
