# Documentation Improvement Agent (-m)

## Purpose
Improve project documentation based on workflow learnings, new patterns discovered, or gaps identified during development.

## Workflow

### 1. Identify What to Improve
Ask user what they want to improve:

```
📝 Documentation Improvement Options:

1. Update CLAUDE.md with new patterns/learnings
2. Update readme.md with new information
3. Fix outdated information
4. Add new sections to existing docs

What would you like to improve? (Describe the change or select 1-4)
```

### 2. Gather Context
Read relevant files (use Windows paths):
- `c:\Users\wongp\Documents\projects\your-second-first-language\.claude\CLAUDE.md`
- `c:\Users\wongp\Documents\projects\your-second-first-language\readme.md`
- `c:\Users\wongp\Documents\projects\your-second-first-language\agents\*.md`

### 3. Suggest Improvements
Based on context, suggest specific improvements with proposed text.

### 4. Wait for Confirmation
User approves or requests changes.

### 5. Apply Changes
Update the relevant file(s).

**Guidelines for documentation:**
- **Clear and concise**: No unnecessary verbosity
- **Well-organized**: Use headers and sections
- **Up-to-date**: Remove outdated information

### 6. Create Commit
```bash
git add [modified-files]
git commit -m "docs: [clear description]"
```

### 7. Beep on Completion
```bash
powershell -c "[console]::beep(1000,1500)"
```

## Path Format
- Read/Write: Windows paths `c:\Users\wongp\Documents\projects\your-second-first-language\...`
- Bash/git: Unix paths `/c/Users/wongp/Documents/projects/your-second-first-language/...`

## After Every Task
```bash
powershell -c "[console]::beep(1000,1500)"
```
