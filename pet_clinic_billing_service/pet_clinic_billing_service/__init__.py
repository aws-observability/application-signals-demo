import socket
import os
from py_eureka_client import eureka_client
import boto3

def table_exists(table_name, dynamodb_client):
    try:
        dynamodb_client.describe_table(TableName=table_name)
        return True
    except dynamodb_client.exceptions.ResourceNotFoundException:
        return False

def create_dynamodb_table():
    # Initialize a DynamoDB client
    dynamodb = boto3.client('dynamodb', region_name=os.environ.get('REGION', 'us-east-1'))

    # Define table parameters
    table_name = 'BillingInfo'
    billing_mode = 'PROVISIONED'
    read_capacity_units = 2
    write_capacity_units = 2
    hash_key = 'ownerId'
    range_key = 'timestamp'
    attribute_definitions = [
        {
            'AttributeName': 'ownerId',
            'AttributeType': 'S'
        },
        {
            'AttributeName': 'timestamp',
            'AttributeType': 'S'
        }
    ]
    key_schema = [
        {
            'AttributeName': 'ownerId',
            'KeyType': 'HASH'
        },
        {
            'AttributeName': 'timestamp',
            'KeyType': 'RANGE'
        }
    ]

    # Check if table exists
    if not table_exists(table_name, dynamodb):
        # Create table
        dynamodb.create_table(
            TableName=table_name,
            KeySchema=key_schema,
            AttributeDefinitions=attribute_definitions,
            ProvisionedThroughput={
                'ReadCapacityUnits': read_capacity_units,
                'WriteCapacityUnits': write_capacity_units
            }
        )
        print("Table created successfully.")
    else:
        print("Table already exists.")

# Call the function to create DynamoDB table
create_dynamodb_table()


# Get the local IP address
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.connect(("8.8.8.8", 80))
local_ip = s.getsockname()[0]
s.close()

eureka_server_url = os.environ.get('EUREKA_SERVER_URL', 'localhost')
# Register with Eureka
eureka_client.init(
    eureka_server=f"http://{eureka_server_url}:8761/eureka",
    instance_host=local_ip,
    app_name="billing-service",
    instance_port=8800,  # Django's default port
    # ... other configuration options
)
