#!/bin/bash
# set -x
#
# Installs the amazon-cloudwatch-observability stack from the helm chart source.
# Used for testing unreleased add-on versions before they are published to the EKS marketplace.
#
# Required environment variables:
#   HELM_CHART_REF  - git ref (branch, tag, or commit SHA) of aws-observability/helm-charts
#   REGION          - AWS region
#   CLUSTER_NAME    - EKS cluster name
#
# Optional environment variables:
#   OPERATOR_IMAGE  - full operator image URI to override
#                     e.g. "123456789.dkr.ecr.us-east-1.amazonaws.com/staging-operator:integration"

if [ -z "${HELM_CHART_REF}" ]; then
    echo "ERROR: HELM_CHART_REF is required"
    exit 1
fi

if [ -z "${REGION}" ] || [ -z "${CLUSTER_NAME}" ]; then
    echo "ERROR: REGION and CLUSTER_NAME must be set"
    exit 1
fi

echo "Installing from helm chart at ref: ${HELM_CHART_REF}"

# Install helm if not available
if ! command -v helm &> /dev/null; then
    echo "helm not found, installing..."
    curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
    if [ $? -ne 0 ]; then
        echo "Failed to install helm"
        exit 1
    fi
fi

# Clone the helm-charts repo at the specified ref
HELM_CHARTS_DIR=$(mktemp -d)
echo "Cloning aws-observability/helm-charts at ref ${HELM_CHART_REF}"
git clone --depth 1 --branch "${HELM_CHART_REF}" https://github.com/aws-observability/helm-charts.git "${HELM_CHARTS_DIR}" 2>/dev/null
if [ $? -ne 0 ]; then
    # --branch may fail for a commit SHA; fall back to full clone + checkout
    rm -rf "${HELM_CHARTS_DIR}"
    HELM_CHARTS_DIR=$(mktemp -d)
    git clone https://github.com/aws-observability/helm-charts.git "${HELM_CHARTS_DIR}"
    if [ $? -ne 0 ]; then
        echo "Failed to clone helm-charts repo"
        rm -rf "${HELM_CHARTS_DIR}"
        exit 1
    fi
    cd "${HELM_CHARTS_DIR}" && git checkout "${HELM_CHART_REF}"
    if [ $? -ne 0 ]; then
        echo "Failed to checkout helm-charts at ref ${HELM_CHART_REF}"
        rm -rf "${HELM_CHARTS_DIR}"
        exit 1
    fi
    cd -
fi

CHART_PATH="${HELM_CHARTS_DIR}/charts/amazon-cloudwatch-observability"
if [ ! -d "${CHART_PATH}" ]; then
    echo "ERROR: Chart not found at ${CHART_PATH}"
    rm -rf "${HELM_CHARTS_DIR}"
    exit 1
fi

HELM_SET_ARGS=(
    --set "region=${REGION}"
    --set "clusterName=${CLUSTER_NAME}"
)

if [ -n "${OPERATOR_IMAGE}" ]; then
    IMAGE_TAG="${OPERATOR_IMAGE##*:}"
    IMAGE_REPO_FULL="${OPERATOR_IMAGE%:*}"
    IMAGE_DOMAIN="${IMAGE_REPO_FULL%%/*}"
    IMAGE_REPO="${IMAGE_REPO_FULL#*/}"
    HELM_SET_ARGS+=(
        --set "manager.image.repositoryDomainMap.public=${IMAGE_DOMAIN}"
        --set "manager.image.repository=${IMAGE_REPO}"
        --set "manager.image.tag=${IMAGE_TAG}"
    )
    echo "Overriding operator image: ${OPERATOR_IMAGE}"
fi

echo "Running helm install..."
helm install amazon-cloudwatch-observability "${CHART_PATH}" \
    --namespace amazon-cloudwatch --create-namespace \
    --wait --timeout 5m \
    "${HELM_SET_ARGS[@]}"

if [ $? -ne 0 ]; then
    echo "Helm install failed!"
    rm -rf "${HELM_CHARTS_DIR}"
    exit 1
fi

echo "Helm chart installed successfully"
rm -rf "${HELM_CHARTS_DIR}"
