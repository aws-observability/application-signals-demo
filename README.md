# Introduction
This is a modified version of the [spring-petclinic-microservices](https://github.com/spring-petclinic/spring-petclinic-microservices) Spring Boot sample application. 
Our modifications focus on showcasing the capabilities of Application Signals within a Spring Boot environment.
If your interest lies in exploring the broader aspects of the Spring Boot stack, we recommend visiting the original repository at [spring-petclinic-microservices](https://github.com/spring-petclinic/spring-petclinic-microservices).

In the following, we will focus on how customers can set up the current sample application to explore the features of Application Signals.

# Disclaimer

This code for sample application is intended for demonstration purposes only. It should not be used in a production environment or in any setting where reliability/security is a concern.

# Prerequisite
* A Linux or Mac machine with x86-64 (AMD64) architecture is required for building Docker images for the sample application.
* Docker is installed and running on the machine.
* AWS CLI 2.x is installed. For more information about installing the AWS CLI, see [Install or update the latest version of the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).
* kubectl is installed - https://docs.aws.amazon.com/eks/latest/userguide/install-kubectl.html
* eksctl is installed - https://docs.aws.amazon.com/eks/latest/userguide/eksctl.html
* jq is installed - https://jqlang.github.io/jq/download/
* [Optional] If you plan to install the infrastructure resources using Terraform, terraform cli is required. https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli

# EKS demo

## Deploy via Shell Scripts

### Build the sample application images and push to ECR

1. Build container images for each micro-service application

``` shell

./mvnw clean install -P buildDocker
```

2. Create an ECR repo for each micro service and push the images to the relevant repos. Replace the aws account id and the AWS Region.

``` shell
export ACCOUNT=`aws sts get-caller-identity | jq .Account -r`
export REGION='us-east-1'
./push-ecr.sh
```

### Try Application Signals with the sample application

1. Create an EKS cluster, enable Application Signals, and deploy the sample application to your EKS cluster. Replace `new-cluster-name` with the name that you want to use for the new cluster. Replace `region-name` with the same region in previous section "**Build the sample application images and push to ECR**".

``` shell
cd scripts/eks/appsignals/one-step && ./setup.sh new-cluster-name region-name
```

2. Clean up all the resources. Replace `new-cluster-name` and `region-name` with the same values that you use in previous step.

``` shell
cd scripts/eks/appsignals/one-step && ./cleanup.sh new-cluster-name region-name
```

Please be aware that this sample application includes a publicly accessible Application Load Balancer (ALB), enabling easy interaction with the application. If you perceive this public ALB as a security risk, consider restricting access by employing [security groups](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-update-security-groups.html).

## Deploy via Terraform

1. Go to the terraform directory under the project. Prepare Terraform S3 backend and set required environment variables

   ``` shell
   cd terraform/eks

   # create a new bucket for terraform backend storage
   aws s3 mb s3://tfstate-$(uuidgen)

   # setup env variables
   export AWS_REGION=us-east-1
   export TFSTATE_KEY=application-signals/demo-applications
   export TFSTATE_BUCKET=$(aws s3 ls --output text | awk '{print $3}' | grep tfstate-)
   export TFSTATE_REGION=$AWS_REGION
   ```

2. Replace the user name with the one you configured for aws cli, deploy EKS cluster and RDS postgreSQL database.

   ``` shell
   # provide EKS access to user, make sure to change it to your own user that configured for aws cli in terminal
   export TF_VAR_username={your_username}

   # some other values can be changed, the value below are default values
   export TF_VAR_cluster_name=app-signals-demo
   export TF_VAR_cloudwatch_observability_addon_version=v1.5.1-eksbuild.1

   # optionally use -migrate-state
   terraform init -backend-config="bucket=${TFSTATE_BUCKET}" -backend-config="key=${TFSTATE_KEY}" -backend-config="region=${TFSTATE_REGION}"

   terraform apply --auto-approve
   ```

   The deployment takes 20 - 25 minutes.

3. Build and push docker images

   ``` shell
   # move back to the project root directory
   cd ../.. 

   ./mvnw clean install -P buildDocker
   export ACCOUNT=`aws sts get-caller-identity | jq .Account -r`
   export REGION=$AWS_REGION
   ./push-ecr.sh
   ```

4. Deploy Kubernetes resources

   Change the cluster-name and region if you configure them differently.

   ``` shell
   aws eks update-kubeconfig --name $TF_VAR_cluster_name  --kubeconfig ~/.kube/config --region $AWS_REGION --alias $TF_VAR_cluster_name
   ./scripts/eks/appsignals/tf-deploy-k8s-res.sh

   ```

5. Create Canaries and SLOs

   ``` shell
   endpoint="http://$(kubectl get ingress -o json  --output jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}')"
   cd scripts/eks/appsignals/
   ./create-canaries.sh $AWS_REGION create $endpoint
   ./create-slo.sh $TF_VAR_cluster_name $AWS_REGION
   ```

6. Visit Application

   ``` shell
   endpoint="http://$(kubectl get ingress -o json  --output jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}')"
   # Print the endpoint
   echo "Visit the following URL to see the sample app running: $endpoint"
   ```

7. Cleanup

   ``` shell
   # delete ALB ingress
   kubectl delete -f ./scripts/eks/appsignals/sample-app/alb-ingress/petclinic-ingress.yaml

   # Delete SLOs
   ./cleanup-slo.sh $REGION

   # delete Canaries
   ./create-canaries.sh $REGION delete

   # move to terraform directory and destroy stack
   cd ../../../terraform/eks
   terraform destroy --auto-approve
   ```

# EC2 Demo
The following instructions describe how to set up the pet clinic sample application on EC2 instances. You can run these steps in your personal AWS account to follow along.

1. Set up a VPC with a public subnet and a security group accepting all traffic.
2. Set up 7 EC2 instances all with the following configuration:
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
     - AmazonRDSFullAccess
3. Rename your instances as follows to follow along with the instructions:
   - setup
   - pet-clinic-frontend
   - vets
   - customers
   - visits
   - insurances
   - billings
4. Connect to the EC2 instance named setup and start the config, discovery, and admin services in tmux sessions. Feel free to end your connection to the EC2 instance, the tmux sessions will continue running.

   - Install `java17`, `git`, and `tmux` as dependencies
   ```
   sudo yum install java-17-amazon-corretto-devel git tmux -y
   ```

   - Verify java 17 is used. If not, run `sudo alternatives --config java` to change the default java provider
   ```
   java -version
   ```

   - Build the JAR files 
   ```
   git clone https://github.com/aws-observability/application-signals-demo.git
   cd application-signals-demo/ && ./mvnw clean install
   ```

   - Create an S3 buket in your account and put the created JAR files into it
   ```
   aws s3 mb s3://app-signals-ec2-demo
   for dir in `ls -d spring-petclinic-*`; do aws s3 cp $dir/target/*.jar s3://app-signals-ec2-demo; done 
   ```

   - Run config service in a tmux session and then exit by inputting `ctrl+b, d`.
   ```
   tmux new -s config
   cd spring-petclinic-config-server/target/
   java -jar spring-petclinic-config...
   ```

   - Run discovery service in a tmux session and then exit by inputting `ctrl+b, d`.
   ```
   tmux new -s discovery
   cd spring-petclinic-discovery-server/target/
   java -jar spring-petclinic-discovery...
   ```


   - Run admin service in a tmux session and then exit by inputting `ctrl+b, d`.
   ```
   tmux new -s admin
   cd spring-petclinic-admin-server/target/
   java -jar spring-petclinic-admin...
   ```



5. Connect to the EC2 instance named pet-clinic-frontend and run the following commands to start the api-gateway service. Feel free to end your connection to the EC2 instance, the tmux sessions will continue running.

   - Install `java17` and `tmux` as dependencies
   ```
   sudo yum install java-17-amazon-corretto-devel tmux -y
   ```

   - Verify java 17 is used. If not, run `sudo alternatives --config java` to change the default java provider
   ```
   java -version
   ```

   - Download jar files from S3 bucket
   ```
   aws s3 sync s3://app-signals-ec2-demo .
   ```

   - Run the sample app in a tmux session and then exit by inputting `ctrl+b, d`. Make sure to replace the private IP in the export commands.
   ```
   tmux new -s frontend
   export CONFIG_SERVER_URL=http://<PRIVATE-IP-OF-SETUP-INSTANCE>:8888
   export DISCOVERY_SERVER_URL=http://<PRIVATE-IP-OF-SETUP-INSTANCE>:8761/eureka
   java -jar spring-petclinic-api-gateway...
   ```

6. Repeat step 5 for the EC2 instances (vets, customers, visits)

7. Go to RDS and create a Postgres DB with the following configurations:
    - Use the Dev/Test template with a single DB instance. 
    - Update the Master username to `root` and create a password of your choosing. Write it down since you will need it later. 
    - In the Connectivity settings, use the VPC, public subnet, and security group created in step 1. 
    - Switch to Connect to an EC2 compute instance and choose the vehicle-service EC2 instance and then create the DB.

8. Select the EC2 instance names `insurances` and choose Actions -> Networking -> Connect RDS and choose the RDS instance from step 7. 

9. Connect to the EC2 instance named `insurances` and then run the following commands to start the python microservice in a tmux session. Feel free to end your connection to the EC2 instance, the tmux sessions will continue running.
   - Create a zip file of the `pet_clinic_insurance_service` directory and upload it to S3 bucket `s3://app-signals-ec2-demo`.
   - Download the zip file from S3 bucket
   ```
   aws s3 cp s3://app-signals-ec2-demo/pet_clinic_insurance_service.zip .
   unzip pet_clinic_insurance_service.zip
   cd pet_clinic_insurance_service
   . ec2-setup.sh <PASS-FROM-STEP-7> <PRIVATE-IP-OF-SETUP-INSTANCE>
   ```

   - Run the sample app in a tmux session and then exit by inputting `ctrl+b, d`.
   ```
   tmux new -s insurance
   python3 manage.py migrate & python3 manage.py loaddata initial_data.json & python3 manage.py runserver 0.0.0.0:8000 --noreload
   ```

10. Repeat steps 8 and 9 for the `billings` EC2 instance but with the following to start the app.
    - Run the sample app in a tmux session and then exit by inputting `ctrl+b, d`.
    ```
    tmux new -s billing
    python3 manage.py migrate & python3 manage.py runserver 0.0.0.0:8800 --noreload
    ```

11. Visit the sample application by going to `http://<PUBLIC-IPv4-DNS-OF-PET-CLINIC-FRONTEND-INSTANCE>:8080`

12. Interact with the application to ensure you've properly set up the backend services. Note that each service takes a few seconds to come up.


To enable Application Signals on the sample application, please refer to [this user guide](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Application-Signals-Enable-EC2.html).

