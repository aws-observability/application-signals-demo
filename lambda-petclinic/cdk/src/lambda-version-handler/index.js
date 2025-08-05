// Use AWS SDK v3 for Lambda operations
const { Lambda } = require('@aws-sdk/client-lambda');
const { S3 } = require('@aws-sdk/client-s3');
const https = require('https');
const { URL } = require('url');
const lambda = new Lambda();
const s3 = new S3();

// Custom CloudFormation response function using HTTPS with proper timeout and error handling
async function sendCloudFormationResponse(event, context, status, responseData = {}, physicalResourceId = null) {
  const responsePayload = {
    Status: status,
    Reason: `See the details in CloudWatch Log Stream: ${context.logStreamName}`,
    PhysicalResourceId: physicalResourceId || context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData
  };
  
  // Log the complete CloudFormation response payload
  logWithTimestamp("Complete CloudFormation response payload", responsePayload);
  
  const responseBody = JSON.stringify(responsePayload);

  const parsedUrl = new URL(event.ResponseURL);
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(responseBody)
    },
    timeout: 10000, // 10 second timeout
  };

  return new Promise((resolve, reject) => {
    logWithTimestamp("Initiating HTTPS request to CloudFormation", {
      hostname: options.hostname,
      path: options.path,
      method: options.method
    });
    
    const req = https.request(options, (res) => {
      logWithTimestamp(`CloudFormation response status: ${res.statusCode}`);
      
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        logWithTimestamp('CloudFormation response completed', {
          statusCode: res.statusCode,
          responseData: responseData
        });
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          logWithTimestamp('CloudFormation response sent successfully');
          resolve();
        } else {
          const error = new Error(`CloudFormation response failed with status ${res.statusCode}: ${responseData}`);
          logWithTimestamp(`CloudFormation response failed: ${error.message}`);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      logWithTimestamp(`CloudFormation response error: ${error.message}`, error);
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      const timeoutError = new Error('CloudFormation response request timed out');
      logWithTimestamp(timeoutError.message);
      reject(timeoutError);
    });

    logWithTimestamp('Sending request body to CloudFormation', responseBody);
    req.write(responseBody);
    req.end();
    logWithTimestamp('HTTPS request sent, waiting for response');
  });
}

// Helper function to log details with timestamps
function logWithTimestamp(message, obj = null) {
  const timestamp = new Date().toISOString();
  if (obj) {
    console.log(`[${timestamp}] ${message}:`, JSON.stringify(obj, null, 2));
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

// Helper function to wait for a specified time
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to retry Lambda operations with exponential backoff
async function retryLambdaOperation(operation, operationName, maxRetries = 7) {
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      return await operation();
    } catch (error) {
      if (error.name === 'ResourceConflictException' && retryCount < maxRetries - 1) {
        retryCount++;
        const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s, 16s, 32s, 64s, 128s
        logWithTimestamp(`${operationName} failed with ResourceConflictException, retrying in ${waitTime}ms (attempt ${retryCount}/${maxRetries})`);
        await sleep(waitTime);
      } else {
        throw error;
      }
    }
  }
}

// Helper function to verify alias is ready and accessible
async function verifyAliasReady(functionName, aliasName, maxRetries = 5) {
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      logWithTimestamp(`Verifying alias '${aliasName}' is ready (attempt ${retryCount + 1}/${maxRetries})`);
      const aliasInfo = await lambda.getAlias({
        FunctionName: functionName,
        Name: aliasName
      });
      
      // Check if the alias has the expected properties
      if (aliasInfo.AliasArn && aliasInfo.Name) {
        logWithTimestamp(`Alias '${aliasName}' is ready and accessible`, {
          AliasArn: aliasInfo.AliasArn,
          Name: aliasInfo.Name,
          FunctionVersion: aliasInfo.FunctionVersion
        });
        return aliasInfo;
      } else {
        throw new Error('Alias found but missing required properties');
      }
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries) {
        logWithTimestamp(`Failed to verify alias after ${maxRetries} attempts: ${error.message}`, error);
        throw error;
      }
      
      const waitTime = 2000; // Wait 2 seconds between retries
      logWithTimestamp(`Alias not ready yet, retrying in ${waitTime}ms (attempt ${retryCount}/${maxRetries}): ${error.message}`);
      await sleep(waitTime);
    }
  }
}

// List existing versions for debugging
async function listVersions(functionName) {
  try {
    logWithTimestamp(`Listing versions for function: ${functionName}`);
    const result = await lambda.listVersionsByFunction({ FunctionName: functionName });
    logWithTimestamp(`Found ${result.Versions.length} versions`, 
      result.Versions.map(v => ({ Version: v.Version, LastModified: v.LastModified }))
    );
    return result.Versions;
  } catch (error) {
    logWithTimestamp(`Error listing versions: ${error.message}`);
    throw error;
  }
}

// List existing aliases for debugging
async function listAliases(functionName) {
  try {
    logWithTimestamp(`Listing aliases for function: ${functionName}`);
    const result = await lambda.listAliases({ FunctionName: functionName });
    logWithTimestamp(`Found ${result.Aliases.length} aliases`, result.Aliases);
    return result.Aliases;
  } catch (error) {
    logWithTimestamp(`Error listing aliases: ${error.message}`);
    throw error;
  }
}

// Check if S3 object exists
async function checkS3Object(bucket, key) {
  try {
    logWithTimestamp(`Checking if S3 object exists: s3://${bucket}/${key}`);
    const result = await s3.headObject({ Bucket: bucket, Key: key });
    logWithTimestamp(`S3 object found with size: ${result.ContentLength} bytes`);
    return true;
  } catch (error) {
    logWithTimestamp(`Error checking S3 object: ${error.message}`);
    return false;
  }
}

// Get Lambda function current configuration
async function getFunctionConfig(functionName) {
  try {
    logWithTimestamp(`Getting function configuration for: ${functionName}`);
    const result = await lambda.getFunctionConfiguration({ FunctionName: functionName });
    logWithTimestamp(`Function configuration retrieved`, {
      Runtime: result.Runtime,
      Handler: result.Handler,
      CodeSha256: result.CodeSha256,
      LastModified: result.LastModified
    });
    return result;
  } catch (error) {
    logWithTimestamp(`Error getting function configuration: ${error.message}`);
    throw error;
  }
}

exports.handler = async function(event, context) {
  logWithTimestamp("Custom resource event received", event);
  
  try {
    // Extract properties from the event
    const props = event.ResourceProperties;
    const functionName = props.FunctionName;
    const s3Bucket = props.S3Bucket;
    const s3Key = props.S3Key;
    const alternateVersionWeight = parseFloat(props.AlternateVersionWeight);
    const aliasName = props.AliasName;
    
    // Log parsed properties
    logWithTimestamp("Parsed properties", {
      functionName,
      s3Bucket,
      s3Key,
      alternateVersionWeight,
      aliasName
    });
    
    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
      // Check if the function exists
      logWithTimestamp(`Checking if function exists: ${functionName}`);
      await getFunctionConfig(functionName);
      
      // List current versions before making any changes
      await listVersions(functionName);
      await listAliases(functionName);
      
      // Check if the S3 object exists
      const s3ObjectExists = await checkS3Object(s3Bucket, s3Key);
      if (!s3ObjectExists) {
        throw new Error(`S3 object not found: s3://${s3Bucket}/${s3Key}`);
      }
      
      // Step 1: Publish a version of the current function (original code)
      logWithTimestamp("Publishing version of the original function");
      let publishResult;
      try {
        publishResult = await retryLambdaOperation(
          () => lambda.publishVersion({
            FunctionName: functionName,
            Description: 'Original version'
          }),
          'PublishVersion (original)'
        );
        logWithTimestamp("Original version published successfully", publishResult);
      } catch (error) {
        logWithTimestamp(`Error publishing original version: ${error.message}`, error);
        throw error;
      }
      
      const version1 = publishResult.Version;
      logWithTimestamp(`Original version published as version: ${version1}`);
      
      // Verify original version was published
      const versionsAfterPublish1 = await listVersions(functionName);
      logWithTimestamp("Versions after publishing original version", versionsAfterPublish1);
      
      // Step 2: Update function code with alternate implementation
      logWithTimestamp(`Updating function code from S3: s3://${s3Bucket}/${s3Key}`);
      try {
        await lambda.updateFunctionCode({
          FunctionName: functionName,
          S3Bucket: s3Bucket,
          S3Key: s3Key
        });
        logWithTimestamp("Function code updated successfully");
      } catch (error) {
        logWithTimestamp(`Error updating function code: ${error.message}`, error);
        throw error;
      }
      
      // Verify function code was updated by checking the new code hash
      const updatedConfig = await getFunctionConfig(functionName);
      logWithTimestamp("Function configuration after code update", updatedConfig);
      
      // Step 3: Publish a version with the alternate code
      logWithTimestamp("Publishing version of the alternate function");
      let publishResult2;
      try {
        publishResult2 = await retryLambdaOperation(
          () => lambda.publishVersion({
            FunctionName: functionName,
            Description: 'Alternate version'
          }),
          'PublishVersion (alternate)'
        );
        logWithTimestamp("Alternate version published successfully", publishResult2);
      } catch (error) {
        logWithTimestamp(`Error publishing alternate version: ${error.message}`, error);
        throw error;
      }
      
      const version2 = publishResult2.Version;
      logWithTimestamp(`Alternate version published as version: ${version2}`);
      
      // Verify both versions now exist
      const versionsAfterPublish2 = await listVersions(functionName);
      logWithTimestamp("Versions after publishing alternate version", versionsAfterPublish2);
      
      // Step 4: Create or update an alias with weighted routing
      const aliasParams = {
        FunctionName: functionName,
        Name: aliasName,
        FunctionVersion: version1,
        RoutingConfig: {
          AdditionalVersionWeights: {
            [version2]: alternateVersionWeight
          }
        }
      };
      
      logWithTimestamp("Creating/updating alias with routing config", aliasParams);
      let aliasResult;
      try {
        // Check if alias already exists
        const existingAliases = await listAliases(functionName);
        const aliasExists = existingAliases.some(a => a.Name === aliasName);
        
        if (aliasExists) {
          logWithTimestamp(`Alias '${aliasName}' exists, updating it`);
          aliasResult = await lambda.updateAlias(aliasParams);
          logWithTimestamp("Alias updated successfully", aliasResult);
        } else {
          logWithTimestamp(`Alias '${aliasName}' does not exist, creating it`);
          aliasResult = await lambda.createAlias(aliasParams);
          logWithTimestamp("Alias created successfully", aliasResult);
        }
      } catch (error) {
        logWithTimestamp(`Error creating/updating alias: ${error.message}`, error);
        throw error;
      }
      
      // Verify alias was created/updated
      await listAliases(functionName);
      
      // Verify the alias is fully ready and accessible before returning
      logWithTimestamp("Verifying alias is ready before sending response");
      const verifiedAliasInfo = await verifyAliasReady(functionName, aliasName);
      
      // Use the verified alias ARN from the readiness check
      const aliasArn = verifiedAliasInfo.AliasArn;
      
      // Prepare response data (using camelCase for CloudFormation custom resource attributes)
      const responseData = {
        aliasArn: aliasArn,
        aliasName: aliasName,
        primaryVersion: version1,
        secondaryVersion: version2,
        weight: alternateVersionWeight
      };
      
      // Log the response data before sending
      logWithTimestamp("Response data being sent to CloudFormation", responseData);
      logWithTimestamp("PhysicalResourceId being sent", aliasArn);
      
      // Send success response
      logWithTimestamp("Sending success response to CloudFormation");
      await sendCloudFormationResponse(event, context, 'SUCCESS', responseData, aliasArn);
    } else if (event.RequestType === 'Delete') {
      // List current versions and aliases before deletion
      try {
        await listVersions(functionName);
        await listAliases(functionName);
      } catch (error) {
        logWithTimestamp(`Error listing versions/aliases before deletion: ${error.message}`);
        // Continue with deletion even if listing fails
      }
      
      // Clean up the alias on delete
      try {
        logWithTimestamp(`Deleting alias: ${aliasName}`);
        await lambda.deleteAlias({
          FunctionName: functionName,
          Name: aliasName
        });
        logWithTimestamp("Alias deleted successfully");
      } catch (error) {
        logWithTimestamp(`Error deleting alias (might not exist): ${error.message}`);
        // We'll still return success even if the alias doesn't exist
      }
      
      logWithTimestamp("Sending success response to CloudFormation for deletion");
      await sendCloudFormationResponse(event, context, 'SUCCESS', {});
    }
  } catch (error) {
    logWithTimestamp(`Unhandled error in custom resource: ${error.message}`, error);
    logWithTimestamp(`Error stack trace: ${error.stack}`);
    await sendCloudFormationResponse(event, context, 'FAILED', {
      Error: error.toString(),
      Stack: error.stack
    });
  }
};