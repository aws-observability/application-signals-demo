#!/usr/bin/env python3
import boto3
from datetime import datetime, timedelta, timezone

def run_cloudtrail_test():
    client = boto3.client('cloudtrail')
    
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(minutes=30)
    
    response = client.lookup_events(
        LookupAttributes=[
            {
                'AttributeKey': 'EventName',
                'AttributeValue': 'UpdateFunctionCode20150331v2'
            }
        ],
        StartTime=start_time,
        EndTime=end_time
    )
    
    events = response.get('Events', [])
    audit_service_events = [e for e in events if 'audit-service' in str(e)]
    
    print(f"Found {len(audit_service_events)} UpdateFunctionCode20150331v2 events for audit-service")
    
    if len(audit_service_events) >= 1:
        print("✅ PASS: At least one audit-service UpdateFunctionCode event found")
        return True
    else:
        print("❌ FAIL: No audit-service UpdateFunctionCode events found")
        return False
         
if __name__ == "__main__":
    run_cloudtrail_test()