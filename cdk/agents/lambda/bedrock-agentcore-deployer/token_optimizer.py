"""
GenAI Token Usage Optimizer for Bedrock Agents
Implements caching, request throttling, and smart routing to reduce token consumption
"""
import json
import time
import hashlib
from typing import Dict, Any, Optional
import boto3
from botocore.exceptions import ClientError

class TokenOptimizer:
    def __init__(self):
        self.cache = {}  # In-memory cache (use Redis in production)
        self.request_counts = {}  # Track requests per minute
        self.daily_token_usage = {}  # Track daily token consumption
        
        # Configuration
        self.CACHE_TTL = 3600  # 1 hour
        self.MAX_REQUESTS_PER_MINUTE = 100
        self.DAILY_TOKEN_LIMITS = {
            'nutrition_agent.DEFAULT': 15_000_000,  # 15M tokens
            'pet_clinic_agent.DEFAULT': 12_000_000   # 12M tokens
        }
        
        # Common FAQ responses to avoid Bedrock calls
        self.FAQ_RESPONSES = {
            'feeding_schedule': "Most adult dogs should be fed twice daily, while puppies need 3-4 meals per day.",
            'water_intake': "Dogs need approximately 1 ounce of water per pound of body weight daily.",
            'exercise_basic': "Most dogs need 30 minutes to 2 hours of exercise daily depending on breed and age.",
            'vaccination_schedule': "Puppies need vaccines at 6-8, 10-12, and 14-16 weeks, then annually."
        }
    
    def should_use_cache(self, query: str, agent_name: str) -> Optional[str]:
        """Check if query can be answered from cache or FAQ"""
        # Generate cache key
        cache_key = hashlib.md5(f"{agent_name}:{query.lower()}".encode()).hexdigest()
        
        # Check cache
        if cache_key in self.cache:
            cached_item = self.cache[cache_key]
            if time.time() - cached_item['timestamp'] < self.CACHE_TTL:
                return cached_item['response']
            else:
                del self.cache[cache_key]
        
        # Check FAQ patterns
        query_lower = query.lower()
        for pattern, response in self.FAQ_RESPONSES.items():
            if pattern.replace('_', ' ') in query_lower:
                self.cache[cache_key] = {
                    'response': response,
                    'timestamp': time.time()
                }
                return response
        
        return None
    
    def should_throttle_request(self, agent_name: str) -> bool:
        """Check if request should be throttled"""
        current_minute = int(time.time() / 60)
        key = f"{agent_name}:{current_minute}"
        
        if key not in self.request_counts:
            self.request_counts[key] = 0
        
        self.request_counts[key] += 1
        
        # Clean old entries
        for k in list(self.request_counts.keys()):
            if int(k.split(':')[1]) < current_minute - 1:
                del self.request_counts[k]
        
        return self.request_counts[key] > self.MAX_REQUESTS_PER_MINUTE
    
    def check_daily_token_limit(self, agent_name: str, estimated_tokens: int) -> bool:
        """Check if request would exceed daily token limit"""
        today = time.strftime('%Y-%m-%d')
        key = f"{agent_name}:{today}"
        
        current_usage = self.daily_token_usage.get(key, 0)
        limit = self.DAILY_TOKEN_LIMITS.get(agent_name, 10_000_000)
        
        return current_usage + estimated_tokens > limit
    
    def update_token_usage(self, agent_name: str, input_tokens: int, output_tokens: int):
        """Update daily token usage tracking"""
        today = time.strftime('%Y-%m-%d')
        key = f"{agent_name}:{today}"
        
        if key not in self.daily_token_usage:
            self.daily_token_usage[key] = 0
        
        self.daily_token_usage[key] += input_tokens + output_tokens
    
    def optimize_prompt(self, prompt: str, agent_name: str) -> str:
        """Optimize prompt to reduce token usage"""
        # Remove redundant phrases
        optimized = prompt.replace("Please provide a detailed", "Provide")
        optimized = optimized.replace("I would like to know", "")
        optimized = optimized.replace("Could you please tell me", "")
        
        # Add response length constraints based on agent
        if agent_name == 'nutrition_agent.DEFAULT':
            optimized += "\n\nRespond in 200 words or less."
        else:
            optimized += "\n\nRespond in 150 words or less."
        
        return optimized
    
    def get_optimized_model_params(self, agent_name: str) -> Dict[str, Any]:
        """Get optimized model parameters to reduce token usage"""
        base_params = {
            'temperature': 0.1,  # More deterministic, shorter responses
            'stop_sequences': ['\n\n\n', '---', 'In conclusion'],
        }
        
        if agent_name == 'nutrition_agent.DEFAULT':
            base_params['max_tokens'] = 500
        else:
            base_params['max_tokens'] = 300
        
        return base_params
    
    def cache_response(self, query: str, agent_name: str, response: str):
        """Cache successful response"""
        cache_key = hashlib.md5(f"{agent_name}:{query.lower()}".encode()).hexdigest()
        self.cache[cache_key] = {
            'response': response,
            'timestamp': time.time()
        }
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """Get current usage statistics"""
        today = time.strftime('%Y-%m-%d')
        stats = {}
        
        for agent_name in self.DAILY_TOKEN_LIMITS.keys():
            key = f"{agent_name}:{today}"
            usage = self.daily_token_usage.get(key, 0)
            limit = self.DAILY_TOKEN_LIMITS[agent_name]
            
            stats[agent_name] = {
                'daily_usage': usage,
                'daily_limit': limit,
                'usage_percentage': (usage / limit) * 100,
                'cache_size': len([k for k in self.cache.keys() if agent_name in k])
            }
        
        return stats