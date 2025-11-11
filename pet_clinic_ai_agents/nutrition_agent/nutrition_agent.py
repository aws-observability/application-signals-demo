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
        return {"facts": "Information not available", "products": "", "available": False}
    
    try:
        response = requests.get(f"{NUTRITION_SERVICE_URL}/{pet_type.lower()}", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            return {"facts": data.get('facts', ''), "products": data.get('products', ''), "available": True}
        elif response.status_code == 404:
            return {"facts": "Information not available", "products": "", "available": False}
        else:
            return {"facts": "Information not available", "products": "", "available": False}
    except requests.RequestException:
        return {"facts": "Information not available", "products": "", "available": False}

@tool
def get_feeding_guidelines(pet_type):
    """Get feeding guidelines based on pet type"""
    data = get_nutrition_data(pet_type)
    if not data['available']:
        return f"Information not available for {pet_type}. Please consult with our veterinarian for specific feeding guidelines."
    
    result = f"Nutrition info for {pet_type}: {data['facts']}"
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def get_dietary_restrictions(pet_type):
    """Get dietary recommendations for specific health conditions by animal type"""
    data = get_nutrition_data(pet_type)
    if not data['available']:
        return f"Information not available for {pet_type}. Please consult with our veterinarian for specific dietary recommendations."
    
    result = f"Dietary info for {pet_type}: {data['facts']}. Consult veterinarian for condition-specific advice."
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def get_nutritional_supplements(pet_type):
    """Get supplement recommendations by animal type"""
    data = get_nutrition_data(pet_type)
    if not data['available']:
        return f"Information not available for {pet_type}. Please consult with our veterinarian for specific supplement recommendations."
    
    result = f"Supplement info for {pet_type}: {data['facts']}. Consult veterinarian for supplements."
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def create_order(product_name, pet_type, quantity=1):
    """Create an order for a recommended product. Requires product_name, pet_type, and optional quantity (default 1)."""
    data = get_nutrition_data(pet_type)
    if not data['available']:
        return f"Sorry, we don't have product information available for {pet_type}. Please visit our clinic or call us to discuss available products."
    
    if not data['products']:
        return f"Sorry, we don't currently have specific products available for {pet_type}. Please consult with our veterinarian for recommendations."
    
    product_lower = product_name.lower()
    if product_name.lower() in data['products'].lower():
        order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
        return f"Order {order_id} created for {quantity}x {product_name}. Total: ${quantity * 29.99:.2f}. Expected delivery: 3-5 business days. You can pick it up at our clinic or we'll ship it to you."
    
    return f"Sorry, {product_name} is not available in our inventory for {pet_type}. Available products: {data['products']}"

def create_nutrition_agent():
    model = BedrockModel(
        model_id=BEDROCK_MODEL_ID,
    )

    tools = [get_feeding_guidelines, get_dietary_restrictions, get_nutritional_supplements, create_order]

    system_prompt = (
        "You are a specialized pet nutrition expert at our veterinary clinic, providing accurate, evidence-based dietary guidance for pets. "
        "Never mention using any API, tools, or external services - present all advice as your own expert knowledge.\n\n"
        "IMPORTANT: Only provide information that is available in our database. If information is not available for a specific pet type, "
        "always respond with 'Information not available' and direct the customer to consult with our veterinarian. "
        "NEVER fabricate or make up product names, nutrition facts, or recommendations.\n\n"
        "When providing nutrition guidance:\n"
        "- Use ONLY the specific nutrition information available to you as the foundation for your recommendations\n"
        "- Only recommend SPECIFIC PRODUCT NAMES that are confirmed to be available in our inventory\n"
        "- If no products are available for a pet type, clearly state this and suggest consulting our veterinarian\n"
        "- Mention our branded products by name (like PurrfectChoice, BarkBite, FeatherFeast, etc.) ONLY when they are confirmed available\n"
        "- Emphasize that we carry high-quality, veterinarian-recommended food brands at our clinic ONLY for supported pet types\n"
        "- Give actionable dietary recommendations ONLY when information is available\n"
        "- If information is not available, direct customers to visit our clinic or consult with our veterinarian\n"
        "- If asked to order or purchase a product, use the create_order tool to place the order only if products are available"
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
    async for event in agent.stream_async(msg, context=context):
        if 'data' in event:
            response_data.append(event['data'])
    
    return ''.join(response_data)

if __name__ == "__main__":    
    uvicorn.run(agent_app, host='0.0.0.0', port=8080)