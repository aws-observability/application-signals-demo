# AIAssistedAutoTests
This can run tests end-to-end with no user interaction.

We utilize custom Actions to authenticate and federate an AWS link automatically and inject JavaScript code to access metric graphs.

## Quick Start
After cloning the repository follow these steps to get started:
1. Generate AWS credentials (default for Bedrock, S3, and CloudWatch access, profile="auth-access" for the AWS account you run the demo from) 

**Example `.aws` file:**
```
[default]
aws_access_key_id=<...>
aws_secret_access_key=<...>
aws_session_token=<...>

[auth-access]
aws_access_key_id=<...>
aws_secret_access_key=<...>
aws_session_token=<...>
```
2. Run `pip install browser-use==0.2.5` to install browser-use (we want to remain on version `0.2.5`, but this can be changed in the future)
3. Run `pip install "browser-use[memory]"` to install memory functionality
4. Run `pip install playwright` to install PlayWright
5. `cd libs`
6. Run the file with `python main.py tests/test-x.script.md`

**Note:** To run tests through the console, you MUST ensure that you set your `MANUAL_MODE` variable in `.env` to `True`: `MANUAL_MODE=True`. `MANUAL_MODE=False` is used to run the tests in ECS.

## Environment Variables
To run this project, create a `.env` file in the root directory (`/ai-validator/.env`) based on the provided `.env.example`:

```
DEFAULT_ACCOUNT_AWS_REGION=<Region for default account (used for S3, CloudWatch, Bedrock, ECS access)>
DEFAULT_AWS_ACCOUNT_ID=<Account ID for default account (used for S3, CloudWatch, Bedrock, ECS access)>
DEBUG_MODE=<True/False>
S3_BUCKET_NAME_PREFIX=<S3 Bucket Name to store test results>
CLOUDWATCH_NAMESPACE=<CloudWatch namespace to publish metrics>
DEMO_AWS_ACCOUNT_ID=<Account ID for auth-access (account that runs the demo)>
DEMO_ROLE_ID=<Role name in auth-access account (account that runs the demo)>
HEADLESS_MODE=<True/False>
MANUAL_MODE=<True/False>
```

## Debugging

If you want to view the visual browser UI, set your `HEADLESS_MODE` variable in `.env` to `False`: `HEADLESS_MODE=False`

To debug in headless mode to save screenshots of each step to your directory, update your `DEBUG_MODE` variable in `.env` to `True`:
`DEBUG_MODE=True`

## AWS Account Permissions

### Credentials

In the project, we must use two different sets of AWS credentials. We have a default AWS account and an account that is currently running the demo application:

#### Default Account Credentials 

Default credentials are used for S3, CloudWatch, ECS, and Bedrock access. This is the account where metrics and logs are published to CloudWatch, test screenshots are uploaded to S3, ECS cluster lives, and Bedrock tokens are from. 

#### Demo Account (auth-access) Credentials

Credentials with `profile=auth-access` are used to define the account that is currently running the demo which we want to run the tests on. We use these credentials in our source code to generate a federated link (with the [`authentication_open()`](https://github.com/aws-observability/application-signals-demo/blob/main/ai-validator/libs/utils/utils.py#L53) function) to provide read access to our default account. 

### Assume Role and Permissions

In order to provide our default account with the correct permissions to read from the account that is running the demo, we must set up these permissions and trust relationships. This will allow the default account to assume the role and run tests from this account.

#### Demo Account

On the account that is running the demo app, you must follow the steps below:

##### Create Policy:
- On the AWS console, search for “IAM”
- Under the “Access management“ tab, click on “Policies”
- Click “Create policy” in the top right corner
- In the “Policy Editor” section, click “JSON” and paste the following to provide the correct permissions for the tests:
``` 
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "cloudwatch:*",
                "logs:*",
                "xray:*",
                "rum:*",
                "servicecatalog:*",
                "resource-explorer-2:*",
                "rds:*",
                "pi:*",
                "tag:GetResources",
                "application-signals:*"
            ],
            "Resource": "*"
        }
    ]
}
```
- Click “Next”
- Name the policy (we will reference this policy as “ExamplePolicy” below)
- Click “Create policy”
##### Create Role:
- Under the “Access management“ tab in "IAM", click on ”Roles“
- Click “Create role” in the top right corner
- Under “Trusted entity type”, select “AWS account” → “Another AWS account”
- Enter the account ID of the default account
- Select the policy you made above (“ExamplePolicy”) then click “Next”
- Name the role (we will reference this policy as “ExampleRole” below)
- Click “Create role”

**Note**: The name that you give this role must be the name that is added to your `.env` for the `DEMO_ROLE_ID` variable (`DEMO_ROLE_ID=ExampleRole`).
##### Edit trust policy:
- Under the “Access management” tab in "IAM", click on “Roles”
- Search for the role you just created (“ExampleRole”)
- Click on the “Trust relationships” tab and “Edit trust policy”
- Paste the following to provide the default account with the correct permissions:
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::<DEFAULT ACCOUNT ID>:root"
            },
            "Action": "sts:AssumeRole",
            "Condition": {
                "StringEquals": {
                    "aws:PrincipalArn": "arn:aws:iam::<DEFAULT ACCOUNT ID>:role/ValidationTestRole"
                }
            }
        }
    ]
}
```
#### Default Account

The role and policies required for the default account are set up through the CDK stack.

## How to Write Successful Prompts

With numerous steps and large queries, Browser Use is slow, and each test could take 15-25 minutes to run. To ensure that you do not waste time having to revise your steps, it is crucial to follow good prompt engineering practices:

### Prompt Engineering

If you plan to implement additional tests or use Browser Use in other areas, to write a successful task, there are three important features to follow to create your prompt:

#### 1. Structure

You should follow these steps to structure your tasks accurately:

1. **Steps:** Use numbered steps to split up complex tasks into subtasks
2. **Constraints:** Provide information the model should consider while executing specific steps
3. **Language:** Use capital letters to highlight **RFC2119 Keywords**

The format should follow this structure:
```
## Steps

### 1. <Brief Step 1 description>

More descriptive description of Step 1

**Constraints <Optional>**
- You MUST ensure that ...

### 2. <Brief Step 2 description>

More descriptive description of Step 2

**Constraints <Optional>**
- You MUST ensure that ...

### 3. <...>
```
* For an in-depth example, look at [test-6.script.md](https://github.com/aws-observability/application-signals-demo/blob/ai-validator/libs/tests/test-6.script.md) to understand how to use this structure to create your prompts

#### 2. Parameters

We can include parameters in the Agent object to provide additional information and optimize the model. Below are optional parameters that can be included in your implementation:

* `message_context`: Use this to provide additional information about the task we are performing to help the LLM understand the task better
    * Ex. `message_context="""You are a tester. Your job is to conduct tests."""`
* `extend_system_message`: Use this to add additional instructions to the default system prompt
    * Ex. `extend_system_message= """REMEMBER it is ok if the test fails. When the test result is determined, DO NOT continue steps!!! JUST EXIT!!!"""`

## How To Call Specific Custom Actions

If you need to support functionality that is not currently supported by Browser Use, you must create a new Action. To do this, you can use the following format:

```
@controller.action(
    'Action description'
)
async def new_action():
    ...
    return ActionResult(extracted_content="...")
```

- Define the Action description in the parameter (‘Action description’)
- Directly under this, you can create an async Python function. This logic will be executed when this Action is called by the Agent during execution
- You should use the `ActionResult` object to return information from the Action back to the Agent

To ensure that the Agent accurately calls the correct custom Action, it is most effective to make the Action description identical to the step outlined in your task:

**main.py:**
```
@controller.action(
    'Say hello to the terminal'
)
async def hello_terminal():
    print("Hello terminal")
    return ActionResult(extracted_content="Successfully said hello to the terminal")
```

**test-x.script.md:**
```
## Steps

### 1. Say hello to the terminal

Say hello to the terminal
```

## How To Pass Parameters Into Custom Actions

To increase modularity, it is possible to pass specific parameters into custom Actions. To ensure that the Agent passes the correct parameters into these Actions, you should follow the following steps:

1. Define a new class in your Python script to define the parameters to pass into a custom Action:
```
class TestParameters(BaseModel):
    x: Any
    y: Any
```
- It is important that you use simple variable names (x, y, z) and the Any type to define your variables. This makes it simple for the Agent to understand how to pass parameters into Actions

2. Add the `param_model` parameter to the specific custom Action
```
@controller.action(
    'Description of the action',
    param_model=TestParameters
)
```
3. Update the step in your task to pass specific parameters into this Action
```
## Steps
        
### 1. 'Description of the action'
        
'Description of the action', PASS in x and y as a PARAMETERS.
        
**Constraints:**
- You MUST pass in parameters x and y
```

## How to Write Additional Tests

1. Create a new `test-X.script.md` file in `/libs/tests`
2. Write out each step required for the test
    1. Note: see How to Write Successful Prompts for notes on how to structure steps and call Custom Actions
3. Run `python main.py tests/test-X.script.md` in the console 
