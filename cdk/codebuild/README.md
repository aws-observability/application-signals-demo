# AWS CodeBuild for Application Signals Demo

This CDK application sets up AWS CodeBuild to automatically build Docker images for the Application Signals demo, eliminating the need for local development environment setup.

## Overview

The CodeBuild solution:
- Uploads your local repository to S3
- Builds all Spring Boot services using Java 17
- Builds Python, Node.js, .NET services and other components
- Pushes all Docker images to Amazon ECR
- No local Docker or build tools required!

## Architecture

```
Local Repository → S3 Bucket → CodeBuild → ECR Repositories
```

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS CDK v2.1024.0 or later
- Node.js v18.0.0 or later
- An AWS account with permissions to create:
  - S3 buckets
  - CodeBuild projects
  - IAM roles
  - ECR repositories
  - CloudWatch log groups

## Setup Instructions

### 1. Install Dependencies

```bash
cd cdk/codebuild
npm install
```

### 2. Bootstrap CDK (First Time Only)

If you haven't used CDK in your AWS account/region before, you need to bootstrap CDK for the specific region:

```bash
export AWS_REGION=us-east-1  # Replace with your desired region
cdk bootstrap
```

### 3. Deploy the CodeBuild Infrastructure

This command will:
- Create an S3 bucket for source code
- Upload your current local repository to S3
- Create the CodeBuild project with all necessary permissions
- Set up CloudWatch logging

**Important**: Make sure to specify the same region used in the bootstrap step:

```bash
# Option 1: Using environment variable (recommended)
export AWS_REGION=us-east-1  # Replace with your desired region
npm run deploy

# Option 2: Using CDK parameter
cdk deploy --region us-east-1  # Replace with your desired region
```

Or manually:

```bash
export AWS_REGION=us-east-1  # Replace with your desired region
cdk deploy
```

### 4. Trigger a Build

After deployment, you can trigger builds manually. **Important**: Use the same region where you deployed the CodeBuild infrastructure:

```bash
# From the repository root (specify the region where CodeBuild was deployed)
./scripts/trigger-build.sh --region us-east-1

# Or using AWS CLI directly
aws codebuild start-build --project-name application-signals-build --region us-east-1
```

Note: If you don't specify a region, the script defaults to `us-east-1` or the value of `AWS_DEFAULT_REGION`.

## Updating Source Code

When you make changes to your local code and want to build new images:

### Redeploy CDK (Uploads new source)
```bash
cd cdk/codebuild
export AWS_REGION=us-east-1  # Use the same region as initial deployment
cdk deploy
```

Then trigger a new build:
```bash
./scripts/trigger-build.sh --region us-east-1  # Use the same region
```

## Build Process

The CodeBuild project will:

1. **Install Prerequisites**
   - Docker (pre-installed in CodeBuild image)
   - Java 17 (Corretto)
   - Node.js 18
   - jq
   - Golang

2. **Build Spring Boot Services**
   - Run `./mvnw clean install -P buildDocker`

3. **Build and Push All Images**
   - Execute `./push-ecr.sh` to build remaining services and push to ECR

4. **Services Built**
   - Spring Boot microservices (7 services)
   - Python services (insurance, billing)
   - Node.js service (nutrition)
   - .NET service (payment)
   - Traffic generator
   - OpenTelemetry collector

## Monitoring Builds

### View Build Status

1. **AWS Console**: 
   - Navigate to CodeBuild in your AWS Console
   - Select `application-signals-build` project

2. **AWS CLI**:
   ```bash
   # List recent builds (specify your region)
   aws codebuild list-builds-for-project --project-name application-signals-build --region us-east-1
   
   # Get build details
   aws codebuild batch-get-builds --ids <build-id> --region us-east-1
   ```

3. **CloudWatch Logs**:
   ```bash
   # Stream logs (specify your region)
   aws logs tail /aws/codebuild/application-signals-build --follow --region us-east-1
   ```

## Configuration

### Environment Variables

The CodeBuild project automatically sets:
- `AWS_ACCOUNT_ID`: Your AWS account ID
- `AWS_DEFAULT_REGION`: The deployment region

### Build Timeout

Default: 1 hour (configurable in `lib/codebuild-stack.ts`)

### Compute Type

Default: `LARGE` (7 GB memory, 4 vCPUs)

### Caching

The build uses local caching for:
- Docker layers
- Source code
- Maven dependencies

## Troubleshooting

### Build Fails

1. Check CloudWatch logs:
   ```bash
   aws logs tail /aws/codebuild/application-signals-build --region us-east-1
   ```

2. Common issues:
   - **ECR permissions**: Ensure CodeBuild role has ECR permissions
   - **Build timeout**: Increase timeout in CDK stack if needed
   - **Maven errors**: Check Spring Boot service configurations

### Source Upload Issues

If source upload fails:
1. Check S3 bucket permissions
2. Ensure no files exceed S3 limits
3. Review excluded files in `lib/codebuild-stack.ts`

### Cannot Find CodeBuild Project

Ensure the CDK stack is deployed in the correct region:
```bash
cd cdk/codebuild
export AWS_REGION=us-east-1  # Set to your intended region
cdk list  # Should show ApplicationSignalsCodeBuildStack
cdk deploy
```

If the project was deployed to a different region, specify it when triggering builds:
```bash
./scripts/trigger-build.sh --region <actual-deployment-region>
```

## Clean Up

To remove all resources:

```bash
cd cdk/codebuild
export AWS_REGION=us-east-1  # Use the same region where stack was deployed
cdk destroy
```

This will delete:
- CodeBuild project
- S3 bucket and all source code
- IAM roles
- CloudWatch log groups

**Note**: ECR repositories and images are NOT deleted automatically.

## Cost Considerations

- **CodeBuild**: Charged per build minute (Large instance type)
- **S3**: Minimal storage for source code
- **CloudWatch Logs**: 1 month retention
- **ECR**: Storage for Docker images

## Security

- CodeBuild uses IAM roles (no stored credentials)
- S3 bucket has versioning enabled
- Build logs retained for audit
- ECR repositories created on-demand

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review CloudWatch logs
3. Verify IAM permissions
4. Ensure all prerequisites are met
