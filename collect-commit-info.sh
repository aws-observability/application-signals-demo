#!/bin/bash
set -e

# Script to collect git commit information and output as JSON
# For use in GitHub Actions workflows

OUTPUT_FILE="./topology/commit-info.json"

echo "Collecting git commit information..."

# Initialize JSON structure
cat > $OUTPUT_FILE << EOF
{
  "entities": [],
  "relationships": []
}
EOF

# Function to add an entity to the JSON
add_entity() {
  local type=$1
  local id=$2
  local properties=$3
  
  # Escape JSON special characters in properties
  properties=$(echo "$properties" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g' | sed ':a;N;$!ba;s/\n/\\n/g')
  
  # Add entity to JSON
  jq --arg type "$type" --arg id "$id" --arg props "$properties" '.entities += [{"type": $type, "id": $id, "properties": $props}]' $OUTPUT_FILE > tmp.json && mv tmp.json $OUTPUT_FILE
}

# Function to add a relationship to the JSON
add_relationship() {
  local source=$1
  local target=$2
  local type=$3
  
  # Add relationship to JSON
  jq --arg source "$source" --arg target "$target" --arg type "$type" '.relationships += [{"source": $source, "target": $target, "type": $type}]' $OUTPUT_FILE > tmp.json && mv tmp.json $OUTPUT_FILE
}

# Get current commit information
if git rev-parse HEAD &>/dev/null; then
  COMMIT_ID=$(git rev-parse HEAD)
  COMMIT_SHORT_ID=$(git rev-parse --short HEAD)
  COMMIT_AUTHOR=$(git show -s --format='%an <%ae>' $COMMIT_ID)
  COMMIT_DATE=$(git show -s --format='%ad' --date=iso $COMMIT_ID)
  COMMIT_MESSAGE=$(git show -s --format='%B' $COMMIT_ID)
  
  # Get commit diff
  COMMIT_DIFF=$(git show --name-status $COMMIT_ID)
  
  # Create commit entity properties as JSON string
  COMMIT_PROPS=$(cat << EOF
{
  "id": "$COMMIT_ID",
  "shortId": "$COMMIT_SHORT_ID",
  "author": "$COMMIT_AUTHOR",
  "date": "$COMMIT_DATE",
  "message": "$COMMIT_MESSAGE",
  "diff": "$COMMIT_DIFF"
}
EOF
)
  
  # Add commit entity
  add_entity "commit" "$COMMIT_ID" "$COMMIT_PROPS"
  
  # Check if we're in a GitHub Actions environment
  if [ -n "$GITHUB_EVENT_PATH" ] && [ -f "$GITHUB_EVENT_PATH" ]; then
    echo "GitHub Actions environment detected, extracting additional information..."
    
    # Try to get PR number from GitHub event
    if jq -e '.pull_request.number' $GITHUB_EVENT_PATH &>/dev/null; then
      PR_NUMBER=$(jq -r '.pull_request.number' $GITHUB_EVENT_PATH)
      PR_TITLE=$(jq -r '.pull_request.title' $GITHUB_EVENT_PATH)
      PR_URL=$(jq -r '.pull_request.html_url' $GITHUB_EVENT_PATH)
      PR_AUTHOR=$(jq -r '.pull_request.user.login' $GITHUB_EVENT_PATH)
      
      # Create PR entity properties
      PR_PROPS=$(cat << EOF
{
  "number": "$PR_NUMBER",
  "title": "$PR_TITLE",
  "url": "$PR_URL",
  "author": "$PR_AUTHOR"
}
EOF
)
      
      # Add PR entity and relationship
      add_entity "pull_request" "PR-$PR_NUMBER" "$PR_PROPS"
      add_relationship "$COMMIT_ID" "PR-$PR_NUMBER" "belongs_to"
      
      # Try to extract issue numbers from PR title or commit message
      # Look for patterns like "#123" or "fixes #123"
      ISSUE_PATTERN='(^|[^0-9])#([0-9]+)($|[^0-9])'
      
      # Check PR title for issue references
      if [[ $PR_TITLE =~ $ISSUE_PATTERN ]]; then
        ISSUE_NUMBER="${BASH_REMATCH[2]}"
        
        # Create issue entity properties
        ISSUE_PROPS=$(cat << EOF
{
  "number": "$ISSUE_NUMBER"
}
EOF
)
        
        # Add issue entity and relationships
        add_entity "issue" "ISSUE-$ISSUE_NUMBER" "$ISSUE_PROPS"
        add_relationship "PR-$PR_NUMBER" "ISSUE-$ISSUE_NUMBER" "references"
      fi
      
      # Check commit message for issue references
      if [[ $COMMIT_MESSAGE =~ $ISSUE_PATTERN ]]; then
        ISSUE_NUMBER="${BASH_REMATCH[2]}"
        
        # Check if we already added this issue
        if ! jq -e '.entities[] | select(.id == "ISSUE-'$ISSUE_NUMBER'")' $OUTPUT_FILE &>/dev/null; then
          # Create issue entity properties
          ISSUE_PROPS=$(cat << EOF
{
  "number": "$ISSUE_NUMBER"
}
EOF
)
          
          # Add issue entity and relationships
          add_entity "issue" "ISSUE-$ISSUE_NUMBER" "$ISSUE_PROPS"
        fi
        
        # Add relationship from commit to issue
        add_relationship "$COMMIT_ID" "ISSUE-$ISSUE_NUMBER" "references"
      fi
    else
      echo "No pull request information found in GitHub event"
    fi
  else
    # Not in GitHub Actions, try to get PR info from git
    echo "Not in GitHub Actions environment, trying to extract PR info from git..."
    
    # Try to get PR number from branch name (if branch follows pattern like "pull/123")
    BRANCH_NAME=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
    if [[ $BRANCH_NAME =~ pull/([0-9]+) ]]; then
      PR_NUMBER="${BASH_REMATCH[1]}"
      
      # Create minimal PR entity properties
      PR_PROPS=$(cat << EOF
{
  "number": "$PR_NUMBER"
}
EOF
)
      
      # Add PR entity and relationship
      add_entity "pull_request" "PR-$PR_NUMBER" "$PR_PROPS"
      add_relationship "$COMMIT_ID" "PR-$PR_NUMBER" "belongs_to"
    fi
    
    # Try to extract issue numbers from commit message
    ISSUE_PATTERN='(^|[^0-9])#([0-9]+)($|[^0-9])'
    if [[ $COMMIT_MESSAGE =~ $ISSUE_PATTERN ]]; then
      ISSUE_NUMBER="${BASH_REMATCH[2]}"
      
      # Create issue entity properties
      ISSUE_PROPS=$(cat << EOF
{
  "number": "$ISSUE_NUMBER"
}
EOF
)
      
      # Add issue entity and relationships
      add_entity "issue" "ISSUE-$ISSUE_NUMBER" "$ISSUE_PROPS"
      add_relationship "$COMMIT_ID" "ISSUE-$ISSUE_NUMBER" "references"
    fi
  fi
else
  echo "Warning: Not in a git repository or no commits yet"
  
  # Add placeholder entity
  PLACEHOLDER_PROPS=$(cat << EOF
{
  "message": "No git repository or commits found"
}
EOF
)
  
  add_entity "placeholder" "no-commit" "$PLACEHOLDER_PROPS"
fi

echo "Commit information collected and saved to $OUTPUT_FILE"
echo "JSON content:"
cat $OUTPUT_FILE | jq .

exit 0