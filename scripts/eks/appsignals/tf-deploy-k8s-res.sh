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

for config in $(ls ./sample-app/traffic-generator/*.yaml)
do
    sed -e "s/111122223333.dkr.ecr.us-west-2/$ACCOUNT_ID.dkr.ecr.$REGION/g" -e 's#\${REGION}'"#${REGION}#g" -e 's#\${DB_SERVICE_HOST}'"#${host}#g" $config | kubectl ${OPERATION} --namespace=$NAMESPACE -f -
done

kubectl ${OPERATION} -f ./sample-app/alb-ingress
