# Lambda PetClinic CDK

This directory contains the AWS CDK implementation of the Lambda PetClinic application infrastructure.

## Prerequisites

- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html) >= 2.186.0
- [Node.js](https://nodejs.org/en/download/) >= 18.0.0
- [TypeScript](https://www.typescriptlang.org/download) >= 5.0.0
- [Docker](https://www.docker.com/get-started) (for local bundling of Lambda assets)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Build the TypeScript code:

```bash
npm run build
```

## Usage

### Deploy the Stack

To deploy the infrastructure:

```bash
./deploy.sh
```

Or manually:

```bash
npm run build
cdk bootstrap  # Only needed once per AWS account/region
cdk deploy
```

Unlike the Terraform version, the CDK implementation doesn't require running `installDemo.sh` first. The CDK code automatically handles packaging the Lambda functions during deployment by using the `bundling` feature.

### Clean Up

To destroy the created resources:

```bash
./destroy.sh
```

Or manually:

```bash
cdk destroy
```

## Stack Resources

The CDK stack creates the following AWS resources:

1. **DynamoDB Table** for storing appointment records
2. **IAM Role** for Lambda function execution
3. **Lambda Functions**:
   - appointment-service-create
   - appointment-service-list
   - appointment-service-get (with multiple versions from different code sources)
   - HttpRequesterFunction
4. **S3 Bucket** for storing alternate Lambda code implementation
5. **Lambda Alias with Weighted Routing**:
   - Custom resource that handles versioning and routing between versions
   - 50% traffic to original implementation
   - 50% traffic to different implementation
6. **API Gateway** with endpoints for each function
7. **EventBridge Rule** to trigger the HttpRequester function every minute

## Advanced Lambda Versioning and Routing

This implementation demonstrates an advanced pattern for Lambda versioning and weighted routing:

1. A single Lambda function is deployed with the original implementation
2. A custom resource handles the deployment of multiple versions:
   - Publishes the original version as v1
   - Updates the function code with an alternate implementation
   - Publishes that as v2
   - Creates an alias with weighted routing between both versions

3. The weighted routing is configured to send:
   - 50% of traffic to v1 (original implementation)
   - 50% of traffic to v2 (different implementation)

4. API Gateway points to the function's alias, making the routing transparent to clients

This approach allows testing multiple implementations of the same function without needing to create separate Lambda functions.

## Custom Resource Implementation

The stack uses a custom resource (`lambda-version-resource.ts`) to handle complex Lambda operations that aren't directly available in CDK:

1. Publishing multiple versions of a Lambda function
2. Updating function code during deployment 
3. Setting up weighted routing between versions
4. Managing Lambda aliases

This enables sophisticated deployment patterns like canary releases, A/B testing, and phased rollouts.

## Lambda Packaging

The Lambda functions are automatically bundled during deployment using CDK's asset bundling feature. For each Lambda function:

1. The source code is read from the appropriate directory
2. Dependencies from the `requirements.txt` file are installed
3. The code and dependencies are packaged together
4. The package is uploaded to S3 and referenced by the Lambda function

For the alternate implementation, a separate S3 bucket is used to store the code that will be deployed during the versioning process.

## OpenTelemetry Integration

The Lambda functions are configured with the AWS OpenTelemetry layer for distributed tracing and instrumentation with AWS Application Signals.

## Outputs

After deployment, the CDK stack will output the URLs for accessing the API endpoints:

- API Add Record: URL to add a new appointment record
- API List Record: URL to list all appointment records
- API Query Record: URL to query a specific appointment record
- Lambda Version Info: Information about the weighted traffic split