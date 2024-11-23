#!/bin/bash

# Script to synthesize, deploy, or destroy AWS CDK stacks with stack dependencies
# Usage: ./cdk-deploy.sh <action>
# Example for deploy: ./cdk-deploy.sh deploy
# Example for destroy: ./cdk-deploy.sh destroy
# Example to only synth: ./cdk-deploy.sh synth

ACTION=$1

# Check for action parameter
if [[ -z "$ACTION" ]]; then
  echo "Usage: $0 <action>"
  echo "action can be 'synth', 'deploy', or 'destroy'"
  exit 1
fi


# Run CDK synth once for all stacks
if [[ "$ACTION" == "synth" || "$ACTION" == "deploy" ]]; then
  echo "Running CDK bootstrap"
  cdk bootstrap

  rm -rf cdk.out
  echo "Running CDK synth for all stacks..."
  if cdk synth; then
    echo "CDK synth successful!"
    if [[ "$ACTION" == "synth" ]]; then
      exit 0
    fi
  else
    echo "CDK synth failed. Exiting."
    exit 1
  fi
fi

# Deploy or destroy all stacks in the app
if [[ "$ACTION" == "deploy" ]]; then
  echo "Starting CDK deployment for all stacks in the app"
  if cdk deploy --all --require-approval never; then
    echo "Deployment successful for all stacks in the app"
  else
    echo "Deployment failed. Attempting to clean up resources by destroying all stacks..."
    cdk destroy --all --force --verbose
  fi
elif [[ "$ACTION" == "destroy" ]]; then
  echo "Starting CDK destroy for all stacks in the app"
  cdk destroy --all --force --verbose
  echo "Destroy complete for all stacks in the app"
else
  echo "Invalid action: $ACTION. Please use 'synth', 'deploy', or 'destroy'."
  exit 1
fi
