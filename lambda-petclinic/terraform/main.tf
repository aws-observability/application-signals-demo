data "aws_region" "current" {}
provider "aws" {
  region = "us-east-1"
}

#### DynamoDB
resource "aws_dynamodb_table" "my_table" {
  name         = "HistoricalRecordDynamoDBTable"
  billing_mode = "PAY_PER_REQUEST"

  attribute {
    name = "recordId"
    type = "S"
  }

  hash_key = "recordId"
}

### IAM role

resource "aws_iam_role" "lambda_exec_role" {

  name = "lambda_exec_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action    = "sts:AssumeRole",
      Effect    = "Allow",
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_policy" "lambda_policy" {
  name        = local.policy_name
  description = "IAM policy for Lambda to write logs to CloudWatch"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action   = "*",
      Effect   = "Allow",
      Resource = "*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy_attach" {
  role       = local.role_name
  policy_arn = local.policy_arn
}

locals {
  role_arn = aws_iam_role.lambda_exec_role.arn
  role_name = "lambda_exec_role"
  policy_arn = aws_iam_policy.lambda_policy.arn
  policy_name = "lambda_policy"
  layer_arns = {
    "af-south-1"     = "arn:aws:lambda:af-south-1:904233096616:layer:AWSOpenTelemetryDistroPython:5"
    "ap-east-1"      = "arn:aws:lambda:ap-east-1:888577020596:layer:AWSOpenTelemetryDistroPython:5"
    "ap-northeast-1" = "arn:aws:lambda:ap-northeast-1:615299751070:layer:AWSOpenTelemetryDistroPython:5"
    "ap-northeast-2" = "arn:aws:lambda:ap-northeast-2:615299751070:layer:AWSOpenTelemetryDistroPython:5"
    "ap-northeast-3" = "arn:aws:lambda:ap-northeast-3:615299751070:layer:AWSOpenTelemetryDistroPython:5"
    "ap-south-1"     = "arn:aws:lambda:ap-south-1:615299751070:layer:AWSOpenTelemetryDistroPython:5"
    "ap-south-2"     = "arn:aws:lambda:ap-south-2:796973505492:layer:AWSOpenTelemetryDistroPython:5"
    "ap-southeast-1" = "arn:aws:lambda:ap-southeast-1:615299751070:layer:AWSOpenTelemetryDistroPython:5"
    "ap-southeast-2" = "arn:aws:lambda:ap-southeast-2:615299751070:layer:AWSOpenTelemetryDistroPython:5"
    "ap-southeast-3" = "arn:aws:lambda:ap-southeast-3:039612877180:layer:AWSOpenTelemetryDistroPython:5"
    "ap-southeast-4" = "arn:aws:lambda:ap-southeast-4:713881805771:layer:AWSOpenTelemetryDistroPython:5"
    "ca-central-1"   = "arn:aws:lambda:ca-central-1:615299751070:layer:AWSOpenTelemetryDistroPython:5"
    "eu-central-1"   = "arn:aws:lambda:eu-central-1:615299751070:layer:AWSOpenTelemetryDistroPython:5"
    "eu-central-2"   = "arn:aws:lambda:eu-central-2:156041407956:layer:AWSOpenTelemetryDistroPython:5"
    "eu-north-1"     = "arn:aws:lambda:eu-north-1:615299751070:layer:AWSOpenTelemetryDistroPython:5"
    "eu-south-1"     = "arn:aws:lambda:eu-south-1:257394471194:layer:AWSOpenTelemetryDistroPython:5"
    "eu-south-2"     = "arn:aws:lambda:eu-south-2:490004653786:layer:AWSOpenTelemetryDistroPython:5"
    "eu-west-1"      = "arn:aws:lambda:eu-west-1:615299751070:layer:AWSOpenTelemetryDistroPython:5"
    "eu-west-2"      = "arn:aws:lambda:eu-west-2:615299751070:layer:AWSOpenTelemetryDistroPython:5"
    "eu-west-3"      = "arn:aws:lambda:eu-west-3:615299751070:layer:AWSOpenTelemetryDistroPython:5"
    "il-central-1"   = "arn:aws:lambda:il-central-1:746669239226:layer:AWSOpenTelemetryDistroPython:5"
    "me-central-1"   = "arn:aws:lambda:me-central-1:739275441131:layer:AWSOpenTelemetryDistroPython:5"
    "me-south-1"     = "arn:aws:lambda:me-south-1:980921751758:layer:AWSOpenTelemetryDistroPython:5"
    "sa-east-1"      = "arn:aws:lambda:sa-east-1:615299751070:layer:AWSOpenTelemetryDistroPython:5"
    "us-east-1"      = "arn:aws:lambda:us-east-1:615299751070:layer:AWSOpenTelemetryDistroPython:5"
    "us-east-2"      = "arn:aws:lambda:us-east-2:615299751070:layer:AWSOpenTelemetryDistroPython:5"
    "us-west-1"      = "arn:aws:lambda:us-west-1:615299751070:layer:AWSOpenTelemetryDistroPython:12"
    "us-west-2"      = "arn:aws:lambda:us-west-2:615299751070:layer:AWSOpenTelemetryDistroPython:12"
  }
}


###### lambda functions
resource "aws_lambda_function" "my_lambda" {
  function_name = "appointment-service-create"

  handler = "lambda_function.lambda_handler"
  runtime = "python3.13"
  timeout = 30

  role = local.role_arn

  filename         = "${path.module}/../sample-apps/build/function.zip"
  tracing_config {
    mode = "Active"
  }
  layers = [lookup(local.layer_arns, data.aws_region.current.name, "")]

  environment {
    variables = {
      AWS_LAMBDA_EXEC_WRAPPER = "/opt/otel-instrument",
    }
  }
}

##### Lambda 2
resource "aws_lambda_function" "my_lambda2" {
  function_name = "appointment-service-list"

  handler = "lambda_function.lambda_handler"
  runtime = "python3.13"
  timeout = 30

  role = local.role_arn

  filename         = "${path.module}/../sample-apps/build2/function.zip"
  tracing_config {
    mode = "Active"
  }
  layers = [lookup(local.layer_arns, data.aws_region.current.name, "")]

  environment {
    variables = {
      AWS_LAMBDA_EXEC_WRAPPER = "/opt/otel-instrument",
    }
  }
}

##### Lambda 3
resource "aws_lambda_function" "my_lambda3" {
  function_name = "appointment-service-get"

  handler = "lambda_function.lambda_handler"
  runtime = "python3.13"
  timeout = 30

  role = local.role_arn

  filename         = "${path.module}/../sample-apps/build3/function.zip"
  tracing_config {
    mode = "Active"
  }
  layers = [lookup(local.layer_arns, data.aws_region.current.name, "")]

  environment {
    variables = {
      AWS_LAMBDA_EXEC_WRAPPER = "/opt/otel-instrument",
    }
  }

  publish       = true
}

resource "aws_lambda_alias" "my_lambda_alias3" {
  name             = "prod"
  function_name    = aws_lambda_function.my_lambda3.function_name
  function_version = aws_lambda_function.my_lambda3.version
}


####### API GW
resource "aws_api_gateway_rest_api" "api" {
  name        = "appointment-service-gateway"
  description = "API Gateway for Lambda function"
}

### path 1
resource "aws_api_gateway_resource" "resource" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "add"
}

resource "aws_api_gateway_method" "method" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "integration" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.resource.id
  http_method = aws_api_gateway_method.method.http_method

  type                    = "AWS_PROXY"
  integration_http_method = "POST"
  uri                     = aws_lambda_function.my_lambda.invoke_arn
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.my_lambda.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

### path 2
resource "aws_api_gateway_resource" "resource2" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "list"
}

resource "aws_api_gateway_method" "method2" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.resource2.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "integration2" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.resource2.id
  http_method             = aws_api_gateway_method.method2.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.my_lambda2.invoke_arn
}

resource "aws_lambda_permission" "api_gateway2" {
  statement_id  = "AllowAPIGatewayInvoke2"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.my_lambda2.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

### path 3
resource "aws_api_gateway_resource" "resource3" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "get"
}

resource "aws_api_gateway_method" "method3" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.resource3.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "integration3" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.resource3.id
  http_method             = aws_api_gateway_method.method3.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.my_lambda_alias3.invoke_arn
}

resource "aws_lambda_permission" "api_gateway3" {
  statement_id  = "AllowAPIGatewayInvoke3"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_alias.my_lambda_alias3.function_name
  qualifier = aws_lambda_alias.my_lambda_alias3.name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# deploy
resource "aws_api_gateway_deployment" "deployment" {
  depends_on = [
    aws_api_gateway_integration.integration,
    aws_api_gateway_integration.integration2,
    aws_api_gateway_integration.integration3,
  ]

  rest_api_id = aws_api_gateway_rest_api.api.id
}

resource "aws_api_gateway_stage" "prod" {
  stage_name           = "prod"
  rest_api_id          = aws_api_gateway_rest_api.api.id
  deployment_id        = aws_api_gateway_deployment.deployment.id
  xray_tracing_enabled = true

  depends_on = [
    aws_api_gateway_deployment.deployment
  ]
}

## Lambda 4
resource "aws_lambda_function" "http_requester" {
  function_name = "HttpRequesterFunction"
  handler = "lambda_function.lambda_handler"
  runtime = "python3.13"
  role = local.role_arn
  filename         = "${path.module}/../sample-apps/build4/function.zip"
  timeout = 70

  tracing_config {
    mode = "Active"
  }
  environment {
    variables = {
      API_URL_1       = "${aws_api_gateway_stage.prod.invoke_url}/add?owners=lw&petid=dog&recordId=1"
      API_URL_2       = "${aws_api_gateway_stage.prod.invoke_url}/list?owners=lw&petid=dog"
      API_URL_3       = "${aws_api_gateway_stage.prod.invoke_url}/get?owners=lw&petid=dog&recordId=1"
      AWS_LAMBDA_EXEC_WRAPPER1 = "/opt/otel-instrument"
      OTEL_TRACES_EXPORTER = "console,otlp"
      OTEL_PYTHON_DISABLED_INSTRUMENTATIONS = "none"
    }
  }
}

### EventBridge
resource "aws_cloudwatch_event_rule" "every_minute" {
  name                = "TriggerHttpRequesterEveryMinute"
  schedule_expression = "rate(1 minute)"
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.http_requester.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.every_minute.arn
}


resource "aws_cloudwatch_event_target" "trigger_lambda" {
  rule      = aws_cloudwatch_event_rule.every_minute.name
  target_id = "HttpRequesterLambda"
  arn       = aws_lambda_function.http_requester.arn
}

output "api_add_record" {
  value = "${aws_api_gateway_stage.prod.invoke_url}/add?owners=lw&petid=dog&recordId=1"
}

output "api_list_record" {
  value = "${aws_api_gateway_stage.prod.invoke_url}/list?owners=lw&petid=dog"
}

output "api_query_record" {
  value = "${aws_api_gateway_stage.prod.invoke_url}/get?owners=lw&petid=dog&recordId=1"
}

