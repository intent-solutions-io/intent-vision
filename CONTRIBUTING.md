# Contributing to Intent-Vision

## Git Workflow

**Main branch is the source of truth.** All features and fixes go through feature branches and PRs.

### Branch Naming

```
feature/phase-X-description    # New features/phases
fix/description                # Bug fixes
chore/description              # Maintenance tasks
```

### Workflow

1. **Create feature branch from main**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/phase-X-description
   ```

2. **Make commits with natural language messages**
   ```bash
   git commit -m "Add user authentication endpoint"
   git commit -m "Fix token refresh logic for expired sessions"
   git commit -m "Update tests for new auth flow"
   ```

3. **Push and create PR**
   ```bash
   git push -u origin feature/phase-X-description
   gh pr create --title "Phase X: Description" --body "..."
   ```

4. **Wait for required reviews**
   - @jeremylongshore (Code Owner) - REQUIRED
   - Gemini Code Assist (automated) - REQUIRED

5. **Merge after approval**
   - PRs cannot be merged until both reviews pass
   - Stale reviews are dismissed on new pushes

### Commit Message Guidelines

Use clear, natural language:
- `Add user registration with email verification`
- `Fix rate limiting on forecast endpoint`
- `Update pipeline to support batch ingestion`
- `Remove deprecated auth middleware`

Bad examples:
- `wip`
- `fix`
- `update stuff`

### Pre-Push Checklist

```bash
npm test                      # All tests pass
npm run typecheck             # No TypeScript errors
./scripts/ci/arv-check.sh     # ARV gate passes
```

### Branch Protection Rules

The `main` branch has these protections:
- Require 1 approving review
- Require CODEOWNERS review
- Dismiss stale reviews on new pushes
- Require conversation resolution
- No force pushes
- No deletions

### Beads Task Tracking

All work should have a beads task:

```bash
bd create "Phase X: Description" -t epic -p 1
bd update intentvision-xxx --status in_progress  # Start work
bd close intentvision-xxx --reason "PR merged"   # Complete work
```

Include task ID in PR description.
