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

# Supported pet types by the nutrition service
SUPPORTED_PET_TYPES = {'cat', 'dog', 'lizard', 'snake', 'bird', 'hamster'}

agent = None
agent_app = BedrockAgentCoreApp()

def validate_pet_type(pet_type):
    """Validate if pet type is supported by the nutrition service"""
    return pet_type.lower() in SUPPORTED_PET_TYPES

def get_nutrition_data(pet_type):
    """Helper function to get nutrition data from the API"""
    if not NUTRITION_SERVICE_URL:
        return {"facts": "Error: Nutrition service not found", "products": ""}
    
    # Validate pet type before making API call
    if not validate_pet_type(pet_type):
        return {"facts": f"Pet type '{pet_type}' is not supported. We currently provide nutrition information for: {', '.join(sorted(SUPPORTED_PET_TYPES))}", "products": ""}
    
    try:
        response = requests.get(f"{NUTRITION_SERVICE_URL}/{pet_type.lower()}", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            return {"facts": data.get('facts', ''), "products": data.get('products', '')}
        elif response.status_code == 404:
            return {"facts": f"Pet type '{pet_type}' is not supported. We currently provide nutrition information for: {', '.join(sorted(SUPPORTED_PET_TYPES))}", "products": ""}
        else:
            return {"facts": f"Error: Unable to retrieve nutrition information (status: {response.status_code})", "products": ""}
    except requests.RequestException:
        return {"facts": "Error: Nutrition service down", "products": ""}

@tool
def get_feeding_guidelines(pet_type):
    """Get feeding guidelines based on pet type"""
    data = get_nutrition_data(pet_type)
    
    # Check if pet type is not supported
    if "not supported" in data['facts']:
        return data['facts']
    
    result = f"Nutrition info for {pet_type}: {data['facts']}"
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def get_dietary_restrictions(pet_type):
    """Get dietary recommendations for specific health conditions by animal type"""
    data = get_nutrition_data(pet_type)
    
    # Check if pet type is not supported
    if "not supported" in data['facts']:
        return data['facts']
    
    result = f"Dietary info for {pet_type}: {data['facts']}. Consult veterinarian for condition-specific advice."
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def get_nutritional_supplements(pet_type):
    """Get supplement recommendations by animal type"""
    data = get_nutrition_data(pet_type)
    
    # Check if pet type is not supported
    if "not supported" in data['facts']:
        return data['facts']
    
    result = f"Supplement info for {pet_type}: {data['facts']}. Consult veterinarian for supplements."
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def create_order(product_name, pet_type, quantity=1):
    """Create an order for a recommended product. Requires pet_type and quantity."""
    # Validate pet type before processing order
    if not validate_pet_type(pet_type):
        return f"Sorry, we don't carry products for {pet_type}. We currently provide nutrition products for: {', '.join(sorted(SUPPORTED_PET_TYPES))}"
    
    data = get_nutrition_data(pet_type)
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
        "- ONLY provide recommendations for pet types that are supported by our clinic\n"
        "- If a pet type is not supported, clearly state this and list the pet types we do support\n"
        "- DO NOT fabricate or hallucinate product recommendations for unsupported pet types\n"
        "- Use the specific nutrition information available to you as the foundation for your recommendations\n"
        "- Always recommend the SPECIFIC PRODUCT NAMES provided to you that pet owners should buy FROM OUR PET CLINIC\n"
        "- Mention our branded products by name (like PurrfectChoice, BarkBite, FeatherFeast, etc.) when recommending food\n"
        "- Emphasize that we carry high-quality, veterinarian-recommended food brands at our clinic\n"
        "- Give actionable dietary recommendations including feeding guidelines, restrictions, and supplements\n"
        "- Expand on basic nutrition facts with comprehensive guidance for age, weight, and health conditions\n"
        "- Always mention that pet owners can purchase the recommended food items directly from our clinic for convenience and quality assurance\n"
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
    async for event in agent.stream_async(msg):
        if 'data' in event:
            response_data.append(event['data'])
    
    return ''.join(response_data)

if __name__ == "__main__":    
    uvicorn.run(agent_app, host='0.0.0.0', port=8080)