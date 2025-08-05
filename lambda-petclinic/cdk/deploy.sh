#!/bin/bash
set -e

# Check if AWS CDK is installed
if ! command -v cdk &> /dev/null; then
    echo "AWS CDK is not installed. Please install it first."
    echo "npm install -g aws-cdk"
    exit 1
fi

# Install dependencies
npm install

# Build the project
npm run build

# Bootstrap CDK (only needed once per account/region)
cdk bootstrap

# Deploy the stack
cdk deploy --require-approval never

echo "Deployment completed successfully!"