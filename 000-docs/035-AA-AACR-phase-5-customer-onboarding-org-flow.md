# Phase 5 AAR - Customer Onboarding + Org/API Key Flow

> Minimal dashboard shell, user-configurable onboarding, and chargeable SaaS surface

---

## Metadata

| Field | Value |
|-------|-------|
| **Phase** | `5 - Customer Onboarding + Org/API Key Flow` |
| **Repo/App** | `intentvision` |
| **Owner** | Engineering |
| **Date/Time (CST)** | 2025-12-15 |
| **Status** | `FINAL` |
| **Related Issues/PRs** | Epic: `intentvision-p5` |
| **Commit(s)** | Pending |

---

## Beads / Task IDs Touched

| Task ID | Status | Title |
|---------|--------|-------|
| `intentvision-p5` | `completed` | Phase 5: Customer Onboarding Epic |
| `intentvision-p5.1` | `completed` | 5.1 Extend Firestore schema with users collection |
| `intentvision-p5.2` | `completed` | 5.2 Create Firestore org service module |
| `intentvision-p5.3` | `completed` | 5.3 Implement internal operator API endpoints |
| `intentvision-p5.4` | `completed` | 5.4 Implement /v1/me endpoints for dashboard |
| `intentvision-p5.5` | `completed` | 5.5 Create frontend dashboard shell |
| `intentvision-p5.6` | `completed` | 5.6 Create onboarding page |
| `intentvision-p5.7` | `completed` | 5.7 Add phase completion utility script |
| `intentvision-p5.8` | `completed` | 5.8 Update CLAUDE.md with hooks |
| `intentvision-p5.9` | `completed` | 5.9 Create Phase 5 AAR |

**Beads Status:** `Active`

---

## Executive Summary

- Extended Firestore schema with `users` collection linked to Firebase Auth
- Created organization service module with CRUD operations and onboarding flow
- Implemented internal operator API endpoints (`/v1/internal/organizations/*`)
- Implemented customer dashboard endpoints (`/v1/me`, `/v1/me/apiKeys`)
- Built minimal React + Vite dashboard shell with landing, onboarding, and dashboard pages
- Added phase completion utility script for validation
- Updated CLAUDE.md with Phase 5 API documentation

---

## What Changed

### Schema Extensions (`packages/api/src/firestore/schema.ts`)

| Type | Change | Purpose |
|------|--------|---------|
| `User` | New interface | Firebase Auth-linked user with org membership |
| `UserRole` | New type | `owner`, `admin`, `member`, `viewer` |
| `OrganizationPlan` | Updated | Changed `trial` to `beta` per Phase 5 spec |
| `COLLECTIONS.users` | Added | Top-level users collection path |

### New Services (`packages/api/src/services/org-service.ts`)

| Function | Purpose |
|----------|---------|
| `createOrganization()` | Create new organization |
| `getOrganizationById()` | Get org by ID |
| `getOrganizationBySlug()` | Get org by URL slug |
| `updateOrganization()` | Update org fields |
| `listOrganizations()` | List all orgs (admin) |
| `createUser()` | Create user linked to org |
| `getUserByAuthUid()` | Get user by Firebase Auth UID |
| `getUserById()` | Get user by ID |
| `getUsersByOrganization()` | List org members |
| `updateUserRole()` | Change user role |
| `createOnboardedOrganization()` | Combined org + owner creation |

### Internal API (`packages/api/src/routes/internal.ts`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/internal/organizations` | POST | Create organization |
| `/v1/internal/organizations` | GET | List organizations |
| `/v1/internal/organizations/:orgId` | GET | Get organization |
| `/v1/internal/organizations/:orgId/apiKeys` | POST | Create API key |
| `/v1/internal/organizations/:orgId/apiKeys` | GET | List API keys |
| `/v1/internal/organizations/:orgId/apiKeys/:keyId` | DELETE | Revoke API key |

### Dashboard API (`packages/api/src/routes/me.ts`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/me` | GET | Get current user and org info |
| `/v1/me/apiKeys` | GET | List API keys for user's org |
| `/v1/me/apiKeys` | POST | Create API key (owner/admin only) |

### Frontend (`packages/web/`)

| File | Purpose |
|------|---------|
| `index.html` | Entry point with dark theme styles |
| `src/main.tsx` | React entry with BrowserRouter |
| `src/App.tsx` | Route definitions |
| `src/pages/HomePage.tsx` | Landing page with CTA |
| `src/pages/OnboardingPage.tsx` | Org creation flow |
| `src/pages/DashboardPage.tsx` | Dashboard shell with mock data |

### Utilities

| File | Purpose |
|------|---------|
| `scripts/phase-complete.sh` | Phase completion validation |

### Server Updates (`packages/api/src/index.ts`)

- Version updated to `0.5.0`
- Added dashboard routes (Firebase Auth)
- Added internal operator routes (admin scope)
- Updated startup logs with new endpoints

---

## Key Design Decisions

### 1. User-Organization Model

```typescript
interface User {
  id: string;
  authUid: string;  // Firebase Auth UID
  email: string;
  displayName?: string;
  organizationId: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}
```

- Users are stored in top-level `users` collection (not nested under org)
- Links to Firebase Auth via `authUid` field
- Single org per user (can expand to multi-org later)

### 2. Authentication Separation

| Endpoint Type | Auth Method | Header |
|---------------|-------------|--------|
| Public API | API Key | `X-API-Key` |
| Dashboard API | Firebase Auth | `Authorization: Bearer <token>` |
| Internal Operator | API Key (admin) | `X-API-Key` (requires `admin` scope) |

### 3. Dashboard API Permissions

- `GET /v1/me` - Any authenticated user
- `GET /v1/me/apiKeys` - Any org member
- `POST /v1/me/apiKeys` - Owner or admin only
- Admin keys can only be created by org owner

### 4. Development Mode Auth

For development, Firebase Auth tokens can be simulated:
```bash
# Development mode (X-Firebase-UID header)
curl -H "X-Firebase-UID: user-123" http://localhost:8080/v1/me
```

Production will require proper Firebase token verification.

---

## How to Verify

```bash
# 1. Check TypeScript compiles
cd packages/api
npx tsc --noEmit

# 2. Start server
npm run dev

# 3. Run seed script
npm run seed:dev

# 4. Test internal endpoints (requires admin API key)
curl -X POST http://localhost:8080/v1/internal/organizations \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <admin-key>" \
  -d '{
    "name": "Test Org",
    "slug": "test-org",
    "ownerAuthUid": "firebase-uid-123",
    "ownerEmail": "owner@example.com"
  }'

# 5. Test dashboard endpoints (simulated Firebase Auth)
curl -H "X-Firebase-UID: firebase-uid-123" \
  http://localhost:8080/v1/me

# 6. Start frontend dashboard
cd packages/web
npm install
npm run dev
```

---

## Risks / Gotchas

- **Firebase Auth token verification not implemented** - Development mode accepts `X-Firebase-UID` header directly
- **Frontend uses mock data** - Dashboard fetches from mock data, not live API
- **No email verification** - Onboarding doesn't verify email addresses
- **Single org per user** - Current model doesn't support multi-org membership
- **No password reset flow** - Firebase Auth handles this externally

---

## Rollback Plan

1. Revert schema.ts to Phase 4 version (remove User type)
2. Remove `packages/api/src/services/org-service.ts`
3. Remove `packages/api/src/routes/internal.ts`
4. Remove `packages/api/src/routes/me.ts`
5. Revert index.ts to Phase 4 version
6. Remove `packages/web/` directory
7. Remove `scripts/phase-complete.sh`
8. Revert CLAUDE.md to Phase 4 version

---

## Open Questions

- [ ] When to implement proper Firebase Auth token verification?
- [ ] Should users be able to belong to multiple organizations?
- [ ] How to handle org deletion with cascading user cleanup?
- [ ] Should we add email verification during onboarding?
- [ ] How to implement password reset flow?

---

## TODOs for Future Phases

- [ ] Implement Firebase Auth token verification in production
- [ ] Connect frontend to live API endpoints
- [ ] Add email verification during onboarding
- [ ] Implement organization invites (add team members)
- [ ] Add billing integration (Stripe)
- [ ] Implement usage-based quotas per plan
- [ ] Add multi-org support for users
- [ ] Add organization deletion with cascade

---

## Next Actions

| Action | Owner | Due |
|--------|-------|-----|
| Phase 6: Production Dashboard | Engineering | Next phase |
| Firebase Auth integration | Engineering | Phase 6 |
| Billing integration | Engineering | Future |

---

## Evidence Links / Artifacts

### Files Created

| File | Action | Purpose |
|------|--------|---------|
| `packages/api/src/services/org-service.ts` | `created` | Organization CRUD operations |
| `packages/api/src/routes/internal.ts` | `created` | Internal operator endpoints |
| `packages/api/src/routes/me.ts` | `created` | Dashboard user endpoints |
| `packages/web/package.json` | `created` | Frontend package config |
| `packages/web/index.html` | `created` | Frontend entry HTML |
| `packages/web/src/main.tsx` | `created` | React entry point |
| `packages/web/src/App.tsx` | `created` | Route definitions |
| `packages/web/src/pages/HomePage.tsx` | `created` | Landing page |
| `packages/web/src/pages/OnboardingPage.tsx` | `created` | Onboarding flow |
| `packages/web/src/pages/DashboardPage.tsx` | `created` | Dashboard shell |
| `scripts/phase-complete.sh` | `created` | Phase validation utility |

### Files Modified

| File | Action | Purpose |
|------|--------|---------|
| `packages/api/src/firestore/schema.ts` | `modified` | Added User type, updated plan |
| `packages/api/src/index.ts` | `modified` | Added new routes, version 0.5.0 |
| `packages/api/src/scripts/seed-dev.ts` | `modified` | Updated plan to 'beta' |
| `CLAUDE.md` | `modified` | Added Phase 5 documentation |

### Commits

| Hash | Message |
|------|---------|
| `pending` | `feat: Phase 5 Customer Onboarding + Org/API Key Flow [Epic: intentvision-p5]` |

### AgentFS Snapshots

| Snapshot ID | Timestamp | Description |
|-------------|-----------|-------------|
| N/A | - | No snapshots this phase |

**AgentFS Status:** `Active` (not used this phase)

---

## Phase Completion Checklist

- [x] Firestore schema extended with users collection
- [x] Organization service module created
- [x] Internal operator API endpoints implemented
- [x] Dashboard /v1/me endpoints implemented
- [x] Frontend dashboard shell created
- [x] Onboarding page with org creation flow
- [x] Phase completion utility script added
- [x] CLAUDE.md updated with Phase 5 hooks
- [x] Phase 5 AAR created with Beads Task IDs
- [x] Internal endpoints not exposed to public API
- [x] Beads/AgentFS not exposed to customers

---

## Exit Criteria Summary

| Criterion | Status |
|-----------|--------|
| Users collection in Firestore schema | PASS |
| Organization service CRUD operations | PASS |
| Internal operator endpoints (admin only) | PASS |
| Dashboard /v1/me endpoints | PASS |
| Firebase Auth integration (dev mode) | PASS |
| Frontend landing page | PASS |
| Frontend onboarding page | PASS |
| Frontend dashboard shell | PASS |
| Phase completion script | PASS |
| CLAUDE.md Phase 5 documentation | PASS |
| Phase 5 AAR with Beads Task IDs | PASS |
| No internal tools in public API | PASS |

**Phase 5 Complete. Ready for Phase 6 (Production Dashboard).**

---

*intent solutions io - confidential IP*
*Contact: jeremy@intentsolutions.io*
