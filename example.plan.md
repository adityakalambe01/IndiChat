# Example Plan: Writing Better Prompts for IndiChat in Antigravity

Use this file as a copy-paste prompt template when asking Google
Antigravity to work on IndiChat. Replace the values in square brackets
with your actual task details.

------------------------------------------------------------------------

## 1. Reusable Prompt Template

Copy this section and fill in the placeholders.

``` text
You are working in the IndiChat repository.

TASK
[Describe one specific feature, bug, or improvement.]

GOAL
[Explain the user-visible or technical result you want.]

PROJECT GUIDANCE
1. Read Guide.md first.
2. Read docs/development/PROJECT_CONTEXT.md and the relevant section under docs/development/.
3. Inspect applicable .agents/rules/, .agents/agents/, .agents/skills/, and .agents/workflows/ files. Follow the relevant guidance; do not assume every Markdown file is an executable command.
4. Inspect the existing implementation before proposing changes. Follow established patterns and reuse existing code where appropriate.

SCOPE
- Expected areas/files: [list known paths, or ask the agent to identify them before editing].
- Do not modify unrelated files.
- Preserve all pre-existing working-tree changes, especially changes outside this task.
- Do not overwrite, revert, or reformat unrelated work.

ACCEPTANCE CRITERIA
1. [Observable behavior that must work.]
2. [Error/edge case that must be handled.]
3. [Tests or verification required.]
4. [Documentation/configuration updates required, if applicable.]

WORKING METHOD
1. Inspect the repository and current Git status.
2. Summarize your understanding, relevant files, risks, and proposed plan.
3. Do not edit files until I approve the plan.
4. After approval, implement the smallest complete solution in reviewable steps.
5. Add or update tests. Do not delete tests, weaken assertions, or suppress failures just to get a passing result.
6. Run applicable targeted tests, lint/type checks, and builds. Report the exact commands and actual results; do not claim a check passed unless it ran successfully.
7. Review the final diff and check for accidental or unrelated changes.
8. Update relevant documentation and safe example configuration when required.

APPROVAL BOUNDARIES
Stop and ask me before changing public REST/WebSocket contracts, shared types, authentication/security mechanisms, production database schema or data, deployment infrastructure, or before committing, pushing, merging, publishing, or deploying. Never expose secrets or put real credentials in files/prompts.

FINAL REPORT
- Summary of changes
- Files changed
- Acceptance criteria and evidence
- Exact commands run and results
- Checks not run and why
- Risks, assumptions, and follow-up items
- Confirmation that unrelated changes were preserved

Start by inspecting and planning only. Do not edit files yet.
```

------------------------------------------------------------------------

## 2. Example: Add a Feature

Example task: add a "typing..." indicator to the web chat.

``` text
You are working in the IndiChat repository. Follow Guide.md, docs/development/PROJECT_CONTEXT.md, docs/development/11_FEATURE_DEVELOPMENT_WORKFLOW.md, and all relevant .agents/ rules and workflows.

TASK
Add a real-time “typing…” indicator to the web chat.

GOAL
When another participant is typing in the currently open conversation, show a subtle indicator. Hide it when they stop typing, leave the conversation, or the conversation changes.

ACCEPTANCE CRITERIA
1. The indicator is shown only for the currently active conversation.
2. It does not show for the current user as a remote participant.
3. It disappears when a stop-typing event arrives or the existing timeout/cleanup behavior applies.
4. Conversation changes and component unmounts clean up listeners/timers correctly.
5. Existing message sending and receiving behavior remains unchanged.
6. Add or update tests for the visible state, conversation switching, and cleanup behavior.
7. Update docs only if the implemented event contract or configuration documentation changes.

CONSTRAINTS
- Inspect the existing WebSocket/event implementation before designing a new event.
- Reuse current event names and shared types if suitable.
- Do not invent a new backend contract without presenting the proposed contract and waiting for approval.
- Do not touch unrelated files or overwrite existing user changes.

PROCESS
First inspect Git status, relevant code, tests, shared types, and applicable .agents/ guidance. Return a plan, likely files, event-flow explanation, risks, and test plan. Do not edit until I approve. After approval, implement, test, inspect the diff, and report exact command results.
```

------------------------------------------------------------------------

## 3. Example: Fix a Bug

Example task: messages appear twice after reopening a conversation.

``` text
TASK
Investigate and fix duplicate messages appearing after a conversation is closed and reopened in IndiChat.

EXPECTED BEHAVIOR
Each message should appear once in the conversation, whether it arrives through initial history loading or a real-time event.

INVESTIGATION
1. Reproduce the issue if possible.
2. Inspect history fetching, WebSocket subscriptions, event handlers, state updates, and cleanup.
3. Identify the root cause before changing code.
4. Add a regression test that fails for the duplicate-message behavior.

ACCEPTANCE CRITERIA
- A message received through both history and real-time paths is not rendered twice.
- Reopening a conversation does not create duplicate listeners.
- Switching conversations does not leak messages between conversations.
- Existing ordering and pagination behavior remains correct.
- Relevant regression and neighboring tests pass.

GUARDRAILS
Do not simply filter duplicate UI rows without understanding the source of duplication. Do not remove assertions or suppress failing tests. Inspect Git status first and preserve unrelated changes.

Start with investigation and a proposed fix. Wait for approval before editing.
```

------------------------------------------------------------------------

## 4. Example: Review Before Merge

``` text
Review my current branch against its target branch for the IndiChat task.

Read Guide.md, the relevant docs/development/ guidance, and applicable .agents/rules/ first.

Do not edit files during the review.

Check for:
- Functional bugs and regressions
- Security and authorization issues
- API/WebSocket contract mismatches
- Database migration and compatibility risks
- Error handling and edge cases
- Missing or weak tests
- Unnecessary scope or unrelated changes

Report findings in priority order. For each finding, include file and line, why it is a problem, a realistic failure scenario, and a suggested fix. Separate confirmed findings from optional improvements. If no actionable issues are found, say so and list the checks actually performed. Do not claim tests passed unless you ran them.
```

------------------------------------------------------------------------

## 5. Example: Database Change

``` text
TASK
[Describe the database change and business reason.]

Before proposing a migration:
1. Inspect the current entity/model, schema, repositories, queries, and migration conventions.
2. Read the database and release guidance in docs/development/ and applicable .agents/rules/.
3. Identify data volume assumptions, locks, backfill requirements, rollback limitations, and compatibility with currently running application versions.
4. Consider whether an expand-and-contract migration is needed.
5. Do not assume a nullable column or constant default guarantees zero downtime.

Return the proposed schema change, migration plan, compatibility risks, test plan, and rollback/forward-recovery approach. Do not create or run a migration until I approve. Never run a production migration or destructive DDL without explicit approval.
```

------------------------------------------------------------------------

## 6. Example: Build or Test Failure

``` text
TASK
Diagnose this failure:
[Paste the exact command, complete relevant output, and what changed recently.]

Instructions:
1. Read relevant project guidance and inspect the code/configuration involved.
2. Re-run the failing command if safe and practical.
3. Identify the root cause; distinguish it from secondary errors.
4. Make the smallest relevant fix after presenting the plan and receiving approval.
5. Re-run the original command and related tests.
6. Report exact commands, exit codes, and results.

Do not disable tests, remove assertions, silence warnings, or change unrelated configuration just to make the build green. Preserve existing user changes.
```

------------------------------------------------------------------------

## 7. Example: Documentation-Only Change

``` text
TASK
Review and improve [specific documentation files] for correctness and usability.

RULES
- Treat the actual repository code and configuration as the source of truth.
- Do not invent commands, paths, environment variables, or deployment behavior.
- Keep local-development and production instructions clearly separated.
- Check relative links and code examples where possible.
- Do not change application code.
- Preserve unrelated edits.

First report proposed documentation changes and any statements that cannot be verified. Wait for approval before editing. After approval, make the documentation-only changes and report validation performed.
```

------------------------------------------------------------------------

## 8. How to Get Better Results

-   **Be specific:** one prompt should describe one task or a tightly
    related group of changes.
-   **Describe observable behavior:** explain what the user should see
    or what the system should do.
-   **Set acceptance criteria:** make success testable.
-   **Name constraints:** identify files or areas that must not change.
-   **Ask for a plan first:** review the approach before allowing broad
    edits.
-   **Require evidence:** ask for actual test commands and results.
-   **Separate review from implementation:** first find problems, then
    fix the confirmed ones.
-   **Keep approvals explicit:** require permission for high-impact
    contracts, security, database, Git, and deployment actions.
-   **Avoid vague prompts:** "improve the app" or "fix everything" has
    no clear scope or finish condition.

## 9. Short Prompt for Small Changes

For a genuinely small, low-risk task, use this shorter version:

``` text
In IndiChat, [describe the exact change]. Read Guide.md and the relevant docs/development/ and .agents/ guidance first. Inspect the existing implementation and Git status. Keep the change minimal and do not touch unrelated files or overwrite existing changes. Add/update relevant tests, run the appropriate checks, inspect the final diff, and report exact commands and results. Ask before changing public contracts, security, production data/infrastructure, or performing Git/release actions. Start with a short plan and wait for my approval before editing.
```
