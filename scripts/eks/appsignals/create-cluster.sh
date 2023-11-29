#!/bin/bash

# Optional inputs with default values
cluster_name=$1
region=$2

usage() {
  echo "Usage: $0 [cluster_name] [region]"
  echo "cluster_name: the name of the EKS cluster"
  echo "region: the AWS region to create the cluster"
  exit 1
}

# If --help is provided as an argument, print the usage
for arg in "$@"
do
  if [[ "$arg" == "--help" ]]; then
    usage
    exit 0
  fi
done

check_cluster_exists() {
  cluster_exists=$(aws eks describe-cluster --name $cluster_name --region $region --query 'cluster.[name]' --output text 2>/dev/null)

  if [[ "$cluster_exists" == "$cluster_name" ]]; then
    echo "Error: Cluster $cluster_name already exists in region $region"
    exit 1
  fi
}

create_cluster() {
  eksctl create cluster --name $cluster_name --region $region --nodes=2
  if [[ $? -eq 0 ]]; then
    echo "Cluster $cluster_name has been created successfully in region $region"
  else
    echo "Error: Failed to create cluster $cluster_name in region $region"
    exit 1
  fi
}

check_cluster_exists
create_cluster
