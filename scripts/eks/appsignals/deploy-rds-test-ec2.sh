#!/bin/bash

# Deploy EC2 instance for RDS testing with Systems Manager access
# Automatically gets VPC, subnet, and security group info from RDS

set -e

STACK_NAME="rds-test-ec2"
TEMPLATE_FILE="rds-test-ec2.yaml"

echo "=== Deploying RDS Test EC2 Instance ==="
echo ""

# Get RDS instance details
echo "Getting RDS instance information..."
RDS_INFO=$(aws rds describe-db-instances --query 'DBInstances[0]' --output json)

if [ -z "$RDS_INFO" ] || [ "$RDS_INFO" == "null" ]; then
    echo "❌ No RDS instance found"
    exit 1
fi

# Extract VPC and subnet information
VPC_ID=$(echo $RDS_INFO | jq -r '.DBSubnetGroup.VpcId')
SECURITY_GROUP_ID=$(echo $RDS_INFO | jq -r '.VpcSecurityGroups[0].VpcSecurityGroupId')
DB_ENDPOINT=$(echo $RDS_INFO | jq -r '.Endpoint.Address')
RDS_ENDPOINT=$(echo $RDS_INFO | jq -r '.Endpoint.Address')

echo "✓ VPC ID: $VPC_ID"
echo "✓ Security Group ID: $SECURITY_GROUP_ID"
echo "✓ RDS Endpoint: $DB_ENDPOINT"

# Get a public subnet from the VPC (prefer public for easier access)
echo ""
echo "Finding suitable subnet..."
SUBNET_ID=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query 'Subnets[?MapPublicIpOnLaunch==`true`] | [0].SubnetId' \
    --output text)

# If no public subnet, use any subnet
if [ -z "$SUBNET_ID" ] || [ "$SUBNET_ID" == "None" ]; then
    echo "No public subnet found, using first available subnet..."
    SUBNET_ID=$(aws ec2 describe-subnets \
        --filters "Name=vpc-id,Values=$VPC_ID" \
        --query 'Subnets[0].SubnetId' \
        --output text)
fi

echo "✓ Subnet ID: $SUBNET_ID"
echo ""

# Deploy CloudFormation stack
echo "Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file "$TEMPLATE_FILE" \
    --stack-name "$STACK_NAME" \
    --parameter-overrides \
        VpcId="$VPC_ID" \
        SubnetId="$SUBNET_ID" \
        SecurityGroupId="$SECURITY_GROUP_ID" \
        RDSEndpoint="$DB_ENDPOINT" \
    --capabilities CAPABILITY_NAMED_IAM \
    --no-fail-on-empty-changeset

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ EC2 instance deployed successfully!"
    echo ""
    
    # Get instance ID
    INSTANCE_ID=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query 'Stacks[0].Outputs[?OutputKey==`InstanceId`].OutputValue' \
        --output text)
    
    PRIVATE_IP=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query 'Stacks[0].Outputs[?OutputKey==`InstancePrivateIp`].OutputValue' \
        --output text)
    
    echo "Instance ID: $INSTANCE_ID"
    echo "Private IP: $PRIVATE_IP"
    echo "RDS Endpoint: $DB_ENDPOINT"
    echo ""
    
    # Wait for instance to be ready
    echo "Waiting for instance to be ready (this may take 2-3 minutes)..."
    aws ec2 wait instance-status-ok --instance-ids "$INSTANCE_ID"
    
    echo ""
    echo "✓ Instance is ready!"
    echo ""
    echo "=== How to Connect ==="
    echo ""
    echo "# Connect via Systems Manager (no SSH key needed!):"
    echo "aws ssm start-session --target $INSTANCE_ID"
    echo ""
    echo "# Or use AWS Console:"
    echo "https://console.aws.amazon.com/systems-manager/session-manager/$INSTANCE_ID"
    echo ""
    echo "=== Quick Start Guide ==="
    echo ""
    echo "1. Connect to instance:"
    echo "   aws ssm start-session --target $INSTANCE_ID"
    echo ""
    echo "2. Navigate to scripts:"
    echo "   cd ~/rds-tests"
    echo ""
    echo "3. View configuration:"
    echo "   source config.sh"
    echo ""
    echo "4. Test RDS (no endpoint needed!):"
    echo "   ./test-connection.sh"
    echo "   ./stress-test.py --queries 500"
    echo ""
    echo "5. Configure kubectl (if EKS exists):"
    echo "   ./configure-kubectl.sh"
    echo "   kubectl get pods -A"
    echo ""
    echo "📖 For full documentation, see README.txt in ~/rds-tests"
    echo ""
else
    echo "❌ Deployment failed"
    exit 1
fi
