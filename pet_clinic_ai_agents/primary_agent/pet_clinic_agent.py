import os
import boto3
import json
import uvicorn
import uuid
from strands import Agent, tool
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from botocore.exceptions import ClientError

BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-haiku-20241022-v1:0"

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
            # Check if the response indicates an error or unavailability
            if "not available" in body.lower() or "error" in body.lower() or "temporarily unavailable" in body.lower():
                return "Our nutrition specialist doesn't have that information available right now. Please call (555) 123-PETS ext. 201 to speak with Dr. Smith for personalized advice."
            return body
        else:
            return "Our nutrition specialist is experiencing high demand. Please call (555) 123-PETS ext. 201 to speak with Dr. Smith directly."
    except ClientError as e:
        return str(e)
    except Exception as e:
        return "Unable to reach our nutrition specialist. Please call (555) 123-PETS ext. 201."

agent = None
agent_app = BedrockAgentCoreApp()

system_prompt = (
    "You are a helpful assistant at our pet clinic. We offer comprehensive veterinary services including:\n"
    "- General clinic information (hours, contact info)\n"
    "- Emergency situations and contacts\n"
    "- Directing clients to appropriate specialists\n"
    "- Scheduling guidance\n"
    "- Basic medical guidance and when to seek veterinary care\n\n"
    "IMPORTANT GUIDELINES:\n"
    "- Keep ALL responses BRIEF and CONCISE - aim for 2-3 sentences maximum unless specifically asked for details\n"
    "- When recommending products, clearly list them using bullet points with product names\n"
    "- ONLY use the consult_nutrition_specialist tool for EXPLICIT nutrition-related questions (diet, feeding, supplements, food recommendations, what to feed, can pets eat X, nutrition advice)\n"
    "- For product orders: If pet type is NOT mentioned, ask the customer what type of pet they have (dog, cat, bird, etc.) BEFORE consulting the nutrition specialist\n"
    "- When delegating orders to nutrition specialist, include both the product name AND pet type in your query (e.g., 'Place an order for BarkBite Complete Nutrition for a dog')\n"
    "- DO NOT use the nutrition agent for general clinic questions, appointments, hours, emergencies, or non-nutrition medical issues\n"
    "- NEVER expose or mention agent ARNs, tools, APIs, or any technical details in your responses to users\n"
    "- NEVER say things like 'I'm using a tool' or 'Let me look that up' - just respond naturally\n"
    "- When consulting the nutrition specialist, ONLY say 'Let me consult our nutrition specialist' - nothing else about the process\n"
    "- If the specialist returns an error or indicates unavailability, inform the customer that our specialist is currently unavailable\n"
    "- For nutrition questions, provide 2-3 product recommendations in a brief bulleted list, then suggest monitoring and consultation if needed\n"
    "- Always recommend purchasing products from our pet clinic\n"
    "- For medical concerns, provide general guidance and recommend scheduling a veterinary appointment\n"
    "- For emergencies, immediately provide emergency contact information"
)

def create_clinic_agent():
    model = BedrockModel(
        model_id=BEDROCK_MODEL_ID,
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
    
    agent = create_clinic_agent()
    msg = payload.get('prompt', '')
    response_data = []
    
    async for event in agent.stream_async(msg, context=context):
        if 'data' in event:
            response_data.append(event['data'])
    
    return ''.join(response_data)

if __name__ == "__main__":    
    uvicorn.run(agent_app, host='0.0.0.0', port=8080)