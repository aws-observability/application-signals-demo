import * as cdk from 'aws-cdk-lib';
import { aws_bedrock as bedrock } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class GuardrailStack extends cdk.Stack {
  // Make guardrail publicly accessible for other stacks
  public readonly guardrail: bedrock.CfnGuardrail;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create IAM role for the guardrail
    const guardrailRole = new iam.Role(this, 'AppSignalsGuardrailRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Role for Application Signals guardrail',
    });

    // Add permissions to the role
    guardrailRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'bedrock:*'
        ],
        resources: ['*'],
        effect: iam.Effect.ALLOW,
      })
    );

    // Create a basic guardrail with minimal content requirements
    this.guardrail = new bedrock.CfnGuardrail(this, 'AppSignalsGuardrail', {
      name: 'appsignals_llm_guardrail',
      description: 'Guardrail for Application Signals documentation',
      // Empty guardrail configuration - minimal working setup
      contentPolicyConfig: {
        filtersConfig: [
          {
            type: 'HATE',
            inputStrength: 'MEDIUM',
            outputStrength: 'MEDIUM'
          }
        ]
      },
      // Required messaging for blocked content
      blockedInputMessaging: "I'm unable to respond to that request as it may violate our content policies.",
      blockedOutputsMessaging: "I need to politely decline this request as it may contain content that violates our policies."
    });

    // Create outputs for the guardrail
    new cdk.CfnOutput(this, 'GuardrailId', {
      value: this.guardrail.attrGuardrailId,
      description: 'The ID of the Application Signals guardrail',
      exportName: 'AppSignalsGuardrailId'
    });

    new cdk.CfnOutput(this, 'GuardrailArn', {
      value: this.guardrail.attrGuardrailArn,
      description: 'The ARN of the Application Signals guardrail',
      exportName: 'AppSignalsGuardrailArn'
    });
  }
}