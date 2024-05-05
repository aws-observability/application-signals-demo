#!/bin/bash
set -x

alias kubectl="minikube kubectl --" 

kubectl() {
 minikube kubectl -- "$@"
}

kubectl get pod

# change the directory to the script location so that the relative path can work
cd "$(dirname "$0")"

# Set variables with provided arguments or default values
REGION=$1


ACCOUNT=$(aws sts get-caller-identity | jq -r '.Account')

kubectl apply -f ./sample-app/db/db-pvc.yaml 
kubectl apply -f ./sample-app/db/
host=db.$NAMESPACE.svc.cluster.local

sleep 60

for config in $(ls ./sample-app/*.yaml)
do
    sed -e "s/111122223333.dkr.ecr.us-west-2/$ACCOUNT.dkr.ecr.$REGION/g" -e 's#\${REGION}'"#${REGION}#g" -e 's#\${DB_SERVICE_HOST}'"#${host}#g" $config | kubectl apply -f -
done

# Apply k8s nginx configuration
kubectl apply -f ./sample-app/k8s-nginx-ingress/namespace.yaml
kubectl apply -f ./sample-app/k8s-nginx-ingress/

# Wait some time for services to start
sleep 60

endpoint=$(kubectl get svc -n ingress-nginx | grep "ingress-nginx" | awk '{print $3}')

# Start the traffic generator
sed -e "s/111122223333.dkr.ecr.us-west-2/$ACCOUNT.dkr.ecr.$REGION/g" -e "s/SAMPLE_APP_END_POINT/${endpoint}/g"  ./traffic-generator.yaml | kubectl apply -f -

# Print the endpoint
echo "Started the traffic generator to send traffic to http://${endpoint}"
