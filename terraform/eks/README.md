## Deploy via Terraform

Note that this guide is outdated. 

1. Go to the terraform directory under the project. Prepare Terraform S3 backend and set required environment variables

   ``` shell
   cd terraform/eks

   aws s3 mb s3://tfstate-$(uuidgen | tr A-Z a-z)

   export AWS_REGION=us-east-1
   export TFSTATE_KEY=application-signals/demo-applications
   export TFSTATE_BUCKET=$(aws s3 ls --output text | awk '{print $3}' | grep tfstate-)
   export TFSTATE_REGION=$AWS_REGION
   ```

2. Deploy EKS cluster and RDS postgreSQL database.

   ``` shell

   export TF_VAR_cluster_name=app-signals-demo
   export TF_VAR_cloudwatch_observability_addon_version=v2.1.0-eksbuild.1

   terraform init -backend-config="bucket=${TFSTATE_BUCKET}" -backend-config="key=${TFSTATE_KEY}" -backend-config="region=${TFSTATE_REGION}"

   terraform apply --auto-approve
   ```

   The deployment takes 20 - 25 minutes.

3. Build and push docker images

   ``` shell
   cd ../.. 

   ./mvnw clean install -P buildDocker

   export ACCOUNT=`aws sts get-caller-identity | jq .Account -r`
   export REGION=$AWS_REGION

   ./push-ecr.sh
   ```

4. Deploy Kubernetes resources

   Change the cluster-name, alias and region if you configure them differently.

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

   echo "Visit the following URL to see the sample app running: $endpoint"
   ```

7. Cleanup

   Delete ALB ingress, SLOs and Canaries before destroy terraform stack.

   ``` shell

   kubectl delete -f ./scripts/eks/appsignals/sample-app/alb-ingress/petclinic-ingress.yaml

   ./cleanup-slo.sh $REGION

   ./create-canaries.sh $REGION delete

   cd ../../../terraform/eks
   terraform destroy --auto-approve
   ```
