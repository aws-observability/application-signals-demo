#!/bin/bash
set -e

# Check if AWS CDK is installed
if ! command -v cdk &> /dev/null; then
    echo "AWS CDK is not installed. Please install it first."
    echo "npm install -g aws-cdk"
    exit 1
fi

# Ensure the project is built
if [ ! -d "cdk.out" ]; then
    echo "Building project first..."
    npm install
    npm run build
fi

# Destroy the stack
echo "Destroying LambdaPetClinicStack..."
cdk destroy --force

echo "Destruction completed successfully!"