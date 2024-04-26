#!/bin/bash

# change the directory to the script location so that the relative path can work
cd "$(dirname "$0")"

CLUSTER_NAME=$1
REGION=$2
SERVICE_NAME="pet-clinic-frontend-java"

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

# Add model to aws cli for new aws cloudwatch commands. It is not required after SDK is released
aws configure add-model --service-model file://slo/monitoring-2010-08-01.normal.json --service-name cloudwatch
check_if_step_failed_and_exit "There was an error adding the model to aws cli, exiting"

# SLR could be created via console or API. So EnableTopologyDiscovery API is called to enroll topology discovery.
aws cloudwatch enable-topology-discovery --region $REGION
check_if_step_failed_and_exit "There was an error enabling topology discovery, exiting"

# Pause for synthetics canaries to generate traffic
echo "Wait 10 minutes for canaries to generate traffic"
sleep 600

echo "Creating Service Level Objectives"

# List services
end_time=$(date +%s)
end_time_as_int=$((end_time))
# Start time is 24 hours ago
start_time_as_int=$((end_time-86400))
LIST_SERVICES_REQUEST="slo/inputRequest/ListServices/listServices.json"
# Replace startTime and endTime in the request template with correct timestamps
LIST_SERVICES_REQUEST_WITH_CORRECT_INPUT=$(sed -e "s|\"StartTime\": .*|\"StartTime\": $start_time_as_int,|" -e "s|\"EndTime\": .*|\"EndTime\": $end_time_as_int|"  "$LIST_SERVICES_REQUEST")

# Get attribute reference id
REFERENCE_ID=$(aws cloudwatch list-services \
               --cli-input-json "$LIST_SERVICES_REQUEST_WITH_CORRECT_INPUT" \
               --output text --query "AttributeSets[?contains(Attributes[?Name=='EKS.Cluster'].Value, '$CLUSTER_NAME')].ReferenceId" \
               --region $REGION)
echo "Reference_Id"
echo $REFERENCE_ID

# Use reference id to retrieve the service arn
SERVICE_ARN_THROUGH_ATTRIBUTES_SET=$(aws cloudwatch list-services \
                                    --cli-input-json "$LIST_SERVICES_REQUEST_WITH_CORRECT_INPUT" \
                                    --output text --query "ServiceSummaries[?AttributesReferenceId=='$REFERENCE_ID' && Name=='$SERVICE_NAME'].Id" \
                                    --region $REGION)

echo SERVICE_ARN_THROUGH_ATTRIBUTES_SET
echo "$SERVICE_ARN_THROUGH_ATTRIBUTES_SET"

SERVICE_ARN_THROUGH_ATTRIBUTES=$(aws cloudwatch list-services \
 --cli-input-json "$LIST_SERVICES_REQUEST_WITH_CORRECT_INPUT" \
 --output text --query "ServiceSummaries[?Name=='$SERVICE_NAME'].Id" \
 --region $REGION)

echo SERVICE_ARN_THROUGH_ATTRIBUTES
echo "$SERVICE_ARN_THROUGH_ATTRIBUTES"

if [ "$SERVICE_ARN_THROUGH_ATTRIBUTES_SET" = "" ]; then
  SERVICE_ARN="$SERVICE_ARN_THROUGH_ATTRIBUTES"
else
  SERVICE_ARN="$SERVICE_ARN_THROUGH_ATTRIBUTES_SET"
fi

echo $SERVICE_ARN
if [ "$SERVICE_ARN" = "" ]; then
  echo "The SERVICE_ARN should not be null, exiting"
  exit 1
fi

# Create SLOs

CREATE_SLO_REQUEST_1="slo/inputRequest/CreateServiceLevelObjective/getOwner99Availability.json"
# Update service arn in the request
CREATE_SLO_REQUEST_WITH_CORRECT_SERVICE_ARN_1=$(sed "s|\"ServiceId\": .*|\"ServiceId\": \"$SERVICE_ARN\",|" "$CREATE_SLO_REQUEST_1")
err=0
for i in {1..5}
do
  output=$(aws cloudwatch create-service-level-objective --cli-input-json "$CREATE_SLO_REQUEST_WITH_CORRECT_SERVICE_ARN_1" --no-cli-pager --region $REGION 2>&1)
  err=$?
  if echo "$output" | grep 'InvalidParameterValue'; then
    echo "Error creating SLO. Retrying attempt: $i"
    sleep 120
    continue
  fi
  break
done
check_if_loop_failed_and_exit $err "There was an error updating the service arn, exiting"
echo "$output"

CREATE_SLO_REQUEST_2="slo/inputRequest/CreateServiceLevelObjective/getOwnerP99Latency.json"
# Update service arn in the request
CREATE_SLO_REQUEST_WITH_CORRECT_SERVICE_ARN_2=$(sed "s|\"ServiceId\": .*|\"ServiceId\": \"$SERVICE_ARN\",|" "$CREATE_SLO_REQUEST_2")
err=0
for i in {1..5}
do
  output=$(aws cloudwatch create-service-level-objective --cli-input-json "$CREATE_SLO_REQUEST_WITH_CORRECT_SERVICE_ARN_2" --no-cli-pager --region $REGION 2>&1)
  err=$?
  if echo "$output" | grep 'InvalidParameterValue'; then
    echo "Error creating SLO. Retrying attempt: $i"
    sleep 120
    continue
  fi
  break
done
check_if_loop_failed_and_exit $err "There was an error updating the service arn, exiting"
echo "$output"

CREATE_SLO_REQUEST_3="slo/inputRequest/CreateServiceLevelObjective/postOwner99Availability.json"
# Update service arn in the request
CREATE_SLO_REQUEST_WITH_CORRECT_SERVICE_ARN_3=$(sed "s|\"ServiceId\": .*|\"ServiceId\": \"$SERVICE_ARN\",|" "$CREATE_SLO_REQUEST_3")
err=0
for i in {1..5}
do
  output=$(aws cloudwatch create-service-level-objective --cli-input-json "$CREATE_SLO_REQUEST_WITH_CORRECT_SERVICE_ARN_3" --no-cli-pager --region $REGION 2>&1)
  err=$?
  if echo "$output" | grep 'InvalidParameterValue'; then
    echo "Error creating SLO. Retrying attempt: $i"
    sleep 120
    continue
  fi
  break
done
check_if_loop_failed_and_exit $err "There was an error updating the service arn, exiting"
echo "$output"

CREATE_SLO_REQUEST_4="slo/inputRequest/CreateServiceLevelObjective/postOwnerP99Latency.json"
# Update service arn in the request
CREATE_SLO_REQUEST_WITH_CORRECT_SERVICE_ARN_4=$(sed "s|\"ServiceId\": .*|\"ServiceId\": \"$SERVICE_ARN\",|" "$CREATE_SLO_REQUEST_4")
err=0
for i in {1..5}
do
  output=$(aws cloudwatch create-service-level-objective --cli-input-json "$CREATE_SLO_REQUEST_WITH_CORRECT_SERVICE_ARN_4" --no-cli-pager --region $REGION 2>&1)
  err=$?
  if echo "$output" | grep 'InvalidParameterValue'; then
    echo "Error creating SLO. Retrying attempt: $i"
    sleep 120
    continue
  fi
  break
done
check_if_loop_failed_and_exit $err "There was an error updating the service arn, exiting"
echo "$output"
