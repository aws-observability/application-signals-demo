#!/usr/bin/env bash

##############################################################################
#
# Use this script to create canaries or clean them up for the Pet Clinic
# sample app.
#
##############################################################################

cd "$(dirname "$0")"

# Set variables with provided arguments or default values
REGION=${1:-"us-west-2"}
OPERATION=${2:-"create"} # Specify 'create' to set up canaries or 'delete' to clean up canaries
NGINX_ENDPOINT=$3

ACCOUNT_ID=$(aws sts get-caller-identity | jq -r '.Account')
if [ -z "$ACCOUNT_ID" ]; then
  echo "Fail to get account id. Account id is empty. Exit the script"
  exit 8
fi
ROLE_PATH="/service-role/"
ROLE_NAME="CloudWatchSyntheticsRole-PetClinic-$ACCOUNT_ID-$REGION"
POLICY_NAME="CloudWatchSyntheticsPolicy-PetClinic-$ACCOUNT_ID-$REGION"
POLICY_ARN="arn:aws:iam::$ACCOUNT_ID:policy/service-role/$POLICY_NAME"
CODE_BUCKET="aws-synthetics-code-petclinic-$ACCOUNT_ID-$REGION"
ARTIFACT_BUCKET="cw-syn-results-petclinic-$ACCOUNT_ID-$REGION"

setup() {
    echo "Setting up the canary execution role"
    res=$(aws iam get-role --role-name $ROLE_NAME --region $REGION 2>&1;)
    if ! grep -q "The role with name "$ROLE_NAME" cannot be found" <<< "$res"; then
      echo "Role "$ROLE_NAME" exist. Update it."
      aws iam update-assume-role-policy --role-name $ROLE_NAME --policy-document file://canaries/policies/canary_role.json --no-cli-pager
    else
      echo "Start creating IAM role $ROLE_NAME"
      aws iam create-role --path $ROLE_PATH --role-name $ROLE_NAME --assume-role-policy-document file://canaries/policies/canary_role.json --no-cli-pager
    fi

    res=$(aws iam get-policy --policy-arn $POLICY_ARN --region $REGION 2>&1;)
    if ! grep -q "Policy "$POLICY_ARN" was not found" <<< "$res"; then
      echo "Policy "$POLICY_ARN" exist. Update it."
      policy_pre_version_id=$(echo $res | jq -r '.Policy.DefaultVersionId')
      res=$(aws iam create-policy-version --policy-arn $POLICY_ARN --policy-document file://canaries/policies/canary_policy.json --set-as-default --no-cli-pager)
      echo $res | jq
      if ! grep -q "VersionId" <<< "$res"; then
        echo "Fail to create new IAM policy version. Exit the script."
        exit 9
      fi
      echo "Deleting old policy version $policy_pre_version_id"
      aws iam delete-policy-version --policy-arn $POLICY_ARN --version-id $policy_pre_version_id --no-cli-pager
    else
      echo "creating IAM policy"
      aws iam create-policy --path $ROLE_PATH --policy-name $POLICY_NAME --policy-document file://canaries/policies/canary_policy.json --no-cli-pager
    fi
    aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn $POLICY_ARN

    echo "Setting up S3 code buckets"
    res=$(aws s3api head-bucket --bucket $CODE_BUCKET --region $REGION 2>&1)
    if [ -z "$res" ]; then
      echo "Bucket $CODE_BUCKET is already created."
    else
      echo "Creating S3 code bucket $CODE_BUCKET"
      aws s3 mb s3://$CODE_BUCKET --region $REGION
    fi

    res=$(aws s3api head-bucket --bucket $ARTIFACT_BUCKET --region $REGION 2>&1)
    if [ -z "$res" ]; then
      echo "Bucket $CODE_BUCKET is already created."
    else
      echo "Creating S3 artifact bucket $ARTIFACT_BUCKET"
      aws s3 mb s3://$ARTIFACT_BUCKET --region $REGION
    fi
}

cleanup() {
    echo "Cleaning up canary execution role"
    aws iam detach-role-policy --role-name $ROLE_NAME --policy-arn $POLICY_ARN
    aws iam delete-role --role-name $ROLE_NAME
    other_policy_versions=($(aws iam list-policy-versions --policy-arn $POLICY_ARN | jq -r '.Versions[]|select(.IsDefaultVersion==false)|.VersionId'))
    for other_policy_version in "${other_policy_versions[@]}"
    do
      aws iam delete-policy-version --policy-arn $POLICY_ARN --version-id $other_policy_version
    done
    aws iam delete-policy --policy-arn $POLICY_ARN

    echo "Cleaning up S3 code buckets"
    aws s3 rm s3://$CODE_BUCKET --recursive --region $REGION
    aws s3 rm s3://$ARTIFACT_BUCKET --recursive --region $REGION
    aws s3api delete-bucket --bucket $CODE_BUCKET --region $REGION
    aws s3api delete-bucket --bucket $ARTIFACT_BUCKET --region $REGION
}

delete_canaries() {
    for canary_name in ${canaries[@]}; do
        echo "Deleting canary $canary_name"
        canary_id=$(aws synthetics get-canary --name $canary_name --region $REGION | jq -r '.Canary.Id')
        aws synthetics delete-canary --name $canary_name --delete-lambda --region $REGION
        aws logs delete-log-group --log-group-name "/aws/lambda/cwsyn-${canary_name}-${canary_id}" --region $REGION
    done
}

stop_canaries() {
    for canary_name in ${canaries[@]}; do
        echo "Stopping canary $canary_name"
        aws synthetics stop-canary --name $canary_name --region $REGION
    done
}

upload_canary_script() {
    canary_name=$1
    mkdir -p nodejs/node_modules
    cp "canaries/scripts/$canary_name.js" "nodejs/node_modules/$canary_name.js"
    zip -r $canary_name.zip nodejs

    echo "Uploading canary script for canary $canary_name to S3"
    aws s3api put-object --bucket $CODE_BUCKET --key $canary_name --body "$canary_name.zip" | jq
    rm -rf nodejs $canary_name.zip
}

create_canary() {
    canary_name=$1
    canary_execution_role_arn=$(aws iam get-role --role-name $ROLE_NAME | jq -r '.Role.Arn')
    if [ -z "$canary_execution_role_arn" ]; then
      echo "Fail to get canary execution role arn. Exit the script"
      exit 1
    fi

    if [ -n "$NGINX_ENDPOINT" ]; then
      ENDPOINT="$NGINX_ENDPOINT"
    else
      # If NGINX_ENDPOINT is not provided, get it from kubectl
      ENDPOINT="http://$(kubectl get svc -n ingress-nginx | grep 'ingress-nginx' | awk '{print $4}')"
    fi
    if [ -z "$ENDPOINT" ]; then
      echo "Fail to get a valid endpoint. Endpoint is empty. Exit the script"
      exit 6
    elif [[ "$ENDPOINT" == 'http://' ]]; then
      echo "Fail to get a valid endpoint. Endpoint is http:// Exit the script"
      exit 7
    fi
    echo "ENDPOINT is $ENDPOINT"

    echo "Creating/updating canary $canary_name"
    res=$(aws synthetics get-canary --name $canary_name --region $REGION 2>&1)
    [[ $(grep "Canary not found" <<< "$res") ]] && operation="create-canary" || operation="update-canary"
    aws synthetics $operation \
        --name $canary_name \
        --artifact-s3-location "s3://$ARTIFACT_BUCKET" \
        --code Handler="$canary_name.handler",S3Bucket="$CODE_BUCKET",S3Key="$canary_name" \
        --execution-role-arn $canary_execution_role_arn \
        --runtime-version "syn-nodejs-puppeteer-6.2" \
        --schedule Expression="rate(1 minute)" \
        --run-config ActiveTracing=true,EnvironmentVariables={URL=$ENDPOINT} \
        --region $REGION \
        --no-cli-pager \
        | jq
}

create_canaries() {
    for canary_name in ${canaries[@]}; do
        upload_canary_script $canary_name
        create_canary $canary_name
    done
}

start_canaries() {
    for canary_name in ${canaries[@]}; do
        res=$(set -x; aws synthetics get-canary --name $canary_name --region $REGION 2>&1; set +x;)
        if (grep -q '"State": "RUNNING"' <<< "$res") then
          echo "Canary $canary_name is already running. Skip the starting step"
        else
          echo "Starting canary $canary_name"
          aws synthetics start-canary --name $canary_name --region $REGION
        fi
    done
}

# Print out the values
echo "REGION is $REGION"
echo "OPERATION is $OPERATION"
echo "ACCOUNT_ID is $ACCOUNT_ID"

declare -a canaries=(
    "pc-add-visit"
    "pc-create-owners"
    "pc-visit-pet"
    "pc-visit-vet"
    "pet-clinic-traffic"
    "pc-visit-insurances"
    "pc-visit-billings"
)

if [ $OPERATION = "create" ]; then
    setup
    create_canaries
    echo "Waiting a minute for canaries to finish creating or updating."
    sleep 60
    echo "Done waiting. Starting canaries."
    start_canaries
elif [ $OPERATION = "delete" ]; then
    stop_canaries
    echo "Waiting a minute for canaries to finish stopping."
    sleep 60
    echo "Done waiting. Deleting canaries."
    delete_canaries
    cleanup
else
    echo "Unknown operation $OPERATION"
fi
