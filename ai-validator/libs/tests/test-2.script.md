## Steps

### 1. Click 'Service Level Objectives (SLO)'

In the left panel, under Application Signals, click 'Service Level Objectives (SLO)'.

### 2. Search for 'Latency of billing activities'

In the search field with placeholder text 'Filter SLOs by text, property or value', type 'Latency of billing activities' and press Enter.

**Constraints:**
- You MUST ensure you press Enter.

### 3. Check all points are above the threshold.

Check all points are above the threshold, PASS in 2, 3, and false as a PARAMETERS.

**Constraints:**
- You MUST pass in parameters 2, 3, and false

### 4. Click 'GET ^billings/$'

Click the hyperlink 'GET ^billings/$' in the 'Service Level Objectives (SLO)' list in the main panel.

### 5. Click 'Dependencies'

Click the 'Dependencies' button.

### 6. Select 'GET ^billings/$'

In the 'Show Dependencies for operation:' dropdown where it says 'All', select the 'GET ^billings/$' dropdown. Then wait a few seconds.

### 7. Access a random graph point.

Access a random graph point, PASS in 1 and 5 as a PARAMETERS. Then wait a few seconds.

**Constraints:**
- You MUST pass in parameters 1 and 5

### 8. Click 'View in Database Insights'

In the right panel, click the hyperlink 'View in Database Insights'.

### 9. Switch tabs

Switch to the new tab that was just opened.

### 10. Click 'Database instance'

On the new page, under the 'Database Views' dropdown, click 'Database Instance'

### 11. Select the radio button for the first item inside 'Top SQL'

Click the `<input type="radio">` element that belongs to the first selectable item in the 'Top SQL' section.

### 12. Check that the 'SQL Text' is displayed

Check that the following text is shown under 'SQL Text': SELECT "billing_service_billing"."id", "billing_service_billing"."owner_id", "billing_service_billing"."type", "billing_service_billing"."type_name", "billing_service_billing"."pet_id", "billing_service_billing"."payment", "billing_service_billing"."status" FROM "billing_service_billing" WHERE NOT ("billing_service_billing"."type_name" IN (SELECT DISTINCT U0."invalid_name" FROM "check_list" U0 LIMIT ?))

### 13. Click 'Database Telemetry'

Click the 'Database Telemetry' tab.

### 14. Click 'Slow SQL Queries'

Click the 'Slow SQL Queries' tab. Wait a few seconds

### 15. Click the first row in "Slow query patterns"

Click the first row in "Slow query patterns" 

### 16. Check for stats in each column

In the right panel make sure that there are statistics for each column (Count, Duration avg., Duration p50, ...)

**Constraints:**
- You MUST ensure you are looking at the right panel labelled 'Slow queries' for these statistics.

### 17. Click 'Calling Services'

Click the 'Calling Services' tab

### 18. Check there is more than one row displayed.

Check that there is more than one row displayed under 'Calling services and operations'.