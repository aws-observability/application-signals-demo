import { Construct } from 'constructs';
import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import {
    Vpc,
    SecurityGroup,
    SubnetType,
    Port,
    Peer,
    InterfaceVpcEndpoint,
    InterfaceVpcEndpointAwsService,
    GatewayVpcEndpoint,
    GatewayVpcEndpointAwsService,
} from 'aws-cdk-lib/aws-ec2';

export class PetClinicNetworkStack extends Stack {
    public readonly vpc: Vpc;
    public readonly rdsSecurityGroup: SecurityGroup;
    public readonly albSecurityGroup: SecurityGroup;
    public readonly ecsSecurityGroup: SecurityGroup;
    private readonly ECS_SECURITY_GROUP_NAME = 'ecs-security-group';
    private readonly RDS_SECURITY_GROUP_NAME = 'rds-security-group';
    private readonly ALB_SECURITY_GROUP_NAME = 'alb-security-group';

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Create VPC
        this.vpc = new Vpc(this, 'VPC', {
            maxAzs: 2,
            subnetConfiguration: [
                {
                    name: 'pet-clinic-public-subnet',
                    subnetType: SubnetType.PUBLIC,
                    cidrMask: 24,
                },
                {
                    name: 'pet-clinic-private-subnet',
                    subnetType: SubnetType.PRIVATE_ISOLATED, // Completely isolated private subnet
                    cidrMask: 24,
                },
                {
                    name: 'pet-clinic-private-subnet-with-egress',
                    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: 24,
                },
            ],
        });

        // Add ECR API VPC Endpoint
        new InterfaceVpcEndpoint(this, 'EcrApiEndpoint', {
            vpc: this.vpc,
            service: InterfaceVpcEndpointAwsService.ECR,
            subnets: {
                subnetType: SubnetType.PUBLIC,
            },
        });

        // Add ECR Docker VPC Endpoint
        new InterfaceVpcEndpoint(this, 'EcrDkrEndpoint', {
            vpc: this.vpc,
            service: InterfaceVpcEndpointAwsService.ECR_DOCKER,
            subnets: {
                subnetType: SubnetType.PUBLIC,
            },
        });

        // Add S3 Gateway Endpoint as ECR uses S3 to store layers
        new GatewayVpcEndpoint(this, 's3Endpoint', {
            vpc: this.vpc,
            service: GatewayVpcEndpointAwsService.S3,
            subnets: [{
                subnetType: SubnetType.PUBLIC,
            }],
        });

        // Create Security Groups
        this.albSecurityGroup = new SecurityGroup(this, this.ALB_SECURITY_GROUP_NAME, {
            vpc: this.vpc,
            securityGroupName: this.ALB_SECURITY_GROUP_NAME,
            allowAllOutbound: true,
        });
        this.albSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'Allow HTTP traffic');

        this.ecsSecurityGroup = new SecurityGroup(this, this.ECS_SECURITY_GROUP_NAME, {
            vpc: this.vpc,
            securityGroupName: this.ECS_SECURITY_GROUP_NAME,
            allowAllOutbound: true,
        });
        this.ecsSecurityGroup.addIngressRule(this.ecsSecurityGroup, Port.allTraffic());
        this.ecsSecurityGroup.addIngressRule(this.albSecurityGroup, Port.tcp(8080));

        this.rdsSecurityGroup = new SecurityGroup(this, this.RDS_SECURITY_GROUP_NAME, {
            vpc: this.vpc,
            securityGroupName: this.RDS_SECURITY_GROUP_NAME,
            allowAllOutbound: true,
        });
        this.rdsSecurityGroup.addIngressRule(this.ecsSecurityGroup, Port.tcp(5432));

        // Output the VPC ID, subnet ID and security group ID
        new CfnOutput(this, 'VPCId', { value: this.vpc.vpcId });
        new CfnOutput(this, 'AlbSecurityGroup', {
            value: this.albSecurityGroup.securityGroupId,
        });
        new CfnOutput(this, 'RdsSecurityGroup', {
            value: this.rdsSecurityGroup.securityGroupId,
        });
    }
}
