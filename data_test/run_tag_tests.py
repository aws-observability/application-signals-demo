#!/usr/bin/env python3
import json
import sys
import boto3
import os

def load_test_cases(json_file_path):
    try:
        with open(json_file_path, 'r') as f:
            data = json.load(f)
        return data.get("tag_test_cases", [])
    except FileNotFoundError:
        print(f"ERROR: JSON Not Found {json_file_path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: JSON File Parse Error {json_file_path}: {e}", file=sys.stderr)
        sys.exit(1)

def get_lambda_tags(lambda_client, function_name):
    try:
        response = lambda_client.list_tags(Resource=f"arn:aws:lambda:{lambda_client.meta.region_name}:{boto3.client('sts').get_caller_identity()['Account']}:function:{function_name}")
        return response.get('Tags', {})
    except Exception as e:
        print(f"❌ Failed to get Lambda tags for {function_name}: {str(e)}")
        return {}

def get_apigateway_tags(apigateway_client, api_name):
    try:
        # Get all REST APIs
        apis = apigateway_client.get_rest_apis()
        api_id = None
        
        for api in apis['items']:
            if api['name'] == api_name:
                api_id = api['id']
                break
        
        if not api_id:
            print(f"❌ API Gateway {api_name} not found")
            return {}
            
        response = apigateway_client.get_tags(resourceArn=f"arn:aws:apigateway:{apigateway_client.meta.region_name}::/restapis/{api_id}")
        return response.get('tags', {})
    except Exception as e:
        print(f"❌ Failed to get API Gateway tags for {api_name}: {str(e)}")
        return {}

def validate_tags(actual_tags, expected_tags, resource_name):
    print(f"\n=== Tag Validation for {resource_name} ===")
    all_passed = True
    
    for tag_key, expected_value in expected_tags.items():
        actual_value = actual_tags.get(tag_key)
        
        if actual_value == expected_value:
            print(f"✅ {tag_key}: Expected '{expected_value}', Found '{actual_value}'")
        else:
            print(f"❌ {tag_key}: Expected '{expected_value}', Found '{actual_value}'")
            all_passed = False
    
    # Check for unexpected tags
    unexpected_tags = set(actual_tags.keys()) - set(expected_tags.keys())
    if unexpected_tags:
        print(f"ℹ️  Additional tags found: {', '.join(unexpected_tags)}")
    
    return all_passed

def run_test_case(test_case):
    print(f"--- Execute Test Case: {test_case.get('test_case_id', 'N/A')} ---")
    print(f"Description: {test_case.get('description', 'N/A')}")
    
    resource_type = test_case.get('resource_type')
    resource_name = test_case.get('resource_name')
    expected_tags = test_case.get('expected_tags', {})
    
    session = boto3.Session()
    
    if resource_type == 'lambda':
        lambda_client = session.client('lambda')
        actual_tags = get_lambda_tags(lambda_client, resource_name)
    elif resource_type == 'apigateway':
        apigateway_client = session.client('apigateway')
        actual_tags = get_apigateway_tags(apigateway_client, resource_name)
    else:
        print(f"❌ Unsupported resource type: {resource_type}")
        return False
    
    result = validate_tags(actual_tags, expected_tags, resource_name)
    print("--- Test End ---\n")
    return result

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 run_tag_tests.py <path_to_test_cases.json>")
        sys.exit(1)
    
    json_file_arg = sys.argv[1]
    test_cases = load_test_cases(json_file_arg)
    
    if not test_cases:
        print("No tag test cases found")
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
            print(f"SKIPPING disabled test: {test_case.get('test_case_id', 'unknown')} - {test_case.get('description', 'no description')}")
            continue
        
        if run_test_case(test_case):
            passed_tests += 1
    
    print(f"Test Summary: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("✅ All tests passed!")
        sys.exit(0)
    else:
        print("❌ Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
