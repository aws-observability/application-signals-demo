import boto3
import json

def execute_test(test_case):
    """Execute tag test"""
    resource_type = test_case.get('resource_type')
    resource_name = test_case.get('resource_name')
    
    session = boto3.Session()
    
    if resource_type == 'lambda':
        lambda_client = session.client('lambda')
        try:
            response = lambda_client.list_tags(Resource=f"arn:aws:lambda:{lambda_client.meta.region_name}:{boto3.client('sts').get_caller_identity()['Account']}:function:{resource_name}")
            return response.get('Tags', {})
        except Exception as e:
            print(f"Failed to get Lambda tags for {resource_name}: {str(e)}")
            return {}
    elif resource_type == 'apigateway':
        apigateway_client = session.client('apigateway')
        try:
            apis = apigateway_client.get_rest_apis()
            api_id = None
            for api in apis['items']:
                if api['name'] == resource_name:
                    api_id = api['id']
                    break
            if api_id:
                response = apigateway_client.get_tags(resourceArn=f"arn:aws:apigateway:{apigateway_client.meta.region_name}::/restapis/{api_id}")
                return response.get('tags', {})
        except Exception as e:
            print(f"Failed to get API Gateway tags for {resource_name}: {str(e)}")
    return {}

def validate_test(response, test_case):
    """Validate tag test result"""
    expected_tags = test_case.get('expected_tags', {})
    actual_tags = response
    
    all_passed = True
    for tag_key, expected_value in expected_tags.items():
        actual_value = actual_tags.get(tag_key)
        if actual_value != expected_value:
            all_passed = False
    
    return all_passed

def run_test(test_case):
    """Run single tag test case"""
    response = execute_test(test_case)
    return validate_test(response, test_case)