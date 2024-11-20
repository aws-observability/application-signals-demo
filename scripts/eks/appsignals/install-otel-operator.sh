#!/usr/bin/env bash

cd "$(dirname "$0")"

CLUSTER_NAME=$1
REGION=$2
NAMESPACE=${3:-default}
echo "Setting up EKS Cluster ${CLUSTER_NAME} in ${REGION} for namespace ${NAMESPACE} for Application Signals with OTel Collector"

# Check if the current context points to the new cluster in the correct region
kub_config=$(kubectl config current-context)
if [[ $kub_config != *"$CLUSTER_NAME"* ]] || [[ $kub_config != *"$REGION"* ]]; then
    echo "Your current cluster context is not set to $CLUSTER_NAME $REGION. Please switch to the correct context first before running this script"
    exit 1
fi

check_if_step_failed_and_exit() {
  if [ $? -ne 0 ]; then
    echo $1
    exit 1
  fi
}

check_if_loop_failed_and_exit() {
  if [ $1 -ne 0 ]; then
    echo $2
    exit 1
  fi
}

# Check if the namespace exists
kubectl get namespace $NAMESPACE > /dev/null 2>&1

# $? is a special variable that stores the exit status of the last command
if [ $? -ne 0 ]; then
  # If namespace does not exist, create it
  echo "Namespace '$NAMESPACE' does not exist. Creating it..."
  kubectl create namespace $NAMESPACE
else
  # If namespace exists, print a message
  echo "Namespace '$NAMESPACE' already exists."
fi

# Create service linked role in the account
aws iam create-service-linked-role --aws-service-name application-signals.cloudwatch.amazonaws.com

# Enable OIDC to allow IAM role authN/Z with service account
eksctl utils associate-iam-oidc-provider --cluster ${CLUSTER_NAME} --region ${REGION} --approve
check_if_step_failed_and_exit "There was an error enabling the OIDC, exiting"

# Create Service Account with the proper IAM permissions
echo "Creating ServiceAccount"
eksctl create iamserviceaccount \
      --name appsignals-collector \
      --namespace ${NAMESPACE} \
      --cluster ${CLUSTER_NAME} \
      --region ${REGION} \
      --attach-policy-arn arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess \
      --attach-policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy \
      --attach-policy-arn arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy \
      --approve \
      --override-existing-serviceaccounts
check_if_step_failed_and_exit "There was an error creating the ServiceAccount, exiting"


# Install OpenTelemetry Operator
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml
kubectl apply -f https://github.com/open-telemetry/opentelemetry-operator/releases/latest/download/opentelemetry-operator.yaml
