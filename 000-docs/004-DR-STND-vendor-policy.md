# Vendor & Third-Party Dependency Policy

**Purpose:** Define how external dependencies are pinned, tracked, and upgraded safely in IntentVision.
**Version:** 1.0.0
**Last Updated:** 2025-12-15

---

## Overview

IntentVision relies on external systems (Beads, AgentFS) and standard dependencies (npm, Python, Terraform). This policy ensures reproducible builds, security compliance, and safe upgrades.

**Core Principle:** Every dependency is pinned; every upgrade is deliberate.

---

## Dependency Categories

### Tier 1: Core External Systems

Critical systems that define project architecture:

| System | Repository | Purpose |
|--------|------------|---------|
| Beads | `github.com/steveyegge/beads` | Work graph / issue tracking |
| AgentFS | `github.com/tursodatabase/agentfs` | Agent audit ledger |

### Tier 2: Infrastructure Dependencies

Cloud and deployment tooling:

| Category | Examples |
|----------|----------|
| Terraform providers | `google`, `google-beta` |
| GitHub Actions | `google-github-actions/*`, `actions/*` |
| Container base images | `gcr.io/distroless/*`, `node:*-alpine` |

### Tier 3: Application Dependencies

Runtime and development packages:

| Category | Lock Files |
|----------|------------|
| Node.js | `package-lock.json` |
| Python | `requirements.txt` + hash pins |
| Go | `go.sum` |

---

## Pinning Strategy

### Tier 1: Commit Hash Pinning

Core external systems are pinned to specific commit hashes:

```yaml
# .github/dependencies.yaml
tier1:
  beads:
    repo: steveyegge/beads
    ref: abc123def456789...  # Full 40-char SHA
    last_verified: 2025-12-15
    upgrade_policy: manual_review

  agentfs:
    repo: tursodatabase/agentfs
    ref: 789xyz012345abc...  # Full 40-char SHA
    last_verified: 2025-12-15
    upgrade_policy: manual_review
```

**Why commit hashes?**
- Tags can be moved/deleted
- Branches change continuously
- Hashes are immutable and auditable

### Tier 2: Version + Integrity Pinning

Infrastructure dependencies use semantic versions with integrity checks:

```hcl
# Terraform
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "= 5.12.0"  # Exact version, not range
    }
  }
}
```

```yaml
# GitHub Actions
- uses: google-github-actions/auth@v2.1.0
  # Pin to specific version tag, not @v2 or @main
```

### Tier 3: Lock File Enforcement

Application dependencies use lock files with integrity hashes:

```bash
# Node.js - always use ci for reproducibility
npm ci  # Uses package-lock.json exactly

# Python - use hash-pinned requirements
pip install --require-hashes -r requirements.txt
```

---

## Dependency Tracking File

Maintain `.github/dependencies.yaml` as the source of truth:

```yaml
# IntentVision Dependency Manifest
# Last Updated: 2025-12-15

tier1:
  beads:
    repo: steveyegge/beads
    ref: <commit-sha>
    install: npm install -g @beads/bd@<version>
    last_verified: 2025-12-15
    changelog_url: https://github.com/steveyegge/beads/releases

  agentfs:
    repo: tursodatabase/agentfs
    ref: <commit-sha>
    install: npm install -g agentfs-cli@<version>
    last_verified: 2025-12-15
    changelog_url: https://github.com/tursodatabase/agentfs/releases

tier2:
  terraform_google:
    version: 5.12.0
    last_verified: 2025-12-15

  actions_checkout:
    version: v4.1.1
    last_verified: 2025-12-15

tier3:
  # Lock files handle these automatically
  node: package-lock.json
  python: requirements.txt
```

---

## Safe Upgrade Process

### Step 1: Review Changelog

Before any upgrade:

```bash
# Check what changed
gh release view --repo steveyegge/beads v0.20.2
gh release view --repo tursodatabase/agentfs v1.0.0
```

### Step 2: Test in Isolation

```bash
# Create upgrade branch
git checkout -b upgrade/beads-v0.20.2

# Update pin
# Edit .github/dependencies.yaml with new ref

# Run full test suite
./scripts/ci/arv-check.sh

# Run integration tests
npm test
```

### Step 3: Document Changes

Create an upgrade AAR in `000-docs/`:

```
NNN-OD-CHNG-beads-upgrade-v0.20.2.md
```

### Step 4: PR Review

- Require at least 1 approval
- CI must pass
- Security scan must pass
- Changelog must be reviewed

### Step 5: Staged Rollout

For Tier 1 dependencies:

1. Merge to `main`
2. Deploy to `dev` environment
3. Monitor for 24 hours
4. Deploy to `staging`
5. Monitor for 48 hours
6. Deploy to `prod`

---

## Version Constraint Rules

| Tier | Constraint Style | Example |
|------|------------------|---------|
| Tier 1 | Exact commit hash | `abc123def...` |
| Tier 2 | Exact version | `= 5.12.0`, `v4.1.1` |
| Tier 3 | Lock file | `package-lock.json` |

**Never allowed:**
- `^` or `~` ranges in production
- `latest` tags
- Branch references (except in development)
- Unverified dependencies

---

## Security Scanning

### Automated Checks

```yaml
# Part of ARV gate
- name: Audit dependencies
  run: |
    npm audit --production
    pip-audit -r requirements.txt
    trivy fs --severity HIGH,CRITICAL .
```

### Vulnerability Response

| Severity | Response Time | Action |
|----------|---------------|--------|
| Critical | 24 hours | Emergency upgrade or patch |
| High | 7 days | Prioritized upgrade |
| Medium | 30 days | Scheduled upgrade |
| Low | Next release | Batch with other updates |

---

## Dependency Review Checklist

Before adding any new dependency:

- [ ] Is this dependency actively maintained?
- [ ] Does it have a security policy?
- [ ] Is the license compatible (MIT, Apache 2.0, BSD)?
- [ ] Is there a simpler alternative?
- [ ] Can we vendor/inline instead?
- [ ] What's the transitive dependency impact?
- [ ] Is there a published security audit?

---

## Vendoring Policy

For critical dependencies, consider vendoring:

```
vendor/
├── beads/           # Optional: vendored Beads source
│   ├── LICENSE
│   ├── version.txt  # Pinned version/commit
│   └── ...
└── agentfs/
    ├── LICENSE
    ├── version.txt
    └── ...
```

**When to vendor:**
- Dependency is end-of-life but still needed
- Custom patches required
- Extreme reproducibility requirements
- Air-gapped deployments

**When NOT to vendor:**
- Active development (prefer upstream)
- Security-sensitive (need upstream patches)
- Large transitive dependencies

---

## CI Enforcement

The ARV gate validates dependency hygiene:

1. **Lock file check:** Lock files must be committed and up-to-date
2. **No floating versions:** Direct dependencies cannot use ranges
3. **Security audit:** All dependencies pass vulnerability scan
4. **License compliance:** All licenses are pre-approved

---

## References

- [Beads Repository](https://github.com/steveyegge/beads)
- [AgentFS Repository](https://github.com/tursodatabase/agentfs)
- [npm Security Best Practices](https://docs.npmjs.com/security-best-practices)
- [Terraform Provider Versioning](https://developer.hashicorp.com/terraform/language/providers/requirements)
