import { Construct } from 'constructs';
import { Stack, StackProps, CfnOutput }  from 'aws-cdk-lib';
import { Vpc, SubnetType, SecurityGroup } from 'aws-cdk-lib/aws-ec2';

export class NetworkStack extends Stack {
  // Expose properties for use in other stacks
  public readonly vpc: Vpc;
  public readonly rdsSecurityGroup: SecurityGroup;
  public readonly rdsSecurityGroupId: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    
    // EKS Cluster needs public and private subnet to initialize
    this.vpc = new Vpc(this, 'DemoVPC', {
      cidr: '10.0.0.0/16',
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'PrivateEgressSubnet',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
      natGateways: 2,
    });

    this.rdsSecurityGroup = new SecurityGroup(this, 'EksRdsSecurityGroup', {
      vpc: this.vpc,
      description: 'Allow traffic from EKS',
    });

    this.rdsSecurityGroupId = this.rdsSecurityGroup.securityGroupId;

    // Output the VPC and subnet IDs
    new CfnOutput(this, 'PetClinicEksVPCID', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: 'PetClinicEksVPCID',
    });
  }
}
