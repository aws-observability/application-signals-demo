#!/bin/bash

# Script to synthesize, deploy, or destroy AWS CDK stacks for lambda-audit-service
# Usage: ./cdk.sh <action>
# Example for deploy: ./cdk.sh deploy
# Example for destroy: ./cdk.sh destroy
# Example to only synth: ./cdk.sh synth

ACTION=$1

# Check for action parameter
if [[ -z "$ACTION" ]]; then
  echo "Usage: $0 <action>"
  echo "action can be 'synth', 'deploy', or 'destroy'"
  exit 1
fi

# Package Lambda function
if [[ "$ACTION" == "synth" || "$ACTION" == "deploy" ]]; then
  echo "Packaging Lambda function..."
  pushd ../sample-app > /dev/null || exit
  rm -rf build*
  ./package-lambda-function.sh
  popd > /dev/null || exit
fi

# Run CDK synth or deploy
if [[ "$ACTION" == "synth" || "$ACTION" == "deploy" ]]; then
  # Install dependencies if needed
  if [ ! -d "node_modules" ]; then
    echo "Installing CDK dependencies..."
    npm install
  fi

  echo "Running CDK bootstrap"
  npx cdk bootstrap

  rm -rf cdk.out
  echo "Running CDK synth..."
  if npx cdk synth; then
    echo "CDK synth successful!"
    if [[ "$ACTION" == "synth" ]]; then
      exit 0
    fi
  else
    echo "CDK synth failed. Exiting."
    exit 1
  fi
fi

# Deploy or destroy the stack
if [[ "$ACTION" == "deploy" ]]; then
  echo "Starting CDK deployment for lambda-audit-service"
  if npx cdk deploy --require-approval never; then
    echo "Deployment successful for lambda-audit-service"
  else
    echo "Deployment failed. Attempting to clean up resources..."
    npx cdk destroy --force --verbose
    exit 1
  fi
elif [[ "$ACTION" == "destroy" ]]; then
  echo "Starting CDK destroy for lambda-audit-service"
  npx cdk destroy --force --verbose
  echo "Destroy complete for lambda-audit-service"
else
  echo "Invalid action: $ACTION. Please use 'synth', 'deploy', or 'destroy'."
  exit 1
fi