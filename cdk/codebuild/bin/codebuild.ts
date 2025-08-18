#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CodeBuildStack } from '../lib/codebuild-stack';

const app = new cdk.App();

new CodeBuildStack(app, 'ApplicationSignalsCodeBuildStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: 'CodeBuild project for building Application Signals demo Docker images',
});

app.synth();
