"""
Optimized Bedrock Agent Deployer with Token Usage Controls
Integrates TokenOptimizer for efficient GenAI token management
"""
import json
import boto3
import os
from botocore.config import Config
from urllib.request import urlopen, Request
from token_optimizer import TokenOptimizer

client = boto3.client('bedrock-agentcore-control', config=Config(retries={'max_attempts': 5, 'mode': 'standard'}))
optimizer = TokenOptimizer()

def handler(event, context):
    print(f"Event: {json.dumps(event)}")
    
    request_type = event['RequestType']
    properties = event['ResourceProperties']
    
    try:
        if request_type == 'Create':
            return create_optimized_agent(properties, event, context)
        elif request_type == 'Update':
            return update_optimized_agent(properties, event, context)
        elif request_type == 'Delete':
            return delete_agent(properties, event, context)
    except Exception as e:
        return send_response(event, context, 'FAILED', {'Error': str(e)})

def create_optimized_agent(properties, event, context):
    agent_name = properties['AgentName']
    image_uri = properties['ImageUri']
    execution_role = properties['ExecutionRole']
    
    try:
        # Add optimization environment variables
        env_vars = properties.get('EnvironmentVariables', {})
        env_vars.update({
            'TOKEN_OPTIMIZATION_ENABLED': 'true',
            'CACHE_TTL_SECONDS': '3600',
            'MAX_REQUESTS_PER_MINUTE': '100',
            'RESPONSE_MAX_TOKENS': '500' if 'nutrition' in agent_name.lower() else '300',
            'ENABLE_FAQ_RESPONSES': 'true',
            'DAILY_TOKEN_LIMIT': str(optimizer.DAILY_TOKEN_LIMITS.get(agent_name, 10_000_000))
        })
        
        create_params = {
            'agentRuntimeName': agent_name,
            'description': f'{agent_name} agent with token optimization for Application Signals demo',
            'agentRuntimeArtifact': {
                'containerConfiguration': {
                    'containerUri': image_uri
                }
            },
            'roleArn': execution_role,
            'networkConfiguration': {
                'networkMode': 'PUBLIC'
            },
            'protocolConfiguration': {
                'serverProtocol': 'HTTP'
            },
            'environmentVariables': env_vars
        }
        
        response = client.create_agent_runtime(**create_params)
        
        # Log optimization settings
        print(f"Created optimized agent {agent_name} with token limits:")
        print(f"- Daily limit: {env_vars['DAILY_TOKEN_LIMIT']} tokens")
        print(f"- Max tokens per response: {env_vars['RESPONSE_MAX_TOKENS']}")
        print(f"- Request throttling: {env_vars['MAX_REQUESTS_PER_MINUTE']}/min")
        
        return send_response(event, context, 'SUCCESS', {
            'AgentRuntimeId': response['agentRuntimeId'],
            'AgentRuntimeArn': response['agentRuntimeArn'],
            'OptimizationEnabled': True,
            'TokenLimits': {
                'daily_limit': env_vars['DAILY_TOKEN_LIMIT'],
                'max_tokens_per_response': env_vars['RESPONSE_MAX_TOKENS']
            }
        })
        
    except Exception as e:
        print(f"Error creating optimized agent: {str(e)}")
        return send_response(event, context, 'FAILED', {'Error': str(e)})

def update_optimized_agent(properties, event, context):
    agent_name = properties['AgentName']
    physical_resource_id = event['PhysicalResourceId']
    
    try:
        # Update with optimization settings
        env_vars = properties.get('EnvironmentVariables', {})
        env_vars.update({
            'TOKEN_OPTIMIZATION_ENABLED': 'true',
            'CACHE_TTL_SECONDS': '3600',
            'MAX_REQUESTS_PER_MINUTE': '100',
            'RESPONSE_MAX_TOKENS': '500' if 'nutrition' in agent_name.lower() else '300',
            'ENABLE_FAQ_RESPONSES': 'true',
            'DAILY_TOKEN_LIMIT': str(optimizer.DAILY_TOKEN_LIMITS.get(agent_name, 10_000_000))
        })
        
        update_params = {
            'agentRuntimeId': physical_resource_id,
            'description': f'{agent_name} agent with token optimization for Application Signals demo',
            'environmentVariables': env_vars
        }
        
        if 'ImageUri' in properties:
            update_params['agentRuntimeArtifact'] = {
                'containerConfiguration': {
                    'containerUri': properties['ImageUri']
                }
            }
        
        response = client.update_agent_runtime(**update_params)
        
        # Get current usage stats
        stats = optimizer.get_usage_stats()
        
        return send_response(event, context, 'SUCCESS', {
            'AgentRuntimeId': response['agentRuntimeId'],
            'AgentRuntimeArn': response['agentRuntimeArn'],
            'OptimizationEnabled': True,
            'UsageStats': stats.get(agent_name, {})
        })
        
    except Exception as e:
        print(f"Error updating optimized agent: {str(e)}")
        return send_response(event, context, 'FAILED', {'Error': str(e)})

def delete_agent(properties, event, context):
    """Delete agent (unchanged from original)"""
    try:
        physical_resource_id = event['PhysicalResourceId']
        
        # Check if the agent exists before trying to delete
        try:
            client.get_agent_runtime(agentRuntimeId=physical_resource_id)
        except client.exceptions.ResourceNotFoundException:
            print(f"Agent {physical_resource_id} not found, considering deletion successful")
            return send_response(event, context, 'SUCCESS', {})
        
        client.delete_agent_runtime(agentRuntimeId=physical_resource_id)
        
        return send_response(event, context, 'SUCCESS', {})
        
    except Exception as e:
        print(f"Error deleting agent: {str(e)}")
        return send_response(event, context, 'FAILED', {'Error': str(e)})

def send_response(event, context, response_status, response_data):
    """Send response to CloudFormation (unchanged from original)"""
    response_url = event['ResponseURL']
    
    response_body = {
        'Status': response_status,
        'Reason': f'See CloudWatch Log Stream: {context.log_stream_name}',
        'PhysicalResourceId': response_data.get('AgentRuntimeId', event.get('PhysicalResourceId', context.log_stream_name)),
        'StackId': event['StackId'],
        'RequestId': event['RequestId'],
        'LogicalResourceId': event['LogicalResourceId'],
        'Data': response_data
    }
    
    json_response_body = json.dumps(response_body)
    
    headers = {
        'content-type': '',
        'content-length': str(len(json_response_body))
    }
    
    try:
        request = Request(response_url, data=json_response_body.encode('utf-8'), headers=headers)
        request.get_method = lambda: 'PUT'
        response = urlopen(request)
        print(f"Status code: {response.getcode()}")
        print(f"Status message: {response.msg}")
        return True
    except Exception as e:
        print(f"send_response failed: {e}")
        return False