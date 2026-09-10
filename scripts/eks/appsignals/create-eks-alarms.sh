#!/bin/bash
# Create CloudWatch Alarms for Application Signals SLOs - Workshop Optimized
# Creates alarms for SLO monitoring with debugging support

# Enable debugging if DEBUG=1
if [ "$DEBUG" = "1" ]; then
  set -x
fi

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
REGION=${1:-$(aws configure get region)}
DRY_RUN=${2:-false}

debug_log() {
  echo -e "${BLUE}[DEBUG] $1${NC}"
}

error_exit() {
  echo -e "${RED}[ERROR] $1${NC}"
  exit 1
}

info_log() {
  echo -e "${YELLOW}[INFO] $1${NC}"
}

success_log() {
  echo -e "${GREEN}[SUCCESS] $1${NC}"
}

echo -e "${GREEN}=== Creating Application Signals SLO CloudWatch Alarms ===${NC}"
echo ""

# Prerequisites check
debug_log "Starting prerequisites check..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
  error_exit "AWS CLI not found. Please install AWS CLI."
fi

# Check AWS credentials
debug_log "Checking AWS credentials..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null) || error_exit "AWS credentials not configured or invalid"
success_log "AWS Account ID: $ACCOUNT_ID"

# Validate region
if [ -z "$REGION" ]; then
  error_exit "Region not specified. Usage: $0 <region> [dry-run]"
fi
debug_log "Using region: $REGION"

# Verify region is valid
aws ec2 describe-regions --region-names $REGION &>/dev/null || error_exit "Invalid region: $REGION"
success_log "Region validated: $REGION"

echo ""
info_log "=== Resource Discovery Phase ==="

# Find SNS topic
debug_log "Looking for SNS topic 'rds-alarms-workshop'..."
SNS_TOPIC_ARN=$(aws sns list-topics --region $REGION --query "Topics[?contains(TopicArn, 'rds-alarms-workshop')].TopicArn" --output text)

if [ -z "$SNS_TOPIC_ARN" ]; then
  info_log "SNS topic 'rds-alarms-workshop' not found. Creating it..."
  if [ "$DRY_RUN" = "true" ]; then
    debug_log "[DRY-RUN] Would create SNS topic: rds-alarms-workshop"
    SNS_TOPIC_ARN="arn:aws:sns:$REGION:$ACCOUNT_ID:rds-alarms-workshop"
  else
    SNS_TOPIC_ARN=$(aws sns create-topic --name rds-alarms-workshop --region $REGION --output text --query TopicArn)
  fi
  success_log "SNS Topic: $SNS_TOPIC_ARN"
else
  success_log "Found existing SNS topic: $SNS_TOPIC_ARN"
fi

# Find CloudWatch Investigations groups
debug_log "Looking for CloudWatch Investigations groups..."
INVESTIGATION_ARN=""
if aws aiops list-investigation-groups --region $REGION &>/dev/null; then
  INVESTIGATION_ARN=$(aws aiops list-investigation-groups --region $REGION --query "investigationGroups[0].arn" --output text 2>/dev/null || echo "")
  if [ "$INVESTIGATION_ARN" != "" ] && [ "$INVESTIGATION_ARN" != "None" ]; then
    success_log "Found CloudWatch Investigations group: $INVESTIGATION_ARN"
  else
    info_log "No CloudWatch Investigations groups found. Composite alarm will only use SNS."
  fi
else
  info_log "CloudWatch Investigations not available in this region. Composite alarm will only use SNS."
fi

echo ""
info_log "=== Alarm Creation Phase ==="

# Alarm 1: customers-service-availability-slo
info_log "1. Creating customers-service-availability-slo alarm..."
ALARM_CMD_1="aws cloudwatch put-metric-alarm \
  --alarm-name \"customers-service-availability-slo\" \
  --alarm-description \"This alarms if the AttainmentRate drops to/below 95%\" \
  --metric-name \"AttainmentRate\" \
  --namespace \"AWS/ApplicationSignals\" \
  --statistic \"Average\" \
  --dimensions Name=SloName,Value=customers-service-availability \
  --period 300 \
  --evaluation-periods 1 \
  --datapoints-to-alarm 1 \
  --threshold 95.0 \
  --comparison-operator \"LessThanOrEqualToThreshold\" \
  --treat-missing-data \"missing\" \
  --actions-enabled \
  --alarm-actions \"$SNS_TOPIC_ARN\" \
  --region $REGION"

if [ "$DRY_RUN" = "true" ]; then
  debug_log "[DRY-RUN] Would execute: $ALARM_CMD_1"
else
  debug_log "Executing: $ALARM_CMD_1"
  eval $ALARM_CMD_1 || error_exit "Failed to create customers-service-availability-slo alarm"
fi
success_log "customers-service-availability-slo alarm created"

# Alarm 2: customers-service-latency-slo
info_log "2. Creating customers-service-latency-slo alarm..."
ALARM_CMD_2="aws cloudwatch put-metric-alarm \
  --alarm-name \"customers-service-latency-slo\" \
  --alarm-description \"AttainmentRate\" \
  --metric-name \"AttainmentRate\" \
  --namespace \"AWS/ApplicationSignals\" \
  --statistic \"Average\" \
  --dimensions Name=SloName,Value=customers-service-latency \
  --period 300 \
  --evaluation-periods 1 \
  --datapoints-to-alarm 1 \
  --threshold 99.0 \
  --comparison-operator \"LessThanOrEqualToThreshold\" \
  --treat-missing-data \"missing\" \
  --actions-enabled \
  --alarm-actions \"$SNS_TOPIC_ARN\" \
  --region $REGION"

if [ "$DRY_RUN" = "true" ]; then
  debug_log "[DRY-RUN] Would execute: $ALARM_CMD_2"
else
  debug_log "Executing: $ALARM_CMD_2"
  eval $ALARM_CMD_2 || error_exit "Failed to create customers-service-latency-slo alarm"
fi
success_log "customers-service-latency-slo alarm created"

# Alarm 3: customers-service-slo (Composite Alarm)
info_log "3. Creating customers-service-slo composite alarm..."

# Build alarm actions
COMPOSITE_ACTIONS="\"$SNS_TOPIC_ARN\""
if [ "$INVESTIGATION_ARN" != "" ]; then
  COMPOSITE_ACTIONS="$COMPOSITE_ACTIONS \"$INVESTIGATION_ARN\""
  debug_log "Composite alarm will include CloudWatch Investigations action"
fi

COMPOSITE_CMD="aws cloudwatch put-composite-alarm \
  --alarm-name \"customers-service-slo\" \
  --alarm-rule \"ALARM(\\\"customers-service-latency-slo\\\") OR ALARM(\\\"customers-service-availability-slo\\\")\" \
  --actions-enabled \
  --alarm-actions $COMPOSITE_ACTIONS \
  --region $REGION"

if [ "$DRY_RUN" = "true" ]; then
  debug_log "[DRY-RUN] Would execute: $COMPOSITE_CMD"
else
  debug_log "Executing: $COMPOSITE_CMD"
  eval $COMPOSITE_CMD || error_exit "Failed to create customers-service-slo composite alarm"
fi
success_log "customers-service-slo composite alarm created"

echo ""
success_log "=== All Alarms Created Successfully ==="
echo ""
info_log "Alarm Configuration Summary:"
echo "  • Region: $REGION"
echo "  • Account: $ACCOUNT_ID"
echo "  • SNS Topic: $SNS_TOPIC_ARN"
if [ "$INVESTIGATION_ARN" != "" ]; then
  echo "  • Investigations: $INVESTIGATION_ARN"
fi
echo ""
info_log "Created Alarms:"
echo "  1. customers-service-availability-slo (AttainmentRate <= 95%)"
echo "  2. customers-service-latency-slo (AttainmentRate <= 99%)"
echo "  3. customers-service-slo (Composite: Latency OR Availability)"
echo ""
success_log "View alarms in CloudWatch Console:"
echo "https://console.aws.amazon.com/cloudwatch/home?region=$REGION#alarmsV2:"
echo ""