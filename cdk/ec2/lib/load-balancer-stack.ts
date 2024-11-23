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
