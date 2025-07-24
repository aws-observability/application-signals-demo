#!/bin/bash
set -ex

# Script to deploy or destroy AWS CDK Lambda stack and CloudWatch alarms for APM Demo Test Runner
# Usage: ./deploy_lambda_cdk.sh [--operation=deploy|destroy] [--region=us-east-1] [--function-name=APM_Demo_Test_Runner] [--create-alarms=true|false]
# 
# Parameters:
#   --operation     - Optional: 'deploy' or 'destroy' (default: deploy)
#   --region        - Optional: AWS region (default: us-east-1)
#   --function-name - Optional: Lambda function name (default: APM_Demo_Test_Runner)
#   --create-alarms - Optional: Create CloudWatch alarms (default: false)
#
# Examples:
#   ./deploy_lambda_cdk.sh                               - Deploy Lambda function with default settings
#   ./deploy_lambda_cdk.sh --region=us-west-2            - Deploy to us-west-2 region
#   ./deploy_lambda_cdk.sh --operation=destroy           - Destroy the stack
#   ./deploy_lambda_cdk.sh --function-name=CustomName    - Deploy with custom function name
#   ./deploy_lambda_cdk.sh --create-alarms=true          - Deploy Lambda function and CloudWatch alarms

# Set default variables
OPERATION="deploy"
LAMBDA_FUNCTION_NAME="APM_Demo_Test_Runner"
LAMBDA_DIR="lambda"
TEST_CASES_DIR="test_cases"
DEPLOY_DIR="deploy/lambda_deployment"
CDK_DIR="deploy/cdk_lambda"
AWS_REGION="us-east-1"
CREATE_ALARMS="false"

# Parse command line arguments
for i in "$@"; do
  case $i in
    --operation=*)
      OPERATION="${i#*=}"
      ;;
    --region=*)
      AWS_REGION="${i#*=}"
      ;;
    --function-name=*)
      LAMBDA_FUNCTION_NAME="${i#*=}"
      ;;
    --create-alarms=*)
      CREATE_ALARMS="${i#*=}"
      ;;
    *)
      # unknown option
      ;;
  esac
done

# Legacy argument parsing for backward compatibility
if [[ "$1" != --* && ! -z "$1" ]]; then
  AWS_REGION=$1
fi

# Check if we are in the right directory
if [[ ! -d "$LAMBDA_DIR" || ! -d "$TEST_CASES_DIR" ]]; then
  echo "Error: Must run from the root directory of data_test where lambda and test_cases directories exist"
  exit 1
fi

# Check if npm and cdk are installed
if ! command -v npm &> /dev/null; then
  echo "npm is not installed. Please install Node.js and npm first."
  exit 1
fi

# Set environment variables for CDK
export LAMBDA_FUNCTION_NAME=$LAMBDA_FUNCTION_NAME
export CDK_DEPLOY_REGION=$AWS_REGION
export CREATE_ALARMS=$CREATE_ALARMS

# Get AWS account ID for bootstrap command
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)

# Navigate to CDK directory and install dependencies
echo "Setting up CDK project..."
cd $CDK_DIR

# Install dependencies if node_modules doesn't exist
if [[ ! -d "node_modules" ]]; then
  npm install
  # Make sure CDK is installed globally
  if ! command -v cdk &> /dev/null; then
    npm install -g aws-cdk
  fi
fi

if [[ "$OPERATION" == "deploy" ]]; then
  # Create temporary deployment directory for Lambda code
  echo "Creating temporary deployment directory..."
  cd ../..  # Go back to data_test directory
  rm -rf $DEPLOY_DIR
  mkdir -p $DEPLOY_DIR

  # Copy Lambda function files and test cases
  echo "Copying Lambda function files..."
  cp $LAMBDA_DIR/*.py $DEPLOY_DIR/
  cp $TEST_CASES_DIR/*.json $DEPLOY_DIR/

  # Navigate back to CDK directory
  cd $CDK_DIR
  
  # Deploy with CDK without asking for confirmation
  echo "Deploying with CDK..."
  cdk bootstrap aws://$ACCOUNT_ID/$AWS_REGION
  cdk deploy --all --require-approval never
  
  # Clean up temporary files without asking
  echo "Cleaning up temporary files..."
  cd ../..  # Go back to data_test directory
  rm -rf $DEPLOY_DIR
  
  # Return to CDK directory for consistent end state
  cd $CDK_DIR
  
elif [[ "$OPERATION" == "destroy" ]]; then
  echo "Starting CDK destroy for Lambda stack"
  
  # Destroy all stacks without asking for confirmation
  cdk destroy --all --force
  echo "Lambda stack has been destroyed successfully"
else
  echo "Error: Invalid operation. Use --operation=deploy or --operation=destroy"
  exit 1
fi

echo "Operation completed!"