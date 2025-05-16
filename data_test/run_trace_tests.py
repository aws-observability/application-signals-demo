#!/usr/bin/env python3
import json
import sys
import boto3
from datetime import datetime, timedelta, timezone

def load_test_cases(json_file_path):
    try:
        with open(json_file_path, 'r') as f:
            data = json.load(f)
        return data.get("trace_test_cases", [])
    except FileNotFoundError:
        print(f"ERROR: JSON Not Found {json_file_path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: JSON File Phase Error {json_file_path}: {e}", file=sys.stderr)
        sys.exit(1)

def get_time_range_params(params):
    time_range = params.get("time_range", {})
    relative_minutes = time_range.get("relative_minutes")

    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(minutes=int(relative_minutes))

    start_timestamp = int(start_dt.timestamp())
    end_timestamp = int(end_dt.timestamp())

    print(f"Start Time: {start_dt} (Timestamp: {start_timestamp})")
    print(f"End Time: {end_dt} (Timestamp: {end_timestamp})")

    return start_timestamp, end_timestamp

def execute_trace_test(test_case):
    params = test_case.get("parameters", test_case)
    session = boto3.Session()
    xray = session.client('xray')
    
    start_timestamp, end_timestamp = get_time_range_params(params)
    
    try:
        all_trace_summaries = []
        next_token = None
        
        while True:
            query_params = {
                'StartTime': start_timestamp,
                'EndTime': end_timestamp,
                'FilterExpression': params.get("filter_expression", ""),
                'Sampling': False
            }
            
            if next_token:
                query_params['NextToken'] = next_token
                
            response = xray.get_trace_summaries(**query_params)
            
            all_trace_summaries.extend(response.get('TraceSummaries', []))
            
            next_token = response.get('NextToken')
            if not next_token:
                break
                
        complete_response = {
            'TraceSummaries': all_trace_summaries
        }
        
        print(f"Filter Expression: {params.get('filter_expression', '')}")
        print(f"Total traces collected: {len(all_trace_summaries)}")
        return complete_response
    except Exception as e:
        print(f"❌ Fail to get trace summaries: {str(e)}")
        return None

def execute_and_validate_command(response, validation_checks):
    if not response:
        return
        
    print("\n=== Validation Results ===")
    for i, check in enumerate(validation_checks, 1):
        print(f"\nCheck {i}:")
        
        if check.get("check_type") == "count":
            actual_count = len(response.get("TraceSummaries", []))
            expected_count = check.get("expected_count")
            operator = check.get("comparison_operator", "GreaterThanOrEqualToThreshold")
            passed = actual_count >= expected_count if operator == "GreaterThanOrEqualToThreshold" else actual_count == expected_count
            
            print(f"Expected: {expected_count} records")
            print(f"Actual: {actual_count} records")
            print(f"Result: {'✅ Passed' if passed else '❌ Failed'}")

        elif check.get("check_type") == "metadata_check":
            metadata_key = check.get("metadata_key")
            found = False
            
            for trace in response.get("TraceSummaries", []):
                trace_ids = [trace.get("Id")]
                session = boto3.Session()
                xray = session.client('xray')
                trace_details = xray.batch_get_traces(TraceIds=trace_ids)
                
                for segment in trace_details.get("Traces", [])[0].get("Segments", []):
                    document = json.loads(segment.get("Document"))
                    metadata = document.get("metadata", {})
                    if metadata_key in metadata:
                        found = True
                        break
                
                if found:
                    break
            
            print(f"Expected: metadata key '{metadata_key}' exists")
            print(f"Actual: {'✅ Found' if found else '❌ Not Found'}")
            
        elif check.get("check_type") == "trace_attribute_exists":
            attribute_type = check.get("attribute_type")
            found = False
            
            for trace in response.get("TraceSummaries", []):
                annotations = trace.get("Annotations", {})
                if attribute_type in annotations:
                    for annotation in annotations[attribute_type]:
                        if "AnnotationValue" in annotation:
                            found = True
                            break
                if found:
                    break
            
            print(f"Expected: attribute {attribute_type} exists")
            print(f"Actual: {'✅ Found' if found else '❌ Not Found'}")

        elif check.get("check_type") == "trace_attribute_value_match":
            attribute_type = check.get("attribute_type")
            expected_value = check.get("expected_value")
            found = False
            
            for trace in response.get("TraceSummaries", []):
                annotations = trace.get("Annotations", {})
                if attribute_type in annotations:
                    for annotation in annotations[attribute_type]:
                        if "AnnotationValue" in annotation and str(annotation["AnnotationValue"]) == str(expected_value):
                            found = True
                            break
                if found:
                    break
            
            print(f"Expected: attribute {attribute_type} with value {expected_value}")
            print(f"Actual: {'✅ Found' if found else '❌ Not Found'}")

        elif check.get("check_type") == "general_exists":
            expected_value = check.get("expected_value")
            found = False
            for trace in response.get("TraceSummaries", []):
                if expected_value in str(trace):
                    found = True
                    print(f"Expected: ✅ Found for {check.get('expected_value')}")
                    break
            if not found:
                print(f"Expected: ❌ Not Found for {check.get('expected_value')}")
            
        elif check.get("check_type") == "segment_has_exception":
            segment_pattern = check.get("segment_name_pattern")
            contains_exception = check.get("contains_exception", True)
            found = False
            
            for trace in response.get("TraceSummaries", []):
                if trace.get("HasFault") or trace.get("HasError"):
                    found = True
                    break
            
            print(f"Expected: {'exists' if contains_exception else 'not exists'} exception in {segment_pattern}")
            print(f"Actual: {'✅ Matches' if found == contains_exception else '❌ Does Not Match'}")
            
        elif check.get("check_type") == "exception_message":
            expected_message = check.get("expected")
            found = False
            
            for trace in response.get("TraceSummaries", []):
                trace_ids = [trace.get("Id")]
                session = boto3.Session()
                xray = session.client('xray')
                trace_details = xray.batch_get_traces(TraceIds=trace_ids)
                
                for segment in trace_details.get("Traces", [])[0].get("Segments", []):
                    document = json.loads(segment.get("Document"))
                    cause = document.get("cause", {})
                    exceptions = cause.get("exceptions", {})
                    for exception in exceptions:
                        if expected_message in exception.get("message"):
                            found = True
                            break
                    if found:
                        break
                
                if found:
                    break
            
            print(f"Expected: exception message {expected_message}")
            print(f"Actual: {'✅ Found' if found else '❌ Not Found'}")
            
        elif check.get("check_type") == "error_code":
            expected_code = check.get("expected")
            found = False
            
            for trace in response.get("TraceSummaries", []):
                if trace.get("HasError"):
                    found = True
                    break
            
            print(f"Expected: error code {expected_code}")
            print(f"Actual: {'✅ Found' if found else '❌ Not Found'}")
            
        elif check.get("check_type") == "http_status_code":
            expected_status_code = check.get("expected_status_code")
            found = False
            
            for trace in response.get("TraceSummaries", []):
                annotations = trace.get("Annotations", {})
                if "http.response.status_code" in annotations:
                    for annotation in annotations["http.response.status_code"]:
                        if "AnnotationValue" in annotation and str(annotation["AnnotationValue"]) == str(expected_status_code):
                            found = True
                            break
                if found:
                    break
            
            print(f"Expected: HTTP status code {expected_status_code}")
            print(f"Actual: {'✅ Found' if found else '❌ Not Found'}")

def run_test_case(test_case):
    print(f"--- Execute Test Case: {test_case.get('test_case_id', 'N/A')} ---")
    print(f"Description: {test_case.get('description', 'N/A')}")
    
    response = execute_trace_test(test_case)
    
    validation_checks = test_case.get("validation_checks", [])
    if validation_checks:
        execute_and_validate_command(response, validation_checks)
    
    print("--- Test End ---\n")

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 run_trace_tests.py <path_to_test_cases.json>")
        sys.exit(1)
    
    json_file_arg = sys.argv[1]
    test_cases = load_test_cases(json_file_arg)
    
    if not test_cases:
        print(f"No trace test cases found")
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