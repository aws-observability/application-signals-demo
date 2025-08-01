import boto3, os
from datetime import datetime, timedelta, timezone

logs = boto3.client('logs')

environment_name = os.environ.get("ENV_NAME", "eks:eks-pet-clinic-demo/pet-clinic")
eks_cluster_name = os.environ.get("EKS_CLUSTER_NAME", "eks-pet-clinic-demo")

def get_time_range_params(params):
    """Get time range params"""
    time_range = params.get("time_range", {})
    relative_minutes = time_range.get("relative_minutes", 60)
    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(minutes=int(relative_minutes))
    return start_dt, end_dt

def execute_test(test_case):
    """Execute logs test"""
    start_dt, end_dt = get_time_range_params(test_case)
    
    # Process log group names to replace EKS_CLUSTER_PLACEHOLDER
    processed_log_groups = []
    for log_group in test_case["log_group_names"]:
        processed_log_groups.append(log_group.replace('EKS_CLUSTER_PLACEHOLDER', eks_cluster_name))
    
    try:
        response = logs.start_query(
            logGroupNames=processed_log_groups,
            startTime=int(start_dt.timestamp() * 1000),
            endTime=int(end_dt.timestamp() * 1000),
            queryString=test_case["query_string"].replace('ENVIRONMENT_NAME_PLACEHOLDER', environment_name)
        )
        
        query_id = response['queryId']
        
        while True:
            query_status = logs.get_query_results(queryId=query_id)
            if query_status['status'] == 'Complete':
                return query_status
            elif query_status['status'] in ['Failed', 'Cancelled']:
                print(f"Query failed with status: {query_status['status']}")
                return None
            
        return query_status
    except Exception as e:
        print(f"Failed to execute logs query: {str(e)}")
        return None

def validate_test(response, test_case):
    """Validate logs test result"""
    if not response:
        print(f"Failed to get logs data: {test_case['test_case_id']}")
        return False
        
    validation_checks = test_case.get("validation_checks", [])
    all_results = []
    
    for check in validation_checks:
        if check.get("check_type") == "count":
            actual_count = len(response.get("results", []))
            expected_count = check.get("expected_count")
            operator = check.get("comparison_operator", "GreaterThanOrEqualToThreshold")
            result = actual_count >= expected_count if operator == "GreaterThanOrEqualToThreshold" else actual_count == expected_count
            print(f"Test_scenario: {test_case['test_scenario']}, Test_case_id: {test_case['test_case_id']}, Validation_type: {check.get('check_type')} Result: {result}")
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
            print(f"Test_scenario: {test_case['test_scenario']}, Test_case_id: {test_case['test_case_id']}, Validation_type: {check.get('check_type')} Result: {found}")
            all_results.append(found)
    
    return all(all_results)

def run_test(test_case):
    """Run single logs test case"""
    response = execute_test(test_case)
    return validate_test(response, test_case) 