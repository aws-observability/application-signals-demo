from strands import Agent, tool
import uvicorn
import requests
import os
import boto3
import uuid
import time
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp

BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-haiku-20241022-v1:0"
NUTRITION_SERVICE_URL = os.environ.get('NUTRITION_SERVICE_URL')

# Circuit breaker configuration
CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5
CIRCUIT_BREAKER_TIMEOUT = 60  # seconds
circuit_breaker_state = {
    'failures': 0,
    'last_failure_time': 0,
    'state': 'CLOSED'  # CLOSED, OPEN, HALF_OPEN
}

agent = None
agent_app = BedrockAgentCoreApp()

def circuit_breaker_check():
    """Check circuit breaker state before making API calls"""
    current_time = time.time()
    
    if circuit_breaker_state['state'] == 'OPEN':
        if current_time - circuit_breaker_state['last_failure_time'] > CIRCUIT_BREAKER_TIMEOUT:
            circuit_breaker_state['state'] = 'HALF_OPEN'
            return True
        return False
    
    return True

def circuit_breaker_success():
    """Reset circuit breaker on successful API call"""
    circuit_breaker_state['failures'] = 0
    circuit_breaker_state['state'] = 'CLOSED'

def circuit_breaker_failure():
    """Handle circuit breaker failure"""
    circuit_breaker_state['failures'] += 1
    circuit_breaker_state['last_failure_time'] = time.time()
    
    if circuit_breaker_state['failures'] >= CIRCUIT_BREAKER_FAILURE_THRESHOLD:
        circuit_breaker_state['state'] = 'OPEN'

def get_fallback_nutrition_data(pet_type):
    """Safe fallback responses for when API is unavailable"""
    fallback_data = {
        'dog': {
            'facts': 'Dogs require balanced nutrition with high-quality protein, healthy fats, and essential vitamins. Feed adult dogs twice daily.',
            'products': 'Please visit our clinic for current product availability and personalized recommendations.'
        },
        'cat': {
            'facts': 'Cats are obligate carnivores requiring high protein diets with taurine and arachidonic acid. Feed adult cats 2-3 times daily.',
            'products': 'Please visit our clinic for current product availability and personalized recommendations.'
        },
        'bird': {
            'facts': 'Birds need species-specific diets with seeds, pellets, and fresh fruits/vegetables. Avoid chocolate and avocado.',
            'products': 'Please visit our clinic for current product availability and personalized recommendations.'
        }
    }
    
    return fallback_data.get(pet_type.lower(), {
        'facts': f'For {pet_type} nutrition, consult with our veterinary team for species-specific dietary requirements.',
        'products': 'Please visit our clinic for current product availability and personalized recommendations.'
    })

def get_nutrition_data(pet_type):
    """Helper function to get nutrition data from the API with circuit breaker"""
    if not NUTRITION_SERVICE_URL:
        return get_fallback_nutrition_data(pet_type)
    
    if not circuit_breaker_check():
        return get_fallback_nutrition_data(pet_type)
    
    try:
        response = requests.get(f"{NUTRITION_SERVICE_URL}/{pet_type.lower()}", timeout=5)
        
        if response.status_code == 200:
            circuit_breaker_success()
            data = response.json()
            return {"facts": data.get('facts', ''), "products": data.get('products', '')}
        else:
            circuit_breaker_failure()
            return get_fallback_nutrition_data(pet_type)
            
    except requests.RequestException:
        circuit_breaker_failure()
        return get_fallback_nutrition_data(pet_type)

@tool
def get_feeding_guidelines(pet_type):
    """Get feeding guidelines based on pet type"""
    data = get_nutrition_data(pet_type)
    result = f"Nutrition info for {pet_type}: {data['facts']}"
    if data['products']:
        result += f" Recommended products: {data['products']}"
    return result

@tool
def get_dietary_restrictions(pet_type):
    """Get dietary recommendations for specific health conditions by animal type"""
    data = get_nutrition_data(pet_type)
    result = f"Dietary info for {pet_type}: {data['facts']}. Consult veterinarian for condition-specific advice."
    if data['products']:
        result += f" Recommended products: {data['products']}"
    return result

@tool
def get_nutritional_supplements(pet_type):
    """Get supplement recommendations by animal type"""
    data = get_nutrition_data(pet_type)
    result = f"Supplement info for {pet_type}: {data['facts']}. Consult veterinarian for supplements."
    if data['products']:
        result += f" Recommended products: {data['products']}"
    return result

@tool
def create_order(product_name, pet_type, quantity=1):
    """Create an order for a recommended product. Requires product_name, pet_type, and optional quantity (default 1)."""
    # For orders, always direct to clinic due to potential API issues
    return f"To ensure product availability and proper guidance, please visit our clinic or call us to place an order for {product_name}. Our staff will verify current inventory and provide personalized recommendations for your {pet_type}."

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
        "- Always recommend visiting our clinic for current product availability and personalized recommendations\n"
        "- Give actionable dietary recommendations including feeding guidelines, restrictions, and supplements\n"
        "- Expand on basic nutrition facts with comprehensive guidance for age, weight, and health conditions\n"
        "- Emphasize that our veterinary team can provide the most accurate, up-to-date product recommendations\n"
        "- If systems are temporarily unavailable, provide general nutrition guidance and direct clients to visit the clinic\n"
        "- Always prioritize pet safety by recommending professional consultation for specific products"
    )

    return Agent(model=model, tools=tools, system_prompt=system_prompt)
    

@agent_app.entrypoint
async def invoke(payload, context):
    """
    Invoke the nutrition agent with a payload
    """
    try:
        agent = create_nutrition_agent()
        msg = payload.get('prompt', '')

        response_data = []
        async for event in agent.stream_async(msg, context=context):
            if 'data' in event:
                response_data.append(event['data'])
        
        return ''.join(response_data)
    except Exception as e:
        # Safe fallback response for any agent failures
        return "I'm currently experiencing technical difficulties. Please visit our clinic or call us directly for personalized pet nutrition guidance from our veterinary team."

if __name__ == "__main__":    
    uvicorn.run(agent_app, host='0.0.0.0', port=8080)