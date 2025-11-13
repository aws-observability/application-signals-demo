## Steps

### 1. Navigate to CloudWatch Application Signals Services

Go to CloudWatch → Application Signals (APM) → Services.

### 2. Search for billing-service-python

In the search field with placeholder text 'Filter services and resources by text, property or value', type 'billing-service-python' and press Enter.

**Constraints:**
- You MUST ensure you press Enter.

### 3. Click on billing-service-python

Click the hyperlink 'billing-service-python'.

### 4. Click 'Service operation' tab

Click the 'Service operation' tab. Then, ensure the `GET ^summary/$` is selected if not already.

### 5. Click on a datapoint for GET /summary

Click on a datapoint in the GET /summary operation graph, PASS in 1 and 3 as a PARAMETERS.

**Constraints:**
- You MUST pass in parameters 1 and 3

### 6. Click 'Correlate with Other Metrics'

In the diagnostic drawer on the right, click the 'Correlate with Other Metrics' button.

### 7. Check you are on Related metrics tab

Check that you are now on the 'Related metrics' tab.

### 8. Search for BillingSummaryCacheHitCount metric

In the search field with placeholder text 'Filter metrics by text, property, or value', type 'BillingSummaryCacheHitCount' and press Enter.

**Constraints:**
- You MUST ensure you press Enter.

### 9. Select BillingSummaryCacheHitCount metric

In the metrics table, select the 'BillingSummaryCacheHitCount' metric to add it to the graph.

### 10. Search for BillingSummaryCacheMissCount metric

In the search field with placeholder text 'Filter metrics by text, property, or value', type 'BillingSummaryCacheMissCount' and press Enter.

**Constraints:**
- You MUST ensure you press Enter.

### 11. Select BillingSummaryCacheMissCount metric

In the metrics table, select the 'BillingSummaryCacheMissCount' metric to add it to the graph.

### 12. Check correlation between metrics

Check that when latency spikes occur, BillingSummaryCacheHitCount decreases and BillingSummaryCacheMissCount increases at the same time periods.