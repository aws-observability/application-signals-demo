# Introduction
This is a modified version of the [spring-petclinic-microservices](https://github.com/spring-petclinic/spring-petclinic-microservices) Spring Boot sample application. 
Our modifications focus on showcasing the capabilities of Application Signals within a Spring Boot environment.
If your interest lies in exploring the broader aspects of the Spring Boot stack, we recommend visiting the original repository at [spring-petclinic-microservices](https://github.com/spring-petclinic/spring-petclinic-microservices).

In the following, we will focus on how customers can set up the current sample application to explore the features of Application Signals.

# Prerequisite
* A docker installation that is set up to build images for AMD64 architecture:
  * Working on Mac with intel / AMD64 architecture: 
    * Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) on your laptop for building the application container images.
    * (Make sure to open Docker Desktop and complete the setup)
  * Working on Mac with Apple M1 chip / ARM64 architecture:
    * Recommended to use Cloud Desktop as Docker desktop will default to creating images for local architecture
  * Cloud Desktop
    * Docker is installed by default

* kubectl - https://docs.aws.amazon.com/eks/latest/userguide/install-kubectl.html
* eksctl - https://docs.aws.amazon.com/eks/latest/userguide/eksctl.html

# EKS demo

1. Build container images for each micro-service application

```
./mvnw clean install -P buildDocker
```

2. Create an ECR repo for each micro service and push the images to the relevant repos (Note: replace the aws account id and the region)
    
```
export ACCOUNT='272386705296' 
export REGION='us-east-1'
./push-ecr.sh
```

3. Deploy the micro services to your EKS cluster


# EC2 Demo
The following instructions describe how to set up the pet clinic sample application on EC2 instances. You can run these steps in your personal AWS account to follow along.

1. Clone this repository and run `./mvnw clean install`
2. Set up an S3 bucket in your account and put the created JAR files into it
3. Set up a VPC with a public subnet and a security group accepting all traffic.
4. Set up 5 EC2 instances all with the following configuration:
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
5. Rename your instances as follows to follow along with the instructions:
   - setup
   - pet-clinic-frontend
   - vets
   - customers
   - visits
6. Connect to the EC2 instance named setup and run the following commands to start the config, discovery, and admin services:

```
sudo yum install java-1.8.0
aws s3 sync s3://<S3-bucket-name> .
screen -S config
java -jar spring-petclinic-config...
```
Leave the config service `screen` session by inputting `ctrl+a, d`.
```
clear
screen -S discovery
java -jar spring-petclinic-discovery...
```
Leave the discovery service `screen` session by inputting `ctrl+a, d`.
```
clear
screen -S admin
java -jar spring-petclinic-admin...
```
Leave the admin service `screen` session by inputting `ctrl+a, d`.
Feel free to end your connection to the EC2 instance, the screens will continue running.
8. Connect to the EC2 instance named pet-clinic-frontend and run the following commands to start the api-gateway service. Make sure to replace the private IP in the export commands.
```
sudo yum install java-1.8.0
aws s3 sync s3://<S3-bucket-name> .
export CONFIG_SERVER_URL=http://<PRIVATE-IP-OF-SETUP-INSTANCE>:8888
export DISCOVERY_SERVER_URL=http://<PRIVATE-IP-OF-SETUP-INSTANCE>:8761/eureka
screen -S frontend
java -jar spring-petclinic-api-gateway...
```
Leave the api-gateway service `screen` session by inputting `ctrl+a, d`.
Feel free to end your connection to the EC2 instance, the screen will continue running the service
9. Repeat step 8 for the remaining EC2 instances (vets, customers, visits)
10. Visit the sample application by going to http://<PUBLIC-IPv4-DNS-OF-PET-CLINIC-FRONTEND-INSTANCE>:8080
11. Interact with the application to ensure you've properly set up the backend services. Note that each service takes a few seconds to come up.

