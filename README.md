# SEA - Software Engineering Agents

A generic, executor-agnostic software engineering agentic control plane.

## Overview

SEA orchestrates software engineering tasks through a structured workflow:

1. **Memory Retrieval** - Retrieves relevant past engineering decisions
2. **Requirement Intake** - Converts raw request into structured requirements
3. **Workspace Discovery** - Scans and understands the codebase
4. **Project Profile Detection** - Identifies project type (WAR, Spring Boot, React, etc.)
5. **Component Mapping** - Maps relationships between components
6. **Impact Analysis** - Classifies affected components
7. **Architecture Planning** - Creates system-level approach
8. **Implementation Planning** - Creates component-specific plans
9. **Human Approval Gate** - Pauses for human review
10. **Execution** - Executes via selected executor (Manual, Copilot, Claude Code, etc.)
11. **Diff Inspection** - Validates changes against path restrictions
12. **Verification** - Runs tests, builds, lint
13. **Artifact Inspection** - Validates produced artifacts
14. **Security Review** - Checks for security issues
15. **Performance Review** - Checks for performance issues
16. **Brutal Reality Check** - Classifies REAL/PARTIAL/FAKE/UNVERIFIED
17. **Final Decision** - Produces APPROVED/APPROVED_WITH_NOTES/NEEDS_FIXES/REJECTED/BLOCKED
18. **Memory Update** - Logs decisions for future reference
19. **Release/Report** - Generates final report

## Key Principles

- **Orchestrator is the control brain** - Not Copilot, not any executor
- **Agents provide specialized reasoning** - Each agent has a specific role
- **Executors perform bounded implementation work** - Copilot, Claude Code, Manual, etc.
- **Truth comes from evidence** - git diff, test output, build output, artifact inspection
- **Never trust executor claims** - Always verify with evidence

## Installation

```bash
npm install
npm run build
```

## Quick Start

```bash
# Initialize a workspace
sea init --workspace my-app

# Run the full workflow
sea run "Add PDF export to reports" --workspace .sea/workspace.json

# Resume from checkpoint
sea resume <run-id>

# Show report
sea report <run-id>
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `sea init -w <name>` | Initialize a new workspace |
| `sea plan "<request>" -w <path>` | Run planning phase only |
| `sea run "<request>" -w <path>` | Run full workflow |
| `sea request <runId> -c <component>` | Show execution request |
| `sea after-execution <runId> -c <component>` | Capture evidence |
| `sea verify <runId>` | Run verification |
| `sea resume <runId>` | Resume from checkpoint |
| `sea report <runId>` | Show final report |
| `sea memory [query]` | Search memory |

## Architecture

```
User Request
    │
    ▼
┌─────────────────────────────────────────┐
│        SEA Control Plane               │
├─────────────────────────────────────────┤
│  Agents: Requirement, Discovery, Impact │
│  Planning, Execution, Verification      │
│  Reviewers: Security, Performance       │
│  Brutal Reality Check                 │
└─────────────────────────────────────────┘
    │
    ▼
 Executor (Manual / Copilot / Claude Code / etc.)
```

## Executors

SEA supports multiple executors via an adapter interface:

- **Manual** (MVP) - Generates execution request files for human execution
- **Copilot** - GitHub Copilot CLI (placeholder)
- **Claude Code** - Anthropic Claude Code (placeholder)
- **Mock** - For testing

## Project Profiles

SEA adapts its behavior based on project type:

- `SINGLE_REPO_FRONTEND` - React, Vue, Angular apps
- `SPRING_BOOT_SERVICE` - Java Spring Boot
- `WAR_COMPOSITE_APP` - Java WAR applications
- `THREEJS_GAME` - Browser games
- `CHROME_EXTENSION` - Chrome extensions
- And more...

## Quality Gates

Hard blockers:
- Forbidden path modified
- Protected path modified without approval
- Required verification failed
- Required artifact missing
- Security blocker found

## License

MIT
