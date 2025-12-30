#!/bin/bash
# Add a new word to vocabulary.json
# Usage: ./add-word.sh <word> <meaning>
# Example: ./add-word.sh "你好" "hello"

set -e

VOCAB_FILE="./vocabulary.json"

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <word> <meaning>"
    exit 1
fi

WORD="$1"
MEANING="$2"
TODAY=$(date +%Y-%m-%d)

# Check if vocabulary.json exists
if [ ! -f "$VOCAB_FILE" ]; then
    echo "Error: $VOCAB_FILE not found"
    exit 1
fi

# Check if word already exists
if jq -e ".words[] | select(.word == \"$WORD\")" "$VOCAB_FILE" > /dev/null 2>&1; then
    echo "Word '$WORD' already exists"
    exit 0
fi

# Add the new word
jq --arg word "$WORD" \
   --arg meaning "$MEANING" \
   --arg date "$TODAY" \
   '.words += [{
     "word": $word,
     "meaning": $meaning,
     "ease": 2.3,
     "interval": 1,
     "repetitions": 0,
     "next_review": $date,
     "notes": ""
   }]' "$VOCAB_FILE" > "$VOCAB_FILE.tmp" && mv "$VOCAB_FILE.tmp" "$VOCAB_FILE"

echo "Added word: $WORD"
