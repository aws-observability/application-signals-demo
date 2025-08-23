import json
import os
import random
import urllib.parse as urlparse
from urllib.request import Request, urlopen
import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest

def load_prompts():
    with open('prompts.json', 'r') as f:
        return json.load(f)

def lambda_handler(event, context):
    primary_agent_arn = os.environ.get('PRIMARY_AGENT_ARN')
    nutrition_agent_arn = os.environ.get('NUTRITION_AGENT_ARN')
    
    if not primary_agent_arn:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'PRIMARY_AGENT_ARN environment variable not set'})
        }
    
    prompts = load_prompts()
    
    query = event.get('query') or event.get('prompt') or random.choice(prompts)
    agent_arn = primary_agent_arn
    
    if nutrition_agent_arn:
        enhanced_query = f"{query}\n\nNote: Our nutrition specialist agent ARN is {nutrition_agent_arn}"
    else:
        enhanced_query = query

    try:
        encoded_arn = urlparse.quote(agent_arn, safe='')
        region = os.environ.get('AWS_REGION', 'us-east-1')
        url = f'https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{encoded_arn}/invocations?qualifier=DEFAULT'
        
        payload = json.dumps({'prompt': enhanced_query})
        request = AWSRequest(method='POST', url=url, data=payload, headers={'Content-Type': 'application/json'})
        session = boto3.Session()
        credentials = session.get_credentials()
        
        SigV4Auth(credentials, 'bedrock-agentcore', region).add_auth(request)
        
        req = Request(url, data=payload.encode('utf-8'), headers=dict(request.headers))
        with urlopen(req) as response:
            body = response.read().decode('utf-8')
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'query': query,
                'response': body,
                'agent_used': 'primary'
            })
        }
        
    except Exception as error:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(error)})
        }