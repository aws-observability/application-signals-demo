#!/bin/bash

# Set variables
LOG_GROUP_NAME="aws/spans"
REGION=${AWS_REGION:-us-east-1}
NAMESPACE="CustomBilling"

echo "Creating log group if it doesn't exist..."
aws logs create-log-group --log-group-name "$LOG_GROUP_NAME" --region "$REGION" 2>/dev/null || echo "Log group already exists or creation failed"

echo "Creating CloudWatch metric filters for billing service custom metrics..."

# Create metric filter for billing summary requests
cat > metric-filter.json << EOF
{
"logGroupName": "aws/spans",
"filterName": "BillingSummaryRequests",
"filterPattern": "{ $.attributes.['billing_summary_request'] = \"1\" }",
"metricTransformations": [
{
"metricName": "BillingSummaryRequestCount",
"metricNamespace": "$NAMESPACE",
"metricValue": "1",
"unit": "Count",
"dimensions": {
"Service": "$.attributes.['aws.local.service']",
"Environment": "$.attributes.['aws.local.environment']",
"Operation": "$.attributes.['aws.local.operation']"
}
}
]
}
EOF

aws logs put-metric-filter --region $REGION --cli-input-json file://metric-filter.json || { rm -f metric-filter.json; exit 1; }

# Create metric filter for cache hits
cat > metric-filter.json << EOF
{
"logGroupName": "aws/spans",
"filterName": "BillingSummaryCacheHits",
"filterPattern": "{ $.attributes.['billing_summary_cache_hit'] = \"1\" }",
"metricTransformations": [
{
"metricName": "BillingSummaryCacheHitCount",
"metricNamespace": "$NAMESPACE",
"metricValue": "1",
"unit": "Count",
"dimensions": {
"Service": "$.attributes.['aws.local.service']",
"Environment": "$.attributes.['aws.local.environment']",
"Operation": "$.attributes.['aws.local.operation']"
}
}
]
}
EOF

aws logs put-metric-filter --region $REGION --cli-input-json file://metric-filter.json || { rm -f metric-filter.json; exit 1; }

# Create metric filter for cache misses
cat > metric-filter.json << EOF
{
"logGroupName": "aws/spans",
"filterName": "BillingSummaryCacheMisses",
"filterPattern": "{ $.attributes.['billing_summary_cache_hit'] = \"0\" }",
"metricTransformations": [
{
"metricName": "BillingSummaryCacheMissCount",
"metricNamespace": "$NAMESPACE",
"metricValue": "1",
"unit": "Count",
"dimensions": {
"Service": "$.attributes.['aws.local.service']",
"Environment": "$.attributes.['aws.local.environment']",
"Operation": "$.attributes.['aws.local.operation']"
}
}
]
}
EOF

aws logs put-metric-filter --region $REGION --cli-input-json file://metric-filter.json || { rm -f metric-filter.json; exit 1; }

rm -f metric-filter.json

echo "Metric filters created successfully!"
echo "Metrics will appear in CloudWatch under the '$NAMESPACE' namespace:"
echo "- BillingSummaryRequestCount"
echo "- BillingSummaryCacheHitCount" 
echo "- BillingSummaryCacheMissCount"