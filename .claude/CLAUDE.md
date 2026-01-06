# Your Second First Language - Claude Code Configuration

**Repository**: https://github.com/wpinrui/your-second-first-language

## Project Overview
A language learning app that leverages Claude's conversational ability to provide immersive language practice. The app tracks learner progress through vocabulary and grammar JSON files using Anki-style spaced repetition.

## Tech Stack
- **Framework**: Electron + Electron Forge (Node.js backend + Chromium frontend)
- **Frontend**: React + TypeScript + Vite
- **AI**: Claude CLI (spawned by the app)
- **Data**: JSON files for vocabulary, grammar, and preferences

## Project Structure
```
your-second-first-language/
├── src/                        # React frontend
├── electron/                   # Electron main process (TypeScript)
│   ├── main.ts                # Entry point, BrowserWindow
│   ├── preload.ts             # IPC bridge (contextBridge)
│   ├── ipc/                   # IPC handlers
│   │   ├── index.ts           # Register all handlers
│   │   ├── language.ts        # bootstrap, list, delete
│   │   ├── chat.ts            # sendMessage, getChatHistory
│   │   └── data.ts            # getVocabulary, getGrammar
│   └── services/              # Business logic
│       ├── fileService.ts     # Path handling, validation
│       ├── languageService.ts # Bootstrap, templates
│       ├── claudeService.ts   # CLI spawning, mode prefixes
│       └── sessionService.ts  # Session/JSONL management
├── templates/                  # Templates for reference (embedded in code)
├── forge.config.ts            # Electron Forge config
├── vite.main.config.ts        # Vite config for main process
├── vite.preload.config.ts     # Vite config for preload
├── vite.renderer.config.ts    # Vite config for React frontend
├── .claude/
│   └── CLAUDE.md              # THIS FILE - dev agent instructions
└── agents/                    # Git workflow commands
    ├── g.md                   # Git cleanup
    ├── f.md                   # Feature development
    ├── m.md                   # Documentation
    └── r.md                   # Refactor
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

## Development Commands
```bash
npm start      # Run in development mode
npm run package # Package the app
npm run make    # Create distributable
```

## Path Format Rules
**CRITICAL:**
- **Read/Write/Edit tools**: Windows paths: `c:\Users\...\your-second-first-language\...`
- **Bash commands**: Unix paths: `/c/Users/.../your-second-first-language/...`

## Architecture: How Modes Work

The app has 4 learning modes: **think-out-loud**, **chat**, **story**, **review**

**Mode handling is split between the main process and the template:**

1. **Electron main process** (`electron/services/claudeService.ts`):
   - `sendMessage(message, language, mode)` receives the mode from frontend
   - `getModePrefix(mode)` adds mode-specific instructions as a prefix to the message
   - `think-out-loud` and `story` have hardcoded prefixes
   - `chat` has NO prefix - relies entirely on tutor-instructions.md

2. **Template** (`electron/services/languageService.ts` - embedded):
   - Defines `learning/practicing/fluent` difficulty levels (stored in user-overrides.json → mode)
   - This is the difficulty level WITHIN chat mode, not the mode selector
   - Template uses `{{LANGUAGE_NAME}}` and other placeholders - it's language-agnostic

3. **File generation** (`languageService.ts`):
   - `bootstrapLanguage()` uses embedded templates as string constants
   - Templates are defined at the top of the file

**Key insight:** To change tutor behavior:
- For chat mode: update `TUTOR_TEMPLATE` in `electron/services/languageService.ts`
- For think-out-loud/story: update `getModePrefix()` in `electron/services/claudeService.ts`
- For user-overrides defaults: update `USER_OVERRIDES_TEMPLATE` in `languageService.ts`

## IPC Communication

Frontend uses `window.electronAPI.*` methods exposed via preload script:
- `bootstrapLanguage(language)` - Create new language
- `listLanguages()` - Get all languages
- `deleteLanguage(language)` - Remove language
- `sendMessage(message, language, mode)` - Send chat message
- `getChatHistory(language, mode)` - Load conversation
- `getVocabulary(language)` - Get vocabulary JSON
- `getGrammar(language)` - Get grammar JSON

Types are declared in `src/electron.d.ts`.

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
