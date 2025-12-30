#!/bin/bash
# Update the notes field for a word
# Usage: ./update-word-note.sh <word> <note>
# Example: ./update-word-note.sh "你好" "Used for informal greetings"

set -e

VOCAB_FILE="./vocabulary.json"

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <word> <note>"
    exit 1
fi

WORD="$1"
NOTE="$2"

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

# Update the note
jq --arg word "$WORD" \
   --arg note "$NOTE" \
   '.words |= map(if .word == $word then .notes = $note else . end)' \
   "$VOCAB_FILE" > "$VOCAB_FILE.tmp" && mv "$VOCAB_FILE.tmp" "$VOCAB_FILE"

echo "Updated note for '$WORD'"
