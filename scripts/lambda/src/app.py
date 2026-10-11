import json
import boto3
from decimal import Decimal

def lambda_handler(event, context):
    try:
        # Initialize DynamoDB client
        dynamodb = boto3.resource('dynamodb')
        
        # Specify the table name
        table_name = 'BillingInfo'
        table = dynamodb.Table(table_name)
        
        total_payment = Decimal('0')
        items_processed = 0

        # Scan the entire table
        response = table.scan()
        
        while True:
            # Process items and sum payments
            for item in response['Items']:
                billing_data = json.loads(item['billing'])
                payment = Decimal(billing_data['payment'])
                total_payment += payment
                items_processed += 1
            
            # Check if there are more items to scan
            if 'LastEvaluatedKey' not in response:
                break
            response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])

        return {
            'statusCode': 200,
            'body': json.dumps(f'Total payment: {total_payment}')
        }

    except Exception as e:
        error_message = str(e)
        print(f"Error: {error_message}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error: {error_message}')
        }
