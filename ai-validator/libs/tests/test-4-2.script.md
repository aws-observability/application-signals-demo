## Steps

1. Click 'Transaction Search'

In the left panel, under Application Signals, click 'Service'.

### 2. Click 'payment-service-dotnet

In the 'Services' section, click the blue 'payment-service-dotnet' hyperlink

### 3. Click 'Service operations'

Click the 'Service operations' button.

### 4. Search for 'Name = GET /owners/{ownerId:int}/pets/{petId:int}/payments'

In the search field under 'Service operations' type 'Name = GET /owners/{ownerId:int}/pets/{petId:int}/payments' and PRESS Enter.

### 5. Access the graph and open the popup.

Access the graph and open the popup, PASS in 2 and 5 as a PARAMETERS. Then wait a few seconds.

**Constraints:**
- You MUST pass in parameters 2 and 5
- You MUST not forget to conduct these steps even though they are similar to the previous

### 6. Type 'attributes.owner.id' again

In the right panel, in the search field with placeholder text 'Choose an attribute', type 'attributes.owner.id' and press ENTER. Then wait a few seconds.

**Constraints:**
- You MUST ensure this search field is in the right panel inside 'Correlated Spans'.
- You MUST ensure that this is under the text 'Group spans by'
- You MUST ensure that you press Enter

### 7. Check there is a row with 'Owner id' = 6

Check that there is a row displayed in the right panel and this has 'Owner id' = 6.

**Constraints:**
- You MUST ensure the rows contain columns 'Owner id' and 'Spans'. If it does not, you need to type 'attributes.owner.id' again.
- You MUST ensure that 'Owner id = 6' is visible. If this is not, the test result is failed.
