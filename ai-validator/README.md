# AIAssistedAutoTests
This can run tests end-to-end with no user interaction.

We utilize custom Actions to authenticate and federate an AWS link automatically and inject JavaScript code to access metric graphs.

## Quick Start
To try running this on your local machine, ensure that you have at least `ReadOnly` access to the apm-demo1 acccount and run the following commands after cloning the repository:
1. Run `mwinit` to generate new credentials  

2. Run `ada credentials update --account=<apm-demo1_account_id> --provider=isengard --once --role=<Role> --profile=auth-access`
3. Run `ada credentials update --account=<account for Bedrock, S3, CloudWatch> --provider=isengard --once --role=<Role>`
4. Run `pip install browser-use==0.2.5` to install browser-use (we want to remain on version `0.2.5`, but this can be changed in the future)
5. Run `pip install "browser-use[memory]"` to install memory functionality

6. Run `pip install playwright` to install PlayWright
7. `cd libs`
8. Run the file with `python main.py tests/test-x.script.md`

## Environment Variables
To run this project, create a `.env` file in the root directory based on the provided `.env.example`:

```
AWS_REGION=<REGION>
AWS_ACCOUNT_ID=<ACCOUNT_ID>
DEBUG_MODE=<True/False>
S3_BUCKET_NAME=<S3 Bucket Name to store test results>
CLOUDWATCH_NAMESPACE=<CloudWatch namespace to publish metrics>
```

**Note:** The `AWS_ACCOUNT_ID` and `AWS_REGION` should be the ID and region for the account used in Step 3 from "Quick Start".

**Note:** You must create an S3 bucket through the AWS console before.

## Debugging

If you want to view the visual browser UI, comment out the line `headless=True` in the `Browser` object.

To debug in headless mode to save screenshots of each step to your directory, update your `DEBUG_MODE` variable in `.env` to `True`:
`DEBUG_MODE=True`
