# Feature Development Agent (-f)

## Purpose
Guide the complete feature development workflow from planning to PR creation, following best practices and clean code principles.

## Workflow

### 1. Review Current State
- Check GitHub issues via `gh issue list --state open`
- Read `readme.md` for roadmap/current priorities

### 2. Suggest Next Task
Based on roadmap and issues, suggest 2-3 options:

```
📋 Suggested Tasks:

1. [High Priority] Set up Tauri project structure
   - Why: Foundation for the app

2. [Medium Priority] Create vocabulary viewer component
   - Why: Core feature for word bank browsing

3. [Tech Debt] Refactor state management
   - Issue: #12
   - Why: Improves maintainability

Which task would you like to work on? (1/2/3 or describe your own)
```

### 3. Wait for User Confirmation
User responds with choice or custom description.

### 4. Create Feature Branch
**CRITICAL**: Branch name should be descriptive and lowercase with hyphens:
```bash
git checkout -b feature/vocabulary-viewer
```

### 5. Implement Feature
Follow clean code principles:
- **Single Responsibility**: Each class/method does one thing
- **Meaningful Names**: Clear, searchable names
- **Small Functions**: Functions should be small and focused
- **DRY**: Don't Repeat Yourself
- **Proper Error Handling**: Use exceptions appropriately

### 6. Make Atomic Commits
Each commit should:
- Address one logical change
- Have a clear, descriptive message
- **SINGLE LINE ONLY** - no multi-line commit messages
- **NEVER include Claude Code suffixes**

```bash
# Good commit messages
git commit -m "Add vocabulary table component"
git commit -m "Implement Anki algorithm for spaced repetition"
```

### 7. Create Pull Request (MANDATORY)
Push the branch and create the PR:

```bash
git push -u origin feature/vocabulary-viewer

gh pr create --title "Add vocabulary viewer" \
  --body "## Changes
- Added vocabulary table component
- Implemented filtering and search

## Testing
- [x] Manual testing complete

Closes #15"
```

### 8. Beep on Completion
```bash
powershell -c "[console]::beep(1000,1500)"
```

## Tech Debt Handling

**If tech debt found OUTSIDE current PR scope:**
1. **DO NOT fix it in current PR**
2. Create a GitHub issue
3. Continue with current feature

## Path Format
- Read/Write: Windows paths `c:\Users\wongp\Documents\projects\your-second-first-language\...`
- Bash/git: Unix paths `/c/Users/wongp/Documents/projects/your-second-first-language/...`

## Workflow Checklist (ALL REQUIRED)
Before beeping, verify ALL steps are done:
- [ ] Feature branch created
- [ ] Code implemented and tested
- [ ] **Tauri build passes** (`npm run tauri build`)
- [ ] Commits made with clean messages
- [ ] Branch pushed to remote
- [ ] **PR created** (link provided to user)

## After Every Task
```bash
powershell -c "[console]::beep(1000,1500)"
```
