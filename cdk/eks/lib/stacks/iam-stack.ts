import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import { RoleProps, PolicyDocument, ServicePrincipal, CompositePrincipal, AccountRootPrincipal, ManagedPolicy, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';

export class IAMStack extends Stack {
  public readonly eksClusterRoleProp: RoleProps;
  public readonly eksNodeGroupRoleProp: RoleProps ;
  public readonly ebsCsiAddonRoleProp: RoleProps;
  public readonly sampleAppRoleProp: RoleProps;
  public readonly cloudwatchAddonRoleProp: RoleProps;
  public readonly syntheticCanaryRoleProp: RoleProps;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // This is the master role prop for the Eks cluster, it can be used to log in to the cluster for debugging purposes
    this.eksClusterRoleProp = {
      roleName: 'PetClinicEksClusterRole',
      assumedBy: new CompositePrincipal(
        new ServicePrincipal('eks.amazonaws.com'),
        new AccountRootPrincipal(),
      ),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSServicePolicy'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
      ],
      // Need this policy to assume role and debug the cluster
      inlinePolicies: {
        describeClusterPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ['eks:DescribeCluster'],
              resources: ['*'],
            }),
          ],
        }),
      },
    };

    // Role prop for the EBS CSI Add-on
    this.ebsCsiAddonRoleProp = {
      roleName: 'PetClinicEbsCsiAddonRole',
      assumedBy: new ServicePrincipal('eks.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEBSCSIDriverPolicy'),
      ],
    };

    // The node group role must be seperate from the cluster master role
    this.eksNodeGroupRoleProp = {
      roleName: 'PetClinicEksNodeGroupRole',
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonEKS_CNI_Policy'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSWorkerNodePolicy'),
      ],
    };

    // Role prop for the pet clinic sample app
    this.sampleAppRoleProp = {
      roleName: 'PetClinicSampleAppRole',
      assumedBy: new ServicePrincipal('eks.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSQSFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonKinesisFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AWSXrayFullAccess'),
      ],
    };

    // Role prop for the Cloudwatch Addon Add-on 
    this.cloudwatchAddonRoleProp = {
      roleName: 'PetClinicCloudwatchAddonRole',
      assumedBy: new ServicePrincipal('eks.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    };

    // Role prop for the synthetic canary
    this.syntheticCanaryRoleProp = {
      roleName: 'PetClinicSyntheticCanaryRole',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        SyntheticsInlinePolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:PutObject', 's3:GetObject'],
              resources: ['arn:aws:s3:::cw-syn-results-petclinic-*-*/*'],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:GetBucketLocation'],
              resources: ['arn:aws:s3:::cw-syn-results-petclinic-*-*'],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                'logs:CreateLogGroup',
              ],
              resources: ['arn:aws:logs:*:*:log-group:/aws/lambda/cwsyn-*'],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:ListAllMyBuckets', 'xray:PutTraceSegments'],
              resources: ['*'],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['cloudwatch:PutMetricData'],
              resources: ['*'],
              conditions: {
                StringEquals: {
                  'cloudwatch:namespace': 'CloudWatchSynthetics',
                },
              },
            }),
          ],
        }),
      }
    }
  }
}