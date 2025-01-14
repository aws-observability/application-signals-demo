#!/bin/bash
# set -x

# change the directory to the script location so that the relative path can work
cd "$(dirname "$0")"

# Set variables with provided arguments or default values
CLUSTER_NAME=$1
REGION=$2
NAMESPACE=${3:-default}
OPERATION=${4:-"apply"}

db_cluster_identifier="petclinic-python"

# Check if the current context points to the new cluster in the correct region
kub_config=$(kubectl config current-context)
if [[ $kub_config != *"$CLUSTER_NAME"* ]] || [[ $kub_config != *"$REGION"* ]]; then
    echo "Your current cluster context is not set to $CLUSTER_NAME $REGION. Please switch to the correct context first before running this script"
    exit 1
fi

err=0
trap 'err=1' ERR
if [[ $OPERATION == "apply" ]]; then
    echo "Creating ServiceAccount"
    eksctl create iamserviceaccount \
        --name visits-service-account \
        --namespace ${NAMESPACE} \
        --cluster ${CLUSTER_NAME} \
        --region ${REGION} \
        --attach-policy-arn arn:aws:iam::aws:policy/AmazonSQSFullAccess \
        --attach-policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess \
        --attach-policy-arn arn:aws:iam::aws:policy/AmazonKinesisFullAccess \
        --attach-policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess \
        --attach-policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess \
        --attach-policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite \
        --approve \
        --override-existing-serviceaccounts

else
    echo "Deleting ServiceAccount"
    eksctl delete iamserviceaccount \
        --name visits-service-account \
        --namespace ${NAMESPACE} \
        --cluster ${CLUSTER_NAME} \
        --region ${REGION}
fi

ACCOUNT=$(aws sts get-caller-identity | jq -r '.Account')

kubectl ${OPERATION} --namespace=$NAMESPACE -f ./sample-app/db/
kubectl ${OPERATION} --namespace=$NAMESPACE -f ./sample-app/mongodb/

host=$(aws rds describe-db-clusters --query 'DBClusters[].[Endpoint]' --db-cluster-identifier $db_cluster_identifier --region $REGION --output text)

sleep 60


for config in $(ls ./sample-app/*.yaml)
do
    sed -e "s/111122223333.dkr.ecr.us-west-2/$ACCOUNT.dkr.ecr.$REGION/g" -e 's#\${REGION}'"#${REGION}#g" -e 's#\${DB_SERVICE_HOST}'"#${host}#g" $config | kubectl ${OPERATION} --namespace=$NAMESPACE -f -
done

if [[ $OPERATION == "apply" ]]; then
    # Apply k8s nginx configuration
    kubectl apply -f ./sample-app/k8s-nginx-ingress/namespace.yaml
    kubectl apply -f ./sample-app/k8s-nginx-ingress/

    # Wait a few seconds for services to start
    sleep 30

    # Save the endpoint URL to a variable
    endpoint=$(kubectl get svc -n ingress-nginx | grep "ingress-nginx" | awk '{print $4}')

    # Print the endpoint
    echo "Visit the following URL to see the sample app running: $endpoint"

else
    kubectl delete -f ./sample-app/k8s-nginx-ingress/
fi
exit $err
