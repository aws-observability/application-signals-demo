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
    """
    Traffic generator that invokes the Primary Agent with random queries.
    
    Each query includes the Nutrition Agent's ARN in the context, allowing the
    Primary Agent to delegate nutrition-related questions to the specialized agent.
    
    Also generates a random session ID to be reused following runtime's best practices:
    https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-sessions.html
    """
    
    primary_agent_arn = os.environ.get('PRIMARY_AGENT_ARN')
    nutrition_agent_arn = os.environ.get('NUTRITION_AGENT_ARN')
    num_requests = int(os.environ.get('REQUESTS_PER_INVOKE', '1'))
    region = os.environ.get('AWS_REGION', 'us-east-1')
    session_id = os.environ.get('SESSION_ID', f"pet-clinic-session-{str(uuid.uuid4())}")

    if not primary_agent_arn:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'PRIMARY_AGENT_ARN environment variable not set'})
        }
    
    prompts = load_prompts()
    results = []
    session = boto3.Session()
    credentials = session.get_credentials()
    
    for _ in range(num_requests):
        is_nutrition_query = random.random() <= 0.75
        query = random.choice(prompts['nutrition-queries' if is_nutrition_query else 'non-nutrition-queries'])
        prompt = f"{query}\n\nNote: Our nutrition specialist agent ARN is {nutrition_agent_arn}" if nutrition_agent_arn else query

        try:
            encoded_arn = urlparse.quote(primary_agent_arn, safe='')
            url = f'https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{encoded_arn}/invocations?qualifier=DEFAULT'
            
            payload = json.dumps({'prompt': prompt}).encode('utf-8')
            request = AWSRequest(method='POST', url=url, data=payload, headers={
                'Content-Type': 'application/json',
                'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': session_id
            })
            SigV4Auth(credentials, 'bedrock-agentcore', region).add_auth(request)
            
            with urlopen(Request(url, data=payload, headers=dict(request.headers))) as response:
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