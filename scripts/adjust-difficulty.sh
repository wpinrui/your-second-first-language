#!/bin/bash
# Adjust difficulty level in user-overrides.json
# Usage: ./adjust-difficulty.sh <direction> [reason]
# direction: easier, harder, auto, or CEFR level (A1, A2, B1, B2, C1, C2)
# Example: ./adjust-difficulty.sh "easier" "learner requested"

set -e

OVERRIDES_FILE="./user-overrides.json"

if [ -z "$1" ]; then
    echo "Usage: $0 <direction> [reason]"
    echo "direction: easier, harder, auto, A1, A2, B1, B2, C1, C2"
    exit 1
fi

DIRECTION="$1"
REASON="${2:-}"

# Validate direction
case "$DIRECTION" in
    easier|harder|auto|A1|A2|B1|B2|C1|C2) ;;
    *)
        echo "Invalid direction: $DIRECTION"
        echo "Must be: easier, harder, auto, A1, A2, B1, B2, C1, C2"
        exit 1
        ;;
esac

# Check if user-overrides.json exists
if [ ! -f "$OVERRIDES_FILE" ]; then
    echo "Error: $OVERRIDES_FILE not found"
    exit 1
fi

# Update difficulty
jq --arg level "$DIRECTION" \
   --arg reason "$REASON" \
   --arg date "$(date +%Y-%m-%d)" \
   '
   .difficulty.level = $level |
   .difficulty.notes = $reason |
   .adjustments += [{
     "date": $date,
     "direction": $level,
     "reason": $reason
   }]
   ' "$OVERRIDES_FILE" > "$OVERRIDES_FILE.tmp" && mv "$OVERRIDES_FILE.tmp" "$OVERRIDES_FILE"

echo "Adjusted difficulty to: $DIRECTION"
