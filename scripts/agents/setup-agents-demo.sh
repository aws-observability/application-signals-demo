#!/bin/bash

set -e

# Default values
REGION="us-east-1"
OPERATION="deploy"
NUTRITION_SERVICE_URL=""

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
    --nutrition-service-url=*)
      NUTRITION_SERVICE_URL="${1#*=}"
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
    if [[ -z "$NUTRITION_SERVICE_URL" ]]; then
      echo "Auto-discovering nutrition service URL from EKS cluster..."
      if ! command -v kubectl &> /dev/null; then
        echo "Warning: kubectl not found. Skipping nutrition service URL discovery."
      elif ! kubectl cluster-info &> /dev/null; then
        echo "Warning: Cannot connect to Kubernetes cluster. Skipping nutrition service URL discovery."
      else
        INGRESS_HOST=$(kubectl get ingress -n pet-clinic -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
        if [[ -n "$INGRESS_HOST" ]]; then
          NUTRITION_SERVICE_URL="http://${INGRESS_HOST}/nutrition"
          echo "Discovered nutrition service URL: $NUTRITION_SERVICE_URL"
        else
          echo "Warning: No ingress found in pet-clinic namespace."
          echo "Agent will run without nutrition service integration."
        fi
      fi
    else
      echo "Using provided nutrition service URL: $NUTRITION_SERVICE_URL"
    fi
    if [[ -n "$NUTRITION_SERVICE_URL" ]]; then
      export NUTRITION_SERVICE_URL
    fi
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