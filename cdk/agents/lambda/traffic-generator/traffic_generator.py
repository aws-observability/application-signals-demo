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
    Traffic generator that invokes the Pet Clinic frontend agent endpoint with random queries.
    Falls back to direct Primary Agent invocation if PET_CLINIC_URL is not set.
    """
    
    pet_clinic_url = os.environ.get('PET_CLINIC_URL', '')
    primary_agent_arn = os.environ.get('PRIMARY_AGENT_ARN')
    nutrition_agent_arn = os.environ.get('NUTRITION_AGENT_ARN')
    region = os.environ.get('AWS_REGION', 'us-east-1')
    session_id = os.environ.get('SESSION_ID', f"pet-clinic-session-{str(uuid.uuid4())}")
    
    if not pet_clinic_url and not primary_agent_arn:
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Neither PET_CLINIC_URL nor PRIMARY_AGENT_ARN set, skipping traffic generation'})
        }
    
    prompts = load_prompts()
    results = []
    
    # Generate queries for all requests
    queries = []
    for _ in range(random.randint(1, 4)):
        is_nutrition_query = random.random() <= 0.95
        queries.append(random.choice(prompts['nutrition-queries' if is_nutrition_query else 'non-nutrition-queries']))
    
    # Fallback to direct agent invocation if PET_CLINIC_URL is not set
    if not pet_clinic_url:
        session = boto3.Session()
        credentials = session.get_credentials()
        
        for query in queries:
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
    else:
        # Use Pet Clinic URL if available
        for query in queries:
            try:
                url = f"{pet_clinic_url.rstrip('/')}/api/agent/ask"
                payload = json.dumps({'query': query}).encode('utf-8')
                request = Request(url, data=payload, headers={'Content-Type': 'application/json'})
                
                with urlopen(request) as response:
                    body = response.read().decode('utf-8')
                
                results.append({
                    'query': query,
                    'response': body
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