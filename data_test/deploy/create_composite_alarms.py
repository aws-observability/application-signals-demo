#!/usr/bin/env python3
import json
import os
import boto3
import argparse
from datetime import datetime, timezone

def parse_args():
    parser = argparse.ArgumentParser(description='Create CloudWatch composite alarms for test cases')
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

def get_all_scenarios(test_cases):
    """Extract all unique scenarios from test cases"""
    scenarios = {}
    
    for test_case in test_cases:
        if 'test_scenario' in test_case:
            scenario = test_case['test_scenario']
            if scenario not in scenarios:
                scenarios[scenario] = []
            scenarios[scenario].append(test_case['test_case_id'])
    
    return scenarios

def sanitize_name(name):
    return name.strip().replace(' ', '_')

def create_scenario_composite_alarm(scenario, child_alarm_names, cloudwatch):
    """Create CloudWatch composite alarm for a specific scenario"""
    # Build alarm name
    alarm_name = f"APMDemoTest.{sanitize_name(scenario)}"
    
    # Build alarm description
    alarm_description = f"Composite alarm for monitoring all test cases in {scenario}"
    
    try:
        # Sanitize all child alarm names - note that child_alarm_names already contains the full alarm name
        child_alarm_names = [f"APMDemoTest.{sanitize_name(scenario)}.{sanitize_name(tc)}" for tc in child_alarm_names]
        
        # Build alarm rule with proper formatting - no quotes around alarm names
        alarm_rule = " OR ".join([f"ALARM({name})" for name in child_alarm_names])
        
        # Create composite alarm
        cloudwatch.put_composite_alarm(
            AlarmName=alarm_name,
            AlarmDescription=alarm_description,
            ActionsEnabled=True,
            OKActions=[],
            AlarmActions=[],
            InsufficientDataActions=[],
            AlarmRule=alarm_rule,
            Tags=[
                {
                    'Key': 'Project',
                    'Value': 'APMDemo'
                },
                {
                    'Key': 'AlarmType',
                    'Value': 'ScenarioComposite'
                }
            ]
        )
        print(f"✅ Successfully created scenario composite alarm: {alarm_name}")
        print(f"   Rule: {alarm_rule}")
    except Exception as e:
        print(f"❌ Failed to create scenario composite alarm {alarm_name}: {str(e)}")

def create_root_composite_alarm(scenario_alarm_names, cloudwatch):
    """Create root level composite alarm that monitors all scenario alarms"""
    alarm_name = "APMDemoTest.Root"
    alarm_description = "Root composite alarm for monitoring all test scenarios"
    
    try:
        # Build alarm rule with proper formatting - no quotes around alarm names
        alarm_rule = " OR ".join([f"ALARM({name})" for name in scenario_alarm_names])
        
        # Create composite alarm
        cloudwatch.put_composite_alarm(
            AlarmName=alarm_name,
            AlarmDescription=alarm_description,
            ActionsEnabled=True,
            OKActions=[],
            AlarmActions=[],
            InsufficientDataActions=[],
            AlarmRule=alarm_rule,
            Tags=[
                {
                    'Key': 'Project',
                    'Value': 'APMDemo'
                },
                {
                    'Key': 'AlarmType',
                    'Value': 'RootComposite'
                }
            ]
        )
        print(f"✅ Successfully created root composite alarm: {alarm_name}")
        print(f"   Rule: {alarm_rule}")
    except Exception as e:
        print(f"❌ Failed to create root composite alarm {alarm_name}: {str(e)}")

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
    
    # Combine all test cases
    all_test_cases = log_test_cases + metric_test_cases + trace_test_cases
    
    if not all_test_cases:
        print("No test cases found")
        return
    
    # Get all scenarios and their test cases
    scenarios = get_all_scenarios(all_test_cases)
    print(f"Found {len(scenarios)} unique scenarios")
    
    # Verify AWS credentials
    try:
        session = boto3.Session(region_name=region)
        cloudwatch = session.client('cloudwatch')
        sts = session.client('sts')
        sts.get_caller_identity()
        print(f"AWS credentials verified successfully in region {region}")
    except Exception as e:
        print(f"Warning: AWS credentials verification failed: {str(e)}")
        return
    
    # Create scenario composite alarms
    print("\nStarting scenario composite alarm creation...")
    scenario_alarm_names = []
    for scenario, test_cases in scenarios.items():
        # Build child alarm names for this scenario - just pass the test case IDs
        create_scenario_composite_alarm(scenario, test_cases, cloudwatch)
        # Add scenario alarm name to the list
        scenario_alarm_names.append(f"APMDemoTest.{sanitize_name(scenario)}")
    
    # Create root composite alarm
    print("\nCreating root composite alarm...")
    create_root_composite_alarm(scenario_alarm_names, cloudwatch)
    
    print("\nAll alarms created successfully")

if __name__ == "__main__":
    main() 