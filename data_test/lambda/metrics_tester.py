import boto3, os
from datetime import datetime, timedelta, timezone

cloudwatch = boto3.client('cloudwatch')

environment_name = os.environ.get("ENV_NAME", "eks:eks-pet-clinic-demo/pet-clinic")


def get_time_range_params(params):
    """Get time range params"""
    evaluation_period_minutes = params.get("evaluation_period_minutes", 5)
    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(minutes=evaluation_period_minutes)
    return start_dt, end_dt

def build_metric_expression(test_case):
    namespace = test_case["metric_namespace"]
    metric_name = test_case["metric_name"]
    statistic = test_case["statistic"]
    dimensions = test_case.get("dimensions", [])
    
    schema_parts = [f'"{namespace}"']
    dimension_filters = []
    no_validate_dimensions = []
    
    if dimensions:
        dimension_names = [dim["Name"] for dim in dimensions]
        schema_parts.extend(dimension_names)
        
        for dim in dimensions:
            if dim["Value"] == "NO_VALIDATE":
                no_validate_dimensions.append(dim["Name"])
            else:
                escaped_value = dim["Value"].replace("'", "''")
                dimension_filters.append(f"{dim['Name']} = '{escaped_value}'")
    
    schema_clause = f"SCHEMA({', '.join(schema_parts)})"
    
    where_clause = ""
    if dimension_filters:
        where_clause = f" WHERE {' AND '.join(dimension_filters)}"
    
    expression = f'SELECT {statistic}({metric_name}) FROM {schema_clause}{where_clause}'
    expression = expression.replace('ENVIRONMENT_NAME_PLACEHOLDER', environment_name)

    return expression

def execute_test(test_case):
    """Execute metric test"""
    start_dt, end_dt = get_time_range_params(test_case)
    
    use_query_style = test_case.get("use_query_style", False)
    
    if use_query_style:
        expression = build_metric_expression(test_case)
        try:
            response = cloudwatch.get_metric_data(
                StartTime=start_dt,
                EndTime=end_dt,
                MetricDataQueries=[
                    {
                        'Id': 'm1',
                        'Expression': expression,
                        'Period': 60,
                        'ReturnData': True
                    }
                ]
            )
            return response
        except Exception as e:
            print(f"Failed to get metric data with Expression: {str(e)}")
            return None
    else:
        # MetricStat mode - use all dimensions as-is, NO_VALIDATE is not supported
        dimensions = test_case.get("dimensions", [])

        new_dimensions = []
        for dim in dimensions:
            if isinstance(dim.get("Value"), str) and 'ENVIRONMENT_NAME_PLACEHOLDER' in dim["Value"]:
                new_dim = dim.copy()
                new_dim["Value"] = dim["Value"].replace('ENVIRONMENT_NAME_PLACEHOLDER', environment_name)
                new_dimensions.append(new_dim)
            else:
                new_dimensions.append(dim)
        dimensions = new_dimensions
        
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
                                'Dimensions': dimensions
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
            print(f"Failed to get metric data with MetricStat: {str(e)}")
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