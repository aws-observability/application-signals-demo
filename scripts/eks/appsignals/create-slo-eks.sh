#!/bin/bash

# change the directory to the script location so that the relative path can work
cd "$(dirname "$0")"

CLUSTER_NAME=$1
REGION=$2

check_if_step_failed_and_exit() {
  if [ $? -ne 0 ]; then
    echo $1
    exit 1
  fi
}

check_if_loop_failed_and_exit() {
  if [ $1 -ne 0 ]; then
    echo $2
    exit 1
  fi
}

# Get account ID for investigation group policy
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
check_if_step_failed_and_exit "There was an error getting account ID, exiting"

# SLR could be created via console or API. So EnableTopologyDiscovery API is called to enroll topology discovery.
aws application-signals start-discovery --region $REGION
check_if_step_failed_and_exit "There was an error enabling topology discovery, exiting"

# Configure CloudWatch Investigations group policy
echo "Configuring CloudWatch Investigations group policy..."
INVESTIGATION_GROUP_ARN=$(aws aiops list-investigation-groups --region $REGION --query "investigationGroups[0].arn" --output text 2>/dev/null || echo "")
if [ "$INVESTIGATION_GROUP_ARN" != "" ] && [ "$INVESTIGATION_GROUP_ARN" != "None" ]; then
  echo "Found investigation group: $INVESTIGATION_GROUP_ARN"
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
    --region $REGION
  check_if_step_failed_and_exit "There was an error setting investigation group policy, exiting"
  echo "Investigation group policy configured successfully"
else
  echo "No investigation group found, skipping policy configuration"
fi

echo "Creating Service Level Objectives"

# Create customers-service availability SLO
echo "Creating customers-service availability SLO..."
err=0
for i in {1..5}
do
  output=$(aws application-signals create-service-level-objective \
    --name "customers-service-availability" \
    --description "Availability SLO for customers service - 95% success rate" \
    --sli-config '{
      "SliMetricConfig": {
        "KeyAttributes": {
          "Environment": "eks:'$CLUSTER_NAME'/default",
          "Name": "customers-service-java",
          "Type": "Service"
        },
        "OperationName": "InternalOperation",
        "MetricType": "AVAILABILITY"
      },
      "MetricThreshold": 95.0,
      "ComparisonOperator": "GreaterThanOrEqualTo"
    }' \
    --goal '{
      "Interval": {
        "RollingInterval": {
          "DurationUnit": "MINUTE",
          "Duration": 5
        }
      },
      "AttainmentGoal": 95.0,
      "WarningThreshold": 30.0
    }' \
    --region $REGION 2>&1)
  err=$?
  if echo "$output" | grep 'InvalidParameterValue'; then
    echo "Error creating availability SLO. Retrying attempt: $i"
    sleep 120
    continue
  fi
  break
done
if [ $err -ne 0 ]; then
  echo "ERROR: Failed to create customers-service availability SLO"
  echo "AWS API Response: $output"
  exit 1
fi
echo "SUCCESS: $output"

# Create customers-service latency SLO
echo "Creating customers-service latency SLO..."
err=0
for i in {1..5}
do
  output=$(aws application-signals create-service-level-objective \
    --name "customers-service-latency" \
    --description "Latency SLO for customers service - 99% under 100ms" \
    --sli-config '{
      "SliMetricConfig": {
        "KeyAttributes": {
          "Environment": "eks:'$CLUSTER_NAME'/default",
          "Name": "customers-service-java",
          "Type": "Service"
        },
        "OperationName": "InternalOperation",
        "MetricType": "LATENCY",
        "Statistic": "Average"
      },
      "MetricThreshold": 100.0,
      "ComparisonOperator": "LessThan"
    }' \
    --goal '{
      "Interval": {
        "RollingInterval": {
          "DurationUnit": "MINUTE",
          "Duration": 5
        }
      },
      "AttainmentGoal": 99.0,
      "WarningThreshold": 30.0
    }' \
    --region $REGION 2>&1)
  err=$?
  if echo "$output" | grep 'InvalidParameterValue'; then
    echo "Error creating latency SLO. Retrying attempt: $i"
    sleep 120
    continue
  fi
  break
done
if [ $err -ne 0 ]; then
  echo "ERROR: Failed to create customers-service latency SLO"
  echo "AWS API Response: $output"
  exit 1
fi
echo "SUCCESS: $output"