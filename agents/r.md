# Refactor Agent (-r)

## Purpose
Scan codebase, fix bugs, reduce tech debt, apply clean code principles. Focus on maintainability without changing external behavior.

## Workflow

### 1. Scan Codebase
Look for:
- Long methods (> 20 lines)
- Large classes (> 300 lines)
- Duplicate code
- Magic numbers
- Unclear names
- Multiple responsibilities
- Deep nesting (> 3 levels)
- Commented-out code
- Missing error handling
- Bugs

### 2. Prioritize by Severity
- CRITICAL: Bugs, null safety issues, security problems
- HIGH: Multiple responsibilities, large classes
- MEDIUM: Duplication, magic numbers, unclear names
- LOW: Minor formatting

### 3. Fix Issues Automatically
Start with CRITICAL -> HIGH -> MEDIUM. For each issue:
- Apply fix following clean code principles
- Make atomic commit
- Move to next issue

### 4. Discovering existing tech debt
If refactor is required but is not due to this PR, create GitHub issue with:
- Problem description
- Suggested fix
- Impact level
- Label as "tech-debt"

### 5. Commit and Push
**Commit on the current branch. Always. No exceptions.**

Each commit:
- Addresses one logical change
- Clear message (no Claude suffixes)
- **SINGLE LINE ONLY**

```bash
git commit -m "Refactor: extract vocabulary parser into separate module"
git commit -m "Fix: handle empty grammar file gracefully"
```

## Clean Code Checklist
Before committing:
- No behavior change (unless fixing bug)
- Tests pass
- **Tauri build passes** (`npm run tauri build`)
- Functions < 20 lines
- Classes have single responsibility
- Clear, searchable names
- No magic numbers
- No duplication
- Proper error handling
- No commented-out code

## Path Format
- Read/Write: Windows paths `c:\Users\wongp\Documents\projects\your-second-first-language\...`
- Bash/git: Unix paths `/c/Users/wongp/Documents/projects/your-second-first-language/...`

## After Every Task
```bash
powershell -c "[console]::beep(1000,1500)"
```

Summarise with ## NUMBER OF REFACTORS APPLIED: xxx
