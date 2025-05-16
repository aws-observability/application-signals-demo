import json
import boto3
from datetime import datetime, timedelta, timezone
import os
from metrics_tester import run_test as run_metric_test
from traces_tester import run_test as run_trace_test
from logs_tester import run_test as run_logs_test

# initialize aws clients
cloudwatch = boto3.client('cloudwatch')
xray = boto3.client('xray')
logs = boto3.client('logs')

def get_time_range_params(params, test_type):
    """get time range params"""
    if test_type == 'metrics':
        evaluation_period_minutes = params.get("evaluation_period_minutes", 5)
        end_dt = datetime.now(timezone.utc)
        start_dt = end_dt - timedelta(minutes=evaluation_period_minutes)
        return start_dt, end_dt
    else:
        time_range = params.get("time_range", {})
        relative_minutes = time_range.get("relative_minutes", 60)
        end_dt = datetime.now(timezone.utc)
        start_dt = end_dt - timedelta(minutes=int(relative_minutes))
        return start_dt, end_dt

def execute_metric_test(test_case):
    """execute metric test"""
    start_dt, end_dt = get_time_range_params(test_case, 'metrics')
    
    try:
        response = cloudwatch.get_metric_data(
            StartTime=start_dt,
            EndTime=end_dt,
            MetricDataQueries=[
                {
                    'Id': 'm1',
                    'MetricStat': {
                        'Metric': {
                            'Namespace': test_case["metric_namespace"],
                            'MetricName': test_case["metric_name"],
                            'Dimensions': test_case.get("dimensions", [])
                        },
                        'Period': 60,
                        'Stat': test_case["statistic"]
                    },
                    'ReturnData': True
                }
            ]
        )
        return response
    except Exception as e:
        print(f"Failed to execute metric test: {str(e)}")
        return None

def execute_trace_test(test_case):
    """execute trace test"""
    start_dt, end_dt = get_time_range_params(test_case, 'traces')
    start_timestamp = int(start_dt.timestamp())
    end_timestamp = int(end_dt.timestamp())
    
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
        print(f"Failed to execute trace test: {str(e)}")
        return None

def execute_logs_test(test_case):
    """execute logs test"""
    start_dt, end_dt = get_time_range_params(test_case, 'logs')
    
    try:
        response = logs.start_query(
            logGroupNames=test_case["log_group_names"],
            startTime=int(start_dt.timestamp() * 1000),
            endTime=int(end_dt.timestamp() * 1000),
            queryString=test_case["query_string"]
        )
        
        query_id = response['queryId']
        
        while True:
            query_status = logs.get_query_results(queryId=query_id)
            if query_status['status'] == 'Complete':
                return query_status
            elif query_status['status'] in ['Failed', 'Cancelled']:
                print(f"Failed to execute logs test: {query_status['status']}")
                return None
            
        return query_status
    except Exception as e:
        print(f"Failed to execute logs test: {str(e)}")
        return None

def validate_metric_test(response, test_case):
    """validate metric test result"""
    if not response or not response.get("MetricDataResults"):
        return False
        
    metric_values = response["MetricDataResults"][0].get("Values", [])
    if not metric_values:
        return False
        
    threshold = test_case.get("threshold", {})
    comparison_operators = threshold.get("comparison_operator", [])
    
    if isinstance(comparison_operators, str):
        comparison_operators = [comparison_operators]
    
    all_results = []
    for value in metric_values:
        for comparison_operator in comparison_operators:
            result = False
            if comparison_operator["operator"] == "GreaterThanThreshold":
                result = value > comparison_operator["threshold_value"]
            elif comparison_operator["operator"] == "LessThanThreshold":
                result = value < comparison_operator["threshold_value"]
            elif comparison_operator["operator"] == "GreaterThanOrEqualToThreshold":
                result = value >= comparison_operator["threshold_value"]
            elif comparison_operator["operator"] == "LessThanOrEqualToThreshold":
                result = value <= comparison_operator["threshold_value"]
            all_results.append(result)
    
    return all(all_results)

def validate_trace_test(response, test_case):
    """validate trace test result"""
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
            
            all_results.append(found)
    
    return all(all_results)

def validate_logs_test(response, test_case):
    """validate logs test result"""
    if not response:
        return False
        
    validation_checks = test_case.get("validation_checks", [])
    all_results = []
    
    for check in validation_checks:
        if check.get("check_type") == "count":
            actual_count = len(response.get("results", []))
            expected_count = check.get("expected_count")
            operator = check.get("comparison_operator", "GreaterThanOrEqualToThreshold")
            result = actual_count >= expected_count if operator == "GreaterThanOrEqualToThreshold" else actual_count == expected_count
            all_results.append(result)
            
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
            
            all_results.append(found)
    
    return all(all_results)

def publish_test_result(test_case, test_type, passed):
    """publish test result to cloudwatch metrics"""
    try:
        cloudwatch.put_metric_data(
            Namespace='APMTestResults',
            MetricData=[
                {
                    'MetricName': 'TestResult',
                    'Value': 1 if passed else 0,
                    'Unit': 'Count',
                    'Dimensions': [
                        {'Name': 'TestType', 'Value': test_type},
                        {'Name': 'TestCaseId', 'Value': test_case.get('test_case_id', 'unknown')},
                        {'Name': 'TestScenario', 'Value': test_case.get('test_scenario', 'unknown')}
                    ]
                }
            ]
        )
    except Exception as e:
        print(f"Failed to publish test result: {str(e)}")

def run_test(test_case, test_type):
    """run single test case"""
    response = None
    passed = False
    
    if test_type == 'metrics':
        response = execute_metric_test(test_case)
        passed = validate_metric_test(response, test_case)
    elif test_type == 'traces':
        response = execute_trace_test(test_case)
        passed = validate_trace_test(response, test_case)
    elif test_type == 'logs':
        response = execute_logs_test(test_case)
        passed = validate_logs_test(response, test_case)
    
    publish_test_result(test_case, test_type, passed)
    return passed

def load_test_cases_from_files():
    """load test cases from files"""
    test_cases = {
        'metrics': {'metric_test_cases': []},
        'traces': {'trace_test_cases': []},
        'logs': {'log_test_cases': []}
    }
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    try:
        metrics_file = os.path.join(current_dir, 'metrics_test_cases.json')
        if os.path.exists(metrics_file):
            with open(metrics_file, 'r') as f:
                metrics_data = json.load(f)
                test_cases['metrics'] = metrics_data
    except Exception as e:
        print(f"Failed to load metric test cases: {str(e)}")
    
    try:
        traces_file = os.path.join(current_dir, 'traces_test_cases.json')
        if os.path.exists(traces_file):
            with open(traces_file, 'r') as f:
                traces_data = json.load(f)
                test_cases['traces'] = traces_data
    except Exception as e:
        print(f"Failed to load trace test cases: {str(e)}")
    
    try:
        logs_file = os.path.join(current_dir, 'logs_test_cases.json')
        if os.path.exists(logs_file):
            with open(logs_file, 'r') as f:
                logs_data = json.load(f)
                test_cases['logs'] = logs_data
    except Exception as e:
        print(f"Failed to load logs test cases: {str(e)}")
    
    return test_cases

def lambda_handler(event, context):
    """lambda handler"""
    test_cases = {
        'metrics': json.loads(os.environ.get('METRICS_TEST_CASES', '{"metric_test_cases": []}')),
        'traces': json.loads(os.environ.get('TRACES_TEST_CASES', '{"trace_test_cases": []}')),
        'logs': json.loads(os.environ.get('LOGS_TEST_CASES', '{"log_test_cases": []}'))
    }
    
    if not any(len(test_cases[test_type].get(f'{test_type}_test_cases', [])) > 0 for test_type in test_cases):
        test_cases = load_test_cases_from_files()
    
    results = {
        'metrics': {'total': 0, 'passed': 0},
        'traces': {'total': 0, 'passed': 0},
        'logs': {'total': 0, 'passed': 0}
    }
    
    test_type_mapping = {
        'metrics': ('metric_test_cases', run_metric_test),
        'traces': ('trace_test_cases', run_trace_test),
        'logs': ('log_test_cases', run_logs_test)
    }
    
    for test_type, (test_list_key, test_runner) in test_type_mapping.items():
        test_list = test_cases[test_type].get(test_list_key, [])
        results[test_type]['total'] = len(test_list)
        
        for test_case in test_list:
            test_id = test_case.get('test_case_id', 'unknown')
            passed = test_runner(test_case)
            
            publish_test_result(test_case, test_type, passed)
            
            if passed:
                results[test_type]['passed'] += 1
    
    for test_type, result in results.items():
        print(f"\n{test_type} test summary:")
        print(f"Total: {result['total']}")
        print(f"Passed: {result['passed']}")
        print(f"Failed: {result['total'] - result['passed']}")
    
    return {
        'statusCode': 200,
        'body': json.dumps(results)
    } 