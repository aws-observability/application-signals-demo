#!/usr/bin/env bash

cd "$(dirname "$0")"

CLUSTER_NAME=$1
REGION=$2
NAMESPACE=${3:-default}
echo "Adding EBS CSI Controller for EKS Cluster ${CLUSTER_NAME} in ${REGION} for namespace ${NAMESPACE}"

ACCOUNT_ID=$(aws sts get-caller-identity | jq -r '.Account')
if [ -z "$ACCOUNT_ID" ]; then
  echo "Fail to get account id. Account id is empty. Exit the script"
  exit 8
fi

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

eksctl create iamserviceaccount \
    --name ebs-csi-controller-sa \
    --namespace kube-system \
    --cluster ${CLUSTER_NAME} \
    --region ${REGION} \
    --role-name AmazonEKS_EBS_CSI_DriverRole \
    --role-only \
    --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \
    --approve
check_if_step_failed_and_exit "There was an error creating the ServiceAccount, exiting"

# Install aws-ebs-csi-driver addon
echo "Checking aws-ebs-csi-driver add-on"    
result=$(aws eks describe-addon --addon-name aws-ebs-csi-driver --cluster-name ${CLUSTER_NAME} --region ${REGION} 2>&1)
echo "${result}"

if [[ "${result}" == *"No addon: "* ]];  then
    echo "Installing aws-ebs-csi-driver add-on"
    aws eks create-addon \
        --cluster-name ${CLUSTER_NAME} \
        --addon-name aws-ebs-csi-driver \
        --region ${REGION} \
        --service-account-role-arn arn:aws:iam::$ACCOUNT_ID:role/AmazonEKS_EBS_CSI_DriverRole
    # wait until the aws-ebs-csi-driver add-on is active    
    # Fetch the initial status
    status=$(aws eks describe-addon --cluster-name ${CLUSTER_NAME} --addon-name aws-ebs-csi-driver --region ${REGION} | grep '"status":' | awk -F '"' '{print $4}')

    # Loop until status becomes "ACTIVE"
    while [[ "$status" != "ACTIVE" ]]; do
      echo "Current status: $status"
      if [[ "$status" == "CREATE_FAILED" ]]; then
        echo "Create aws-ebs-csi-driver add-on failed!"
        exit 1
      fi 
      echo "Waiting for addon to become ACTIVE..."
      sleep 20  # wait for 20 seconds before checking again
      status=$(aws eks describe-addon --cluster-name ${CLUSTER_NAME} --addon-name aws-ebs-csi-driver --region ${REGION} | grep '"status":' | awk -F '"' '{print $4}')
    done

    echo "EKS aws-ebs-csi-driver add-on is now ACTIVE"
fi

check_if_step_failed_and_exit "There was an error enabling aws-ebs-csi-driver, exiting"