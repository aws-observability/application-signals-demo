#!/usr/bin/env bash

if [ ! -z "$1" ]
then
      echo "REGION is NOT empty - $1"
      export REGION="$1"
else
      echo "REGION is empty"
      export REGION="us-east-1"
fi

export ACCOUNT_ID=`aws sts get-caller-identity | jq .Account -r`
export ECR_URL=${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_URL}

docker build -t insurance-service . --no-cache
docker tag insurance-service:latest ${ECR_URL}/python-petclinic-insurance-service:latest
docker push ${ECR_URL}/python-petclinic-insurance-service:latest

kubectl delete pods -l io.kompose.service=insurance-service-python