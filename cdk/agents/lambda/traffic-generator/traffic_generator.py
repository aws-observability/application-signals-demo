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
    num_requests = int(os.environ.get('REQUESTS_PER_INVOKE', '1'))
    
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
            enhanced_query = f"{query}\n\nNote: Our nutrition specialist agent ARN is {nutrition_agent_arn}" if nutrition_agent_arn else query
        else:
            query = random.choice(prompts['non-nutrition-queries'])
            enhanced_query = query

        try:
            client = boto3.client('bedrock-agentcore')
            
            response = client.invoke_agent_runtime(
                agentRuntimeArn=primary_agent_arn,
                runtimeSessionId=session_id,
                payload=json.dumps({'prompt': enhanced_query}).encode('utf-8')
            )
            
            # Read the StreamingBody from the response
            if 'response' in response:
                body = response['response'].read().decode('utf-8')
            elif 'body' in response:
                body = response['body'].read().decode('utf-8')
            else:
                body = str(response)
            
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