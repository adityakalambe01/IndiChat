# Reusable Task Templates & Work Breakdown Structures

> **Engineering Standard: Structured Work Breakdown**  
> Consistent task planning accelerates execution, prevents oversights, and ensures alignment across team members and AI coding assistants. This document provides copy-ready templates for new features, bug reports, refactoring, technical debt remediation, QA plans, and production releases.

---

## Template Index

1. [Template 1: New Feature Specification and Implementation Plan](#template-1-new-feature-specification-and-implementation-plan)
2. [Template 2: Bug Report, Reproduction and RCA Ticket](#template-2-bug-report-reproduction-and-rca-ticket)
3. [Template 3: Safe Refactoring Proposal](#template-3-safe-refactoring-proposal)
4. [Template 4: Technical Debt and Dependency Upgrade Plan](#template-4-technical-debt-and-dependency-upgrade-plan)
5. [Template 5: Comprehensive QA and Verification Plan](#template-5-comprehensive-qa-and-verification-plan)
6. [Template 6: Production Release and Deployment Runbook](#template-6-production-release-and-deployment-runbook)

---

## Template 1: New Feature Specification and Implementation Plan

```markdown
# Feature: [FEATURE_TITLE]

## 1. Overview & Business Objective
- **Problem Statement**: [What user problem or product need does this address?]
- **Proposed Solution**: [High-level summary of the feature and user experience]
- **Target Platforms**: [ ] Web  [ ] Mobile (Android/iOS)  [ ] Desktop (Linux)  [ ] Backend Only

## 2. Acceptance Criteria (Given-When-Then)
- **AC-1**: Given [initial condition], When [user action], Then [expected outcome].
- **AC-2**: Given [initial condition], When [boundary condition/error], Then [expected error handling].
- **AC-3**: Given [multi-platform state], When [action on platform A], Then [sync on platform B].

## 3. Architecture & Contract Impact
- **Shared Types (`@chat/shared-types`)**:
  - DTOs to add/update: `[DTO_NAMES]`
  - WebSocket Events: `[EVENT_NAMES]`
- **Database Schema**:
  - Migration required? [ ] Yes  [ ] No
  - Migration Name: `V<N>__<feature_name>.sql`
  - Tables/Columns modified: `[TABLE_NAMES]`
- **REST Endpoints**:
  - `[METHOD] /api/v1/[PATH]` - `[DESCRIPTION]`

## 4. File-by-File Implementation Sequence
| Step | Target File | Action | Purpose & Scope |
|---|---|---|---|
| 1 | `packages/shared-types/src/index.ts` | Edit | Export contract DTOs and WS events |
| 2 | `backend/.../db/migration/V...sql` | Create | Database schema migration |
| 3 | `backend/.../service/...Service.java` | Create/Edit | Domain business logic and validation |
| 4 | `backend/.../controller/...Controller.java` | Create/Edit | REST API endpoints |
| 5 | `apps/web/src/features/...` | Create/Edit | Web UI components and state |
| 6 | `apps/mobile/app/...` | Create/Edit | Mobile screens and service binding |

## 5. Risk Assessment & Mitigations
- **Risk 1**: `[RISK_DESCRIPTION]` -> Mitigation: `[MITIGATION_STRATEGY]`
- **Risk 2**: `[RISK_DESCRIPTION]` -> Mitigation: `[MITIGATION_STRATEGY]`

## 6. Verification & Test Plan
- [ ] Unit tests written (TDD Red -> Green): `[TEST_FILE_PATHS]`
- [ ] Integration / API tests passing: `[TEST_COMMANDS]`
- [ ] WebSocket duplex verification passed: `node scripts/verify_ws.js`
- [ ] Web client verified at `http://localhost:5174`
- [ ] Mobile client verified via `npx tsc --noEmit` and build script
```

---

## Template 2: Bug Report, Reproduction and RCA Ticket

```markdown
# Bug: [BUG_TITLE]

## 1. Defect Summary
- **Severity**: [ ] CRITICAL (Blocker/Data Loss)  [ ] HIGH (Core Feature Broken)  [ ] MEDIUM (Edge Case)  [ ] LOW (Cosmetic)
- **Affected Platform**: [ ] Web  [ ] Mobile Android  [ ] Desktop  [ ] Backend API  [ ] WebSocket
- **Affected Version / Commit**: `[VERSION_OR_COMMIT]`
- **Reported Behavior**: [Describe what happened]
- **Expected Behavior**: [Describe what should have happened]

## 2. Minimal Reproduction Steps
1. Navigate to `[URL_OR_SCREEN]`
2. Perform action `[STEP_1]`
3. Observe error: `[ERROR_MESSAGE_OR_SCREENSHOT]`

### Minimal Repro Command / Script:
```bash
[INSERT CURL COMMAND, SCRIPT, OR TEST CALL]
```

## 3. Root Cause Analysis (The 5 Whys)

- **Why 1**: [Immediate failure cause]
- **Why 2**: [Why did that occur?]
- **Why 3**: [Why did that condition exist?]
- **Why 4**: [What logic or contract gap allowed it?]
- **Why 5 (Root Cause)**: [Fundamental systemic flaw]

## 4. Resolution Plan

- **Failing Regression Test**: `[TEST_FILE_PATH#TEST_NAME]`
- **Surgical Fix File(s)**: `[MODIFIED_FILES]`
- **Blast Radius**: [What surrounding features could be affected?]

## 5. Verification Proof

- [ ] Regression test fails on unfixed code (Red)
- [ ] Regression test passes with surgical fix (Green)
- [ ] Full module test suite passes without regressions
- [ ] Manual reproduction confirmed fixed
```

---

## Template 3: Safe Refactoring Proposal

```markdown
# Refactoring Proposal: [MODULE_OR_COMPONENT_NAME]

## 1. Motivation & Code Smells
- **Current State**: [Describe why refactoring is needed: excessive cognitive complexity, violated single responsibility, duplicate logic, high churn]
- **Target State**: [Cleaner modularity, cohesive domain abstractions, improved testability and readability]
- **Invariants**: Strict behavioral equivalence; zero breaking changes to public APIs.

## 2. Baseline Test Coverage
- **Existing Test Suite**: `[TEST_SUITE_PATH]`
- **Current Test Status**: [ ] 100% Green  [ ] Gaps identified (write tests first!)
- *Rule: If tests do not cover the module adequately, add tests before refactoring.*

## 3. Step-by-Step Atomic Refactoring Plan
- [ ] Step 1: Extract cohesive helper/service `[NAME]` -> Re-run tests
- [ ] Step 2: Simplify branching and reduce nesting in `[FUNCTION_NAME]` -> Re-run tests
- [ ] Step 3: Remove dead code and unused symbols in `[FILE_PATH]` -> Re-run tests
- [ ] Step 4: Verify module cohesion and cognitive complexity reduction

## 4. Post-Refactoring Validation
- [ ] All unit and integration tests pass cleanly
- [ ] Type check passes (`tsc` / Maven build)
- [ ] Zero changes to external API shapes or return types
```

---

## Template 4: Technical Debt and Dependency Upgrade Plan

```markdown
# Tech Debt / Upgrade: [PACKAGE_OR_FRAMEWORK_NAME]

## 1. Scope of Upgrade
- **Component**: `[e.g. Spring Boot 3.3 -> 3.4, React 18 -> 19, Expo 51 -> 52]`
- **Current Version**: `[OLD_VERSION]`
- **Target Version**: `[NEW_VERSION]`
- **Motivation**: [Security CVE patch, performance improvement, deprecated API removal]

## 2. Breaking Changes & Deprecations Audit
- **Breaking Change 1**: `[DETAILS]` -> Migration Action: `[ACTION]`
- **Breaking Change 2**: `[DETAILS]` -> Migration Action: `[ACTION]`

## 3. Rollout Checklist
- [ ] Update dependency manifest (`package.json` / `pom.xml`)
- [ ] Run dependency installation (`npm install` / `mvn clean install`)
- [ ] Resolve compiler errors and deprecation warnings
- [ ] Execute full automated test suite
- [ ] Audit dependencies for security vulnerabilities (`npm audit`)
```

---

## Template 5: Comprehensive QA and Verification Plan

```markdown
# QA Plan: [RELEASE_OR_FEATURE_NAME]

## 1. Verification Scope
- **Feature / PR**: `[PR_LINK_OR_NUMBER]`
- **Environments Tested**: [ ] Local Dev  [ ] Docker Compose  [ ] Staging

## 2. Requirements Traceability Matrix (RTM)
| Criterion ID | Description | Automated Test / Manual Proof | Status |
|---|---|---|---|
| REQ-01 | [CRITERION_1] | `[TEST_PATH_OR_CURL]` | PASS / FAIL |
| REQ-02 | [CRITERION_2] | `[TEST_PATH_OR_CURL]` | PASS / FAIL |
| REQ-03 | [CRITERION_3] | `[TEST_PATH_OR_CURL]` | PASS / FAIL |

## 3. Cross-Platform Validation
- [ ] Web Browser: Chrome, Firefox, Safari (Responsive 375px, 768px, 1440px)
- [ ] Mobile: Android Emulator / Physical Device
- [ ] Desktop: Electron Linux AppImage / deb

## 4. Sign-off Status
- **QA Lead / Agent**: `[NAME_OR_AGENT]`
- **Date**: `[DATE]`
- **Recommendation**: [ ] Approved for Release  [ ] Blocked by Defects
```

---

## Template 6: Production Release and Deployment Runbook

```markdown
# Release Runbook: Version [VERSION_TAG]

## 1. Release Metadata
- **Release Version**: `[e.g. 1.2.0]`
- **Git Commit / Tag**: `[GIT_COMMIT_HASH]`
- **Target Release Date**: `[DATE]`
- **Release Owner**: `[OWNER_NAME]`

## 2. Pre-Deployment Verification Checklist
- [ ] All CI/CD pipeline stages green
- [ ] Zero unaddressed CRITICAL or HIGH security findings
- [ ] Database migrations assessed for locking, backfills, and backward compatibility
- [ ] `.env.example` verified in sync with production requirements
- [ ] Production artifacts compiled and verified in `release/`

## 3. Deployment Steps
1. Execute database migration check: `[MIGRATION_COMMAND]`
2. Deploy backend service container: `[DEPLOY_BACKEND_COMMAND]`
3. Verify health endpoint: `curl -i http://[HOST]:8080/actuator/health`
4. Deploy web frontend distribution: `[DEPLOY_WEB_COMMAND]`
5. Publish mobile/desktop artifacts: `[PUBLISH_COMMAND]`

## 4. Rollback Procedure
If health checks fail or error spikes occur:
1. Revert container to previous image: `[PREVIOUS_IMAGE_TAG]`
2. Execute compensation migration if schema rollback needed: `[ROLLBACK_SQL]`
3. Re-verify health status: `curl http://[HOST]:8080/actuator/health`
```
