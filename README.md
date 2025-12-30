# Your Second First Language

Learn a new language the way you learned your first—through immersion, not translation.

## Philosophy

Traditional language learning treats your target language as a puzzle to decode back into English. This app flips that: it teaches you to **think** in your new language from day one.

- **No English crutch** — The tutor only uses the target language (with rare exceptions for single-word lookups)
- **Organic progression** — Grammar and vocabulary are introduced naturally through conversation, not drills
- **Adaptive difficulty** — The system tracks what you know and stays at your level
- **First-language acquisition** — Mimics how children learn: context, repetition, gentle correction

## Features

### Four Learning Modes

| Mode | Description |
|------|-------------|
| **Think-Out-Loud** | Narrate your thoughts in the target language. The tutor echoes back corrections without explanation—just models correct usage. |
| **Chat** | Natural conversation practice. The tutor only uses grammar/vocabulary you've seen before, introducing new material gradually. |
| **Story** | Request a story on any topic. The tutor writes at your reading level using mostly familiar constructs. Then discuss it. |
| **Review** | Explicit drilling of vocabulary due for review (spaced repetition) and grammar that needs reinforcement. |

### Intelligent Tracking

**Vocabulary** — Anki-style spaced repetition
- Each word tracks: ease factor, interval, repetitions, next review date
- Responses (forgot/hard/good/easy) adjust the algorithm
- Words become "permanently learned" after 180+ day intervals

**Grammar** — Star rating system (0-5)
- Rules are rated by proficiency: Introduced → Struggling → Developing → Proficient → Mastered
- Tracks correct streak and last usage
- Rules become "permanent" after consistent mastery (no longer explicitly tested)

**User Preferences** — Adjustable difficulty
- Learner can request easier/harder content
- Configurable: max new words per exchange, grammar introduction threshold, romanization display

### Cold Start

On your very first interaction, the tutor presents a single word:

```
👋 你好 (nǐ hǎo)
```

One word. With emoji context. With pronunciation. Let it sink in.

Vocabulary and grammar are built one piece at a time through natural use.

## Tech Stack

- **Framework**: Tauri 2.x (Rust backend + WebView frontend)
- **Frontend**: React + TypeScript + Vite
- **AI**: Claude via CLI (spawned by the app)
- **Data**: JSON files for vocabulary, grammar, and preferences

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Tauri App                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Mode UI   │  │  Word Bank  │  │  Grammar Viewer     │  │
│  │  (React)    │  │  (React)    │  │  (React)            │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │            │
│         └────────────────┴─────────────────────┘            │
│                          │                                  │
│  ┌───────────────────────▼───────────────────────────────┐  │
│  │                   Rust Backend                        │  │
│  │  • Spawns Claude CLI for conversations                │  │
│  │  • Manages data/{language}/ files                     │  │
│  │  • Executes scripts for data updates                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    data/{language}/                         │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐   │
│  │ CLAUDE.md    │ │vocabulary.json│ │ grammar.json      │   │
│  │ (tutor       │ │ (word bank)  │ │ (grammar rules)   │   │
│  │  instructions)│ │              │ │                   │   │
│  └──────────────┘ └──────────────┘ └────────────────────┘   │
│  ┌────────────────────┐ ┌────────────────────────────────┐  │
│  │ user-overrides.json│ │ ../scripts/ (data modifiers)  │  │
│  └────────────────────┘ └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Learner sends message** → App forwards to Claude (with CLAUDE.md context)
2. **Claude reads** vocabulary.json, grammar.json, user-overrides.json
3. **Claude responds** in target language (respecting learner's level)
4. **Claude runs scripts** to update vocabulary/grammar based on interaction
5. **App displays** response with syntax highlighting for new words

### Scripts (Finite State Machine)

The tutor agent doesn't edit JSON directly. It runs controlled scripts:

| Script | Purpose |
|--------|---------|
| `add-word.sh` | Add new vocabulary |
| `mark-word-recalled.sh` | Update word after recall (forgot/hard/good/easy) |
| `add-grammar.sh` | Add new grammar rule |
| `mark-grammar-used.sh` | Update grammar after usage (correct/incorrect) |
| `adjust-difficulty.sh` | Change difficulty level |
| `update-word-note.sh` | Add learner notes to a word |

This ensures all data modifications are predictable and syntax-safe.

## Project Structure

```
your-second-first-language/
├── src/                        # React frontend
├── src-tauri/                  # Rust backend
├── templates/                  # Templates for language bootstrapping
│   ├── tutor-instructions.md   # CLAUDE.md template
│   ├── vocabulary-schema.json
│   ├── grammar-schema.json
│   └── user-overrides-schema.json
├── scripts/
│   └── bootstrap-language.sh   # Self-contained language bootstrapper
├── .claude/
│   └── CLAUDE.md               # Instructions for development agent
└── agents/                     # Git workflow commands
    ├── g.md                    # Git cleanup
    ├── f.md                    # Feature development
    ├── m.md                    # Documentation
    └── r.md                    # Refactor
```

### Runtime Data (generated, not in repo)

```
data/
├── scripts/                    # Data modification scripts
└── {language}/                 # Per-language folder
    ├── CLAUDE.md               # Tutor instructions
    ├── vocabulary.json         # Word bank
    ├── grammar.json            # Grammar rules
    ├── user-overrides.json     # Preferences
    └── config.json             # Language settings
```

## Getting Started

### Prerequisites

- Node.js 18+
- Rust (for Tauri)
- Claude CLI installed and authenticated (`claude` command works)
- `jq` (for JSON manipulation in scripts)

### Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Bootstrap a Language (CLI)

Before the app is built, you can test with:

```bash
# From project root
./scripts/bootstrap-language.sh Chinese 汉字 pinyin

# Then run Claude in the language folder
cd data/chinese
claude
```

## Supported Languages

The bootstrap script has specific configurations for:
- Chinese (Mandarin)
- Korean
- Japanese
- Spanish
- French
- German

Other languages work too—the tutor will adapt.

## Key Design Decisions

### Why read-only + scripts?

Having the AI agent directly edit JSON risks syntax errors and unpredictable changes. By routing all modifications through scripts, we get:
- Guaranteed valid JSON
- Predictable state transitions
- Easy debugging (script logs)
- Finite state machine behavior

### Why no English?

Language immersion research shows that translation-based learning creates a dependency on the native language. By forcing target-language-only interaction, learners develop direct associations between concepts and words.

### Why Anki algorithm?

Spaced repetition is the most evidence-backed method for vocabulary retention. The SM-2 algorithm (used by Anki) has decades of research behind it.

### Why organic grammar?

Rather than front-loading a syllabus, grammar rules are added as they're encountered or introduced. This mirrors natural acquisition and ensures rules are always contextually relevant.

## License

MIT
