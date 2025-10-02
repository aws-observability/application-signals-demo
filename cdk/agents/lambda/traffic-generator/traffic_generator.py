import json
import os
import random
import uuid
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
    num_requests = int(os.environ.get('REQUESTS_PER_INVOKE', '20'))
    
    # Use environment variable session ID or generate one
    session_id = os.environ.get('SESSION_ID', f"pet-clinic-session-{str(uuid.uuid4())}")

    if not primary_agent_arn:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'PRIMARY_AGENT_ARN environment variable not set'})
        }
    
    prompts = load_prompts()
    results = []
    
    for _ in range(num_requests):
        is_nutrition_query = random.random() <= 0.75
        
        if is_nutrition_query:
            query = random.choice(prompts['nutrition-queries'])
            enhanced_query = f"{query}\n\nSession ID: {session_id}\nNote: Our nutrition specialist agent ARN is {nutrition_agent_arn}" if nutrition_agent_arn else f"{query}\n\nSession ID: {session_id}"
        else:
            query = random.choice(prompts['non-nutrition-queries'])
            enhanced_query = f"{query}\n\nSession ID: {session_id}"

        try:
            encoded_arn = urlparse.quote(primary_agent_arn, safe='')
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
            
            results.append({
                'query': query,
                'response': body,
                'agent_used': 'primary'
            })
            
        except Exception as error:
            results.append({
                'query': query,
                'error': str(error)
            })
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'total_requests': len(results),
            'results': results
        })
    }