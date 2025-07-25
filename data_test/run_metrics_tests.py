#!/usr/bin/env python3
import json
import sys
import boto3
from datetime import datetime, timedelta, timezone
from string_replacer import load_and_apply_replacements

def load_test_cases(json_file_path):
    try:
        # Load test cases with replacement functionality
        data = load_and_apply_replacements(json_file_path, "STRING_REPLACEMENT_RULES")
        return data.get("metric_test_cases", [])
    except FileNotFoundError:
        print(f"ERROR: JSON Not Found {json_file_path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: JSON File Phase Error {json_file_path}: {e}", file=sys.stderr)
        sys.exit(1)

def get_time_range_params(test_case):
    evaluation_period_minutes = test_case.get("evaluation_period_minutes", 5)
    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(minutes=evaluation_period_minutes)
    return start_dt, end_dt

def get_non_business_hours_ranges(start_dt, end_dt):
    """
    Get non-business time periods (UTC 9-5以外的时间) in the last 24 hours
    
    """
    ranges = []
    
    # Current time point
    current = start_dt
    
    while current < end_dt:
        # Get UTC 9:00 and 17:00 time points for the current day
        day_start = current.replace(hour=0, minute=0, second=0, microsecond=0)
        business_start = day_start.replace(hour=9)
        business_end = day_start.replace(hour=17)
        
        # If current time is between 0:00 and 9:00
        if current.time() < business_start.time():
            range_end = min(business_start, end_dt)
            ranges.append((current, range_end))
            
        # If current time is between 17:00 and 24:00
        elif current.time() >= business_end.time():
            next_day = day_start + timedelta(days=1)
            range_end = min(next_day, end_dt)
            ranges.append((current, range_end))
            
        # Move to the next time point
        if current.time() < business_start.time():
            current = business_start
        elif current.time() < business_end.time():
            current = business_end
        else:
            current = day_start + timedelta(days=1)
    return ranges


def execute_metric_test(test_case):
    session = boto3.Session()
    cloudwatch = session.client('cloudwatch')
    
    start_dt, end_dt = get_time_range_params(test_case)
    
    # Check if only non-business hours are needed
    if test_case.get("non_business_hours_only", False):
        non_business_ranges = get_non_business_hours_ranges(start_dt, end_dt)
        if not non_business_ranges:
            print("⚠️ No non-business time periods in the specified time range")
            return None
        
        all_results = []
        for range_start, range_end in non_business_ranges:
            try:
                response = cloudwatch.get_metric_data(
                    StartTime=range_start,
                    EndTime=range_end,
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
                if response and response.get("MetricDataResults"):
                    all_results.extend(response["MetricDataResults"][0].get("Values", []))
            except Exception as e:
                print(f"❌ Failed to get metric data in non-business time period {range_start} to {range_end}: {str(e)}")
        
        # Merge all non-business time period results
        if all_results:
            print(f"✅ Successfully got metric data in non-business time periods")
            return {"MetricDataResults": [{"Values": all_results}]}
        return None
    
    # Original query logic
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
        print(f"❌ Failed to get metric data: {str(e)}")
        return None

def execute_and_validate_command(response, test_case):
    if not response:
        return
        
    print("\n=== Validation Results ===")
    
    threshold = test_case.get("threshold", {})
    comparison_operators = threshold.get("comparison_operator", "GreaterThanThreshold")
    threshold_value = threshold.get("value")
    
    if isinstance(comparison_operators, str):
        comparison_operators = [comparison_operators]
    
    if not response.get("MetricDataResults"):
        print("❌ No metric data found")
        return
        
    metric_values = response["MetricDataResults"][0].get("Values", [])
    if not metric_values:
        print("❌ No metric values found")
        return
        
    
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
    
    print(f"Overall Result: {'✅ Passed' if all(all_results) else '❌ Failed'}")

def run_test_case(test_case):
    print(f"\n--- Execute Test Case: {test_case.get('test_case_id', 'N/A')} ---")
    print(f"Description: {test_case.get('description', 'N/A')}")
    
    response = execute_metric_test(test_case)
    execute_and_validate_command(response, test_case)
    
    print("--- Test End ---\n")

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 run_metrics_tests.py <path_to_test_cases.json>")
        sys.exit(1)
    
    json_file_arg = sys.argv[1]
    test_cases = load_test_cases(json_file_arg)
    
    if not test_cases:
        print(f"No metric test cases found")
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