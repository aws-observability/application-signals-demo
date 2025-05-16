#!/bin/bash

# Set variables
LAMBDA_FUNCTION_NAME="APM_Demo_Test_Runner"
AWS_REGION=${1:-us-east-1}

# Ask for confirmation before deletion
read -p "Are you sure you want to delete the Lambda function '$LAMBDA_FUNCTION_NAME' in region $AWS_REGION? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "Deleting Lambda function..."
    aws lambda delete-function \
        --function-name $LAMBDA_FUNCTION_NAME \
        --region $AWS_REGION | cat
    
    if [ $? -eq 0 ]; then
        echo "Lambda function '$LAMBDA_FUNCTION_NAME' has been successfully deleted in region $AWS_REGION."
    else
        echo "Failed to delete Lambda function. Please check the error message above."
        exit 1
    fi
else
    echo "Operation cancelled."
fi 