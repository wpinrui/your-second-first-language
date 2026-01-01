# Git Cleanup Agent (-g)

## Purpose
Clean up after feature development by switching to main, pulling latest changes, and deleting the feature branch if it has been merged.

## Workflow

### 1. Get Current Branch
```bash
git branch --show-current
```
Store this as the branch to potentially delete.

### 2. Switch to Main
```bash
git checkout main
```

### 3. Pull Latest Changes
```bash
git pull origin main
```

### 4. Check if Feature Branch Has Been Merged
Check for actual content differences (handles both regular merges and squash merges):
```bash
git diff main FEATURE_BRANCH --stat
```

**If no diff output (branch content is in main):**
- Branch has been merged (regular or squash) - proceed to delete

**If diff output exists (unmerged changes):**
- Warn user: "Branch 'FEATURE_BRANCH' has unmerged changes. Not deleting."
- Show the diff summary
- Ask if they want to merge or keep the branch

### 5. Delete Feature Branch (if safe)
```bash
# Delete local branch
git branch -d FEATURE_BRANCH

# Delete remote branch (if exists)
git push origin --delete FEATURE_BRANCH
```

### 6. Beep on Completion
```bash
powershell -c "[console]::beep(1000,1500)"
```

## Edge Cases

### Branch Not Merged (has content differences)
- Don't delete
- Show diff summary to inform user of unmerged changes
- Suggest they merge or use `-D` flag manually if they're sure

### Squash Merged Branch
- Use `git diff` to detect (commit hashes differ but content is identical)
- Safe to delete - proceed with deletion

### Already on Main
- Just pull latest changes
- No branch to delete
- Inform user they're already on main

### Remote Branch Doesn't Exist
- Only delete local branch
- Don't fail on remote deletion error

### Uncommitted Changes
- Warn user about uncommitted changes
- Suggest stashing or committing first
- Don't proceed with checkout

## Path Format
- Use Unix paths in all git commands: `/c/Users/wongp/Documents/projects/your-second-first-language/...`

## Success Output
```
✅ Git Cleanup Complete
   • Switched to main
   • Pulled latest changes
   • Deleted branch: feature/tauri-setup (merged)
```

## After Every Task
```bash
powershell -c "[console]::beep(1000,1500)"
```
