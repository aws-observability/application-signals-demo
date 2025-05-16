#!/usr/bin/env python3
import json
import os
import boto3
import argparse
from datetime import datetime, timezone

def parse_args():
    parser = argparse.ArgumentParser(description='Create CloudWatch alarms for test cases')
    parser.add_argument('--region', default='us-east-1', help='AWS region (default: us-east-1)')
    parser.add_argument('--logs-file', default='../test_cases/logs_test_cases.json', help='Path to logs test cases file (default: ../test_cases/logs_test_cases.json)')
    parser.add_argument('--metrics-file', default='../test_cases/metrics_test_cases.json', help='Path to metrics test cases file (default: ../test_cases/metrics_test_cases.json)')
    parser.add_argument('--traces-file', default='../test_cases/traces_test_cases.json', help='Path to traces test cases file (default: ../test_cases/traces_test_cases.json)')
    return parser.parse_args()

def load_test_cases(json_file_path):
    """Load test case JSON file"""
    try:
        with open(json_file_path, 'r') as f:
            data = json.load(f)
        return data
    except Exception as e:
        print(f"Failed to load JSON file {json_file_path}: {str(e)}")
        return {}

def sanitize_name(name):
    return name.strip().replace(' ', '_')

def create_log_alarm(test_case, region):
    """Create CloudWatch alarm for log test case"""
    session = boto3.Session(region_name=region)
    cloudwatch = session.client('cloudwatch')
    
    # Build alarm name
    alarm_name = f"APMDemoTest.{sanitize_name(test_case['test_scenario'])}.{sanitize_name(test_case['test_case_id'])}"
    
    # Build alarm description
    alarm_description = f"Alarm for monitoring {test_case['description']}"
    
    try:
        # Create alarm
        cloudwatch.put_metric_alarm(
            AlarmName=alarm_name,
            AlarmDescription=alarm_description,
            ActionsEnabled=True,
            OKActions=[],
            AlarmActions=[],
            InsufficientDataActions=[],
            MetricName='TestResult',
            Namespace='APMTestResults',
            Statistic='Sum',
            Dimensions=[
                {'Name': 'TestType', 'Value': 'logs'},
                {'Name': 'TestCaseId', 'Value': test_case['test_case_id']},
                {'Name': 'TestScenario', 'Value': test_case['test_scenario']}
            ],
            Period=1800,  # 30 minutes - matches test execution interval
            EvaluationPeriods=4,  # 4 data points within 2 hours
            DatapointsToAlarm=4,  # Alarm when all 4 data points trigger
            Threshold=0.5,  # Value is 0 when test fails, 1 when succeeds
            ComparisonOperator='LessThanThreshold',
            TreatMissingData='missing',
            Tags=[
                {
                    'Key': 'Project',
                    'Value': 'APMDemo'
                }
            ]
        )
        print(f"✅ Successfully created log alarm: {alarm_name}")
    except Exception as e:
        print(f"❌ Failed to create log alarm {alarm_name}: {str(e)}")

def create_metric_alarm(test_case, region):
    """Create CloudWatch alarm for metric test case"""
    session = boto3.Session(region_name=region)
    cloudwatch = session.client('cloudwatch')
    
    # Build alarm name
    alarm_name = f"APMDemoTest.{sanitize_name(test_case['test_scenario'])}.{sanitize_name(test_case['test_case_id'])}"
    
    # Build alarm description
    alarm_description = f"Alarm for monitoring {test_case['description']}"
    
    try:
        # Create alarm
        cloudwatch.put_metric_alarm(
            AlarmName=alarm_name,
            AlarmDescription=alarm_description,
            ActionsEnabled=True,
            OKActions=[],
            AlarmActions=[],
            InsufficientDataActions=[],
            MetricName='TestResult',
            Namespace='APMTestResults',
            Statistic='Sum',
            Dimensions=[
                {'Name': 'TestType', 'Value': 'metrics'},
                {'Name': 'TestCaseId', 'Value': test_case['test_case_id']},
                {'Name': 'TestScenario', 'Value': test_case['test_scenario']}
            ],
            Period=1800,  # 30 minutes - matches test execution interval
            EvaluationPeriods=4,  # 4 data points within 2 hours
            DatapointsToAlarm=4,  # Alarm when all 4 data points trigger
            Threshold=0.5,  # Value is 0 when test fails, 1 when succeeds
            ComparisonOperator='LessThanThreshold',
            TreatMissingData='missing',
            Tags=[
                {
                    'Key': 'Project',
                    'Value': 'APMDemo'
                }
            ]
        )
        print(f"✅ Successfully created metric alarm: {alarm_name}")
    except Exception as e:
        print(f"❌ Failed to create metric alarm {alarm_name}: {str(e)}")

def create_trace_alarm(test_case, region):
    """Create CloudWatch alarm for trace test case"""
    session = boto3.Session(region_name=region)
    cloudwatch = session.client('cloudwatch')
    
    # Build alarm name
    alarm_name = f"APMDemoTest.{sanitize_name(test_case['test_scenario'])}.{sanitize_name(test_case['test_case_id'])}"
    
    # Build alarm description
    alarm_description = f"Alarm for monitoring {test_case['description']}"
    
    try:
        # Create alarm
        cloudwatch.put_metric_alarm(
            AlarmName=alarm_name,
            AlarmDescription=alarm_description,
            ActionsEnabled=True,
            OKActions=[],
            AlarmActions=[],
            InsufficientDataActions=[],
            MetricName='TestResult',
            Namespace='APMTestResults',
            Statistic='Sum',
            Dimensions=[
                {'Name': 'TestType', 'Value': 'traces'},
                {'Name': 'TestCaseId', 'Value': test_case['test_case_id']},
                {'Name': 'TestScenario', 'Value': test_case['test_scenario']}
            ],
            Period=1800,  # 30 minutes - matches test execution interval
            EvaluationPeriods=4,  # 4 data points within 2 hours
            DatapointsToAlarm=4,  # Alarm when all 4 data points trigger
            Threshold=0.5,  # Value is 0 when test fails, 1 when succeeds
            ComparisonOperator='LessThanThreshold',
            TreatMissingData='missing',
            Tags=[
                {
                    'Key': 'Project',
                    'Value': 'APMDemo'
                }
            ]
        )
        print(f"✅ Successfully created trace alarm: {alarm_name}")
    except Exception as e:
        print(f"❌ Failed to create trace alarm {alarm_name}: {str(e)}")

def main():
    args = parse_args()
    region = args.region
    
    # Get current script directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Build file paths
    logs_file = os.path.join(current_dir, args.logs_file)
    metrics_file = os.path.join(current_dir, args.metrics_file)
    traces_file = os.path.join(current_dir, args.traces_file)
    
    # Load all test cases
    logs_data = load_test_cases(logs_file)
    metrics_data = load_test_cases(metrics_file)
    traces_data = load_test_cases(traces_file)
    
    log_test_cases = logs_data.get("log_test_cases", [])
    metric_test_cases = metrics_data.get("metric_test_cases", [])
    trace_test_cases = traces_data.get("trace_test_cases", [])
    
    if not any([log_test_cases, metric_test_cases, trace_test_cases]):
        print("No test cases found")
        return
    
    print(f"Found {len(log_test_cases)} log test cases")
    print(f"Found {len(metric_test_cases)} metric test cases")
    print(f"Found {len(trace_test_cases)} trace test cases")
    
    # Verify AWS credentials
    try:
        sts = boto3.client('sts', region_name=region)
        sts.get_caller_identity()
        print(f"AWS credentials verified successfully in region {region}")
    except Exception as e:
        print(f"Warning: AWS credentials verification failed: {str(e)}")
        return
    
    # Create alarms
    print("\nStarting alarm creation...")
    
    # Create log alarms
    print("\nCreating log alarms...")
    for test_case in log_test_cases:
        create_log_alarm(test_case, region)
    
    # Create metric alarms
    print("\nCreating metric alarms...")
    for test_case in metric_test_cases:
        create_metric_alarm(test_case, region)
    
    # Create trace alarms
    print("\nCreating trace alarms...")
    for test_case in trace_test_cases:
        create_trace_alarm(test_case, region)
    
    print("\nAll alarms created successfully")

if __name__ == "__main__":
    main() 