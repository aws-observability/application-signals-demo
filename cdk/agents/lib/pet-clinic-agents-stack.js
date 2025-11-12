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

    // Deploy nutrition agent with optional environment variable
    const nutritionAgentName = 'nutrition_agent';
    const nutritionAgentProps = {
      AgentName: nutritionAgentName,
      ImageUri: nutritionAgentImage.imageUri,
      ExecutionRole: agentCoreRole.roleArn,
      Entrypoint: 'nutrition_agent.py',
      EnvironmentVariables: {
        OTEL_RESOURCE_ATTRIBUTES: `service.name=${nutritionAgentName},deployment.environment=bedrock-agentcore:default,Application=Audit,Team=AnalyticsTeam,Tier=Tier-4,aws.application_signals.metric_resource_keys=Application&Team&Tier`,
        OTEL_PYTHON_DISABLED_INSTRUMENTATIONS: 'sqlalchemy,psycopg2,pymysql,sqlite3,aiopg,asyncpg,mysql_connector,system_metrics,google-genai'
      }
    };
    
    if (props?.nutritionServiceUrl) {
      nutritionAgentProps.EnvironmentVariables.NUTRITION_SERVICE_URL = props.nutritionServiceUrl;
    }
    
    const nutritionAgent = new BedrockAgentCoreDeployer(this, 'NutritionAgent', nutritionAgentProps);

    // Deploy primary agent
    const petClinicAgentName = 'pet_clinic_agent'
    const primaryAgent = new BedrockAgentCoreDeployer(this, 'PrimaryAgent', {
      AgentName: petClinicAgentName,
      ImageUri: primaryAgentImage.imageUri,
      ExecutionRole: agentCoreRole.roleArn,
      Entrypoint: 'pet_clinic_agent.py',
      EnvironmentVariables: {
        NUTRITION_AGENT_ARN: nutritionAgent.agentArn,
        OTEL_RESOURCE_ATTRIBUTES: `service.name=${petClinicAgentName},deployment.environment=bedrock-agentcore:default,Application=Audit,Team=AnalyticsTeam,Tier=Tier-4,aws.application_signals.metric_resource_keys=Application&Team&Tier`
      }
    });

    this.nutritionAgentImageUri = nutritionAgentImage.imageUri;
    this.primaryAgentImageUri = primaryAgentImage.imageUri;
    this.nutritionAgentArn = nutritionAgent.agentArn;
    this.primaryAgentArn = primaryAgent.agentArn;
  }
}

module.exports = { PetClinicAgentsStack };
