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
3. Ensure proper error handling and logging
4. Test thoroughly before committing

## Notes

- All timestamps are handled in UTC
- Business hours are considered as UTC 9:00-17:00
- Test cases should be designed to be idempotent
- Consider rate limits when designing test cases


## Optional: Lambda Deployment and Monitoring

The framework supports running tests in AWS Lambda and monitoring test results through CloudWatch Alarms. The deployment process is managed through scripts in the `deploy` directory.

### Directory Structure
```
data_test/
├── deploy/
│   ├── deploy_lambda.sh      # Deploy Lambda function
│   ├── remove_lambda.sh      # Remove Lambda function
│   ├── remove_alarms.sh      # Remove CloudWatch alarms
│   ├── create_test_cases_alarms.py    # Create individual test alarms
│   └── create_composite_alarms.py     # Create composite alarms
├── test_cases/              # Test case JSON files
└── lambda/                  # Lambda function code
```

### Deployment Process

1. **Deploy Lambda Function**
   ```bash
   # From the data_test directory
   ./deploy/deploy_lambda.sh [region]  # Example: ./deploy/deploy_lambda.sh ap-southeast-1
   ```
   This script will:
   - Create a deployment package with all necessary files
   - Optionally deploy to AWS Lambda
   - Clean up temporary files

2. **Create CloudWatch Alarms**
   ```bash
   # Navigate to deploy directory
   cd deploy

   # Create individual test alarms
   python3 create_test_cases_alarms.py --region [region] \
     --logs-file [path_to_logs_file] \
     --metrics-file [path_to_metrics_file] \
     --traces-file [path_to_traces_file]
   
   # Create composite alarms
   python3 create_composite_alarms.py --region [region] \
     --logs-file [path_to_logs_file] \
     --metrics-file [path_to_metrics_file] \
     --traces-file [path_to_traces_file]
   ```

   Note: The alarm creation scripts should be run from the `deploy` directory. Default paths for test case files are relative to the `deploy` directory:
   - Default logs file: `../test_cases/logs_test_cases.json`
   - Default metrics file: `../test_cases/metrics_test_cases.json`
   - Default traces file: `../test_cases/traces_test_cases.json`

   Example:
   ```bash
   # Using default paths
   python3 create_test_cases_alarms.py --region us-east-1
   
   # Using custom paths
   python3 create_test_cases_alarms.py --region us-east-1 \
     --logs-file ../test_cases/logs_test_cases.json \
     --metrics-file ../test_cases/metrics_test_cases.json \
     --traces-file ../test_cases/traces_test_cases.json
   ```

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
- **Data Points**: 4 (2 hours)
- **Threshold**: 0.5
- **Operator**: LessThanThreshold
- **Missing Data**: treated as missing

### Cleanup Process

1. **Remove CloudWatch Alarms**
   ```bash
   # From the data_test directory
   ./deploy/remove_alarms.sh [region]  # Example: ./deploy/remove_alarms.sh ap-southeast-1
   ```
   This script will:
   - Find all alarms starting with "APMDemoTest"
   - Display the list of alarms to be deleted
   - Delete these alarms

2. **Remove Lambda Function**
   ```bash
   # From the data_test directory
   ./deploy/remove_lambda.sh [region]  # Example: ./deploy/remove_lambda.sh ap-southeast-1
   ```
   This script will:
   - Ask for confirmation before deletion
   - Delete the Lambda function named "APM_Demo_Test_Runner"
   - Provide feedback on the deletion status

3. **Clean Up Temporary Files**
   ```bash
   # From the data_test directory
   rm -rf deploy/*.zip
   rm -rf deploy/temp_*
   ```

Note: All scripts support specifying AWS region as a parameter. If not specified, us-east-1 will be used as the default region.