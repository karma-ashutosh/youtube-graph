# How to Use the .todos System

This directory contains organized, actionable tasks for future development sessions.

## Philosophy

**Problem**: In fresh sessions, context is lost. You need to remember what to work on and how.

**Solution**: Store structured todos in markdown files with:
- Clear goals and context
- Step-by-step implementation guides
- Acceptance criteria
- Estimated time
- Status tracking

## Structure

```
.todos/
├── HOW_TO_USE.md                    (this file)
├── 01-discoverability-improvements/  (feature area)
│   ├── README.md                     (status overview)
│   ├── 01-og-images.md               (individual task)
│   ├── 02-blog-system.md
│   └── ...
└── 02-another-feature/
    └── ...
```

## Workflow

### Starting a New Session

1. **Read the overview**
   ```bash
   cat .todos/01-discoverability-improvements/README.md
   ```

2. **Pick a task** based on status and priority

3. **Read the task file** for implementation details

4. **Update status** as you work:
   - ⚪ Not Started → 🔵 In Progress
   - 🔵 In Progress → 🟢 Completed

5. **Update README.md** when task is done

### When All Tasks in a Folder Are Complete

1. Update the folder's README status to 🟢 Completed
2. Move the folder to `.todos/archive/` (optional)
3. Or keep it for reference

### Creating New Task Folders

When planning a new feature area:

```bash
mkdir -p .todos/XX-feature-name
```

Create a README.md with the task list table and individual markdown files for each task.

**Template**: Copy structure from `01-discoverability-improvements/`

## Best Practices

### ✅ Do
- Keep tasks atomic (2-4 hours max)
- Include code snippets and examples
- List exact files to create/modify
- Add links to documentation
- Update status frequently
- Add dependencies between tasks
- Include testing checklists

### ❌ Don't
- Create vague tasks without steps
- Forget to update status
- Mix unrelated tasks in one file
- Leave outdated information
- Skip acceptance criteria

## Task File Template

```markdown
# Task N: Title

**Status**: ⚪ Not Started
**Priority**: P1
**Estimated Time**: 2-3 hours

## Goal
Clear one-sentence goal.

## Context
Why we need this. Background information.

## Implementation Steps

### Step 1: Title (time estimate)
Detailed instructions with code examples.

### Step 2: Title (time estimate)
More instructions.

## Acceptance Criteria
- [ ] Checklist item 1
- [ ] Checklist item 2

## Dependencies
- Task X must be completed first
- Need API key from service Y

## Files to Create/Modify
- `path/to/new/file.ts` (new)
- `path/to/existing/file.ts` (modify)

## Testing
How to verify it works.

## Notes
Additional context, edge cases, future considerations.
```

## Status Indicators

| Icon | Status | Meaning |
|------|--------|---------|
| ⚪ | Not Started | Ready to work on |
| 🔵 | In Progress | Currently being worked on |
| 🟢 | Completed | Fully done and tested |
| 🔴 | Blocked | Can't proceed (dependency, bug, decision needed) |
| ⏸️ | On Hold | Paused for now (priority changed, waiting) |

## Priority Levels

- **P0**: Critical - Do this first
- **P1**: High - Do soon
- **P2**: Medium - Nice to have
- **P3**: Low - Future consideration

## Tips for Claude Code

When starting a fresh session:

1. **Prompt example**:
   ```
   I want to work on discoverability improvements.
   Check .todos/01-discoverability-improvements/ and help me with the next task.
   ```

2. **Let Claude read the files**:
   - It will read README.md for overview
   - Pick the next not-started task
   - Read that task file for details
   - Start implementation

3. **Update status as you go**:
   - Mark task as in-progress when starting
   - Update README when done
   - Commit changes to .todos/ files

## Version Control

**Should .todos/ be committed?**

✅ **Yes, commit it!**

**Reasons**:
- Shares tasks across team members
- Preserves planning across sessions
- Documents decisions and context
- Acts as lightweight project management

**What to commit**:
- All markdown files
- Status updates
- Completed tasks (for history)

**What NOT to commit**:
- Temporary notes in `.todos/scratch/`
- Personal todos in `.todos/personal/`

Add to `.gitignore` if needed:
```
.todos/scratch/
.todos/personal/
```

## Example Usage

```bash
# Start new session
cd .todos/01-discoverability-improvements
cat README.md

# Work on task 1
cat 01-og-images.md
# ... implement ...
# Update README.md: ⚪ → 🟢

# Work on task 2
cat 02-blog-system.md
# ... implement ...

# When folder is done
mv ../01-discoverability-improvements ../archive/
```

## Integration with TodoWrite Tool

While working, use the TodoWrite tool to track sub-tasks within a session:

```typescript
// Session-level tracking
TodoWrite([
  { content: "Convert video page to server component", status: "in_progress" },
  { content: "Add generateMetadata function", status: "pending" },
  { content: "Test OG images", status: "pending" },
]);
```

The .todos/ system is for **cross-session persistence**, while TodoWrite is for **within-session tracking**.

## FAQ

**Q: Should every feature have a .todos folder?**
A: Only for multi-step features or work that spans sessions. Simple one-off changes don't need it.

**Q: What if a task becomes outdated?**
A: Mark it as ⏸️ On Hold or 🔴 Blocked and add a note explaining why. Don't delete it—context is valuable.

**Q: Can I have nested task folders?**
A: Yes! For large features, use:
```
.todos/01-feature/
  01-backend/
  02-frontend/
  03-testing/
```

**Q: How do I handle task dependencies?**
A: List them in the task file under "Dependencies" section. Update the README.md to show task order.

---

Happy coding! 🚀
