from strands import Agent, tool
import uvicorn
import requests
import os
import boto3
import uuid
import hashlib
import json
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp

BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-haiku-20241022-v1:0"
NUTRITION_SERVICE_URL = os.environ.get('NUTRITION_SERVICE_URL')

# Simple in-memory cache for responses
response_cache = {}
CACHE_TTL = 3600  # 1 hour

agent = None
agent_app = BedrockAgentCoreApp()

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

def get_nutrition_data(pet_type):
    """Helper function to get nutrition data from the API"""
    if not NUTRITION_SERVICE_URL:
        return {"facts": "Error: Nutrition service not found", "products": ""}
    
    try:
        response = requests.get(f"{NUTRITION_SERVICE_URL}/{pet_type.lower()}", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            return {"facts": data.get('facts', ''), "products": data.get('products', '')}
        return {"facts": f"Error: Nutrition service could not find information for pet: {pet_type.lower()}", "products": ""}
    except requests.RequestException:
        return {"facts": "Error: Nutrition service down", "products": ""}

@tool
def get_feeding_guidelines(pet_type):
    """Get feeding guidelines based on pet type"""
    data = get_nutrition_data(pet_type)
    result = f"Nutrition info for {pet_type}: {data['facts']}"
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def get_dietary_restrictions(pet_type):
    """Get dietary recommendations for specific health conditions by animal type"""
    data = get_nutrition_data(pet_type)
    result = f"Dietary info for {pet_type}: {data['facts']}. Consult veterinarian for condition-specific advice."
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def get_nutritional_supplements(pet_type):
    """Get supplement recommendations by animal type"""
    data = get_nutrition_data(pet_type)
    result = f"Supplement info for {pet_type}: {data['facts']}. Consult veterinarian for supplements."
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def create_order(product_name, pet_type, quantity=1):
    """Create an order for a recommended product. Requires product_name, pet_type, and optional quantity (default 1)."""
    product_lower = product_name.lower()
    data = get_nutrition_data(pet_type)
    if data['products'] and product_name.lower() in data['products'].lower():
        order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
        return f"Order {order_id} created for {quantity}x {product_name}. Total: ${quantity * 29.99:.2f}. Expected delivery: 3-5 business days. You can pick it up at our clinic or we'll ship it to you."
    
    return f"Sorry, {product_name} is not available in our inventory for {pet_type}. Available products: {data['products']}"

def create_nutrition_agent():
    model = BedrockModel(
        model_id=BEDROCK_MODEL_ID,
        max_tokens=500,  # Limit response length
        temperature=0.1,  # More consistent, shorter responses
        stop_sequences=["Human:", "Assistant:", "\n\nHuman:", "\n\nAssistant:"]
    )

    tools = [get_feeding_guidelines, get_dietary_restrictions, get_nutritional_supplements, create_order]

    # Optimized system prompt - reduced by 40%
    system_prompt = (
        "You are a pet nutrition expert at our veterinary clinic. Provide concise, evidence-based dietary guidance. "
        "Always recommend SPECIFIC PRODUCT NAMES from our clinic (PurrfectChoice, BarkBite, FeatherFeast). "
        "Keep responses under 150 words. For orders, use create_order tool."
    )

    return Agent(model=model, tools=tools, system_prompt=system_prompt)
    

@agent_app.entrypoint
async def invoke(payload, context):
    """
    Invoke the nutrition agent with a payload
    """
    msg = payload.get('prompt', '')
    
    # Check cache first for common queries
    cached_response = get_cached_response(msg)
    if cached_response:
        return cached_response
    
    # Simple query routing - handle basic questions without Bedrock
    if any(word in msg.lower() for word in ['hours', 'contact', 'phone', 'address', 'location']):
        response = "Our clinic is open Mon-Fri 8AM-6PM, Sat 9AM-4PM. Call (555) 123-PETS for nutrition consultations."
        cache_response(msg, response)
        return response
    
    agent = create_nutrition_agent()
    response_data = []
    async for event in agent.stream_async(msg, context=context):
        if 'data' in event:
            response_data.append(event['data'])
    
    full_response = ''.join(response_data)
    
    # Truncate response if too long
    if len(full_response) > 800:
        full_response = full_response[:800] + "... For detailed guidance, visit our clinic."
    
    # Cache the response
    cache_response(msg, full_response)
    
    return full_response

if __name__ == "__main__":    
    uvicorn.run(agent_app, host='0.0.0.0', port=8080)