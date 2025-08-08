## Steps

### 1. Click 'Services'

In the left panel, under Application Signals, click 'Services'.

### 2. Search for 'payment-service-dotnet'

In the search field with placeholder text 'Filter services and resources by text, property or value', type 'payment-service-dotnet' and press Enter.

**Constraints:**
- You MUST press Enter after entering this text

### 3. Click 'payment-service-dotnet'

Click the hyperlink 'payment-service-dotnet' in the 'Services' list in the main panel.

### 4. Click 'Service operations'

Click the 'Service operations' button.

### 5. Search for 'Name = GET /owners/{ownerId:int}/pets/{petId:int}/payments'

In the search field under 'Service operations' type 'GET /owners/{ownerId:int}/pets/{petId:int}/payments' and PRESS Enter.

### 6. Access the graph and open the popup.

Access the graph and open the popup, PASS in 2 and 5 as a PARAMETERS. Then wait a few seconds.

**Constraints:**
- You MUST pass in parameters 2 and 5

### 7. Type 'attributes.owner.id'

In the right panel, in the search field with placeholder text 'Choose an attribute', type 'attributes.owner.id' and press ENTER. Then wait a few seconds.

**Constraints:**
- You MUST ensure this search field is in the right panel inside 'Correlated Spans'.
- You MUST ensure that this is under the text 'Group spans by'
- You MUST ensure that you press Enter

### 8. Check there is at least one row displayed.

Check that there is at least one row displayed in the right panel.

### 9. Click 'Clear filters'

Click the 'Clear filters' button

### 10. Search for 'Name = POST /owners/{ownerId:int}/pets/{petId:int}/payments/'

In the search field under 'Service operations' type 'POST /owners/{ownerId:int}/pets/{petId:int}/payments/' and PRESS Enter.

### 11. Access the graph and open the popup.

Access the graph and open the popup, PASS in 2 and 5 as a PARAMETERS. Then wait a few seconds.

**Constraints:**
- You MUST pass in parameters 2 and 5

### 12. Type 'attributes.owner.id'

In the right panel, in the search field with placeholder text 'Choose an attribute', type 'attributes.owner.id' and press ENTER. Then wait a few seconds.

**Constraints:**
- You MUST ensure this search field is in the right panel inside 'Correlated Spans'.
- You MUST ensure that this is under the text 'Group spans by'
- You MUST ensure that you press Enter

### 13. Check there is at least one row displayed.

Check that there is at least one row displayed in the right panel.

**Constraints:**
- You MUST ensure the rows contain columns 'Owner id' and 'Spans'. If it does not, you need to type 'attributes.owner.id' again.