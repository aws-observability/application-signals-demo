## Steps

### 1. Click 'Service Map'

In the left panel, under Application Signals, click 'Service Map'.

### 2. Expand all the options to show all nodes

Expand all the options to show all nodes, PASS in "BedrockRuntime" as PARAMETERS.

### 3. Access the node.

Access the node, PASS in "amazon.titan-text-express-v1-5a5ded0f9539010dc308df7c70ef601126010eb8f8e1e10a3435847307de689e" as the PARAMETER.

**Constraints:**
- You MUST pass in parameters 1 and 3

### 4. Wait a few seconds

Wait a few seconds.

### 5. Ensure the avg latency

Ensure that the avg latency is between 8K and 10K ms.

**Constraints:**
- DO NOT call done() if the latency is between 8K and 10K. Continue with the steps.

### 5. Access the node.

Access the node, PASS in "anthropic.claude-v2:1-2a394a60c1aa4cb7cc5af52b5d32279255a82943779dea173fc1743b4e0855f6" as the PARAMETER.

### 6. Wait a few seconds

Wait a few seconds.

### 7. Ensure the avg latency

Ensure that the avg latency is between 10K and 12K ms.

### 8. Click 'customers-service-java'

In the right panel, click the blue 'customers-service-java' hyperlink.

### 9. Access a random graph point.

Access a random graph point, PASS in 1 and 3 as a PARAMETERS. Then wait a few seconds.

**Constraints:**
- You MUST pass in parameters 1 and 3

### 10. Click the blue hexadecimal string

In the right panel, click the first blue hexadecimal string (it should look like this: "...d0f3ab63951df"). Then wait a few seconds.

**Constraints:**
- You MUST ensure that the link you are trying to click is a blue hexadecimal string.
- You MUST ensure the element you are clicking is an <a> tag with aria-label='Trace details for trace ...'

### 11. Scroll injection down

Scroll injection down, PASS in 'ApmXray', '#html' and 1 as PARAMETERS

**Constraints:**
- You MUST pass in parameters 'ApmXray', '#html' and 1
- You MUST use the scrolling() function

### 12. Click 'View in CloudWatch Logs Insights'

Click the 'View in CloudWatch Logs Insights' button in 'Logs'

### 13. Click 'Query Generator'

On the new tab, Click on the blue 'Query Generator' button

**Constraints:**
- You MUST switch to the new tab

### 14. Input 'logs that also contain "What are the best preventive measures for common cat diseases?"'

Input 'logs that also contain "What are the best preventive measures for common cat diseases?"' into the 'Prompt'

### 15. Click 'Update query'

Click on the 'Update query' button. Wait a few seconds.

### 16. Click 'Run query'

Click the 'Run query' button

## 17. Make sure there is one or more logs

Make sure there is one or more logs in the 'Logs' section

## Troubleshooting

### Element Not Found
If any of the tests fail, the test result is failed - use the 'test_result' function and you are done.