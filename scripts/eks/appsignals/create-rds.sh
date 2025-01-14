#!/bin/bash
# set -x

# change the directory to the script location so that the relative path can work
cd "$(dirname "$0")"

# Set variables with provided arguments or default values
CLUSTER_NAME=$1
REGION=$2
echo "Creating RDS Aurora Postgre cluster for EKS Cluster ${CLUSTER_NAME} in ${REGION}"

# Fetch the EKS cluster VPC ID
vpc_id=$(aws eks describe-cluster --name ${CLUSTER_NAME} --region ${REGION} --query "cluster.resourcesVpcConfig.vpcId" --output text)

# Get two subnets in the default VPC
subnet_ids=$(aws eks describe-cluster --name ${CLUSTER_NAME} --region ${REGION} --query "cluster.resourcesVpcConfig.subnetIds[]" --output text | sed 's/\t/ /g')

# Create a database subnet group
db_subnet_group_name="my-db-subnet-group"
aws rds create-db-subnet-group --region ${REGION} --db-subnet-group-name $db_subnet_group_name --db-subnet-group-description "Subnet group for RDS" --subnet-ids $subnet_ids --output text

# Wait for the DB subnet group to be available (assumed immediate availability after creation)
echo "RDS subnet group created and ready to use."

# Create the DB cluster  using the new DB subnet group
security_group=$(aws eks describe-cluster --name ${CLUSTER_NAME} --region ${REGION} --query "cluster.resourcesVpcConfig.clusterSecurityGroupId" --output text)

db_cluster_identifier="petclinic-python"
master_username="djangouser"
SECRET_NAME="petclinic-python-dbsecret"
PASSWORD_LENGTH=10

# Generate a random password using openssl
master_password=$(openssl rand -base64 10 | tr -dc '[:alnum:]' | head -c 10)

# Create a brand new secret with the generated password
#    (fails if the secret name already exists)
aws secretsmanager create-secret \
  --name "${SECRET_NAME}" \
  --description "Secret for ${db_cluster_identifier} database" \
  --region "${REGION}" \
  --secret-string "${master_password}"

aws rds create-db-cluster \
    --region ${REGION} \
    --db-cluster-identifier $db_cluster_identifier \
    --database-insights-mode advanced \
    --engine aurora-postgresql \
    --master-username $master_username \
    --master-user-password $master_password \
    --db-subnet-group-name $db_subnet_group_name \
    --vpc-security-group-ids $security_group \
    --backup-retention-period 1 \
    --enable-performance-insights \
    --performance-insights-retention-period 465 \
    --tags Key=Name,Value=$db_cluster_identifier \
    --output text

aws rds wait db-cluster-available --region ${REGION} --db-cluster-identifier $db_cluster_identifier

echo "RDS cluster created and ready to use."

db_instance_identifier=$db_cluster_identifier
db_instance_identifier+="-instance-1"

aws rds create-db-instance \
    --region ${REGION} \
    --db-instance-identifier $db_instance_identifier \
    --db-cluster-identifier $db_cluster_identifier \
    --engine aurora-postgresql \
    --db-instance-class db.t3.medium \
    --tags Key=Name,Value=$db_instance_identifier \
    --output text

echo "RDS instance creation initiated..."

# Wait for the DB instance to be ready
echo "Waiting for RDS instance to become available..."
aws rds wait db-instance-available --region ${REGION} --db-instance-identifier $db_instance_identifier

echo "RDS instance is now available."
