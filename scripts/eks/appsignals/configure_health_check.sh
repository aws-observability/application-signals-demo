#!/bin/bash

# Script to configure health checks for all target groups with 200 and 404 response codes

for TARGET_GROUP_ARN in $(aws elbv2 describe-target-groups --query "TargetGroups[*].TargetGroupArn" --output text)
do
    printf "Configuring health check for target group: $TARGET_GROUP_ARN\n"
    aws elbv2 modify-target-group \
        --target-group-arn "$TARGET_GROUP_ARN" \
        --health-check-protocol HTTP \
        --health-check-path "/" \
        --health-check-port "traffic-port" \
        --matcher 'HttpCode="200,404"' >/dev/null
    printf "Health check configured to accept 200 and 404 for target group: $TARGET_GROUP_ARN\n"
done
