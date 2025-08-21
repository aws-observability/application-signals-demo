#!/bin/bash

set -e

# Set AWS_REGION if not already set
if [ -z "$AWS_REGION" ]; then
    export AWS_REGION=us-east-1
    echo "AWS_REGION not set, defaulting to us-east-1"
else
    echo "Using AWS_REGION: $AWS_REGION"
fi

# Check if PRIMARY_AGENT_ARN is provided
if [ -z "$PRIMARY_AGENT_ARN" ]; then
    echo "Error: PRIMARY_AGENT_ARN environment variable is required"
    echo "Please set it with: export PRIMARY_AGENT_ARN=arn:aws:bedrock-agentcore:region:account:runtime/agent-id"
    exit 1
fi

echo "Deploying traffic generator for agent: $PRIMARY_AGENT_ARN"

# Change to CDK directory
cd cdk/agents

# Install dependencies
echo "Installing CDK dependencies..."
npm install

# Bootstrap CDK (first time only)
echo "Bootstrapping CDK..."
cdk bootstrap

# Deploy the stack
echo "Deploying traffic generator stack..."
cdk deploy --require-approval never

echo "Traffic generator deployed successfully!"
echo "The Lambda function will trigger every minute and call the primary agent with random prompts."
echo ""
echo "To destroy the stack when done:"
echo "cd cdk/agents && cdk destroy"