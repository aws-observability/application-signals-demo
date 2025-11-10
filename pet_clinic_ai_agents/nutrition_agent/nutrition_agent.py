from strands import Agent, tool
import uvicorn
import requests
import os
import boto3
import uuid
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp

BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-haiku-20241022-v1:0"
NUTRITION_SERVICE_URL = os.environ.get('NUTRITION_SERVICE_URL')

agent = None
agent_app = BedrockAgentCoreApp()

def get_nutrition_data(pet_type):
    """Helper function to get nutrition data from the API"""
    if not NUTRITION_SERVICE_URL:
        return {"facts": "Error: Nutrition service not found", "products": "", "has_data": False}
    
    try:
        response = requests.get(f"{NUTRITION_SERVICE_URL}/{pet_type.lower()}", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            return {"facts": data.get('facts', ''), "products": data.get('products', ''), "has_data": True}
        elif response.status_code == 404:
            return {"facts": f"We don't currently have nutrition information for {pet_type} in our database", "products": "", "has_data": False}
        return {"facts": f"Error: Nutrition service could not find information for pet: {pet_type.lower()}", "products": "", "has_data": False}
    except requests.RequestException:
        return {"facts": "Error: Nutrition service down", "products": "", "has_data": False}

@tool
def get_feeding_guidelines(pet_type):
    """Get feeding guidelines based on pet type"""
    data = get_nutrition_data(pet_type)
    if not data['has_data']:
        return data['facts']
    
    result = f"Nutrition info for {pet_type}: {data['facts']}"
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def get_dietary_restrictions(pet_type):
    """Get dietary recommendations for specific health conditions by animal type"""
    data = get_nutrition_data(pet_type)
    if not data['has_data']:
        return data['facts']
    
    result = f"Dietary info for {pet_type}: {data['facts']}. Consult veterinarian for condition-specific advice."
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def get_nutritional_supplements(pet_type):
    """Get supplement recommendations by animal type"""
    data = get_nutrition_data(pet_type)
    if not data['has_data']:
        return data['facts']
    
    result = f"Supplement info for {pet_type}: {data['facts']}. Consult veterinarian for supplements."
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def create_order(product_name, pet_type, quantity=1):
    """Create an order for a recommended product. Requires pet_type and quantity."""
    data = get_nutrition_data(pet_type)
    if not data['has_data']:
        return f"Sorry, we don't currently have nutrition information for {pet_type} in our database, so we cannot process orders for this pet type."
    
    if data['products'] and product_name.lower() in data['products'].lower():
        order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
        return f"Order {order_id} created for {quantity}x {product_name}. Total: ${quantity * 29.99:.2f}. Expected delivery: 3-5 business days."
    return f"Sorry, can't make the order. {product_name} is not available in our inventory for {pet_type}."

def create_nutrition_agent():
    model = BedrockModel(
        model_id=BEDROCK_MODEL_ID,
    )

    tools = [get_feeding_guidelines, get_dietary_restrictions, get_nutritional_supplements, create_order]

    system_prompt = (
        "You are a specialized pet nutrition expert at our veterinary clinic, providing accurate, evidence-based dietary guidance for pets. "
        "Never mention using any API, tools, or external services - present all advice as your own expert knowledge.\n\n"
        "When providing nutrition guidance:\n"
        "- ONLY provide recommendations when you have specific nutrition information available for the requested pet type\n"
        "- If you don't have nutrition information for a specific pet type, clearly state that we don't currently have that information in our database\n"
        "- NEVER fabricate or hallucinate product names, nutrition facts, or recommendations when data is not available\n"
        "- When you DO have nutrition information available, use it as the foundation for your recommendations\n"
        "- Only recommend SPECIFIC PRODUCT NAMES that are actually provided to you in the nutrition data\n"
        "- Mention our branded products by name (like PurrfectChoice, BarkBite, FeatherFeast, etc.) ONLY when they are available in our database\n"
        "- Emphasize that we carry high-quality, veterinarian-recommended food brands at our clinic ONLY for pets we have data for\n"
        "- Give actionable dietary recommendations including feeding guidelines, restrictions, and supplements ONLY when data is available\n"
        "- Expand on basic nutrition facts with comprehensive guidance for age, weight, and health conditions ONLY when you have the underlying data\n"
        "- Always mention that pet owners can purchase the recommended food items directly from our clinic for convenience and quality assurance ONLY when products are available\n"
        "- If asked to order or purchase a product for a pet type we don't have data for, politely decline and explain we don't have information for that pet type\n"
        "- For unsupported pet types, suggest contacting our clinic directly for personalized consultation"
    )

    return Agent(model=model, tools=tools, system_prompt=system_prompt)
    

@agent_app.entrypoint
async def invoke(payload, context):
    """
    Invoke the nutrition agent with a payload
    """
    agent = create_nutrition_agent()
    msg = payload.get('prompt', '')

    response_data = []
    async for event in agent.stream_async(msg):
        if 'data' in event:
            response_data.append(event['data'])
    
    return ''.join(response_data)

if __name__ == "__main__":    
    uvicorn.run(agent_app, host='0.0.0.0', port=8080)