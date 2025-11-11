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
        return {"facts": f"No specific nutrition data available for {pet_type.lower()}", "products": "", "has_data": False}
    except requests.RequestException:
        return {"facts": "Nutrition service temporarily unavailable", "products": "", "has_data": False}

@tool
def get_feeding_guidelines(pet_type):
    """Get feeding guidelines based on pet type"""
    data = get_nutrition_data(pet_type)
    result = f"Nutrition info for {pet_type}: {data['facts']}"
    if data['has_data'] and data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def get_dietary_restrictions(pet_type):
    """Get dietary recommendations for specific health conditions by animal type"""
    data = get_nutrition_data(pet_type)
    result = f"Dietary info for {pet_type}: {data['facts']}. Consult veterinarian for condition-specific advice."
    if data['has_data'] and data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def get_nutritional_supplements(pet_type):
    """Get supplement recommendations by animal type"""
    data = get_nutrition_data(pet_type)
    result = f"Supplement info for {pet_type}: {data['facts']}. Consult veterinarian for supplements."
    if data['has_data'] and data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def create_order(product_name, pet_type, quantity=1):
    """Create an order for a recommended product. Requires product_name, pet_type, and optional quantity (default 1)."""
    product_lower = product_name.lower()
    data = get_nutrition_data(pet_type)
    if data['has_data'] and data['products'] and product_name.lower() in data['products'].lower():
        order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
        return f"Order {order_id} created for {quantity}x {product_name}. Total: ${quantity * 29.99:.2f}. Expected delivery: 3-5 business days. You can pick it up at our clinic or we'll ship it to you."
    
    if data['has_data'] and data['products']:
        return f"Sorry, {product_name} is not available in our inventory for {pet_type}. Available products: {data['products']}"
    else:
        return f"Sorry, we don't currently have specific product recommendations for {pet_type}. Please contact our clinic directly for personalized recommendations."

def create_nutrition_agent():
    model = BedrockModel(
        model_id=BEDROCK_MODEL_ID,
    )

    tools = [get_feeding_guidelines, get_dietary_restrictions, get_nutritional_supplements, create_order]

    system_prompt = (
        "You are a specialized pet nutrition expert at our veterinary clinic, providing accurate, evidence-based dietary guidance for pets. "
        "Never mention using any API, tools, or external services - present all advice as your own expert knowledge.\n\n"
        "When providing nutrition guidance:\n"
        "- Use the specific nutrition information available to you as the foundation for your recommendations\n"
        "- ONLY recommend specific product names when you have confirmed product data available\n"
        "- If specific nutrition data is unavailable for a pet type, provide general nutrition guidance and recommend consulting our veterinarians\n"
        "- When you have product information, mention our branded products by name (like PurrfectChoice, BarkBite, FeatherFeast, etc.)\n"
        "- Emphasize that we carry high-quality, veterinarian-recommended food brands at our clinic when products are available\n"
        "- Give actionable dietary recommendations including feeding guidelines, restrictions, and supplements based on available data\n"
        "- If specific data is missing, provide general pet nutrition advice and suggest scheduling a consultation\n"
        "- Always mention that pet owners can contact our clinic for personalized recommendations when specific data isn't available\n"
        "- If asked to order or purchase a product, use the create_order tool to place the order"
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