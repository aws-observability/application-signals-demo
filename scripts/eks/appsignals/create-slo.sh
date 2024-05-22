#!/bin/bash

# change the directory to the script location so that the relative path can work
cd "$(dirname "$0")"

CLUSTER_NAME=$1
REGION=$2
SERVICE_NAME="pet-clinic-frontend-java"
ENDPOINT="https://application-signals.$REGION.api.aws"

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
aws configure add-model --service-model file://slo/application-signals-2024-04-15.normal.json --service-name application-signals
check_if_step_failed_and_exit "There was an error adding the model to aws cli, exiting"

# SLR could be created via console or API. So EnableTopologyDiscovery API is called to enroll topology discovery.
aws application-signals start-discovery --region $REGION --endpoint $ENDPOINT
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


SERVICE_KEY_ATTRIBUTES=$(aws application-signals list-services \
  --endpoint $ENDPOINT --region "us-west-2" \
  --cli-input-json "$LIST_SERVICES_REQUEST_WITH_CORRECT_INPUT" \
  --output json --query "(ServiceSummaries[?KeyAttributes.Name=='$SERVICE_NAME'].KeyAttributes)[0]")

echo $SERVICE_KEY_ATTRIBUTES

if [ "$SERVICE_KEY_ATTRIBUTES" = "" ]; then
  echo "The SERVICE_KEY_ATTRIBUTES should not be null, exiting"
  exit 1
fi

#Remove newlines in the key attributes
KEY_ATTRIBUTES=${SERVICE_KEY_ATTRIBUTES//$'\n'/}

# Create SLOs
CREATE_SLO_REQUEST_1="slo/inputRequest/CreateServiceLevelObjective/getOwner99Availability.json"

# Update service arn in the request
CREATE_SLO_REQUEST_WITH_CORRECT_SERVICE_ARN_1=$(sed "s|\"KeyAttributes\": .*|\"KeyAttributes\": $KEY_ATTRIBUTES,|" "$CREATE_SLO_REQUEST_1")
err=0
for i in {1..5}
do
  output=$(aws application-signals create-service-level-objective --endpoint $ENDPOINT --cli-input-json "$CREATE_SLO_REQUEST_WITH_CORRECT_SERVICE_ARN_1" --no-cli-pager --region "$REGION" 2>&1)
  err=$?
  if echo "$output" | grep 'InvalidParameterValue'; then
    echo "Error creating SLO. Retrying attempt: $i"
    sleep 120
    continue
  fi
  break
done
check_if_loop_failed_and_exit $err "There was an error creating an SLO - GetOwner99Availability, exiting"
echo "$output"

CREATE_SLO_REQUEST_2="slo/inputRequest/CreateServiceLevelObjective/getOwnerP99Latency.json"
# Update service arn in the request
CREATE_SLO_REQUEST_WITH_CORRECT_SERVICE_ARN_2=$(sed "s|\"KeyAttributes\": .*|\"KeyAttributes\": $KEY_ATTRIBUTES,|" "$CREATE_SLO_REQUEST_2")
err=0
for i in {1..5}
do
  output=$(aws application-signals create-service-level-objective --endpoint $ENDPOINT --cli-input-json "$CREATE_SLO_REQUEST_WITH_CORRECT_SERVICE_ARN_2" --no-cli-pager --region $REGION 2>&1)
  err=$?
  if echo "$output" | grep 'InvalidParameterValue'; then
    echo "Error creating SLO. Retrying attempt: $i"
    sleep 120
    continue
  fi
  break
done
check_if_loop_failed_and_exit $err "There was an error creating an SLO - GetOwnerP99Latency, exiting"
echo "$output"

CREATE_SLO_REQUEST_3="slo/inputRequest/CreateServiceLevelObjective/postOwner99Availability.json"
# Update service arn in the request
CREATE_SLO_REQUEST_WITH_CORRECT_SERVICE_ARN_3=$(sed "s|\"KeyAttributes\": .*|\"KeyAttributes\": $KEY_ATTRIBUTES,|" "$CREATE_SLO_REQUEST_3")
err=0
for i in {1..5}
do
  output=$(aws application-signals create-service-level-objective --endpoint $ENDPOINT --cli-input-json "$CREATE_SLO_REQUEST_WITH_CORRECT_SERVICE_ARN_3" --no-cli-pager --region $REGION 2>&1)
  err=$?
  if echo "$output" | grep 'InvalidParameterValue'; then
    echo "Error creating SLO. Retrying attempt: $i"
    sleep 120
    continue
  fi
  break
done
check_if_loop_failed_and_exit $err "There was an error creating an SLO - PostOwner99Availability"
echo "$output"

CREATE_SLO_REQUEST_4="slo/inputRequest/CreateServiceLevelObjective/postOwnerP99Latency.json"
# Update service arn in the request
CREATE_SLO_REQUEST_WITH_CORRECT_SERVICE_ARN_4=$(sed "s|\"KeyAttributes\": .*|\"KeyAttributes\": $KEY_ATTRIBUTES,|" "$CREATE_SLO_REQUEST_4")
err=0
for i in {1..5}
do
  output=$(aws application-signals create-service-level-objective --endpoint $ENDPOINT --cli-input-json "$CREATE_SLO_REQUEST_WITH_CORRECT_SERVICE_ARN_4" --no-cli-pager --region $REGION 2>&1)
  err=$?
  if echo "$output" | grep 'InvalidParameterValue'; then
    echo "Error creating SLO. Retrying attempt: $i"
    sleep 120
    continue
  fi
  break
done
check_if_loop_failed_and_exit $err "There was an error creating an SLO - PostOwnerP99Latency"
echo "$output"
