#!/bin/bash
set -ex 

# Default values
DEFAULT_REGION="us-east-1"
OPERATION="create"
CLUSTER="k8s-demo"

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
SG_NAME="k8s-demo-security-group"
IAM_ROLE_NAME="k8s-demo-role-${REGION}"
INSTANCE_PROFILE="k8s-demo-instance-profile"
INSTANCE_NAMES=("k8s-master" "k8s-worker") 
KEY_NAME="k8s-demo-key-pair"
CLOUDWATCH_AGENT_DOWNLOAD_URL="https://amazoncloudwatch-agent.s3.amazonaws.com/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm"
JAVA_INSTRUMENTATION_AGENT_DOWNLOAD_URL="https://github.com/aws-observability/aws-otel-java-instrumentation/releases/latest/download/aws-opentelemetry-agent.jar"

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

    # TODO
    # Create a security group
    sg_id=$(aws ec2 create-security-group --group-name $SG_NAME --description "Security group for all traffic" --vpc-id $vpc_id --query 'GroupId' --output text)
    # Allow all traffic from its own security group
    aws ec2 authorize-security-group-ingress --group-id $sg_id --protocol all --source-group $sg_id
    # Allow SSH from anywhere
    aws ec2 authorize-security-group-ingress --group-id $sg_id --protocol tcp --port 22 --cidr 0.0.0.0/0
    # Allow TCP traffic on port 32080 from anywhere
    aws ec2 authorize-security-group-ingress --group-id $sg_id --protocol tcp --port 32080 --cidr 0.0.0.0/0
    
    # Create an IAM role and attach policies
    aws iam create-role --role-name $IAM_ROLE_NAME --assume-role-policy-document file://trust-policy.json
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonKinesisFullAccess"
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonS3FullAccess"
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonRDSFullAccess"
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess"
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
    aws iam attach-role-policy --role-name $IAM_ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/AmazonEC2FullAccess"
    aws iam put-role-policy --role-name $IAM_ROLE_NAME --policy-name "allow-ecr-access" --policy-document file://allow-ecr-access.json


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
      instance_id=$(aws ec2 run-instances \
        --image-id $IMAGE_ID \
        --count 1 \
        --instance-type m5.xlarge \
        --key-name $KEY_NAME \
        --security-group-ids $sg_id \
        --iam-instance-profile Name=$INSTANCE_PROFILE \
        --associate-public-ip-address \
        --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=80,VolumeType=gp3}' \
        --metadata-options 'HttpPutResponseHopLimit=3,HttpEndpoint=enabled' \
        --query 'Instances[0].InstanceId' \
        --output text)

      aws ec2 create-tags --resources $instance_id --tags Key=Name,Value=$name
      instance_ids+=($instance_id)
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



function run_k8s_master() {
  # Retrieve public IP of k8s master node
  master_ip=$(aws ec2 describe-instances \
      --filters "Name=tag:Name,Values=k8s-master" "Name=instance-state-name,Values=running" \
      --query "Reservations[*].Instances[*].PublicIpAddress" \
      --output text)

  # SSH and run commands on the master node
  master_private_ip=$(aws ec2 describe-instances \
      --filters "Name=tag:Name,Values=k8s-master" "Name=instance-state-name,Values=running" \
      --query "Reservations[*].Instances[*].PrivateIpAddress" \
      --output text)

  worker_private_ip=$(aws ec2 describe-instances \
      --filters "Name=tag:Name,Values=k8s-worker" "Name=instance-state-name,Values=running" \
      --query "Reservations[*].Instances[*].PrivateIpAddress" \
      --output text)

  # set up kubeadmin
  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$master_ip << EOF
    sudo yum update -y && sudo yum install docker tmux git vim -y && sudo usermod -aG docker ec2-user && \
    sudo systemctl enable docker && sudo systemctl start docker && \
    sudo containerd config default > config.toml && \
    sudo cp config.toml /etc/containerd/config.toml && \
    sudo sed -i 's/SystemdCgroup \= false/SystemdCgroup \= true/' /etc/containerd/config.toml && \
    sudo sed -i 's/systemd_cgroup \= true/systemd_cgroup \= true/' /etc/containerd/config.toml && \
    sudo systemctl restart containerd && sleep 20 && \
    sudo setenforce 0 && sudo sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config && \
    echo -e "[kubernetes]\nname=Kubernetes\nbaseurl=https://pkgs.k8s.io/core:/stable:/v1.29/rpm/\nenabled=1\ngpgcheck=1\ngpgkey=https://pkgs.k8s.io/core:/stable:/v1.29/rpm/repodata/repomd.xml.key\nexclude=kubelet kubeadm kubectl cri-tools kubernetes-cni" | sudo tee /etc/yum.repos.d/kubernetes.repo && \
    sudo yum install -y kubelet kubeadm kubectl --disableexcludes=kubernetes && \
    sudo systemctl enable --now kubelet && sudo systemctl restart kubelet && sleep 30 && \
    sudo kubeadm init --pod-network-cidr=192.168.0.0/16 --apiserver-advertise-address=$master_private_ip --apiserver-cert-extra-sans=$worker_private_ip && \
    mkdir -p \$HOME/.kube && \
    sudo cp -i /etc/kubernetes/admin.conf \$HOME/.kube/config && \
    sudo chown \$(id -u):\$(id -g) \$HOME/.kube/config && \
    sleep 120 && \
    curl https://raw.githubusercontent.com/projectcalico/calico/v3.27.2/manifests/calico.yaml -O && \
    kubectl apply -f calico.yaml && sleep 60 && \
    sudo cd \$HOME && \
    sudo cp /etc/kubernetes/pki/apiserver.crt apiserver.crt && \
    sudo cp /etc/kubernetes/pki/apiserver.key apiserver.key && \
    sudo chmod +r apiserver.key && \
    sudo kubeadm token create --print-join-command > join-cluster.sh && \
    sudo chmod +x join-cluster.sh && \
    echo "tlsCertFile: /etc/kubernetes/pki/apiserver.crt" | sudo tee -a /var/lib/kubelet/config.yaml && \
    echo "tlsPrivateKeyFile: /etc/kubernetes/pki/apiserver.key" | sudo tee -a /var/lib/kubelet/config.yaml && \
    sudo systemctl restart kubelet
EOF

  scp -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$master_ip:~/apiserver.crt . 
  scp -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$master_ip:~/apiserver.key . 
  scp -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$master_ip:~/join-cluster.sh . 

}


function run_k8s_worker() {
  # Retrieve public IP of worker node
  worker_ip=$(aws ec2 describe-instances \
      --filters "Name=tag:Name,Values=k8s-worker" "Name=instance-state-name,Values=running" \
      --query "Reservations[*].Instances[*].PublicIpAddress" \
      --output text)

  scp -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" apiserver.crt ec2-user@$worker_ip:~
  scp -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" apiserver.key ec2-user@$worker_ip:~
  scp -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" join-cluster.sh ec2-user@$worker_ip:~

  # set up kubeadmin
  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$worker_ip << EOF
    sudo yum update -y && sudo yum install docker tmux git vim -y && sudo usermod -aG docker ec2-user && \
    sudo systemctl enable docker && sudo systemctl start docker &&  \
    sudo containerd config default > config.toml && \
    sudo cp config.toml /etc/containerd/config.toml && \
    sudo sed -i 's/SystemdCgroup \= false/SystemdCgroup \= true/' /etc/containerd/config.toml && \
    sudo sed -i 's/systemd_cgroup \= true/systemd_cgroup \= true/' /etc/containerd/config.toml && \
    sudo systemctl restart containerd && \
    sudo setenforce 0 && sudo sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config && \
    echo -e "[kubernetes]\nname=Kubernetes\nbaseurl=https://pkgs.k8s.io/core:/stable:/v1.29/rpm/\nenabled=1\ngpgcheck=1\ngpgkey=https://pkgs.k8s.io/core:/stable:/v1.29/rpm/repodata/repomd.xml.key\nexclude=kubelet kubeadm kubectl cri-tools kubernetes-cni" | sudo tee /etc/yum.repos.d/kubernetes.repo && \
    sudo yum install -y kubelet kubeadm kubectl --disableexcludes=kubernetes && \
    sudo mkdir -p /etc/kubernetes/pki/ && \
    sudo cp apiserver.crt /etc/kubernetes/pki/apiserver.crt && \
    sudo cp apiserver.key /etc/kubernetes/pki/apiserver.key && \
    sudo bash join-cluster.sh && sleep 30 && \
    echo "tlsCertFile: /etc/kubernetes/pki/apiserver.crt" | sudo tee -a /var/lib/kubelet/config.yaml && \
    echo "tlsPrivateKeyFile: /etc/kubernetes/pki/apiserver.key" | sudo tee -a /var/lib/kubelet/config.yaml && \
    sudo systemctl restart kubelet
EOF


# wait for the woker to join the cluster
sleep 5m

}


function install_helm_and_cloudwatch() {
  # Retrieve public IP of master node
  master_ip=$(aws ec2 describe-instances \
      --filters "Name=tag:Name,Values=k8s-master" "Name=instance-state-name,Values=running" \
      --query "Reservations[*].Instances[*].PublicIpAddress" \
      --output text)

  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$master_ip << EOF
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml && \
    curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 && \
    chmod 700 get_helm.sh && \
    ./get_helm.sh && sleep 30 && \
    git clone https://github.com/aws-observability/helm-charts -q && \
    cd helm-charts/charts/amazon-cloudwatch-observability/ && \
    helm upgrade --install --debug --namespace amazon-cloudwatch amazon-cloudwatch-operator ./ --create-namespace --set region=${REGION} --set clusterName=${CLUSTER}
EOF

}

function install_ebs_csi_driver() {
  master_ip=$(aws ec2 describe-instances \
      --filters "Name=tag:Name,Values=k8s-master" "Name=instance-state-name,Values=running" \
      --query "Reservations[*].Instances[*].PublicIpAddress" \
      --output text)

  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$master_ip << EOF
    helm repo add aws-ebs-csi-driver https://kubernetes-sigs.github.io/aws-ebs-csi-driver && \
    helm repo update && \
    helm upgrade --install aws-ebs-csi-driver \
      --namespace kube-system aws-ebs-csi-driver/aws-ebs-csi-driver
EOF

}

function deploy_sample_app() {
  master_ip=$(aws ec2 describe-instances \
      --filters "Name=tag:Name,Values=k8s-master" "Name=instance-state-name,Values=running" \
      --query "Reservations[*].Instances[*].PublicIpAddress" \
      --output text)

  ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@$master_ip << EOF
    git clone https://github.com/aws-observability/application-signals-demo.git && \
    cd application-signals-demo/scripts/k8s/appsignals && \
    ./deploy-sample-app.sh ${REGION}
EOF

}


function print_url() {
  dns_name=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=k8s-master" "Name=instance-state-name,Values=running" \
    --query "Reservations[*].Instances[*].PublicDnsName" \
    --output text)  
  echo "Visit the sample app at this url: http://${dns_name}:32080"
}



function delete_resources() {
    echo "Deleting resources..."
    
    # Delete EC2 instances
    for name in "${INSTANCE_NAMES[@]}"
    do
      instance_ids=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$name" --query 'Reservations[*].Instances[*].InstanceId' --output text)
      if [ ! -z "$instance_ids" ]; then
        aws ec2 terminate-instances --instance-ids $instance_ids
        echo "Instances terminating: $instance_ids"
      fi
    done

    # Delete instance profile
    aws iam remove-role-from-instance-profile --instance-profile-name $INSTANCE_PROFILE --role-name $IAM_ROLE_NAME
    aws iam delete-instance-profile --instance-profile-name $INSTANCE_PROFILE


    # Detach and delete IAM policies and role
    policy_arns=("arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess" "arn:aws:iam::aws:policy/AmazonKinesisFullAccess" "arn:aws:iam::aws:policy/AmazonS3FullAccess" "arn:aws:iam::aws:policy/AmazonSQSFullAccess" "arn:aws:iam::aws:policy/AmazonRDSFullAccess" "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy" "arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess" "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy" "arn:aws:iam::aws:policy/AmazonEC2FullAccess")

    for arn in "${policy_arns[@]}"
    do
      echo $arn
      aws iam detach-role-policy --role-name $IAM_ROLE_NAME --policy-arn $arn
    done

    aws iam delete-role-policy --role-name $IAM_ROLE_NAME --policy-name "allow-ecr-access"

    aws iam delete-role --role-name $IAM_ROLE_NAME

    sleep 5m
    # Delete security groups
    sg_id=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$SG_NAME" --query 'SecurityGroups[0].GroupId' --output text)
    if [ ! -z "$sg_id" ]; then
      aws ec2 delete-security-group --group-id $sg_id
      echo "Security group deleted: $sg_id"
    fi

    # Delete key pair
    aws ec2 delete-key-pair --key-name $KEY_NAME
    rm -f "${KEY_NAME}.pem"

    rm -rf apiserver.crt
    rm -rf apiserver.key
    rm -rf join-cluster.sh
    echo "Resource deletion complete."
}

# Execute based on operation
if [ "$OPERATION" == "delete" ]; then
    delete_resources
else
    create_resources
    run_k8s_master
    run_k8s_worker
    install_helm_and_cloudwatch
    install_ebs_csi_driver
    deploy_sample_app
    print_url
fi