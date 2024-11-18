// lib/load-balancer-stack.ts

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  Vpc,
  SecurityGroup,
  Peer,
  Port,
  Instance,
} from 'aws-cdk-lib/aws-ec2';
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  TargetType,
  ListenerAction,
  Protocol,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';

interface LoadBalancerStackProps extends cdk.StackProps {
  vpc: Vpc;
  albSecurityGroup: SecurityGroup;
  frontendInstance: Instance;
}

export class LoadBalancerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LoadBalancerStackProps) {
    super(scope, id, props);

    const { vpc, albSecurityGroup, frontendInstance } = props;

    // // Create ALB Security Group
    // const albSecurityGroup = new SecurityGroup(this, 'ALBSecurityGroup', {
    //   vpc,
    //   description: 'Security group for ALB',
    //   allowAllOutbound: true,
    // });

    // // Allow inbound HTTP traffic from anywhere
    // albSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'Allow HTTP traffic from anywhere');

    // // Allow the ALB to connect to the EC2 instances on port 8080
    // ec2SecurityGroup.addIngressRule(
    //   albSecurityGroup,
    //   Port.tcp(8080),
    //   'Allow ALB to access EC2 instances on port 8080'
    // );

    // Create the Application Load Balancer
    const alb = new ApplicationLoadBalancer(this, 'ApplicationLoadBalancer', {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      loadBalancerName: 'PetClinicALB',
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
      },
    });

    // Create Target Group
    const targetGroup = new ApplicationTargetGroup(this, 'TargetGroup', {
      vpc,
      protocol: ApplicationProtocol.HTTP,
      port: 8080,
      targetType: TargetType.INSTANCE,
      healthCheck: {
        path: '/',
        protocol: Protocol.HTTP,
        port: '8080',
      },
    });

    // Register the visits instance as a target
    targetGroup.addTarget(new targets.InstanceTarget(frontendInstance, 8080));

    // Create Listener
    alb.addListener('HTTPListener', {
      port: 80,
      defaultAction: ListenerAction.forward([targetGroup]),
    });

    // Output the ALB DNS Name
    new cdk.CfnOutput(this, 'ALBDNSName', {
      value: alb.loadBalancerDnsName,
      description: 'DNS Name of the Application Load Balancer',
    });
  }
}
