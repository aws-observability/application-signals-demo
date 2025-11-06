import boto3
import json
import time
from datetime import datetime, timedelta, timezone

def execute_test(test_case):
    """Execute OTEL resource attributes test"""
    logs_client = boto3.client('logs')
    
    service_name = test_case["service_name"]
    time_range_minutes = test_case.get("time_range_minutes", 60)
    
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(minutes=time_range_minutes)
    
    query = f'''
    fields @timestamp, @message
    | filter attributes.aws.local.service = "{service_name}" and resource.attributes.aws.application_signals.metric_resource_keys like /Application&Team&Tier/
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
                return []
            time.sleep(2)
    except Exception as e:
        print("Exception in executing the otel resource attribute tests ", e)
        return []

def validate_test(response, test_case):
    """Validate OTEL resource attributes test result"""
    expected_attributes = test_case.get('expected_resource_attributes', {})
    
    if not response:
        return False
    
    found_attributes = {}
    
    for result in response:
        message = ""
        for field in result:
            if field['field'] == '@message':
                message = field['value']
                break
        
        try:
            span_data = json.loads(message)
            resource_attrs = span_data.get('resource', {}).get('attributes', {})
            
            for key, value in resource_attrs.items():
                if key in expected_attributes:
                    found_attributes[key] = value
            
            if found_attributes:
                break
        except:
            continue
    
    all_passed = True
    for attr_key, expected_value in expected_attributes.items():
        actual_value = found_attributes.get(attr_key)
        if actual_value != expected_value:
            all_passed = False
    
    return all_passed

def run_test(test_case):
    """Run single OTEL resource attributes test case"""
    response = execute_test(test_case)
    return validate_test(response, test_case)