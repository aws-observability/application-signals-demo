#!/bin/bash
# set -x

# change the directory to the script location so that the relative path can work
cd "$(dirname "$0")"

# Set variables with provided arguments or default values
CLUSTER_NAME=$1
REGION=$2
NAMESPACE=${3:-default}
OPERATION=${4:-"apply"}

# Check if the current context points to the new cluster in the correct region
kub_config=$(kubectl config current-context)
if [[ $kub_config != *"$CLUSTER_NAME"* ]] || [[ $kub_config != *"$REGION"* ]]; then
    echo "Your current cluster context is not set to $CLUSTER_NAME $REGION. Please switch to the correct context first before running this script"
    exit 1
fi

err=0
trap 'err=1' ERR

ACCOUNT=$(aws sts get-caller-identity | jq -r '.Account')

if [[ $OPERATION == "apply" ]]; then
    # Save the endpoint URL to a variable
    endpoint=$(kubectl get svc -n ingress-nginx | grep "ingress-nginx" | awk '{print $4}')

    # Start the traffic generator
    sed -e "s/111122223333.dkr.ecr.us-west-2/$ACCOUNT.dkr.ecr.$REGION/g" -e "s/SAMPLE_APP_END_POINT/${endpoint}/g"  ./sample-app/traffic-generator/traffic-generator.yaml | kubectl apply --namespace=$NAMESPACE -f -

    # Print the endpoint
    echo "Started the traffic generator to send traffic to http://${endpoint}"

else
    kubectl delete -f ./sample-app/traffic-generator/traffic-generator.yaml
fi
exit $err
