#!/usr/bin/env bash
export REPOSITORY_PREFIX=${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com

aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${REPOSITORY_PREFIX}

aws ecr create-repository --repository-name springcommunity/spring-petclinic-api-gateway --region ${REGION} --no-cli-pager || true
docker tag springcommunity/spring-petclinic-api-gateway:latest ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-api-gateway:latest
docker push ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-api-gateway:latest

aws ecr create-repository --repository-name springcommunity/spring-petclinic-discovery-server --region ${REGION} --no-cli-pager || true
docker tag springcommunity/spring-petclinic-discovery-server:latest ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-discovery-server:latest
docker push ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-discovery-server:latest

aws ecr create-repository --repository-name springcommunity/spring-petclinic-config-server --region ${REGION} --no-cli-pager || true
docker tag springcommunity/spring-petclinic-config-server:latest ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-config-server:latest
docker push ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-config-server:latest

aws ecr create-repository --repository-name springcommunity/spring-petclinic-visits-service --region ${REGION} --no-cli-pager || true
docker tag springcommunity/spring-petclinic-visits-service:latest ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-visits-service:latest
docker push ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-visits-service:latest

aws ecr create-repository --repository-name springcommunity/spring-petclinic-vets-service --region ${REGION} --no-cli-pager || true
docker tag springcommunity/spring-petclinic-vets-service:latest ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-vets-service:latest
docker push ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-vets-service:latest

aws ecr create-repository --repository-name springcommunity/spring-petclinic-customers-service --region ${REGION} --no-cli-pager || true
docker tag springcommunity/spring-petclinic-customers-service:latest ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-customers-service:latest
docker push ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-customers-service:latest

aws ecr create-repository --repository-name springcommunity/spring-petclinic-admin-server --region ${REGION} --no-cli-pager || true
docker tag springcommunity/spring-petclinic-admin-server:latest ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-admin-server:latest
docker push ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-admin-server:latest


aws ecr create-repository --repository-name python-petclinic-insurance-service --region ${REGION} --no-cli-pager || true

docker build -t insurance-service ./pet_clinic_insurance_service --no-cache
docker tag insurance-service:latest ${REPOSITORY_PREFIX}/python-petclinic-insurance-service:latest
docker push ${REPOSITORY_PREFIX}/python-petclinic-insurance-service:latest


aws ecr create-repository --repository-name python-petclinic-billing-service --region ${REGION} --no-cli-pager || true

docker build -t billing-service ./pet_clinic_billing_service --no-cache
docker tag billing-service:latest ${REPOSITORY_PREFIX}/python-petclinic-billing-service:latest
docker push ${REPOSITORY_PREFIX}/python-petclinic-billing-service:latest

aws ecr create-repository --repository-name traffic-generator --region ${REGION} --no-cli-pager || true
docker build -t traffic-generator ./traffic-generator --no-cache
docker tag traffic-generator:latest ${REPOSITORY_PREFIX}/traffic-generator:latest
docker push ${REPOSITORY_PREFIX}/traffic-generator:latest