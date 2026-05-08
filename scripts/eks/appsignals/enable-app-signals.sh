#!/usr/bin/env bash

cd "$(dirname "$0")"

CLUSTER_NAME=$1
REGION=$2
NAMESPACE=${3:-default}

# Optional parameters via environment variables (backwards compatible)
# ADDON_INSTALL_MODE: "addon" (default) or "helm"
# ADDON_VERSION: specific add-on version to install (only used when mode is "addon")
# HELM_CHART_REF: git ref of aws-observability/helm-charts (required when mode is "helm")
# OPERATOR_IMAGE: full operator image URI to override (optional, used with "helm" mode)
ADDON_INSTALL_MODE=${ADDON_INSTALL_MODE:-addon}

echo "Enabling Application Signals for EKS Cluster ${CLUSTER_NAME} in ${REGION} for namespace ${NAMESPACE}"
echo "Install mode: ${ADDON_INSTALL_MODE}"

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


# Install the observability stack based on the selected mode
if [[ "${ADDON_INSTALL_MODE}" == "helm" ]]; then
    #############################
    # Helm chart install mode
    #############################
    if [ -z "${HELM_CHART_REF}" ]; then
        echo "ERROR: HELM_CHART_REF is required when ADDON_INSTALL_MODE=helm"
        exit 1
    fi

    echo "Installing from helm chart at ref: ${HELM_CHART_REF}"

    # Ensure helm is available
    if ! command -v helm &> /dev/null; then
        echo "ERROR: helm is not installed. Please install helm before using helm mode."
        exit 1
    fi

    # Clone the helm-charts repo at the specified ref
    HELM_CHARTS_DIR=$(mktemp -d)
    echo "Cloning aws-observability/helm-charts at ref ${HELM_CHART_REF} into ${HELM_CHARTS_DIR}"
    git clone --depth 1 --branch "${HELM_CHART_REF}" https://github.com/aws-observability/helm-charts.git "${HELM_CHARTS_DIR}" 2>/dev/null
    if [ $? -ne 0 ]; then
        # If --branch fails (e.g., for a commit SHA), clone and checkout
        rm -rf "${HELM_CHARTS_DIR}"
        HELM_CHARTS_DIR=$(mktemp -d)
        git clone https://github.com/aws-observability/helm-charts.git "${HELM_CHARTS_DIR}"
        cd "${HELM_CHARTS_DIR}" && git checkout "${HELM_CHART_REF}"
        check_if_step_failed_and_exit "Failed to checkout helm-charts at ref ${HELM_CHART_REF}"
        cd "$(dirname "$0")"
    fi

    CHART_PATH="${HELM_CHARTS_DIR}/charts/amazon-cloudwatch-observability"
    if [ ! -d "${CHART_PATH}" ]; then
        echo "ERROR: Chart not found at ${CHART_PATH}"
        exit 1
    fi

    # Build helm install command with optional overrides
    HELM_SET_ARGS="--set region=${REGION} --set clusterName=${CLUSTER_NAME}"

    if [ -n "${OPERATOR_IMAGE}" ]; then
        # Parse the operator image into repository domain, repo name, and tag
        # Expected format: <domain>/<repo>:<tag>
        # e.g., 123456789.dkr.ecr.us-east-1.amazonaws.com/staging-operator:integration
        IMAGE_TAG="${OPERATOR_IMAGE##*:}"
        IMAGE_REPO_FULL="${OPERATOR_IMAGE%:*}"
        # Split into domain and repository name
        IMAGE_DOMAIN="${IMAGE_REPO_FULL%%/*}"
        IMAGE_REPO="${IMAGE_REPO_FULL#*/}"

        HELM_SET_ARGS="${HELM_SET_ARGS} --set manager.image.repositoryDomainMap.public=${IMAGE_DOMAIN}"
        HELM_SET_ARGS="${HELM_SET_ARGS} --set manager.image.repository=${IMAGE_REPO}"
        HELM_SET_ARGS="${HELM_SET_ARGS} --set manager.image.tag=${IMAGE_TAG}"
        echo "Overriding operator image: ${OPERATOR_IMAGE}"
    fi

    echo "Running: helm install amazon-cloudwatch-observability ${CHART_PATH} --namespace amazon-cloudwatch --create-namespace ${HELM_SET_ARGS}"
    eval helm install amazon-cloudwatch-observability "${CHART_PATH}" \
        --namespace amazon-cloudwatch --create-namespace \
        --wait --timeout 5m \
        ${HELM_SET_ARGS}
    check_if_step_failed_and_exit "Helm install failed!"

    echo "Helm chart installed successfully"

    # Clean up cloned repo
    rm -rf "${HELM_CHARTS_DIR}"

else
    #############################
    # EKS add-on install mode (default)
    #############################
    echo "Checking amazon-cloudwatch-observability add-on"
    result=$(aws eks describe-addon --addon-name amazon-cloudwatch-observability --cluster-name ${CLUSTER_NAME} --region ${REGION} 2>&1)
    echo "${result}"

    if [[ "${result}" == *"No addon: "* ]]; then
        echo "Installing amazon-cloudwatch-observability add-on"

        ADDON_VERSION_ARG=""
        if [ -n "${ADDON_VERSION}" ]; then
            ADDON_VERSION_ARG="--addon-version ${ADDON_VERSION}"
            echo "Using specific add-on version: ${ADDON_VERSION}"
        fi

        aws eks create-addon \
            --cluster-name ${CLUSTER_NAME} \
            --addon-name amazon-cloudwatch-observability \
            --region ${REGION} \
            ${ADDON_VERSION_ARG}

        # Wait until the amazon-cloudwatch-observability add-on is active
        status=$(aws eks describe-addon --cluster-name ${CLUSTER_NAME} --addon-name amazon-cloudwatch-observability --region ${REGION} | grep '"status":' | awk -F '"' '{print $4}')

        # Loop until status becomes "ACTIVE"
        while [[ "$status" != "ACTIVE" ]]; do
          echo "Current status: $status"
          if [[ "$status" == "CREATE_FAILED" ]]; then
            echo "Create amazon-cloudwatch-observability add-on failed!"
            exit 1
          fi
          echo "Waiting for addon to become ACTIVE..."
          sleep 20
          status=$(aws eks describe-addon --cluster-name ${CLUSTER_NAME} --addon-name amazon-cloudwatch-observability --region ${REGION} | grep '"status":' | awk -F '"' '{print $4}')
        done

        echo "EKS amazon-cloudwatch-observability add-on is now ACTIVE"
    else
      addon_version=$(echo "${result}" | grep "addonVersion" | awk -F '"' '{print $4}')
      if [[ "$addon_version" < "v1.4.0" ]]; then
         read -p "Do you want to update the add-on version to v1.4.0, current version $addon_version? (yes/no): " choice

          if [ "$choice" == "yes" ]; then
            aws eks update-addon \
               --cluster-name ${CLUSTER_NAME} \
               --addon-name amazon-cloudwatch-observability \
               --addon-version v1.4.0-eksbuild.1 \
               --region ${REGION}
            # Wait until the amazon-cloudwatch-observability add-on is active
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
              sleep 20
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
fi

if [ -z "${REGION}" ]
then
    echo "Region set to us-west-2"
    REGION="us-west-2"
fi

check_if_step_failed_and_exit "There was an error enabling application signals, exiting"
