"""
Automated end-to-end implementation for tests (from the APM demo status tracking) using Bedrock Claude 3.7 Sonnet.

@dev Ensure AWS environment variables are set correctly for Console (Bedrock and CloudWatch) access.
"""

import time
import base64
import asyncio
import os
import sys
import requests
import urllib.parse
import json
import re

from botocore.config import Config
from boto3.session import Session
from langchain_aws import ChatBedrockConverse
from browser_use.browser.context import BrowserContext
from pydantic import BaseModel
from typing import Any
from browser_use.controller.service import Controller
from browser_use import ActionResult, Agent, BrowserSession, BrowserProfile
from dotenv import load_dotenv
from langchain_core.rate_limiters import InMemoryRateLimiter
from browser_use.agent.memory import MemoryConfig
from datetime import datetime
from pathlib import Path

# Load environment variables
load_dotenv()
region = os.environ['AWS_REGION']
account_id = os.environ['AWS_ACCOUNT_ID']
debug_mode = os.environ['DEBUG_MODE'].lower() == 'true'
bucket_name = os.environ['S3_BUCKET_NAME']
cloudwatch_namespace = os.environ['CLOUDWATCH_NAMESPACE']

test_failed = False

model_id = "us.anthropic.claude-3-7-sonnet-20250219-v1:0"

# Disable browser-use's built-in LLM API-key check
os.environ["SKIP_LLM_API_KEY_VERIFICATION"] = "True"
os.environ["ANONYMIZED_TELEMETRY"] = "false"

prefix = """# Test

## Overview

You are a tester and need to determine if the given test passed or failed with the steps below. If you make it to the end, the test result is passed. If ANY of these steps fail, the test result is failed. Use the 'test_result' function for this. If this test fails, the task is COMPLETE. DO NOT conduct more steps!!!

"""

end = """

## Troubleshooting

### Element Not Found
If any of the tests fail, the test result is failed - use the 'test_result' function and you are done.
"""

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

controller = Controller()

class PositionParameters(BaseModel):
     x: Any # chartPosition
     y: Any # checkboxPosition

class ThresholdParameters(BaseModel):
    x: Any # chartPosition
    y: Any # checkboxPosition
    z: bool # checkZero

class TestResult(BaseModel):
    x: bool # result

class NodeId(BaseModel):
    a: Any # nodeId

class ScrollingParameters(BaseModel):
     x: Any # iframeId
     y: Any # elementId
     z: Any # scrollTimes

@controller.action(
    'Access the graph and open the popup',
    param_model=PositionParameters
)
async def click_graph_spike(params: PositionParameters, browser: BrowserContext):
    page = await browser.get_current_page()

    js_file_path = os.path.join(os.path.dirname(
        __file__), "jsInjectionScripts", "clickMaxGraphPoint.js")
    with open(js_file_path, 'r') as file:
        js_code = file.read()

    args = {
        "chartPosition": int(params.x),
        "checkboxPosition": int(params.y)
    }

    logs = await page.evaluate(f"""
        (args) => {{
            {js_code}
            return clickMaxGraphPoint(args.chartPosition, args.checkboxPosition);
        }}
        """, args)
    return ActionResult(extracted_content=logs, include_in_memory=False)

@controller.action(
    'Access a random graph point',
    param_model=PositionParameters
)
async def click_random_graph(params: PositionParameters, browser: BrowserContext):
    page = await browser.get_current_page()

    js_file_path = os.path.join(os.path.dirname(
        __file__), "jsInjectionScripts", "clickRandomGraphPoint.js")
    with open(js_file_path, 'r') as file:
        js_code = file.read()

    args = {
        "chartPosition": int(params.x),
        "checkboxPosition": int(params.y)
    }

    logs = await page.evaluate(f"""
        (args) => {{
            {js_code}
            return clickRandomGraphPoint(args.chartPosition, args.checkboxPosition);
        }}
        """, args)
    return ActionResult(extracted_content=logs, include_in_memory=False)

@controller.action(
    'Check all points are above the threshold',
    param_model=ThresholdParameters
)
async def check_all_points_above_threshold(params: ThresholdParameters, browser: BrowserContext):
    page = await browser.get_current_page()

    js_file_path = os.path.join(os.path.dirname(
        __file__), "jsInjectionScripts", "checkAllPointAboveThreshold.js")
    with open(js_file_path, 'r') as file:
        js_code = file.read()

    args = {
        "chartPosition": int(params.x),
        "checkboxPosition": int(params.y),
        "checkZero": params.z,
    }

    logs = await page.evaluate(f"""
        async (args) => {{
            {js_code}
            return await checkAllPointAboveThreshold(args.chartPosition, args.checkboxPosition, args.checkZero);
        }}
    """, args)
    if logs:
        return ActionResult(extracted_content="The datapoints are above the threshold.", include_in_memory=False)
    else:
        return ActionResult(extracted_content="The datapoints are NOT above the threshold. This test has failed.", include_in_memory=False)

@controller.action(
    'Test result status',
    param_model=TestResult
)
async def test_result(params: TestResult):
    global test_failed
    if not params.x:
        test_failed = True

    session = Session()
    cloudwatch = session.client('cloudwatch', region_name=region)

    metric_name = "Failure"

    cloudwatch.put_metric_data(
        Namespace=cloudwatch_namespace,
        MetricData=[
            {
                "MetricName": metric_name,
                "Dimensions": [
                    {
                        "Name": "Language",
                        "Value": "Python"
                    },
                    {
                        "Name": "Source",
                        "Value": "Local"
                    }
                ],
                "Value": 0.0 if params.x else 1.0,
            }
        ]
    )
    print(f"Published metric: {metric_name} in namespace {cloudwatch_namespace} as {'0.0' if params.x else '1.0'}")
    return ActionResult(extracted_content="The task is COMPLETE - you can EXIT now. DO NOT conduct anymore steps!!!", is_done=True)


@controller.action(
    'Access the node in the Service Map',
    param_model=NodeId
)
async def access_node(params: NodeId, browser: BrowserContext):
    page = await browser.get_current_page()

    js_file_path = os.path.join(os.path.dirname(
        __file__), "jsInjectionScripts", "clickNode.js")
    with open(js_file_path, 'r') as file:
        js_code = file.read()

    args = {
        "nodeId": params.a
    }

    logs = await page.evaluate(f"""
        (args) => {{
            {js_code}
            return clickNode(args.nodeId);
        }}
        """, args)
    return ActionResult(extracted_content=logs, include_in_memory=True, is_done=False)

@controller.action(
    'Expand all the options to show all nodes',
    param_model=NodeId
)
async def expand_node_dropdown(params: NodeId, browser: BrowserContext):
    page = await browser.get_current_page()

    js_file_path = os.path.join(os.path.dirname(
        __file__), "jsInjectionScripts", "expandServiceMapNode.js")
    with open(js_file_path, 'r') as file:
        js_code = file.read()

    args = {
        "nodeId": params.a
    }

    logs = await page.evaluate(f"""
        (args) => {{
            {js_code}
            return expandServiceMapNode(args.nodeId);
        }}
        """, args)
    return ActionResult(extracted_content=logs, include_in_memory=True)

@controller.action(
    'Scroll injection down',
    param_model=ScrollingParameters
)
async def scrolling(params: ScrollingParameters, browser: BrowserContext):
    page = await browser.get_current_page()

    js_file_path = os.path.join(os.path.dirname(
        __file__), "jsInjectionScripts", "scrollDown.js")
    with open(js_file_path, 'r') as file:
        js_code = file.read()

    args = {
        "iframeId": params.x,
        "elementId": params.y,
        "scrollTimes": int(params.z)
    }

    logs = await page.evaluate(f"""
        (args) => {{
            {js_code}
            return scrollDown(args.iframeId, args.elementId, args.scrollTimes);
        }}
        """, args)
    return ActionResult(extracted_content=logs, include_in_memory=False)

def get_llm(modelID):
    session = Session()

    config = Config(
        read_timeout=60*5,
        retries={'max_attempts': 10, 'mode': 'adaptive'}
    )
    bedrock_client = session.client(
        'bedrock-runtime', region_name=region, config=config)

    rate_limiter = None
    # rate_limiter = InMemoryRateLimiter(
    #     requests_per_second=0.015,
    #     check_every_n_seconds=0.05,
    #     max_bucket_size=10,
    # )

    return ChatBedrockConverse(
        model_id=f'arn:aws:bedrock:{region}:{account_id}:inference-profile/{modelID}',
        temperature=0.0,
        max_tokens=None,
        client=bedrock_client,
        provider='Antropic',
        cache=False,
        rate_limiter=rate_limiter
    )

def authentication_open():
    session = Session(profile_name='auth-access')
    creds = session.get_credentials().get_frozen_credentials()

    session_dict = {
        "sessionId": creds.access_key,
        "sessionKey": creds.secret_key,
        "sessionToken": creds.token,
    }

    session_json = urllib.parse.quote(json.dumps(session_dict))
    signin_token_url = f"https://signin.aws.amazon.com/federation?Action=getSigninToken&Session={session_json}"
    signin_token_response = requests.get(signin_token_url)
    signin_token = signin_token_response.json()["SigninToken"]

    destination = "https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#home:"
    login_url = (
        "https://signin.aws.amazon.com/federation"
        f"?Action=login"
        f"&Issuer=my-script"
        f"&Destination={urllib.parse.quote(destination)}"
        f"&SigninToken={signin_token}"
    )

    return login_url

async def main():
    startTime = time.time()
    # Get test prompt file
    file_path = sys.argv[1]
    file_name = Path(file_path).name
    match = re.match(r'test-(.+?)\.script\.md', file_name)
    test_id = match.group(1) if match else "unknown"

    with open(file_path, "r", encoding="utf-8") as file:
        original_task = file.read()

    task = prefix + original_task + end

    llm = get_llm(model_id)
    authenticated_url = authentication_open()

    browser_profile = BrowserProfile(
		headless=True,
        wait_between_actions=10.0,
        minimum_wait_page_load_time=10.0,
        chromium_sandbox=False
	)

    browser_session = BrowserSession(
        browser_profile=browser_profile,
        viewport={'width': 2560, 'height': 1440},
    )

    initial_actions = [
        {'open_tab': {'url': authenticated_url}}
    ]

    agent = Agent(
        task=task,
        initial_actions=initial_actions,
        llm=llm,
        controller=controller,
        browser_session=browser_session,
        validate_output=True,
        extend_system_message="""REMEMBER it is ok if the test fails. When the test result is determined, DO NOT continue steps!!! JUST EXIT!!!""",
        enable_memory=False,
        # memory_config=MemoryConfig(
        #     llm_instance=llm,
        #     agent_id="my_custom_agent",
        #     memory_interval=30
        # ),
        save_conversation_path="../logs/conversation",
    )

    history = await agent.run(max_steps=70)

    session = Session()
    s3_client = session.client('s3', region_name=region)

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    s3_prefix = f"screenshots/test-{test_id}/{timestamp}/"

    if debug_mode or test_failed:
        for i, screenshot in enumerate(history.screenshots()):
            screenshot_data = base64.b64decode(screenshot)
            s3_key = f"{s3_prefix}screenshot_{i}.png"

            s3_client.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=screenshot_data,
                ContentType="image/png"
            )
    await browser_session.close()
    endTime = time.time()
    print(f"Time taken: {endTime - startTime} seconds")

asyncio.run(main())
