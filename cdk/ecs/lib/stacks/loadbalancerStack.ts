import {
    ApplicationTargetGroup,
    TargetType,
    ApplicationProtocol,
    ApplicationLoadBalancer,
    Protocol,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import { Vpc, SecurityGroup, SubnetType } from 'aws-cdk-lib/aws-ec2';

interface LoadBalancerStackProps extends StackProps {
    vpc: Vpc;
    securityGroup: SecurityGroup;
}

export class LoadBalancerStack extends Stack {
    public readonly loadBalancer: ApplicationLoadBalancer;
    public readonly targetGroup: ApplicationTargetGroup;
    private readonly LOAD_BALANCER_NAME = 'ecs-load-balancer';
    private readonly TARGET_GROUP_NAME = 'api-gateway-target-group';

    constructor(scope: Construct, id: string, props: LoadBalancerStackProps) {
        super(scope, id, props);

        // Create Application Load Balancer (ALB)
        this.loadBalancer = new ApplicationLoadBalancer(this, 'LoadBalancer', {
            loadBalancerName: this.LOAD_BALANCER_NAME,
            vpc: props.vpc,
            internetFacing: true,
            securityGroup: props.securityGroup,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC,
            },
        });

        this.targetGroup = new ApplicationTargetGroup(this, 'ApiGatewayTargetGroup', {
            targetGroupName: this.TARGET_GROUP_NAME,
            vpc: props.vpc,
            port: 8080,
            protocol: ApplicationProtocol.HTTP,
            targetType: TargetType.IP,
            // '/' would work but it hits RumConfigFilter which buffers the whole
            // index.html into memory before responding (~15s), causing flaky ALB
            // health checks. '/actuator/health' bypasses the filter and returns
            // fast, so we can also tighten the intervals safely.
            healthCheck: {
                path: '/actuator/health',
                protocol: Protocol.HTTP,
                healthyThresholdCount: 2,
                unhealthyThresholdCount: 3,
                interval: Duration.seconds(30),
                timeout: Duration.seconds(10),
            },
        });

        this.loadBalancer.addListener('Listener', {
            protocol: ApplicationProtocol.HTTP,
            port: 80,
            defaultTargetGroups: [this.targetGroup],
        });

        // Output the Load Balancer ARN and DNS
        new CfnOutput(this, 'LoadBalancerARN', {
            value: this.loadBalancer.loadBalancerArn,
        });
        new CfnOutput(this, 'LoadBalancerDNS', {
            value: this.loadBalancer.loadBalancerDnsName,
        });
    }
}
