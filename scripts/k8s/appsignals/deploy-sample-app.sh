#!/bin/bash
set -x

# change the directory to the script location so that the relative path can work
cd "$(dirname "$0")"

# Set variables with provided arguments or default values
REGION=$1


ACCOUNT=$(aws sts get-caller-identity | jq -r '.Account')
NAMESPACE=default

kubectl apply -f ./sample-app/db/storageclass.yaml 
kubectl apply -f ./sample-app/db/db-pvc.yaml 
kubectl apply -f ./sample-app/db/db-deployment.yaml
kubectl apply -f ./sample-app/db/db-service.yaml
host=db.$NAMESPACE.svc.cluster.local

sleep 60

repo_prefix=$(aws ecr-public describe-repositories --repository-names traffic-generator --region us-east-1 --query 'repositories[0].repositoryUri' --output text | cut -d'/' -f1,2)

for config in $(ls ./sample-app/*.yaml)
do
    sed -e "s#111122223333.dkr.ecr.us-west-2.amazonaws.com#${repo_prefix}#g" -e 's#\${REGION}'"#${REGION}#g" -e 's#\${DB_SERVICE_HOST}'"#${host}#g" $config | kubectl apply -f -
done

# Apply k8s nginx configuration
kubectl apply -f ./sample-app/k8s-nginx-ingress/namespace.yaml
kubectl apply -f ./sample-app/k8s-nginx-ingress/

# Wait some time for services to start
sleep 60

endpoint=$(kubectl get svc -n ingress-nginx | grep "ingress-nginx" | awk '{print $3}')

# Start the traffic generator
sed -e "s#111122223333.dkr.ecr.us-west-2.amazonaws.com#${repo_prefix}#g" -e "s/SAMPLE_APP_END_POINT/${endpoint}/g"  ./traffic-generator.yaml | kubectl apply -f -

# Print the endpoint
echo "Started the traffic generator to send traffic to http://${endpoint}"
