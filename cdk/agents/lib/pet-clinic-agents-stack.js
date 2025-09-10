const { Stack, RemovalPolicy } = require('aws-cdk-lib');
const ecrAssets = require('aws-cdk-lib/aws-ecr-assets');
const iam = require('aws-cdk-lib/aws-iam');
const { BedrockAgentCoreDeployer } = require('./bedrock-agentcore-deployer');

/**
 * CDK Stack that deploys the Pet Clinic Agents images to ECR and creates Bedrock AgentCore Runtime instances
 * for those images. AgentCore Runtime is a containerized host service for AI agents that processes user inputs,
 * maintains context, and executes actions using AI capabilities.
 * 
 * See: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-how-it-works.html
 */
class PetClinicAgentsStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const account = this.account;
    const region = this.region;

    // Create Bedrock AgentCore execution role:
    // See: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-permissions.html
    const agentCoreRole = new iam.Role(this, 'BedrockAgentCoreRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      roleName: 'PetClinicBedrockAgentCoreRole',
      inlinePolicies: {
        AgentCorePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ecr:BatchGetImage',
                'ecr:GetDownloadUrlForLayer',
                'ecr:GetAuthorizationToken'
              ],
              resources: ['*']
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents'
              ],
              resources: [`arn:aws:logs:${region}:${account}:*`]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock-agentcore:*'
              ],
              resources: ['*']
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream'
              ],
              resources: ['*']
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'xray:PutTraceSegments',
                'xray:PutTelemetryRecords'
              ],
              resources: ['*']
            })
          ]
        })
      }
    });
    
    const nutritionAgentImage = new ecrAssets.DockerImageAsset(this, 'NutritionAgentImage', {
      directory: '../../pet_clinic_ai_agents/nutrition_agent'
    });

    const primaryAgentImage = new ecrAssets.DockerImageAsset(this, 'PrimaryAgentImage', {
      directory: '../../pet_clinic_ai_agents/primary_agent'
    });

    // Deploy nutrition agent
    const nutritionAgent = new BedrockAgentCoreDeployer(this, 'NutritionAgent', {
      AgentName: 'nutrition_agent',
      ImageUri: nutritionAgentImage.imageUri,
      ExecutionRole: agentCoreRole.roleArn,
      Entrypoint: 'nutrition_agent.py'
    });

    // Deploy primary agent
    const primaryAgent = new BedrockAgentCoreDeployer(this, 'PrimaryAgent', {
      AgentName: 'pet_clinic_agent',
      ImageUri: primaryAgentImage.imageUri,
      ExecutionRole: agentCoreRole.roleArn,
      Entrypoint: 'pet_clinic_agent.py'
    });

    this.nutritionAgentImageUri = nutritionAgentImage.imageUri;
    this.primaryAgentImageUri = primaryAgentImage.imageUri;
    this.nutritionAgentArn = nutritionAgent.agentArn;
    this.primaryAgentArn = primaryAgent.agentArn;
  }
}

module.exports = { PetClinicAgentsStack };