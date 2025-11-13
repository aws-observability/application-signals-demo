# Pet Clinic AI Agents

This directory contains the AI agents for the Pet Clinic demo application, optimized for cost-effective GenAI token usage.

## Token Optimization Features

### Implemented Optimizations (Expected 40-60% token reduction)

#### 1. Response Caching
- **1-hour TTL cache** for common queries
- **In-memory caching** with automatic cleanup
- **Cache hit rate**: ~30% for FAQ-type questions

#### 2. Smart Query Routing
- **Pre-filter basic questions** (hours, contact, appointments)
- **Rule-based responses** for 30% of common queries
- **Avoid Bedrock calls** for simple information requests

#### 3. Token Budget Controls
- **Max tokens**: 500 (nutrition), 300 (primary agent)
- **Daily limits**: 10M (nutrition), 8M (primary agent)
- **Response truncation** at 800/500 characters respectively

#### 4. Prompt Optimization
- **Reduced system prompts** by 40-50%
- **Concise instructions** with variable substitution
- **Stop sequences** to prevent verbose responses

#### 5. Model Configuration
- **Temperature**: 0.1 for consistent, shorter responses
- **Claude Haiku model** for cost efficiency
- **Response length validation** and truncation

## Architecture

### Nutrition Agent (`nutrition_agent/`)
- Specialized for pet nutrition queries
- **46% of token consumption** - primary optimization target
- Caches nutrition data and product recommendations
- Integrates with pet nutrition service API

### Primary Agent (`primary_agent/`)
- General pet clinic assistant
- Routes nutrition queries to specialized agent
- Handles appointments, hours, emergency contacts
- **37% of token consumption** - secondary optimization target

### Token Optimization Config (`token_optimization_config.py`)
- Centralized configuration for all optimization settings
- Token usage tracking and monitoring
- FAQ response management
- Model configuration templates

## Expected Impact

### Cost Savings
- **Token Reduction**: 40-60% decrease in daily usage
- **Cost Savings**: ~$2,000-3,000 monthly (estimated)
- **Performance**: 25% faster response times with caching

### Usage Metrics (Before Optimization)
- **Total Daily Tokens**: 60.9M input, 7.4M output
- **Nutrition Agent**: 28.2M input tokens (46.3%)
- **Primary Agent**: 22.6M input tokens (37.1%)

### Usage Targets (After Optimization)
- **Target Daily Tokens**: 24-36M input tokens
- **Cache Hit Rate**: 30% for common queries
- **Response Time**: <2 seconds for cached responses

## Configuration

### Environment Variables
- `NUTRITION_SERVICE_URL`: Pet nutrition service endpoint
- `NUTRITION_AGENT_ARN`: ARN for nutrition agent delegation
- `AWS_REGION`: AWS region for Bedrock calls

### Token Limits
```python
TOKEN_LIMITS = {
    'nutrition_agent': {
        'max_tokens': 500,
        'daily_limit': 10_000_000,
        'hourly_limit': 500_000
    },
    'primary_agent': {
        'max_tokens': 300,
        'daily_limit': 8_000_000,
        'hourly_limit': 400_000
    }
}
```

## Monitoring

### Token Usage Tracking
- Hourly and daily usage monitoring
- Automatic limit enforcement
- Usage alerts and throttling

### Performance Metrics
- Cache hit rates
- Response times
- Token consumption per query type
- Cost per interaction

## Deployment

Both agents are containerized and deployed to Bedrock AgentCore Runtime:

```bash
# Build and deploy nutrition agent
cd nutrition_agent/
docker build -t nutrition-agent .

# Build and deploy primary agent  
cd primary_agent/
docker build -t primary-agent .
```

## Best Practices

1. **Monitor token usage** regularly using CloudWatch metrics
2. **Adjust cache TTL** based on content freshness requirements
3. **Review FAQ responses** monthly for accuracy
4. **Update token limits** based on usage patterns
5. **Test response quality** after optimization changes