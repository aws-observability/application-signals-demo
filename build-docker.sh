#!/usr/bin/env bash
set -euo pipefail

VERSION=$(./mvnw help:evaluate -Dexpression=project.version -q -DforceStdout)

SERVICES=(
  spring-petclinic-admin-server
  spring-petclinic-api-gateway
  spring-petclinic-config-server
  spring-petclinic-customers-service
  spring-petclinic-discovery-server
  spring-petclinic-vets-service
  spring-petclinic-visits-service
)

for svc in "${SERVICES[@]}"; do
  echo ">>> Building $svc"
  docker build \
    --platform linux/amd64 \
    --build-arg ARTIFACT_NAME="${svc}-${VERSION}" \
    --build-arg EXPOSED_PORT=9090 \
    --build-arg DOCKERIZE_VERSION=v0.6.1 \
    -f docker/Dockerfile \
    -t "springcommunity/${svc}:latest" \
    "$svc/target"
done
