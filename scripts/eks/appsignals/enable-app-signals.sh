#!/usr/bin/env bash

cd "$(dirname "$0")"

CLUSTER_NAME=$1
REGION=$2
NAMESPACE=${3:-default}
echo "Enabling Application Signals for EKS Cluster ${CLUSTER_NAME} in ${REGION} for namespace ${NAMESPACE}"

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

# Create service linked role in the account
aws iam create-service-linked-role --aws-service-name application-signals.cloudwatch.amazonaws.com

# Enable OIDC to allow IAM role authN/Z with service account
eksctl utils associate-iam-oidc-provider --cluster ${CLUSTER_NAME} --region ${REGION} --approve
check_if_step_failed_and_exit "There was an error enabling the OIDC, exiting"

# Create Service Account with the proper IAM permissions
echo "Creating ServiceAccount"
eksctl create iamserviceaccount \
      --name cloudwatch-agent \
      --namespace amazon-cloudwatch \
      --cluster ${CLUSTER_NAME} \
      --region ${REGION} \
      --attach-policy-arn arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess \
      --attach-policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy \
      --approve \
      --override-existing-serviceaccounts
check_if_step_failed_and_exit "There was an error creating the ServiceAccount, exiting"


# Install amazon-cloudwatch-observability addon
echo "Checking amazon-cloudwatch-observability add-on"    
result=$(aws eks describe-addon --addon-name amazon-cloudwatch-observability --cluster-name ${CLUSTER_NAME} --region ${REGION} 2>&1)
echo "${result}"

if [[ "${result}" == *"No addon: "* ]];  then
    echo "Installing amazon-cloudwatch-observability add-on"
    aws eks create-addon \
        --cluster-name ${CLUSTER_NAME} \
        --addon-name amazon-cloudwatch-observability \
        --region ${REGION}
    # wait until the amazon-cloudwatch-observability add-on is active    
    # Fetch the initial status
    status=$(aws eks describe-addon --cluster-name ${CLUSTER_NAME} --addon-name amazon-cloudwatch-observability --region ${REGION} | grep '"status":' | awk -F '"' '{print $4}')

    # Loop until status becomes "ACTIVE"
    while [[ "$status" != "ACTIVE" ]]; do
      echo "Current status: $status"
      if [[ "$status" == "CREATE_FAILED" ]]; then
        echo "Create amazon-cloudwatch-observability add-on failed!"
        exit 1
      fi 
      echo "Waiting for addon to become ACTIVE..."
      sleep 20  # wait for 20 seconds before checking again
      status=$(aws eks describe-addon --cluster-name ${CLUSTER_NAME} --addon-name amazon-cloudwatch-observability --region ${REGION} | grep '"status":' | awk -F '"' '{print $4}')
    done

    echo "EKS amazon-cloudwatch-observability add-on is now ACTIVE"
else
  addon_version=$(echo "${result}" | grep "addonVersion" | awk -F '"' '{print $4}')
  if [[ "$addon_version" < "v1.2.0" ]]; then
     read -p "Do you want to update the add-on version to v1.2.0, current version $addon_version? (yes/no): " choice

      if [ "$choice" == "yes" ]; then
        aws eks update-addon \
           --cluster-name ${CLUSTER_NAME} \
           --addon-name amazon-cloudwatch-observability \
           --addon-version v1.2.0-eksbuild.1 \
           --region ${REGION}
        # wait until the amazon-cloudwatch-observability add-on is active
        echo "Waiting for addon to become ACTIVE..."
        sleep 5
        status=$(aws eks describe-addon --cluster-name ${CLUSTER_NAME} --addon-name amazon-cloudwatch-observability --region ${REGION} | grep '"status":' | awk -F '"' '{print $4}')
        
        # Loop until status becomes "ACTIVE"
        while [[ "$status" != "ACTIVE" ]]; do
          echo "Current status: $status"
          if [[ "$status" == "UPDATE_FAILED" ]]; then
            echo "Update amazon-cloudwatch-observability add-on failed!"
            exit 1
          fi
          echo "Waiting for addon to become ACTIVE..."
          sleep 20  # wait for 20 seconds before checking again
          status=$(aws eks describe-addon --cluster-name ${CLUSTER_NAME} --addon-name amazon-cloudwatch-observability --region ${REGION} | grep '"status":' | awk -F '"' '{print $4}')
        done

        echo "EKS amazon-cloudwatch-observability add-on is now ACTIVE"
      else
       echo "Aborted upgrading EKS amazon-cloudwatch-observability add-on."
      fi
  else
    echo "EKS amazon-cloudwatch-observability add-on has been installed"
  fi
fi

if [ -z "${REGION}" ]
then
    echo "Region set to us-west-2"
    REGION="us-west-2"
fi

check_if_step_failed_and_exit "There was an error enabling application signals, exiting"
