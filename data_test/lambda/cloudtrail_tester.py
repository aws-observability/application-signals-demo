import boto3
from datetime import datetime, timedelta, timezone

def execute_test(test_case):
    """Execute CloudTrail test"""
    client = boto3.client('cloudtrail')
    
    time_range_minutes = test_case.get('time_range_minutes', 100)
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(minutes=time_range_minutes)
    
    resource_name = test_case.get('resource_name', 'audit-service')
    
    try:
        all_events = []
        next_token = None
        
        while True:
            params = {
                'LookupAttributes': [
                    {
                        'AttributeKey': 'ResourceName',
                        'AttributeValue': resource_name
                    }
                ],
                'StartTime': start_time,
                'EndTime': end_time
            }
            
            if next_token:
                params['NextToken'] = next_token
            
            response = client.lookup_events(**params)
            events = response.get('Events', [])
            all_events.extend(events)
            
            # Filter current batch for UpdateFunction events
            filtered_events = [
                e for e in events 
                if 'UpdateFunction' in e.get('EventName')
            ]
            
            # If we found matching events, return them immediately
            if filtered_events:
                return filtered_events
            
            next_token = response.get('NextToken')
            if not next_token:
                break
    
        return []
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