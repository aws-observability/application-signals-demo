import os
import urllib.parse
import json
import requests
import base64

from boto3.session import Session
from langchain_aws import ChatBedrockConverse
from botocore.config import Config
from botocore.exceptions import ClientError
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
region = os.environ['AWS_REGION']
account_id = os.environ['AWS_ACCOUNT_ID']
cloudwatch_namespace = os.environ['CLOUDWATCH_NAMESPACE']
bucket_name = os.environ['S3_BUCKET_NAME']

def get_llm(modelID):
    """
    Initializes and returns a ChatBedrockConverse instance for the specified model ID

    Args:
        modelID (str): The model ID used in the inference-profile ARN

    Returns:
        ChatBedrockConverse: Configured instance of the model
    """
    session = Session()

    config = Config(
        read_timeout=60*5,
        retries={'max_attempts': 10, 'mode': 'adaptive'}
    )
    bedrock_client = session.client(
        'bedrock-runtime', region_name=region, config=config)

    return ChatBedrockConverse(
        model_id=f'arn:aws:bedrock:{region}:{account_id}:inference-profile/{modelID}',
        temperature=0.0,
        max_tokens=None,
        client=bedrock_client,
        provider='Antropic',
        cache=False,
    )

def authentication_open():
    """
    Generates a federated AWS Console login URL using credentials from the "auth-access" profile

    Returns:
        str: URL providing federated access to the AWS Console
    """
    session = Session(profile_name='auth-access')
    creds = session.get_credentials().get_frozen_credentials()

    session_dict = {
        "sessionId": creds.access_key,
        "sessionKey": creds.secret_key,
        "sessionToken": creds.token,
    }

    session_json = urllib.parse.quote(json.dumps(session_dict))
    signin_token_url = f"https://signin.aws.amazon.com/federation?Action=getSigninToken&Session={session_json}"
    signin_token_response = requests.get(signin_token_url)
    signin_token = signin_token_response.json()["SigninToken"]

    destination = "https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#home:"
    login_url = (
        "https://signin.aws.amazon.com/federation"
        f"?Action=login"
        f"&Issuer=my-script"
        f"&Destination={urllib.parse.quote(destination)}"
        f"&SigninToken={signin_token}"
    )

    return login_url

def publish_metric(result, test_id, session):
    """
    Publishes a CloudWatch custom metric to indicate the result of a test case

    Args:
        result (bool): The result of the test. True indicates failure, False indicates success
        test_id (str): The ID of the test case
        session (Session): Session with permissions to publish a metric to CloudWatch

    Returns:
        None
    """
    cloudwatch = session.client('cloudwatch', region_name=region)

    metric_name = "Failure"

    cloudwatch.put_metric_data(
        Namespace=cloudwatch_namespace,
        MetricData=[
            {
                "MetricName": metric_name,
                "Dimensions": [
                    {
                        "Name": "TestCase",
                        "Value": test_id
                    }
                ],
                "Value": 0.0 if not result else 1.0,
            }
        ]
    )
    print(f"Published metric: {metric_name} in namespace {cloudwatch_namespace} as {'0.0' if not result else '1.0'}")

def upload_s3(screenshots, test_id, session):
    """
    Uploads screenshots for each step conducted in the given test to an S3 bucket

    Args:
        screenshots (List[str]): List of base64-encoded screenshot strings
        test_id (str): The ID of the test case
        session (Session): Session with permissions to access S3

    Returns:
        None
    """
    s3_client = session.client('s3', region_name=region)

    try:
        s3_client.head_bucket(Bucket=bucket_name)
    except ClientError as e:
        s3_client.create_bucket(Bucket=bucket_name)

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    s3_prefix = f"screenshots/test-{test_id}/{timestamp}/"

    for i, screenshot in enumerate(screenshots):
        screenshot_data = base64.b64decode(screenshot)
        s3_key = f"{s3_prefix}screenshot_{i}.png"

        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=screenshot_data,
            ContentType="image/png"
        )