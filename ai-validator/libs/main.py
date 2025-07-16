"""
Automated end-to-end implementation for tests using Bedrock Claude 3.7 Sonnet.

@dev Ensure AWS environment variables are set correctly for Console (Bedrock, CloudWatch, S3) access.
"""

import time
import asyncio
import os
import sys

from boto3.session import Session
from browser_use.browser.context import BrowserContext
from pydantic import BaseModel
from typing import Any
from browser_use.controller.service import Controller
from browser_use import ActionResult, Agent, BrowserSession, BrowserProfile
from dotenv import load_dotenv
from pathlib import Path
from uuid import uuid4

# Add util functions from /utils/utils.py
from utils.utils import *

# Load environment variables
load_dotenv()
debug_mode = os.environ['DEBUG_MODE'].lower() == 'true'
headless_mode = os.environ['HEADLESS_MODE'].lower() == 'true'

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

    args = {
        "chartPosition": int(params.x),
        "checkboxPosition": int(params.y)
    }

    logs = await evaluate_js(page, js_file="clickMaxGraphPoint.js", function_call="clickMaxGraphPoint(args.chartPosition, args.checkboxPosition)", args=args)
    return ActionResult(extracted_content=logs, include_in_memory=False)

@controller.action(
    'Access a random graph point',
    param_model=PositionParameters
)
async def click_random_graph(params: PositionParameters, browser: BrowserContext):
    page = await browser.get_current_page()

    args = {
        "chartPosition": int(params.x),
        "checkboxPosition": int(params.y)
    }

    logs = await evaluate_js(page, js_file="clickRandomGraphPoint.js", function_call="clickRandomGraphPoint(args.chartPosition, args.checkboxPosition)", args=args)
    return ActionResult(extracted_content=logs, include_in_memory=False)

@controller.action(
    'Check all points are above the threshold',
    param_model=ThresholdParameters
)
async def check_all_points_above_threshold(params: ThresholdParameters, browser: BrowserContext):
    page = await browser.get_current_page()

    args = {
        "chartPosition": int(params.x),
        "checkboxPosition": int(params.y),
        "checkZero": params.z,
    }

    logs = await evaluate_js(page, js_file="checkAllPointAboveThreshold.js", function_call="checkAllPointAboveThreshold(args.chartPosition, args.checkboxPosition, args.checkZero)", args=args, is_async=True)
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
    return ActionResult(extracted_content="The task is COMPLETE - you can EXIT now. DO NOT conduct anymore steps!!!", is_done=True)

@controller.action(
    'Access the node in the Service Map',
    param_model=NodeId
)
async def access_node(params: NodeId, browser: BrowserContext):
    page = await browser.get_current_page()

    args = {
        "nodeId": params.a
    }

    logs = await evaluate_js(page, js_file="clickNode.js", function_call="clickNode(args.nodeId)", args=args)
    return ActionResult(extracted_content=logs, include_in_memory=True, is_done=False)

@controller.action(
    'Expand all the options to show all nodes',
    param_model=NodeId
)
async def expand_node_dropdown(params: NodeId, browser: BrowserContext):
    page = await browser.get_current_page()

    args = {
        "nodeId": params.a
    }

    logs = await evaluate_js(page, js_file="expandServiceMapNode.js", function_call="expandServiceMapNode(args.nodeId)", args=args)
    return ActionResult(extracted_content=logs, include_in_memory=True)

@controller.action(
    'Scroll injection down',
    param_model=ScrollingParameters
)
async def scrolling(params: ScrollingParameters, browser: BrowserContext):
    page = await browser.get_current_page()

    args = {
        "iframeId": params.x,
        "elementId": params.y,
        "scrollTimes": int(params.z)
    }

    logs = await evaluate_js(page, js_file="scrollDown.js", function_call="scrollDown(args.iframeId, args.elementId, args.scrollTimes)", args=args)
    return ActionResult(extracted_content=logs, include_in_memory=False)

@controller.action(
    'Select the blue hexadecimal'
)
async def click_hexadecimal(browser: BrowserContext):
    page = await browser.get_current_page()
    logs = await evaluate_js(page, js_file="clickHexadecimal.js", function_call="clickHexadecimal()")

    return ActionResult(extracted_content=logs, include_in_memory=False)

async def main():
    # Get test prompt file
    file_path = sys.argv[1]
    file_name = Path(file_path).name
    test_id = file_name.replace(".script.md", "")

    with open(file_path, "r", encoding="utf-8") as file:
        original_task = file.read()

    # Create prompt
    task = prefix + original_task + end

    startTime = time.time()

    global test_failed
    test_failed = False

    # Get LLM model
    llm = get_llm(model_id)

    # Generate federated AWS link
    authenticated_url = authentication_open()

    unique_profile_path = Path.home() / f".config/browseruse/profiles/{uuid4().hex[:8]}"

    browser_profile = BrowserProfile(
        user_data_dir=unique_profile_path,
        headless=headless_mode,
        wait_between_actions=10.0,
        minimum_wait_page_load_time=10.0,
        chromium_sandbox=False
    )

    browser_session = BrowserSession(
        browser_profile=browser_profile,
        viewport={'width': 2560, 'height': 1440},
    )

    # We do not need the LLM to generate the URL, so conduct this step before initialization
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
    )

    history = await agent.run(max_steps=70)

    session = Session()

    # Publish a metric to CloudWatch for the test
    publish_metric(test_failed, test_id, session)

    # If debug_mode is True or this test failed, save the screenshots to S3
    if debug_mode or test_failed:
        upload_s3(history.screenshots(), test_id, session)

    await browser_session.close()
    endTime = time.time()
    print(f"Time taken: {endTime - startTime} seconds", flush=True)


asyncio.run(main())
