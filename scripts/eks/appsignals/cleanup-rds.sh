#!/bin/bash
# set -x

# change the directory to the script location so that the relative path can work
cd "$(dirname "$0")"

# Set variables with provided arguments or default values
CLUSTER_NAME=$1
REGION=$2
echo "Deleting RDS Aurora Postgre cluster for EKS Cluster ${CLUSTER_NAME} in ${REGION}"

# Configuration variables
db_cluster_identifier="petclinic-python"
db_instance_identifier="petclinic-python-instance-1"
db_subnet_group_name="my-db-subnet-group"

# The name or ARN of the secret you want to delete
SECRET_NAME="petclinic-python-dbsecret"

# Delete the RDS instance
echo "Deleting RDS instance..."
aws rds delete-db-instance \
    --region $REGION \
    --db-instance-identifier $db_instance_identifier \
    --skip-final-snapshot  \
    --delete-automated-backups \
    --output text

# Wait for the DB instance to be completely deleted
echo "Waiting for RDS instance to be deleted..."
aws rds wait db-instance-deleted --region $REGION --db-instance-identifier $db_instance_identifier

# Delete the RDS cluster
echo "Deleting RDS cluster..."
aws rds delete-db-cluster --region $REGION --db-cluster-identifier $db_cluster_identifier --skip-final-snapshot --output text

# Wait for the DB cluster to be completely deleted
echo "Waiting for RDS cluster to be deleted..."
aws rds wait db-cluster-deleted --region $REGION --db-cluster-identifier $db_cluster_identifier

# Delete the DB subnet group
echo "Deleting RDS subnet group..."
aws rds delete-db-subnet-group --region $REGION --db-subnet-group-name $db_subnet_group_name


echo "Deleting secret: $SECRET_NAME in region $REGION ..."
aws secretsmanager delete-secret \
  --secret-id "$SECRET_NAME" \
  --region "$REGION" \
  --force-delete-without-recovery

