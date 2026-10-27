# IndiChat Development Guide

This guide explains how to use the IndiChat development playbook and ECC
(`.agents/`) files with Google Antigravity.

## 1. What each folder is for

-   `docs/development/` --- the project playbook: architecture,
    planning, implementation, testing, release, deployment, and feature
    workflows.
-   `.agents/agents/` --- focused agent instructions for tasks such as
    architecture, implementation, review, debugging, and verification.
-   `.agents/skills/` --- reusable task-specific procedures and
    knowledge.
-   `.agents/workflows/` --- step-by-step workflow documents for common
    tasks.
-   `.agents/rules/` --- coding, testing, security, Git, and
    stack-specific standards.

These Markdown files are **guidance**, not executable scripts by
themselves. Open or reference them in Antigravity and ask the agent to
follow them. Use a script or command only when the repository actually
provides one.

## 2. Before starting a task

1.  Open the IndiChat repository as the workspace in Antigravity.
2.  Confirm the working branch and check `git status` so you know which
    changes already exist.
3.  Identify the relevant playbook section in `docs/development/`.
4.  Identify applicable `.agents/rules/`, agent, skill, or workflow
    files.
5.  State the task, scope, acceptance criteria, and files or areas that
    must not be changed.

Example prompt:

> Read the relevant guidance in `docs/development/` and `.agents/`
> before making changes. First summarize the approach and acceptance
> criteria. Keep the change limited to this task, preserve unrelated
> working-tree changes, and do not edit unrelated files.

## 3. Use the guide for common tasks

### Add a feature

1.  Read the feature development workflow in
    `docs/development/11_FEATURE_DEVELOPMENT_WORKFLOW.md`.
2.  Check `docs/development/PROJECT_CONTEXT.md` and the relevant
    architecture/design documentation.
3.  Ask Antigravity to inspect the existing implementation and propose a
    plan before coding.
4.  Review and approve the plan, including API, WebSocket, shared-type,
    database, security, and migration impacts.
5.  Implement in small steps and add or update tests.
6.  Run targeted tests first, then the applicable broader checks.
7.  Verify every acceptance criterion against actual code or test
    evidence.
8.  Update relevant documentation and configuration examples.

Prompt:

> Follow `docs/development/11_FEATURE_DEVELOPMENT_WORKFLOW.md`. Inspect
> the existing code and relevant `.agents/` rules first. Produce a plan
> and acceptance criteria before editing. After approval, implement the
> smallest complete change, add tests, run the relevant checks, and
> report changed files and command results. Do not touch unrelated
> files.

### Fix a bug

1.  Reproduce the problem or inspect the provided failure evidence.
2.  Ask for the likely root cause and a focused regression test.
3.  Make the smallest fix that addresses the cause.
4.  Run the regression test and relevant neighboring tests.
5.  Report what caused the bug and what evidence shows it is fixed.

Prompt:

> Follow the defect-fixing workflow in `.agents/workflows/` that best
> matches this issue. Reproduce or isolate the failure, identify the
> root cause, add a regression test where practical, and make a minimal
> fix. Do not hide or weaken failing tests. Report test commands and
> results.

### Review code or documentation

Ask for findings before asking for changes. Have the agent identify
concrete issues, their impact, and the exact locations. Then request
fixes only for confirmed issues.

Prompt:

> Review the requested changes against the project playbook and
> applicable `.agents/rules/`. Report only actionable findings with
> file/line references, impact, and evidence. Do not edit files during
> the review. Distinguish confirmed defects from optional improvements.

### Fix a build or test failure

Prompt:

> Inspect the failing command and its full output. Identify the root
> cause before changing files. Apply the smallest relevant fix, rerun
> the failed command, and run related checks. Do not suppress tests,
> remove assertions, or silence warnings just to obtain a passing
> result.

### Prepare a release or deployment

1.  Read `docs/development/09_RELEASE_AND_DEPLOYMENT.md`.
2.  Check the actual deployment configuration and environment
    requirements.
3.  Verify tests, builds, migrations, secrets handling, health checks,
    rollback approach, and expected downtime.
4.  Do not assume zero downtime from nullable columns or defaults alone.
5.  Require explicit human approval before production deployment or
    release actions.

Prompt:

> Follow `docs/development/09_RELEASE_AND_DEPLOYMENT.md`. Inspect the
> actual deployment configuration and prepare a release checklist with
> evidence, risks, migration compatibility, health checks, rollback
> steps, and downtime assumptions. Do not deploy, publish images, or
> change production resources without my explicit approval.

## 4. How to refer to agent, skill, workflow, and rule files

Use the exact path in your prompt so Antigravity can inspect the
intended file. For example:

> Read `.agents/rules/common-security.md` and
> `.agents/rules/java-coding-style.md`, then apply the relevant
> requirements to this Spring Boot change.

Or:

> Open the relevant workflow under `.agents/workflows/` and follow its
> steps. If the workflow references an agent or skill, inspect that file
> too.

Do not assume every Markdown filename is a native Antigravity command. A
workflow file is normally a written procedure unless a corresponding
executable integration is explicitly configured.

## 5. Antigravity slash commands

The project documentation identifies these as native Antigravity
conversational commands:

-   `/plan` --- create a step-by-step implementation plan.
-   `/goal` --- pursue a longer-running goal.
-   `/schedule` --- set up a one-time or recurring scheduled action.
-   `/grill-me` --- ask questions to resolve design decisions.
-   `/learn` --- extract reusable session patterns.

Use these only where supported by your installed Antigravity version.
They are different from opening a Markdown workflow file.

Suggested pattern:

1.  Use `/grill-me` when requirements or design decisions are unclear.
2.  Use `/plan` to prepare and review the implementation plan.
3.  Ask the agent to follow the relevant playbook/workflow and implement
    the approved scope.
4.  Run tests and verify the resulting diff.
5.  Use `/learn` only when there is a reusable lesson worth capturing.

## 6. Safety and approval boundaries

Agents may inspect code, edit within the approved task scope, and run
local tests/builds. They must stop and request explicit approval before
high-impact actions such as:

-   Changing public REST or WebSocket contracts or shared types.
-   Changing authentication, CORS, session, or encryption mechanisms.
-   Applying production database migrations or irreversible database
    operations.
-   Disabling tests, removing assertions, or suppressing warnings to
    force a pass.
-   Committing, pushing, merging, tagging, or destructive Git/filesystem
    operations.
-   Deploying to staging/production, publishing containers, or releasing
    applications.
-   Exposing or copying real credentials, tokens, or private keys.

Keep secrets in the appropriate local secret store or deployment secret
configuration. Never paste real secrets into prompts or commit them to
Markdown files.

## 7. Verify the result before finishing

Ask Antigravity to provide:

-   A concise summary of the implementation.
-   The exact files changed.
-   The tests, lint, type-check, and build commands actually run.
-   The exit status and relevant output for each command.
-   Acceptance criteria mapped to concrete evidence.
-   Any checks not run, known limitations, or remaining risks.
-   Confirmation that unrelated existing changes were preserved.

Final verification prompt:

> Before finishing, inspect `git status --short` and the diff for this
> task. Confirm that only intended files changed and that unrelated
> existing changes were preserved. Run the applicable checks and report
> the exact commands and results. Do not commit, push, merge, or deploy.
> Do not claim a check passed unless you actually ran it and observed a
> successful result.

Useful local Git commands:

``` bash
git rev-parse --show-toplevel
git status --short
git diff --stat
git diff --cached --stat
git diff --check
```

## 8. Recommended everyday routine

**Understand → Plan → Approve → Implement → Test → Review diff → Update
docs → Report evidence**

For a small change, keep the process proportionate, but never skip
relevant tests, inspect the diff, or let the agent modify unrelated
files. Treat the playbook as project guidance and the actual code,
configuration, test output, and Git diff as the evidence of what is
true.
