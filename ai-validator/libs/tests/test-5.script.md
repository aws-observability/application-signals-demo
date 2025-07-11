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

### 5. Search for 'Name = TicketingSystem/FunctionHandlers'

In the search field under 'Service operations' type 'Name = TicketingSystem/FunctionHandler' and PRESS Enter.

### 6. Access the graph and open the popup.

Access the graph and open the popup, PASS in 1 and 2 as a PARAMETERS. Then wait a few seconds.

**Constraints:**
- You MUST pass in parameters 1 and 2

### 7. Click the hexadecimal string

In the right panel, locate and click the first <a> tag that satisfies ALL of the following:

- Tag check: The element must be an actual <a> HTML tag in the DOM (not visually inferred).
- Attribute check: The aria-label must start with "Trace details for trace " and end with a valid 32-character lowercase hexadecimal string.
- Text check: The inner text of the <a> must exactly match the hexadecimal string found at the end of the aria-label.
- Index check: Log the exact index of the matching element (e.g., index [145]). Only click if all of the above conditions are satisfied.

**Constraints:**
- DO NOT rely on visual layout or placement
- DO NOT click any adjacent or surrounding <button> or <div> elements
- Use the actual HTML tag and attribute inspection from the DOM to determine correctness

### 8. Scroll injection down

Scroll injection down, PASS in 'ApmXray', '#html' and 1 as PARAMETERS

**Constraints:**
- You MUST pass in parameters 'ApmXray', '#html' and 1
- You MUST use the scrolling() function

### 9. Ensure 'Init' duration is greater than 1 second

In the 'Spans timeline' section, make sure that the 'Duration' for the 'Init' row is greater than 1 second.