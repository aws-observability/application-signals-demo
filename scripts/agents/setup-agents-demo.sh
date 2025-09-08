#!/bin/bash

set -e

# Default values
REGION="us-east-1"
OPERATION="deploy"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --region=*)
      REGION="${1#*=}"
      shift
      ;;
    --operation=*)
      OPERATION="${1#*=}"
      shift
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo "Setting up Pet Clinic Agents Demo in region: $REGION"
echo "Operation: $OPERATION"

# Set AWS region
export AWS_REGION=$REGION
export AWS_DEFAULT_REGION=$REGION

# Navigate to CDK agents directory
cd "$(dirname "$0")/../../cdk/agents"

# Unset DOCKER_HOST to avoid Docker connection issues
unset DOCKER_HOST

case $OPERATION in
  deploy)
    echo "Deploying Pet Clinic Agents..."
    npm install
    cdk bootstrap --region $REGION
    cdk deploy --all --require-approval never
    echo "✅ Pet Clinic Agents deployed successfully!"
    echo ""
    echo "Agent ARNs:"
    echo "  Check CloudFormation stack outputs in AWS Console for agent ARNs"
    echo "  Stack name: PetClinicAgentsStack"
    ;;
  delete)
    echo "Destroying Pet Clinic Agents..."
    cdk destroy --all --force
    echo "✅ Pet Clinic Agents destroyed successfully!"
    ;;
  *)
    echo "Invalid operation: $OPERATION"
    echo "Valid operations: deploy, delete"
    exit 1
    ;;
esac