import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  Vpc,
  SubnetType,
  SecurityGroup,
  Peer,
  Port,
} from 'aws-cdk-lib/aws-ec2';
import { PrivateHostedZone } from 'aws-cdk-lib/aws-route53';
import { CfnOutput } from 'aws-cdk-lib';

export class NetworkStack extends cdk.Stack {
  // Expose properties for use in other stacks
  public readonly vpc: Vpc;
  public readonly ec2SecurityGroup: SecurityGroup;
  public readonly albSecurityGroup: SecurityGroup;
  public readonly rdsSecurityGroup: SecurityGroup;
  public readonly hostedZone: PrivateHostedZone;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the VPC with one public and one private subnet
    this.vpc = new Vpc(this, 'DemoVPC', {
      cidr: '10.0.0.0/16',
      maxAzs: 2, // Increase to 2 AZs to satisfy RDS requirement
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: SubnetType.PRIVATE_WITH_NAT,
        },
      ],
      natGateways: 2, 
    });

    // Security Group for EC2 Instances
    this.ec2SecurityGroup = new SecurityGroup(this, 'EC2SecurityGroup', {
      vpc: this.vpc,
      securityGroupName: 'EC2InstancesSG',
      description: 'Security group for EC2 instances',
      allowAllOutbound: true,
    });

    // Allow inbound traffic from within VPC CIDR on necessary ports
    // [80, 8080].forEach((port) => {
    //   this.ec2SecurityGroup.addIngressRule(
    //     Peer.ipv4(this.vpc.vpcCidrBlock),
    //     Port.tcp(port),
    //     `Allow TCP port ${port} from within VPC`,
    //   );
    // });

    // Allow all inbound traffic from within the same subnet
    const privateSubnetCidr = this.vpc.privateSubnets[0].ipv4CidrBlock;
    this.ec2SecurityGroup.addIngressRule(
        Peer.ipv4(privateSubnetCidr),
        Port.allTraffic(),
        'Allow all traffic from within the same subnet',
    );

    // Security Group for Public Load Balancer
    this.albSecurityGroup = new SecurityGroup(this, 'ALBSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: 'PublicALBSG',
      description: 'Security group for public ALB',
      allowAllOutbound: true,
    });

    // Allow inbound HTTP traffic from anywhere to ALB
    this.albSecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(80),
      'Allow HTTP traffic from anywhere',
    );

    // Allow ALB to communicate with EC2 instances on necessary ports
    [80, 8080].forEach((port) => {
      this.ec2SecurityGroup.addIngressRule(
        this.albSecurityGroup,
        Port.tcp(port),
        `Allow traffic from ALB on port ${port}`,
      );
    });

    // Security Group for RDS
    this.rdsSecurityGroup = new SecurityGroup(this, 'RDSSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: 'RDSSG',
      description: 'Security group for RDS instance',
      allowAllOutbound: true,
    });

    // Allow EC2 instances to access RDS on port 5432
    this.rdsSecurityGroup.addIngressRule(
      this.ec2SecurityGroup,
      Port.tcp(5432),
      'Allow EC2 instances to access RDS',
    );

    // Create a Private Hosted Zone for internal DNS resolution
    const domainName = 'demo.local'; // Change this to your preferred domain
    this.hostedZone = new PrivateHostedZone(this, 'PrivateHostedZone', {
      zoneName: domainName,
      vpc: this.vpc,
    });

    // Output the VPC and subnet IDs
    new CfnOutput(this, 'VPCID', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: 'VPCID',
    });

    new CfnOutput(this, 'PublicSubnetIDs', {
      value: this.vpc.publicSubnets.map((subnet) => subnet.subnetId).join(','),
      description: 'Public Subnet IDs',
      exportName: 'PublicSubnetIDs',
    });

    new CfnOutput(this, 'PrivateSubnetIDs', {
      value: this.vpc.privateSubnets.map((subnet) => subnet.subnetId).join(','),
      description: 'Private Subnet IDs',
      exportName: 'PrivateSubnetIDs',
    });

    // Output Security Group IDs
    new CfnOutput(this, 'EC2SecurityGroupID', {
      value: this.ec2SecurityGroup.securityGroupId,
      description: 'EC2 Instances Security Group ID',
      exportName: 'EC2SecurityGroupID',
    });

    new CfnOutput(this, 'ALBSecurityGroupID', {
      value: this.albSecurityGroup.securityGroupId,
      description: 'ALB Security Group ID',
      exportName: 'ALBSecurityGroupID',
    });

    new CfnOutput(this, 'RDSSecurityGroupID', {
      value: this.rdsSecurityGroup.securityGroupId,
      description: 'RDS Security Group ID',
      exportName: 'RDSSecurityGroupID',
    });

    // Output Hosted Zone details
    new CfnOutput(this, 'HostedZoneID', {
      value: this.hostedZone.hostedZoneId,
      description: 'Private Hosted Zone ID',
      exportName: 'HostedZoneID',
    });

    new CfnOutput(this, 'DomainName', {
      value: domainName,
      description: 'Private Hosted Zone Domain Name',
      exportName: 'DomainName',
    });
  }
}
