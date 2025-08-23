const { CustomResource, Duration, DockerImage } = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const iam = require('aws-cdk-lib/aws-iam');
const { Construct } = require('constructs');

/**
 * Custom CDK resource for managing Bedrock AgentCore deployments.
 * Uses Lambda-backed CustomResource to handle agent lifecycle (create/update/delete)
 * since AgentCore currently doesn't have native CloudFormation support.
 * 
 * TODO: Deprecate this once Bedrock AgentCore has native CDK constructs available.
 */
class BedrockAgentCoreDeployer extends Construct {
  constructor(scope, id, props) {
    super(scope, id);

    // Lambda function to handle agent CDK deployments
    const deployerFunction = new lambda.Function(this, 'AgentDeployerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'deployer.handler',
      timeout: Duration.minutes(15),
      memorySize: 1024,
      code: lambda.Code.fromAsset('lambda/bedrock-agentcore-deployer', {
        bundling: {
          image: DockerImage.fromRegistry('python:3.12'),
          platform: 'linux/amd64',
          command: [
            'bash', '-c',
            'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output'
          ],
          user: 'root'
        }
      }),
      environment: {
        PYTHONPATH: '/opt/python:/var/runtime'
      }
    });

    deployerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock-agentcore:*',
        'ecr:*',
        'iam:PassRole',
        'iam:GetRole',
        'codebuild:*',
        's3:*',
        'logs:*'
      ],
      resources: ['*']
    }));

    this.customResource = new CustomResource(this, 'BedrockAgentResource', {
      serviceToken: deployerFunction.functionArn,
      properties: props
    });

    this.agentArn = this.customResource.getAttString('AgentArn');
    this.agentName = this.customResource.getAttString('AgentName');
  }
}

module.exports = { BedrockAgentCoreDeployer };