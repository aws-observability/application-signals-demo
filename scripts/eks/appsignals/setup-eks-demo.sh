#!/bin/bash
set -ex

# Default values
DEFAULT_REGION="us-east-1"
OPERATION="create"

# Read command line arguments
for i in "$@"; do
  case $i in
  --operation=*)
    OPERATION="${i#*=}"
    shift # past argument=value
    ;;
  --region=*)
    REGION="${i#*=}"
    shift # past argument=value
    ;;
  *)
    # unknown option
    ;;
  esac
done

# Set region with provided value or default
REGION="${REGION:-$DEFAULT_REGION}"

export AWS_DEFAULT_REGION=$REGION

function run_cdk() {
  echo "Running CDK..."
  # jump to the cdk folder, run the cdk commands, and then jump back to current folder
  pushd ../../../cdk/ecs >/dev/null
  ./eks-cdk.sh $1
  popd >/dev/null
}

function delete_resources() {
  echo "Deleting resources..."

  run_cdk destroy

  # delete resources created by the sample app itself
  aws sqs delete-queue --queue-url $(aws sqs get-queue-url --queue-name apm_test --query 'QueueUrl' --output text)
  aws kinesis delete-stream --stream-name apm_test
  aws dynamodb delete-table --table-name apm_test
  aws dynamodb delete-table --table-name BillingInfo

  echo "Resource deletion complete."
}

# Execute based on operation
if [ "$OPERATION" == "delete" ]; then
  delete_resources
else
  run_cdk deploy
fi