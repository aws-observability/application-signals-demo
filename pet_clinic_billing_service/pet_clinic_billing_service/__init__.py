import socket
import os
from py_eureka_client import eureka_client
import boto3

sns_client = boto3.client('sns', region_name='us-east-1')
def create_sns_topic(sns_client, topic_name):
    response = sns_client.create_topic(Name=topic_name)
    return response['TopicArn']

def check_sns_topic_exists(sns_client, topic_name):
    response = sns_client.list_topics()
    topics = response.get('Topics', [])
    for topic in topics:
        if topic_name in topic['TopicArn']:
            return topic['TopicArn']
    return None

def subscribe_to_topic(sns_client, topic_arn, email_address):
    sns_client.subscribe(
        TopicArn=topic_arn,
        Protocol='email',
        Endpoint=email_address

# create sns topic when not existing, and subscribe to it from provided email address
notification_arn = os.environ.get('NOTIFICATION_ARN')
if not notification_arn:
    topic_name = "application-signal-demo"
    existing_topic_arn = check_sns_topic_exists(sns_client, topic_name)
    if existing_topic_arn:
        notification_arn = existing_topic_arn
    else:
        notification_arn = create_sns_topic(sns_client, topic_name)
    
notification_email = os.environ.get('NOTIFICATION_EMAIL')
if notification_email:
    subscribe_to_topic(sns_client, notification_arn, notification_email)
else:
    print("Notification email address not provided in environment variables.")

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
