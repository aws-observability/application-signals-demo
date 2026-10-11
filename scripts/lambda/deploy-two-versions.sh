#!/bin/bash

# Script to deploy a Lambda function with 2 versions
# Version 1: app.py
# Version 2: app2.py

set -e

STACK_NAME="BillingInfoStack"
FUNCTION_NAME="BillingInfo"
AWS_REGION="us-east-2"

echo "=== Deploy Lambda with 2 Versions ==="
echo "Region: $AWS_REGION"
echo ""

# Step 1: Initial deployment with app.py
echo "Step 1: Deploying initial version with app.py..."
cp src/app.py src/lambda_handler.py
sam build
sam deploy --stack-name $STACK_NAME --region $AWS_REGION --resolve-s3 --capabilities CAPABILITY_NAMED_IAM --no-confirm-changeset --no-fail-on-empty-changeset

# Wait for stack to be complete
echo "Waiting for stack to be complete..."
aws cloudformation wait stack-create-complete --stack-name $STACK_NAME --region $AWS_REGION 2>/dev/null || \
aws cloudformation wait stack-update-complete --stack-name $STACK_NAME --region $AWS_REGION 2>/dev/null || true

# Publish version 1
echo ""
echo "Step 2: Publishing version 1..."
VERSION_1=$(aws lambda publish-version \
  --function-name $FUNCTION_NAME \
  --region $AWS_REGION \
  --description "Version 1 - app.py" \
  --query 'Version' \
  --output text)
echo "Version 1 published: $VERSION_1"

# Step 3: Update code to app2.py
echo ""
echo "Step 3: Updating code to app2.py..."
cp src/app2.py src/lambda_handler.py
sam build

# Create zip of updated code
cd .aws-sam/build/BillingInfoProcessor
zip -r ../function.zip . > /dev/null
cd ../../..

aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --region $AWS_REGION \
  --zip-file fileb://.aws-sam/build/function.zip \
  > /dev/null

# Wait for function update
echo "Waiting for function update..."
aws lambda wait function-updated --function-name $FUNCTION_NAME --region $AWS_REGION

# Publish version 2
echo ""
echo "Step 4: Publishing version 2..."
VERSION_2=$(aws lambda publish-version \
  --function-name $FUNCTION_NAME \
  --region $AWS_REGION \
  --description "Version 2 - app2.py" \
  --query 'Version' \
  --output text)
echo "Version 2 published: $VERSION_2"

# Step 5: Revert to app.py (leave $LATEST with app.py)
echo ""
echo "Step 5: Reverting \$LATEST to app.py..."
cp src/app.py src/lambda_handler.py
sam build

# Create zip of reverted code
cd .aws-sam/build/BillingInfoProcessor
zip -r ../function.zip . > /dev/null
cd ../../..

aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --region $AWS_REGION \
  --zip-file fileb://.aws-sam/build/function.zip \
  > /dev/null

# Clean up temporary files
rm -f src/lambda_handler.py
rm -f .aws-sam/build/function.zip

echo ""
echo "=== Deploy Complete ==="
echo "Function: $FUNCTION_NAME"
echo "Version 1 (app.py): $VERSION_1"
echo "Version 2 (app2.py): $VERSION_2"
echo "\$LATEST: app.py"
echo ""
echo "EventBridge Scheduler is configured to use Version 1"
echo "IAM Policy allows only Version 1"
