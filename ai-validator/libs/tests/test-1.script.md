## Steps

### 1. Click 'Service Level Objectives (SLO)'

In the left panel, under Application Signals, click 'Service Level Objectives (SLO)'.

### 2. Search for 'appointment service availability'

In the search field with placeholder text 'Filter SLOs by text, property or value', type 'appointment service availability' and press Enter.

### 3. Click 'appointment-service-get/FunctionHandler'

Click the hyperlink 'appointment-service-get/FunctionHandler' in the 'Service Level Objectives (SLO)' list in the main panel.

### 4. Click 'Service operations'

Click the 'Service operations' button.

### 5. Access the graph and open the popup.

Access the graph and open the popup, PASS in 2 and 6 as a PARAMETERS.

**Constraints:**
- You MUST pass in parameters 2 and 6

### 6. Click 'Top Contributors'

In the right panel, click the 'Top Contributors' tab.

### 7. Select 'Versions'

In the dropdown where it says 'Aliases', select the 'Versions' dropdown. Then wait a few seconds.

### 8. Check top row is only row that contains non-zero 'Faults'

In the right panel, check that the top row is the only row that contains non-zero 'Faults'

### 9. Click 'Correlated Spans'

In the right panel, click the 'Correlated Spans' tab

### 10. Click the blue hexadecimal string

In the right panel, click the first blue hexadecimal string under 'Trace ID' (it should look like this: "...d0f3ab63951df"). Then wait a few seconds.

**Constraints:**
- You MUST ensure that the link you are trying to click is a blue hexadecimal string.
- You MUST ensure the element you are clicking is an <a> tag with aria-label='Trace details for trace ...'

### 11. Click 'Exceptions' button 

On the new page, in the right panel, click the 'Exceptions' button.

### 12. Look for 'Fail to parse the request. Cause: NullPointerException'.

Look for the message 'Fail to parse the request. Cause: NullPointerException'.

### 13. Go back

Go back a page in the browser.

**Constraints:**
- You MUST ensure that you go back in the browser. This is a step.

### 14. Access a random graph point.

Access a random graph point, PASS in 0 and 1 as a PARAMETERS. Then wait a few seconds.

**Constraints:**
- You MUST pass in parameters 0 and 1

### 15. Type 'attributes.owner.id'

In the right panel, in the search field with placeholder text 'Choose an attribute', type 'attributes.owner.id' and press ENTER. Then wait a few seconds.

**Constraints:**
- You MUST ensure this search field is in the right panel inside 'Correlated Spans'.
- You MUST ensure that this is under the text 'Group spans by'
- You MUST ensure that you press Enter

### 16. Check there is more than one row displayed.

Check that there is more than one row displayed in the right panel.

**Constraints:**
- You MUST ensure the rows contain columns 'Owner id' and 'Spans'. If it does not, you need to type 'attributes.owner.id' again.

### 17. Click 'X'

Click the "X" button inside the blue box labeled "Requests DATE TIME" (Ex. 'Requests 2025/06/18 18:10:00') in the top-right corner of the "Requests and Availability" chart. If the next step fails, try to do this again.

### 18. Access the graph and open the popup.

Access the graph and open the popup, PASS in 2 and 6 as a PARAMETERS. Then wait a few seconds.

If this fails, try to click 'X' again (try step 17 again)

**Constraints:**
- You MUST pass in parameters 2 and 6
- You MUST not forget to conduct these steps even though they are similar to the previous

### 19. Type 'attributes.owner.id' again

In the right panel, in the search field with placeholder text 'Choose an attribute', type 'attributes.owner.id' and press ENTER. Then wait a few seconds.

**Constraints:**
- You MUST ensure this search field is in the right panel inside 'Correlated Spans'.
- You MUST ensure that this is under the text 'Group spans by'
- You MUST ensure that you press Enter

### 20. Check there is more than one row displayed again.

Check that there is more than one row displayed in the right panel.

**Constraints:**
- You MUST ensure the rows contain columns 'Owner id' and 'Spans'. If it does not, you need to type 'attributes.owner.id' again.