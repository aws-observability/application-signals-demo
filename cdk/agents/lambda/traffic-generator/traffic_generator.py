import json
import os
import random
from urllib.request import Request, urlopen

def load_prompts():
    with open('prompts.json', 'r') as f:
        return json.load(f)

def lambda_handler(event, context):
    """
    Traffic generator that invokes the Pet Clinic frontend agent endpoint with random queries.
    """
    
    pet_clinic_url = os.environ.get('PET_CLINIC_URL')
    num_requests = random.randint(1, 4)

    if not pet_clinic_url:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'PET_CLINIC_URL environment variable not set'})
        }
    
    prompts = load_prompts()
    results = []
    
    for _ in range(num_requests):
        is_nutrition_query = random.random() <= 0.95
        query = random.choice(prompts['nutrition-queries' if is_nutrition_query else 'non-nutrition-queries'])

        try:
            url = f"{pet_clinic_url.rstrip('/')}/api/agent/ask"
            payload = json.dumps({'query': query}).encode('utf-8')
            request = Request(url, data=payload, headers={'Content-Type': 'application/json'})
            
            with urlopen(request) as response:
                body = response.read().decode('utf-8')
            
            results.append({
                'query': query,
                'response': body
            })
            
        except Exception as error:
            results.append({
                'query': query,
                'error': str(error)
            })
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'total_requests': len(results),
            'results': results
        })
    }