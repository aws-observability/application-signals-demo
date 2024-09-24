#!/bin/bash

CLUSTER_NAME=${1:-"python-apm-demo"}
REGION=${2:-"us-east-1"}
NAMESPACE=${3:-"default"}
OPERATION=${4:-"apply"}
ACCOUNT_ID=`aws sts get-caller-identity | jq .Account -r`

# change the directory to the script location so that the relative path can work
cd "$(dirname "$0")"

cd ../../../terraform/eks/

db_endpoint=`terraform output -raw postgres_endpoint`

host=$(echo $db_endpoint | awk -F ':' '{print $1}')
port=$(echo $db_endpoint | awk -F ':' '{print $2}')

cd ../../scripts/eks/appsignals/

for config in $(ls ./sample-app/*.yaml)
do
    sed -e "s/111122223333.dkr.ecr.us-west-2/$ACCOUNT_ID.dkr.ecr.$REGION/g" -e 's#\${REGION}'"#${REGION}#g" -e 's#\${DB_SERVICE_HOST}'"#${host}#g" $config | kubectl ${OPERATION} --namespace=$NAMESPACE -f -
done

# Save the endpoint URL to a variable
endpoint=$(kubectl get ingress -o json  --output jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}')

# Start the traffic generator
ACCOUNT=$(aws sts get-caller-identity | jq -r '.Account')
sed -e "s/111122223333.dkr.ecr.us-west-2/$ACCOUNT.dkr.ecr.$REGION/g" -e "s/SAMPLE_APP_END_POINT/${endpoint}/g"  ./sample-app/traffic-generator/traffic-generator.yaml | kubectl apply --namespace=$NAMESPACE -f -

# Print the endpoint
echo "Started the traffic generator to send traffic to http://${endpoint}"

kubectl ${OPERATION} -f ./sample-app/alb-ingress
