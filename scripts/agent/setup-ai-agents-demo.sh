#!/bin/bash

set -e

if ! pip show bedrock-agentcore-starter-toolkit > /dev/null 2>&1; then
    echo "Installing bedrock-agentcore-starter-toolkit..."
    pip install bedrock-agentcore-starter-toolkit
else
    echo "bedrock-agentcore-starter-toolkit already installed"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "Docker is running"

IAM_ROLE_ARN=${BEDROCK_AGENTCORE_IAM_ROLE}

if [ -z "$IAM_ROLE_ARN" ]; then
    echo "Error: BEDROCK_AGENTCORE_IAM_ROLE environment variable is required"
    echo "Please set it with: export BEDROCK_AGENTCORE_IAM_ROLE=arn:aws:iam::account:role/your-role"
    exit 1
fi

# Build environment variables string for launch
ENV_VARS=""
[ ! -z "$AWS_REGION" ] && ENV_VARS="$ENV_VARS --env AWS_REGION=$AWS_REGION"
[ ! -z "$OTEL_PYTHON_DISTRO" ] && ENV_VARS="$ENV_VARS --env OTEL_PYTHON_DISTRO=$OTEL_PYTHON_DISTRO"
[ ! -z "$OTEL_PYTHON_CONFIGURATOR" ] && ENV_VARS="$ENV_VARS --env OTEL_PYTHON_CONFIGURATOR=$OTEL_PYTHON_CONFIGURATOR"
[ ! -z "$OTEL_EXPORTER_OTLP_LOGS_HEADERS" ] && ENV_VARS="$ENV_VARS --env OTEL_EXPORTER_OTLP_LOGS_HEADERS=$OTEL_EXPORTER_OTLP_LOGS_HEADERS"
[ ! -z "$AGENT_OBSERVABILITY_ENABLED" ] && ENV_VARS="$ENV_VARS --env AGENT_OBSERVABILITY_ENABLED=$AGENT_OBSERVABILITY_ENABLED"

echo "Configuring and deploying nutrition agent first..."
cd nutrition_agent
agentcore configure --entrypoint nutrition_agent.py -er "$IAM_ROLE_ARN"
eval "NUTRITION_OUTPUT=\$(agentcore launch -auc $ENV_VARS)"
NUTRITION_ARN=$(echo "$NUTRITION_OUTPUT" | grep -o 'arn:aws:bedrock-agentcore:[^[:space:]]*')

if [ -z "$NUTRITION_ARN" ]; then
    echo "Error: Could not extract nutrition agent ARN from deployment output"
    exit 1
fi

echo "Nutrition agent deployed with ARN: $NUTRITION_ARN"

echo "Configuring and deploying primary agent with nutrition agent ARN..."
cd ../primary_agent
agentcore configure --entrypoint pet_clinic_agent.py -er "$IAM_ROLE_ARN"
eval "PRIMARY_OUTPUT=\$(agentcore launch -auc --env NUTRITION_AGENT_ARN='$NUTRITION_ARN' $ENV_VARS)"
PRIMARY_ARN=$(echo "$PRIMARY_OUTPUT" | grep -o 'arn:aws:bedrock-agentcore:[^[:space:]]*')

echo "Primary agent deployed with ARN: $PRIMARY_ARN"

# Update IAM role with cross-agent policy for the Primary agent to be able to invoke the Nutrition agent
echo "Updating IAM role with cross-agent invoke permissions..."
ROLE_NAME=$(echo "$IAM_ROLE_ARN" | awk -F'/' '{print $NF}')
cat > /tmp/cross-agent-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock-agentcore:InvokeAgentRuntime"
            ],
            "Resource": "${NUTRITION_ARN}*"
        }
    ]
}
EOF

aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name CrossAgentInvokePolicy --policy-document file:///tmp/cross-agent-policy.json
echo "IAM policy updated successfully"

echo "Both agents deployed successfully!"
echo "Nutrition Agent ARN: $NUTRITION_ARN"
echo "Primary Agent ARN: $PRIMARY_ARN"