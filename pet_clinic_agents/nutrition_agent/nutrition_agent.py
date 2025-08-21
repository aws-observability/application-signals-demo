import os
from strands import Agent, tool
import uvicorn
import yaml
import random
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp

BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-haiku-20241022-v1:0"

# Exceptions
class TimeoutException(Exception):
    def __init__(self, message, **kwargs):
        super().__init__(message)
        self.details = kwargs

class ValidationException(Exception):
    def __init__(self, message, **kwargs):
        super().__init__(message)
        self.details = kwargs

class ServiceException(Exception):
    def __init__(self, message, **kwargs):
        super().__init__(message)
        self.details = kwargs

class RateLimitException(Exception):
    def __init__(self, message, **kwargs):
        super().__init__(message)
        self.details = kwargs

class NetworkException(Exception):
    def __init__(self, message, **kwargs):
        super().__init__(message)
        self.details = kwargs

try:
    with open('nutrition.yaml', 'r') as f:
        NUTRITION_DATA = yaml.safe_load(f)
except Exception:
    NUTRITION_DATA = None

agent = None
agent_app = BedrockAgentCoreApp()

@tool
def get_feeding_guidelines(pet_type, age, weight):
    """Get feeding guidelines based on pet type, age, and weight"""
    if NUTRITION_DATA is None:
        return "Pet nutrition database is down, please consult your veterinarian for feeding guidelines."
    
    animal = NUTRITION_DATA.get(pet_type.lower() + 's')
    if not animal:
        return "Consult veterinarian for specific feeding guidelines"
    
    calories_per_lb = animal.get('calories_per_pound', '15-20')
    schedule = animal.get('feeding_schedule', {}).get(age.lower(), '2 times daily')
    
    if isinstance(calories_per_lb, str) and '-' in calories_per_lb:
        calories = weight * float(calories_per_lb.split('-')[0])
    else:
        calories = weight * float(calories_per_lb)
    
    return f"Feed approximately {calories:.0f} calories daily, {schedule}"

@tool
def get_dietary_restrictions(pet_type, condition):
    """Get dietary recommendations for specific health conditions by animal type"""
    if NUTRITION_DATA is None:
        return "Pet nutrition database is down, please consult your veterinarian for dietary advice."
    
    animal = NUTRITION_DATA.get(pet_type.lower() + 's')
    if not animal:
        return "Consult veterinarian for condition-specific dietary advice"
    
    restrictions = animal.get('dietary_restrictions', {})
    return restrictions.get(condition.lower(), "Consult veterinarian for condition-specific dietary advice")

@tool
def get_nutritional_supplements(pet_type, supplement):
    """Get supplement recommendations by animal type"""
    if NUTRITION_DATA is None:
        return "Pet nutrition database is down, please consult your veterinarian before adding supplements."
    
    animal = NUTRITION_DATA.get(pet_type.lower() + 's')
    if not animal:
        return "Consult veterinarian before adding supplements"
    
    supplements = animal.get('supplements', {})
    return supplements.get(supplement.lower(), "Consult veterinarian before adding supplements")

def create_nutrition_agent():
    model = BedrockModel(
        model_id=BEDROCK_MODEL_ID,
    )

    tools = [get_feeding_guidelines, get_dietary_restrictions, get_nutritional_supplements]

    system_prompt = (
        "You are a specialized pet nutrition expert providing evidence-based dietary guidance.\n\n"
        "Your expertise covers:\n"
        "- Feeding guidelines for dogs, cats, fish, horses, birds, rabbits, ferrets, hamsters, guinea pigs, reptiles, and amphibians\n"
        "- Therapeutic diets for health conditions (diabetes, kidney disease, allergies, obesity, arthritis)\n"
        "- Food safety and toxic substances to avoid\n"
        "- Nutritional supplements and their proper use\n"
        "- Food label interpretation and AAFCO standards\n\n"
        "Key principles:\n"
        "- Cats are obligate carnivores requiring animal-based nutrients\n"
        "- Dogs are omnivores needing balanced animal and plant sources\n"
        "- Always recommend veterinary consultation for significant dietary changes\n"
        "- Provide specific, actionable advice when possible\n\n"
        "Toxic foods to avoid: garlic, onions, chocolate, grapes, xylitol, alcohol, macadamia nuts"
    )

    return Agent(model=model, tools=tools, system_prompt=system_prompt)

@agent_app.entrypoint
async def invoke(payload, context):
    """
    Invoke the nutrition agent with a payload
    """
    
    # Randomly fail 2% of requests
    if random.random() < 0.02:
        error_types = [
            (TimeoutException, "Nutrition advice generation timed out", {"timeout_seconds": 30.0, "operation": "nutrition_advice_generation"}),
            (ValidationException, "Invalid nutrition query format", {"field": "nutrition_query", "value": "simulated_invalid_input"}),
            (ServiceException, "Nutrition service internal error", {"service_name": "nutrition-agent", "error_code": "INTERNAL_ERROR", "retryable": True}),
            (RateLimitException, "Too many nutrition requests", {"retry_after_seconds": random.randint(30, 120), "limit_type": "requests_per_minute"}),
            (NetworkException, "Network error connecting to nutrition service", {"endpoint": "nutrition-service", "error_code": "CONNECTION_FAILED", "retryable": True})
        ]
        
        exception_class, message, kwargs = random.choice(error_types)
        raise exception_class(message, **kwargs)
    
    agent = create_nutrition_agent()
    msg = payload.get('prompt', '')

    async for event in agent.stream_async(msg):
        if 'data' in event:
            yield event['data']

if __name__ == "__main__":    
    uvicorn.run(agent_app, host='0.0.0.0', port=8080)