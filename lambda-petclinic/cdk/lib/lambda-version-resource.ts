import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface LambdaVersioningProps {
  /**
   * The Lambda function to work with
   */
  lambdaFunction: lambda.Function;
  
  /**
   * Path to the alternate implementation code bundle
   */
  alternateCodePath: string;
  
  /**
   * Weight for the alternate implementation (0-1)
   */
  alternateVersionWeight: number;
  
  /**
   * Name of the alias to create
   */
  aliasName: string;
}

/**
 * Custom resource to handle Lambda versioning and traffic routing
 */
export class LambdaVersioning extends Construct {
  /**
   * ARN of the created alias
   */
  public readonly aliasArn: string;
  
  /**
   * Name of the created alias
   */
  public readonly aliasName: string;

  constructor(scope: Construct, id: string, props: LambdaVersioningProps) {
    super(scope, id);
    
    // Create a Lambda function to handle our custom resource lifecycle
    const handler = new lambda.Function(this, 'VersionHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/lambda-version-handler'), {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c',
            'npm install && cp -r . /asset-output/'
          ],
        }
      }),
      timeout: cdk.Duration.minutes(5),
    });
    
    // Grant the handler permissions to manage Lambda functions
    handler.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'lambda:PublishVersion',
        'lambda:UpdateFunctionCode',
        'lambda:CreateAlias',
        'lambda:UpdateAlias',
        'lambda:DeleteAlias',
        'lambda:GetFunction',
        'lambda:GetAlias',
        'lambda:ListVersionsByFunction',
        'lambda:ListAliases',
        'lambda:GetFunctionConfiguration',
        's3:GetObject',
        's3:HeadObject'
      ],
      resources: ['*'], // Scope this down in a real production environment
    }));
    
    // Add AWS managed policy for basic Lambda execution (includes CloudWatch Logs permissions)
    const lambdaRole = handler.role as iam.Role;
    lambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
    );
    
    // Create a provider from our Lambda function
    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler: handler,
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK, // Keep logs for debugging
    });
    
    // Parse the S3 path (format: bucket-name/key/path/file.zip)
    const pathParts = props.alternateCodePath.split('/');
    const bucket = pathParts[0];
    const key = pathParts.slice(1).join('/');
    
    // Create the custom resource
    const resource = new cdk.CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
      properties: {
        FunctionName: props.lambdaFunction.functionName,
        S3Bucket: bucket,
        S3Key: key,
        AlternateVersionWeight: props.alternateVersionWeight,
        AliasName: props.aliasName,
      },
    });
    
    // Export outputs
    this.aliasArn = resource.getAttString('aliasArn');
    this.aliasName = props.aliasName;
  }
}