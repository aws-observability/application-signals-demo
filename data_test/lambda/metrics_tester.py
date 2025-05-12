import boto3
from datetime import datetime, timedelta, timezone

cloudwatch = boto3.client('cloudwatch')

def get_time_range_params(params):
    """Get time range params"""
    evaluation_period_minutes = params.get("evaluation_period_minutes", 5)
    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(minutes=evaluation_period_minutes)
    return start_dt, end_dt

def execute_test(test_case):
    """Execute metric test"""
    start_dt, end_dt = get_time_range_params(test_case)
    
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
        print(f"Failed to get metric data: {str(e)}")
        return None

def validate_test(response, test_case):
    """Validate metric test result"""
    if not response or not response.get("MetricDataResults"):
        print(f"Failed to get metric data: {test_case['test_case_id']}")
        return False
        
    metric_values = response["MetricDataResults"][0].get("Values", [])
    if not metric_values:
        print(f"No metric values found for test case: {test_case['test_case_id']}")
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

    print(f"Test_scenario: {test_case['test_scenario']}, Test_case_id: {test_case['test_case_id']}, Validation_type: metric exists Result: {result}")
    
    return all(all_results)

def run_test(test_case):
    """Run single metric test case"""
    response = execute_test(test_case)
    return validate_test(response, test_case) 