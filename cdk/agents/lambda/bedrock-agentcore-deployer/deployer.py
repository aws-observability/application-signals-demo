import json
import boto3
from botocore.config import Config
from urllib.request import urlopen, Request

client = boto3.client('bedrock-agentcore-control', config=Config(retries={'max_attempts': 5, 'mode': 'standard'}))

def handler(event, context):
    print(f"Event: {json.dumps(event)}")
    
    request_type = event['RequestType']
    properties = event['ResourceProperties']
    
    try:
        if request_type == 'Create':
            return create_agent(properties, event, context)
        elif request_type == 'Update':
            return update_agent(properties, event, context)
        elif request_type == 'Delete':
            return delete_agent(properties, event, context)
    except Exception as e:
        return send_response(event, context, 'FAILED', {'Error': str(e)})

def create_agent(properties, event, context):
    agent_name = properties['AgentName']
    image_uri = properties['ImageUri']
    execution_role = properties['ExecutionRole']
    
    try:
        create_params = {
            'agentRuntimeName': agent_name,
            'description': f'{agent_name} agent for Application Signals demo',
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
            }
        }
        
        if 'EnvironmentVariables' in properties:
            create_params['environmentVariables'] = properties['EnvironmentVariables']
        
        response = client.create_agent_runtime(**create_params)
        
        agent_arn = response['agentRuntimeArn']
        
        return send_response(event, context, 'SUCCESS', {
            'AgentArn': agent_arn,
            'AgentName': agent_name
        }, agent_arn)
        
    except Exception as e:
        print(f"Agent creation failed: {str(e)}")
        raise e

def update_agent(properties, event, context):
    try:
        physical_resource_id = event.get('PhysicalResourceId')
        
        if not physical_resource_id or physical_resource_id == event['LogicalResourceId']:
            return send_response(event, context, 'FAILED', {'Error': 'No agent to update'})
        
        agent_runtime_id = physical_resource_id.split('/')[-1] if '/' in physical_resource_id else physical_resource_id.split(':')[-1]
        
        agent_name = properties['AgentName']
        image_uri = properties['ImageUri']
        execution_role = properties['ExecutionRole']
        
        update_params = {
            'agentRuntimeId': agent_runtime_id,
            'description': f'{agent_name} agent for Application Signals demo',
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
            }
        }
        
        if 'EnvironmentVariables' in properties:
            update_params['environmentVariables'] = properties['EnvironmentVariables']
        
        response = client.update_agent_runtime(**update_params)
        
        agent_arn = response['agentRuntimeArn']
        
        return send_response(event, context, 'SUCCESS', {
            'AgentArn': agent_arn,
            'AgentName': agent_name
        }, agent_arn)
        
    except Exception as e:
        print(f"Agent update failed: {str(e)}")
        return send_response(event, context, 'FAILED', {'Error': str(e)})

def delete_agent(properties, event, context):
    try:
        physical_resource_id = event.get('PhysicalResourceId')
        
        if not physical_resource_id or physical_resource_id == event['LogicalResourceId']:
            return send_response(event, context, 'SUCCESS', {})
        
        agent_runtime_id = physical_resource_id.split('/')[-1] if '/' in physical_resource_id else physical_resource_id.split(':')[-1]
        client.delete_agent_runtime(agentRuntimeId=agent_runtime_id)
        return send_response(event, context, 'SUCCESS', {})
        
    except Exception as e:
        return send_response(event, context, 'FAILED', {'Error': str(e)})

def send_response(event, context, status, data=None, physical_resource_id=None):
    response_data = data or {}
    
    response_body = {
        'Status': status,
        'Reason': f'See CloudWatch Log Stream: {context.log_stream_name}',
        'PhysicalResourceId': physical_resource_id or event.get('PhysicalResourceId', event['LogicalResourceId']),
        'StackId': event['StackId'],
        'RequestId': event['RequestId'],
        'LogicalResourceId': event['LogicalResourceId'],
        'Data': response_data
    }
    
    response_url = event['ResponseURL']
    json_response = json.dumps(response_body)
    
    headers = {
        'content-type': '',
        'content-length': str(len(json_response))
    }
    
    req = Request(response_url, data=json_response.encode('utf-8'), headers=headers, method='PUT')
    urlopen(req)
    
    return response_body