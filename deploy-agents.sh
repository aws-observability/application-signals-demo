#!/bin/bash

set -e

echo "=== Deploying Pet Clinic Agents ==="

# Get AWS account and region
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}

echo "Account: $ACCOUNT"
echo "Region: $REGION"

# Deploy CDK stack first to create ECR repos
echo "1. Deploying CDK stack to create ECR repositories..."
cd cdk/agent
cdk deploy PetClinicAgentsStack --require-approval never

# Get ECR repository URIs
NUTRITION_REPO_URI="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/bedrock-agentcore-nutrition-agent"
PRIMARY_REPO_URI="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/bedrock-agentcore-primary-agent"

echo "2. Building and pushing Docker images..."

# Login to ECR
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com

# Build and push nutrition agent
echo "Building nutrition agent..."
cd ../../pet_clinic_agents/nutrition_agent
docker build -t $NUTRITION_REPO_URI:latest .
docker push $NUTRITION_REPO_URI:latest

# Build and push primary agent
echo "Building primary agent..."
cd ../primary_agent
docker build -t $PRIMARY_REPO_URI:latest .
docker push $PRIMARY_REPO_URI:latest

echo "3. Updating CDK stack to deploy agents..."
cd ../../cdk/agent
cdk deploy PetClinicAgentsStack --require-approval never

echo "=== Deployment Complete ==="
echo "Nutrition Agent Image: $NUTRITION_REPO_URI:latest"
echo "Primary Agent Image: $PRIMARY_REPO_URI:latest"