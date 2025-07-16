import json
import boto3
import time
from opentelemetry import trace
from datetime import datetime, timedelta

dynamodb = boto3.resource('dynamodb')
table_name = 'PetClinicPayment'
table = dynamodb.Table(table_name)
tracer = trace.get_tracer(__name__)

def lambda_handler(event, context):
    for record in event['Records']:
        print("Starting audit job")

        message = record["body"]
        print(message)

        data = json.loads(message)
        id = data["PaymentId"]
        ownerId = data["OwnerId"]
        amount = data["Amount"]

        span = trace.get_current_span()
        span.set_attribute("order.id", id)
        span.set_attribute("owner.id", ownerId)

        start_time = datetime.now()
        end_time = start_time + timedelta(minutes=2)

        while datetime.now() < end_time:
            response = table.get_item(Key={"id": id})
            print(response)
            if 'Item' in response:
                print(response['Item'])
                # if int(amount) > 100:
                #     raise Exception("Audit failed for ID " + id)
                return {
                    'statusCode': 200,
                    'body': json.dumps({'message': 'Audit passed'})
                }
            else:
                print(f"Item not found for ID {id}. Retrying...")
                time.sleep(30)  # Wait for 10 seconds before next poll

        print(f"Audit failed for ID {id} - timeout after 3 minutes")
        raise Exception(f"Audit failed for ID {id} - timeout after 3 minutes. PaymentId not found in DDB table {table_name}")

    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'All audits completed'})
    }