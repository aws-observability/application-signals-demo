import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

export interface LambdaStackProps extends StackProps {
  functionName: string;
  lambdaCodePath: string;
  testCasesPath: string;
}

export class LambdaStack extends Stack {
  public readonly lambdaFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // Create Lambda execution role
    const role = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ],
    });

    // Add permissions for CloudWatch Logs, Metrics, and X-Ray
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccess'));
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXrayFullAccess'));

    // Create Lambda function from a directory
    this.lambdaFunction = new lambda.Function(this, 'APMDemoTestLambda', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.resolve(__dirname, '../../lambda_deployment')), // Will be created by deployment script
      role: role,
      functionName: props.functionName,
      timeout: Duration.seconds(300),
      memorySize: 256,
    });

    // Create an EventBridge rule to trigger the Lambda function every 30 minutes
    const rule = new events.Rule(this, 'ScheduleRule', {
      schedule: events.Schedule.rate(Duration.minutes(30)),
      description: 'Triggers the APM Demo Test Runner Lambda function every 30 minutes',
    });

    // Add the Lambda function as a target for the EventBridge rule
    rule.addTarget(new targets.LambdaFunction(this.lambdaFunction, {
      retryAttempts: 3, // Retry up to 3 times if the function fails
    }));
  }
}