import boto3
from datetime import datetime, timedelta, timezone

# Event categories for flexible matching
EVENT_CATEGORIES = {
    'lambda_update': ['UpdateFunction', 'PutFunction'],
    'lambda_invoke': ['Invoke'],
    'lambda_create': ['CreateFunction'],
    'lambda_delete': ['DeleteFunction']
}

def execute_test(test_case):
    """Execute CloudTrail test"""
    client = boto3.client('cloudtrail')
    
    time_range_minutes = test_case.get('time_range_minutes', 100)
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(minutes=time_range_minutes)
    
    resource_name = test_case.get('resource_name', 'audit-service')
    event_category = test_case.get('event_category', 'lambda_update')
    event_patterns = EVENT_CATEGORIES.get(event_category, [test_case.get('event_pattern', 'UpdateFunction')])
    
    try:
        response = client.lookup_events(
            LookupAttributes=[
                {
                    'AttributeKey': 'ResourceName',
                    'AttributeValue': resource_name
                }
            ],
            StartTime=start_time,
            EndTime=end_time
        )
        
        events = response.get('Events', [])
        # Filter by event name patterns
        filtered_events = [
            e for e in events 
            if any(pattern in e.get('EventName', '') for pattern in event_patterns)
        ]
        
        return filtered_events
    except Exception as e:
        print(f"Error executing CloudTrail test: {str(e)}")
        return []

def validate_test(response, test_case):
    """Validate CloudTrail test result"""
    min_events = test_case.get('min_events', 1)
    return len(response) >= min_events

def run_test(test_case):
    """Run single CloudTrail test case"""
    response = execute_test(test_case)
    return validate_test(response, test_case)