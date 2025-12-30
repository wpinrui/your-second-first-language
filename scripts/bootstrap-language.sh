#!/bin/bash

# Bootstrap a new language for learning
# Usage: ./bootstrap-language.sh <language_name> <native_script> [romanization]
# Example: ./bootstrap-language.sh Chinese 汉字 pinyin
# Example: ./bootstrap-language.sh Korean 한글

set -e

# Get script directory (where templates are relative to)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEMPLATES_DIR="$PROJECT_ROOT/templates"

# Validate arguments
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <language_name> <native_script> [romanization]"
    echo "Example: $0 Chinese 汉字 pinyin"
    echo "Example: $0 Korean 한글"
    exit 1
fi

LANGUAGE_NAME="$1"
LANGUAGE_NATIVE="$2"
ROMANIZATION="${3:-none}"
LANGUAGE_LOWER=$(echo "$LANGUAGE_NAME" | tr '[:upper:]' '[:lower:]')

# Determine data directory (where the executable is run from)
DATA_DIR="./data"
LANG_DIR="$DATA_DIR/$LANGUAGE_LOWER"

# Check if language already exists
if [ -d "$LANG_DIR" ]; then
    echo "Error: Language '$LANGUAGE_NAME' already exists at $LANG_DIR"
    echo "Delete the folder first if you want to reset."
    exit 1
fi

# Create directories
echo "Creating $LANG_DIR..."
mkdir -p "$LANG_DIR"

# Create scripts directory and write scripts (self-contained, no copying)
if [ ! -d "$DATA_DIR/scripts" ]; then
    echo "Creating scripts in $DATA_DIR/scripts..."
    mkdir -p "$DATA_DIR/scripts"

    # Write add-word.sh
    cat > "$DATA_DIR/scripts/add-word.sh" << 'SCRIPT_EOF'
#!/bin/bash
set -e
VOCAB_FILE="./vocabulary.json"
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <word> <meaning>"
    exit 1
fi
WORD="$1"
MEANING="$2"
TODAY=$(date +%Y-%m-%d)
if [ ! -f "$VOCAB_FILE" ]; then
    echo "Error: $VOCAB_FILE not found"
    exit 1
fi
if jq -e ".words[] | select(.word == \"$WORD\")" "$VOCAB_FILE" > /dev/null 2>&1; then
    echo "Word '$WORD' already exists"
    exit 0
fi
jq --arg word "$WORD" --arg meaning "$MEANING" --arg date "$TODAY" \
   '.words += [{"word": $word, "meaning": $meaning, "ease": 2.3, "interval": 1, "repetitions": 0, "next_review": $date, "notes": ""}]' \
   "$VOCAB_FILE" > "$VOCAB_FILE.tmp" && mv "$VOCAB_FILE.tmp" "$VOCAB_FILE"
echo "Added word: $WORD"
SCRIPT_EOF
    chmod +x "$DATA_DIR/scripts/add-word.sh"

    # Write mark-word-recalled.sh
    cat > "$DATA_DIR/scripts/mark-word-recalled.sh" << 'SCRIPT_EOF'
#!/bin/bash
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
case "$QUALITY" in
    forgot|hard|good|easy) ;;
    *) echo "Invalid quality: $QUALITY"; exit 1 ;;
esac
if [ ! -f "$VOCAB_FILE" ]; then
    echo "Error: $VOCAB_FILE not found"
    exit 1
fi
if ! jq -e ".words[] | select(.word == \"$WORD\")" "$VOCAB_FILE" > /dev/null 2>&1; then
    echo "Word '$WORD' not found"
    exit 1
fi
jq --arg word "$WORD" --arg quality "$QUALITY" --arg today "$TODAY" '
   .words |= map(
     if .word == $word then
       (if $quality == "forgot" then .ease = ([.ease - 0.20, 1.3] | max) | .interval = ([(.interval * 0.1 | floor), 1] | max) | .repetitions = 0
        elif $quality == "hard" then .ease = ([.ease - 0.15, 1.3] | max) | .interval = ((.interval * 1.2) | floor) | .repetitions = .repetitions + 1
        elif $quality == "good" then .interval = ((.interval * .ease) | floor) | .repetitions = .repetitions + 1
        elif $quality == "easy" then .ease = .ease + 0.15 | .interval = ((.interval * .ease * 1.3) | floor) | .repetitions = .repetitions + 1
        else . end) |
       .next_review = ($today | strptime("%Y-%m-%d") | mktime | . + (.interval * 86400) | strftime("%Y-%m-%d"))
     else . end)' "$VOCAB_FILE" > "$VOCAB_FILE.tmp" && mv "$VOCAB_FILE.tmp" "$VOCAB_FILE"
echo "Marked '$WORD' as $QUALITY"
SCRIPT_EOF
    chmod +x "$DATA_DIR/scripts/mark-word-recalled.sh"

    # Write add-grammar.sh
    cat > "$DATA_DIR/scripts/add-grammar.sh" << 'SCRIPT_EOF'
#!/bin/bash
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
case "$LEVEL" in
    A1|A2|B1|B2|C1|C2) ;;
    *) echo "Invalid level: $LEVEL"; exit 1 ;;
esac
if [ ! -f "$GRAMMAR_FILE" ]; then
    echo "Error: $GRAMMAR_FILE not found"
    exit 1
fi
if jq -e ".rules[] | select(.rule == \"$RULE\")" "$GRAMMAR_FILE" > /dev/null 2>&1; then
    echo "Rule '$RULE' already exists"
    exit 0
fi
jq --arg rule "$RULE" --arg desc "$DESCRIPTION" --arg level "$LEVEL" --arg date "$TODAY" \
   '.rules += [{"rule": $rule, "description": $desc, "level": $level, "stars": 1, "last_used": $date, "correct_streak": 0, "permanent": false, "notes": ""}]' \
   "$GRAMMAR_FILE" > "$GRAMMAR_FILE.tmp" && mv "$GRAMMAR_FILE.tmp" "$GRAMMAR_FILE"
echo "Added grammar rule: $RULE"
SCRIPT_EOF
    chmod +x "$DATA_DIR/scripts/add-grammar.sh"

    # Write mark-grammar-used.sh
    cat > "$DATA_DIR/scripts/mark-grammar-used.sh" << 'SCRIPT_EOF'
#!/bin/bash
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
case "$CORRECT" in
    true|false) ;;
    *) echo "Invalid value: $CORRECT"; exit 1 ;;
esac
if [ ! -f "$GRAMMAR_FILE" ]; then
    echo "Error: $GRAMMAR_FILE not found"
    exit 1
fi
if ! jq -e ".rules[] | select(.rule == \"$RULE\")" "$GRAMMAR_FILE" > /dev/null 2>&1; then
    echo "Rule '$RULE' not found"
    exit 1
fi
jq --arg rule "$RULE" --argjson correct "$CORRECT" --arg today "$TODAY" '
   .rules |= map(
     if .rule == $rule then
       .last_used = $today |
       if $correct then .correct_streak = .correct_streak + 1 | .stars = ([.stars + 1, 5] | min) |
         if .stars == 5 and .correct_streak >= 5 then .permanent = true else . end
       else .correct_streak = 0 | .stars = ([.stars - 1, 1] | max) end
     else . end)' "$GRAMMAR_FILE" > "$GRAMMAR_FILE.tmp" && mv "$GRAMMAR_FILE.tmp" "$GRAMMAR_FILE"
echo "Marked '$RULE' as correct=$CORRECT"
SCRIPT_EOF
    chmod +x "$DATA_DIR/scripts/mark-grammar-used.sh"

    # Write adjust-difficulty.sh
    cat > "$DATA_DIR/scripts/adjust-difficulty.sh" << 'SCRIPT_EOF'
#!/bin/bash
set -e
OVERRIDES_FILE="./user-overrides.json"
if [ -z "$1" ]; then
    echo "Usage: $0 <direction> [reason]"
    echo "direction: easier, harder, auto, A1, A2, B1, B2, C1, C2"
    exit 1
fi
DIRECTION="$1"
REASON="${2:-}"
case "$DIRECTION" in
    easier|harder|auto|A1|A2|B1|B2|C1|C2) ;;
    *) echo "Invalid direction: $DIRECTION"; exit 1 ;;
esac
if [ ! -f "$OVERRIDES_FILE" ]; then
    echo "Error: $OVERRIDES_FILE not found"
    exit 1
fi
jq --arg level "$DIRECTION" --arg reason "$REASON" --arg date "$(date +%Y-%m-%d)" \
   '.difficulty.level = $level | .difficulty.notes = $reason | .adjustments += [{"date": $date, "direction": $level, "reason": $reason}]' \
   "$OVERRIDES_FILE" > "$OVERRIDES_FILE.tmp" && mv "$OVERRIDES_FILE.tmp" "$OVERRIDES_FILE"
echo "Adjusted difficulty to: $DIRECTION"
SCRIPT_EOF
    chmod +x "$DATA_DIR/scripts/adjust-difficulty.sh"

    # Write update-word-note.sh
    cat > "$DATA_DIR/scripts/update-word-note.sh" << 'SCRIPT_EOF'
#!/bin/bash
set -e
VOCAB_FILE="./vocabulary.json"
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <word> <note>"
    exit 1
fi
WORD="$1"
NOTE="$2"
if [ ! -f "$VOCAB_FILE" ]; then
    echo "Error: $VOCAB_FILE not found"
    exit 1
fi
if ! jq -e ".words[] | select(.word == \"$WORD\")" "$VOCAB_FILE" > /dev/null 2>&1; then
    echo "Word '$WORD' not found"
    exit 1
fi
jq --arg word "$WORD" --arg note "$NOTE" \
   '.words |= map(if .word == $word then .notes = $note else . end)' \
   "$VOCAB_FILE" > "$VOCAB_FILE.tmp" && mv "$VOCAB_FILE.tmp" "$VOCAB_FILE"
echo "Updated note for '$WORD'"
SCRIPT_EOF
    chmod +x "$DATA_DIR/scripts/update-word-note.sh"
fi

# Generate language-specific notes based on language
generate_language_notes() {
    case "$LANGUAGE_NAME" in
        Chinese|Mandarin)
            cat << 'EOF'
## Chinese-Specific Considerations

- **Tones**: Pay attention to tone usage in learner's pinyin (if provided)
- **Characters vs Pinyin**: Track if learner uses characters or pinyin
- **Measure words (量词)**: Track these as grammar constructs
- **Common structures**: 是...的, 把-sentences, 被-passive, 了/过/着 aspects
- **Cold start**: Use "👋 你好 (nǐ hǎo)" - one word with emoji and pinyin
EOF
            ;;
        Korean)
            cat << 'EOF'
## Korean-Specific Considerations

- **Politeness levels**: Track which speech levels the learner knows (합쇼체, 해요체, 해체, etc.)
- **Particles**: Track particles (은/는, 이/가, 을/를, etc.) as grammar
- **Verb conjugation**: Track tense and politeness conjugation patterns
- **Honorifics**: Note when learner uses/should use honorific forms
- **Cold start**: Use "👋 안녕 (annyeong)" - one word with emoji and romanization
EOF
            ;;
        Japanese)
            cat << 'EOF'
## Japanese-Specific Considerations

- **Politeness levels**: Track です/ます vs casual forms
- **Particles**: Track particles (は, が, を, に, で, etc.) as grammar
- **Verb groups**: Note which verb conjugation patterns learner knows
- **Kanji vs Kana**: Track which kanji the learner knows
- **Cold start**: Use "👋 こんにちは (konnichiwa)" - one word with emoji and romaji
EOF
            ;;
        Spanish)
            cat << 'EOF'
## Spanish-Specific Considerations

- **Verb conjugation**: Track which tenses and moods learner knows
- **Ser vs Estar**: Track as separate grammar constructs
- **Subjunctive**: Introduce gradually, it's complex
- **Gender agreement**: Track as grammar construct
- **Cold start**: Use "👋 Hola" - one word with emoji
EOF
            ;;
        French)
            cat << 'EOF'
## French-Specific Considerations

- **Verb conjugation**: Track which tenses and moods learner knows
- **Gender and articles**: Track as grammar constructs
- **Liaisons**: Note pronunciation patterns
- **Formal vs informal (tu/vous)**: Track which the learner uses
- **Cold start**: Use "👋 Bonjour" - one word with emoji
EOF
            ;;
        German)
            cat << 'EOF'
## German-Specific Considerations

- **Cases**: Track nominative, accusative, dative, genitive separately
- **Verb position**: Track V2 rule, subordinate clause order
- **Gender and articles**: Track der/die/das patterns
- **Formal vs informal (Sie/du)**: Track which the learner uses
- **Cold start**: Use "👋 Hallo" - one word with emoji
EOF
            ;;
        *)
            cat << EOF
## ${LANGUAGE_NAME}-Specific Considerations

- Research and add language-specific grammar patterns as you encounter them
- Pay attention to any unique features of this language
- Adapt greeting and teaching style to cultural norms
- Start with the simplest possible greeting and self-introduction
EOF
            ;;
    esac
}

# Generate CLAUDE.md from template
echo "Generating CLAUDE.md..."
LANGUAGE_NOTES=$(generate_language_notes)

sed -e "s/{{LANGUAGE_NAME}}/$LANGUAGE_NAME/g" \
    -e "s/{{LANGUAGE_NATIVE}}/$LANGUAGE_NATIVE/g" \
    -e "s/{{ROMANIZATION}}/$ROMANIZATION/g" \
    "$TEMPLATES_DIR/tutor-instructions.md" | \
    sed -e "/{{LANGUAGE_SPECIFIC_NOTES}}/r /dev/stdin" -e "/{{LANGUAGE_SPECIFIC_NOTES}}/d" \
    <<< "$LANGUAGE_NOTES" > "$LANG_DIR/CLAUDE.md"

# Actually, let's do this more simply
cat "$TEMPLATES_DIR/tutor-instructions.md" | \
    sed "s/{{LANGUAGE_NAME}}/$LANGUAGE_NAME/g" | \
    sed "s/{{LANGUAGE_NATIVE}}/$LANGUAGE_NATIVE/g" | \
    sed "s/{{ROMANIZATION}}/$ROMANIZATION/g" > "$LANG_DIR/CLAUDE.md.tmp"

# Replace the language-specific notes section
NOTES_FILE=$(mktemp)
generate_language_notes > "$NOTES_FILE"

# Use awk to replace the placeholder with file contents
awk -v notesfile="$NOTES_FILE" '
    /\{\{LANGUAGE_SPECIFIC_NOTES\}\}/ {
        while ((getline line < notesfile) > 0) print line
        close(notesfile)
        next
    }
    { print }
' "$LANG_DIR/CLAUDE.md.tmp" > "$LANG_DIR/CLAUDE.md"

rm "$LANG_DIR/CLAUDE.md.tmp" "$NOTES_FILE"

# Generate vocabulary.json from template
echo "Generating vocabulary.json..."
sed "s/{{LANGUAGE_NAME}}/$LANGUAGE_NAME/g" \
    "$TEMPLATES_DIR/vocabulary-schema.json" > "$LANG_DIR/vocabulary.json"

# Generate grammar.json from template
echo "Generating grammar.json..."
sed "s/{{LANGUAGE_NAME}}/$LANGUAGE_NAME/g" \
    "$TEMPLATES_DIR/grammar-schema.json" > "$LANG_DIR/grammar.json"

# Generate user-overrides.json from template
echo "Generating user-overrides.json..."
sed "s/{{LANGUAGE_NAME}}/$LANGUAGE_NAME/g" \
    "$TEMPLATES_DIR/user-overrides-schema.json" > "$LANG_DIR/user-overrides.json"

# Create config.json
echo "Generating config.json..."
cat > "$LANG_DIR/config.json" << EOF
{
  "language": "$LANGUAGE_NAME",
  "native_script": "$LANGUAGE_NATIVE",
  "romanization": "$ROMANIZATION",
  "started": "$(date +%Y-%m-%d)"
}
EOF

echo ""
echo "✅ Successfully bootstrapped $LANGUAGE_NAME!"
echo ""
echo "Created files:"
echo "  $LANG_DIR/CLAUDE.md          - Tutor instructions"
echo "  $LANG_DIR/vocabulary.json    - Word bank (empty)"
echo "  $LANG_DIR/grammar.json       - Grammar rules (empty)"
echo "  $LANG_DIR/user-overrides.json - Learner preferences"
echo "  $LANG_DIR/config.json        - Language settings"
echo ""
echo "To start learning, run claude from the $LANG_DIR directory."
