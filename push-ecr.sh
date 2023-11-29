#!/usr/bin/env bash
export REPOSITORY_PREFIX=${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com

aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${REPOSITORY_PREFIX}

aws ecr create-repository --repository-name springcommunity/spring-petclinic-api-gateway --region ${REGION} || true
docker tag springcommunity/spring-petclinic-api-gateway:latest ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-api-gateway:latest
docker push ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-api-gateway:latest

aws ecr create-repository --repository-name springcommunity/spring-petclinic-discovery-server --region ${REGION} || true
docker tag springcommunity/spring-petclinic-discovery-server:latest ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-discovery-server:latest
docker push ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-discovery-server:latest

aws ecr create-repository --repository-name springcommunity/spring-petclinic-config-server --region ${REGION} || true
docker tag springcommunity/spring-petclinic-config-server:latest ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-config-server:latest
docker push ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-config-server:latest

aws ecr create-repository --repository-name springcommunity/spring-petclinic-visits-service --region ${REGION} || true
docker tag springcommunity/spring-petclinic-visits-service:latest ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-visits-service:latest
docker push ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-visits-service:latest

aws ecr create-repository --repository-name springcommunity/spring-petclinic-vets-service --region ${REGION} || true
docker tag springcommunity/spring-petclinic-vets-service:latest ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-vets-service:latest
docker push ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-vets-service:latest

aws ecr create-repository --repository-name springcommunity/spring-petclinic-customers-service --region ${REGION} || true
docker tag springcommunity/spring-petclinic-customers-service:latest ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-customers-service:latest
docker push ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-customers-service:latest

aws ecr create-repository --repository-name springcommunity/spring-petclinic-admin-server --region ${REGION} || true
docker tag springcommunity/spring-petclinic-admin-server:latest ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-admin-server:latest
docker push ${REPOSITORY_PREFIX}/springcommunity/spring-petclinic-admin-server:latest

