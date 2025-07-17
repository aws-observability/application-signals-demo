## Steps

### 1. Click 'Services'

In the left panel, under Application Signals, click 'Services'.

### 2. Search for 'TicketingSystem'

In the search field with placeholder text 'Filter services and resources by text, property or value', type 'TicketingSystem' and press Enter.

**Constraints:**
- You MUST press Enter after entering this text

### 3. Click 'TicketingSystem'

Click the 'Name' hyperlink 'TicketingSystem' in the 'Services' list in the main panel.

### 4. Click 'Service operations'

Click the 'Service operations' button.

### 5. Search for 'Name = TicketingSystem/LambdaService'

In the search field under 'Service operations' type 'Name = TicketingSystem/LambdaService' and PRESS Enter.

### 6. Access the graph and open the popup.

Access the graph and open the popup, PASS in 1 and 4 as a PARAMETERS. Then wait a few seconds.

**Constraints:**
- You MUST pass in parameters 1 and 4

### 7. Select the trace ID

Select the trace ID

**Constraints:**
- You MUST use the click_trace_id() function.

### 8. Scroll injection down

Scroll injection down, PASS in 'ApmXray', '#html' and 1 as PARAMETERS

**Constraints:**
- You MUST pass in parameters 'ApmXray', '#html' and 1
- You MUST use the scrolling() function

### 9. Ensure 'Init' duration is greater than 1 second

In the 'Spans timeline' section, make sure that the 'Duration' for the 'Init' row is greater than 1 second.