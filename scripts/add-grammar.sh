#!/bin/bash
# Add a new grammar rule to grammar.json
# Usage: ./add-grammar.sh <rule> <description> <level>
# Example: ./add-grammar.sh "是-sentence" "X是Y结构" "A1"

set -e

GRAMMAR_FILE="./grammar.json"

if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Usage: $0 <rule> <description> <level>"
    echo "Level: A1, A2, B1, B2, C1, C2"
    exit 1
fi

RULE="$1"
DESCRIPTION="$2"
LEVEL="$3"
TODAY=$(date +%Y-%m-%d)

# Validate level
case "$LEVEL" in
    A1|A2|B1|B2|C1|C2) ;;
    *)
        echo "Invalid level: $LEVEL"
        echo "Must be: A1, A2, B1, B2, C1, C2"
        exit 1
        ;;
esac

# Check if grammar.json exists
if [ ! -f "$GRAMMAR_FILE" ]; then
    echo "Error: $GRAMMAR_FILE not found"
    exit 1
fi

# Check if rule already exists
if jq -e ".rules[] | select(.rule == \"$RULE\")" "$GRAMMAR_FILE" > /dev/null 2>&1; then
    echo "Rule '$RULE' already exists"
    exit 0
fi

# Add the new rule
jq --arg rule "$RULE" \
   --arg desc "$DESCRIPTION" \
   --arg level "$LEVEL" \
   --arg date "$TODAY" \
   '.rules += [{
     "rule": $rule,
     "description": $desc,
     "level": $level,
     "stars": 1,
     "last_used": $date,
     "correct_streak": 0,
     "permanent": false,
     "notes": ""
   }]' "$GRAMMAR_FILE" > "$GRAMMAR_FILE.tmp" && mv "$GRAMMAR_FILE.tmp" "$GRAMMAR_FILE"

echo "Added grammar rule: $RULE"
