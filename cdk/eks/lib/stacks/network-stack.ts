import { Construct } from 'constructs';
import { Stack, StackProps, CfnOutput }  from 'aws-cdk-lib';
import { Vpc, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { PrivateHostedZone } from 'aws-cdk-lib/aws-route53';

export class NetworkStack extends Stack {
  // Expose properties for use in other stacks
  public readonly vpc: Vpc;

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

    // Output the VPC and subnet IDs
    new CfnOutput(this, 'PetClinicEksVPCID', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: 'PetClinicEksVPCID',
    });
  }
}
