#!/bin/bash
# set -x

# change the directory to the script location so that the relative path can work
cd "$(dirname "$0")"

# Set variables with provided arguments
CLUSTER_NAME=$1
REGION=$2
NAMESPACE=${3:-default}

# Get the kubectl config in JSON format
kubectl_config=$(kubectl config view --output=json)

# Extract the context with the specified cluster name and region
desired_context=$(echo "$kubectl_config" | jq -r --arg CLUSTER_NAME "$CLUSTER_NAME" --arg REGION "$REGION" '.contexts[] | select(.name | contains($CLUSTER_NAME) and contains($REGION))')

# Check if the desired context exists
if [ -n "$desired_context" ]; then
    context_name=$(echo "$desired_context" | jq -r '.name')
    echo "Setting current context to: $context_name"
    kubectl config use-context "$context_name"
else
    echo "Desired context not found. Exit the script"
    exit 1
fi

check_if_step_failed_and_exit() {
  if [ $? -ne 0 ]; then
    echo $1
    exit 1
  fi
}

check_if_step_failed() {
  if [ $? -ne 0 ]; then
    echo $1
  fi
}

echo "Deleting SLO"
../cleanup-slo.sh $REGION
check_if_step_failed_and_exit "There was an error deleting the SLOs. Please make sure they are deleted properly before proceeding with the following steps"

echo "Deleting canaries"
../create-canaries.sh $REGION delete
check_if_step_failed_and_exit "There was an error deleting the canaries. Please make sure they are deleted properly before proceeding with the following steps"

../deploy-sample-app.sh $CLUSTER_NAME $REGION $NAMESPACE delete
check_if_step_failed_and_exit "There was an error deleting the sample apps. Please make sure they are deleted properly before proceeding with the following steps"

../cleanup-rds.sh $CLUSTER_NAME $REGION
check_if_step_failed_and_exit "There was an error deleting the RDS cluster. Please make sure they are deleted properly before proceeding with the following steps"

../deploy-traffic-generator.sh $CLUSTER_NAME $REGION $NAMESPACE delete
check_if_step_failed_and_exit "There was an error deleting the traffic generator. Please make sure they are deleted properly before proceeding with the following steps"

eksctl delete cluster --name $CLUSTER_NAME --region $REGION
check_if_step_failed "There was an error deleting the cluster $CLUSTER_NAME."

aws logs delete-log-group --log-group-name '/aws/application-signals/data' --region $REGION
check_if_step_failed "There was an error deleting the log group /aws/application-signals/data."

# remove the sqs queue 
aws sqs delete-queue --region $REGION --queue-url $(aws sqs get-queue-url --region $REGION --queue-name apm_test --query 'QueueUrl' --output text)
check_if_step_failed "There was an error deleting the sqs."

# delete the kinesis stream
aws kinesis delete-stream --stream-name apm_test --region $REGION
check_if_step_failed "There was an error deleting the kinesis stream."

# remove DDB table
aws dynamodb delete-table --table-name apm_test --region $REGION
check_if_step_failed "There was an error deleting the dynamodb table apm_test."

aws dynamodb delete-table --table-name BillingInfo --region $REGION
check_if_step_failed "There was an error deleting the dynamodb table BillingInfo."

aws dynamodb delete-table --table-name PetClinicPayment --region $REGION
check_if_step_failed "There was an error deleting the dynamodb table PetClinicPayment."
