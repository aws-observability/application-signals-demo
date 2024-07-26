#!/bin/bash
set -ex 

# Default values
DEFAULT_REGION="us-east-1"
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
    *)
          # unknown option
    ;;
esac
done

# Set region with provided value or default
REGION="${REGION:-$DEFAULT_REGION}"

export AWS_DEFAULT_REGION=$REGION

# Variables
SG_NAME="ec2-demo-security-group"
IAM_ROLE_NAME="ec2-demo-role-${REGION}"
INSTANCE_PROFILE="ec2-demo-instance-profile"
INSTANCE_NAMES=("setup" "pet-clinic-frontend" "vets" "customers" "visits" "insurances" "billings")
KEY_NAME="ec2-demo-key-pair"
CLOUDWATCH_AGENT_DOWNLOAD_URL="https://amazoncloudwatch-agent.s3.amazonaws.com/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm"
JAVA_INSTRUMENTATION_AGENT_DOWNLOAD_URL="https://github.com/aws-observability/aws-otel-java-instrumentation/releases/latest/download/aws-opentelemetry-agent.jar"

master_password=$(LC_ALL=C tr -dc 'A-Za-z0-9_' < /dev/urandom | head -c 10; echo)
echo $master_password > master_password.txt

function create_resources() {
    echo "Creating resources..."

    # Fetch the latest Amazon Linux 2 AMI ID
    IMAGE_ID=$(aws ec2 describe-images \
      --region $REGION \
      --owners amazon \
      --filters "Name=name,Values=al2023-ami-minimal-*-x86_64" "Name=state,Values=available" \
      --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
      --output text)

    # Get the default VPC
    vpc_id=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query 'Vpcs[0].VpcId' --output text)

    # Get two subnets in the default VPC
    subnet_ids=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_id" --query "join(',', sort_by(Subnets, &AvailabilityZone)[0:2].SubnetId)" --output text)

    # TODO
    # Create a security group
    sg_id=$(aws ec2 create-security-group --group-name $SG_NAME --description "Security group for all traffic" --vpc-id $vpc_id --query 'GroupId' --output text)
    aws ec2 authorize-security-group-ingress --group-id $sg_id --protocol all --cidr 0.0.0.0/0
    
    # Create an IAM role and attach policies
    aws iam create-role --role-name $IAM_ROLE_NAME --assume-role-policy-document file://trust-policy.json
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonKinesisFullAccess"
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonS3FullAccess"
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonRDSFullAccess"
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess"
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonBedrockFullAccess"

    # Create instance profile
    aws iam create-instance-profile --instance-profile-name $INSTANCE_PROFILE
    aws iam add-role-to-instance-profile --instance-profile-name $INSTANCE_PROFILE --role-name $IAM_ROLE_NAME
    sleep 30 #wait for the instance profile to be ready


    # Create the key pair for SSH
    aws ec2 create-key-pair --key-name "${KEY_NAME}" --query 'KeyMaterial' --output text > "${KEY_NAME}.pem"
    chmod 400  "${KEY_NAME}.pem"

    # List of all instance IDs
    declare -a instance_ids=()

    # Create EC2 instances
    for name in "${INSTANCE_NAMES[@]}"
    do
      if [ "$name" == "visits" ]; then
        # Create ASG for 'visits'
        asg_name="asg-$name"
        launch_template_name="lt-$name"
        
        # Create Launch Template
        aws ec2 create-launch-template --launch-template-name $launch_template_name --version-description "1" --launch-template-data "{
          \"ImageId\":\"$IMAGE_ID\",
          \"InstanceType\":\"t3.medium\",
          \"KeyName\":\"$KEY_NAME\",
          \"IamInstanceProfile\":{
            \"Name\":\"$INSTANCE_PROFILE\"
          },
          \"NetworkInterfaces\":[
            {
              \"AssociatePublicIpAddress\":true,
              \"DeviceIndex\":0,
              \"Groups\":[\"$sg_id\"]
            }
          ]
        }"
        
        # Create Auto Scaling Group
        aws autoscaling create-auto-scaling-group --auto-scaling-group-name $asg_name --launch-template "LaunchTemplateName=$launch_template_name,Version=1" --min-size 1 --max-size 1 --desired-capacity 1 --vpc-zone-identifier "$subnet_ids"    

        # Wait until the instance is running
        instance_id=$(aws autoscaling describe-auto-scaling-instances --query "AutoScalingInstances[?AutoScalingGroupName=='$asg_name'].InstanceId" --output text)
        while [ -z "$instance_id" ]; do
          sleep 5
          instance_id=$(aws autoscaling describe-auto-scaling-instances --query "AutoScalingInstances[?AutoScalingGroupName=='$asg_name'].InstanceId" --output text)
        done
    
        # Tag the instance
        aws ec2 create-tags --resources $instance_id --tags Key=Name,Value=$name
        instance_ids+=($instance_id)

      else
        instance_id=$(aws ec2 run-instances --image-id $IMAGE_ID --count 1 --instance-type t3.medium --key-name $KEY_NAME --security-group-ids $sg_id  --iam-instance-profile Name=$INSTANCE_PROFILE --associate-public-ip-address --query 'Instances[0].InstanceId' --output text)
        aws ec2 create-tags --resources $instance_id --tags Key=Name,Value=$name
        instance_ids+=($instance_id)
      fi
    done

        # Wait for all instances to be in the 'running' state
    for id in "${instance_ids[@]}"
    do
        echo "Checking instance: $id"
        aws ec2 wait instance-status-ok --instance-ids $id
        echo "Instance $id is running."
    done

    echo "All instances are up and running."

}

function create_database() {
  # Fetch the default VPC ID
  vpc_id=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query 'Vpcs[0].VpcId' --output text)

  # Get two subnets in the default VPC
  subnet_ids=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_id" --query "sort_by(Subnets, &AvailabilityZone)[0:2].SubnetId" --output text | tr '\n' ',' | sed 's/,$//')

  # Create a database subnet group
  db_subnet_group_name="my-db-subnet-group"
  aws rds create-db-subnet-group --db-subnet-group-name $db_subnet_group_name --db-subnet-group-description "Subnet group for RDS" --subnet-ids $subnet_ids

  # Wait for the DB subnet group to be available (assumed immediate availability after creation)
  echo "DB subnet group created and ready to use."

  # Create the DB instance using the new DB subnet group
  db_instance_identifier="petclinic-python"
  master_username="root"
  echo "the password for the database is: $master_password"

  security_group=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$SG_NAME" --query 'SecurityGroups[*].GroupId' --output text)

  aws rds create-db-instance \
      --db-instance-identifier $db_instance_identifier \
      --db-instance-class db.t3.micro \
      --engine postgres \
      --engine-version "14" \
      --allocated-storage 20 \
      --master-username $master_username \
      --master-user-password $master_password \
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

function run_setup() {
  # Retrieve public IP of 'setup' instance
  setup_ip=$(aws ec2 describe-instances \
      --filters "Name=tag:Name,Values=setup" "Name=instance-state-name,Values=running" \
      --query "Reservations[*].Instances[*].PublicIpAddress" \
      --output text)

  # SSH and run commands on the setup instance
  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip <<EOF
      sudo yum install java-17-amazon-corretto-devel git tmux wget -y &&
      git clone https://github.com/aws-observability/application-signals-demo.git &&
      cd application-signals-demo/ && 
      ./mvnw clean install -pl spring-petclinic-config-server,spring-petclinic-discovery-server,spring-petclinic-admin-server -am -DskipTests &&
      cd scripts/ec2/appsignals &&
      wget $CLOUDWATCH_AGENT_DOWNLOAD_URL &&
      sudo rpm -U ./amazon-cloudwatch-agent.rpm &&
      sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:cloudwatch-agent.json
EOF

  # SSH again to start tmux session
  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip << 'EOF'
    tmux new -s config -d
    tmux send-keys -t config 'cd application-signals-demo/spring-petclinic-config-server/target/' C-m
    tmux send-keys -t config 'java -jar spring-petclinic-config-server*.jar' C-m
EOF

  sleep 20

  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip << 'EOF'
    tmux new -s discovery -d
    tmux send-keys -t discovery 'cd application-signals-demo/spring-petclinic-discovery-server/target/' C-m
    tmux send-keys -t discovery 'java -jar spring-petclinic-discovery-server*.jar' C-m
EOF
  
  sleep 20

  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip << 'EOF'
    tmux new -s admin -d
    tmux send-keys -t admin 'cd application-signals-demo/spring-petclinic-admin-server/target/' C-m
    tmux send-keys -t admin 'java -jar spring-petclinic-admin-server*.jar' C-m
EOF

  sleep 20
}

function run_pet_clinic_frontend() {
  PRIVATE_IP_OF_SETUP_INSTANCE=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=setup" "Name=instance-state-name,Values=running" \
    --query "Reservations[*].Instances[*].PrivateIpAddress" \
    --output text)

  # Retrieve public IP of the instance
  setup_ip=$(aws ec2 describe-instances \
      --filters "Name=tag:Name,Values=pet-clinic-frontend" "Name=instance-state-name,Values=running" \
      --query "Reservations[*].Instances[*].PublicIpAddress" \
      --output text)

  # SSH and run commands on the instance
  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip <<EOF
      sudo yum install java-17-amazon-corretto-devel git tmux wget -y &&
      git clone https://github.com/aws-observability/application-signals-demo.git &&
      cd application-signals-demo/ && 
      ./mvnw clean install -pl spring-petclinic-api-gateway -am -DskipTests &&
      cd scripts/ec2/appsignals &&
      wget $CLOUDWATCH_AGENT_DOWNLOAD_URL &&
      sudo rpm -U ./amazon-cloudwatch-agent.rpm &&
      sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:cloudwatch-agent.json
EOF

  service_name="pet-clinic-frontend-ec2-java"
  # SSH again to start tmux session
  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip << EOF
    tmux new -s frontend -d
    tmux send-keys -t frontend 'cd application-signals-demo/spring-petclinic-api-gateway/target/' C-m
    tmux send-keys -t frontend "wget $JAVA_INSTRUMENTATION_AGENT_DOWNLOAD_URL" C-m
    tmux send-keys -t frontend "export CONFIG_SERVER_URL=http://${PRIVATE_IP_OF_SETUP_INSTANCE}:8888" C-m
    tmux send-keys -t frontend "export DISCOVERY_SERVER_URL=http://${PRIVATE_IP_OF_SETUP_INSTANCE}:8761/eureka" C-m
    tmux send-keys -t frontend "export JAVA_TOOL_OPTIONS=' -javaagent:./aws-opentelemetry-agent.jar'" C-m
    tmux send-keys -t frontend "export OTEL_METRICS_EXPORTER=none" C-m
    tmux send-keys -t frontend "export OTEL_AWS_APP_SIGNALS_ENABLED=true" C-m
    tmux send-keys -t frontend "export OTEL_AWS_APP_SIGNALS_EXPORTER_ENDPOINT=http://localhost:4315" C-m
    tmux send-keys -t frontend "export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4315" C-m
    tmux send-keys -t frontend "export OTEL_RESOURCE_ATTRIBUTES=\"service.name=${service_name}\"" C-m
    tmux send-keys -t frontend "java -jar spring-petclinic-api*.jar" C-m
EOF

}

function run_vets() {
  PRIVATE_IP_OF_SETUP_INSTANCE=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=setup" "Name=instance-state-name,Values=running" \
    --query "Reservations[*].Instances[*].PrivateIpAddress" \
    --output text)

  # Retrieve public IP of the instance
  setup_ip=$(aws ec2 describe-instances \
      --filters "Name=tag:Name,Values=vets" "Name=instance-state-name,Values=running" \
      --query "Reservations[*].Instances[*].PublicIpAddress" \
      --output text)

  # SSH and run commands on the instance
  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip <<EOF
      sudo yum install java-17-amazon-corretto-devel git tmux wget -y &&
      git clone https://github.com/aws-observability/application-signals-demo.git &&
      cd application-signals-demo/ && 
      ./mvnw clean install -pl spring-petclinic-vets-service -am -DskipTests &&
      cd scripts/ec2/appsignals &&
      wget $CLOUDWATCH_AGENT_DOWNLOAD_URL &&
      sudo rpm -U ./amazon-cloudwatch-agent.rpm &&
      sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:cloudwatch-agent.json
EOF

  service_name="vets-service-ec2-java"
  # SSH again to start tmux session
  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip << EOF
    tmux new -s vets -d
    tmux send-keys -t vets 'cd application-signals-demo/spring-petclinic-vets-service/target/' C-m
    tmux send-keys -t vets  "wget $JAVA_INSTRUMENTATION_AGENT_DOWNLOAD_URL" C-m
    tmux send-keys -t vets  "export CONFIG_SERVER_URL=http://${PRIVATE_IP_OF_SETUP_INSTANCE}:8888" C-m
    tmux send-keys -t vets  "export DISCOVERY_SERVER_URL=http://${PRIVATE_IP_OF_SETUP_INSTANCE}:8761/eureka" C-m
    tmux send-keys -t vets  "export JAVA_TOOL_OPTIONS=' -javaagent:./aws-opentelemetry-agent.jar'" C-m
    tmux send-keys -t vets  "export OTEL_METRICS_EXPORTER=none" C-m
    tmux send-keys -t vets  "export OTEL_AWS_APP_SIGNALS_ENABLED=true" C-m
    tmux send-keys -t vets  "export OTEL_AWS_APP_SIGNALS_EXPORTER_ENDPOINT=http://localhost:4315" C-m
    tmux send-keys -t vets  "export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4315" C-m
    tmux send-keys -t vets  "export OTEL_RESOURCE_ATTRIBUTES=\"service.name=${service_name}\"" C-m
    tmux send-keys -t vets "java -jar spring-petclinic-vet*.jar" C-m
EOF

}


function run_customers() {
  PRIVATE_IP_OF_SETUP_INSTANCE=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=setup" "Name=instance-state-name,Values=running" \
    --query "Reservations[*].Instances[*].PrivateIpAddress" \
    --output text)

  # Retrieve public IP of the instance
  setup_ip=$(aws ec2 describe-instances \
      --filters "Name=tag:Name,Values=customers" "Name=instance-state-name,Values=running" \
      --query "Reservations[*].Instances[*].PublicIpAddress" \
      --output text)

  # SSH and run commands on the instance
  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip <<EOF
      sudo yum install java-17-amazon-corretto-devel git tmux wget -y &&
      git clone https://github.com/aws-observability/application-signals-demo.git &&
      cd application-signals-demo/ && 
      ./mvnw clean install -pl spring-petclinic-customers-service -am -DskipTests &&
      cd scripts/ec2/appsignals &&
      wget $CLOUDWATCH_AGENT_DOWNLOAD_URL &&
      sudo rpm -U ./amazon-cloudwatch-agent.rpm &&
      sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:cloudwatch-agent.json
EOF

  service_name="customers-service-ec2-java"
  # SSH again to start tmux session
  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip << EOF
    tmux new -s customers -d
    tmux send-keys -t customers 'cd application-signals-demo/spring-petclinic-customers-service/target/' C-m
    tmux send-keys -t customers  "wget $JAVA_INSTRUMENTATION_AGENT_DOWNLOAD_URL" C-m
    tmux send-keys -t customers  "export CONFIG_SERVER_URL=http://${PRIVATE_IP_OF_SETUP_INSTANCE}:8888" C-m
    tmux send-keys -t customers  "export DISCOVERY_SERVER_URL=http://${PRIVATE_IP_OF_SETUP_INSTANCE}:8761/eureka" C-m
    tmux send-keys -t customers  "export JAVA_TOOL_OPTIONS=' -javaagent:./aws-opentelemetry-agent.jar'" C-m
    tmux send-keys -t customers  "export OTEL_METRICS_EXPORTER=none" C-m
    tmux send-keys -t customers  "export OTEL_AWS_APP_SIGNALS_ENABLED=true" C-m
    tmux send-keys -t customers  "export OTEL_AWS_APP_SIGNALS_EXPORTER_ENDPOINT=http://localhost:4315" C-m
    tmux send-keys -t customers  "export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4315" C-m
    tmux send-keys -t customers  "export OTEL_RESOURCE_ATTRIBUTES=\"service.name=${service_name}\"" C-m
    tmux send-keys -t customers "java -jar spring-petclinic-customers*.jar" C-m
EOF

}

function run_visits() {
  PRIVATE_IP_OF_SETUP_INSTANCE=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=setup" "Name=instance-state-name,Values=running" \
    --query "Reservations[*].Instances[*].PrivateIpAddress" \
    --output text)

  # Retrieve public IP of the instance
  setup_ip=$(aws ec2 describe-instances \
      --filters "Name=tag:Name,Values=visits" "Name=instance-state-name,Values=running" \
      --query "Reservations[*].Instances[*].PublicIpAddress" \
      --output text)

  # SSH and run commands on the instance
  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip <<EOF
      sudo yum install java-17-amazon-corretto-devel git tmux wget -y &&
      git clone https://github.com/aws-observability/application-signals-demo.git &&
      cd application-signals-demo/ && 
      ./mvnw clean install -pl spring-petclinic-visits-service -am -DskipTests &&
      cd scripts/ec2/appsignals &&
      wget $CLOUDWATCH_AGENT_DOWNLOAD_URL &&
      sudo rpm -U ./amazon-cloudwatch-agent.rpm &&
      sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:cloudwatch-agent.json
EOF

  service_name="visits-service-ec2-java"
  # SSH again to start tmux session
  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip << EOF
    tmux new -s visits -d
    tmux send-keys -t visits 'cd application-signals-demo/spring-petclinic-visits-service/target/' C-m
    tmux send-keys -t visits  "wget $JAVA_INSTRUMENTATION_AGENT_DOWNLOAD_URL" C-m
    tmux send-keys -t visits  "export CONFIG_SERVER_URL=http://${PRIVATE_IP_OF_SETUP_INSTANCE}:8888" C-m
    tmux send-keys -t visits  "export DISCOVERY_SERVER_URL=http://${PRIVATE_IP_OF_SETUP_INSTANCE}:8761/eureka" C-m
    tmux send-keys -t visits  "export JAVA_TOOL_OPTIONS=' -javaagent:./aws-opentelemetry-agent.jar'" C-m
    tmux send-keys -t visits  "export OTEL_METRICS_EXPORTER=none" C-m
    tmux send-keys -t visits  "export OTEL_AWS_APP_SIGNALS_ENABLED=true" C-m
    tmux send-keys -t visits  "export OTEL_AWS_APP_SIGNALS_EXPORTER_ENDPOINT=http://localhost:4315" C-m
    tmux send-keys -t visits  "export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4315" C-m
    tmux send-keys -t visits  "export OTEL_RESOURCE_ATTRIBUTES=\"service.name=${service_name}\"" C-m
    tmux send-keys -t visits "java -jar spring-petclinic-visits*.jar" C-m
EOF

}

function run_insurances() {
  PRIVATE_IP_OF_SETUP_INSTANCE=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=setup" "Name=instance-state-name,Values=running" \
    --query "Reservations[*].Instances[*].PrivateIpAddress" \
    --output text)

  # Retrieve public IP of the instance
  setup_ip=$(aws ec2 describe-instances \
      --filters "Name=tag:Name,Values=insurances" "Name=instance-state-name,Values=running" \
      --query "Reservations[*].Instances[*].PublicIpAddress" \
      --output text)

  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip <<EOF
      sudo yum install git tmux wget -y &&
      git clone https://github.com/aws-observability/application-signals-demo.git &&
      cd application-signals-demo/scripts/ec2/appsignals &&
      wget $CLOUDWATCH_AGENT_DOWNLOAD_URL &&
      sudo rpm -U ./amazon-cloudwatch-agent.rpm &&
      sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:cloudwatch-agent.json
EOF

  service_name="insurance-service-ec2-python"
  # SSH again to start tmux session
  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip << EOF
    tmux new -s insurance -d
    tmux send-keys -t insurance 'cd application-signals-demo/pet_clinic_insurance_service' C-m
    tmux send-keys -t insurance "./ec2-setup.sh $master_password $PRIVATE_IP_OF_SETUP_INSTANCE $service_name" C-m
EOF
sleep 60

}

function run_billings() {
  PRIVATE_IP_OF_SETUP_INSTANCE=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=setup" "Name=instance-state-name,Values=running" \
    --query "Reservations[*].Instances[*].PrivateIpAddress" \
    --output text)

  # Retrieve public IP of the instance
  setup_ip=$(aws ec2 describe-instances \
      --filters "Name=tag:Name,Values=billings" "Name=instance-state-name,Values=running" \
      --query "Reservations[*].Instances[*].PublicIpAddress" \
      --output text)

  # TODO
  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip <<EOF
      sudo yum install git tmux wget -y &&
      git clone https://github.com/aws-observability/application-signals-demo.git &&
      cd application-signals-demo/scripts/ec2/appsignals &&
      wget $CLOUDWATCH_AGENT_DOWNLOAD_URL &&
      sudo rpm -U ./amazon-cloudwatch-agent.rpm &&
      sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:cloudwatch-agent.json
EOF

  service_name="billing-service-ec2-python"
  # SSH again to start tmux session
  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip << EOF
    tmux new -s billing -d
    tmux send-keys -t billing 'cd application-signals-demo/pet_clinic_billing_service' C-m
    tmux send-keys -t billing "./ec2-setup.sh $master_password $PRIVATE_IP_OF_SETUP_INSTANCE $service_name" C-m
EOF
sleep 60

}

function print_url() {
  dns_name=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=pet-clinic-frontend" "Name=instance-state-name,Values=running" \
    --query "Reservations[*].Instances[*].PublicDnsName" \
    --output text)  
  echo "Visit the sample app at this url: http://${dns_name}:8080"
}

function generate_traffic() {
  # Retrieve public IP of the instance
  setup_ip=$(aws ec2 describe-instances \
      --filters "Name=tag:Name,Values=pet-clinic-frontend" "Name=instance-state-name,Values=running" \
      --query "Reservations[*].Instances[*].PublicIpAddress" \
      --output text)

  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip << EOF
    cd application-signals-demo/traffic-generator/ &&
    sudo yum install nodejs -y &&
    npm install --only=production
EOF

  # SSH again to start tmux session
  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$setup_ip << EOF
    tmux new -s traffic-generator -d
    tmux send-keys -t traffic-generator 'cd application-signals-demo/traffic-generator/' C-m
    tmux send-keys -t traffic-generator "export URL=\"http://${setup_ip}:8080\"" C-m
    tmux send-keys -t traffic-generator "export HIGH_LOAD_MAX=1600" C-m
    tmux send-keys -t traffic-generator "export HIGH_LOAD_MIN=800" C-m
    tmux send-keys -t traffic-generator "export BURST_DELAY_MAX=80" C-m
    tmux send-keys -t traffic-generator "export BURST_DELAY_MIN=60" C-m
    tmux send-keys -t traffic-generator "export LOW_LOAD_MAX=60" C-m
    tmux send-keys -t traffic-generator "export LOW_LOAD_MIN=30" C-m
    tmux send-keys -t traffic-generator "node index.js" C-m
EOF

}


function delete_resources() {
    echo "Deleting resources..."
    
    delete_database

    # Delete EC2 instances
    declare -a instance_ids=()

    for name in "${INSTANCE_NAMES[@]}"
    do
      if [ "$name" == "visits" ]; then
        # Update the ASG to have 0 instances
        asg_name="asg-$name"
        launch_template_name="lt-$name"
        aws autoscaling update-auto-scaling-group --auto-scaling-group-name $asg_name --min-size 0 --max-size 0 --desired-capacity 0
      else 
        instance_id=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$name" --query 'Reservations[*].Instances[*].InstanceId' --output text)
        if [ ! -z "$instance_id" ]; then
          if [ "$name" != "visits" ]; then
            aws ec2 terminate-instances --instance-ids $instance_id
          fi
          echo "Instances terminating: $instance_id"
          instance_ids+=($instance_id)
        fi
      fi
    done
    
    # Update the ASG to have 0 instances
    asg_name="asg-visits"
    aws autoscaling update-auto-scaling-group --auto-scaling-group-name $asg_name --min-size 0 --max-size 0 --desired-capacity 0

    # wait for all instances are terminated
    for id in "${instance_ids[@]}"
    do
        echo "Checking instance: $id"
        aws ec2 wait instance-terminated --instance-ids $id
        echo "Instance $id is terminated."
    done

    echo "All EC2 instances are termianted"

    # Delete the ASG
    aws autoscaling delete-auto-scaling-group --auto-scaling-group-name $asg_name --force-delete
    
    # Delete the Launch Template
    launch_template_name="lt-visits"
    aws ec2 delete-launch-template --launch-template-name $launch_template_name

    # Delete instance profile
    aws iam remove-role-from-instance-profile --instance-profile-name $INSTANCE_PROFILE --role-name $IAM_ROLE_NAME
    aws iam delete-instance-profile --instance-profile-name $INSTANCE_PROFILE


    # Detach and delete IAM policies and role
    policy_arns=("arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess" "arn:aws:iam::aws:policy/AmazonBedrockFullAccess" "arn:aws:iam::aws:policy/AmazonKinesisFullAccess" "arn:aws:iam::aws:policy/AmazonS3FullAccess" "arn:aws:iam::aws:policy/AmazonSQSFullAccess" "arn:aws:iam::aws:policy/AmazonRDSFullAccess" "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy" "arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess")
    for arn in "${policy_arns[@]}"
    do
      echo $arn
      aws iam detach-role-policy --role-name $IAM_ROLE_NAME --policy-arn $arn
    done
    aws iam delete-role --role-name $IAM_ROLE_NAME

    # Delete security groups
    sg_id=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$SG_NAME" --query 'SecurityGroups[0].GroupId' --output text)
    if [ ! -z "$sg_id" ]; then
      aws ec2 delete-security-group --group-id $sg_id
      echo "Security group deleted: $sg_id"
    fi

    # Delete key pair
    aws ec2 delete-key-pair --key-name $KEY_NAME
    rm -f "${KEY_NAME}.pem"

    rm -f master_password.txt

    echo "Resource deletion complete."
}

# Execute based on operation
if [ "$OPERATION" == "delete" ]; then
    delete_resources
else
    create_resources
    run_setup
    run_pet_clinic_frontend
    run_vets
    run_customers
    run_visits
    create_database
    run_insurances
    run_billings
    generate_traffic
    print_url
fi
