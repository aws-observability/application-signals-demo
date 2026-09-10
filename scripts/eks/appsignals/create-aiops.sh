#!/bin/bash
# Create CloudWatch AIOps Investigation Group - Workshop Script
# This script creates the IAM role and CloudWatch investigation group for AIOps

REGION=${1:-us-east-2}

check_if_step_failed_and_exit() {
  if [ $? -ne 0 ]; then
    echo "ERROR: $1"
    exit 1
  fi
}

echo "=== Creating CloudWatch AIOps Investigation Group ==="
echo "Region: $REGION"
echo ""

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
check_if_step_failed_and_exit "Failed to get account ID"
echo "Account ID: $ACCOUNT_ID"

# Generate unique role name
RANDOM_SUFFIX=$(date +%s | tail -c 6)
ROLE_NAME="AIOpsRole-DefaultInvestigationGroup-$RANDOM_SUFFIX"
echo "IAM Role Name: $ROLE_NAME"
echo ""

# Create IAM role for AIOps
echo "Creating IAM role for AIOps..."
aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "aiops.amazonaws.com"
        },
        "Action": "sts:AssumeRole",
        "Condition": {
          "StringEquals": {
            "aws:SourceAccount": "'$ACCOUNT_ID'"
          },
          "ArnLike": {
            "aws:SourceArn": "arn:aws:aiops:'$REGION':'$ACCOUNT_ID':*"
          }
        }
      }
    ]
  }' \
  --region $REGION > /dev/null
check_if_step_failed_and_exit "Failed to create IAM role"
echo "✓ IAM role created: $ROLE_NAME"

# Attach required AWS managed policies
echo "Attaching AWS managed policies..."
aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/AIOpsAssistantPolicy"
check_if_step_failed_and_exit "Failed to attach AIOpsAssistantPolicy"

aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/AIOpsAssistantIncidentReportPolicy"
check_if_step_failed_and_exit "Failed to attach AIOpsAssistantIncidentReportPolicy"

aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/AmazonRDSPerformanceInsightsFullAccess"
check_if_step_failed_and_exit "Failed to attach AmazonRDSPerformanceInsightsFullAccess"
echo "✓ AWS managed policies attached"

# Wait for role to be available
echo "Waiting for IAM role to be available..."
sleep 10

# Create CloudWatch investigation group
echo "Creating CloudWatch investigation group..."
ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"
INVESTIGATION_GROUP_ARN=$(aws aiops create-investigation-group \
  --name "DefaultInvestigationGroup" \
  --role-arn "$ROLE_ARN" \
  --region $REGION \
  --query "arn" --output text)
check_if_step_failed_and_exit "Failed to create investigation group"
echo "✓ Investigation group created: $INVESTIGATION_GROUP_ARN"
echo ""

# Configure investigation group resource policy
echo "Configuring investigation group resource policy..."
aws aiops put-investigation-group-policy \
  --identifier "$INVESTIGATION_GROUP_ARN" \
  --policy '{
    "Version": "2008-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "aiops.alarms.cloudwatch.amazonaws.com"
        },
        "Action": [
          "aiops:CreateInvestigation",
          "aiops:CreateInvestigationEvent"
        ],
        "Resource": "*",
        "Condition": {
          "StringEquals": {
            "aws:SourceAccount": "'$ACCOUNT_ID'"
          },
          "ArnLike": {
            "aws:SourceArn": "arn:aws:cloudwatch:'$REGION':'$ACCOUNT_ID':alarm:*"
          }
        }
      }
    ]
  }' \
  --region $REGION > /dev/null
check_if_step_failed_and_exit "Failed to set investigation group policy"
echo "✓ Investigation group resource policy configured"

echo ""
echo "=== CloudWatch AIOps Setup Complete ==="
echo "Investigation Group: $INVESTIGATION_GROUP_ARN"
echo "IAM Role: $ROLE_ARN"
echo ""