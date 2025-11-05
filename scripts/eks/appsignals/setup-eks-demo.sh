#!/bin/bash
set -ex

# Default values
DEFAULT_REGION="us-east-1"
OPERATION="create"
USE_OTLP="false"  # Default value for OTLP
DESTROY_ON_FAIL="true"  # Default value for destroying stacks on failure

# Read command line arguments
for i in "$@"; do
  case $i in
  --operation=*)
    OPERATION="${i#*=}"
    shift
    ;;
  --region=*)
    REGION="${i#*=}"
    shift
    ;;
  --use-otlp=*)
    USE_OTLP="${i#*=}"
    shift
    ;;
  --destroy-on-fail=*)
    DESTROY_ON_FAIL="${i#*=}"
    shift
    ;;
  --help)
    echo "Usage: $0 [--operation=create|delete] [--region=REGION_NAME] [--use-otlp=true|false] [--destroy-on-fail=true|false]"
    echo ""
    echo "Parameters:"
    echo "  --operation        - Operation to perform (create or delete). Default: create"
    echo "  --region           - AWS region to use. Default: us-east-1"
    echo "  --use-otlp         - Whether to use OTLP collector. Default: false"
    echo "  --destroy-on-fail  - Whether to destroy all stacks on failure. Default: true"
    exit 0
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
  pushd ../../../cdk/eks >/dev/null
  ./eks-cdk.sh $1 $USE_OTLP $DESTROY_ON_FAIL
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
  ./setup-grouping-config.sh $REGION delete
else
  run_cdk deploy
  ./setup-grouping-config.sh $REGION create
fi