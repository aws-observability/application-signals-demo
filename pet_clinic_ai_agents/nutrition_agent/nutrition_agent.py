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

# Clinic's official product catalog - ONLY recommend these products
CLINIC_PRODUCT_CATALOG = {
    'cat': 'PurrfectChoice Premium Feline, WhiskerWell Grain-Free Delight, MeowMaster Senior Formula',
    'dog': 'BarkBite Complete Nutrition, TailWagger Performance Plus, PawsitiveCare Sensitive Blend',
    'lizard': 'ScaleStrong Calcium Boost, CricketCrunch Live Supply, ReptileVitality D3 Formula',
    'snake': 'SlitherSnack Frozen Mice, CoilCuisine Feeder Rats, SerpentSupreme Multivitamin',
    'bird': 'FeatherFeast Premium Pellets, WingWellness Seed Mix, BeakBoost Cuttlebone Calcium',
    'hamster': 'HamsterHaven Complete Pellets, CheekPouch Gourmet Mix, WhiskerWonder Vitamin Drops',
    # Add missing pet types with appropriate products
    'rabbit': 'BunnyBest Timothy Pellets, HopHappy Hay Mix, CarrotCrunch Vitamin Treats',
    'fish': 'AquaChoice Premium Flakes, FinFeast Tropical Blend, BubbleBite Goldfish Formula',
    'ferret': 'FerretFuel High-Protein Kibble, MustelaMunch Complete Diet, PlayfulPaws Treats',
    'guinea pig': 'CavyCare Complete Pellets, PiggyPerfect Vitamin C Boost, WheekyWell Timothy Hay'
}

def get_nutrition_data(pet_type):
    """Helper function to get nutrition data from the API with comprehensive error handling"""
    if not NUTRITION_SERVICE_URL:
        # If no nutrition service, use our clinic catalog
        normalized_type = pet_type.lower().strip()
        if normalized_type in CLINIC_PRODUCT_CATALOG:
            return {
                "facts": f"High-quality nutrition for {pet_type}s with balanced nutrients and vitamins", 
                "products": CLINIC_PRODUCT_CATALOG[normalized_type]
            }
        else:
            return {
                "facts": f"General nutrition guidance for {pet_type}s - consult our veterinarian for specific recommendations", 
                "products": "Please visit our clinic for personalized product recommendations"
            }
    
    try:
        # Normalize pet type for API call
        normalized_type = pet_type.lower().strip()
        response = requests.get(f"{NUTRITION_SERVICE_URL}/{normalized_type}", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            # Validate that we only recommend products from our catalog
            api_products = data.get('products', '')
            if normalized_type in CLINIC_PRODUCT_CATALOG:
                # Use our verified catalog products
                verified_products = CLINIC_PRODUCT_CATALOG[normalized_type]
            else:
                # For unsupported types, don't recommend specific products
                verified_products = "Please visit our clinic for personalized product recommendations"
            
            return {
                "facts": data.get('facts', f'Nutrition information for {pet_type}s'), 
                "products": verified_products
            }
        elif response.status_code == 404:
            # Pet type not found in database - use our catalog if available
            if normalized_type in CLINIC_PRODUCT_CATALOG:
                return {
                    "facts": f"High-quality nutrition for {pet_type}s with balanced nutrients and vitamins", 
                    "products": CLINIC_PRODUCT_CATALOG[normalized_type]
                }
            else:
                return {
                    "facts": f"We can provide general nutrition guidance for {pet_type}s. Please consult our veterinarian for specific dietary recommendations.", 
                    "products": "Please visit our clinic for personalized product recommendations for this pet type"
                }
        else:
            # Other API errors - fallback to catalog
            normalized_type = pet_type.lower().strip()
            if normalized_type in CLINIC_PRODUCT_CATALOG:
                return {
                    "facts": f"High-quality nutrition for {pet_type}s with balanced nutrients and vitamins", 
                    "products": CLINIC_PRODUCT_CATALOG[normalized_type]
                }
            else:
                return {
                    "facts": f"Nutrition service temporarily unavailable for {pet_type}s", 
                    "products": "Please visit our clinic for personalized product recommendations"
                }
    except requests.RequestException:
        # Network/connection errors - fallback to catalog
        normalized_type = pet_type.lower().strip()
        if normalized_type in CLINIC_PRODUCT_CATALOG:
            return {
                "facts": f"High-quality nutrition for {pet_type}s with balanced nutrients and vitamins", 
                "products": CLINIC_PRODUCT_CATALOG[normalized_type]
            }
        else:
            return {
                "facts": f"Unable to connect to nutrition service for {pet_type}s", 
                "products": "Please visit our clinic for personalized product recommendations"
            }

@tool
def get_feeding_guidelines(pet_type):
    """Get feeding guidelines based on pet type"""
    data = get_nutrition_data(pet_type)
    result = f"Nutrition info for {pet_type}: {data['facts']}"
    if data['products'] and "visit our clinic" not in data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    else:
        result += f" {data['products']}"
    return result

@tool
def get_dietary_restrictions(pet_type):
    """Get dietary recommendations for specific health conditions by animal type"""
    data = get_nutrition_data(pet_type)
    result = f"Dietary info for {pet_type}: {data['facts']}. Consult veterinarian for condition-specific advice."
    if data['products'] and "visit our clinic" not in data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    else:
        result += f" {data['products']}"
    return result

@tool
def get_nutritional_supplements(pet_type):
    """Get supplement recommendations by animal type"""
    data = get_nutrition_data(pet_type)
    result = f"Supplement info for {pet_type}: {data['facts']}. Consult veterinarian for supplements."
    if data['products'] and "visit our clinic" not in data['products']:
        result += f" Recommended products available at our clinic: {data['products']}"
    else:
        result += f" {data['products']}"
    return result

def create_nutrition_agent():
    model = BedrockModel(
        model_id=BEDROCK_MODEL_ID,
    )

    tools = [get_feeding_guidelines, get_dietary_restrictions, get_nutritional_supplements]

    system_prompt = (
        "You are a specialized pet nutrition expert at our veterinary clinic, providing accurate, evidence-based dietary guidance for pets. "
        "Never mention using any API, tools, or external services - present all advice as your own expert knowledge.\n\n"
        "CRITICAL PRODUCT RECOMMENDATION RULES:\n"
        "- ONLY recommend products that are explicitly provided to you through the nutrition tools\n"
        "- NEVER recommend products from your general knowledge or training data\n"
        "- If no specific products are provided, direct customers to visit our clinic for personalized recommendations\n"
        "- Our clinic carries these exclusive brands: PurrfectChoice, WhiskerWell, MeowMaster, BarkBite, TailWagger, PawsitiveCare, ScaleStrong, CricketCrunch, ReptileVitality, SlitherSnack, CoilCuisine, SerpentSupreme, FeatherFeast, WingWellness, BeakBoost, HamsterHaven, CheekPouch, WhiskerWonder, BunnyBest, HopHappy, CarrotCrunch, AquaChoice, FinFeast, BubbleBite, FerretFuel, MustelaMunch, PlayfulPaws, CavyCare, PiggyPerfect, WheekyWell\n\n"
        "When providing nutrition guidance:\n"
        "- Use the specific nutrition information available to you as the foundation for your recommendations\n"
        "- Always recommend the SPECIFIC PRODUCT NAMES provided to you that pet owners should buy FROM OUR PET CLINIC\n"
        "- Mention our branded products by name when recommending food\n"
        "- Emphasize that we carry high-quality, veterinarian-recommended food brands at our clinic\n"
        "- Give actionable dietary recommendations including feeding guidelines, restrictions, and supplements\n"
        "- Expand on basic nutrition facts with comprehensive guidance for age, weight, and health conditions\n"
        "- Always mention that pet owners can purchase the recommended food items directly from our clinic for convenience and quality assurance\n"
        "- If you don't have specific product information for a pet type, recommend visiting our clinic for personalized consultation rather than suggesting generic products"
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