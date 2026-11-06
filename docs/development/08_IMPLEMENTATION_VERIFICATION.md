# Phase 13: Acceptance Criteria Verification & Evidence-Based QA

> **Engineering Standard: Zero-Assumption Evidence-Based Quality Assurance**  
> Writing code is only half the task. Proving that the implementation actually satisfies every requirement under real runtime conditions is what separates amateur development from production engineering. This guide details the Requirements Traceability Matrix (RTM), browser testing, protocol validation, and evidence capture.

---

## 1. The Evidence-Based QA Ethos

* **Compiling != Working**: Just because TypeScript reports 0 errors and Maven exits with code 0 does not mean business logic is functioning as intended.
* **Assumptions are strictly forbidden**: Never state *"The feature should work now"* or *"The UI is updated"*. Always provide empirical proof: terminal outputs, test run logs, HTTP response payloads, or browser screenshots.
* **Recorded Status for Every Criterion**: Every agreed acceptance criterion must have an explicit recorded status (`PASS`, `FAIL`, or `SKIPPED`) accompanied by concrete verification evidence.
* **Handling Skipped Checks**: When a check cannot be executed (e.g. absent hardware, missing external service, or simulated network boundary), report it explicitly as **SKIPPED** with a concrete technical reason and follow-up remediation action. Never mark an unexecuted check as passed.
* **Risk-Based Testing**: Apply risk-based testing to prioritize boundary conditions, failure paths, and regressions over theoretical exhaustive testing. Any untested edge cases or remaining risks must be explicitly documented with technical rationale.

---

## 2. Requirements Traceability Matrix (RTM) Standard

Every feature or major bug fix must be documented with an explicit Requirements Traceability Matrix (RTM) linking criteria to evidence:

| Requirement ID | Acceptance Criterion | Verification Method | Empirical Evidence / Test Identifier | Status |
|---|---|---|---|---|
| **REQ-01** | Alice can send text message to Bob in conversation | Integration Test | `MessageServiceTest#testSendMessageSuccess` -> Status 200, DB record created | **PASS** |
| **REQ-02** | Bob receives real-time WebSocket frame within 200ms | WS Verification | `scripts/verify_ws.js` -> Received `message.created` frame in 42ms | **PASS** |
| **REQ-03** | Double grey ticks rendered when Bob's client receives frame | Automated UI Test | `ChatWindow.test.tsx` -> renders `✓✓` with grey color `#8696a0` | **PASS** |
| **REQ-04** | Double blue ticks rendered when Bob opens conversation | Browser QA | Verified via browser subagent / DOM inspection -> `#53bdeb` ticks rendered | **PASS** |
| **REQ-05** | Send fails gracefully with 401 when JWT expires | Negative Test | `curl -i -H "Authorization: Bearer expired..." /api/v1/messages` -> returns 401 | **PASS** |

---

## 3. API & Protocol Verification Protocols

### A. REST Endpoint Verification
Verify REST APIs using deterministic `curl` or automated HTTP scripts:
```bash
# Verify Auth Login
curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!"}' | jq .

# Verify Conversation Message History
curl -s -X GET http://localhost:8080/api/v1/conversations/conv-123/messages \
  -H "Authorization: Bearer <TOKEN>" | jq '.[0]'
```

### B. WebSocket Protocol Verification
Use the repository's dedicated verification engine [scripts/verify_ws.js](../../scripts/verify_ws.js):
```bash
# Run automated WebSocket handshake and duplex echo verification
node scripts/verify_ws.js
```
The script performs:
1. HTTP login to obtain a valid access token.
2. WebSocket handshake (passing the token via handshake header or query string with access log redaction; see security guidance in [02_PLANNING_AND_DESIGN.md](./02_PLANNING_AND_DESIGN.md)).
3. Emits `message.send` event.
4. Asserts receipt of `message.created` event within 500ms timeout.
5. Asserts receipt of `message.receipt.updated` event.

---

## 4. UI & Browser Verification Protocols

When validating frontend components in Web or Mobile:

### A. Web Client Browser QA
1. **Visual Alignment**: Verify layout in desktop view (1440px), tablet (768px), and mobile viewport (375px).
2. **Interactive Elements**: Use the `browser-qa` skill or `browser_subagent` to click buttons, input text, and confirm modal states open and close without console errors.
3. **No Layout Shift**: Verify modals do not disrupt background scrolling or cause jitter.

### B. Mobile Client Verification
1. **Touch Targets**: All clickable icons and message bubbles must have a minimum touch target of 44x44 points.
2. **Keyboard Avoiding**: When user taps the message input, `<KeyboardAvoidingView>` must smoothly lift the input container without obscuring message history.
3. **Android Back Button**: Pressing the Android physical/gesture back button must close modals or navigate up the route stack cleanly.

---

## 5. Negative Flows & Edge Case Verification

Validate system stability by deliberately testing boundary conditions:

```mermaid
flowchart LR
    A[Boundary Testing] --> B[Invalid JWT / Expired Session]
    A --> C[Rapid Double Click / Debounce Test]
    A --> D[Oversized Media Upload > 50MB]
    A --> E[Network Disconnect & Reconnect]
    
    B --> B1[Assert 401 & Redirect to Login]
    C --> C1[Assert Single Message Created (Idempotent)]
    D --> D1[Assert 413 Payload Too Large Handled Gracefully]
    E --> E1[Assert Auto-Reconnect & Resync Queued Receipts]
```

### Negative Path Checklist:
- [ ] What happens when the user sends an empty string or whitespace? (Button disabled, rejected).
- [ ] What happens when WebSocket drops? (Offline banner displayed, messages queued locally).
- [ ] What happens when recipient was deleted? (Clean 404/400 error, no infinite spinner).

---

## 6. Verified ECC Tools for Phase 13

* **Agent `agent-evaluator`**: Objectively scores implementation outputs against acceptance criteria.
* **Skill `skills/verification-loop`**: Systematic verification framework validating proof before closing tasks.
* **Skill `skills/browser-qa`**: Browser automation and visual UI interaction verification.
* **Skill `skills/click-path-audit`**: Traces user interaction flows end-to-end to detect broken state transitions.
* **Workflow `workflows/checkpoint.md`**: Create, verify, or list workflow checkpoints after running verification checks.
