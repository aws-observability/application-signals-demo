import json
import boto3
import os
import random
from opentelemetry import trace


dynamodb = boto3.resource('dynamodb')
table_name = 'HistoricalRecordDynamoDBTable'
table = dynamodb.Table(table_name)

def lambda_handler(event, context):

    current_span = trace.get_current_span()
    # Add an attribute to the current span
    owner_id = random.randint(1, 9)  # Generate a random value between 1 and 9
    current_span.set_attribute("owner.id", owner_id)

    query_params = event.get('queryStringParameters', {})

    record_id = query_params.get('recordId')
    owners = query_params.get('owners')
    pet_id = query_params.get('petid')

    if owners is None or pet_id is None:
        raise Exception('Missing owner or pet_id')

    if record_id is None:
        return {
            'statusCode': 400,
            'body': json.dumps({'message': 'recordId is required'}),
            'headers': {
                'Content-Type': 'application/json'
            }
        }

    try:
        # Retrieve the item with the specified recordId
        response = table.get_item(Key={'recordId': record_id})  # Assuming recordId is the primary key

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
                'body': json.dumps({'message': 'Record not found'}),
                'headers': {
                    'Content-Type': 'application/json'
                }
            }

    except Exception as e:
        print("Error retrieving record:", str(e))
        return {
            'statusCode': 500,
            'body': json.dumps({'message': 'Internal server error'}),
            'headers': {
                'Content-Type': 'application/json'
            }
        }