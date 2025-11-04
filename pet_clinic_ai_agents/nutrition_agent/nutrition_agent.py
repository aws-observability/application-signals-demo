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
        return {"error": True, "facts": "Nutrition service not available", "products": ""}
    
    try:
        response = requests.get(f"{NUTRITION_SERVICE_URL}/{pet_type.lower()}", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            return {"error": False, "facts": data.get('facts', ''), "products": data.get('products', '')}
        elif response.status_code == 404:
            return {"error": True, "facts": f"We don't currently have nutrition data for {pet_type} in our system", "products": ""}
        else:
            return {"error": True, "facts": "Nutrition service temporarily unavailable", "products": ""}
    except requests.RequestException:
        return {"error": True, "facts": "Nutrition service temporarily unavailable", "products": ""}

@tool
def get_feeding_guidelines(pet_type):
    """Get feeding guidelines based on pet type"""
    data = get_nutrition_data(pet_type)
    if data["error"]:
        return f"I apologize, but {data['facts']}. Please consult with our veterinarians for guidance on {pet_type} nutrition."
    
    result = f"Nutrition info for {pet_type}: {data['facts']}"
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def get_dietary_restrictions(pet_type):
    """Get dietary recommendations for specific health conditions by animal type"""
    data = get_nutrition_data(pet_type)
    if data["error"]:
        return f"I apologize, but {data['facts']}. Please consult with our veterinarians for guidance on {pet_type} dietary restrictions."
    
    result = f"Dietary info for {pet_type}: {data['facts']}. Consult veterinarian for condition-specific advice."
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def get_nutritional_supplements(pet_type):
    """Get supplement recommendations by animal type"""
    data = get_nutrition_data(pet_type)
    if data["error"]:
        return f"I apologize, but {data['facts']}. Please consult with our veterinarians for guidance on {pet_type} supplements."
    
    result = f"Supplement info for {pet_type}: {data['facts']}. Consult veterinarian for supplements."
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def create_order(product_name, pet_type, quantity=1):
    """Create an order for a recommended product. Requires pet_type and quantity."""
    data = get_nutrition_data(pet_type)
    if data["error"]:
        return f"I cannot create an order as {data['facts']}. Please speak with our staff about available options for {pet_type}."
    
    if data['products'] and product_name.lower() in data['products'].lower():
        order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
        return f"Order {order_id} created for {quantity}x {product_name}. Total: ${quantity * 29.99:.2f}. Expected delivery: 3-5 business days."
    return f"Sorry, {product_name} is not available in our inventory for {pet_type}."

def create_nutrition_agent():
    model = BedrockModel(
        model_id=BEDROCK_MODEL_ID,
    )

    tools = [get_feeding_guidelines, get_dietary_restrictions, get_nutritional_supplements, create_order]

    system_prompt = (
        "You are a specialized pet nutrition expert at our veterinary clinic. You provide accurate, evidence-based dietary guidance ONLY for pets in our nutrition database. "
        "Never mention using any API, tools, or external services - present all advice as your own expert knowledge.\n\n"
        "CRITICAL: You can ONLY provide nutrition advice for pets that have data in our system. If our nutrition service doesn't have information for a specific pet type, you MUST:\n"
        "- Acknowledge that we don't currently have nutrition data for that pet\n"
        "- Recommend consulting with our veterinarians for guidance\n"
        "- NEVER provide generic advice or recommendations from your training data\n"
        "- NEVER recommend products that aren't in our verified inventory\n\n"
        "For supported pets with available data:\n"
        "- Use the specific nutrition information as the foundation for recommendations\n"
        "- Recommend ONLY the specific product names provided in our inventory\n"
        "- Mention our branded products by name when recommending food\n"
        "- Emphasize purchasing from our clinic for quality assurance\n"
        "- Give actionable dietary recommendations including feeding guidelines and supplements\n"
        "- If asked to order a product, use the create_order tool\n\n"
        "Remember: Accuracy over helpfulness. Only provide advice when you have verified data from our nutrition service."
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