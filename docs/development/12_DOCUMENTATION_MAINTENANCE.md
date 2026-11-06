# Phase 14: Documentation Maintenance, API Synchronization & Architecture Integrity

> **Engineering Standard: Living Documentation**  
> Documentation is as critical as source code. Stale documentation misleads developers, breaks AI agent context, and causes operational outages. This guide establishes the living documentation standard, mapping code modifications to their mandatory documentation updates.

---

## 1. The Living Documentation Principle

* **Docs-as-Code**: Documentation lives in version control alongside the source code it describes.
* **Atomic Commits**: Documentation updates must be included in the exact same commit or pull request that introduces the code changes.
* **Zero Documentation Debt**: No task is "Done" until all relevant technical documents, API contracts, and configuration templates reflect current reality.

---

## 2. Code-to-Documentation Synchronization Matrix

Whenever code is modified, update the corresponding documentation files before requesting review:

| When You Change... | You MUST Update... | Specific Sections to Review |
|---|---|---|
| **REST Endpoints / WebSocket Events** | [docs/api-contracts.md](../api-contracts.md) | REST request/response schemas, query parameters, WebSocket event types & payload envelopes. |
| **Database Tables, Columns, Indexes** | [docs/database-schema.md](../database-schema.md) | Entity relationship diagrams, table definitions, column types, Flyway migration log. |
| **System Architecture / Protocols** | [docs/architecture.md](../architecture.md) | Component diagrams, real-time lifecycle flow, media upload pipeline. |
| **Environment Variables / Ports** | [.env.example](../../.env.example) & [AGENTS.md](../../AGENTS.md) | Port allocation table, required secrets, default connection strings. |
| **Mobile Build / Native Config** | [docs/mobile-and-build-guide.md](../mobile-and-build-guide.md) | Android SDK requirements, Gradle commands, APK/AAB build steps. |
| **Linux Packaging / Electron** | [docs/linux-desktop-and-store-guide.md](../linux-desktop-and-store-guide.md) | AppImage/deb/snap build scripts, system tray instructions. |
| **Engineering Standards / Workflows** | [docs/development/](./) | Playbook updates, prompt templates, phase gates. |

---

## 3. Maintaining Architectural Integrity & Codemaps

As the codebase grows, file structures evolve. Keep directory maps up to date:

1. **File Tree in AGENTS.md & README.md**:
   * When creating or removing major directories or services, update the tree diagrams in [AGENTS.md](../../AGENTS.md) and [README.md](../../README.md).
2. **Clickable Markdown File Links**:
   * Ensure all internal links use clean relative markdown links.
   * Broken links erode developer experience and break automated AI navigation.

---

## 4. Changelog Standards & Semantic Versioning (SemVer)

Document user-facing and technical changes using the [Keep a Changelog](https://keepachangelog.com/) format and Semantic Versioning (`MAJOR.MINOR.PATCH`):

* **MAJOR (X.0.0)**: Incompatible API breaks, major database restructurings, or dropped platform support.
* **MINOR (1.X.0)**: New backward-compatible functionality, new endpoints, or non-breaking database columns.
* **PATCH (1.0.X)**: Backward-compatible bug fixes and performance improvements.

### Standard Changelog Entry Format:
```markdown
## [1.2.0] - 2026-10-27
### Added
- Pinned messages feature in 1-on-1 and group chats.
- WebSocket event `message.pinned` broadcast to active conversation participants.

### Changed
- Improved media upload retry logic with exponential backoff.

### Fixed
- Resolved white-screen crash on mobile when rendering text messages with null attachments.

### Security
- Added rate-limiting filter on `/api/v1/auth/login` to prevent credential brute-forcing.
```

---

## 5. Verified ECC Tools for Phase 14

* **Workflow `workflows/update-docs.md`**: Automatically extracts route and export changes to synchronize documentation.
* **Workflow `workflows/update-codemaps.md`**: Scans project tree and generates token-lean architectural codemaps.
* **Agent `doc-updater`**: Specialized agent persona for synchronizing Markdown documentation with active code.
* **Skill `skills/living-docs-governance`**: Standards for preventing documentation drift across release cycles.
