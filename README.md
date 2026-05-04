# SEA - Software Engineering Agents

A generic, executor-agnostic software engineering agentic control plane that produces real, verifiable evidence.

## What SEA Does

SEA runs a structured 19-phase workflow to analyze requirements, plan implementation, execute changes, and verify results with evidence captured from git diffs, test output, build output, and artifact inspection.

## Key Principles

- **Orchestrator is the control brain** - Coordinates all agents and executors
- **Agents provide specialized reasoning** - Each agent has a specific role (requirement intake, architecture planning, impact analysis, etc.)
- **Executors perform bounded implementation work** - Manual (MVP), Copilot, Claude Code, Codex, OpenClaw, Shell
- **Truth comes from evidence** - git diff, test output, build output, artifact inspection. Never from executor claims
- **Evidence-driven decisions** - Brutal reality check classifies evidence as REAL/PARTIAL/FAKE/MISSING

## Installation

```bash
npm install
npm run build
```

## Quick Start

```bash
# Initialize a workspace
sea init --workspace my-app

# Run the full workflow (planning + execution + verification)
sea run "Add PDF export" --workspace .sea/workspace.json

# Run planning only (no execution)
sea plan "Add PDF export" --workspace .sea/workspace.json

# For manual executor: view execution request
sea request <run-id> -c <component> -w .sea/workspace.json

# For manual executor: capture evidence after making changes
sea after-execution <run-id> -c <component> -w .sea/workspace.json

# Run verification
sea verify <run-id> -w .sea/workspace.json

# Resume from checkpoint
sea resume <run-id> -w .sea/workspace.json

# Show final report
sea report <run-id> -w .sea/workspace.json

# Search engineering memory
sea memory "authentication" -w .sea/workspace.json
```

## Workflow Phases

```
1.  Memory Retrieval       - Load relevant past decisions from engineering_memory.md
2.  Requirement Intake    - Parse request into title, business goal, functional requirements, acceptance criteria
3.  Workspace Discovery   - Scan project structure, detect build files, frameworks, git status
4.  Project Profile       - Classify as WAR_COMPOSITE_APP, SINGLE_REPO_FRONTEND, SPRING_BOOT_SERVICE, etc.
5.  Component Mapping     - Map component relationships and artifact flow
6.  Impact Analysis       - Classify each component's change role (modify, verify_only, no_change, etc.)
7.  Architecture Planning  - Create architectural decisions, rollback strategy
8.  Implementation Planning - Create per-component execution groups and implementation steps
9.  Human Approval        - Pause for human review (if required by approvalPolicy)
10. Execution            - Generate execution requests (manual) or call executor adapter
11. Diff Inspection      - Capture git diff and check for forbidden/protected path violations
12. Verification         - Run all configured commands (install, lint, typecheck, test, build, e2e, smoke)
13. Artifact Inspection   - Inspect JAR, WAR, npm package, static-bundle, browser extension
14. Security Review      - Check for security issues in changed code
15. Performance Review   - Check for performance concerns
16. Brutal Reality Check - Score evidence: REAL/PARTIAL/FAKE/MISSING (weighted 100pt scale)
17. Final Decision       - APPROVED / APPROVED_WITH_NOTES / NEEDS_FIXES / REJECTED / BLOCKED
18. Memory Update        - Log this run's decisions to engineering_memory.md
19. Release Writer       - Generate final-report.md, release-notes.md, verification-report.md
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `sea init --workspace <name>` | Initialize a workspace with `.sea/workspace.json` |
| `sea plan "<request>" -w <path>` | Run planning phases only (1-8) |
| `sea run "<request>" -w <path>` | Run full workflow |
| `sea request <runId> -c <component> -w <path>` | Show execution request for a component |
| `sea after-execution <runId> -c <component> -w <path>` | Capture git evidence after manual execution |
| `sea verify <runId> -w <path>` | Run verification commands |
| `sea resume <runId> -w <path>` | Resume from latest checkpoint |
| `sea report <runId> -w <path>` | Show final report |
| `sea memory [query] -w <path>` | Search or show engineering memory |

## Executors

The executor is configured in `.sea/workspace.json` under `defaultExecutor`:

- **manual** (MVP) - Generates markdown execution request files. Human performs work externally, then captures evidence with `sea after-execution`
- **copilot-cli** - GitHub Copilot CLI (placeholder)
- **claude-code** - Anthropic Claude Code (placeholder)
- **codex-cli** - OpenAI Codex CLI (placeholder)
- **openclaw** - OpenClaw (placeholder)
- **shell** - Direct shell command execution (placeholder)

## Project Profiles

SEA adapts its verification and artifact inspection based on project type:

| Profile | Verification | Artifact Inspection |
|---------|-------------|-------------------|
| WAR_COMPOSITE_APP | mvn test + mvn package | WAR file with WEB-INF/web.xml |
| SINGLE_REPO_FRONTEND | npm install + npm test + npm run build | static-bundle (dist/) |
| SPRING_BOOT_SERVICE | mvn test + mvn package | JAR with MANIFEST.MF |
| THREEJS_GAME | npm test + npm run build | static-bundle |
| CHROME_EXTENSION | npm run build | browser-extension manifest.json |
| And 12 more... | | |

## Evidence Model

SEA never trusts executor claims. Evidence must be captured:

1. **Git diff** - What changed? Captured via `getFullDiff()`
2. **Changed files** - Which files modified? Captured via `getChangedFiles()`
3. **Command output** - Test results, build output. Captured via `runCommand()` with auto-save
4. **Artifact contents** - JAR/WAR structure, npm package contents. Inspected via `adm-zip`

The Brutal Reality Check scores evidence:
- Tests passing (25pts), Builds passing (15pts), Diffs captured (20pts), Security passed (15pts), No missing evidence (25pts)
- APPROVED (80+), APPROVED_WITH_NOTES (60-79), NEEDS_FIXES (30-59), REJECTED (<30 or fake evidence)

## Quality Gates

**Hard blockers** (workflow stops):
- Forbidden path modified
- Protected path modified without approval
- Required verification failed
- Required artifact missing
- Security blocker found
- Approval denied

**Warnings** (workflow continues, notes added):
- No tests added
- Large diff without justification
- Artifact size increased significantly

## Workspace Configuration

`.sea/workspace.json` defines:
- `components[]` - name, path, kind, role, commands (install/test/build/lint/typecheck/e2e/smoke), artifact type
- `defaultExecutor` - Which executor to use
- `approvalPolicy` - When to require human approval
- `qualityGates` - What to block/warn on
- `projectProfile` - Explicit profile override

## Testing

```bash
npm test   # Runs integration tests in tests/integration/
```

## Project Status

MVP complete. All 19 phases execute end-to-end with real evidence capture. The manual executor flow is fully functional.
