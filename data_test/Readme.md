# AWS Application Signals Testing Framework

This directory contains a comprehensive testing framework for validating Status of APM Demo APP's functionality by running data validation on Traces / Logs / Metrics that it should generate.

## Overview

The testing framework consists of three main components:

1. **Logs Testing** (`run_logs_tests.py`)
   - Tests CloudWatch Logs queries and validations
   - Supports various validation types including count checks and field content validation

2. **Metrics Testing** (`run_metrics_tests.py`)
   - Tests CloudWatch Metrics data collection and threshold validations
   - Supports business hours and non-business hours testing
   - Includes various comparison operators for threshold validation
   - **NEW**: Supports CloudWatch Metrics Insights SQL queries with `use_query_style: true`
   - **NEW**: Supports `NO_VALIDATE` dimensions for existence-only validation in SQL queries

3. **Trace Testing** (`run_trace_tests.py`)
   - Tests AWS X-Ray trace collection and analysis
   - Supports multiple validation types including:
     - Trace count validation
     - Metadata checks
     - Attribute existence and value matching
     - Exception and error code validation
     - HTTP status code validation

## Directory Structure

```
data_test/
├── run_logs_tests.py
├── run_metrics_tests.py
├── run_trace_tests.py
├── deploy/
├── test_cases/
└── lambda/
```

## Prerequisites

- Python 3.x
- AWS CLI configured with appropriate credentials
- Required AWS permissions for:
  - CloudWatch Logs
  - CloudWatch Metrics
  - X-Ray

## Environment Variables

The framework automatically reads and replaces placeholders using environment variables:

- **`AWS_REGION`**: Automatically replaces `REGION_NAME_PLACEHOLDER` in test cases
- **`ENV_NAME`**: Automatically replaces `ENVIRONMENT_NAME_PLACEHOLDER` in test cases
- **Account ID**: Automatically replaces `ACCOUNT_ID_PLACEHOLDER` with the current AWS account ID running in lambda environment

## Usage

Each test script follows a similar pattern and requires a JSON file containing test cases:

```bash
# For Logs Testing
python3 run_logs_tests.py <path_to_test_cases.json>

# For Metrics Testing
python3 run_metrics_tests.py <path_to_test_cases.json>

# For Trace Testing
python3 run_trace_tests.py <path_to_test_cases.json>
```

## Test Case Format

### Logs Test Case Example
```json
{
  "log_test_cases": [
    {
      "test_case_id": "test-1",
      "description": "Test log group query",
      "log_group_names": ["/aws/lambda/example"],
      "query_string": "fields @timestamp, @message",
      "time_range": {
        "relative_minutes": 60
      },
      "validation_checks": [
        {
          "check_type": "count",
          "expected_count": 1,
          "comparison_operator": "GreaterThanOrEqualToThreshold"
        }
      ]
    }
  ]
}
```

### Metrics Test Case Example
```json
{
  "metric_test_cases": [
    {
      "test_case_id": "test-1",
      "description": "Test metric threshold",
      "metric_namespace": "AWS/Lambda",
      "metric_name": "Errors",
      "dimensions": [
        {
          "Name": "FunctionName",
          "Value": "example-function"
        }
      ],
      "statistic": "Sum",
      "evaluation_period_minutes": 5,
      "threshold": {
        "comparison_operator": [
          {
            "operator": "LessThanThreshold",
            "threshold_value": 1
          }
        ]
      }
    }
  ]
}
```

### Metrics Test Case with SQL Query (NEW)
```json
{
  "metric_test_cases": [
    {
      "test_case_id": "test-2",
      "description": "Test metric with SQL query",
      "use_query_style": true,
      "metric_namespace": "AWS/Lambda",
      "metric_name": "Errors",
      "dimensions": [
        {
          "Name": "FunctionName",
          "Value": "ENVIRONMENT_NAME_PLACEHOLDER"
        },
        {
          "Name": "Region",
          "Value": "NO_VALIDATE"
        }
      ],
      "statistic": "Sum",
      "evaluation_period_minutes": 5,
      "threshold": {
        "comparison_operator": [
          {
            "operator": "LessThanThreshold",
            "threshold_value": 1
          }
        ]
      }
    }
  ]
}
```

### Trace Test Case Example
```json
{
  "trace_test_cases": [
    {
      "test_case_id": "test-1",
      "description": "Test trace attributes",
      "parameters": {
        "relative_minutes": 60,
        "filter_expression": "service(\"example-service\")"
      },
      "validation_checks": [
        {
          "check_type": "trace_attribute_exists",
          "attribute_type": "http.response.status_code"
        }
      ]
    }
  ]
}
```

## Validation Types

### Logs Validation Types
- `count`: Validates the number of log records
- `field_contains`: Checks if a field contains specific content
- `general_exists`: Checks for general text existence in logs

### Metrics Validation Types
- Supports various comparison operators:
  - `GreaterThanThreshold`
  - `LessThanThreshold`
  - `GreaterThanOrEqualToThreshold`
  - `LessThanOrEqualToThreshold`
- **NEW**: `NO_VALIDATE` dimension values for existence-only validation, this only effect with SQL type query

### Trace Validation Types
- `count`: Validates trace count
- `metadata_check`: Checks for metadata existence
- `trace_attribute_exists`: Validates trace attribute presence
- `trace_attribute_value_match`: Matches specific attribute values
- `segment_has_exception`: Checks for exceptions in segments
- `exception_message`: Validates exception messages
- `error_code`: Checks for specific error codes
- `http_status_code`: Validates HTTP status codes

## Contributing

When adding new test cases:
1. Create appropriate JSON test case files
2. Follow the existing validation patterns
3. Use placeholders for environment-specific values
4. Ensure proper error handling and logging
5. Test thoroughly before committing

## Optional: Lambda Deployment and Monitoring

The framework supports running tests in AWS Lambda and monitoring test results through CloudWatch Alarms. The deployment process is managed through scripts in the `deploy` directory.

### Directory Structure
```
data_test/
├── deploy/
│   ├── deploy_lambda_cdk.sh  # Deploy Lambda function and CloudWatch alarms using CDK
│   ├── compare_composite_alarms.sh # Compare alarms across accounts
│   └── cdk_lambda/           # CDK project for Lambda and alarm deployment
│       ├── lib/
│       │   ├── lambda-stack.ts    # CDK stack for Lambda function
│       │   └── alarms-stack.ts    # CDK stack for CloudWatch alarms
│       └── ...
├── test_cases/              # Test case JSON files
└── lambda/                  # Lambda function code
```

### Deployment Process

1. **Deploy Lambda Function with CDK**
   ```bash
   # From the data_test directory
   ./deploy/deploy_lambda_cdk.sh --region=<region-name>  # Example: ./deploy/deploy_lambda_cdk.sh --region=us-east-1
   
   # To specify a custom function name
   ./deploy/deploy_lambda_cdk.sh --region=<region-name> --function-name=<function-name>
   ```
   This script will:
   - Create a temporary deployment package with Lambda code and test cases
   - Deploy the Lambda function using AWS CDK
   - Configure an EventBridge rule to trigger the function every 30 minutes
   - Clean up temporary files automatically

2. **Create CloudWatch Alarms**

   CloudWatch alarms are created automatically using the CDK deployment script by adding the `--create-alarms=true` parameter:
   
   ```bash
   # Deploy Lambda function and create CloudWatch alarms
   ./deploy/deploy_lambda_cdk.sh --region=<region-name> --create-alarms=true
   ```
   
   This creates:
   - Individual alarms for each test case
   - Composite alarms grouped by scenario
   - A root composite alarm that monitors all scenarios
   
   The alarms will be created in a separate CloudFormation stack named `APMDemoTestAlarmsStack`.
   
   The CDK code for alarms is defined in `deploy/cdk_lambda/lib/alarms-stack.ts` and uses test case files from:
   - Logs file: `test_cases/logs_test_cases.json`
   - Metrics file: `test_cases/metrics_test_cases.json`
   - Traces file: `test_cases/traces_test_cases.json`
   

### Alarm Configuration

#### Alarm Structure
```
Root Composite Alarm
├── Scenario 1 Composite Alarm
│   ├── Test Case 1 Alarm
│   ├── Test Case 2 Alarm
│   └── ...
├── Scenario 2 Composite Alarm
│   ├── Test Case 1 Alarm
│   ├── Test Case 2 Alarm
│   └── ...
└── ...
```

#### Test Results Metrics
- **Namespace**: `APMTestResults`
- **Metric Name**: `TestResult`
- **Dimensions**:
  - `TestType`: logs/metrics/traces
  - `TestCaseId`: unique test identifier
  - `TestScenario`: scenario grouping
- **Values**:
  - 1.0: Test passed
  - 0.0: Test failed

#### Alarm Parameters
- **Evaluation Period**: 30 minutes
- **Data Points**: 8 (4 hours)
- **Threshold**: 0.5
- **Operator**: LessThanThreshold
- **Missing Data**: treated as missing

### Cleanup Process

1. **Remove Lambda Function and CloudWatch Alarms**
   ```bash
   # From the data_test directory
   # To remove just the Lambda function
   ./deploy/deploy_lambda_cdk.sh --operation=destroy --region=<region-name>
   
   # To remove both Lambda function and CloudWatch alarms (if previously created)
   ./deploy/deploy_lambda_cdk.sh --operation=destroy --region=<region-name> --create-alarms=true
   ```
   This script will:
   - Destroy the CloudFormation stack(s) containing the Lambda function and/or alarms
   - Remove the EventBridge rule and all associated resources
   - Remove all CloudWatch alarms if --create-alarms=true was specified
   - Provide feedback on the deletion status
