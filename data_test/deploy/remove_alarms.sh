#!/bin/bash

# 设置默认 region
REGION=${1:-us-east-1}

# Delete all alarms in the region starts with APMDemoTest

# Get all alarms in the region
alarms=$(aws cloudwatch describe-alarms --region $REGION --alarm-name-prefix APMDemoTest --query 'MetricAlarms[].AlarmName' --output text)

echo "Alarms to delete in region $REGION:"
echo $alarms

# Delete all alarms in the region starts with APMDemoTest
aws cloudwatch delete-alarms --region $REGION --alarm-names $alarms
