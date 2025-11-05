#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { PetClinicAgentsStack } = require('./lib/pet-clinic-agents-stack');
const { PetClinicAgentsTrafficGeneratorStack } = require('./lib/pet-clinic-agents-traffic-generator-stack');

const app = new cdk.App();

// Deploy Pet Clinic agents
const agentsStack = new PetClinicAgentsStack(app, 'PetClinicAgentsStack', {
  nutritionServiceUrl: process.env.NUTRITION_SERVICE_URL,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

// Deploy Pet Clinic agents traffic generator
new PetClinicAgentsTrafficGeneratorStack(app, 'PetClinicAgentsTrafficGeneratorStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  primaryAgentArn: agentsStack.primaryAgentArn,
  nutritionAgentArn: agentsStack.nutritionAgentArn,
});

app.synth();