#!/bin/bash

# Run from root directory of data_test, not from deploy directory

# Set variables
# Change this to your lambda function name
LAMBDA_FUNCTION_NAME="APM_Demo_Test_Runner"
LAMBDA_DIR="../lambda"
DEPLOY_DIR="deploy_package"
ZIP_FILE="lambda_deployment.zip"
AWS_REGION=${1:-us-east-1}

# Parse command line arguments
while getopts "z:r:" opt; do
  case $opt in
    z) ZIP_FILE="$OPTARG";;
    r) AWS_REGION="$OPTARG";;
    \?) echo "invalid option: -$OPTARG" >&2; exit 1;;
  esac
done

# Create temporary deployment directory
echo "Creating temporary deployment directory..."
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

# Copy only specific file types
echo "Copying Lambda function files..."
cp $LAMBDA_DIR/*.py $DEPLOY_DIR/
cp *.json $DEPLOY_DIR/
cp *.txt $DEPLOY_DIR/

# Create deployment package
echo "Creating deployment package..."
cd $DEPLOY_DIR
zip -r ../$ZIP_FILE .
cd ..

# Ask if you want to deploy to Lambda
read -p "Do you want to deploy to Lambda in region $AWS_REGION? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    # Update Lambda function
    # Profile line is for mac laptop and ada ONLY
    echo "Updating Lambda function..."
    aws lambda update-function-code \
        --function-name $LAMBDA_FUNCTION_NAME \
        --zip-file fileb://$ZIP_FILE \
        --region $AWS_REGION | cat
fi

# Ask if you want to clean up temporary files
read -p "Do you want to clean up temporary files? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    # Clean up temporary files
    echo "Cleaning up temporary files..."
    rm -rf $DEPLOY_DIR
    rm $ZIP_FILE
fi

echo "Operation completed!" 