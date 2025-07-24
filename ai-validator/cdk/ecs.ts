import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as path from "path";
import * as dotenv from "dotenv";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Load environment variables
const DEMO_AWS_ACCOUNT_ID = process.env.DEMO_AWS_ACCOUNT_ID;
const DEMO_ROLE_ID = process.env.DEMO_ROLE_ID;
const CLOUDWATCH_NAMESPACE = process.env.CLOUDWATCH_NAMESPACE || "";

export class AIValidatorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "AITestVPC", {
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const cluster = new ecs.Cluster(this, "EcsCluster", {
      vpc,
      clusterName: "AIValidatorCluster",
    });

    const taskRole = new iam.Role(this, "ECSTaskRole", {
      roleName: "ValidationTestRole",
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("ec2.amazonaws.com"),
        new iam.ServicePrincipal("ecs-tasks.amazonaws.com")
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonBedrockFullAccess"),
      ],
    });

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:CreateBucket", "s3:PutObject", "s3:HeadBucket"],
        resources: ["arn:aws:s3:::*", "arn:aws:s3:::*/*"],
      })
    );

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["cloudwatch:PutMetricData"],
        resources: ["*"],
      })
    );

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${DEMO_AWS_ACCOUNT_ID}:role/${DEMO_ROLE_ID}`],
      })
    );

    const testFiles = [
      "test-1.script.md",
      "test-2.script.md",
      "test-3.script.md",
      "test-4.script.md",
      "test-5.script.md",
      "test-6.script.md",
      "test-7.script.md",
      "test-8.script.md",
      "test-9.script.md",
      "test-10.script.md",
      "test-11.script.md",
      "test-12.script.md",
      "test-13-appointment-audit-visits.script.md",
      "test-13-customers-service-java.script.md",
      "test-13-pet-clinic-frontend-java-1.script.md",
      "test-13-pet-clinic-frontend-java-2.script.md",
      "test-13-pet-clinic-frontend-java-3.script.md",
      "test-13-pet-clinic-frontend-java-4.script.md",
      "test-13-pet-clinic-frontend-java-5.script.md",
    ];

    const failureAlarms: cloudwatch.Alarm[] = [];

    testFiles.forEach((scriptFile) => {
      const testId = scriptFile.replace(".script.md", "");

      const taskDef = new ecs.FargateTaskDefinition(this, `TaskDef-${testId}`, {
        cpu: 2048,
        memoryLimitMiB: 4096,
        taskRole,
      });

      taskDef.addContainer(`AITestContainer-${testId}`, {
        image: ecs.ContainerImage.fromAsset(".", {
          buildArgs: {
            REBUILD_CACHE_BUSTER: new Date().toISOString(), // Ensures image is rebuilt every deploy for new commits
          },
        }),
        command: ["python3.11", "main.py", `tests/${scriptFile}`],
        logging: ecs.LogDrivers.awsLogs({
          streamPrefix: `aitest-${testId}`,
          logGroup: new logs.LogGroup(this, `LogGroup-${testId}`, {
            logGroupName: `/ecs/aitest-${testId}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            retention: logs.RetentionDays.ONE_WEEK,
          }),
        }),
      });

      new events.Rule(this, `ScheduleRule-${testId}`, {
        schedule: events.Schedule.rate(cdk.Duration.hours(1)),
        targets: [
          new targets.EcsTask({
            cluster,
            taskDefinition: taskDef,
            taskCount: 1,
            subnetSelection: {
              subnetType: ec2.SubnetType.PUBLIC,
            },
            assignPublicIp: true,
          }),
        ],
      });

      // Set up alarm for each specific test
      const failureMetric = new cloudwatch.Metric({
        namespace: CLOUDWATCH_NAMESPACE,
        metricName: "Failure",
        dimensionsMap: {
          TestCase: testId,
        },
        period: cdk.Duration.hours(12),
        statistic: "Sum",
      });

      const alarm = new cloudwatch.Alarm(this, `FailureAlarm-${testId}`, {
        alarmName: `FailureAlarm-${testId}`,
        metric: failureMetric,
        threshold: 4,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      failureAlarms.push(alarm);
    });

    // Set up composite alarm that is triggered if any of its children (any specific test) alarm is triggered
    new cloudwatch.CfnCompositeAlarm(this, "RootFailureAlarm", {
      alarmName: "AnyTestFailureAlarm",
      alarmDescription: "Triggered if any test failure alarm is triggered",
      alarmRule: cloudwatch.AlarmRule.anyOf(
        ...failureAlarms.map((alarm) =>
          cloudwatch.AlarmRule.fromAlarm(alarm, cloudwatch.AlarmState.ALARM)
        )
      ).renderAlarmRule(),
    });

    new cdk.CfnOutput(this, "ClusterArn", {
      value: cluster.clusterArn,
      description: "ARN of the ECS cluster",
    });
  }
}

const app = new cdk.App();

new AIValidatorStack(app, "AIValidatorStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
app.synth();
