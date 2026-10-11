#!/usr/bin/env bash

set -euo pipefail

BUILDER_CONFIG="builder-config.yaml"
OCB_VERSION="0.111.0"

if [[ ! -f "${BUILDER_CONFIG}" ]]; then
  echo "Error: ${BUILDER_CONFIG} not found in $(pwd)"
  exit 1
fi

HOST_OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
HOST_ARCH_RAW="$(uname -m)"
case "${HOST_ARCH_RAW}" in
  x86_64|amd64) HOST_ARCH="amd64" ;;
  arm64|aarch64) HOST_ARCH="arm64" ;;
  *) echo "Unsupported host arch: ${HOST_ARCH_RAW}"; exit 1 ;;
esac

OCB_BINARY="ocb_${HOST_OS}_${HOST_ARCH}"
OCB_URL="https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/cmd%2Fbuilder%2Fv${OCB_VERSION}/ocb_${OCB_VERSION}_${HOST_OS}_${HOST_ARCH}"

if [[ ! -x "${OCB_BINARY}" ]]; then
  echo "Downloading OpenTelemetry Collector Builder (${HOST_OS}/${HOST_ARCH})..."
  curl -fSL "${OCB_URL}" -o "${OCB_BINARY}"
  chmod +x "${OCB_BINARY}"
fi

echo "Building OpenTelemetry Collector for linux/amd64..."
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 ./"${OCB_BINARY}" --config "${BUILDER_CONFIG}"
