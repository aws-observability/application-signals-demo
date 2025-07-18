import os
import urllib.parse
import json
import requests
import base64
import subprocess

from boto3.session import Session
from langchain_aws import ChatBedrockConverse
from botocore.config import Config
from botocore.exceptions import ClientError
from datetime import datetime
from dotenv import load_dotenv
from botocore.session import Session as BotoCoreSession
from boto3 import Session as Boto3Session

# Load environment variables
load_dotenv()
region = os.environ['DEFAULT_ACCOUNT_AWS_REGION']
account_id = os.environ['DEFAULT_AWS_ACCOUNT_ID']
cloudwatch_namespace = os.environ['CLOUDWATCH_NAMESPACE']
bucket_name = os.environ['S3_BUCKET_NAME_PREFIX']
manual_mode = os.environ['MANUAL_MODE'].lower() == 'true'

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
    session = assume_cross_account_role() if not manual_mode else Session(profile_name='auth-access')
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
    print(f"Published metric: {metric_name} in namespace {cloudwatch_namespace} as {'0.0' if not result else '1.0'}", flush=True)

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
    unique_bucket_name = f"{bucket_name}-{account_id}-{region}".lower()

    try:
        s3_client.head_bucket(Bucket=unique_bucket_name)
    except ClientError as e:
        s3_client.create_bucket(Bucket=unique_bucket_name)

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    s3_prefix = f"screenshots/{test_id}/{timestamp}/"

    for i, screenshot in enumerate(screenshots):
        screenshot_data = base64.b64decode(screenshot)
        s3_key = f"{s3_prefix}screenshot_{i}.png"

        s3_client.put_object(
            Bucket=unique_bucket_name,
            Key=s3_key,
            Body=screenshot_data,
            ContentType="image/png"
        )

def assume_cross_account_role():
    """
    Assumes an IAM role in a different AWS account

    Returns:
        Session: boto3 session with temporary credentials for the assumed role
    """
    account_id = os.environ.get("DEMO_AWS_ACCOUNT_ID")
    role_name = os.environ.get("DEMO_ROLE_ID")
    role_arn = f"arn:aws:iam::{account_id}:role/{role_name}"

    cmd = [
        "aws", "sts", "assume-role",
        "--role-arn", role_arn,
        "--role-session-name", "auth-session",
        "--output", "json"
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    creds = json.loads(result.stdout)["Credentials"]

    # Return a boto3 session with assumed credentials
    session = Boto3Session(
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"]
    )

    return session

async def evaluate_js(
        page,
        js_file: str,
        function_call: str,
        args: dict = None,
        is_async: bool = False
    ):
    """
    Evaluates JavaScript code for tests from ./jsInjectionScripts

    Args:
        page: Browser Use page object to evaluate the script on
        js_file (str): Name of the JavaScript file in ./jsInjectionScripts to run
        function_call (str): JavaScript function call to execute after the script is injected
        args (dict, optional): Dictionary of arguments to pass into the JavaScript function. Defaults to None
        is_async (bool, optional): Whether the JavaScript function is asynchronous. Defaults to False

    Returns:
        Any: Result returned by the JavaScript function
    """
    js_file_path = os.path.join(os.path.dirname(
        __file__), "..", "jsInjectionScripts", js_file)
    with open(js_file_path, 'r') as file:
        js_code = file.read()

    js_args = args or {}
    arg_string = "args" if js_args else ""

    wrapper = "async" if is_async else ""

    return await page.evaluate(f"""
        {wrapper} ({arg_string}) => {{
            {js_code}
            return {"await " if is_async else ""}{function_call};
        }}
        """, js_args)