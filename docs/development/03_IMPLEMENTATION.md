# Phase 8: Clean Implementation, Modularity & Coding Standards

> **Engineering Standard: Craftsmanship & Modularity**  
> High-velocity teams write code that is readable, maintainable, defensive, and easily tested. This guide details universal coding principles, SOLID application across OOP and functional paradigms, structured error handling, and language-specific nuances.

---

## 1. Modularity & Complexity Review Signals

Rather than enforcing arbitrary, rigid line caps that cause unnatural code fragmentation or premature abstractions, use size and complexity metrics as **review signals** for Single Responsibility Principle (SRP) and cognitive load:

| Metric | Review Threshold | Practical Review Signal & Remediation |
|---|---|---|
| **Function Length** | **~50 lines** | When a function exceeds ~50 lines, review whether it handles multiple concerns (e.g., parsing, validation, and persistence). Extract cohesive helper functions only when it improves readability and testability. Do not fracture simple, linear procedures artificially. |
| **File Length** | **~800 lines** | Files approaching 800 lines often dilute single responsibility. Consider splitting into cohesive sub-modules or domain components if multiple logical entities share the file. Keep cohesive components together rather than creating shallow, single-use files. |
| **Nesting Depth** | **<= 4 levels** | Deep nesting degrades readability and increases cognitive load. Use early returns (guard clauses) to exit error and boundary conditions early at depth 1. |
| **Cyclomatic Complexity** | **<= 10 per method** | High branching complexity (`if`, `switch`, loops) signals multiple logical paths. Replace deeply nested condition trees with lookup maps, strategy patterns, or polymorphism. |

### Early Return (Guard Clause) Pattern

*Anti-Pattern (Deep Nesting)*:
```typescript
function processMessage(msg: Message | null) {
  if (msg !== null) {
    if (msg.text.length > 0) {
      if (isValidSender(msg.senderId)) {
        // do work...
      }
    }
  }
}
```

*Standard Pattern (Guard Clauses)*:
```typescript
function processMessage(msg: Message | null) {
  if (!msg || msg.text.trim().length === 0) return;
  if (!isValidSender(msg.senderId)) {
    throw new InvalidSenderException(msg.senderId);
  }
  // do work cleanly at depth 1...
}
```

---

## 2. SOLID Principles Across Paradigms

Apply SOLID principles adapted to both Object-Oriented (Java / Spring) and Functional/Component (React / TypeScript) architectures:

### A. Single Responsibility Principle (SRP)
* **Java/Spring**: A service (`MessageService`) handles business logic; a repository handles data persistence; a controller handles HTTP mapping. Never mix SQL queries into REST controllers.
* **React/TypeScript**: A component renders UI (`ChatWindow`); custom hooks manage state (`useChatMessages`); API modules handle networking (`api.ts`). Never make raw `fetch()` calls directly inside a UI component's JSX return.

### B. Open-Closed Principle (OCP)
* Systems should be open for extension but closed for modification.
* Example: Message attachment renderers. Use a registry of renderers (`ImageRenderer`, `VideoRenderer`, `AudioRenderer`, `DocumentRenderer`) rather than an 8-branch `if-else` block inside the message bubble component.

### C. Liskov Substitution Principle (LSP)
* Subtypes or implementations must be substitutable for their base types without altering correctness.
* Example: `FileStorageService` interface implemented by `MinIOStorageService` (local/production) and `InMemoryStorageService` (testing). Both adhere strictly to the same contract.

### D. Interface Segregation Principle (ISP)
* Clients should not be forced to depend on methods they do not use.
* Example: Prefer focused interfaces (`WritableMessage`, `ReadableMessage`, `ReactableMessage`) over a 40-method god interface.

### E. Dependency Inversion Principle (DIP)
* High-level modules should not depend on low-level modules; both depend on abstractions.
* In Spring Boot: Always inject interfaces or service beans via constructor injection (`@RequiredArgsConstructor`), never field injection (`@Autowired` on private fields).
* In React: Inject dependencies via props or Context providers rather than hardcoding global singleton instances.

---

## 3. Robust Error Handling Architecture

Errors must be explicit, typed, and handled at appropriate architectural boundaries.

```mermaid
flowchart LR
    A[Error Occurs] --> B{Expected or Unexpected?}
    B -- Expected (Validation/Auth) --> C[Typed Domain Exception]
    B -- Unexpected (NullPointer/DB Down) --> D[System Exception with Correlation ID]
    C --> E[Global Exception Handler / Boundary]
    D --> E
    E --> F[Safe Client Response (No Leaked Stack Traces)]
```

### Non-Negotiable Error Rules:
1. **Never swallow exceptions silently**: Empty `catch (e) {}` blocks are strictly forbidden. If an error is intentionally ignored, document the exact reason with a comment: `// Intentional: fallback cache used when Redis is unreachable`.
2. **Use Typed Custom Exceptions**:
   * Java: `ResourceNotFoundException`, `UnauthorizedAccessException`, `ConversationMembershipException`.
   * TypeScript: `ApiError`, `NetworkError`, `WebSocketTimeoutError`.
3. **Redact Sensitive Information**: Error responses returned to clients must never contain raw database error messages, stack traces, or file paths. Use Spring `@ControllerAdvice` or React Error Boundaries.

---

## 4. Defensive Logging & Observability

Logging must provide operational insight without causing disk exhaustion or security leaks:

* **Use Appropriate Log Levels**:
  * `ERROR`: Critical failures requiring immediate engineering intervention (e.g., database connection loss, unhandled exceptions).
  * `WARN`: Unexpected situations that were handled gracefully (e.g., rate limit triggered, retry attempt 2 of 3).
  * `INFO`: Key lifecycle state transitions (e.g., application started, user connected to WebSocket, migration applied).
  * `DEBUG` / `TRACE`: Granular debugging details (disabled in production).
* **Strict PII Redaction**: Never log passwords, JWT tokens, session keys, credit card details, or private message contents.
* **Structured Format**: Include context identifiers (e.g., `userId`, `conversationId`, `deviceId`) to facilitate tracing across distributed logs.

---

## 5. Framework & Language Specific Nuances

### A. Java 21 & Spring Boot 3.3.5
* **Transaction Boundaries**: Annotate service methods modifying state with `@Transactional`. Keep transaction scopes as short as possible to prevent database connection starvation.
* **Immutable Collections**: Use Java 21 `List.of()`, `Set.of()`, and `Map.of()` for read-only data structures.
* **Records**: Use Java `record` types for immutable DTOs, request payloads, and query projections.

### B. React 18.3 & TypeScript Web
* **Hook Dependencies**: Always declare exhaustive dependencies in `useEffect`, `useCallback`, and `useMemo`. Never disable `react-hooks/exhaustive-deps` without an architectural justification.
* **Component Modularity**: Keep JSX files focused. Extract modals, tooltips, and complex dropdowns into standalone feature sub-components.
* **Strict Typing**: Never use `any` unless wrapping an untyped 3rd-party library. Use `unknown` with type narrowing instead.

### C. React Native (0.86+) & Expo (57+) / React 19.2
* **Multipart File Uploads**: In Android React Native, standard browser `FormData` causes `Unsupported FormDataPart implementation` crashes. Use `expo-file-system` (`uploadAsync` or `ExpoFile`) for binary file uploads.
* **Localhost vs LAN**: Android emulator maps host to `http://10.0.2.2:8080`; physical devices require LAN IP (`http://192.168.x.x:8080`). Maintain dynamic host deduction via `Constants.expoConfig?.hostUri`.
* **Safe Areas**: Wrap screens in `<SafeAreaView>` to prevent status bar and home indicator overlapping.

---

## 6. Verified ECC Tools for Phase 8

* **Agent `code-simplifier`**: Analyzes code to reduce complexity and remove redundant logic.
* **Agent `code-architect`**: Ensures component boundaries and modularity standards are maintained.
* **Skill `skills/error-handling`**: Comprehensive patterns for typed errors, circuit breakers, and retries.
* **Rule `rules/common-coding-style.md`**: Universal language-agnostic style guidelines.
* **Rule `rules/react-coding-style.md`**: React-specific hook and component practices.
* **Rule `rules/java-coding-style.md`**: Spring Boot and Java 21 idioms.
