# Introduction
This is a modified version of the [spring-petclinic-microservices](https://github.com/spring-petclinic/spring-petclinic-microservices) Spring Boot sample application. 
Our modifications focus on showcasing the capabilities of Application Signals within a Spring Boot environment.
If your interest lies in exploring the broader aspects of the Spring Boot stack, we recommend visiting the original repository at [spring-petclinic-microservices](https://github.com/spring-petclinic/spring-petclinic-microservices).

In the following, we will focus on how customers can set up the current sample application to explore the features of Application Signals.

# Prerequisite
* A Linux or Mac machine with x86-64 (AMD64) architecture is required for building Docker images for the sample application.
* Docker is installed and running on the machine.
* AWS CLI 2.x is installed. For more information about installing the AWS CLI, see [Install or update the latest version of the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).
* kubectl is installed - https://docs.aws.amazon.com/eks/latest/userguide/install-kubectl.html
* eksctl is installed - https://docs.aws.amazon.com/eks/latest/userguide/eksctl.html
* jq is installed - https://jqlang.github.io/jq/download/

# EKS demo

## Build the sample application images and push to ECR
1. Build container images for each micro-service application

```
./mvnw clean install -P buildDocker
```

2. Create an ECR repo for each micro service and push the images to the relevant repos. Replace the aws account id and the AWS Region.
    
```
export ACCOUNT='111122223333'
export REGION='us-east-1'
./push-ecr.sh
```

## Try Application Signals with the sample application
1. Create an EKS cluster, enable Application Signals, and deploy the sample application to your EKS cluster. Replace `new-cluster-name` with the name that you want to use for the new cluster. Replace `region-name` with the same region in previous section "**Build the sample application images and push to ECR**". 

```
cd scripts/eks/appsignals/one-step && ./setup.sh new-cluster-name region-name
```

2. Clean up all the resources. Replace `new-cluster-name` and `region-name` with the same values that you use in previous step.

```
cd scripts/eks/appsignals/one-step && ./cleanup.sh new-cluster-name region-name
```


# EC2 Demo
The following instructions describe how to set up the pet clinic sample application on EC2 instances. You can run these steps in your personal AWS account to follow along.

1. Set up a VPC with a public subnet and a security group accepting all traffic.
2. Set up 5 EC2 instances all with the following configuration:
   - Running on Amazon Linux
   - Instance type t2.small or larger
   - A key-pair you save to your computer
   - Use the VPC, public subnet, and security group created in step 1
   - Enable auto-assign public IP
   - An IAM instance profile with the following permissions:
     - AmazonDynamoDBFullAccess 
     - AmazonKinesisFullAccess 
     - AmazonS3FullAccess 
     - AmazonSQSFullAccess
3. Rename your instances as follows to follow along with the instructions:
   - setup
   - pet-clinic-frontend
   - vets
   - customers
   - visits
4. Connect to the EC2 instance named setup and start the config, discovery, and admin services in screen sessions. Feel free to end your connection to the EC2 instance, the screen sessions will continue running.

   - build the JAR files 
   ```
   sudo yum install java-17-amazon-corretto-devel git -y
   git clone https://github.com/aws-observability/application-signals-demo.git
   cd application-signals-demo/ && ./mvnw clean install
   ```

   - Create an S3 buket in your account and put the created JAR files into it
   ```
   aws s3 mb s3://app-signals-ec2-demo
   for dir in `ls -d spring-petclinic-*`; do aws s3 cp $dir/target/*.jar s3://app-signals-ec2-demo; done 
   ```

   - Run config service and then leave the config service `screen` session by inputting `ctrl+a, d`.
   ```
   screen -S config
   cd spring-petclinic-config-server/target/
   java -jar spring-petclinic-config...
   ```

   - Run discovery serviceand then leave the discovery service `screen` session by inputting `ctrl+a, d`.
   ```
   clear
   screen -S discovery
   cd spring-petclinic-discovery-server/target/
   java -jar spring-petclinic-discovery...
   ```


   - Run admin serviceand then leave the admin service `screen` session by inputting `ctrl+a, d`.
   ```
   clear
   screen -S admin
   cd spring-petclinic-admin-server/target/
   java -jar spring-petclinic-admin...
   ```



5. Connect to the EC2 instance named pet-clinic-frontend and run the following commands to start the api-gateway service. Make sure to replace the private IP in the export commands.You can leave the api-gateway service `screen` session by inputting `ctrl+a, d`.
Feel free to end your connection to the EC2 instance, the screen will continue running the service.
   ```
   sudo yum install java-17-amazon-corretto-devel -y
   aws s3 sync s3://app-signals-ec2-demo .
   export CONFIG_SERVER_URL=http://<PRIVATE-IP-OF-SETUP-INSTANCE>:8888
   export DISCOVERY_SERVER_URL=http://<PRIVATE-IP-OF-SETUP-INSTANCE>:8761/eureka
   screen -S frontend
   java -jar spring-petclinic-api-gateway...
   ```

6. Repeat step 5 for the remaining EC2 instances (vets, customers, visits)

7. Visit the sample application by going to `http://<PUBLIC-IPv4-DNS-OF-PET-CLINIC-FRONTEND-INSTANCE>:8080`

8. Interact with the application to ensure you've properly set up the backend services. Note that each service takes a few seconds to come up.


To enable Application Signals on the sample application, please refer to [this user guide](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Application-Signals-Enable-EC2.html).

