import os
import boto3
import json
import uvicorn
import uuid
import hashlib
from strands import Agent, tool
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from botocore.exceptions import ClientError

BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-haiku-20241022-v1:0"

# Simple in-memory cache for responses
response_cache = {}
CACHE_TTL = 3600  # 1 hour

def get_cache_key(query):
    """Generate cache key from query"""
    return hashlib.md5(query.lower().encode()).hexdigest()

def get_cached_response(query):
    """Get cached response if available and not expired"""
    key = get_cache_key(query)
    if key in response_cache:
        cached_data = response_cache[key]
        import time
        if time.time() - cached_data['timestamp'] < CACHE_TTL:
            return cached_data['response']
    return None

def cache_response(query, response):
    """Cache response with timestamp"""
    key = get_cache_key(query)
    import time
    response_cache[key] = {
        'response': response,
        'timestamp': time.time()
    }

@tool
def get_clinic_hours():
    """Get pet clinic operating hours"""
    return "Monday-Friday: 8AM-6PM, Saturday: 9AM-4PM, Sunday: Closed. Emergency services available 24/7."

@tool
def get_emergency_contact():
    """Get emergency contact information"""
    return "Emergency Line: (555) 123-PETS. For life-threatening emergencies, call immediately or visit our 24/7 emergency clinic."

@tool
def get_specialist_referral(specialty):
    """Get information about specialist referrals"""
    specialists = {
        "nutrition": "Dr. Smith - Pet Nutrition Specialist (ext. 201)",
        "surgery": "Dr. Johnson - Veterinary Surgeon (ext. 202)", 
        "dermatology": "Dr. Brown - Pet Dermatologist (ext. 203)",
        "cardiology": "Dr. Davis - Veterinary Cardiologist (ext. 204)"
    }
    return specialists.get(specialty.lower(), "Please call (555) 123-PETS for specialist referral information.")

@tool
def get_appointment_availability():
    """Check current appointment availability"""
    return "We have appointments available: Today 3:00 PM, Tomorrow 10:00 AM and 2:30 PM. Call (555) 123-PETS to schedule."

@tool
def consult_nutrition_specialist(query):
    """Delegate nutrition questions to the specialized nutrition agent."""
    
    agent_arn = os.environ.get('NUTRITION_AGENT_ARN')
    if not agent_arn:
        return "Nutrition specialist configuration error. Please call (555) 123-PETS ext. 201."
    
    try:
        region = os.environ.get('AWS_REGION') or os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')
        session_id = os.environ.get('CURRENT_SESSION_ID') or str(uuid.uuid4())
        client = boto3.client('bedrock-agentcore', region_name=region)
        response = client.invoke_agent_runtime(
            agentRuntimeArn=agent_arn,
            runtimeSessionId=session_id,
            qualifier='DEFAULT',
            payload=json.dumps({'prompt': query}).encode('utf-8')
        )
        # Read the streaming response
        if 'response' in response:
            body = response['response'].read().decode('utf-8')
            return body
        else:
            return "Our nutrition specialist is experiencing high demand. Please try again in a few moments or call (555) 123-PETS ext. 201."
    except ClientError as e:
        return str(e)
    except Exception as e:
        return "Unable to reach our nutrition specialist. Please call (555) 123-PETS ext. 201."

agent = None
agent_app = BedrockAgentCoreApp()

# Optimized system prompt - reduced by 50%
system_prompt = (
    "You are a helpful assistant at our pet clinic. Keep responses BRIEF (2-3 sentences max). "
    "For nutrition questions (diet, feeding, supplements), use consult_nutrition_specialist tool. "
    "For product orders, ask pet type first, then delegate to nutrition specialist. "
    "Never mention tools, APIs, or technical details."
)

def create_clinic_agent():
    model = BedrockModel(
        model_id=BEDROCK_MODEL_ID,
        max_tokens=300,  # Reduced from default
        temperature=0.1,  # More consistent responses
        stop_sequences=["Human:", "Assistant:", "\n\nHuman:", "\n\nAssistant:"]
    )
    
    tools = [get_clinic_hours, get_emergency_contact, get_specialist_referral, consult_nutrition_specialist, get_appointment_availability]
    
    return Agent(model=model, tools=tools, system_prompt=system_prompt)

@agent_app.entrypoint
async def invoke(payload, context):
    """
    Invoke the clinic agent with a payload
    """
    if context and hasattr(context, 'session_id') and context.session_id:
        os.environ['CURRENT_SESSION_ID'] = context.session_id
    
    msg = payload.get('prompt', '')
    
    # Check cache first for common queries
    cached_response = get_cached_response(msg)
    if cached_response:
        return cached_response
    
    # Simple query routing - handle basic questions without Bedrock
    basic_responses = {
        'hours': "Mon-Fri: 8AM-6PM, Sat: 9AM-4PM, Sun: Closed. Emergency 24/7.",
        'phone': "Call (555) 123-PETS for appointments and information.",
        'emergency': "Emergency Line: (555) 123-PETS. For life-threatening emergencies, call immediately.",
        'appointment': "Available: Today 3PM, Tomorrow 10AM & 2:30PM. Call (555) 123-PETS."
    }
    
    for keyword, response in basic_responses.items():
        if keyword in msg.lower():
            cache_response(msg, response)
            return response
    
    agent = create_clinic_agent()
    response_data = []
    
    async for event in agent.stream_async(msg, context=context):
        if 'data' in event:
            response_data.append(event['data'])
    
    full_response = ''.join(response_data)
    
    # Truncate response if too long
    if len(full_response) > 500:
        full_response = full_response[:500] + "... Call (555) 123-PETS for more info."
    
    # Cache the response
    cache_response(msg, full_response)
    
    return full_response

if __name__ == "__main__":    
    uvicorn.run(agent_app, host='0.0.0.0', port=8080)