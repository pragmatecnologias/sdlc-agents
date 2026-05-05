# Real Workspace Safety

SEA includes safety tools to help you work confidently on real enterprise projects.

## Quick Start

Before running SEA on a new workspace:

```bash
# 1. Check workspace health
sea doctor -w .sea/workspace.json

# 2. If healthy, open interactive mode
sea

# 3. Follow the recommended next action
```

## Safety Features

### sea doctor

Comprehensive workspace health check. Run before any `sea plan` or `sea run`.

```bash
sea doctor -w .sea/workspace.json
sea doctor -w .sea/workspace.json --json  # machine-readable
```

**What it checks:**
- Workspace file exists and parses
- Workspace root directory exists
- All component paths exist and are directories
- All component paths are git repositories
- Current branch per component
- Dirty status (uncommitted changes) per component
- Required tools: git, node/npm, java/maven, jar (for WAR/JAR)
- Configured commands have valid binaries in PATH
- Assembly/packager components have artifact config
- WAR artifacts have requiredEntries (WEB-INF/, WEB-INF/classes/, WEB-INF/lib/)
- Path policies (protectedPaths/forbiddenPaths) are configured

**Output format:**
```
Overall: WARN
Passed: 4
Warnings: 7
Failures: 0

[ui] git-dirty
  Problem: Repository has uncommitted changes
  Why it matters: Uncommitted changes may be lost if SEA reverts or resets during rollback
  How to fix: Commit or stash your changes before running SEA
```

### Branch Safety

Before `sea run` starts, SEA captures branch state for every component:

- Current branch name
- HEAD commit hash
- Dirty status (uncommitted changes)

```bash
# After a run, view branch safety state
sea branch run-123 -w .sea/workspace.json

# Output shows:
# - which components are dirty
# - which branches were active
# - any branches that were created
```

### Task Branches

Before making changes, you can create task branches for all components:

```bash
# Create task branches (format: sea/<run-slug>)
# This is done automatically when you use sea run with --create-branches
sea branch run-123 --create -w .sea/workspace.json
```

### Rollback

If a run makes unwanted changes, rollback to the state before the run:

```bash
# Preview what would be rolled back
sea rollback run-123 -w .sea/workspace.json

# Apply rollback (with confirmation)
sea rollback run-123 --yes -w .sea/workspace.json

# Rollback specific component only
sea rollback run-123 -c ui --yes -w .sea/workspace.json
```

Rollback:
- Shows changed components and files
- Requires `--yes` to apply (no accidental rollbacks)
- Creates rollback report at `.sea/runs/<runId>/rollback-report.json`

## Dirty Repository Warning

If you run `sea plan` or `sea run` with dirty components:

```
⚠️  Warning: The following components have uncommitted changes:
  - ui
  - backend

These changes may be affected by SEA operations.
Commit or stash before continuing, or expect possible conflicts.
```

## Interactive Mode

The interactive mode (`sea`) shows a recommended next action when you start:

```
📋 Next Action: Manual execution required for backend
   Command: sea request run-123 -c backend -w .sea/workspace.json

What would you like to do?

▶  Recommended: Manual execution required for backend (sea request run-123...)
   Start new engineering run
   Continue existing run
   View run status
   ...
```

Press Enter to run the recommended action, or choose another option.

## Workflow Checklist

Before working on a real enterprise workspace:

- [ ] Run `sea doctor` and fix any FAIL items
- [ ] Review WARN items and understand implications
- [ ] Commit or stash any uncommitted changes
- [ ] Open `sea` interactive mode for guidance
- [ ] Follow the recommended next actions

## Workspace Quality Gates

SEA enforces quality gates before allowing runs:

- `requireSourceRepoCleanBeforeRun: true` — blocks if any component is dirty (optional, configurable)
- `blockOnForbiddenPathModification: true` — blocks if forbidden paths are modified without approval
- `blockOnProtectedPathModificationWithoutApproval: true` — blocks if protected paths are modified without approval

These are configured in `workspace.json` under `qualityGates`.