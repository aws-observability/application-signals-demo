#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import * as path from 'path';
import { LambdaStack } from '../lib/lambda-stack';
import { AlarmsStack } from '../lib/alarms-stack';

const app = new App();

// Get environment variables or defaults
const functionName = process.env.LAMBDA_FUNCTION_NAME || 'APM_Demo_Test_Runner';
const lambdaCodePath = process.env.LAMBDA_CODE_PATH || '../lambda';
const testCasesPath = process.env.TEST_CASES_PATH || '../test_cases';
const region = process.env.CDK_DEPLOY_REGION || process.env.AWS_REGION || 'us-east-1';
const account = process.env.CDK_DEPLOY_ACCOUNT || process.env.AWS_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT;
const createAlarms = process.env.CREATE_ALARMS === 'true';

// Create the Lambda stack
const lambdaStack = new LambdaStack(app, 'APMDemoTestLambdaStack', {
  functionName,
  lambdaCodePath,
  testCasesPath,
  env: {
    account: account,
    region: region
  },
  description: 'APM Demo Test Lambda Deployment Stack',
});

// Create the Alarms stack if enabled
if (createAlarms) {
  const baseDir = path.resolve(__dirname, '../..');
  
  new AlarmsStack(app, 'APMDemoTestAlarmsStack', {
    logsTestCasesPath: path.join(baseDir, testCasesPath, 'logs_test_cases.json'),
    metricsTestCasesPath: path.join(baseDir, testCasesPath, 'metrics_test_cases.json'),
    tracesTestCasesPath: path.join(baseDir, testCasesPath, 'traces_test_cases.json'),
    cloudtrailTestCasesPath: path.join(baseDir, testCasesPath, 'cloudtrail_test_cases.json'),
    otelResourceAttributesTestCasesPath: path.join(baseDir, testCasesPath, 'otel_resource_attributes_test_cases.json'),
    tagsTestCasesPath: path.join(baseDir, testCasesPath, 'grouping_tag_test_cases.json'),
    env: {
      account: account,
      region: region
    },
    description: 'APM Demo Test CloudWatch Alarms Stack',
  });
}