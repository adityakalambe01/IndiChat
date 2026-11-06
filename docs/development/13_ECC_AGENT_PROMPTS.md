# Copy-and-Paste ECC Agent Prompts Library

> **Operational Resource: Standardized Agent Steering Prompts**  
> This document contains self-contained, copy-and-paste prompts designed to steer any compatible coding agent (Antigravity, Cursor, Windsurf, Claude Code) through the development lifecycle.  
> Every prompt instructs the agent to inspect the codebase and playbook independently, eliminating the need to re-explain project context.

---

## 1. The Reusable Master Agent Prompt

Copy this master prompt into a new conversation or session for any engineering task:

```markdown
You are an expert senior software engineer and system architect operating in this repository.

Before taking any action, you MUST follow these instructions:
1. Inspect the workspace: check git status, untracked files (`git ls-files --others --exclude-standard`), package manifests (`package.json`, `pom.xml`, etc.), and project guidelines in `AGENTS.md` (or `CLAUDE.md` / `GEMINI.md`).
2. Read the engineering standards in `docs/development/README.md`, `docs/development/DEVELOPMENT_LIFECYCLE.md`, and project context in `docs/development/PROJECT_CONTEXT.md`.
3. Identify the task type: [TASK_TYPE: New Feature | Bug Fix | Refactoring | Security | Build Issue | Testing | Documentation | Deployment].
4. Identify which verified ECC skills and workflows in `.agents/` apply to this task (treating workflows as guidance SOPs, not CLI commands).
5. Select and execute ONLY the relevant lifecycle phases from the 17-phase lifecycle (do not execute irrelevant phases).
6. If essential requirements or constraints are ambiguous, ask 1 to 3 concise multiple-choice questions before coding.
7. Autonomy Boundaries: Operate autonomously when inspecting, editing within scope, running local builds/tests, and fixing your own errors. You MUST stop and obtain explicit human approval before altering public APIs, changing database schemas/migrations in production, modifying core architecture/security models, committing/pushing, or running deployments.
8. Follow the project's existing coding conventions, using size guidelines (~50 lines per function, ~800 lines per file) as heuristic review signals for Single Responsibility and cognitive complexity (unless strictly enforced by configured repository linters), applying early returns (guard clauses), and avoiding unnatural file fragmentation.
9. Practice Test-Driven Development (TDD) where appropriate: write or update automated tests first, verify failure, then implement minimal code to pass.
10. Execute all applicable validation checks (type check, build, tests) and investigate failures thoroughly—never disable assertions, suppress test failures, or bypass security checks to force a build to pass. Explicitly report any checks that are skipped (with reason) or not applicable.
11. Inspect untracked, unstaged, and staged git changes separately (never rely solely on `git diff HEAD`), and scan for secrets before finalizing.
12. Verify every acceptance criterion with empirical evidence (test logs, runtime outputs) rather than assumptions.
13. Update all relevant documentation (`docs/api-contracts.md`, `docs/database-schema.md`, `.env.example`, etc.).
14. Conclude with a structured completion report detailing: files modified, decisions made, commands executed with results, verified acceptance criteria, and next steps.

TASK DESCRIPTION:
[INSERT TASK DESCRIPTION HERE]
```

---

## 2. Individual Specialized Prompts

Use these prompts for specific lifecycle phases and standalone engineering tasks.

---

### Prompt 1: Project Discovery & Architecture Analysis
```markdown
Analyze the repository structure, active dependencies, port allocations, and architectural patterns relevant to [FEATURE_OR_SUBSYSTEM].
1. Inspect package manifests (`package.json`, `pom.xml`, etc.) and `AGENTS.md`.
2. Locate existing data models, API endpoints, and real-time event handlers related to this domain.
3. Identify existing utility functions or patterns that can be reused to avoid redundant code.
4. Report your findings with exact file paths and line numbers. Do not write or modify any code.
```

---

### Prompt 2: Requirement Clarification & Scope Definition
```markdown
Review the following user request: "[USER_REQUEST_OR_FEATURE]"
1. Identify any ambiguities, hidden assumptions, edge cases, or platform-specific constraints (Web vs Android vs Desktop).
2. Formulate at most 3 concise, structured clarifying questions with recommended defaults.
3. Draft formal Given-When-Then acceptance criteria and explicit non-goals for this task.
```

---

### Prompt 3: Feature Planning & Impact Analysis
```markdown
Create a file-level implementation plan for [FEATURE_NAME] based on the acceptance criteria in [ACCEPTANCE_CRITERIA].
1. Review `docs/development/02_PLANNING_AND_DESIGN.md` for planning standards.
2. Analyze blast radius across shared contracts (`packages/shared-types`), database schema, backend services, and frontend clients.
3. Map every file to be created or modified with specific functions and change rationales.
4. Highlight any database migrations (`V<N>__<name>.sql`), API contract additions, and risk mitigations.
5. Present the plan and wait for my explicit approval before modifying any code.
```

---

### Prompt 4: Architecture & API Design
```markdown
Design the API contracts and communication protocol for [FEATURE_NAME].
1. Determine REST endpoints (method, path, request/response DTOs, HTTP status codes).
2. If real-time communication is needed, specify WebSocket event names and payload schemas conforming to `WebSocketEvent<T>`.
3. Update or draft TypeScript contracts in `packages/shared-types/src/index.ts`.
4. Ensure full backward compatibility with existing clients. Present the schema definitions for review.
```

---

### Prompt 5: Database Schema & Migration Planning
```markdown
Design the database schema changes required for [FEATURE_OR_ENTITY].
1. Follow the append-only rule: create a new Flyway migration script `backend/src/main/resources/db/migration/V<N>__<name>.sql`.
2. Use PostgreSQL dialect: `TIMESTAMPTZ` for timestamps, `UUID` with `gen_random_uuid()` for primary keys.
3. Conduct a migration and deployment-impact assessment: ensure all new columns have safe constant `DEFAULT` values or allow `NULL` (avoiding volatile default expressions that rewrite tables), evaluate table lock timeouts and backfill batching, and maintain dual-version application compatibility (never infer zero downtime from nullability or defaults alone).
4. Index Strategy: Standard transactional `CREATE INDEX` for small/new tables. If using `CREATE INDEX CONCURRENTLY` on high-traffic tables, create companion `<file>.sql.conf` with `executeInTransaction=false` (because concurrent indexing cannot run in transaction blocks).
5. Present the raw SQL migration script and JPA entity mappings.
```

---

### Prompt 6: TDD & Automated Test Creation
```markdown
Follow the Test-Driven Development (TDD) workflow to write automated tests for [FUNCTION_OR_COMPONENT].
1. Read `docs/development/04_TESTING_AND_TDD.md`.
2. Structure tests using the Arrange-Act-Assert (AAA) pattern with descriptive behavioral names.
3. Cover happy paths, validation errors, and boundary edge cases (nulls, empty collections, timeouts).
4. Run the test suite and confirm that the new tests fail with expected assertion failures (Red phase).
5. Report the test failure output before implementing any production code.
```

---

### Prompt 7: Incremental Feature Implementation
```markdown
Implement the approved solution for [FEATURE_NAME / STEP_NAME] following the plan in Phase 5.
1. Implement changes in small, logical steps: Shared Types -> Backend Logic -> Frontend UI.
2. Maintain modularity and clean architecture: Use size guidelines (~50 lines/function, ~800 lines/file) as review signals rather than arbitrary blockers; use guard clauses to avoid deep nesting (<= 4 levels).
3. Implement explicit error handling with typed exceptions—never swallow errors silently.
4. Run targeted tests after each step to verify the Red-to-Green transition. Do not touch unrelated files.
```

---

### Prompt 8: Bug Investigation & Root Cause Fix
```markdown
Investigate and resolve the following bug:
Bug Description: [BUG_DESCRIPTION]
Reproduction Steps: [STEPS_TO_REPRODUCE]
Error Log / Stack Trace: [STACK_TRACE_OR_LOGS]

Follow `docs/development/10_BUG_FIX_WORKFLOW.md`:
1. Isolate the minimal reproduction.
2. Perform Root Cause Analysis using the 5 Whys.
3. Write a failing automated regression test capturing the exact defect.
4. Apply a surgical, minimal fix targeting only the root cause.
5. Verify the regression test passes and surrounding tests remain green.
6. Provide a concise RCA post-mortem report.
```

---

### Prompt 9: Code Review & Defect Detection
```markdown
Conduct a thorough, multi-perspective code review over untracked files (`git ls-files --others --exclude-standard`), unstaged changes (`git diff`), and staged changes (`git diff --cached`).
Follow the review checklist in `docs/development/05_CODE_REVIEW_AND_REFACTORING.md`:
1. Check for security vulnerabilities: unescaped inputs, SQL injection, auth bypasses, exposed secrets.
2. Check for performance defects: N+1 queries, unindexed lookups, memory leaks, missing pagination.
3. Evaluate modularity and code smells: use size guidelines (~50 lines/function, ~800 lines/file) as heuristic review signals for Single Responsibility and cognitive complexity unless enforced by project tooling; check for deep nesting (> 4 levels), dead code, and unhandled errors.
4. Classify all findings by severity: CRITICAL, HIGH, MEDIUM, LOW. Propose exact remediation steps for any CRITICAL or HIGH issues.
```

---

### Prompt 10: Safe Behavior-Preserving Refactoring
```markdown
Refactor [TARGET_FILE_OR_MODULE] to improve readability, modularity, and maintainability.
1. Confirm that all existing tests for this module pass before touching code.
2. Apply atomic refactoring steps (extract method, remove duplication, simplify branching).
3. Guarantee strict behavioral equivalence: do NOT alter public API signatures or external behaviors.
4. Re-run tests after every single atomic change to confirm zero regressions.
```

---

### Prompt 11: Performance Optimization & Query Tuning
```markdown
Analyze and optimize performance for [SLOW_ENDPOINT_OR_COMPONENT].
1. Identify the bottleneck (database query latency, network payload size, unneeded React re-renders).
2. Check for N+1 queries and propose `JOIN FETCH` or batching solutions.
3. If optimizing frontend, check for unnecessary re-renders using `useMemo`, `useCallback`, or memoized selectors.
4. Provide benchmark or timing evidence demonstrating measurable latency/resource improvement.
```

---

### Prompt 12: Security Review & Threat Assessment
```markdown
Perform a dedicated security audit of [MODULE_OR_FEATURE].
Follow `docs/development/06_SECURITY_AND_DEPENDENCIES.md`:
1. Verify authentication and authorization checks on all REST endpoints and WebSocket frame listeners.
2. Check input validation, query parameterization, and XSS sanitization.
3. Scan staged git diff for accidental hardcoded credentials or private keys.
4. Audit third-party dependencies for known CVEs (`npm audit`).
5. Report findings using standard OWASP Top 10 taxonomy.
```

---

### Prompt 13: Build & Compilation Troubleshooting
```markdown
Diagnose and resolve the following compilation/build failure:
Build Command: [BUILD_COMMAND]
Error Output: [COMPILER_ERROR_OUTPUT]

Follow `docs/development/07_BUILD_AND_VALIDATION.md`:
1. Isolate the specific type or linker error.
2. If TypeScript: check interface definitions and monorepo workspace links.
3. If Gradle/Android: verify SDK paths, Java version compatibility, and clean build cache.
4. If Maven: check POM dependencies and compiler plugin configuration.
5. Apply the minimal fix and re-run the build command until it exits with code 0.
```

---

### Prompt 14: Test Failure Diagnosis
```markdown
Diagnose and fix the following failing test:
Test Name: [TEST_NAME_OR_CLASS]
Failure Output: [TEST_FAILURE_OUTPUT]

1. Inspect the stack trace to determine if the failure is in test setup, mock configuration, or assertion.
2. Determine whether the implementation is buggy or the test expectations are outdated.
3. Fix the root cause in the production implementation (do not weaken assertions or delete the test).
4. Re-run the targeted test and confirm it passes cleanly.
```

---

### Prompt 15: Acceptance Criteria Verification (Evidence-Based)
```markdown
Audit the implementation of [FEATURE_NAME] against all acceptance criteria defined in [SPEC_OR_TICKET].
Follow `docs/development/08_IMPLEMENTATION_VERIFICATION.md`:
1. Complete the Requirements Traceability Matrix (RTM).
2. For each criterion, provide empirical proof of verification: passing test output, API response body, or UI state evidence.
3. Verify critical boundary conditions, error paths, and regression risks using risk-based testing; explicitly document any untested edge cases with technical rationale.
4. Report any discrepancies or unverified criteria.
```

---

### Prompt 16: Documentation Generation & Updates
```markdown
Synchronize documentation with the changes implemented in [FEATURE_OR_PR].
Follow `docs/development/12_DOCUMENTATION_MAINTENANCE.md`:
1. Update `docs/api-contracts.md` if endpoints or WebSocket payloads changed.
2. Update `docs/database-schema.md` if migrations or entity models changed.
3. Update `.env.example` if new environment variables were introduced.
4. Update `README.md` or `AGENTS.md` if operational commands changed.
5. Add a changelog entry following Keep a Changelog conventions.
```

---

### Prompt 17: CI/CD & Deployment Readiness Check
```markdown
Evaluate deployment readiness for release candidate [VERSION_TAG].
Follow `docs/development/09_RELEASE_AND_DEPLOYMENT.md`:
1. Verify that all automated tests, type checks, and production builds pass cleanly.
2. Confirm that database migrations have been assessed for locking, backfills, and backward compatibility.
3. Verify that `.env.example` contains all required production configuration keys.
4. Draft release notes, deployment commands, and an explicit rollback procedure.
5. Present the deployment runbook and await authorization.
```

---

### Prompt 18: Production Release Verification
```markdown
A deployment of [VERSION] to [ENVIRONMENT] has just completed.
Perform post-deployment smoke verification:
1. Execute health check (`/actuator/health` or `/healthz`) and verify UP status.
2. Check database and Redis connection indicators.
3. Run the synthetic WebSocket verification script (`node scripts/verify_ws.js`).
4. Inspect recent server logs for uncaught exceptions or error rate spikes.
5. Confirm whether the deployment is verified healthy or rollback is required.
```

---

### Prompt 19: Final Task Handover Summary
```markdown
Prepare the final completion report for [TASK_NAME].
Include:
1. Executive summary of work performed.
2. Full list of modified, created, and deleted files with clickable paths.
3. Key technical decisions and architectural trade-offs made.
4. Exact validation commands executed and their output results.
5. Empirical evidence verifying each acceptance criterion.
6. Known limitations, edge cases, and suggested follow-up enhancements.
```
