# Ticketing Lambda Functions Error Fixes

## Issue Summary

Two critical errors identified in ticketing service Lambda functions:

### 1. SubmitTicket Lambda - SQS Message Size Error
- **Error Count**: 717 errors in last 24 hours
- **Error Type**: `ClientError: InvalidParameterValue`
- **Root Cause**: SQS message exceeds 262144 bytes limit
- **Location**: `lambda_function.py:67` - `sqs.send_message()`

### 2. CreateTickets Lambda - DynamoDB Duplicate Key Error  
- **Error Count**: 721 errors in last 24 hours
- **Error Type**: `ConditionalCheckFailedException`
- **Root Cause**: Duplicate ticket IDs violating condition `attribute_not_exists(ticket_id)`
- **Location**: `lambda_function.py:72` - `table.put_item()`

## Fix 1: SubmitTicket Lambda Function

### Current Code (Failing)
```python
# Line 67 - lambda_function.py
response = sqs.send_message(
    QueueUrl=QUEUE_URL,
    MessageBody=json.dumps(ticket)
)
```

### Fixed Code
```python
import json
import gzip
import base64
import boto3
from botocore.exceptions import ClientError

sqs = boto3.client('sqs')
s3 = boto3.client('s3')
S3_BUCKET = os.environ.get('LARGE_MESSAGE_BUCKET')  # Add to Lambda env vars
QUEUE_URL = os.environ['QUEUE_URL']

MAX_SQS_SIZE = 262144  # 256 KB

def lambda_handler(event, context):
    ticket = event  # Your ticket payload
    
    message_body = json.dumps(ticket)
    message_size = len(message_body.encode('utf-8'))
    
    # Option 1: Use S3 for large messages
    if message_size > MAX_SQS_SIZE:
        # Store large payload in S3
        s3_key = f"large-tickets/{context.request_id}.json"
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=message_body
        )
        
        # Send S3 pointer to SQS
        sqs_message = {
            'type': 'S3_REFERENCE',
            'bucket': S3_BUCKET,
            'key': s3_key,
            'size': message_size
        }
        response = sqs.send_message(
            QueueUrl=QUEUE_URL,
            MessageBody=json.dumps(sqs_message)
        )
    else:
        # Send directly to SQS
        response = sqs.send_message(
            QueueUrl=QUEUE_URL,
            MessageBody=message_body
        )
    
    return {
        'statusCode': 200,
        'body': json.dumps({'messageId': response['MessageId']})
    }
```

### Alternative Fix: Compress Large Messages
```python
def lambda_handler(event, context):
    ticket = event
    message_body = json.dumps(ticket)
    
    # Compress if near size limit
    if len(message_body.encode('utf-8')) > (MAX_SQS_SIZE * 0.8):
        compressed = gzip.compress(message_body.encode('utf-8'))
        encoded = base64.b64encode(compressed).decode('utf-8')
        
        if len(encoded) < MAX_SQS_SIZE:
            sqs_message = {
                'type': 'COMPRESSED',
                'data': encoded
            }
            message_body = json.dumps(sqs_message)
        else:
            # Still too large, use S3
            return handle_s3_storage(ticket, context)
    
    response = sqs.send_message(
        QueueUrl=QUEUE_URL,
        MessageBody=message_body
    )
    
    return {'statusCode': 200, 'body': json.dumps({'messageId': response['MessageId']})}
```

## Fix 2: CreateTickets Lambda Function

### Current Code (Failing)
```python
# Line 72 - lambda_function.py
table.put_item(
    Item=item,
    ConditionExpression='attribute_not_exists(ticket_id)'
)
```

### Fixed Code
```python
import uuid
import time
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Attr

def lambda_handler(event, context):
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(os.environ['TABLE_NAME'])
    
    # Parse SQS message (handle both direct and S3 reference)
    for record in event['Records']:
        message_body = json.loads(record['body'])
        
        # Handle S3 reference messages from SubmitTicket fix
        if isinstance(message_body, dict) and message_body.get('type') == 'S3_REFERENCE':
            s3 = boto3.client('s3')
            s3_obj = s3.get_object(Bucket=message_body['bucket'], Key=message_body['key'])
            ticket_data = json.loads(s3_obj['Body'].read())
            # Clean up S3 after processing
            s3.delete_object(Bucket=message_body['bucket'], Key=message_body['key'])
        else:
            ticket_data = message_body
        
        # Generate unique ticket ID with timestamp + UUID
        ticket_id = f"{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"
        
        item = {
            'ticket_id': ticket_id,
            'created_at': int(time.time()),
            **ticket_data
        }
        
        # Retry logic for duplicate key errors
        max_retries = 3
        for attempt in range(max_retries):
            try:
                table.put_item(
                    Item=item,
                    ConditionExpression='attribute_not_exists(ticket_id)'
                )
                print(f"Successfully created ticket: {ticket_id}")
                break
            except ClientError as e:
                if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                    if attempt < max_retries - 1:
                        # Regenerate ticket_id and retry
                        ticket_id = f"{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"
                        item['ticket_id'] = ticket_id
                        print(f"Duplicate detected, retrying with new ID: {ticket_id}")
                        time.sleep(0.1 * (attempt + 1))  # Exponential backoff
                    else:
                        # Log error after max retries
                        print(f"Failed to create ticket after {max_retries} attempts: {e}")
                        raise
                else:
                    raise
    
    return {'statusCode': 200, 'body': json.dumps({'message': 'Tickets processed'})}
```

### Alternative Fix: Use UpdateItem with Idempotency
```python
def lambda_handler(event, context):
    table = boto3.resource('dynamodb').Table(os.environ['TABLE_NAME'])
    
    for record in event['Records']:
        ticket_data = json.loads(record['body'])
        
        # Use request ID as idempotency key
        idempotency_key = record['messageId']  # SQS message ID
        ticket_id = ticket_data.get('ticket_id', str(uuid.uuid4()))
        
        try:
            # Use update_item instead of put_item for idempotency
            table.update_item(
                Key={'ticket_id': ticket_id},
                UpdateExpression='SET #data = :data, idempotency_key = :idem',
                ConditionExpression='attribute_not_exists(ticket_id) OR idempotency_key = :idem',
                ExpressionAttributeNames={'#data': 'data'},
                ExpressionAttributeValues={
                    ':data': ticket_data,
                    ':idem': idempotency_key
                }
            )
            print(f"Ticket created/updated: {ticket_id}")
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                # Ticket already exists with different idempotency key - skip
                print(f"Duplicate ticket {ticket_id} already exists, skipping")
            else:
                raise
    
    return {'statusCode': 200}
```

## Deployment Steps

### 1. Update SubmitTicket Lambda
```bash
# Add S3 bucket environment variable
aws lambda update-function-configuration \
  --function-name SubmitTicket \
  --environment Variables="{QUEUE_URL=$QUEUE_URL,LARGE_MESSAGE_BUCKET=$BUCKET_NAME}"

# Update Lambda code
zip function.zip lambda_function.py
aws lambda update-function-code \
  --function-name SubmitTicket \
  --zip-file fileb://function.zip
```

### 2. Update CreateTickets Lambda
```bash
# Update Lambda code
zip function.zip lambda_function.py
aws lambda update-function-code \
  --function-name CreateTickets \
  --zip-file fileb://function.zip
```

### 3. Update IAM Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::${LARGE_MESSAGE_BUCKET}/*"
    }
  ]
}
```

## Monitoring & Validation

After deploying fixes, monitor these metrics:

1. **SubmitTicket Success Rate**
   - CloudWatch Metric: `ApplicationSignals/Fault` should decrease
   - Target: 0 `InvalidParameterValue` errors

2. **CreateTickets Success Rate**  
   - CloudWatch Metric: `ApplicationSignals/Fault` should decrease
   - Target: 0 `ConditionalCheckFailedException` errors

3. **SLO Compliance**
   - `SubmitTicketHandlerAvailability` SLO should return to compliance
   - `PostTicketsAvailability` SLO should return to compliance

## Root Cause Analysis

### Why These Errors Occurred

**SubmitTicket Issue:**
- Ticket payload size not validated before sending to SQS
- SQS has hard limit of 256 KB (262144 bytes) per message
- Large attachments or verbose ticket descriptions exceeded limit

**CreateTickets Issue:**
- Ticket ID generation lacked sufficient entropy
- High concurrency causing timestamp-based ID collisions
- No retry mechanism for handling duplicate keys
- Condition expression too strict without fallback logic

## Prevention Strategies

1. **Input Validation**: Add size checks before AWS service calls
2. **UUID Generation**: Use UUID + timestamp for globally unique IDs
3. **Idempotency**: Implement idempotency tokens for duplicate prevention
4. **Graceful Degradation**: Handle AWS service limit errors with fallback logic
5. **Monitoring**: Set up CloudWatch alarms for error rate thresholds
