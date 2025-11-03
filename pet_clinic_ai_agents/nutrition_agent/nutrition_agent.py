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
        return {"facts": "Error: Nutrition service not found", "products": "", "error": True}
    
    try:
        response = requests.get(f"{NUTRITION_SERVICE_URL}/{pet_type.lower()}", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            return {"facts": data.get('facts', ''), "products": data.get('products', ''), "error": False}
        elif response.status_code == 404:
            return {
                "facts": f"We don't currently have specific nutrition information for {pet_type} in our database.", 
                "products": "", 
                "error": True,
                "not_found": True
            }
        else:
            return {"facts": f"Error: Nutrition service returned status {response.status_code}", "products": "", "error": True}
    except requests.RequestException as e:
        return {"facts": f"Error: Unable to connect to nutrition service - {str(e)}", "products": "", "error": True}

@tool
def get_feeding_guidelines(pet_type):
    """Get feeding guidelines based on pet type"""
    data = get_nutrition_data(pet_type)
    
    if data.get("error"):
        if data.get("not_found"):
            return (f"I apologize, but we don't currently have specific feeding guidelines for {pet_type} "
                   f"in our system. Please contact our veterinary clinic directly at (555) 123-4567 to speak "
                   f"with one of our veterinarians who can provide personalized nutrition advice for your {pet_type}. "
                   f"Our experienced staff can recommend appropriate foods and feeding schedules based on your pet's "
                   f"specific needs, age, and health condition.")
        else:
            return f"I'm unable to retrieve feeding guidelines at the moment: {data['facts']}. Please contact our clinic for assistance."
    
    result = f"Nutrition info for {pet_type}: {data['facts']}"
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def get_dietary_restrictions(pet_type):
    """Get dietary recommendations for specific health conditions by animal type"""
    data = get_nutrition_data(pet_type)
    
    if data.get("error"):
        if data.get("not_found"):
            return (f"I don't have specific dietary restriction information for {pet_type} in our database. "
                   f"For specialized dietary advice regarding health conditions, please schedule a consultation "
                   f"with our veterinarians at (555) 123-4567. They can provide tailored recommendations based "
                   f"on your {pet_type}'s specific health needs and medical history.")
        else:
            return f"I'm unable to retrieve dietary information at the moment: {data['facts']}. Please contact our clinic for assistance."
    
    result = f"Dietary info for {pet_type}: {data['facts']}. Consult veterinarian for condition-specific advice."
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def get_nutritional_supplements(pet_type):
    """Get supplement recommendations by animal type"""
    data = get_nutrition_data(pet_type)
    
    if data.get("error"):
        if data.get("not_found"):
            return (f"I don't have specific supplement information for {pet_type} in our current database. "
                   f"For supplement recommendations, please contact our veterinary clinic at (555) 123-4567. "
                   f"Our veterinarians can assess your {pet_type}'s individual needs and recommend appropriate "
                   f"supplements based on age, health status, and dietary requirements.")
        else:
            return f"I'm unable to retrieve supplement information at the moment: {data['facts']}. Please contact our clinic for assistance."
    
    result = f"Supplement info for {pet_type}: {data['facts']}. Consult veterinarian for supplements."
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def create_order(product_name, pet_type, quantity=1):
    """Create an order for a recommended product. Requires pet_type and quantity."""
    data = get_nutrition_data(pet_type)
    
    if data.get("error"):
        if data.get("not_found"):
            return (f"I'm unable to process orders for {pet_type} products as we don't have them in our current "
                   f"inventory system. Please call our clinic at (555) 123-4567 to speak with our staff about "
                   f"special ordering options or alternative products that may be suitable for your {pet_type}.")
        else:
            return f"I'm unable to process the order at the moment: {data['facts']}. Please contact our clinic for assistance."
    
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
        "IMPORTANT: Only provide specific product recommendations when you have verified product information available. "
        "If you don't have specific information for a pet type, always direct customers to contact the clinic directly "
        "rather than making up or guessing product names or nutritional advice.\n\n"
        "When providing nutrition guidance:\n"
        "- Use the specific nutrition information available to you as the foundation for your recommendations\n"
        "- Only recommend SPECIFIC PRODUCT NAMES when you have verified product data from our inventory\n"
        "- For pet types where you lack specific information, direct customers to call our clinic at (555) 123-4567\n"
        "- Mention our branded products by name (like PurrfectChoice, BarkBite, FeatherFeast, etc.) ONLY when you have confirmed product data\n"
        "- Emphasize that we carry high-quality, veterinarian-recommended food brands at our clinic for supported pet types\n"
        "- Give actionable dietary recommendations including feeding guidelines, restrictions, and supplements when data is available\n"
        "- For unsupported pet types, acknowledge the limitation and provide helpful contact information\n"
        "- Never fabricate or guess product names, prices, or nutritional information\n"
        "- If asked to order or purchase a product, use the create_order tool to place the order only when product data is available"
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