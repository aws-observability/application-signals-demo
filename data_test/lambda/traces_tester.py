import json
import boto3
from datetime import datetime, timedelta, timezone

xray = boto3.client('xray')

def get_time_range_params(params):
    """Get time range params"""
    time_range = params.get("time_range", {})
    relative_minutes = time_range.get("relative_minutes", 60)
    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(minutes=int(relative_minutes))
    return int(start_dt.timestamp()), int(end_dt.timestamp())

def execute_test(test_case):
    """Execute trace test"""
    start_timestamp, end_timestamp = get_time_range_params(test_case)
    
    try:
        all_trace_summaries = []
        next_token = None
        
        while True:
            query_params = {
                'StartTime': start_timestamp,
                'EndTime': end_timestamp,
                'FilterExpression': test_case.get("filter_expression", ""),
                'Sampling': False
            }
            
            if next_token:
                query_params['NextToken'] = next_token
                
            response = xray.get_trace_summaries(**query_params)
            all_trace_summaries.extend(response.get('TraceSummaries', []))
            
            next_token = response.get('NextToken')
            if not next_token:
                break
                
        return {'TraceSummaries': all_trace_summaries}
    except Exception as e:
        print(f"Failed to get trace summaries: {str(e)}")
        return None

def validate_test(response, test_case):
    """Validate trace test result"""
    if not response:
        return False
        
    validation_checks = test_case.get("validation_checks", [])
    all_results = []
    
    for check in validation_checks:
        if check.get("check_type") == "count":
            actual_count = len(response.get("TraceSummaries", []))
            expected_count = check.get("expected_count")
            operator = check.get("comparison_operator", "GreaterThanOrEqualToThreshold")
            result = actual_count >= expected_count if operator == "GreaterThanOrEqualToThreshold" else actual_count == expected_count
            print(f"Test_scenario: {test_case['test_scenario']}, Test_case_id: {test_case['test_case_id']}, Validation_type: {check.get('check_type')} Result: {result}")
            all_results.append(result)
            
        elif check.get("check_type") == "metadata_check":
            metadata_key = check.get("metadata_key")
            found = False
            
            for trace in response.get("TraceSummaries", []):
                trace_ids = [trace.get("Id")]
                trace_details = xray.batch_get_traces(TraceIds=trace_ids)
                
                for segment in trace_details.get("Traces", [])[0].get("Segments", []):
                    document = json.loads(segment.get("Document"))
                    metadata = document.get("metadata", {})
                    if metadata_key in metadata:
                        found = True
                        break
                
                if found:
                    break
            print(f"Test_scenario: {test_case['test_scenario']}, Test_case_id: {test_case['test_case_id']}, Validation_type: {check.get('check_type')} Result: {found}")
            all_results.append(found)
            
        elif check.get("check_type") == "exception_message":
            expected_message = check.get("expected")
            found = False
            
            for trace in response.get("TraceSummaries", []):
                trace_ids = [trace.get("Id")]
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
            print(f"Test_scenario: {test_case['test_scenario']}, Test_case_id: {test_case['test_case_id']}, Validation_type: {check.get('check_type')} Result: {found}")
            all_results.append(found)
    
    return all(all_results)

def run_test(test_case):
    """Run single trace test case"""
    response = execute_test(test_case)
    return validate_test(response, test_case) 