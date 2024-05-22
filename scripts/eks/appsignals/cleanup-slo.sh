#!/bin/bash

# change the directory to the script location so that the relative path can work
cd "$(dirname "$0")"

REGION=$1
ENDPOINT="https://application-signals.$REGION.api.aws"

echo "Deleting Service Level Objectives"

err=0
trap 'err=1' ERR

aws application-signals delete-service-level-objective --cli-input-json file://slo/inputRequest/DeleteServiceLevelObjective/deleteSlo1.json --region $REGION --endpoint $ENDPOINT --no-cli-pager
aws application-signals delete-service-level-objective --cli-input-json file://slo/inputRequest/DeleteServiceLevelObjective/deleteSlo2.json --region $REGION --endpoint $ENDPOINT --no-cli-pager
aws application-signals delete-service-level-objective --cli-input-json file://slo/inputRequest/DeleteServiceLevelObjective/deleteSlo3.json --region $REGION --endpoint $ENDPOINT --no-cli-pager
aws application-signals delete-service-level-objective --cli-input-json file://slo/inputRequest/DeleteServiceLevelObjective/deleteSlo4.json --region $REGION --endpoint $ENDPOINT --no-cli-pager

exit $err
