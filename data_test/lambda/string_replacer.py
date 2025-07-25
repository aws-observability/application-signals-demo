import os
import json
import re

def parse_replacement_rules(env_var_name="STRING_REPLACEMENT_RULES"):
    """
    Parse replacement rules from environment variable
    Format: "A:B,C:D,E:F" or "A":"B","C":"D"
    Supports comma-separated format with optional quotes
    """
    rules_str = os.environ.get(env_var_name, "")
    if not rules_str.strip():
        return {}
    
    rules = {}
    
    # Check if it contains quoted format: "A":"B"
    if '":"' in rules_str:
        # Parse quoted format: "A":"B","C":"D" or "A":"B"
        try:
            # For single rule without comma, handle directly
            if ',' not in rules_str:
                # Single rule: "A":"B"
                key, value = rules_str.split('":"', 1)
                # Remove quotes from key and value
                if key.startswith('"'):
                    key = key[1:]
                if value.endswith('"'):
                    value = value[:-1]
                rules[key.strip()] = value.strip()
            else:
                # Multiple rules: "A":"B","C":"D"
                parts = rules_str.split(',')
                for part in parts:
                    part = part.strip()
                    if '":"' in part:
                        key, value = part.split('":"', 1)
                        # Remove quotes from key and value
                        if key.startswith('"'):
                            key = key[1:]
                        if value.endswith('"'):
                            value = value[:-1]
                        rules[key.strip()] = value.strip()
        except Exception as e:
            print(f"Error parsing quoted format: {e}")
            return {}
    else:
        # Parse simple format: A:B,C:D
        pairs = rules_str.split(',')
        for pair in pairs:
            pair = pair.strip()
            if ':' in pair:
                # Split by first colon only to handle values containing colons
                key, value = pair.split(':', 1)
                rules[key.strip()] = value.strip()
    
    return rules

def apply_replacements_to_string(text, rules):
    """
    Apply replacement rules to a string
    """
    if not text or not rules:
        return text
    
    result = text
    for old_str, new_str in rules.items():
        if old_str in result:
            result = result.replace(old_str, new_str)
    
    return result

def apply_replacements_to_dict(data, rules):
    """
    Recursively apply replacement rules to all string values in a dictionary
    """
    if not data or not rules:
        return data
    
    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            result[key] = apply_replacements_to_dict(value, rules)
        return result
    elif isinstance(data, list):
        return [apply_replacements_to_dict(item, rules) for item in data]
    elif isinstance(data, str):
        return apply_replacements_to_string(data, rules)
    else:
        return data

def apply_replacements_to_test_cases(test_cases, env_var_name="STRING_REPLACEMENT_RULES"):
    """
    Apply replacement rules to test cases
    """
    rules = parse_replacement_rules(env_var_name)
    
    if not rules:
        print("No replacement rules found in environment variable")
        return test_cases
    
    print(f"Applying replacement rules: {rules}")
    
    # Apply replacement rules
    modified_test_cases = apply_replacements_to_dict(test_cases, rules)
    
    return modified_test_cases

def load_and_apply_replacements(json_file_path, env_var_name="STRING_REPLACEMENT_RULES"):
    """
    Load JSON file and apply replacement rules
    """
    try:
        with open(json_file_path, 'r') as f:
            data = json.load(f)
        
        # Apply replacement rules
        modified_data = apply_replacements_to_test_cases(data, env_var_name)
        
        return modified_data
    except FileNotFoundError:
        print(f"ERROR: JSON file not found {json_file_path}")
        raise
    except json.JSONDecodeError as e:
        print(f"ERROR: JSON file parse error {json_file_path}: {e}")
        raise 