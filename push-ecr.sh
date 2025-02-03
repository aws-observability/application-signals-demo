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

aws ecr create-repository --repository-name nodejs-petclinic-nutrition-service --region ${REGION} --no-cli-pager || true
docker build -t nutrition-service ./pet-nutrition-service --no-cache
docker tag nutrition-service:latest ${REPOSITORY_PREFIX}/nodejs-petclinic-nutrition-service:latest
docker push ${REPOSITORY_PREFIX}/nodejs-petclinic-nutrition-service:latest

aws ecr create-repository --repository-name traffic-generator --region ${REGION} --no-cli-pager || true
docker build -t traffic-generator ./traffic-generator --no-cache
docker tag traffic-generator:latest ${REPOSITORY_PREFIX}/traffic-generator:latest
docker push ${REPOSITORY_PREFIX}/traffic-generator:latest

aws ecr create-repository --repository-name dotnet-petclinic-payment --region ${REGION} --no-cli-pager || true
docker build -t dotnet-petclinic-payment ./dotnet-petclinic-payment/PetClinic.PaymentService --no-cache
docker tag dotnet-petclinic-payment:latest ${REPOSITORY_PREFIX}/dotnet-petclinic-payment:latest
docker push ${REPOSITORY_PREFIX}/dotnet-petclinic-payment:latest

# Create ECR repository
aws ecr create-repository --repository-name otel-collector --region ${REGION} --no-cli-pager || true

# Run ocb.sh to build the collector
echo "Running ocb.sh to build the OpenTelemetry Collector..."
pushd ./otel-collector
chmod +x ./ocb.sh
./ocb.sh
if [[ ! -f ./otelcol-dev/otelcol-dev ]]; then
  echo "Error: otelcol-dev binary not found in ./otel-collector/otelcol-dev. Ensure ocb.sh is generating the file correctly."
  exit 1
fi
if [[ ! -f ./customconfig.yaml ]]; then
  echo "Error: customconfig.yaml not found in ./otel-collector."
  exit 1
fi
# Clean up unnecessary files
rm -f ./otelcol-dev/go.mod ./otelcol-dev/go.sum
rm -f ./otelcol-dev/*.go
popd

echo ${REGION}

# Build and push the Docker image
docker build --build-arg REGION=${REGION} -t otel-collector -f ./otel-collector/Dockerfile ./otel-collector --no-cache --progress=plain
docker tag otel-collector:latest ${REPOSITORY_PREFIX}/otel-collector:latest
docker push ${REPOSITORY_PREFIX}/otel-collector:latest
