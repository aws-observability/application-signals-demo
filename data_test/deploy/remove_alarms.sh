# Delete all alarms in the region starts with APMDemoTest

# Get all alarms in the region
alarms=$(aws cloudwatch describe-alarms --region us-east-1 --alarm-name-prefix APMDemoTest --query 'MetricAlarms[].AlarmName' --output text)

echo "Alarms to delete:"
echo $alarms

# Delete all alarms in the region starts with APMDemoTest
aws cloudwatch delete-alarms --region us-east-1 --alarm-names $alarms
