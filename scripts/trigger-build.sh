#!/bin/bash

# Script to trigger AWS CodeBuild for Application Signals demo
# This script assumes the CodeBuild infrastructure has been deployed via CDK

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
REGION=${AWS_DEFAULT_REGION:-us-east-1}
PROJECT_NAME="application-signals-build"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --region)
            REGION="$2"
            shift 2
            ;;
        --project-name)
            PROJECT_NAME="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --region REGION          AWS region (default: us-east-1 or AWS_DEFAULT_REGION)"
            echo "  --project-name NAME      CodeBuild project name (default: application-signals-build)"
            echo "  --help                   Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${YELLOW}Triggering CodeBuild project...${NC}"
echo "Region: $REGION"
echo "Project: $PROJECT_NAME"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

# Check if the CodeBuild project exists
if ! aws codebuild batch-get-projects --names "$PROJECT_NAME" --region "$REGION" --query "projects[0].name" --output text 2>/dev/null | grep -q "$PROJECT_NAME"; then
    echo -e "${RED}Error: CodeBuild project '$PROJECT_NAME' not found in region '$REGION'${NC}"
    echo "Please ensure the CDK stack has been deployed first:"
    echo "  cd cdk/codebuild && npm install && cdk deploy"
    exit 1
fi

# Trigger the build
echo -e "${YELLOW}Starting build...${NC}"
BUILD_ID=$(aws codebuild start-build \
    --project-name "$PROJECT_NAME" \
    --region "$REGION" \
    --query 'build.id' \
    --output text)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Build started successfully!${NC}"
    echo "Build ID: $BUILD_ID"
    echo ""
    echo "You can monitor the build progress:"
    echo "  1. In the AWS Console: https://console.aws.amazon.com/codesuite/codebuild/projects/${PROJECT_NAME}/history?region=${REGION}"
    echo "  2. Using AWS CLI: aws codebuild batch-get-builds --ids \"$BUILD_ID\" --region $REGION"
    echo "  3. Watch logs: aws logs tail /aws/codebuild/application-signals-build --follow --region $REGION"
else
    echo -e "${RED}Failed to start build${NC}"
    exit 1
fi

# Optional: Wait for build completion
read -p "Do you want to wait for the build to complete? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Waiting for build to complete...${NC}"
    
    while true; do
        STATUS=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --region "$REGION" --query 'builds[0].buildStatus' --output text)
        
        case $STATUS in
            SUCCEEDED)
                echo -e "${GREEN}Build completed successfully!${NC}"
                break
                ;;
            FAILED)
                echo -e "${RED}Build failed!${NC}"
                echo "Check logs for details: aws logs tail /aws/codebuild/application-signals-build --region $REGION"
                exit 1
                ;;
            STOPPED)
                echo -e "${RED}Build was stopped!${NC}"
                exit 1
                ;;
            IN_PROGRESS|SUBMITTED)
                echo -n "."
                sleep 10
                ;;
            *)
                echo -e "${YELLOW}Build status: $STATUS${NC}"
                sleep 10
                ;;
        esac
    done
fi

echo -e "${GREEN}Done!${NC}"
