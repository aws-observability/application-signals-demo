## ECSStack

### Quick Start
To deploy the CDK stack on your local machine, ensure you are inside this directory, then run the following commands after cloning the repository:
1. Run `npm install` to install all dependencies
2. Generate AWS credentials for the account you want to deploy this stack to
3. Ensure you have `cdk` installed. If not, run `npm install -g aws-cdk`
3. Run `cdk bootstrap` (one time on initial set up)
4. Run `cdk deploy`

### Environment Variables
In the `Dockerfile`, you MUST update the following environment variables:
- `DEFAULT_ACCOUNT_AWS_REGION`: Update this to the region you want to run the stack on (this should match the account in Step 2 in the Quick Start)
- `DEFAULT_AWS_ACCOUNT_ID`: Update this to the account you are deploying to (this should match the account in Step 2 in the Quick Start)
- `DEBUG_MODE`: Set to `True` if you want to save screenshots to S3 for all test runs or `False` if you only want to save screenshots to S3 for failed test runs
- `S3_BUCKET_NAME_PREFIX`: Name of your S3 bucket where screenshots will be saved
- `CLOUDWATCH_NAMESPACE`: Name of your CloudWatch namespace where metrics will be published
- `DEMO_AWS_ACCOUNT_ID`: Update this to the account you run the demo app from
- `DEMO_ROLE_ID`: Update this to the IAM role name in the account that runs the demo app (used to assume role)
- `HEADLESS_MODE`: DO NOT update this variable. It is used to run tests in a headless Chromium browser in ECS
- `MANUAL_MODE`: DO NOT update this variable. It is used to run tests in ECS

### Notes
- `ecs.ts` uses the `DEMO_AWS_ACCOUNT_ID` and `DEMO_ROLE_ID` from your `.env` to assume role. You should ensure to follow [these steps](https://github.com/aws-observability/application-signals-demo/tree/main/ai-validator#environment-variables) to ensure these environent variables are set up (at minimum, `DEMO_AWS_ACCOUNT_ID` and `DEMO_ROLE_ID` should be added to run the stack locally).