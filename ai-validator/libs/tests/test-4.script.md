## Steps

### 1. Click 'Transaction Search'

In the left panel, under Application Signals, click 'Transaction Search'.

### 2. Input values

In the input with placeholder text 'Search spans by pasting, selecting from properties or using refiners, type the following and press ENTER after each: 'attributes.owner.id=6', 'attributes.http.response.status_code=400', 'attributes.aws.local.service=payment-service-dotnet', 'attributes.aws.local.environment=eks:demo/default', 'name=POST /owners'

**Constraints:**
- You MUST ensure that you press Enter after each input

### 3. Click 'Run query'

Click the 'Run query' button

### 4. Click the arrow in the first row

Click the arrow in the first row under 'Spans'

### 5. Find 'attributes.order.id'

Find the 'attributes.order.id' in this span and store the value of this.

### 6. Click 'Clear filters'

Click the 'Clear filters' button

### 7. Type the saved value

In the input with placeholder text 'Search spans by pasting, selecting from properties or using refiners', type "attributes.order.id=<SAVED VALUE>" and press ENTER. Note that the index you were using before may have updated

**Constraints:**
- You MUST ensure that you press Enter

### 8. Click '12h'

In the right corner, click '12h'

### 9. Click 'Run query'

Click the 'Run query' button. Note that the index you were using before may have updated

### 10. Click the first traceId

Click the first traceId in the 'Spans' section

### 11. Switch tabs

Switch to the new tab that was just opened.

### 12. Scroll injection down

Scroll injection down, PASS in 'ApmXray', '#html' and 1 as PARAMETERS

**Constraints:**
- You MUST pass in parameters 'ApmXray', '#html' and 1
- You MUST use the scrolling() function 

### 13. Click 'View exception'.

Click the 'View exception' blue button in the customers-service-java' row

**Constraints:**
- You MUST ensure that this 'View exception' button is in the 'customers-service-java' row

### 14. Look for nutrition fact not found for the given pet_type'.

Look for the message 'nutrition fact not found for the given pet_type'.

### 15. Close this tab

Close this tab and wait a few seconds.

### 16. Click 'payment-service-dotnet

In the 'Spans' section, click the blue 'payment-service-dotnet' hyperlink under the 'service' column

### 17. Switch tabs

Switch to the new tab that was just opened

### 18. Click 'Service operations'

Click the 'Service operations' button.

### 19. Access a random graph point.

Access a random graph point, PASS in 0 and 1 as a PARAMETERS. Then wait a few seconds.

**Constraints:**
- You MUST pass in parameters 0 and 1

### 20. Type 'attributes.owner.id'

In the right panel, in the search field with placeholder text 'Choose an attribute', type 'attributes.owner.id' and press ENTER. Then wait a few seconds.

**Constraints:**
- You MUST ensure this search field is in the right panel inside 'Correlated Spans'.
- You MUST ensure that this is under the text 'Group spans by'
- You MUST ensure that you press Enter

### 21. Check there is more than one row displayed.

Check that there is more than one row displayed in the right panel.

**Constraints:**
- You MUST ensure the rows contain columns 'Owner id' and 'Spans'. If it does not, you need to type 'attributes.owner.id' again.

### 22. Click 'X'

Click the "X" button inside the blue tooltip box labeled "Requests DATE TIME" (Ex. 'Requests 2025/06/18 18:10:00') in the top-right corner of the "Requests and Availability" chart. If the next step fails, try to do this again.

### 23. Access the graph and open the popup.

Access the graph and open the popup, PASS in 2 and 5 as a PARAMETERS. Then wait a few seconds.

If this fails, try to click 'X' again

**Constraints:**
- You MUST pass in parameters 2 and 5
- You MUST not forget to conduct these steps even though they are similar to the previous

### 24. Type 'attributes.owner.id' again

In the right panel, in the search field with placeholder text 'Choose an attribute', type 'attributes.owner.id' and press ENTER. Then wait a few seconds.

**Constraints:**
- You MUST ensure this search field is in the right panel inside 'Correlated Spans'.
- You MUST ensure that this is under the text 'Group spans by'
- You MUST ensure that you press Enter

### 25. Check there is a row with 'Owner id' = 6

Check that there is a row displayed in the right panel and this has 'Owner id' = 6.

**Constraints:**
- You MUST ensure the rows contain columns 'Owner id' and 'Spans'. If it does not, you need to type 'attributes.owner.id' again.
- You MUST ensure that 'Owner id = 6' is visible. If this is not, the test result is failed.
