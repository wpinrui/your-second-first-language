#!/bin/bash
# Mark a grammar rule as used (correctly or incorrectly)
# Usage: ./mark-grammar-used.sh <rule> <correct>
# correct: true or false
# Example: ./mark-grammar-used.sh "是-sentence" "true"

set -e

GRAMMAR_FILE="./grammar.json"

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <rule> <correct>"
    echo "correct: true or false"
    exit 1
fi

RULE="$1"
CORRECT="$2"
TODAY=$(date +%Y-%m-%d)

# Validate correct
case "$CORRECT" in
    true|false) ;;
    *)
        echo "Invalid value: $CORRECT"
        echo "Must be: true or false"
        exit 1
        ;;
esac

# Check if grammar.json exists
if [ ! -f "$GRAMMAR_FILE" ]; then
    echo "Error: $GRAMMAR_FILE not found"
    exit 1
fi

# Check if rule exists
if ! jq -e ".rules[] | select(.rule == \"$RULE\")" "$GRAMMAR_FILE" > /dev/null 2>&1; then
    echo "Rule '$RULE' not found"
    exit 1
fi

# Update rule based on correctness
# Correct: stars +1 (max 5), correct_streak +1
# Incorrect: stars -1 (min 1), correct_streak = 0
# If stars=5 and correct_streak >= 5: set permanent=true

jq --arg rule "$RULE" \
   --argjson correct "$CORRECT" \
   --arg today "$TODAY" \
   '
   .rules |= map(
     if .rule == $rule then
       .last_used = $today |
       if $correct then
         .correct_streak = .correct_streak + 1 |
         .stars = ([.stars + 1, 5] | min) |
         if .stars == 5 and .correct_streak >= 5 then
           .permanent = true
         else .
         end
       else
         .correct_streak = 0 |
         .stars = ([.stars - 1, 1] | max)
       end
     else .
     end
   )
   ' "$GRAMMAR_FILE" > "$GRAMMAR_FILE.tmp" && mv "$GRAMMAR_FILE.tmp" "$GRAMMAR_FILE"

echo "Marked '$RULE' as correct=$CORRECT"
