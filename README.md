# IntentVision

**Universal Prediction Engine:** Connect sources → Normalize metrics → Forecast/anomaly → Explain → Alert/API/dashboard/agent.

## Quick Start

```bash
# Clone the repo
git clone git@github.com:intent-solutions-io/intentvision.git
cd intentvision

# Run local ARV check before pushing
./scripts/ci/arv-check.sh
```

## Project Structure

```
intentvision/
├── 000-docs/           # Documentation (strictly flat)
│   ├── 6767-*.md       # Canonical standards
│   ├── NNN-*.md        # Project documents
│   └── *-AA-AACR-*.md  # Phase AARs
├── .beads/             # Beads work tracking
├── .github/workflows/  # CI/CD
├── scripts/ci/         # ARV check scripts
├── infrastructure/     # Terraform (future)
├── services/           # Cloud Run services (future)
├── packages/           # Shared packages (future)
└── tools/              # Agent tooling (future)
```

## ARV Gate (CI/CD)

All PRs must pass the ARV Gate, which enforces:

| Check | Description |
|-------|-------------|
| 000-docs/ flatness | No subdirectories in 000-docs/ |
| 6767 standards | Required standards present |
| AAR template | Valid AAR template with Beads sections |
| Phase AARs | At least one phase AAR exists |
| Task IDs | Recent commits reference task IDs |
| Lint | Formatting baseline |
| Security | No secrets, forbidden files |

### Running ARV Locally

**Before every push**, run:

```bash
./scripts/ci/arv-check.sh
```

This runs the same checks that CI will run. Fix any failures before pushing.

### Individual Checks

```bash
# Run specific checks
./scripts/ci/check-docs-flat.sh
./scripts/ci/check-standards-present.sh
./scripts/ci/check-aar-template.sh
./scripts/ci/check-phase-aars.sh
./scripts/ci/check-task-ids.sh
./scripts/ci/check-lint.sh
./scripts/ci/check-security.sh
```

## Work Tracking (Beads)

This project uses [Beads](https://github.com/steveyegge/beads) for work tracking.

```bash
# View ready tasks
bd ready

# List all tasks
bd list

# Update task status
bd update <task-id> --status in_progress

# Close completed task
bd close <task-id> --reason "Implemented"
```

Every commit should reference a task ID:

```
feat: implement metrics spine

[Task: bd-xxxx]

🤖 Generated with Claude Code
```

## Documentation Standards

All documentation follows the [6767 Document Filing Standard](000-docs/6767-a-DR-STND-document-filing-system-standard-v4.md):

- **000-docs/** is strictly flat (no subdirectories)
- **6767-*** docs are canonical standards
- **NNN-*** docs are project-specific
- **Every phase produces an AAR**

## Phase Workflow

1. Work is tracked in Beads tasks
2. Commits reference task IDs
3. Phase completion produces an AAR in 000-docs/
4. ARV Gate validates compliance

## Key Documents

| Document | Description |
|----------|-------------|
| [6767-a](000-docs/6767-a-DR-STND-document-filing-system-standard-v4.md) | Document filing standard |
| [6767-b](000-docs/6767-b-AA-TMPL-after-action-report-template.md) | AAR template |
| [6767-f](000-docs/6767-f-DR-STND-work-tracking-beads-taskids.md) | Work tracking standard |
| [003-AT-ARCH](000-docs/003-AT-ARCH-cloud-implementation-plan.md) | Cloud implementation plan |

## Contributing

1. Create/claim a Beads task
2. Work on a feature branch
3. Reference task ID in commits
4. Run `./scripts/ci/arv-check.sh`
5. Open PR (ARV Gate runs automatically)
6. Update phase AAR when phase completes

---

*Intent Solutions IO — Universal Prediction Engine*
