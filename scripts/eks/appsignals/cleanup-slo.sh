#!/bin/bash

# change the directory to the script location so that the relative path can work
cd "$(dirname "$0")"

REGION=$1

echo "Deleting Service Level Objectives"

err=0
trap 'err=1' ERR

aws cloudwatch delete-service-level-objective --cli-input-json file://slo/inputRequest/DeleteServiceLevelObjective/deleteSlo1.json --region $REGION --no-cli-pager
aws cloudwatch delete-service-level-objective --cli-input-json file://slo/inputRequest/DeleteServiceLevelObjective/deleteSlo2.json --region $REGION --no-cli-pager
aws cloudwatch delete-service-level-objective --cli-input-json file://slo/inputRequest/DeleteServiceLevelObjective/deleteSlo3.json --region $REGION --no-cli-pager
aws cloudwatch delete-service-level-objective --cli-input-json file://slo/inputRequest/DeleteServiceLevelObjective/deleteSlo4.json --region $REGION --no-cli-pager

exit $err
