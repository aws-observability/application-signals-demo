import json
import boto3
import os
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

    record_id = query_params.get('recordId')
    owners = query_params.get('owners')
    pet_id = query_params.get('petid')

    # Fix: Return proper 400 error instead of raising exception
    if not owners or not pet_id:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Missing required parameters: owners and petid'}),
            'headers': {
                'Content-Type': 'application/json'
            }
        }

    if not record_id:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'recordId is required'}),
            'headers': {
                'Content-Type': 'application/json'
            }
        }

    try:
        # Retrieve the item with the specified recordId
        response = table.get_item(Key={'recordId': record_id})

        # Check if the item exists
        if 'Item' in response:
            return {
                'statusCode': 200,
                'body': json.dumps(response['Item']),
                'headers': {
                    'Content-Type': 'application/json'
                }
            }
        else:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Record not found'}),
                'headers': {
                    'Content-Type': 'application/json'
                }
            }

    except Exception as e:
        print("Error retrieving record:", str(e))
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'}),
            'headers': {
                'Content-Type': 'application/json'
            }
        }