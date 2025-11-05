import json
import boto3
import zipfile
import io

lambda_client = boto3.client('lambda')
sts_client = boto3.client('sts')

def create_sample_lambda_code():
    """
    Creates a sample Lambda function code which simulates failure as a ZIP file in memory.
    """
    sample_code = '''import json

def lambda_handler(event, context):
    """
    Sample Lambda function deployed via UpdateFunctionCode.
    This function echoes back the input and adds a timestamp.
    """
    import datetime
    raise Exception("Simulating the Change Events")
    return {
        'statusCode': 500,
        'body': json.dumps({
            'message': 'Hello from updated Lambda function!',
            'input_received': event,
            'timestamp': datetime.datetime.now().isoformat(),
            'deployed_by': 'Lambda updater function'
        })
    }
'''
    
    # Create ZIP file in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr('lambda_function.py', sample_code)
    
    zip_buffer.seek(0)
    return zip_buffer.read()


def lambda_handler(event, context):
    try:
        target_function = 'audit-service'
        simulate_deployment_with_error_and_fix = True
        
        if not target_function:
            return {
                'statusCode': 400,
                'body': json.dumps('target_function_name is required')
            }
        
        if simulate_deployment_with_error_and_fix:
            zip_bytes = create_sample_lambda_code()
            
            # Update the target Lambda function
            response = lambda_client.update_function_code(
                FunctionName=target_function,
                ZipFile=zip_bytes,
                Publish=False  # Publishes a new version
            )
            import time 
            time.sleep(120)
            account_id = sts_client.get_caller_identity()['Account']
            region = boto3.Session().region_name
            response = lambda_client.update_function_code(
                FunctionName=target_function,
                S3Bucket=f"audit-service-functions-{account_id}-{region}",
                S3Key='lambda-functions/good_function.zip',
            )
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Function code updated successfully with sample code',
                    'function_name': response['FunctionName'],
                    'function_arn': response['FunctionArn'],
                    'version': response['Version'],
                    'last_modified': response['LastModified'],
                    'runtime': response['Runtime'],
                    'code_size': response['CodeSize']
                })
            }
        else:
            return {
                'statusCode': 400,
                'body': json.dumps('No code provided to update')
            }
        
    except lambda_client.exceptions.ResourceNotFoundException:
        return {
            'statusCode': 404,
            'body': json.dumps(f'Function {target_function} not found')
        }
    
    except lambda_client.exceptions.InvalidParameterValueException as e:
        return {
            'statusCode': 400,
            'body': json.dumps(f'Invalid parameter: {str(e)}')
        }
        
    except Exception as e:
        print(f"Error updating function: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error: {str(e)}')
        }