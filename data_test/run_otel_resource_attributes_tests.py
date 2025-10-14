#!/usr/bin/env python3
import json
import sys
import boto3
import os
import time
from datetime import datetime, timedelta, timezone

environment_name = os.environ.get("ENV_NAME", "eks:eks-pet-clinic-demo/pet-clinic")

def load_test_cases(json_file_path):
    try:
        with open(json_file_path, 'r') as f:
            data = json.load(f)
        return data.get("otel_resource_attributes_test_cases", [])
    except FileNotFoundError:
        print(f"ERROR: JSON Not Found {json_file_path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: JSON File Parse Error {json_file_path}: {e}", file=sys.stderr)
        sys.exit(1)

def query_otel_resource_attributes(test_case):
    logs_client = boto3.client('logs')
    
    service_name = test_case["service_name"]
    time_range_minutes = test_case.get("time_range_minutes", 60)
    
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(minutes=time_range_minutes)
    
    query = f'''
    fields @timestamp, @message
    | filter attributes.aws.local.service = "{service_name}"
    | filter @message like /resource/
    | limit 5
    '''
    
    try:
        response = logs_client.start_query(
            logGroupName='aws/spans',
            startTime=int(start_time.timestamp()),
            endTime=int(end_time.timestamp()),
            queryString=query
        )
        
        query_id = response['queryId']
        
        while True:
            result = logs_client.get_query_results(queryId=query_id)
            if result['status'] == 'Complete':
                return result['results']
            elif result['status'] in ['Failed', 'Cancelled']:
                print(f"❌ Query failed: {result['status']}")
                return []
            time.sleep(2)
            
    except Exception as e:
        print(f"❌ Query error: {str(e)}")
        return []

def validate_resource_attributes(query_results, expected_attributes, service_name):
    print(f"\n=== OTEL Resource Attributes Validation for {service_name} ===")
    
    if not query_results:
        print("❌ No spans found")
        return False
    
    found_attributes = {}
    
    for i, result in enumerate(query_results, 1):
        message = ""
        for field in result:
            if field['field'] == '@message':
                message = field['value']
                break
        
        try:
            span_data = json.loads(message)
            resource_attrs = span_data.get('resource', {}).get('attributes', {})
            
            print(f"Span {i}: Found resource attributes:")
            # Print all resource attributes to debug
            for key, value in resource_attrs.items():
                if key in ['Application', 'Team', 'Tier']:
                    print(f"  {key}: {value}")
                    found_attributes[key] = value
            
            if found_attributes:
                break  # Found some attributes, stop checking
                
        except json.JSONDecodeError as e:
            print(f"Span {i}: JSON parse error")
            continue
        except Exception as e:
            print(f"Span {i}: Error - {str(e)}")
            continue
    
    if not found_attributes:
        print("❌ No Application/Team/Tier attributes found")
        return False
    
    all_passed = True
    for attr_key, expected_value in expected_attributes.items():
        actual_value = found_attributes.get(attr_key)
        
        if actual_value == expected_value:
            print(f"✅ {attr_key}: Expected '{expected_value}', Found '{actual_value}'")
        else:
            print(f"❌ {attr_key}: Expected '{expected_value}', Found '{actual_value}'")
            all_passed = False
    
    return all_passed

def run_test_case(test_case):
    print(f"--- Execute Test Case: {test_case.get('test_case_id', 'N/A')} ---")
    print(f"Description: {test_case.get('description', 'N/A')}")
    
    query_results = query_otel_resource_attributes(test_case)
    expected_attributes = test_case.get('expected_resource_attributes', {})
    service_name = test_case.get('service_name')
    
    result = validate_resource_attributes(query_results, expected_attributes, service_name)
    print("--- Test End ---\n")
    return result

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 run_otel_resource_attributes_tests.py <path_to_test_cases.json>")
        sys.exit(1)
    
    json_file_arg = sys.argv[1]
    test_cases = load_test_cases(json_file_arg)
    
    if not test_cases:
        print("No OTEL resource attributes test cases found")
        sys.exit(0)
    
    print(f"Loaded {len(test_cases)} test cases")
    
    try:
        session = boto3.Session()
        sts = session.client('sts')
        sts.get_caller_identity()
        print("AWS Credential Validation Success")
    except Exception as e:
        print(f"Warning: AWS Credential Validation Failed: {str(e)}", file=sys.stderr)
        sys.exit(1)
    
    print("\nStart executing tests...")
    passed_tests = 0
    total_tests = len(test_cases)
    
    for test_case in test_cases:
        if test_case.get('disabled', False):
            print(f"SKIPPING disabled test: {test_case.get('test_case_id', 'unknown')}")
            continue
        
        if run_test_case(test_case):
            passed_tests += 1
    
    print(f"Test Summary: {passed_tests}/{total_tests} tests passed")
    sys.exit(0 if passed_tests == total_tests else 1)

if __name__ == "__main__":
    main()
