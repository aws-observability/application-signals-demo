import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export class CodeBuildStack extends cdk.Stack {
  public readonly sourceBucket: s3.Bucket;
  public readonly codeBuildProject: codebuild.Project;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 bucket for source code
    this.sourceBucket = new s3.Bucket(this, 'SourceBucket', {
      bucketName: `application-signals-codebuild-source-${this.account}-${this.region}`,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          id: 'delete-old-versions',
          noncurrentVersionExpiration: cdk.Duration.days(30),
          enabled: true,
        },
      ],
    });

    // Upload local source code to S3
    const sourceUpload = new s3deploy.BucketDeployment(this, 'SourceUpload', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../../..'), {
          exclude: [
            '.git',
            '.git/**',
            '**/target',
            '**/target/**',
            'node_modules',
            '**/node_modules',
            '**/node_modules/**',
            'cdk/codebuild/node_modules',
            'cdk/codebuild/node_modules/**',
            'cdk/*/node_modules',
            'cdk/*/node_modules/**',
            '**/.DS_Store',
            'cdk.out',
            '**/cdk.out',
            '**/cdk.out/**',
            '**/build',
            '**/build/**',
            '**/__pycache__',
            '**/__pycache__/**',
            '**/*.pyc',
            '.gitignore',
            '.idea',
            '.idea/**',
            '.vscode',
            '.vscode/**',
            '**/*.log',
            '**/package-lock.json',
            '**/yarn.lock',
          ],
        }),
      ],
      destinationBucket: this.sourceBucket,
      destinationKeyPrefix: 'source/',
      prune: false,
      retainOnDelete: false,
    });

    // Create IAM role for CodeBuild
    const codeBuildRole = new iam.Role(this, 'CodeBuildRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      description: 'IAM role for Application Signals CodeBuild project',
    });

    // Add ECR permissions
    codeBuildRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ecr:GetAuthorizationToken',
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
          'ecr:PutImage',
          'ecr:InitiateLayerUpload',
          'ecr:UploadLayerPart',
          'ecr:CompleteLayerUpload',
          'ecr:CreateRepository',
          'ecr:DescribeRepositories',
        ],
        resources: ['*'],
      })
    );

    // Add S3 permissions for source bucket
    this.sourceBucket.grantRead(codeBuildRole);

    // Add CloudWatch Logs permissions
    codeBuildRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: [
          `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/codebuild/*`,
        ],
      })
    );

    // Create CloudWatch Logs group
    const logGroup = new logs.LogGroup(this, 'CodeBuildLogGroup', {
      logGroupName: `/aws/codebuild/application-signals-build`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create CodeBuild project
    this.codeBuildProject = new codebuild.Project(this, 'ApplicationSignalsBuild', {
      projectName: 'application-signals-build',
      description: 'Build Docker images for Application Signals demo',
      source: codebuild.Source.s3({
        bucket: this.sourceBucket,
        path: 'source/',
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.LARGE,
        privileged: true, // Required for Docker
        environmentVariables: {
          AWS_ACCOUNT_ID: {
            value: this.account,
          },
          AWS_DEFAULT_REGION: {
            value: this.region,
          },
        },
      },
      role: codeBuildRole,
      timeout: cdk.Duration.hours(1),
      logging: {
        cloudWatch: {
          logGroup,
        },
      },
      cache: codebuild.Cache.local(
        codebuild.LocalCacheMode.DOCKER_LAYER,
        codebuild.LocalCacheMode.SOURCE,
        codebuild.LocalCacheMode.CUSTOM
      ),
    });

    // Output the S3 bucket name and CodeBuild project name
    new cdk.CfnOutput(this, 'SourceBucketName', {
      value: this.sourceBucket.bucketName,
      description: 'S3 bucket for source code',
    });

    new cdk.CfnOutput(this, 'CodeBuildProjectName', {
      value: this.codeBuildProject.projectName,
      description: 'CodeBuild project name',
    });

    new cdk.CfnOutput(this, 'CodeBuildProjectArn', {
      value: this.codeBuildProject.projectArn,
      description: 'CodeBuild project ARN',
    });

    // Instructions for triggering builds
    new cdk.CfnOutput(this, 'TriggerBuildCommand', {
      value: `aws codebuild start-build --project-name ${this.codeBuildProject.projectName} --region ${this.region}`,
      description: 'Command to trigger a build',
    });
  }
}
