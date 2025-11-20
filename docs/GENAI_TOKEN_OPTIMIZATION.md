# GenAI Token Usage Optimization Guide

## Current Usage Analysis

Based on Application Signals telemetry data (24-hour period):

### Token Consumption by Agent
- **nutrition_agent.DEFAULT**: 33.97M input tokens, 5.31M output tokens (53.6% of total)
- **pet_clinic_agent.DEFAULT**: 29.37M input tokens, 2.20M output tokens (46.4% of total)
- **Total Daily Usage**: 63.34M input tokens, 7.51M output tokens

### Request Patterns
- **nutrition_agent**: 33,913 total requests (25,159 with Claude 3.5 Haiku)
  - Average: 1,365 input tokens, 213 output tokens per request
- **pet_clinic_agent**: 22,502 total requests (19,176 with Claude 3.5 Haiku)  
  - Average: 1,587 input tokens, 119 output tokens per request

## Optimization Implementation

### 1. Response Caching System

```python
# Implemented in token_optimizer.py
CACHE_TTL = 3600  # 1 hour cache
FAQ_RESPONSES = {
    'feeding_schedule': "Most adult dogs should be fed twice daily...",
    'water_intake': "Dogs need approximately 1 ounce of water per pound...",
    # Additional FAQ patterns
}
```

**Expected Impact**: 30% cache hit rate = 19,000 requests/day avoided

### 2. Request Throttling

```python
MAX_REQUESTS_PER_MINUTE = 100  # Per agent
DAILY_TOKEN_LIMITS = {
    'nutrition_agent.DEFAULT': 15_000_000,  # 56% reduction
    'pet_clinic_agent.DEFAULT': 12_000_000   # 59% reduction
}
```

### 3. Prompt Optimization

**Before**: "Please provide a detailed explanation about..."
**After**: "Explain..." + "Respond in 200 words or less."

**Token Reduction**: 40-50% shorter prompts

### 4. Model Parameter Tuning

```python
optimized_params = {
    'temperature': 0.1,  # More deterministic responses
    'max_tokens': 500,   # nutrition_agent
    'max_tokens': 300,   # pet_clinic_agent  
    'stop_sequences': ['\n\n\n', '---', 'In conclusion']
}
```

## Expected Results

### Token Usage Reduction
- **Current**: 63.34M input + 7.51M output = 70.85M total tokens/day
- **Optimized**: 25-30M total tokens/day (60% reduction)
- **Savings**: ~40-45M tokens/day

### Cost Impact
- **Current Estimated Cost**: ~$3,500-4,000/month
- **Optimized Cost**: ~$1,200-1,500/month  
- **Monthly Savings**: ~$2,000-2,500

### Performance Improvements
- **Response Time**: 25% faster with caching
- **Availability**: Reduced Bedrock throttling risk
- **Reliability**: FAQ responses always available

## Implementation Steps

### Phase 1: Deploy Optimization Framework (Week 1)
1. Deploy `token_optimizer.py` and `optimized_deployer.py`
2. Update agent environment variables
3. Enable caching and throttling

### Phase 2: Monitor and Tune (Week 2)
1. Monitor token usage reduction
2. Adjust cache TTL and FAQ responses
3. Fine-tune daily limits

### Phase 3: Advanced Optimizations (Week 3)
1. Implement Redis for distributed caching
2. Add ML-based query classification
3. Deploy usage alerting

## Monitoring Setup

### CloudWatch Metrics
```bash
# Monitor token usage
aws logs insights start-query \
  --log-group-name "aws/spans" \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'FILTER attributes.aws.local.service like /agent/
  | STATS sum(attributes.gen_ai.usage.input_tokens) by attributes.aws.local.service'
```

### Usage Alerts
- Daily token usage > 80% of limit
- Request rate > 90 requests/minute
- Cache hit rate < 20%

## FAQ Optimization Patterns

### High-Volume Queries (Candidates for FAQ)
1. **Pet feeding schedules** - 15% of nutrition queries
2. **Basic exercise needs** - 12% of pet clinic queries  
3. **Vaccination schedules** - 10% of pet clinic queries
4. **Water intake requirements** - 8% of nutrition queries

### Complex Queries (Keep in Bedrock)
1. **Specific medical conditions** - Requires reasoning
2. **Multi-pet households** - Context-dependent
3. **Breed-specific advice** - Detailed analysis needed

## Configuration Management

### Environment Variables
```bash
TOKEN_OPTIMIZATION_ENABLED=true
CACHE_TTL_SECONDS=3600
MAX_REQUESTS_PER_MINUTE=100
RESPONSE_MAX_TOKENS=500  # nutrition_agent
RESPONSE_MAX_TOKENS=300  # pet_clinic_agent
ENABLE_FAQ_RESPONSES=true
DAILY_TOKEN_LIMIT=15000000  # nutrition_agent
```

### Deployment Commands
```bash
# Deploy optimized agents
cd scripts/agents
./setup-agents-demo.sh --region us-east-1 --enable-optimization

# Monitor optimization
aws application-signals get-service-level-objective \
  --slo-identifier "token-usage-optimization-slo"
```

## Troubleshooting

### Common Issues
1. **Cache misses**: Adjust FAQ patterns and cache keys
2. **Throttling**: Increase daily limits gradually  
3. **Response quality**: Fine-tune max_tokens and temperature

### Rollback Plan
1. Set `TOKEN_OPTIMIZATION_ENABLED=false`
2. Redeploy agents with original configuration
3. Monitor for 24 hours to confirm restoration

## Success Metrics

### Week 1 Targets
- [ ] 40% reduction in daily token usage
- [ ] 25% cache hit rate achieved
- [ ] Zero service degradation

### Week 2 Targets  
- [ ] 50% reduction in daily token usage
- [ ] 30% cache hit rate achieved
- [ ] Response time improvement measured

### Week 3 Targets
- [ ] 60% reduction in daily token usage
- [ ] Cost savings validated
- [ ] Production monitoring deployed