"""
Lambda Audit Deployment Function

This function simulates deployment failures and recovery for the audit-service Lambda function.
It first deploys bad code that throws exceptions, waits 2 minutes, then recovers with good code from S3.

DEBUGGING GUIDE:
================
To debug issues with this function:

1. CloudWatch Logs:
   - Go to AWS Console > CloudWatch > Log groups
   - Find log group: /aws/lambda/audit-service-update
   - Look for recent log streams (sorted by Last Event Time)
   - Search for ERROR, FAILED, or exception messages

2. Common Issues:
   - "Function audit-service not found" → Target function doesn't exist
   - "S3 object not found" → Check if s3://audit-service-functions-{account}-{region}/lambda-functions/good_function.zip exists
   - "Access Denied" → Check IAM permissions for lambda:UpdateFunctionCode and s3:GetObject
   - "InvalidParameterValue" → Check function name or S3 path format

3. Manual Testing:
   - Test this function directly from Lambda console
   - Check EventBridge Scheduler rule 'DeploymentSchedule' is enabled
   - Verify the audit-service function exists and is accessible
"""

import json
import boto3
import zipfile
import io
import datetime

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
    print(f"[{datetime.datetime.now()}] Starting deployment simulation")
    print(f"Request ID: {context.aws_request_id}")
    
    try:
        target_function = 'audit-service'
        simulate_deployment_with_error_and_fix = True
        
        print(f"Target function: {target_function}")
        print(f"Simulation mode: {simulate_deployment_with_error_and_fix}")
        
        if not target_function:
            print("ERROR: target_function_name is required")
            return {
                'statusCode': 400,
                'body': json.dumps('target_function_name is required')
            }
        
        if simulate_deployment_with_error_and_fix:
            print("Creating bad code package...")
            zip_bytes = create_sample_lambda_code()
            print(f"Bad code package size: {len(zip_bytes)} bytes")
            
            # Update the target Lambda function with bad code
            print(f"Deploying bad code to {target_function}...")
            try:
                response = lambda_client.update_function_code(
                    FunctionName=target_function,
                    ZipFile=zip_bytes,
                    Publish=False
                )
                print(f"SUCCESS: Bad code deployed to {target_function}")
                print(f"Function ARN: {response['FunctionArn']}")
                print(f"Code size: {response['CodeSize']} bytes")
            except Exception as e:
                print(f"FAILED: Bad code deployment failed: {str(e)}")
                print(f"Exception type: {type(e).__name__}")
                # Continue to recovery attempt
            
            print("Waiting 300 seconds before recovery...")
            import time 
            time.sleep(300)
            print("Wait complete, starting recovery...")
            
            # Attempt recovery with good code from S3
            try:
                print("Getting AWS account info for S3 path...")
                account_id = sts_client.get_caller_identity()['Account']
                region = boto3.Session().region_name
                s3_bucket = f"audit-service-functions-{account_id}-{region}"
                s3_key = 'lambda-functions/good_function.zip'
                
                print(f"Account ID: {account_id}")
                print(f"Region: {region}")
                print(f"S3 Bucket: {s3_bucket}")
                print(f"S3 Key: {s3_key}")
                print(f"Full S3 path: s3://{s3_bucket}/{s3_key}")
                
                print(f"Deploying good code from S3 to {target_function}...")
                response = lambda_client.update_function_code(
                    FunctionName=target_function,
                    S3Bucket=s3_bucket,
                    S3Key=s3_key,
                )
                print(f"SUCCESS: Recovered {target_function} with good code from S3")
                print(f"Function ARN: {response['FunctionArn']}")
                print(f"Code size: {response['CodeSize']} bytes")
                print(f"Last modified: {response['LastModified']}")
            except lambda_client.exceptions.ResourceNotFoundException as e:
                print(f"ERROR: S3 object not found - {str(e)}")
                print(f"Check if s3://{s3_bucket}/{s3_key} exists")
                raise e
            except Exception as e:
                print(f"ERROR: S3 deployment failed - {str(e)}")
                print(f"Exception type: {type(e).__name__}")
                raise e
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
        
    except lambda_client.exceptions.ResourceNotFoundException as e:
        print(f"ERROR: Function not found - {str(e)}")
        return {
            'statusCode': 404,
            'body': json.dumps(f'Function {target_function} not found')
        }
    
    except lambda_client.exceptions.InvalidParameterValueException as e:
        print(f"ERROR: Invalid parameter - {str(e)}")
        return {
            'statusCode': 400,
            'body': json.dumps(f'Invalid parameter: {str(e)}')
        }
        
    except Exception as e:
        print(f"ERROR: Unexpected error - {str(e)}")
        print(f"Exception type: {type(e).__name__}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error: {str(e)}')
        }
    finally:
        print(f"[{datetime.datetime.now()}] Deployment simulation completed")