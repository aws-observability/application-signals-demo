#!/usr/bin/env python3
import json
import sys
import boto3, os
from datetime import datetime, timedelta, timezone

environment_name = os.environ.get("ENV_NAME", "eks:eks-pet-clinic-demo/pet-clinic")
eks_cluster_name = os.environ.get("EKS_CLUSTER_NAME", "eks-pet-clinic-demo")


def load_test_cases(json_file_path):
    try:
        with open(json_file_path, 'r') as f:
            data = json.load(f)
        return data.get("log_test_cases", [])
    except FileNotFoundError:
        print(f"ERROR: JSON Not Found {json_file_path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: JSON File Phase Error {json_file_path}: {e}", file=sys.stderr)
        sys.exit(1)

def get_time_range_params(params):
    time_range = params.get("time_range", {})
    relative_minutes = time_range.get("relative_minutes")
    start_time_iso = time_range.get("start_time")
    end_time_iso = time_range.get("end_time")

    if end_time_iso:
        end_dt = datetime.fromisoformat(end_time_iso.replace("Z", "+00:00"))
    else:
        end_dt = datetime.now(timezone.utc)

    if start_time_iso:
        start_dt = datetime.fromisoformat(start_time_iso.replace("Z", "+00:00"))
    elif relative_minutes:
        start_dt = end_dt - timedelta(minutes=int(relative_minutes))
    else:
        start_dt = end_dt - timedelta(minutes=60)

    return start_dt, end_dt

def execute_logs_test(test_case):
    session = boto3.Session()
    logs = session.client('logs')
    
    start_dt, end_dt = get_time_range_params(test_case)
    
    # Process log group names to replace EKS_CLUSTER_PLACEHOLDER
    processed_log_groups = []
    for log_group in test_case["log_group_names"]:
        processed_log_groups.append(log_group.replace('EKS_CLUSTER_PLACEHOLDER', eks_cluster_name))
    
    try:
        # Start the query
        response = logs.start_query(
            logGroupNames=processed_log_groups,
            startTime=int(start_dt.timestamp() * 1000),
            endTime=int(end_dt.timestamp() * 1000),
            queryString=test_case["query_string"].replace('ENVIRONMENT_NAME_PLACEHOLDER', environment_name)
        )

        print(test_case["query_string"].replace('ENVIRONMENT_NAME_PLACEHOLDER', environment_name))
        
        query_id = response['queryId']
        
        # Wait for query completion and get results
        while True:
            query_status = logs.get_query_results(queryId=query_id)
            if query_status['status'] == 'Complete':
                return query_status
            elif query_status['status'] in ['Failed', 'Cancelled']:
                print(f"❌ Query failed with status: {query_status['status']}")
                return None
            
        return query_status
    except Exception as e:
        print(f"❌ Fail to execute logs query: {str(e)}")
        return None

def execute_and_validate_command(response, validation_checks):
    if not response:
        return
        
    print("\n=== Validation Results ===")
    for i, check in enumerate(validation_checks, 1):
        print(f"\nCheck {i}:")
        
        if check.get("check_type") == "count":
            actual_count = len(response.get("results", []))
            expected_count = check.get("expected_count")
            operator = check.get("comparison_operator", "GreaterThanOrEqualToThreshold")
            passed = actual_count >= expected_count if operator == "GreaterThanOrEqualToThreshold" else actual_count == expected_count
            
            print(f"Expected: {expected_count} records")
            print(f"Actual: {actual_count} records")
            print(f"Result: {'✅ Passed' if passed else '❌ Failed'}")
            
        elif check.get("check_type") == "field_contains":
            field_name = check.get("field_name")
            expected_value = check.get("expected_value")
            found = False
            
            for result in response.get("results", []):
                for field in result:
                    if field.get("field") == field_name and expected_value in field.get("value", ""):
                        found = True
                        break
                if found:
                    break
            
            print(f"Expected: field {field_name} contains '{expected_value}'")
            print(f"Actual: {'✅ Found' if found else '❌ Not Found'}")

        elif check.get("check_type") == "general_exists":
            # check if the required text exists in the plain text of the response
            for result in response.get("results", []):
                if check.get("expected_value") in str(result):
                    print(f"Expected: ✅ Found for {check.get('expected_value')}")
                else:
                    print(f"Expected: ❌ Not Found for {check.get('expected_value')}")
            
def run_test_case(test_case):
    print(f"--- Execute Test Case: {test_case.get('test_case_id', 'N/A')} ---")
    print(f"Description: {test_case.get('description', 'N/A')}")
    
    response = execute_logs_test(test_case)
    
    validation_checks = test_case.get("validation_checks", [])
    if validation_checks:
        execute_and_validate_command(response, validation_checks)
    
    print("--- Test End ---\n")

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 run_logs_tests.py <path_to_test_cases.json>")
        sys.exit(1)
    
    json_file_arg = sys.argv[1]
    test_cases = load_test_cases(json_file_arg)
    
    if not test_cases:
        print(f"No log test cases found")
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
    for test_case in test_cases:
        run_test_case(test_case)
    
    print("All test cases executed")

if __name__ == "__main__":
    main() 