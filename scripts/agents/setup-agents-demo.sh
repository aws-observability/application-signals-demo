#!/bin/bash

set -e

# Default values
REGION="us-east-1"
OPERATION="deploy"
PET_CLINIC_URL=""

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
    --pet-clinic-url=*)
      PET_CLINIC_URL="${1#*=}"
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
    if [[ -z "$PET_CLINIC_URL" ]]; then
      echo "Auto-discovering Pet Clinic URL from EKS cluster..."
      if ! command -v kubectl &> /dev/null; then
        echo "Warning: kubectl not found. Skipping Pet Clinic URL discovery."
      elif ! kubectl cluster-info &> /dev/null; then
        echo "Warning: Cannot connect to Kubernetes cluster. Skipping Pet Clinic URL discovery."
      else
        INGRESS_HOST=$(kubectl get svc -n ingress-nginx -o jsonpath='{.items[?(@.metadata.name=="ingress-nginx-controller")].status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
        if [[ -n "$INGRESS_HOST" ]]; then
          PET_CLINIC_URL="http://${INGRESS_HOST}"
          echo "Discovered Pet Clinic URL: $PET_CLINIC_URL"
        else
          echo "Warning: No ingress found."
          echo "Agent will run without Pet Clinic integration."
        fi
      fi
    else
      echo "Using provided Pet Clinic URL: $PET_CLINIC_URL"
    fi
    if [[ -n "$PET_CLINIC_URL" ]]; then
      export PET_CLINIC_URL
    fi
    npm install
    cdk bootstrap --region $REGION
    cdk synth
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