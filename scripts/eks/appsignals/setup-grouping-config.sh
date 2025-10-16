#!/bin/bash

# change the directory to the script location so that the relative path can work
cd "$(dirname "$0")"

REGION=$1
OPERATION=${2:-create}
ENDPOINT="https://application-signals.$REGION.api.aws"

check_if_step_failed_and_exit() {
  if [ $? -ne 0 ]; then
    echo $1
    exit 1
  fi
}

ACCOUNT_ID=$(aws sts get-caller-identity | jq -r '.Account')
if [ -z "$ACCOUNT_ID" ]; then
  echo "Fail to get account id. Account id is empty. Exit the script"
  exit 8
fi

# Add model to aws cli for new aws cloudwatch commands. It is not required after SDK is released
check_if_step_failed_and_exit "There was an error adding the model to aws cli, exiting"

if [ "$OPERATION" = "create" ]; then
  aws application-signals put-grouping-configuration \
    --endpoint $ENDPOINT --region $REGION \
    --grouping-attribute-definitions '[
      {
        "GroupingName": "Application",
        "GroupingSourceKeys": ["Application"]
      },
      {
        "GroupingName": "Tier",
        "GroupingSourceKeys": ["Tier"]
      },
      {
        "GroupingName": "Team",
        "GroupingSourceKeys": ["Team"]
      }
    ]'
  check_if_step_failed_and_exit "Failed to create grouping configuration"
elif [ "$OPERATION" = "delete" ]; then
  aws application-signals delete-grouping-configuration \
    --endpoint $ENDPOINT --region $REGION
  check_if_step_failed_and_exit "Failed to delete grouping configuration"
else
  echo "Usage: $0 [create|delete] <region>"
  echo "Default operation is 'create' if not specified"
  exit 1
fi