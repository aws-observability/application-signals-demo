const { Stack, Duration } = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const events = require('aws-cdk-lib/aws-events');
const targets = require('aws-cdk-lib/aws-events-targets');
const iam = require('aws-cdk-lib/aws-iam');

/**
 * Lambda traffic generator for AI agents to simulate user interactions.
 * Triggered by EventBridge scheduler every 2 minutes to send queries to the primary agent.
 */
class PetClinicAgentsTrafficGeneratorStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const trafficGeneratorFunction = new lambda.Function(this, 'PetClinicAgentTrafficGenerator', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'traffic_generator.lambda_handler',
      code: lambda.Code.fromAsset('lambda/traffic-generator'),
      timeout: Duration.minutes(15),
      environment: {
        PRIMARY_AGENT_ARN: props?.primaryAgentArn || '',
        NUTRITION_AGENT_ARN: props?.nutritionAgentArn || '',
        REQUESTS_PER_INVOKE: '20'
      }
    });

    // IAM permissions for bedrock-agentcore
    trafficGeneratorFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock-agentcore:InvokeAgentRuntime'],
      resources: ['*']
    }));

    this.trafficGeneratorFunction = trafficGeneratorFunction;

    const rule = new events.Rule(this, 'PetClinicAgentTrafficGeneratorRule', {
      schedule: events.Schedule.rate(Duration.minutes(1))
    });

    rule.addTarget(new targets.LambdaFunction(trafficGeneratorFunction));
  }
}

module.exports = { PetClinicAgentsTrafficGeneratorStack };