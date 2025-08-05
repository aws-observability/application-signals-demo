import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';
import { LambdaVersioning } from './lambda-version-resource';

export class LambdaPetClinicStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const table = new dynamodb.Table(this, 'HistoricalRecordTable', {
      tableName: 'HistoricalRecordDynamoDBTable',
      partitionKey: { name: 'recordId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For easier cleanup in demo environments
    });

    // IAM Role for Lambda Functions
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: 'lambda_exec_role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // Add wildcard policy for demo purposes (equivalent to the Terraform configuration)
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['*'],
      resources: ['*'],
      effect: iam.Effect.ALLOW,
    }));

    // OpenTelemetry Layer ARNs by region
    const layerArns: { [key: string]: string } = {
      'af-south-1': 'arn:aws:lambda:af-south-1:904233096616:layer:AWSOpenTelemetryDistroPython:5',
      'ap-east-1': 'arn:aws:lambda:ap-east-1:888577020596:layer:AWSOpenTelemetryDistroPython:5',
      'ap-northeast-1': 'arn:aws:lambda:ap-northeast-1:615299751070:layer:AWSOpenTelemetryDistroPython:5',
      'ap-northeast-2': 'arn:aws:lambda:ap-northeast-2:615299751070:layer:AWSOpenTelemetryDistroPython:5',
      'ap-northeast-3': 'arn:aws:lambda:ap-northeast-3:615299751070:layer:AWSOpenTelemetryDistroPython:5',
      'ap-south-1': 'arn:aws:lambda:ap-south-1:615299751070:layer:AWSOpenTelemetryDistroPython:5',
      'ap-south-2': 'arn:aws:lambda:ap-south-2:796973505492:layer:AWSOpenTelemetryDistroPython:5',
      'ap-southeast-1': 'arn:aws:lambda:ap-southeast-1:615299751070:layer:AWSOpenTelemetryDistroPython:5',
      'ap-southeast-2': 'arn:aws:lambda:ap-southeast-2:615299751070:layer:AWSOpenTelemetryDistroPython:5',
      'ap-southeast-3': 'arn:aws:lambda:ap-southeast-3:039612877180:layer:AWSOpenTelemetryDistroPython:5',
      'ap-southeast-4': 'arn:aws:lambda:ap-southeast-4:713881805771:layer:AWSOpenTelemetryDistroPython:5',
      'ca-central-1': 'arn:aws:lambda:ca-central-1:615299751070:layer:AWSOpenTelemetryDistroPython:5',
      'eu-central-1': 'arn:aws:lambda:eu-central-1:615299751070:layer:AWSOpenTelemetryDistroPython:5',
      'eu-central-2': 'arn:aws:lambda:eu-central-2:156041407956:layer:AWSOpenTelemetryDistroPython:5',
      'eu-north-1': 'arn:aws:lambda:eu-north-1:615299751070:layer:AWSOpenTelemetryDistroPython:5',
      'eu-south-1': 'arn:aws:lambda:eu-south-1:257394471194:layer:AWSOpenTelemetryDistroPython:5',
      'eu-south-2': 'arn:aws:lambda:eu-south-2:490004653786:layer:AWSOpenTelemetryDistroPython:5',
      'eu-west-1': 'arn:aws:lambda:eu-west-1:615299751070:layer:AWSOpenTelemetryDistroPython:5',
      'eu-west-2': 'arn:aws:lambda:eu-west-2:615299751070:layer:AWSOpenTelemetryDistroPython:5',
      'eu-west-3': 'arn:aws:lambda:eu-west-3:615299751070:layer:AWSOpenTelemetryDistroPython:5',
      'il-central-1': 'arn:aws:lambda:il-central-1:746669239226:layer:AWSOpenTelemetryDistroPython:5',
      'me-central-1': 'arn:aws:lambda:me-central-1:739275441131:layer:AWSOpenTelemetryDistroPython:5',
      'me-south-1': 'arn:aws:lambda:me-south-1:980921751758:layer:AWSOpenTelemetryDistroPython:5',
      'sa-east-1': 'arn:aws:lambda:sa-east-1:615299751070:layer:AWSOpenTelemetryDistroPython:5',
      'us-east-1': 'arn:aws:lambda:us-east-1:615299751070:layer:AWSOpenTelemetryDistroPython:5',
      'us-east-2': 'arn:aws:lambda:us-east-2:615299751070:layer:AWSOpenTelemetryDistroPython:5',
      'us-west-1': 'arn:aws:lambda:us-west-1:615299751070:layer:AWSOpenTelemetryDistroPython:12',
      'us-west-2': 'arn:aws:lambda:us-west-2:615299751070:layer:AWSOpenTelemetryDistroPython:12',
    };

    // Get current region and corresponding layer ARN
    const regionName = cdk.Stack.of(this).region;
    const layerArn = layerArns[regionName] || layerArns['us-east-1']; // Default to us-east-1 if not found
    const otelLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OpenTelemetryLayer', layerArn);

    // Define the bundle options for Python Lambda functions
    const pythonBundlingOptions = {
      image: lambda.Runtime.PYTHON_3_13.bundlingImage,
      command: [
        'bash', '-c', [
          'pip install -r requirements.txt -t /asset-output',
          'cp lambda_function.py /asset-output'
        ].join(' && ')
      ],
    };

    // Lambda Function 1: Create Appointment
    const createLambda = new lambda.Function(this, 'CreateAppointmentFunction', {
      functionName: 'appointment-service-create',
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../sample-apps/function'), {
        bundling: pythonBundlingOptions
      }),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      layers: [otelLayer],
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-instrument',
      },
    });

    // Lambda Function 2: List Appointments
    const listLambda = new lambda.Function(this, 'ListAppointmentsFunction', {
      functionName: 'appointment-service-list',
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../sample-apps/function2'), {
        bundling: pythonBundlingOptions
      }),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      layers: [otelLayer],
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-instrument',
      },
    });

    // Lambda Function 3: Get Appointment
    const getLambda = new lambda.Function(this, 'GetAppointmentFunction', {
      functionName: 'appointment-service-get',
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../sample-apps/function3'), {
        bundling: pythonBundlingOptions
      }),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      layers: [otelLayer],
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-instrument',
        VERSION: 'v1-original',
      },
    });

    // Create the alternate version code as a ZIP asset
    const alternateCodeAsset = new s3assets.Asset(this, 'AlternateCodeAsset', {
      path: path.join(__dirname, '../../sample-apps/function3-different-version'),
      bundling: {
        image: lambda.Runtime.PYTHON_3_13.bundlingImage,
        command: [
          'bash', '-c', [
            'pip install -r requirements.txt -t /tmp/package',
            'cp lambda_function.py /tmp/package/',
            'cd /tmp/package',
            'zip -r /asset-output/function.zip .'
          ].join(' && ')
        ],
        outputType: cdk.BundlingOutput.SINGLE_FILE, // This ensures the ZIP file is preserved as-is
      }
    });
    
    // API Gateway
    const api = new apigateway.RestApi(this, 'AppointmentServiceAPI', {
      restApiName: 'appointment-service-gateway',
      description: 'API Gateway for Lambda function',
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
      },
    });

    // API Gateway Resource for /add
    const addResource = api.root.addResource('add');
    addResource.addMethod('GET', new apigateway.LambdaIntegration(createLambda));

    // API Gateway Resource for /list
    const listResource = api.root.addResource('list');
    listResource.addMethod('GET', new apigateway.LambdaIntegration(listLambda));

    // API Gateway Resource for /get - Using Lambda function with alias
    const getResource = api.root.addResource('get');
    
    // Create Lambda versioning with our custom resource
    const lambdaVersioning = new LambdaVersioning(this, 'GetAppointmentVersioning', {
      lambdaFunction: getLambda,
      alternateCodePath: `${alternateCodeAsset.s3BucketName}/${alternateCodeAsset.s3ObjectKey}`,
      alternateVersionWeight: 0.5, // 50% traffic to the alternate version
      aliasName: 'prod',
    });

    // Create a Lambda integration with the function alias using constructed ARN
    const aliasArn = `${getLambda.functionArn}:prod`;
    const aliasIntegration = new apigateway.LambdaIntegration(
      lambda.Function.fromFunctionAttributes(this, 'GetAppointmentAlias', {
        functionArn: aliasArn,
        sameEnvironment: true,
      })
    );
    
    const getMethod = getResource.addMethod('GET', aliasIntegration);
    
    // Ensure the method depends on the versioning resource
    getMethod.node.addDependency(lambdaVersioning);

    // Lambda Function 4: HTTP Requester
    const httpRequesterLambda = new lambda.Function(this, 'HttpRequesterFunction', {
      functionName: 'HttpRequesterFunction',
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../sample-apps/function4'), {
        bundling: pythonBundlingOptions
      }),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(70),
      environment: {
        API_URL_1: `${api.deploymentStage.urlForPath('/add')}?owners=lw&petid=dog&recordId=1`,
        API_URL_2: `${api.deploymentStage.urlForPath('/list')}?owners=lw&petid=dog`,
        API_URL_3: `${api.deploymentStage.urlForPath('/get')}?owners=lw&petid=dog&recordId=1`,
      },
    });

    // EventBridge Rule to trigger HTTP Requester
    const rule = new events.Rule(this, 'HttpRequesterSchedule', {
      ruleName: 'TriggerHttpRequesterEveryMinute',
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
    });
    
    rule.addTarget(new targets.LambdaFunction(httpRequesterLambda));

    // Outputs
    new cdk.CfnOutput(this, 'ApiAddRecord', {
      value: `${api.deploymentStage.urlForPath('/add')}?owners=lw&petid=dog&recordId=1`,
    });

    new cdk.CfnOutput(this, 'ApiListRecord', {
      value: `${api.deploymentStage.urlForPath('/list')}?owners=lw&petid=dog`,
    });

    new cdk.CfnOutput(this, 'ApiQueryRecord', {
      value: `${api.deploymentStage.urlForPath('/get')}?owners=lw&petid=dog&recordId=1`,
    });

    new cdk.CfnOutput(this, 'LambdaVersionInfo', {
      value: `Traffic is split 50/50 between two versions of ${getLambda.functionName} function`,
    });
  }
}