#!/bin/bash
# Mark a word as recalled with given quality
# Usage: ./mark-word-recalled.sh <word> <quality>
# Quality: forgot, hard, good, easy
# Example: ./mark-word-recalled.sh "你好" "good"

set -e

VOCAB_FILE="./vocabulary.json"

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <word> <quality>"
    echo "Quality: forgot, hard, good, easy"
    exit 1
fi

WORD="$1"
QUALITY="$2"
TODAY=$(date +%Y-%m-%d)

# Validate quality
case "$QUALITY" in
    forgot|hard|good|easy) ;;
    *)
        echo "Invalid quality: $QUALITY"
        echo "Must be: forgot, hard, good, easy"
        exit 1
        ;;
esac

# Check if vocabulary.json exists
if [ ! -f "$VOCAB_FILE" ]; then
    echo "Error: $VOCAB_FILE not found"
    exit 1
fi

# Check if word exists
if ! jq -e ".words[] | select(.word == \"$WORD\")" "$VOCAB_FILE" > /dev/null 2>&1; then
    echo "Word '$WORD' not found"
    exit 1
fi

# Calculate new values based on Anki algorithm
# forgot: ease -0.20, interval * 0.1 (min 1)
# hard: ease -0.15, interval * 1.2
# good: ease unchanged, interval * ease
# easy: ease +0.15, interval * ease * 1.3

jq --arg word "$WORD" \
   --arg quality "$QUALITY" \
   --arg today "$TODAY" \
   '
   .words |= map(
     if .word == $word then
       (
         if $quality == "forgot" then
           .ease = ([.ease - 0.20, 1.3] | max) |
           .interval = ([(.interval * 0.1 | floor), 1] | max) |
           .repetitions = 0
         elif $quality == "hard" then
           .ease = ([.ease - 0.15, 1.3] | max) |
           .interval = ((.interval * 1.2) | floor) |
           .repetitions = .repetitions + 1
         elif $quality == "good" then
           .interval = ((.interval * .ease) | floor) |
           .repetitions = .repetitions + 1
         elif $quality == "easy" then
           .ease = .ease + 0.15 |
           .interval = ((.interval * .ease * 1.3) | floor) |
           .repetitions = .repetitions + 1
         else .
         end
       ) |
       .next_review = ($today | strptime("%Y-%m-%d") | mktime | . + (.interval * 86400) | strftime("%Y-%m-%d"))
     else .
     end
   )
   ' "$VOCAB_FILE" > "$VOCAB_FILE.tmp" && mv "$VOCAB_FILE.tmp" "$VOCAB_FILE"

echo "Marked '$WORD' as $QUALITY"
