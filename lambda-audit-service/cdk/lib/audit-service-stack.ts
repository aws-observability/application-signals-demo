import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import * as path from 'path';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';

export class AuditServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // SQS Queue
    const auditJobsQueue = new sqs.Queue(this, 'AuditJobsQueue', {
      queueName: 'audit-jobs',
      visibilityTimeout: cdk.Duration.seconds(600),
      receiveMessageWaitTime: cdk.Duration.seconds(0),
      retentionPeriod: cdk.Duration.seconds(1000),
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: new sqs.Queue(this, 'AuditJobsDLQ', {
          queueName: 'audit-jobs-dlq',
          retentionPeriod: cdk.Duration.days(14),
        }),
      },
    });

    const queuePolicy = new sqs.QueuePolicy(this, 'AuditQueuePolicy', {
      queues: [auditJobsQueue],
    });
    
    queuePolicy.document.addStatements(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'sqs:ChangeMessageVisibility',
          'sqs:ChangeMessageVisibilityBatch',
          'sqs:GetQueueAttributes',
          'sqs:GetQueueUrl',
          'sqs:ListDeadLetterSourceQueues',
          'sqs:ListQueues',
          'sqs:ReceiveMessage',
          'sqs:SendMessage',
          'sqs:SendMessageBatch',
          'sqs:SetQueueAttributes',
        ],
        resources: ['arn:aws:sqs:*:*:*/SQSPolicy'],
      })
    );

    // IAM Role for Lambda
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecRoleAuditService', {
      roleName: 'lambda_exec_role_audit_service',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    lambdaExecutionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
    );

    lambdaExecutionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLambdaApplicationSignalsExecutionRolePolicy')
    );

    const dynamoDbPolicy = new iam.Policy(this, 'DynamoDBReadPolicy', {
      policyName: 'lambda_dynamodb_read_policy',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'dynamodb:GetItem',
            'dynamodb:BatchGetItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:DescribeTable',
          ],
          resources: [
            `arn:aws:dynamodb:*:*:table/PetClinicPayment`,
            `arn:aws:dynamodb:*:*:table/PetClinicPayment/index/*`
          ],
        }),
      ],
    });
    dynamoDbPolicy.attachToRole(lambdaExecutionRole);

    // OpenTelemetry Layer ARNs by region
    const layerArnsByRegion: { [key: string]: string } = {
      'af-south-1': 'arn:aws:lambda:af-south-1:904233096616:layer:AWSOpenTelemetryDistroPython:4',
      'ap-east-1': 'arn:aws:lambda:ap-east-1:888577020596:layer:AWSOpenTelemetryDistroPython:4',
      'ap-northeast-1': 'arn:aws:lambda:ap-northeast-1:615299751070:layer:AWSOpenTelemetryDistroPython:4',
      'ap-northeast-2': 'arn:aws:lambda:ap-northeast-2:615299751070:layer:AWSOpenTelemetryDistroPython:4',
      'ap-northeast-3': 'arn:aws:lambda:ap-northeast-3:615299751070:layer:AWSOpenTelemetryDistroPython:4',
      'ap-south-1': 'arn:aws:lambda:ap-south-1:615299751070:layer:AWSOpenTelemetryDistroPython:4',
      'ap-south-2': 'arn:aws:lambda:ap-south-2:796973505492:layer:AWSOpenTelemetryDistroPython:4',
      'ap-southeast-1': 'arn:aws:lambda:ap-southeast-1:615299751070:layer:AWSOpenTelemetryDistroPython:4',
      'ap-southeast-2': 'arn:aws:lambda:ap-southeast-2:615299751070:layer:AWSOpenTelemetryDistroPython:4',
      'ap-southeast-3': 'arn:aws:lambda:ap-southeast-3:039612877180:layer:AWSOpenTelemetryDistroPython:4',
      'ap-southeast-4': 'arn:aws:lambda:ap-southeast-4:713881805771:layer:AWSOpenTelemetryDistroPython:4',
      'ca-central-1': 'arn:aws:lambda:ca-central-1:615299751070:layer:AWSOpenTelemetryDistroPython:4',
      'eu-central-1': 'arn:aws:lambda:eu-central-1:615299751070:layer:AWSOpenTelemetryDistroPython:4',
      'eu-central-2': 'arn:aws:lambda:eu-central-2:156041407956:layer:AWSOpenTelemetryDistroPython:4',
      'eu-north-1': 'arn:aws:lambda:eu-north-1:615299751070:layer:AWSOpenTelemetryDistroPython:4',
      'eu-south-1': 'arn:aws:lambda:eu-south-1:257394471194:layer:AWSOpenTelemetryDistroPython:4',
      'eu-south-2': 'arn:aws:lambda:eu-south-2:490004653786:layer:AWSOpenTelemetryDistroPython:4',
      'eu-west-1': 'arn:aws:lambda:eu-west-1:615299751070:layer:AWSOpenTelemetryDistroPython:4',
      'eu-west-2': 'arn:aws:lambda:eu-west-2:615299751070:layer:AWSOpenTelemetryDistroPython:4',
      'eu-west-3': 'arn:aws:lambda:eu-west-3:615299751070:layer:AWSOpenTelemetryDistroPython:4',
      'il-central-1': 'arn:aws:lambda:il-central-1:746669239226:layer:AWSOpenTelemetryDistroPython:4',
      'me-central-1': 'arn:aws:lambda:me-central-1:739275441131:layer:AWSOpenTelemetryDistroPython:4',
      'me-south-1': 'arn:aws:lambda:me-south-1:980921751758:layer:AWSOpenTelemetryDistroPython:4',
      'sa-east-1': 'arn:aws:lambda:sa-east-1:615299751070:layer:AWSOpenTelemetryDistroPython:4',
      'us-east-1': 'arn:aws:lambda:us-east-1:615299751070:layer:AWSOpenTelemetryDistroPython:4',
      'us-east-2': 'arn:aws:lambda:us-east-2:615299751070:layer:AWSOpenTelemetryDistroPython:4',
      'us-west-1': 'arn:aws:lambda:us-west-1:615299751070:layer:AWSOpenTelemetryDistroPython:11',
      'us-west-2': 'arn:aws:lambda:us-west-2:615299751070:layer:AWSOpenTelemetryDistroPython:11',
    };

    // Get appropriate layer ARN for the current region
    const regionName = cdk.Stack.of(this).region;
    const otelLayerArn = layerArnsByRegion[regionName] || '';

    // Create Lambda function with OTel layer
    const auditServiceLambda = new lambda.Function(this, 'AuditServiceLambda', {
      functionName: 'audit-service',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'lambda_function.lambda_handler',
      timeout: cdk.Duration.seconds(600),
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../sample-app/build/good_function.zip')),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-instrument',
      },
    });  

    // S3 Bucket for Lambda function
    const functionBucket = new s3.Bucket(this, 'AuditServiceFunctionBucket', {
      bucketName: `audit-service-functions-${cdk.Stack.of(this).account}-${cdk.Stack.of(this).region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create asset
    const functionAsset = new s3assets.Asset(this, 'GoodFunctionAsset', {
      path: path.join(__dirname, '../../sample-app/build/good_function.zip'),
    });

    // Copy asset to your bucket with fixed key using custom resource
    const copyAsset = new cr.AwsCustomResource(this, 'CopyAssetToFixedKey', {
      onUpdate: {
        service: 'S3',
        action: 'copyObject',
        parameters: {
          CopySource: `${functionAsset.s3BucketName}/${functionAsset.s3ObjectKey}`,
          Bucket: functionBucket.bucketName,
          Key: 'lambda-functions/good_function.zip',
        },
        physicalResourceId: cr.PhysicalResourceId.of('copy-asset'),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['s3:GetObject'],
          resources: [`${functionAsset.bucket.bucketArn}/*`],
        }),
        new iam.PolicyStatement({
          actions: ['s3:PutObject'],
          resources: [`${functionBucket.bucketArn}/*`],
        }),
      ]),
    });


    // Create Lambda function for deployment
    const auditServiceDeploymentLambda = new lambda.Function(this, 'AuditServiceDeploymentLambda', {
      functionName: 'audit-service-update',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'lambda_function.lambda_handler',
      timeout: cdk.Duration.seconds(600),
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../sample-app/build/deployment_function.zip'))
    });
    const lambdaUpdatePolicy = new iam.Policy(this, 'LambdaUpdatePolicy', {
      policyName: 'lambda_update_policy',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'lambda:UpdateFunctionCode',
            'lambda:GetFunction',
          ],
          resources: [`arn:aws:lambda:*:*:function:audit-service`],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
          's3:GetObject',
          's3:ListBucket'
          ],
          resources: [
            `${functionBucket.bucketArn}/*`,
            `${functionBucket.bucketArn}`,
          ],
        }),
      ],
    });
    lambdaUpdatePolicy.attachToRole(lambdaExecutionRole);

    // EventBridge Scheduler to trigger deployment Lambda every hour
    const schedulerRole = new iam.Role(this, 'SchedulerRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });

    schedulerRole.addToPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [auditServiceDeploymentLambda.functionArn],
    }));

    new scheduler.CfnSchedule(this, 'DeploymentSchedule', {
      flexibleTimeWindow: { mode: 'OFF' },
      scheduleExpression: 'rate(90 minutes)',
      target: {
        arn: auditServiceDeploymentLambda.functionArn,
        roleArn: schedulerRole.roleArn,
      },
    });

    cdk.Tags.of(auditServiceLambda).add('Team', 'AnalyticsTeam');
    cdk.Tags.of(auditServiceLambda).add('Application', 'Audit');
    cdk.Tags.of(auditServiceLambda).add('Tier', 'Tier 4');

    if (otelLayerArn) {
      auditServiceLambda.addLayers(
        lambda.LayerVersion.fromLayerVersionArn(this, 'OtelLayer', otelLayerArn)
      );
    }

    // Add SQS as event source for the Lambda function
    auditServiceLambda.addEventSource(new lambdaEventSources.SqsEventSource(auditJobsQueue, {
      batchSize: 1
    }));
  }
}