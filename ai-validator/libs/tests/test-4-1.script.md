## Steps

### 1. Click 'Transaction Search'

In the left panel, under Application Signals, click 'Transaction Search'.

### 2. Input values

In the input with placeholder text 'Search spans by pasting, selecting from properties or using refiners, type the following and press ENTER after each: 'attributes.owner.id=6', 'attributes.http.response.status_code=400', 'attributes.aws.local.service=payment-service-dotnet', 'name=POST /owners'

**Constraints:**
- You MUST ensure that you press Enter after each input

### 3. Set search period to 1 day

In the right corner, click the 'Custom' button then click '1' next to the 'Days' row

### 4. Click 'Run query'

Click the 'Run query' button then wait 20 seconds

### 5. Click the arrow in the first row

Click the arrow in the first row under 'Spans'

### 6. Find 'attributes.order.id'

Find the 'attributes.order.id' in this span and store the value of this.

### 7. Click 'Clear filters'

Click the 'Clear filters' button

### 8. Type the saved value

In the input with placeholder text 'Search spans by pasting, selecting from properties or using refiners', type "attributes.order.id=<SAVED VALUE>" and press ENTER. Note that the index you were using before may have updated

**Constraints:**
- You MUST ensure that you press Enter

### 9. Click 'Run query'

Click the 'Run query' button. Note that the index you were using before may have updated

### 10. Click the first traceId

Click the first traceId in the 'Spans' section

### 11. Wait 10 seconds

Wait 10 seconds then proceed to the next step

### 12. Switch tabs

Switch to the new tab that was just opened.

### 13. Scroll injection down

Scroll injection down, PASS in 'ApmXray', '#html' and 1 as PARAMETERS

**Constraints:**
- You MUST pass in parameters 'ApmXray', '#html' and 1
- You MUST use the scrolling() function 

### 14. Click 'View exception'.

Click the 'View exception' blue button in the customers-service-java' row

**Constraints:**
- You MUST ensure that this 'View exception' button is in the 'customers-service-java' row

### 15. Look for nutrition fact not found for the given pet_type'.

Look for the message 'nutrition fact not found for the given pet_type'.

### 16. Close this tab

Close this tab and wait a few seconds.

### 17. Click 'payment-service-dotnet

In the 'Spans' section, click the blue 'payment-service-dotnet' hyperlink under the 'service' column

### 18. Switch tabs

Switch to the new tab that was just opened

### 19. Click 'Service operations'

Click the 'Service operations' button.

### 20. Access a random graph point.

Access a random graph point, PASS in 0 and 1 as a PARAMETERS. Then wait a few seconds.

**Constraints:**
- You MUST pass in parameters 0 and 1

### 21. Type 'attributes.owner.id'

In the right panel, in the search field with placeholder text 'Choose an attribute', type 'attributes.owner.id' and press ENTER. Then wait a few seconds.

**Constraints:**
- You MUST ensure this search field is in the right panel inside 'Correlated Spans'.
- You MUST ensure that this is under the text 'Group spans by'
- You MUST ensure that you press Enter

### 22. Check there is more than one row displayed.

Check that there is more than one row displayed in the right panel.

**Constraints:**
- You MUST ensure the rows contain columns 'Owner id' and 'Spans'. If it does not, you need to type 'attributes.owner.id' again.
