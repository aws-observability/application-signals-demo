# Introduction
This is a modified version of the [spring-petclinic-microservices](https://github.com/spring-petclinic/spring-petclinic-microservices) Spring Boot sample application. 
Our modifications focus on showcasing the capabilities of Application Signals within a Spring Boot environment.
If your interest lies in exploring the broader aspects of the Spring Boot stack, we recommend visiting the original repository at [spring-petclinic-microservices](https://github.com/spring-petclinic/spring-petclinic-microservices).

In the following, we will focus on how customers can set up the current sample application to explore the features of Application Signals.

# Disclaimer

This code for sample application is intended for demonstration purposes only. It should not be used in a production environment or in any setting where reliability/security is a concern.

# Prerequisite

## Option 1: Using AWS CodeBuild (Recommended - No Local Setup Required)
* AWS CLI 2.x is installed. For more information about installing the AWS CLI, see [Install or update the latest version of the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).
* AWS CDK >= v2.1024.0 is installed - https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_install
* Node.js >= v18.0.0 is installed.

## Option 2: Local Build Environment
* Linux x86-64 or macOS (Intel or Apple Silicon). macOS users: see the [ECS Demo macOS notes](#macos-notes) — the default Maven `buildDocker` profile does not work on macOS.
* Docker is installed and running (Docker Desktop, Colima, or Rancher Desktop).
* AWS CLI 2.x is installed. For more information about installing the AWS CLI, see [Install or update the latest version of the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).
* Java 17 (Amazon Corretto recommended).
* Golang is installed.

## Additional Prerequisites for Deployment
* kubectl is installed - https://docs.aws.amazon.com/eks/latest/userguide/install-kubectl.html
* eksctl is installed - https://docs.aws.amazon.com/eks/latest/userguide/eksctl.html
* jq is installed - https://jqlang.github.io/jq/download/
* AWS CDK >= v2.1024.0 is installed - https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_install
* Node.js >= v18.0.0 is installed.
* Golang is installed.
* [Optional] If you plan to install the infrastructure resources using Terraform, terraform cli is required. https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli
* [Optional] If you want to try out AWS Bedrock/GenAI support with Application Signals, enable Amazon Titian, Anthropic Claude, Meta Llama foundation models by following the instructions in https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html
# EKS demo

## Deploy via Shell Scripts

### Build the sample application images and push to ECR

#### Option 1: Using AWS CodeBuild (Recommended - No Local Build Environment Required)

AWS CodeBuild eliminates the need for local Docker and build tools. The build process runs entirely in AWS.

1. Deploy the CodeBuild infrastructure. Replace `region-name` with your desired AWS region (e.g., `us-east-1`):

``` shell
cd cdk/codebuild
npm install
export AWS_REGION=region-name  # Set your desired region
cdk bootstrap  # First time only - bootstraps CDK in the specified region
cdk deploy     # Deploys the CodeBuild stack to the specified region
```

   To clean up the CodeBuild infrastructure when no longer needed:
   ``` shell
   cd cdk/codebuild
   export AWS_REGION=region-name  # Use the same region where you deployed
   cdk destroy
   ```
   This will remove the CodeBuild project, S3 bucket, IAM roles, and CloudWatch logs. Note: ECR repositories with Docker images are not deleted automatically.

2. Trigger a build to create and push all images to ECR. Replace `region-name` with the region you choose (e.g. `us-east-1`)

``` shell
./scripts/trigger-build.sh --region region-name 
```

For more details, see the [CodeBuild README](cdk/codebuild/README.md).

#### Option 2: Local Build

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
1. Set up a EKS cluster and deploy sample app. Replace `region-name` with the region you choose.

   ``` shell
   cd scripts/eks/appsignals && ./setup-eks-demo.sh --region=region-name
   ``` 

2. Access the EKS cluster using kubectl to check pod status and logs:

   ```shell
   # Configure kubectl to use the EKS cluster
   aws eks update-kubeconfig --name eks-pet-clinic-demo --region <your-region> --role-arn arn:aws:iam::<your-account>:role/PetClinicEksClusterRole

   # View the microservices pods
   kubectl get pods -n pet-clinic

   # Get the ingress URL
   kubectl get svc -n ingress-nginx | grep "ingress-nginx" | awk '{print $4}'
   ```

3. Clean up after you are done with the sample app. Replace `region-name` with the same value that you use in previous step.
   ```
   cd scripts/eks/appsignals/ && ./setup-eks-demo.sh --operation=delete --region=region-name
   ```

Please be aware that this sample application includes a publicly accessible Application Load Balancer (ALB), enabling easy interaction with the application. If you perceive this public ALB as a security risk, consider restricting access by employing [security groups](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-update-security-groups.html).


# EC2 Demo
The following instructions describe how to set up the pet clinic sample application on EC2 instances. You can run these steps in your personal AWS account to follow along (Not recommended for production usage).

1. Create resources and deploy sample app. Replace `region-name` with the region you choose.
   ```
   cd scripts/ec2/appsignals/ && ./setup-ec2-demo.sh --region=region-name
   ```


2. Clean up after you are done with the sample app. Replace `region-name` with the same value that you use in previous step.
   ```
   cd scripts/ec2/appsignals/ && ./setup-ec2-demo.sh --operation=delete --region=region-name
   ```


# K8s Demo
The following instructions set up an kubernetes cluster on 2 EC2 instances (one master and one worker node) with kubeadmin and deploy the pet clinic sample application to the cluster. You can run these steps in your personal AWS account to follow along (Not recommended for production usage). 

1. Build container images and push them to public ECR repo

   ``` shell
   ./mvnw clean install -P buildDocker && ./push-public-ecr.sh
   ```

2. Set up a kubernetes cluster and deploy sample app. Replace `region-name` with the region you choose.

   ``` shell
   cd scripts/k8s/appsignals/ && ./setup-k8s-demo.sh --region=region-name
   ``` 

3. Clean up after you are done with the sample app. Replace `region-name` with the same value that you use in previous step.
   ```
   cd scripts/k8s/appsignals/ && ./setup-k8s-demo.sh --operation=delete --region=region-name


# ECS Demo
The following instructions set up an ECS cluster with all services running in Fargate. You can run these steps in your personal AWS account to follow along (Not recommended for production usage).

## macOS notes

The default `./mvnw -P buildDocker` command uses the archived Spotify `docker-maven-plugin`, which does not run on Apple Silicon. On macOS, use [build-docker.sh](build-docker.sh) instead — it drives `docker build` directly against [docker/Dockerfile](docker/Dockerfile). [otel-collector/ocb.sh](otel-collector/ocb.sh) also builds natively on the host (macOS or Linux) and cross-compiles the collector for `linux/amd64`.

Install: `brew install jq wget node go awscli && npm i -g aws-cdk`. Start a Docker daemon (Docker Desktop, Colima, or Rancher Desktop) — for Colima, also `export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock`.

## Deploy

1. Build container images and push them to private ECR. Replace `region-name` with the region you choose.
   ```shell
   export ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
   export REGION=region-name
   ```
   On **Linux x86-64**:
   ```shell
   ./mvnw clean install -P buildDocker && ./push-ecr.sh
   ```
   On **macOS**:
   ```shell
   ./mvnw clean install -DskipTests
   ./build-docker.sh
   ./push-ecr.sh
   ```
   `push-ecr.sh` creates the ECR repos (existing-repo errors are safe to ignore — the script continues) and builds/pushes the Python, Node, .NET, traffic-generator, and otel-collector images inline.

   > **Note:** The ECS CDK stack does not reference `dotnet-petclinic-payment` — that image is only used by the EKS demo. If the .NET build hangs on Apple Silicon (QEMU emulation of `dotnet restore` is very slow), you can safely skip it: `Ctrl-C` `push-ecr.sh` after the Python/Node/traffic-generator/otel-collector images push, and the empty `dotnet-petclinic-payment` ECR repo will not block the ECS deploy.

2. Deploy the ECS cluster and sample app:
   ```shell
   cd scripts/ecs/appsignals && ./setup-ecs-demo.sh --region=region-name
   ```

3. Clean up when done:
   ```shell
   cd scripts/ecs/appsignals && ./setup-ecs-demo.sh --operation=delete --region=region-name
   ```

# Bedrock AgentCore Runtime Demo

The following instructions set up AI agents deployed to Bedrock AgentCore Runtime. You can run these steps in your personal AWS account to follow along (Not recommended for production usage). 

The setup includes:

- **Primary Agent**: A general pet clinic assistant that handles appointment scheduling, clinic information, and emergency contacts. Any nutrition related queries will be delegated to the Nutrition Agent.
- **Nutrition Agent**: A specialized agent focused on pet nutrition, diet recommendations, and feeding guidelines. When deployed with the Pet Clinic EKS demo, it utilizes the pet clinic service API to base its answers on data from the service
- **Traffic Generator**: A Lambda function scheduled via AWS EventBridge that sends queries to the Primary Agent on set a cadence.

**Prerequisites:**
- AWS CLI 2.x configured with appropriate permissions
- AWS CDK >= v2.1024.0 installed
- Node.js >= v18.0.0 installed
- Docker installed and running (for building agent container images)
- Access to Amazon Bedrock foundation models (Claude 3.5 Haiku recommended)

## Setup Instructions

1. **Deploy the agents and traffic generator**. Replace `region-name` with your desired AWS region (e.g., `us-east-1`):

   ```shell
   cd scripts/agents && ./setup-agents-demo.sh --region=region-name
   ```

   The Nutrition Agent relies on the pet clinic service to retrieve pet nutrition information and provide accurate dietary recommendations. To enable this feature:
   
   - The [EKS demo](#eks-demo) must be set up first
   - **The pet clinic service must be exposed as an ingress service** with a publicly accessible URL for the agent to connect to it
   
   The deployment script will attempt to auto-discover the pet clinic service endpoint from your EKS cluster. If auto-discovery fails or you want to specify a custom endpoint, you can manually provide the pet clinic service URL using the `--pet-clinic-url` parameter:

   ```shell
   export MY_PET_CLINIC_ENDPOINT=my-load-balancer.us-east-1.elb.amazonaws.com

   cd scripts/agents && ./setup-agents-demo.sh --region=us-east-1 --pet-clinic-url=http://${MY_PET_CLINIC_ENDPOINT}
   ```

2. **Clean up resources** when finished:

   ```shell
   cd scripts/agents && ./setup-agents-demo.sh --operation=delete --region=region-name
   ```