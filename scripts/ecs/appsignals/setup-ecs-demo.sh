#!/bin/bash
set -ex

# Default values
DEFAULT_REGION="us-east-1"
DEFAULT_CLUSTER="ecs-pet-clinic-demo"
OPERATION="create"

# Read command line arguments
for i in "$@"
do
case $i in
    --operation=*)
    OPERATION="${i#*=}"
    shift # past argument=value
    ;;
    --region=*)
    REGION="${i#*=}"
    shift # past argument=value
    ;;
    --cluster=*)
    CLUSTER="${i#*=}"
    shift # past argument=value
    ;;
    *)
          # unknown option
    ;;
esac
done

# Set region cluster name with provided value or default
REGION="${REGION:-$DEFAULT_REGION}"
CLUSTER="${CLUSTER:-$DEFAULT_CLUSTER}"

export AWS_DEFAULT_REGION=$REGION

# Variables
SG_NAME="ecs-security-group"
IAM_TASK_ROLE_NAME="ecs-pet-clinic-task-role-${REGION}"
IAM_EXECUTION_ROLE_NAME="ecs-pet-clinic-execution-role-${REGION}"
LOAD_BALANCER_NAME="ecs-pet-clinic-lb-${REGION}"
OUTPUT_FILE="ecs-pet-clinic-vars.txt"
account_id="000111222333"

ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
VPC_ID="vpc-0000000000aaaaaaa"
SUBNET_IDS="subnet-0000000000aaaaaaa subnet-1111111111bbbbbbb"
SECURITY_GROUP_ID="sg-0000000000aaaaaaa"
LOAD_BALANCER_ARN="arn:aws:elasticloadbalancing:${REGION}:000111222333:loadbalancer/app/${LOAD_BALANCER_NAME}"
LOAD_BALANCER_DNS="ecs-pet-clinic-lb-${REGION}-000111222333.us-east-1.elb.amazonaws.com"
ECR_IMAGE_PREFIX="000111222333.dkr.ecr.us-east-1.amazonaws.com"

VPC_ID="vpc-073c48be423af5150"
SUBNET_IDS="subnet-0a18f3700d2eafc52	subnet-03d8b6a26bca5c25f	subnet-03a8d564e64200394	subnet-0fd0377f4b84dc8e0"
SECURITY_GROUP_ID="sg-05f9c38863c836987"
LOAD_BALANCER_ARN="arn:aws:elasticloadbalancing:us-west-2:007003802740:loadbalancer/app/ecs-pet-clinic-lb-us-west-2/1ae62d0cf10b1de2"
LOAD_BALANCER_DNS="ecs-pet-clinic-lb-us-west-2-463149261.us-west-2.elb.amazonaws.com"
ECR_IMAGE_PREFIX="public.ecr.aws/u8q5x3l1"
ACCOUNT_ID="007003802740"


function create_resources() {
    echo "Creating resources..."
    # Get the default VPC
    VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query 'Vpcs[0].VpcId' --output text)

    SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[*].SubnetId" --output text)
    echo "Subnet IDs: $SUBNET_IDS"

    # Create a security group
    SECURITY_GROUP_ID=$(aws ec2 create-security-group --group-name $SG_NAME --description "Security group for all traffic" --vpc-id $VPC_ID --query 'GroupId' --output text)
    aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol all --cidr 0.0.0.0/0
    echo "Security group ID: $SECURITY_GROUP_ID"

    # Create a load balancer
    LOAD_BALANCER_ARN=$(aws elbv2 create-load-balancer \
        --name $LOAD_BALANCER_NAME \
        --subnets $SUBNET_IDS \
        --security-groups $SECURITY_GROUP_ID \
        --scheme internet-facing \
        --type application \
        --query "LoadBalancers[0].LoadBalancerArn" \
        --output text)
    echo "Load balancer ARN: $LOAD_BALANCER_ARN"

    LOAD_BALANCER_DNS=$(aws elbv2 describe-load-balancers \
        --load-balancer-arns $LOAD_BALANCER_ARN \
        --query "LoadBalancers[0].DNSName" \
        --output text)

    echo "Load balancer DNS: $LOAD_BALANCER_DNS"


    # Create an ECS Task role and attach policies
    aws iam create-role --role-name $IAM_TASK_ROLE_NAME --assume-role-policy-document file://trust-policy.json
    aws iam attach-role-policy --role-name $IAM_TASK_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess"
    aws iam attach-role-policy --role-name $IAM_TASK_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
    aws iam attach-role-policy --role-name $IAM_TASK_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
    aws iam attach-role-policy --role-name $IAM_TASK_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceRole"
    aws iam attach-role-policy --role-name $IAM_TASK_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonECS_FullAccess"
    aws iam attach-role-policy --role-name $IAM_TASK_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
    aws iam attach-role-policy --role-name $IAM_TASK_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"

    # Create an ECS Task Execution role and attach policies
    aws iam create-role --role-name $IAM_EXECUTION_ROLE_NAME --assume-role-policy-document file://trust-policy.json
    aws iam attach-role-policy --role-name $IAM_EXECUTION_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
    aws iam attach-role-policy --role-name $IAM_EXECUTION_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonKinesisFullAccess"
    aws iam attach-role-policy --role-name $IAM_EXECUTION_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonS3FullAccess"
    aws iam attach-role-policy --role-name $IAM_EXECUTION_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
    aws iam attach-role-policy --role-name $IAM_EXECUTION_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonRDSFullAccess"
    aws iam attach-role-policy --role-name $IAM_EXECUTION_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
    aws iam attach-role-policy --role-name $IAM_EXECUTION_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess"
    aws iam attach-role-policy --role-name $IAM_EXECUTION_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonBedrockFullAccess"
    aws iam attach-role-policy --role-name $IAM_EXECUTION_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
    aws iam attach-role-policy --role-name $IAM_EXECUTION_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonECS_FullAccess"

    operation_id=$(aws servicediscovery create-private-dns-namespace \
      --name ecs-petclinic \
      --vpc $VPC_ID \
      --query 'OperationId' \
      --output text)

    echo "Namespace creation initiated. Waiting for the namespace to be available..."
    while true; do
      STATUS=$(aws servicediscovery get-operation \
        --operation-id $operation_id \
        --query 'Operation.Status' \
        --output text)

      if [ "$STATUS" == "SUCCESS" ]; then
        echo "Namespace is now available!"
        break
      elif [ "$STATUS" == "FAIL" ]; then
        echo "Namespace creation failed."
        exit 1
      else
        echo "Namespace is still being created. Status: $STATUS"
        sleep 30
      fi
    done

    # Creat ECS cluster
    aws ecs create-cluster --cluster-name ${CLUSTER}

    # Get ECR image prefix
    ECR_IMAGE_PREFIX=$(aws ecr-public describe-repositories --repository-names traffic-generator --region us-east-1 --query 'repositories[0].repositoryUri' --output text | cut -d'/' -f1,2)

    echo "VPC_ID=\"$VPC_ID\"" >> $OUTPUT_FILE
    echo "SUBNET_IDS=\"$SUBNET_IDS\"" >> $OUTPUT_FILE
    echo "SECURITY_GROUP_ID=\"$SECURITY_GROUP_ID\"" >> $OUTPUT_FILE
    echo "LOAD_BALANCER_ARN=\"$LOAD_BALANCER_ARN\"" >> $OUTPUT_FILE
    echo "LOAD_BALANCER_DNS=\"$LOAD_BALANCER_DNS\"" >> $OUTPUT_FILE
    echo "ECR_IMAGE_PREFIX=\"$ECR_IMAGE_PREFIX\"" >> $OUTPUT_FILE
    echo "ACCOUNT_ID=\"$ACCOUNT_ID\"" >> $OUTPUT_FILE

    # Confirm the output file has been written
    echo "Variables written to $OUTPUT_FILE"

    echo "Resource creation complete."

}

function run_config_server() {
  sed -i '' "s|\"config-server-image\"|\"${ECR_IMAGE_PREFIX}/springcommunity/spring-petclinic-config-server\"|" ./sample-app/task-definitions/spring-petclinic-config-server.json
  sed -i '' "s|us-west-2|${REGION}|g" ./sample-app/task-definitions/spring-petclinic-config-server.json
  sed -i '' "s|000111222333|${ACCOUNT_ID}|g" ./sample-app/task-definitions/spring-petclinic-config-server.json

  aws ecs register-task-definition --cli-input-json file://sample-app/task-definitions/spring-petclinic-config-server.json > /dev/null

  namespace_id=$(aws servicediscovery list-namespaces --query "Namespaces[?Name=='ecs-petclinic'].Id" --output text)
  service_discovery_id=$(aws servicediscovery create-service \
      --name config-server \
      --dns-config "NamespaceId=$namespace_id,RoutingPolicy=WEIGHTED,DnsRecords=[{Type=A,TTL=300}]" \
      --health-check-custom-config FailureThreshold=2 \
      --query "Service.Id" --output text)

  registryArn=$(aws servicediscovery get-service \
    --id $service_discovery_id \
    --query 'Service.Arn' --output text)

  aws ecs create-service \
      --service-name config-server \
      --task-definition config-server \
      --service-registries registryArn=$registryArn \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[$(echo $SUBNET_IDS | tr -s ' ' ',')],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}" \
      --cluster $CLUSTER > /dev/null

  echo "Waiting for the config server to be accessible..."
  sleep 180
  echo "Config server is now accessible!"

}

function run_discovery_server() {
  sed -i '' "s|\"discovery-server-image\"|\"${ECR_IMAGE_PREFIX}/springcommunity/spring-petclinic-discovery-server\"|" ./sample-app/task-definitions/spring-petclinic-discovery-server.json
  sed -i '' "s|us-west-2|${REGION}|g" ./sample-app/task-definitions/spring-petclinic-discovery-server.json
  sed -i '' "s|000111222333|${ACCOUNT_ID}|g" ./sample-app/task-definitions/spring-petclinic-discovery-server.json

  aws ecs register-task-definition --cli-input-json file://sample-app/task-definitions/spring-petclinic-discovery-server.json > /dev/null

  namespace_id=$(aws servicediscovery list-namespaces --query "Namespaces[?Name=='ecs-petclinic'].Id" --output text)
  service_discovery_id=$(aws servicediscovery create-service \
      --name discovery-server \
      --dns-config "NamespaceId=$namespace_id,RoutingPolicy=WEIGHTED,DnsRecords=[{Type=A,TTL=300}]" \
      --health-check-custom-config FailureThreshold=2 \
      --query "Service.Id" --output text)

  registryArn=$(aws servicediscovery get-service \
    --id $service_discovery_id \
    --query 'Service.Arn' --output text)

  aws ecs create-service \
      --service-name discovery-server \
      --task-definition discovery-server \
      --service-registries registryArn=$registryArn \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[$(echo $SUBNET_IDS | tr -s ' ' ',')],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}" \
      --cluster $CLUSTER > /dev/null

  echo "Waiting for the discovery server to be accessible..."
  sleep 180

  echo "discovery server is now accessible!"

}

function run_admin_server() {
  adot_java_image_tag=$(curl -s -I -L 'https://github.com/aws-observability/aws-otel-java-instrumentation/releases/latest' | grep -i Location | awk -F'/tag/' '{print $2}' | tr -d '\r')
  adot_java_image="public.ecr.aws/aws-observability/adot-autoinstrumentation-java:$adot_java_image_tag"
  sed -i '' "s|\"adot-java-image\"|\"${adot_java_image}\"|" ./sample-app/task-definitions/spring-petclinic-admin-server.json
  sed -i '' "s|\"admin-server-image\"|\"${ECR_IMAGE_PREFIX}/springcommunity/spring-petclinic-admin-server\"|" ./sample-app/task-definitions/spring-petclinic-admin-server.json
  sed -i '' "s|us-west-2|${REGION}|g" ./sample-app/task-definitions/spring-petclinic-admin-server.json
  sed -i '' "s|000111222333|${ACCOUNT_ID}|g" ./sample-app/task-definitions/spring-petclinic-admin-server.json

  aws ecs register-task-definition --cli-input-json file://sample-app/task-definitions/spring-petclinic-admin-server.json > /dev/null

  namespace_id=$(aws servicediscovery list-namespaces --query "Namespaces[?Name=='ecs-petclinic'].Id" --output text)
  service_discovery_id=$(aws servicediscovery create-service \
      --name admin-server \
      --dns-config "NamespaceId=$namespace_id,RoutingPolicy=WEIGHTED,DnsRecords=[{Type=A,TTL=300}]" \
      --health-check-custom-config FailureThreshold=2 \
      --query "Service.Id" --output text)

  registryArn=$(aws servicediscovery get-service \
    --id $service_discovery_id \
    --query 'Service.Arn' --output text)

  aws ecs create-service \
      --service-name admin-server \
      --task-definition admin-server \
      --service-registries registryArn=$registryArn \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[$(echo $SUBNET_IDS | tr -s ' ' ',')],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}" \
      --cluster $CLUSTER > /dev/null

  sleep 120

  echo "Finished deploying admin server!"

}

function run_api_gateway() {
  api_gateway_target_group_arn=$(aws elbv2 create-target-group \
      --name api-gateway-target-group \
      --protocol HTTP \
      --port 8080 \
      --vpc-id $VPC_ID \
      --target-type ip \
      --query "TargetGroups[0].TargetGroupArn" \
      --output text)

  aws elbv2 modify-target-group \
      --target-group-arn $api_gateway_target_group_arn \
      --health-check-protocol HTTP \
      --health-check-path "/" \
      --health-check-interval-seconds 240 \
      --health-check-timeout-seconds 60 \
      --healthy-threshold-count 5 \
      --unhealthy-threshold-count 2

  aws elbv2 create-listener \
    --load-balancer-arn $LOAD_BALANCER_ARN \
    --protocol HTTP \
    --port 8080 \
    --default-actions Type=forward,TargetGroupArn=$api_gateway_target_group_arn

  adot_java_image_tag=$(curl -s -I -L 'https://github.com/aws-observability/aws-otel-java-instrumentation/releases/latest' | grep -i Location | awk -F'/tag/' '{print $2}' | tr -d '\r')
  adot_java_image="public.ecr.aws/aws-observability/adot-autoinstrumentation-java:$adot_java_image_tag"
  sed -i '' "s|\"adot-java-image\"|\"${adot_java_image}\"|" ./sample-app/task-definitions/spring-petclinic-api-gateway.json
  sed -i '' "s|\"api_gateway_ip\"|\"${LOAD_BALANCER_DNS}\"|" ./sample-app/task-definitions/spring-petclinic-api-gateway.json
  sed -i '' "s|\"api-gateway-image\"|\"${ECR_IMAGE_PREFIX}/springcommunity/spring-petclinic-api-gateway\"|" ./sample-app/task-definitions/spring-petclinic-api-gateway.json
  sed -i '' "s|us-west-2|${REGION}|g" ./sample-app/task-definitions/spring-petclinic-api-gateway.json
  sed -i '' "s|000111222333|${ACCOUNT_ID}|g" ./sample-app/task-definitions/spring-petclinic-api-gateway.json

  aws ecs register-task-definition --cli-input-json file://sample-app/task-definitions/spring-petclinic-api-gateway.json > /dev/null

  aws ecs create-service \
      --service-name api-gateway \
      --task-definition api-gateway \
      --load-balancers targetGroupArn=$api_gateway_target_group_arn,containerName=api-gateway,containerPort=8080 \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[$(echo $SUBNET_IDS | tr -s ' ' ',')],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}" \
      --cluster $CLUSTER > /dev/null

  echo "Waiting for the Frontened server to be accessible..."
  sleep 240

  echo "Frontened server is now accessible!"

}

function run_vets_service() {
  namespace_id=$(aws servicediscovery list-namespaces --query "Namespaces[?Name=='ecs-petclinic'].Id" --output text)

  service_discovery_id=$(aws servicediscovery create-service \
      --name vets-service \
      --dns-config "NamespaceId=$namespace_id,RoutingPolicy=WEIGHTED,DnsRecords=[{Type=A,TTL=300}]" \
      --health-check-custom-config FailureThreshold=2 \
      --query "Service.Id" --output text)

  registryArn=$(aws servicediscovery get-service \
    --id $service_discovery_id \
    --query 'Service.Arn' --output text)

  adot_java_image_tag=$(curl -s -I -L 'https://github.com/aws-observability/aws-otel-java-instrumentation/releases/latest' | grep -i Location | awk -F'/tag/' '{print $2}' | tr -d '\r')
  adot_java_image="public.ecr.aws/aws-observability/adot-autoinstrumentation-java:$adot_java_image_tag"
  sed -i '' "s|\"adot-java-image\"|\"${adot_java_image}\"|" ./sample-app/task-definitions/spring-petclinic-vets-service.json
  sed -i '' "s|\"vets-service-image\"|\"${ECR_IMAGE_PREFIX}/springcommunity/spring-petclinic-vets-service\"|" ./sample-app/task-definitions/spring-petclinic-vets-service.json
  sed -i '' "s|us-west-2|${REGION}|g" ./sample-app/task-definitions/spring-petclinic-vets-service.json
  sed -i '' "s|000111222333|${ACCOUNT_ID}|g" ./sample-app/task-definitions/spring-petclinic-vets-service.json

  aws ecs register-task-definition --cli-input-json file://sample-app/task-definitions/spring-petclinic-vets-service.json > /dev/null

  aws ecs create-service \
      --service-name vets-service \
      --task-definition vets-service \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[$(echo $SUBNET_IDS | tr -s ' ' ',')],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}" \
      --service-registries registryArn=$registryArn \
      --cluster $CLUSTER > /dev/null

  echo "Waiting for the Vets server to be accessible..."
  sleep 180

}

function run_customers_service() {
  namespace_id=$(aws servicediscovery list-namespaces --query "Namespaces[?Name=='ecs-petclinic'].Id" --output text)

  service_discovery_id=$(aws servicediscovery create-service \
      --name customers-service \
      --dns-config "NamespaceId=$namespace_id,RoutingPolicy=WEIGHTED,DnsRecords=[{Type=A,TTL=300}]" \
      --health-check-custom-config FailureThreshold=2 \
      --query "Service.Id" --output text)

  registryArn=$(aws servicediscovery get-service \
    --id $service_discovery_id \
    --query 'Service.Arn' --output text)

  adot_java_image_tag=$(curl -s -I -L 'https://github.com/aws-observability/aws-otel-java-instrumentation/releases/latest' | grep -i Location | awk -F'/tag/' '{print $2}' | tr -d '\r')
  adot_java_image="public.ecr.aws/aws-observability/adot-autoinstrumentation-java:$adot_java_image_tag"
  sed -i '' "s|\"adot-java-image\"|\"${adot_java_image}\"|" ./sample-app/task-definitions/spring-petclinic-customers-service.json
  sed -i '' "s|\"customers-service-image\"|\"${ECR_IMAGE_PREFIX}/springcommunity/spring-petclinic-customers-service\"|" ./sample-app/task-definitions/spring-petclinic-customers-service.json
  sed -i '' "s|us-west-2|${REGION}|g" ./sample-app/task-definitions/spring-petclinic-customers-service.json
  sed -i '' "s|000111222333|${ACCOUNT_ID}|g" ./sample-app/task-definitions/spring-petclinic-customers-service.json

  aws ecs register-task-definition --cli-input-json file://sample-app/task-definitions/spring-petclinic-customers-service.json > /dev/null

  aws ecs create-service \
      --service-name customers-service \
      --task-definition customers-service \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[$(echo $SUBNET_IDS | tr -s ' ' ',')],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}" \
      --service-registries registryArn=$registryArn \
      --cluster $CLUSTER > /dev/null

  echo "Waiting for the Customers server to be accessible..."
  sleep 180
}

function run_visits_service() {
  namespace_id=$(aws servicediscovery list-namespaces --query "Namespaces[?Name=='ecs-petclinic'].Id" --output text)

  service_discovery_id=$(aws servicediscovery create-service \
      --name visits-service \
      --dns-config "NamespaceId=$namespace_id,RoutingPolicy=WEIGHTED,DnsRecords=[{Type=A,TTL=300}]" \
      --health-check-custom-config FailureThreshold=2 \
      --query "Service.Id" --output text)

  registryArn=$(aws servicediscovery get-service \
    --id $service_discovery_id \
    --query 'Service.Arn' --output text)

  adot_java_image_tag=$(curl -s -I -L 'https://github.com/aws-observability/aws-otel-java-instrumentation/releases/latest' | grep -i Location | awk -F'/tag/' '{print $2}' | tr -d '\r')
  adot_java_image="public.ecr.aws/aws-observability/adot-autoinstrumentation-java:$adot_java_image_tag"
  sed -i '' "s|\"adot-java-image\"|\"${adot_java_image}\"|" ./sample-app/task-definitions/spring-petclinic-visits-service.json
  sed -i '' "s|\"visits-service-image\"|\"${ECR_IMAGE_PREFIX}/springcommunity/spring-petclinic-visits-service\"|" ./sample-app/task-definitions/spring-petclinic-visits-service.json
  sed -i '' "s|us-west-2|${REGION}|g" ./sample-app/task-definitions/spring-petclinic-visits-service.json
  sed -i '' "s|000111222333|${ACCOUNT_ID}|g" ./sample-app/task-definitions/spring-petclinic-visits-service.json

  aws ecs register-task-definition --cli-input-json file://sample-app/task-definitions/spring-petclinic-visits-service.json > /dev/null

  aws ecs create-service \
      --service-name visits-service \
      --task-definition visits-service \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[$(echo $SUBNET_IDS | tr -s ' ' ',')],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}" \
      --service-registries registryArn=$registryArn \
      --cluster $CLUSTER > /dev/null

  echo "Waiting for the Visits server to be accessible..."
  sleep 180
}

function create_database() {
  # Create a database subnet group
  db_subnet_group_name="my-db-subnet-group"
  aws rds create-db-subnet-group --db-subnet-group-name $db_subnet_group_name --db-subnet-group-description "Subnet group for RDS" --subnet-ids $SUBNET_IDS > /dev/null

  # Wait for the DB subnet group to be available (assumed immediate availability after creation)
  echo "DB subnet group created and ready to use."

  # Create the DB instance using the new DB subnet group
  db_instance_identifier="petclinic-python"
  master_username="djangouser"
  master_password="asdfqwer"
  echo "the password for the database is: $master_password"

  security_group=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$SG_NAME" --query 'SecurityGroups[*].GroupId' --output text)

  aws rds create-db-instance \
      --db-instance-identifier $db_instance_identifier \
      --db-instance-class db.t3.micro \
      --engine postgres \
      --engine-version "14" \
      --allocated-storage 20 \
      --master-username $master_username \
      --master-user-password "asdfqwer" \
      --db-subnet-group-name $db_subnet_group_name \
      --vpc-security-group-ids $security_group \
      --no-multi-az \
      --backup-retention-period 0 \
      --tags Key=Name,Value=$db_instance_identifier \
      --output text

  echo "DB instance creation initiated..."

  # Wait for the DB instance to be ready
  echo "Waiting for DB instance to become available..."
  aws rds wait db-instance-available --db-instance-identifier $db_instance_identifier

  echo "DB instance is now available."

  # allow ec2 to connect to database
  aws ec2 authorize-security-group-ingress \
    --group-id $security_group \
    --protocol tcp \
    --port 5432 \
    --source-group $security_group

}

function run_insurance_service() {
  namespace_id=$(aws servicediscovery list-namespaces --query "Namespaces[?Name=='ecs-petclinic'].Id" --output text)

  insurance_service_id=$(aws servicediscovery create-service \
      --name insurance-service \
      --dns-config "NamespaceId=$namespace_id,RoutingPolicy=WEIGHTED,DnsRecords=[{Type=A,TTL=300}]" \
      --health-check-custom-config FailureThreshold=2 \
      --query "Service.Id" --output text)

  registryArn=$(aws servicediscovery get-service \
    --id $insurance_service_id \
    --query 'Service.Arn' --output text)

  adot_python_image_tag=$(curl -s -I -L 'https://github.com/aws-observability/aws-otel-python-instrumentation/releases/latest' | grep -i Location | awk -F'/tag/' '{print $2}' | tr -d '\r')
  adot_python_image="public.ecr.aws/aws-observability/adot-autoinstrumentation-python:$adot_python_image_tag"
  sed -i '' "s|\"adot-python-image\"|\"${adot_python_image}\"|" ./sample-app/task-definitions/spring-petclinic-insurance-service.json
  sed -i '' "s|\"insurance-service-image\"|\"${ECR_IMAGE_PREFIX}/python-petclinic-insurance-service\"|" ./sample-app/task-definitions/spring-petclinic-insurance-service.json
  sed -i '' "s|us-west-2|${REGION}|g" ./sample-app/task-definitions/spring-petclinic-insurance-service.json
  sed -i '' "s|000111222333|${ACCOUNT_ID}|g" ./sample-app/task-definitions/spring-petclinic-insurance-service.json

  rds_endpoint=`aws rds describe-db-instances --db-instance-identifier petclinic-python --query "DBInstances[*].Endpoint.Address" --output text`
  sed -i '' "s|\"db_service_host\"|\"${rds_endpoint}\"|" ./sample-app/task-definitions/spring-petclinic-insurance-service.json

  aws ecs register-task-definition --cli-input-json file://sample-app/task-definitions/spring-petclinic-insurance-service.json > /dev/null

  aws ecs create-service \
      --service-name insurance-service \
      --task-definition insurance-service \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[$(echo $SUBNET_IDS | tr -s ' ' ',')],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}" \
      --service-registries registryArn=$registryArn \
      --cluster $CLUSTER > /dev/null

  echo "Waiting for the Insurance server to be accessible..."
  sleep 180
}

function run_billing_service() {
  namespace_id=$(aws servicediscovery list-namespaces --query "Namespaces[?Name=='ecs-petclinic'].Id" --output text)

  billing_service_id=$(aws servicediscovery create-service \
      --name billing-service \
      --dns-config "NamespaceId=$namespace_id,RoutingPolicy=WEIGHTED,DnsRecords=[{Type=A,TTL=300}]" \
      --health-check-custom-config FailureThreshold=2 \
      --query "Service.Id" --output text)

  registryArn=$(aws servicediscovery get-service \
    --id $billing_service_id \
    --query 'Service.Arn' --output text)

  adot_python_image_tag=$(curl -s -I -L 'https://github.com/aws-observability/aws-otel-python-instrumentation/releases/latest' | grep -i Location | awk -F'/tag/' '{print $2}' | tr -d '\r')
  adot_python_image="public.ecr.aws/aws-observability/adot-autoinstrumentation-python:$adot_python_image_tag"
  sed -i '' "s|\"adot-python-image\"|\"${adot_python_image}\"|" ./sample-app/task-definitions/spring-petclinic-billing-service.json
  sed -i '' "s|\"billing-service-image\"|\"${ECR_IMAGE_PREFIX}/python-petclinic-billing-service\"|" ./sample-app/task-definitions/spring-petclinic-billing-service.json
  sed -i '' "s|us-west-2|${REGION}|g" ./sample-app/task-definitions/spring-petclinic-billing-service.json
  sed -i '' "s|000111222333|${ACCOUNT_ID}|g" ./sample-app/task-definitions/spring-petclinic-billing-service.json

  rds_endpoint=`aws rds describe-db-instances --db-instance-identifier petclinic-python --query "DBInstances[*].Endpoint.Address" --output text`
  sed -i '' "s|\"db_service_host\"|\"${rds_endpoint}\"|" ./sample-app/task-definitions/spring-petclinic-billing-service.json

  aws ecs register-task-definition --cli-input-json file://sample-app/task-definitions/spring-petclinic-billing-service.json > /dev/null

  aws ecs create-service \
      --service-name billing-service \
      --task-definition billing-service \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[$(echo $SUBNET_IDS | tr -s ' ' ',')],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}" \
      --service-registries registryArn=$registryArn \
      --cluster $CLUSTER > /dev/null

  echo "Waiting for the Billing server to be accessible..."
  sleep 180
}

function generate_traffic() {
  sed -i '' "s|\"discovery-server-url\"|\"http://${LOAD_BALANCER_DNS}:8080\"|" ./sample-app/task-definitions/traffic-generator.json
  sed -i '' "s|\"traffic-generator-image\"|\"${ECR_IMAGE_PREFIX}/traffic-generator\"|" ./sample-app/task-definitions/traffic-generator.json
  sed -i '' "s|us-west-2|${REGION}|g" ./sample-app/task-definitions/traffic-generator.json

  aws ecs register-task-definition --cli-input-json file://sample-app/task-definitions/traffic-generator.json > /dev/null

  aws ecs create-service \
      --service-name traffic-generator \
      --task-definition traffic-generator \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[$(echo $SUBNET_IDS | tr -s ' ' ',')],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}" \
      --cluster $CLUSTER > /dev/null

  echo "Waiting for the traffic generator..."
  sleep 120
}

function print_url() {
  echo "Visit the sample app at this url: http://${LOAD_BALANCER_DNS}:8080"
}

function delete_traffic() {
      echo "Deleting resources..."
      # Delete the ECS service
      aws ecs update-service \
          --cluster $CLUSTER \
          --service traffic-generator \
          --desired-count 0 > /dev/null

      aws ecs delete-service \
          --cluster $CLUSTER \
          --service traffic-generator \
          --force > /dev/null
      echo "ECS service deleted."

      # Get all task definitions for the specified family
      TASK_DEFINITIONS=$(aws ecs list-task-definitions --family-prefix traffic-generator --query "taskDefinitionArns" --output text)

      # Loop through each task definition and deregister it
      for TASK_DEF in $TASK_DEFINITIONS; do
          aws ecs deregister-task-definition --task-definition $TASK_DEF > /dev/null
      done

      echo "All resources deleted."
}

function delete_billing_service() {
      echo "Deleting resources..."
      # Delete the ECS service
      aws ecs update-service \
          --cluster $CLUSTER \
          --service billing-service \
          --desired-count 0 > /dev/null

      aws ecs delete-service \
          --cluster $CLUSTER \
          --service billing-service \
          --force > /dev/null

      # Wait for the service to be deleted
      while true; do
          STATUS=$(aws ecs describe-services \
              --cluster $CLUSTER \
              --services billing-service \
              --query 'services[0].status' \
              --output text)

          if [ "$STATUS" == "INACTIVE" ] || [ "$STATUS" == "None" ]; then
              echo "billing service deleted successfully."
              break
          else
              echo "Waiting for service deletion..."
              sleep 20
          fi
      done

      # Get all task definitions for the specified family
      TASK_DEFINITIONS=$(aws ecs list-task-definitions --family-prefix billing-service --query "taskDefinitionArns" --output text)

      # Loop through each task definition and deregister it
      for TASK_DEF in $TASK_DEFINITIONS; do
          aws ecs deregister-task-definition --task-definition $TASK_DEF > /dev/null
      done

      billing_service_id=$(aws servicediscovery list-services \
         --query "Services[?Name=='billing-service'].Id" \
         --output text)

      aws servicediscovery delete-service --id $billing_service_id

      echo "All resources deleted."
}

function delete_insurance_service() {
      echo "Deleting resources..."
      # Delete the ECS service
      aws ecs update-service \
          --cluster $CLUSTER \
          --service insurance-service \
          --desired-count 0 > /dev/null

      aws ecs delete-service \
          --cluster $CLUSTER \
          --service insurance-service \
          --force > /dev/null

      while true; do
          STATUS=$(aws ecs describe-services \
              --cluster $CLUSTER \
              --services insurance-service \
              --query 'services[0].status' \
              --output text)

          if [ "$STATUS" == "INACTIVE" ] || [ "$STATUS" == "None" ]; then
              echo "insurance service deleted successfully."
              break
          else
              echo "Waiting for service deletion..."
              sleep 20
          fi
      done

      # Get all task definitions for the specified family
      TASK_DEFINITIONS=$(aws ecs list-task-definitions --family-prefix insurance-service --query "taskDefinitionArns" --output text)

      # Loop through each task definition and deregister it
      for TASK_DEF in $TASK_DEFINITIONS; do
          aws ecs deregister-task-definition --task-definition $TASK_DEF > /dev/null
      done

      insurance_service_id=$(aws servicediscovery list-services \
         --query "Services[?Name=='insurance-service'].Id" \
         --output text)

      aws servicediscovery delete-service --id $insurance_service_id

      echo "All resources deleted."
}

function delete_database() {
    # Configuration variables
    db_instance_identifier="petclinic-python"
    db_subnet_group_name="my-db-subnet-group"
    security_group=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$SG_NAME" --query 'SecurityGroups[*].GroupId' --output text)

    # Step 1: Delete the RDS instance
    echo "Deleting DB instance..."
    aws rds delete-db-instance \
        --db-instance-identifier $db_instance_identifier \
        --skip-final-snapshot  \
        --output text

    # Wait for the DB instance to be completely deleted
    echo "Waiting for DB instance to be deleted..."
    aws rds wait db-instance-deleted --db-instance-identifier $db_instance_identifier

    # Step 2: Delete the DB subnet group
    echo "Deleting DB subnet group..."
    aws rds delete-db-subnet-group --db-subnet-group-name $db_subnet_group_name

    # Step 3: Revoke security group ingress (if necessary)
    echo "Revoking security group ingress rules..."
    aws ec2 revoke-security-group-ingress \
        --group-id $security_group \
        --protocol tcp \
        --port 5432 \
        --source-group $security_group

    echo "All specified database resources have been deleted."
}

function delete_visits_service() {
      echo "Deleting resources..."
      # Delete the ECS service
      aws ecs update-service \
          --cluster $CLUSTER \
          --service visits-service \
          --desired-count 0 > /dev/null

      aws ecs delete-service \
          --cluster $CLUSTER \
          --service visits-service \
          --force > /dev/null

      while true; do
          STATUS=$(aws ecs describe-services \
              --cluster $CLUSTER \
              --services visits-service \
              --query 'services[0].status' \
              --output text)

          if [ "$STATUS" == "INACTIVE" ] || [ "$STATUS" == "None" ]; then
              echo "visits service deleted successfully."
              break
          else
              echo "Waiting for service deletion..."
              sleep 20
          fi
      done

      # Get all task definitions for the specified family
      TASK_DEFINITIONS=$(aws ecs list-task-definitions --family-prefix visits-service --query "taskDefinitionArns" --output text)

      # Loop through each task definition and deregister it
      for TASK_DEF in $TASK_DEFINITIONS; do
          aws ecs deregister-task-definition --task-definition $TASK_DEF > /dev/null
      done

      service_discovery_id=$(aws servicediscovery list-services \
         --query "Services[?Name=='visits-service'].Id" \
         --output text)

      aws servicediscovery delete-service --id $service_discovery_id

      echo "All resources deleted."
}

function delete_customers_service() {
      echo "Deleting resources..."
      # Delete the ECS service
      aws ecs update-service \
          --cluster $CLUSTER \
          --service customers-service \
          --desired-count 0 > /dev/null

      aws ecs delete-service \
          --cluster $CLUSTER \
          --service customers-service \
          --force > /dev/null

      while true; do
          STATUS=$(aws ecs describe-services \
              --cluster $CLUSTER \
              --services customers-service \
              --query 'services[0].status' \
              --output text)

          if [ "$STATUS" == "INACTIVE" ] || [ "$STATUS" == "None" ]; then
              echo "customers service deleted successfully."
              break
          else
              echo "Waiting for service deletion..."
              sleep 20
          fi
      done

      # Get all task definitions for the specified family
      TASK_DEFINITIONS=$(aws ecs list-task-definitions --family-prefix customers-service --query "taskDefinitionArns" --output text)

      # Loop through each task definition and deregister it
      for TASK_DEF in $TASK_DEFINITIONS; do
          aws ecs deregister-task-definition --task-definition $TASK_DEF > /dev/null
      done

      service_discovery_id=$(aws servicediscovery list-services \
         --query "Services[?Name=='customers-service'].Id" \
         --output text)

      aws servicediscovery delete-service --id $service_discovery_id

      echo "All resources deleted."
}

function delete_vets_service() {
      echo "Deleting resources..."
      # Delete the ECS service
      aws ecs update-service \
          --cluster $CLUSTER \
          --service vets-service \
          --desired-count 0 > /dev/null

      aws ecs delete-service \
          --cluster $CLUSTER \
          --service vets-service \
          --force > /dev/null

      while true; do
          STATUS=$(aws ecs describe-services \
              --cluster $CLUSTER \
              --services vets-service \
              --query 'services[0].status' \
              --output text)

          if [ "$STATUS" == "INACTIVE" ] || [ "$STATUS" == "None" ]; then
              echo "customers service deleted successfully."
              break
          else
              echo "Waiting for service deletion..."
              sleep 20
          fi
      done

      # Get all task definitions for the specified family
      TASK_DEFINITIONS=$(aws ecs list-task-definitions --family-prefix vets-service --query "taskDefinitionArns" --output text)

      # Loop through each task definition and deregister it
      for TASK_DEF in $TASK_DEFINITIONS; do
          aws ecs deregister-task-definition --task-definition $TASK_DEF > /dev/null
      done

      service_discovery_id=$(aws servicediscovery list-services \
         --query "Services[?Name=='vets-service'].Id" \
         --output text)

      aws servicediscovery delete-service --id $service_discovery_id

      echo "All resources deleted."
}

function delete_api_gateway() {
      echo "Deleting resources..."
      # Get all task definitions for the specified family
      TASK_DEFINITIONS=$(aws ecs list-task-definitions --family-prefix api-gateway --query "taskDefinitionArns" --output text)

      # Loop through each task definition and deregister it
      for TASK_DEF in $TASK_DEFINITIONS; do
          aws ecs deregister-task-definition --task-definition $TASK_DEF > /dev/null
      done


      # Delete the ECS service
      aws ecs update-service \
          --cluster $CLUSTER \
          --service api-gateway \
          --desired-count 0 > /dev/null

      aws ecs delete-service \
          --cluster $CLUSTER \
          --service api-gateway \
          --force > /dev/null
      echo "ECS service deleted."

      # Get the listener ARN
      listener_arn=$(aws elbv2 describe-listeners \
          --load-balancer-arn $LOAD_BALANCER_ARN \
          --query "Listeners[?Port==\`8080\`].ListenerArn" \
          --output text)

      api_gateway_target_group_arn=$(aws elbv2 describe-listeners \
          --listener-arns $listener_arn \
          --query "Listeners[0].DefaultActions[0].TargetGroupArn" \
          --output text)

      # Delete the listener
      if [ -n "$listener_arn" ]; then
          aws elbv2 delete-listener \
              --listener-arn $listener_arn > /dev/null
          echo "Listener deleted."
      fi

      # Delete the target group
      aws elbv2 delete-target-group \
          --target-group-arn $api_gateway_target_group_arn > /dev/null
      echo "Target group deleted."

      echo "All resources deleted."
}

function delete_admin_server() {
      echo "Deleting resources..."
      # Delete the ECS service
      aws ecs update-service \
          --cluster $CLUSTER \
          --service admin-server \
          --desired-count 0 > /dev/null

      aws ecs delete-service \
          --cluster $CLUSTER \
          --service admin-server \
          --force > /dev/null
      echo "ECS service deleted."

      while true; do
          STATUS=$(aws ecs describe-services \
              --cluster $CLUSTER \
              --services admin-server \
              --query 'services[0].status' \
              --output text)

          if [ "$STATUS" == "INACTIVE" ] || [ "$STATUS" == "None" ]; then
              echo "admin service deleted successfully."
              break
          else
              echo "Waiting for service deletion..."
              sleep 20
          fi
      done

      # Get all task definitions for the specified family
      TASK_DEFINITIONS=$(aws ecs list-task-definitions --family-prefix admin-server --query "taskDefinitionArns" --output text)

      # Loop through each task definition and deregister it
      for TASK_DEF in $TASK_DEFINITIONS; do
          aws ecs deregister-task-definition --task-definition $TASK_DEF > /dev/null
      done

      service_discovery_id=$(aws servicediscovery list-services \
         --query "Services[?Name=='admin-server'].Id" \
         --output text)

      aws servicediscovery delete-service --id $service_discovery_id
}

function delete_discovery_server() {
      echo "Deleting resources..."
      # Delete the ECS service
      aws ecs update-service \
          --cluster $CLUSTER \
          --service discovery-server \
          --desired-count 0 > /dev/null

      aws ecs delete-service \
          --cluster $CLUSTER \
          --service discovery-server \
          --force > /dev/null
      echo "ECS service deleted."

      while true; do
          STATUS=$(aws ecs describe-services \
              --cluster $CLUSTER \
              --services discovery-server \
              --query 'services[0].status' \
              --output text)

          if [ "$STATUS" == "INACTIVE" ] || [ "$STATUS" == "None" ]; then
              echo "discovery service deleted successfully."
              break
          else
              echo "Waiting for service deletion..."
              sleep 20
          fi
      done

      # Get all task definitions for the specified family
      TASK_DEFINITIONS=$(aws ecs list-task-definitions --family-prefix discovery-server --query "taskDefinitionArns" --output text)

      # Loop through each task definition and deregister it
      for TASK_DEF in $TASK_DEFINITIONS; do
          aws ecs deregister-task-definition --task-definition $TASK_DEF > /dev/null
      done

      service_discovery_id=$(aws servicediscovery list-services \
         --query "Services[?Name=='discovery-server'].Id" \
         --output text)

      aws servicediscovery delete-service --id $service_discovery_id

      echo "All resources deleted."
}

function delete_config_server() {
      echo "Deleting resources..."
      # Delete the ECS service
      aws ecs update-service \
          --cluster $CLUSTER \
          --service config-server \
          --desired-count 0 > /dev/null

      aws ecs delete-service \
          --cluster $CLUSTER \
          --service config-server \
          --force > /dev/null
      echo "ECS service deleted."

      while true; do
          STATUS=$(aws ecs describe-services \
              --cluster $CLUSTER \
              --services config-server \
              --query 'services[0].status' \
              --output text)

          if [ "$STATUS" == "INACTIVE" ] || [ "$STATUS" == "None" ]; then
              echo "config server deleted successfully."
              break
          else
              echo "Waiting for service deletion..."
              sleep 20
          fi
      done

      # Get all task definitions for the specified family
      TASK_DEFINITIONS=$(aws ecs list-task-definitions --family-prefix config-server --query "taskDefinitionArns" --output text)

      # Loop through each task definition and deregister it
      for TASK_DEF in $TASK_DEFINITIONS; do
          aws ecs deregister-task-definition --task-definition $TASK_DEF > /dev/null
      done

      service_discovery_id=$(aws servicediscovery list-services \
         --query "Services[?Name=='config-server'].Id" \
         --output text)

      aws servicediscovery delete-service --id $service_discovery_id

      echo "All resources deleted."
}

function delete_resources() {
    echo "Deleting resources..."

    while true; do
      remaining_services=$(aws ecs list-services --cluster ${CLUSTER} --query 'serviceArns' --output text)
      if [ -z "$remaining_services" ]; then
        echo "All services deleted."
        break
      else
        echo "Still waiting for services to be deleted..."
        sleep 5
      fi
    done

    aws ecs delete-cluster --cluster ${CLUSTER}

    namespace_id=$(aws servicediscovery list-namespaces \
             --query "Namespaces[?Name=='ecs-petclinic'].Id" --output text)
    aws servicediscovery delete-namespace --id $namespace_id

    # Detach and delete IAM policies for ECS Task role
    task_role_policy_arns=("arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess" "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess" "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy" "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceRole" "arn:aws:iam::aws:policy/AmazonECS_FullAccess" "arn:aws:iam::aws:policy/AmazonSQSFullAccess" "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess")
    for arn in "${task_role_policy_arns[@]}"
    do
      echo $arn
      aws iam detach-role-policy --role-name $IAM_TASK_ROLE_NAME --policy-arn $arn
    done
    aws iam delete-role --role-name $IAM_TASK_ROLE_NAME

    # Detach and delete IAM policies for ECS Task Execution role
    task_execution_role_policy_arns=("arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess" "arn:aws:iam::aws:policy/AmazonBedrockFullAccess" "arn:aws:iam::aws:policy/AmazonKinesisFullAccess" "arn:aws:iam::aws:policy/AmazonS3FullAccess" "arn:aws:iam::aws:policy/AmazonSQSFullAccess" "arn:aws:iam::aws:policy/AmazonRDSFullAccess" "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy" "arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess" "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy" "arn:aws:iam::aws:policy/AmazonECS_FullAccess")
    for arn in "${task_execution_role_policy_arns[@]}"
    do
      echo $arn
      aws iam detach-role-policy --role-name $IAM_EXECUTION_ROLE_NAME --policy-arn $arn
    done
    aws iam delete-role --role-name $IAM_EXECUTION_ROLE_NAME

    LOAD_BALANCER_ARN=$(aws elbv2 describe-load-balancers \
        --names $LOAD_BALANCER_NAME \
        --query "LoadBalancers[0].LoadBalancerArn" \
        --output text)

    aws elbv2 delete-load-balancer --load-balancer-arn $LOAD_BALANCER_ARN
    aws elbv2 wait load-balancers-deleted --load-balancer-arns $LOAD_BALANCER_ARN
    sleep 30
    echo "Load balancer deleted: $LOAD_BALANCER_ARN"

    # Delete security groups
    sg_id=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$SG_NAME" --query 'SecurityGroups[0].GroupId' --output text)
    if [ ! -z "$sg_id" ]; then
      aws ec2 delete-security-group --group-id $sg_id
      echo "Security group deleted: $sg_id"
    fi

    echo "Resource deletion complete."
}

# Execute based on operation
if [ "$OPERATION" == "delete" ]; then
    delete_traffic
    delete_billing_service
    delete_insurance_service
    delete_database
    delete_visits_service
    delete_customers_service
    delete_vets_service
    delete_api_gateway
    delete_admin_server
    delete_discovery_server
    delete_config_server
    delete_resources
else
    create_resources
    run_config_server
    run_discovery_server
    run_admin_server
    run_api_gateway
    run_vets_service
    run_customers_service
    run_visits_service
    create_database
    run_insurance_service
    run_billing_service
    generate_traffic
    print_url

fi


#  cd scripts/ecs/appsignals
#./setup-ecs-demo.sh --region=us-west-2
#./setup-ecs-demo.sh --operation=delete --region=us-west-2
#./mvnw clean install -P buildDocker -pl spring-petclinic-admin-server,spring-petclinic-api-gateway -am -DskipTests
#./mvnw clean install -P buildDocker -pl spring-petclinic-customers-service,spring-petclinic-visits-service -am -DskipTests
#./push-public-ecr.sh
