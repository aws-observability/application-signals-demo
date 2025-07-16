#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuditServiceStack } from '../lib/audit-service-stack';

const app = new cdk.App();
new AuditServiceStack(app, 'AuditServiceStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
  description: 'Audit Service Lambda with SQS trigger and OpenTelemetry instrumentation'
});