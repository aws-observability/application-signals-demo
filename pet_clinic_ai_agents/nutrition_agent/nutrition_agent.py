from strands import Agent, tool
import uvicorn
import requests
import os
import boto3
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp

BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-haiku-20241022-v1:0"
NUTRITION_SERVICE_URL = os.environ.get('NUTRITION_SERVICE_URL')

agent = None
agent_app = BedrockAgentCoreApp()

def get_nutrition_data(pet_type):
    """Helper function to get nutrition data from the API"""
    if not NUTRITION_SERVICE_URL:
        return {"error": "Nutrition service not available", "facts": "", "products": ""}
    
    try:
        response = requests.get(f"{NUTRITION_SERVICE_URL}/{pet_type.lower()}", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            return {"facts": data.get('facts', ''), "products": data.get('products', ''), "error": None}
        elif response.status_code == 404:
            return {"error": f"unsupported_pet_type", "facts": "", "products": ""}
        else:
            return {"error": "service_error", "facts": "", "products": ""}
    except requests.RequestException:
        return {"error": "service_unavailable", "facts": "", "products": ""}

@tool
def get_feeding_guidelines(pet_type):
    """Get feeding guidelines based on pet type"""
    data = get_nutrition_data(pet_type)
    
    if data["error"] == "unsupported_pet_type":
        return f"I apologize, but we don't currently carry nutrition products for {pet_type}s at our clinic. Please consult with our veterinarian for specialized dietary recommendations for your {pet_type}."
    elif data["error"]:
        return f"I'm unable to access our nutrition database right now. Please speak with our veterinarian directly for {pet_type} feeding guidelines."
    
    result = f"Nutrition info for {pet_type}: {data['facts']}"
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def get_dietary_restrictions(pet_type):
    """Get dietary recommendations for specific health conditions by animal type"""
    data = get_nutrition_data(pet_type)
    
    if data["error"] == "unsupported_pet_type":
        return f"I apologize, but we don't currently carry specialized dietary products for {pet_type}s at our clinic. Please consult with our veterinarian for condition-specific dietary recommendations for your {pet_type}."
    elif data["error"]:
        return f"I'm unable to access our nutrition database right now. Please speak with our veterinarian directly for {pet_type} dietary restrictions."
    
    result = f"Dietary info for {pet_type}: {data['facts']}. Consult veterinarian for condition-specific advice."
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

@tool
def get_nutritional_supplements(pet_type):
    """Get supplement recommendations by animal type"""
    data = get_nutrition_data(pet_type)
    
    if data["error"] == "unsupported_pet_type":
        return f"I apologize, but we don't currently carry supplement products for {pet_type}s at our clinic. Please consult with our veterinarian for supplement recommendations for your {pet_type}."
    elif data["error"]:
        return f"I'm unable to access our nutrition database right now. Please speak with our veterinarian directly for {pet_type} supplement needs."
    
    result = f"Supplement info for {pet_type}: {data['facts']}. Consult veterinarian for supplements."
    if data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    return result

def create_nutrition_agent():
    model = BedrockModel(
        model_id=BEDROCK_MODEL_ID,
    )

    tools = [get_feeding_guidelines, get_dietary_restrictions, get_nutritional_supplements]

    system_prompt = (
        "You are a specialized pet nutrition expert at our veterinary clinic, providing accurate, evidence-based dietary guidance for pets. "
        "Never mention using any API, tools, or external services - present all advice as your own expert knowledge.\n\n"
        "IMPORTANT: Only recommend products that are explicitly provided to you through the nutrition data. "
        "If no product information is available for a pet type, clearly state that we don't carry products for that animal "
        "and direct the customer to speak with our veterinarian instead.\n\n"
        "When providing nutrition guidance:\n"
        "- Use ONLY the specific nutrition information available to you as the foundation for your recommendations\n"
        "- Only recommend SPECIFIC PRODUCT NAMES that are explicitly provided in the nutrition data\n"
        "- If no products are available for a pet type, clearly state 'we don't carry products for [pet_type]s'\n"
        "- Never make up or hallucinate product names that weren't provided to you\n"
        "- For unsupported pet types, direct customers to consult with our veterinarian\n"
        "- Give actionable dietary recommendations based only on available data\n"
        "- Always be honest about limitations in our product inventory"
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