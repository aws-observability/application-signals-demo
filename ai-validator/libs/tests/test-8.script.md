## Steps

### 1. Click 'Service Map'

In the left panel, under Application Signals, click 'Service Map'.

### 2. Access the node in the Service Map

Access the node in the Service Map, PASS in "group:AWS::SQS" as the PARAMETER.

**Constraints:**
- You MUST pass in "group:AWS::SQS" as a parameter

### 3. Wait

Wait a few seconds.

### 4. Click bottom link in right panel

Click on the bottom link in the 'Top three paths by error rate' dropdown in the right panel.

### 5. Click 'Dependencies'

Click the 'Dependencies' button.

### 6. Access the graph and open the popup.

Access the graph and open the popup, PASS in 2 and 3 as a PARAMETERS. Then wait a few seconds.

**Constraints:**
- You MUST pass in parameters 2 and 3

### 7. Select the trace ID

Select the trace ID

**Constraints:**
- You MUST use the click_trace_id() function.

### 8. Click the 'Exceptions' button

In the right panel, click the 'Exceptions' button.

### 9. Look for 'Only one PurgeQueue operation on apm_test is allowed every 60 seconds.'.

Look for the message 'Only one PurgeQueue operation on apm_test is allowed every 60 seconds.'.