import json
import boto3
import random
from opentelemetry import trace

dynamodb = boto3.resource('dynamodb')
table_name = 'HistoricalRecordDynamoDBTable'
table = dynamodb.Table(table_name)

def lambda_handler(event, context):
    # Add null check for event to prevent errors
    if event is None:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid request: event is null'}),
            'headers': {
                'Content-Type': 'application/json'
            }
        }

    query_params = event.get('queryStringParameters') or {}
    current_span = trace.get_current_span()
    # Add an attribute to the current span
    owner_id = random.randint(1, 9)  # Generate a random value between 1 and 9
    current_span.set_attribute("owner.id", owner_id)

    owners = query_params.get('owners')
    pet_id = query_params.get('petid')

    try:
        # Optimize DynamoDB access - use Query instead of Scan for better performance
        # For demo purposes, we'll use a more efficient approach
        # If we had a GSI on owners/pet_id, we could query specifically
        # For now, we'll limit the scan and add pagination
        
        limit = int(query_params.get('limit', 50))  # Default limit of 50 items
        last_evaluated_key = query_params.get('lastKey')
        
        scan_kwargs = {
            'Limit': limit,
            'Select': 'ALL_ATTRIBUTES'
        }
        
        # Add pagination support
        if last_evaluated_key:
            try:
                scan_kwargs['ExclusiveStartKey'] = json.loads(last_evaluated_key)
            except (json.JSONDecodeError, TypeError):
                # Invalid lastKey, ignore and continue without pagination
                pass
        
        # Use scan with limit instead of full table scan for better performance
        response = table.scan(**scan_kwargs)
        items = response.get('Items', [])

        print(f"Retrieved {len(items)} records from DynamoDB Table")
        for item in items:
            if 'recordId' in item:
                print(item['recordId'])

        record_ids = [record['recordId'] for record in items if 'recordId' in record]
        
        # Prepare response with pagination info
        response_body = {
            'recordIds': record_ids,
            'count': len(record_ids)
        }
        
        # Add pagination info if there are more items
        if 'LastEvaluatedKey' in response:
            response_body['lastKey'] = json.dumps(response['LastEvaluatedKey'])
            response_body['hasMore'] = True
        else:
            response_body['hasMore'] = False

        return {
            'statusCode': 200,
            'body': json.dumps(response_body),
            'headers': {
                'Content-Type': 'application/json'
            }
        }
    except Exception as e:
        print(f"Error listing records: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'}),
            'headers': {
                'Content-Type': 'application/json'
            }
        }