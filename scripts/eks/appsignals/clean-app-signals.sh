#!/bin/bash
# set -x

# change the directory to the script location so that the relative path can work
cd "$(dirname "$0")"

# Set variables with provided arguments
CLUSTER_NAME=$1
REGION=$2
NAMESPACE=${3:-default}

# Check if the current context points to the new cluster in the correct region
kub_config=$(kubectl config current-context)
if [[ $kub_config != *"$CLUSTER_NAME"* ]] || [[ $kub_config != *"$REGION"* ]]; then
    echo "Your current cluster context is not set to $CLUSTER_NAME $REGION. Please switch to the correct context first before running this script"
    exit 1
fi

echo "Deleting amazon-cloudwatch-observability addon"
aws eks delete-addon --cluster-name $CLUSTER_NAME --addon-name amazon-cloudwatch-observability --region $REGION 

echo "Deleting ServiceAccount"
eksctl delete iamserviceaccount --cluster $CLUSTER_NAME --region $REGION --name cloudwatch-agent --namespace amazon-cloudwatch

aws logs delete-log-group --log-group-name '/aws/application-signals/data' --region $REGION
