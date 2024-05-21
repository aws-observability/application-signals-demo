#!/usr/bin/env bash
export REGION='us-east-1'

get_repo_link() {
    repository_exists=$(aws ecr-public describe-repositories --repository-names $1 --region ${REGION} --query 'repositories[0].repositoryUri' --output text 2>&1)
    if [[ $? -eq 0 ]]; then
        # Repository exists, extract the repositoryUri
        repositoryUri=$repository_exists
        echo $repositoryUri
    else
        # Repository doesn't exist, create it and extract the repositoryUri
        output=$(aws ecr-public create-repository --repository-name $1 --region ${REGION} --no-cli-pager)
        repositoryUri=$(echo $output | jq -r '.repository.repositoryUri')
        echo $repositoryUri
    fi
}

aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws

repo_uri=$(get_repo_link springcommunity/spring-petclinic-api-gateway)
echo "REPO is" ${repo_uri}
docker tag springcommunity/spring-petclinic-api-gateway:latest ${repo_uri}:latest
docker push ${repo_uri}:latest

repo_uri=$(get_repo_link springcommunity/spring-petclinic-discovery-server )
docker tag springcommunity/spring-petclinic-discovery-server:latest ${repo_uri}:latest
docker push ${repo_uri}:latest

repo_uri=$(get_repo_link springcommunity/spring-petclinic-config-server )
docker tag springcommunity/spring-petclinic-config-server:latest ${repo_uri}:latest
docker push ${repo_uri}:latest

repo_uri=$(get_repo_link springcommunity/spring-petclinic-visits-service  )
docker tag springcommunity/spring-petclinic-visits-service:latest ${repo_uri}:latest
docker push ${repo_uri}:latest

repo_uri=$(get_repo_link springcommunity/spring-petclinic-vets-service  )
docker tag springcommunity/spring-petclinic-vets-service:latest ${repo_uri}:latest
docker push ${repo_uri}:latest

repo_uri=$(get_repo_link springcommunity/spring-petclinic-customers-service  )
docker tag springcommunity/spring-petclinic-customers-service:latest ${repo_uri}:latest
docker push ${repo_uri}:latest

repo_uri=$(get_repo_link springcommunity/spring-petclinic-admin-server   )
docker tag springcommunity/spring-petclinic-admin-server:latest ${repo_uri}:latest
docker push ${repo_uri}:latest

repo_uri=$(get_repo_link python-petclinic-insurance-service   )
docker build -t insurance-service ./pet_clinic_insurance_service --no-cache
docker tag insurance-service:latest ${repo_uri}:latest
docker push ${repo_uri}:latest

repo_uri=$(get_repo_link python-petclinic-billing-service   )
docker build -t billing-service ./pet_clinic_billing_service --no-cache
docker tag billing-service:latest ${repo_uri}:latest
docker push ${repo_uri}:latest

repo_uri=$(get_repo_link traffic-generator  )
docker build -t traffic-generator ./traffic-generator --no-cache
docker tag traffic-generator:latest ${repo_uri}:latest
docker push ${repo_uri}:latest