import json
import boto3
import random
from opentelemetry import trace

dynamodb = boto3.resource('dynamodb')
table_name = 'HistoricalRecordDynamoDBTable'
table = dynamodb.Table(table_name)

def lambda_handler(event, context):
    query_params = event.get('queryStringParameters') or {}
    current_span = trace.get_current_span()
    # Add an attribute to the current span
    owner_id = random.randint(1, 9)  # Generate a random value between 1 and 9
    current_span.set_attribute("owner.id", owner_id)

    owners = query_params.get('owners')
    pet_id = query_params.get('petid')

    try:
        # Optimize: Use pagination to limit scan results and improve performance
        response = table.scan(
            Limit=100,  # Limit results to prevent large scans
            ProjectionExpression='recordId'  # Only fetch recordId to reduce data transfer
        )
        items = response.get('Items', [])

        print(f"Retrieved {len(items)} records from DynamoDB")
        for item in items:
            print(item['recordId'])

        record_ids = [record['recordId'] for record in items if 'recordId' in record]

        return {
            'statusCode': 200,
            'body': json.dumps({
                'recordIds': record_ids,
                'count': len(record_ids)
            }),
            'headers': {
                'Content-Type': 'application/json'
            }
        }
    except Exception as e:
        print(f"Error scanning table: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to retrieve records'}),
            'headers': {
                'Content-Type': 'application/json'
            }
        }