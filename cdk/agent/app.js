#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { AgentTrafficGeneratorStack } = require('./lib/agent-traffic-generator-stack');

const app = new cdk.App();
new AgentTrafficGeneratorStack(app, 'PetClinicAgentTrafficGeneratorStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});