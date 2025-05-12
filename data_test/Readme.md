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

### Deployment Process

1. **Prepare Lambda Package**
   ```bash
   # From the data_test directory
   ./deploy/deploy_lambda.sh
   ```
   This script will:
   - Create a deployment package with all necessary files
   - Optionally deploy to AWS Lambda
   - Clean up temporary files

2. **Configure Lambda Function**
   - Set the Lambda function name in `deploy_lambda.sh`
   - Ensure the Lambda has appropriate IAM permissions for:
     - CloudWatch Logs
     - CloudWatch Metrics
     - X-Ray
     - SNS (for alarms)

### Monitoring Setup

The framework provides two scripts for setting up monitoring:

1. **Individual Test Alarms** (`create_test_cases_alarms.py`)
   - Creates CloudWatch Alarms for each test case
   - Monitors test results in the `APMTestResults` namespace
   - Alarms trigger when tests fail (value < 0.5)
   - Sends notifications to configured SNS topic

2. **Composite Alarms** (`create_composite_alarms.py`)
   - Creates hierarchical alarm structure:
     - Individual test case alarms
     - Scenario-level composite alarms
     - Root-level composite alarm
   - Provides consolidated monitoring view
   - Reduces alert noise through aggregation

### Alarm Configuration

1. **Update SNS Topic**
   - Set your SNS topic ARN in both alarm scripts:
     ```python
     ActionSNS = 'FILL IN YOUR SNS TOPIC ARN HERE'
     ```

2. **Run Alarm Creation**
   ```bash
   # Create individual test alarms
   python3 deploy/create_test_cases_alarms.py

   # Create composite alarms
   python3 deploy/create_composite_alarms.py
   ```

### Alarm Structure

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

### Test Results Metrics

- **Namespace**: `APMTestResults`
- **Metric Name**: `TestResult`
- **Dimensions**:
  - `TestType`: logs/metrics/traces
  - `TestCaseId`: unique test identifier
  - `TestScenario`: scenario grouping
- **Values**:
  - 1.0: Test passed
  - 0.0: Test failed

### Alarm Parameters

- **Evaluation Period**: 30 minutes
- **Data Points**: 4 (2 hours)
- **Threshold**: 0.5
- **Operator**: LessThanThreshold
- **Missing Data**: treated as missing