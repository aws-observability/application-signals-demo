import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Role, ServicePrincipal, ManagedPolicy, Policy, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';

export class IAMStack extends cdk.Stack {
  // Expose the IAM Role for use in other stacks
  public readonly ec2InstanceRole: Role;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the IAM Role for EC2 instances
    this.ec2InstanceRole = new Role(this, 'EC2InstanceRole', {
      roleName: 'EC2InstanceRole', // Customize the role name if needed
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      description: 'IAM Role for EC2 instances to access AWS services',
    });

    // Attach AWS managed policies to the role

    // Allow EC2 instances to communicate with AWS Systems Manager
    this.ec2InstanceRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    );

    // Allow the CloudWatch agent to send logs and metrics
    this.ec2InstanceRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy')
    );

    this.ec2InstanceRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonSQSFullAccess')
    );

    // Allow access to RDS (consider using a custom policy for least privilege)
    this.ec2InstanceRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonRDSFullAccess')
    );

    // Attach additional managed policies if required by the application
    this.ec2InstanceRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess')
    );

    this.ec2InstanceRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess')
    );

    this.ec2InstanceRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess')
    );

    this.ec2InstanceRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonKinesisFullAccess')
    );

    // Create a custom policy to allow access to the database secret in Secrets Manager
    const secretAccessPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: ['arn:aws:secretsmanager:*:*:secret:PetClinicDBCredentials-*']
    });
    this.ec2InstanceRole.addToPolicy(secretAccessPolicy);

    // Output the IAM Role ARN
    new cdk.CfnOutput(this, 'EC2InstanceRoleARN', {
      value: this.ec2InstanceRole.roleArn,
      description: 'IAM Role ARN for EC2 instances',
      exportName: 'EC2InstanceRoleARN',
    });
  }
}
