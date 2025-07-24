## ECSStack

### Quick Start
To deploy the CDK stack on your local machine, ensure you are inside this directory, then run the following commands after cloning the repository:
1. Run `npm install` to install all dependencies
2. Generate AWS credentials for the account you want to deploy this stack to
3. Ensure you have `cdk` installed. If not, run `npm install -g aws-cdk`
3. Run `cdk bootstrap` (one time on initial set up)
4. Run `cdk deploy`

### Environment Variables
Please follow the [`.env` setup](https://github.com/aws-observability/application-signals-demo/tree/main/ai-validator#environment-variables) to set up all of your environment variables. Although most of these will be used to run the project locally, you MUST also paste these into the [`Dockerfile`](https://github.com/aws-observability/application-signals-demo/tree/main/ai-validator/cdk/Dockerfile#L31) (with the exception of `HEADLESS_MODE` and `MANUAL_MODE` - please see below).

- `HEADLESS_MODE`: DO NOT update this variable. It is used to run tests in a headless Chromium browser in ECS
- `MANUAL_MODE`: DO NOT update this variable. It is used to run tests in ECS

### Notes
- `ecs.ts` directly uses the `DEMO_AWS_ACCOUNT_ID`, `DEMO_ROLE_ID`, and `CLOUDWATCH_NAMESPACE` from your `.env`, so you MUST set up a `.env` file with these environment variables. However, it is best practice to set all the environment variables if you ever want to test the project locally. 