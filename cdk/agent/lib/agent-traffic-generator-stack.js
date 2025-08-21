const { Stack, Duration } = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const events = require('aws-cdk-lib/aws-events');
const targets = require('aws-cdk-lib/aws-events-targets');
const iam = require('aws-cdk-lib/aws-iam');

class PetClinicAgentTrafficGeneratorStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const trafficGeneratorFunction = new lambda.Function(this, 'PetClinicAgentTrafficGenerator', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'traffic_generator.lambda_handler',
      code: lambda.Code.fromAsset('../../traffic-generator/agent/lambda'),
      timeout: Duration.minutes(5),
      environment: {
        PRIMARY_AGENT_ARN: process.env.PRIMARY_AGENT_ARN || ''
      }
    });

    // IAM permissions for bedrock-agentcore
    trafficGeneratorFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock-agentcore:InvokeAgentRuntime'],
      resources: ['*']
    }));

    const rule = new events.Rule(this, 'PetClinicAgentTrafficGeneratorRule', {
      schedule: events.Schedule.rate(Duration.minutes(2))
    });

    rule.addTarget(new targets.LambdaFunction(trafficGeneratorFunction));
  }
}

module.exports = { AgentTrafficGeneratorStack: PetClinicAgentTrafficGeneratorStack };