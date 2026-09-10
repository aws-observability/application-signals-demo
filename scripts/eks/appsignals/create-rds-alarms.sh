#!/bin/bash
# Create CloudWatch Alarms for RDS PostgreSQL - Workshop Optimized
# Alarms are configured to trigger quickly for demonstration purposes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Creating RDS CloudWatch Alarms ===${NC}"
echo ""

# Get RDS instance identifier
echo -e "${YELLOW}Getting RDS instance...${NC}"
RDS_IDENTIFIER=$(aws rds describe-db-instances \
  --query "DBInstances[0].DBInstanceIdentifier" \
  --output text)

if [ -z "$RDS_IDENTIFIER" ] || [ "$RDS_IDENTIFIER" == "None" ]; then
  echo -e "${RED}Error: No RDS instance found${NC}"
  exit 1
fi

echo -e "${GREEN}✓ RDS Instance: $RDS_IDENTIFIER${NC}"
echo ""

# Get SNS topic ARN (if exists)
SNS_TOPIC_ARN=$(aws sns list-topics --query "Topics[?contains(TopicArn, 'alarm') || contains(TopicArn, 'alert')].TopicArn" --output text | head -1)

if [ -z "$SNS_TOPIC_ARN" ]; then
  echo -e "${YELLOW}No SNS topic found. Creating one...${NC}"
  SNS_TOPIC_ARN=$(aws sns create-topic --name rds-alarms-workshop --output text --query TopicArn)
  echo -e "${GREEN}✓ Created SNS Topic: $SNS_TOPIC_ARN${NC}"
fi

echo ""
echo -e "${YELLOW}Creating alarms (optimized for quick triggering)...${NC}"
echo ""

# Alarm 1: High CPU Utilization (triggers quickly)
echo -e "${GREEN}1. Creating CPU Utilization alarm...${NC}"
aws cloudwatch put-metric-alarm \
  --alarm-name "RDS-HighCPU-Workshop" \
  --alarm-description "RDS CPU above 70% - Workshop Demo" \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --statistic Average \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 70 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=DBInstanceIdentifier,Value=$RDS_IDENTIFIER \
  --alarm-actions $SNS_TOPIC_ARN \
  --treat-missing-data notBreaching

echo -e "${GREEN}✓ CPU alarm created (threshold: 70%, period: 1 min)${NC}"

# Alarm 2: High Database Connections
echo -e "${GREEN}2. Creating Database Connections alarm...${NC}"
aws cloudwatch put-metric-alarm \
  --alarm-name "RDS-HighConnections-Workshop" \
  --alarm-description "RDS connections above 50 - Workshop Demo" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Average \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=DBInstanceIdentifier,Value=$RDS_IDENTIFIER \
  --alarm-actions $SNS_TOPIC_ARN \
  --treat-missing-data notBreaching

echo -e "${GREEN}✓ Connections alarm created (threshold: 50, period: 1 min)${NC}"

# Alarm 3: High Read IOPS
echo -e "${GREEN}3. Creating Read IOPS alarm...${NC}"
aws cloudwatch put-metric-alarm \
  --alarm-name "RDS-HighReadIOPS-Workshop" \
  --alarm-description "RDS Read IOPS above 1000 - Workshop Demo" \
  --metric-name ReadIOPS \
  --namespace AWS/RDS \
  --statistic Average \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=DBInstanceIdentifier,Value=$RDS_IDENTIFIER \
  --alarm-actions $SNS_TOPIC_ARN \
  --treat-missing-data notBreaching

echo -e "${GREEN}✓ Read IOPS alarm created (threshold: 1000, period: 1 min)${NC}"

# Alarm 4: High Write IOPS
echo -e "${GREEN}4. Creating Write IOPS alarm...${NC}"
aws cloudwatch put-metric-alarm \
  --alarm-name "RDS-HighWriteIOPS-Workshop" \
  --alarm-description "RDS Write IOPS above 1000 - Workshop Demo" \
  --metric-name WriteIOPS \
  --namespace AWS/RDS \
  --statistic Average \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=DBInstanceIdentifier,Value=$RDS_IDENTIFIER \
  --alarm-actions $SNS_TOPIC_ARN \
  --treat-missing-data notBreaching

echo -e "${GREEN}✓ Write IOPS alarm created (threshold: 1000, period: 1 min)${NC}"

# Alarm 5: High Read Latency
echo -e "${GREEN}5. Creating Read Latency alarm...${NC}"
aws cloudwatch put-metric-alarm \
  --alarm-name "RDS-HighReadLatency-Workshop" \
  --alarm-description "RDS Read Latency above 10ms - Workshop Demo" \
  --metric-name ReadLatency \
  --namespace AWS/RDS \
  --statistic Average \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 0.01 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=DBInstanceIdentifier,Value=$RDS_IDENTIFIER \
  --alarm-actions $SNS_TOPIC_ARN \
  --treat-missing-data notBreaching

echo -e "${GREEN}✓ Read Latency alarm created (threshold: 10ms, period: 1 min)${NC}"

# Alarm 6: High Write Latency
echo -e "${GREEN}6. Creating Write Latency alarm...${NC}"
aws cloudwatch put-metric-alarm \
  --alarm-name "RDS-HighWriteLatency-Workshop" \
  --alarm-description "RDS Write Latency above 10ms - Workshop Demo" \
  --metric-name WriteLatency \
  --namespace AWS/RDS \
  --statistic Average \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 0.01 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=DBInstanceIdentifier,Value=$RDS_IDENTIFIER \
  --alarm-actions $SNS_TOPIC_ARN \
  --treat-missing-data notBreaching

echo -e "${GREEN}✓ Write Latency alarm created (threshold: 10ms, period: 1 min)${NC}"

# Alarm 7: Freeable Memory Low
echo -e "${GREEN}7. Creating Freeable Memory alarm...${NC}"
aws cloudwatch put-metric-alarm \
  --alarm-name "RDS-LowMemory-Workshop" \
  --alarm-description "RDS Freeable Memory below 500MB - Workshop Demo" \
  --metric-name FreeableMemory \
  --namespace AWS/RDS \
  --statistic Average \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 524288000 \
  --comparison-operator LessThanThreshold \
  --dimensions Name=DBInstanceIdentifier,Value=$RDS_IDENTIFIER \
  --alarm-actions $SNS_TOPIC_ARN \
  --treat-missing-data notBreaching

echo -e "${GREEN}✓ Memory alarm created (threshold: 500MB, period: 1 min)${NC}"

# Alarm 8: DynamoDB High Write Capacity
echo -e "${GREEN}8. Creating DynamoDB Write Capacity alarm...${NC}"

# Get DynamoDB table name
DYNAMODB_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@, 'PetClinicPayment') || contains(@, 'Payment')]" --output text | head -1)

if [ -z "$DYNAMODB_TABLE" ]; then
  echo -e "${YELLOW}⚠ No DynamoDB table found (PetClinicPayment). Skipping DynamoDB alarm.${NC}"
else
  aws cloudwatch put-metric-alarm \
    --alarm-name "DynamoDB-Throttle-Alarm" \
    --alarm-description "DynamoDB Write Capacity above 5 - Workshop Demo" \
    --metric-name ConsumedWriteCapacityUnits \
    --namespace AWS/DynamoDB \
    --statistic Sum \
    --period 60 \
    --evaluation-periods 1 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=TableName,Value=$DYNAMODB_TABLE \
    --alarm-actions $SNS_TOPIC_ARN \
    --treat-missing-data notBreaching

  echo -e "${GREEN}✓ DynamoDB alarm created (table: $DYNAMODB_TABLE, threshold: 5 WCU, period: 1 min)${NC}"
fi

echo ""
echo -e "${GREEN}=== Alarms Created Successfully ===${NC}"
echo ""
echo -e "${YELLOW}Alarm Configuration:${NC}"
echo "  • Period: 1 minute (fast triggering for workshop)"
echo "  • Evaluation Periods: 1 (immediate alert)"
echo "  • SNS Topic: $SNS_TOPIC_ARN"
echo ""
echo -e "${YELLOW}Created Alarms:${NC}"
echo "  1. RDS-HighCPU-Workshop (CPU > 70%)"
echo "  2. RDS-HighConnections-Workshop (Connections > 50)"
echo "  3. RDS-HighReadIOPS-Workshop (Read IOPS > 1000)"
echo "  4. RDS-HighWriteIOPS-Workshop (Write IOPS > 1000)"
echo "  5. RDS-HighReadLatency-Workshop (Read Latency > 10ms)"
echo "  6. RDS-HighWriteLatency-Workshop (Write Latency > 10ms)"
echo "  7. RDS-LowMemory-Workshop (Memory < 500MB)"
if [ ! -z "$DYNAMODB_TABLE" ]; then
  echo "  8. DynamoDB-Throttle-Alarm (Write Capacity > 5 WCU)"
fi
echo ""
echo -e "${GREEN}View alarms in CloudWatch:${NC}"
echo "https://console.aws.amazon.com/cloudwatch/home?region=us-east-2#alarmsV2:"
echo ""
echo -e "${YELLOW}To trigger alarms, run:${NC}"
echo "./rds-stress-test.sh"
echo ""
echo -e "${YELLOW}To delete alarms after workshop:${NC}"
if [ ! -z "$DYNAMODB_TABLE" ]; then
  echo "aws cloudwatch delete-alarms --alarm-names RDS-HighCPU-Workshop RDS-HighConnections-Workshop RDS-HighReadIOPS-Workshop RDS-HighWriteIOPS-Workshop RDS-HighReadLatency-Workshop RDS-HighWriteLatency-Workshop RDS-LowMemory-Workshop DynamoDB-Throttle-Alarm"
else
  echo "aws cloudwatch delete-alarms --alarm-names RDS-HighCPU-Workshop RDS-HighConnections-Workshop RDS-HighReadIOPS-Workshop RDS-HighWriteIOPS-Workshop RDS-HighReadLatency-Workshop RDS-HighWriteLatency-Workshop RDS-LowMemory-Workshop"
fi
