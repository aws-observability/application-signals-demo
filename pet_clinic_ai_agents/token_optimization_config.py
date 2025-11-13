"""
Token Optimization Configuration for Pet Clinic AI Agents

This module provides centralized configuration for token usage optimization
across both nutrition and primary agents.
"""

import os
import time
from typing import Dict, Any, Optional

class TokenOptimizer:
    """Centralized token optimization configuration and utilities"""
    
    # Token limits per agent type
    TOKEN_LIMITS = {
        'nutrition_agent': {
            'max_tokens': 500,
            'daily_limit': 10_000_000,  # 10M tokens per day
            'hourly_limit': 500_000     # 500K tokens per hour
        },
        'primary_agent': {
            'max_tokens': 300,
            'daily_limit': 8_000_000,   # 8M tokens per day
            'hourly_limit': 400_000     # 400K tokens per hour
        }
    }
    
    # Cache configuration
    CACHE_CONFIG = {
        'ttl': 3600,  # 1 hour
        'max_size': 1000,  # Maximum cached responses
        'cleanup_interval': 300  # 5 minutes
    }
    
    # Model configuration for cost optimization
    MODEL_CONFIG = {
        'temperature': 0.1,  # More consistent, shorter responses
        'stop_sequences': ["Human:", "Assistant:", "\n\nHuman:", "\n\nAssistant:"],
        'model_id': "us.anthropic.claude-3-5-haiku-20241022-v1:0"  # Cost-effective model
    }
    
    # Response length limits
    RESPONSE_LIMITS = {
        'nutrition_agent': 800,
        'primary_agent': 500,
        'truncation_suffix': "... For detailed guidance, visit our clinic."
    }
    
    # Common FAQ responses to avoid Bedrock calls
    FAQ_RESPONSES = {
        'hours': "Mon-Fri: 8AM-6PM, Sat: 9AM-4PM, Sun: Closed. Emergency 24/7.",
        'phone': "Call (555) 123-PETS for appointments and information.",
        'contact': "Call (555) 123-PETS for appointments and information.",
        'emergency': "Emergency Line: (555) 123-PETS. For life-threatening emergencies, call immediately.",
        'appointment': "Available: Today 3PM, Tomorrow 10AM & 2:30PM. Call (555) 123-PETS.",
        'location': "Visit our clinic at 123 Pet Street. Call (555) 123-PETS for directions.",
        'address': "Visit our clinic at 123 Pet Street. Call (555) 123-PETS for directions."
    }
    
    @staticmethod
    def get_model_config(agent_type: str) -> Dict[str, Any]:
        """Get optimized model configuration for agent type"""
        base_config = TokenOptimizer.MODEL_CONFIG.copy()
        if agent_type in TokenOptimizer.TOKEN_LIMITS:
            base_config['max_tokens'] = TokenOptimizer.TOKEN_LIMITS[agent_type]['max_tokens']
        return base_config
    
    @staticmethod
    def should_use_faq(query: str) -> Optional[str]:
        """Check if query can be answered with FAQ response"""
        query_lower = query.lower()
        for keyword, response in TokenOptimizer.FAQ_RESPONSES.items():
            if keyword in query_lower:
                return response
        return None
    
    @staticmethod
    def truncate_response(response: str, agent_type: str) -> str:
        """Truncate response if it exceeds limits"""
        limit = TokenOptimizer.RESPONSE_LIMITS.get(agent_type, 500)
        if len(response) > limit:
            suffix = TokenOptimizer.RESPONSE_LIMITS['truncation_suffix']
            return response[:limit - len(suffix)] + suffix
        return response
    
    @staticmethod
    def get_optimized_system_prompt(agent_type: str) -> str:
        """Get optimized system prompt for agent type"""
        if agent_type == 'nutrition_agent':
            return (
                "You are a pet nutrition expert at our veterinary clinic. Provide concise, evidence-based dietary guidance. "
                "Always recommend SPECIFIC PRODUCT NAMES from our clinic (PurrfectChoice, BarkBite, FeatherFeast). "
                "Keep responses under 150 words. For orders, use create_order tool."
            )
        elif agent_type == 'primary_agent':
            return (
                "You are a helpful assistant at our pet clinic. Keep responses BRIEF (2-3 sentences max). "
                "For nutrition questions (diet, feeding, supplements), use consult_nutrition_specialist tool. "
                "For product orders, ask pet type first, then delegate to nutrition specialist. "
                "Never mention tools, APIs, or technical details."
            )
        else:
            return "You are a helpful assistant. Keep responses brief and concise."

# Usage tracking (in production, this would be stored in a database)
class TokenUsageTracker:
    """Track token usage for monitoring and alerting"""
    
    def __init__(self):
        self.usage_data = {}
    
    def record_usage(self, agent_type: str, tokens_used: int):
        """Record token usage for an agent"""
        current_time = time.time()
        hour_key = int(current_time // 3600)
        day_key = int(current_time // 86400)
        
        if agent_type not in self.usage_data:
            self.usage_data[agent_type] = {'hourly': {}, 'daily': {}}
        
        # Track hourly usage
        if hour_key not in self.usage_data[agent_type]['hourly']:
            self.usage_data[agent_type]['hourly'][hour_key] = 0
        self.usage_data[agent_type]['hourly'][hour_key] += tokens_used
        
        # Track daily usage
        if day_key not in self.usage_data[agent_type]['daily']:
            self.usage_data[agent_type]['daily'][day_key] = 0
        self.usage_data[agent_type]['daily'][day_key] += tokens_used
    
    def check_limits(self, agent_type: str) -> Dict[str, bool]:
        """Check if agent is approaching token limits"""
        current_time = time.time()
        hour_key = int(current_time // 3600)
        day_key = int(current_time // 86400)
        
        limits = TokenOptimizer.TOKEN_LIMITS.get(agent_type, {})
        hourly_usage = self.usage_data.get(agent_type, {}).get('hourly', {}).get(hour_key, 0)
        daily_usage = self.usage_data.get(agent_type, {}).get('daily', {}).get(day_key, 0)
        
        return {
            'hourly_ok': hourly_usage < limits.get('hourly_limit', float('inf')),
            'daily_ok': daily_usage < limits.get('daily_limit', float('inf')),
            'hourly_usage': hourly_usage,
            'daily_usage': daily_usage
        }

# Global tracker instance
usage_tracker = TokenUsageTracker()