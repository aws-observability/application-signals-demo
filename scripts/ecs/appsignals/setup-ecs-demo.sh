#!/bin/bash
set -ex

# Default values
DEFAULT_REGION="us-east-1"
DEFAULT_CLUSTER="ecs-pet-clinic-demo-cluster"
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
SG_NAME="ec2-demo-security-group"
IAM_TASK_ROLE_NAME="ecs-demo-task-role-${REGION}"
IAM_EXECUTION_ROLE_NAME="ec2-demo-execution-role-${REGION}"
INSTANCE_PROFILE="ec2-demo-instance-profile"
INSTANCE_NAMES=("setup" "pet-clinic-frontend" "vets" "customers" "visits" "insurances" "billings")
KEY_NAME="ec2-demo-key-pair"
CLOUDWATCH_AGENT_DOWNLOAD_URL="https://amazoncloudwatch-agent.s3.amazonaws.com/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm"
JAVA_INSTRUMENTATION_AGENT_DOWNLOAD_URL="https://github.com/aws-observability/aws-otel-java-instrumentation/releases/latest/download/aws-opentelemetry-agent.jar"

master_password=$(LC_ALL=C tr -dc 'A-Za-z0-9_' < /dev/urandom | head -c 10; echo)
echo $master_password > master_password.txt


function create_resources() {
    echo "Creating resources..."

    # Get the default VPC
    vpc_id=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query 'Vpcs[0].VpcId' --output text)

    # Get two subnets in the default VPC
    subnet_ids=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_id" --query "join(',', sort_by(Subnets, &AvailabilityZone)[0:2].SubnetId)" --output text)

    # TODO
    # Create a security group
    sg_id=$(aws ec2 create-security-group --group-name $SG_NAME --description "Security group for all traffic" --vpc-id $vpc_id --query 'GroupId' --output text)
    aws ec2 authorize-security-group-ingress --group-id $sg_id --protocol all --cidr 0.0.0.0/0

    # Create an ECS Task role and attach policies
    aws iam attach-role-policy --role-name $IAM_TASK_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess"
    aws iam attach-role-policy --role-name $IAM_TASK_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
    aws iam attach-role-policy --role-name $IAM_TASK_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
    aws iam attach-role-policy --role-name $IAM_TASK_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceRole"

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

    # Creat ECS cluster
    aws ecs create-cluster --cluster-name ${CLUSTER}-${REGION}

}


function delete_resources() {
    echo "Deleting resources..."

    aws ecs delete-cluster --cluster ${CLUSTER}-${REGION}

    # Detach and delete IAM policies for ECS Task role
    task_role_policy_arns=("arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess" "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess" "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy" "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceRole")
    for arn in "${task_role_policy_arns[@]}"
    do
      echo $arn
      aws iam detach-role-policy --role-name $IAM_TASK_ROLE_NAME --policy-arn $arn
    done
    aws iam delete-role --role-name $IAM_TASK_ROLE_NAME

    # Detach and delete IAM policies for ECS Task Execution role
    task_execution_role_policy_arns=("arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess" "arn:aws:iam::aws:policy/AmazonBedrockFullAccess" "arn:aws:iam::aws:policy/AmazonKinesisFullAccess" "arn:aws:iam::aws:policy/AmazonS3FullAccess" "arn:aws:iam::aws:policy/AmazonSQSFullAccess" "arn:aws:iam::aws:policy/AmazonRDSFullAccess" "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy" "arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess" "arn:aws:iam::aws:policy/AmazonBedrockFullAccess" "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy")
    for arn in "${task_execution_role_policy_arns[@]}"
    do
      echo $arn
      aws iam detach-role-policy --role-name $IAM_EXECUTION_ROLE_NAME --policy-arn $arn
    done
    aws iam delete-role --role-name $IAM_EXECUTION_ROLE_NAME

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
    delete_resources
else
    create_resources
#    run_setup
#    run_pet_clinic_frontend
#    run_vets
#    run_customers
#    run_visits
#    create_database
#    run_insurances
#    run_billings
#    generate_traffic
#    print_url
fi

#  cd scripts/ecs/appsignals
#./setup-ecs-demo.sh --cluster test_ecs-pet_clinic-demo --region=us-west-2
#./setup-ecs-demo.sh --operation=delete --cluster test_ecs-pet_clinic-demo --region=us-west-2