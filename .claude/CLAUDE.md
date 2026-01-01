# Your Second First Language - Claude Code Configuration

**Repository**: https://github.com/wpinrui/your-second-first-language

## Project Overview
A language learning app that leverages Claude's conversational ability to provide immersive language practice. The app tracks learner progress through vocabulary and grammar JSON files using Anki-style spaced repetition.

## Tech Stack
- **Framework**: Tauri 2.x (Rust backend + WebView frontend)
- **Frontend**: React + TypeScript + Vite
- **AI**: Claude CLI (spawned by the app)
- **Data**: JSON files for vocabulary, grammar, and preferences

## Project Structure
```
your-second-first-language/
├── src/                        # React frontend
├── src-tauri/                  # Rust backend
├── templates/                  # Templates for language bootstrapping
│   ├── tutor-instructions.md   # CLAUDE.md template for language tutor
│   ├── vocabulary-schema.json
│   ├── grammar-schema.json
│   └── user-overrides-schema.json
├── scripts/
│   └── bootstrap-language.sh   # Self-contained language bootstrapper
├── .claude/
│   └── CLAUDE.md               # THIS FILE - dev agent instructions
└── agents/                     # Git workflow commands
    ├── g.md                    # Git cleanup
    ├── f.md                    # Feature development
    ├── m.md                    # Documentation
    └── r.md                    # Refactor
```

### Runtime Data (generated, not in repo)
```
data/
├── scripts/                    # Data modification scripts (generated)
└── {language}/                 # Per-language folder
    ├── CLAUDE.md               # Tutor instructions
    ├── vocabulary.json         # Word bank
    ├── grammar.json            # Grammar rules
    ├── user-overrides.json     # Preferences
    └── config.json             # Language settings
```

## Path Format Rules
**CRITICAL:**
- **Read/Write/Edit tools**: Windows paths: `c:\Users\wongp\Documents\projects\your-second-first-language\...`
- **Bash commands**: Unix paths: `/c/Users/wongp/Documents/projects/your-second-first-language/...`

## Architecture: How Modes Work

The app has 4 learning modes: **think-out-loud**, **chat**, **story**, **review**

**Mode handling is split between Rust and the template:**

1. **Rust backend** (`src-tauri/src/lib.rs`):
   - `send_message(message, language, mode)` receives the mode from frontend
   - `get_mode_prefix(mode)` adds mode-specific instructions as a prefix to the message
   - `think-out-loud` and `story` have hardcoded prefixes in Rust
   - `chat` has NO prefix - relies entirely on tutor-instructions.md

2. **Template** (`templates/tutor-instructions.md`):
   - Defines `learning/practicing/fluent` difficulty levels (stored in user-overrides.json → mode)
   - This is the difficulty level WITHIN chat mode, not the mode selector
   - Template uses `{{LANGUAGE_NAME}}` and other placeholders - it's language-agnostic

3. **File generation** (`lib.rs` lines 374-402):
   - `generate_language_files()` uses embedded templates (not files from templates/)
   - `USER_OVERRIDES_TEMPLATE` is hardcoded in lib.rs (line 29-37), NOT read from templates/user-overrides-schema.json
   - So updating the schema file does NOT update what gets generated

**Key insight:** To change tutor behavior:
- For chat mode: update `templates/tutor-instructions.md`
- For think-out-loud/story: update `get_mode_prefix()` in lib.rs
- For user-overrides defaults: update `USER_OVERRIDES_TEMPLATE` constant in lib.rs

## Development Principles
- Follow Clean Code and Uncle Bob principles
- Meaningful commit messages (no Claude Code suffixes)
- Feature branches for all new work
- Create GitHub issues for tech debt found outside PR scope

## Agent Behavior Principles
**Don't be shortsighted.** You are not the only agent working on this project.
- When you learn something, **update this file** so future agents benefit
- When you make a mistake, **document the fix here**
- Leave the codebase and docs better than you found them

## User Commands (refer to agents/*.md when used)
- `-g`: Git cleanup (switch to main, pull, delete feature branch)
- `-f`: Feature development (check issues, create branch, implement, PR)
- `-m`: Improve documentation
- `-r`: Refactor (fix tech debt, follow clean code principles)

## Beep Rules
**Beep = "I'm done, your turn"**

**DO beep when:**
- Task is complete
- Asking user a question
- Need user direction

**Do NOT beep:**
- Between chained operations
- After intermediate steps

```bash
powershell -c "[console]::beep(1000,1500)"
```

## Context Compaction Recovery

**When you see "This session is being continued from a previous conversation that ran out of context":**

1. **STOP** - Do not continue automatically
2. **BEEP** - Alert the user
3. **SUMMARIZE** - State what was done and what remains
4. **WAIT** - Wait for user direction

The compaction summary may be incomplete. Only the user knows what they actually want.
