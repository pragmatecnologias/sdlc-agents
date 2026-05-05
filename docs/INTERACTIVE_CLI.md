# Interactive CLI Mode

SEA supports two modes of operation:

1. **Automation / Power-user mode** — Raw CLI commands for scripts and automation
2. **Interactive mode** — Guided terminal control panel for daily human operation

## When to Use Interactive Mode

Use interactive mode when:
- You want guided workflow progression
- You don't remember the exact sequence of commands
- You want to see the next recommended action at each step
- You're exploring the codebase and want a safe interface

Use raw commands when:
- You're building automation scripts
- You're integrating SEA into CI/CD pipelines
- You need machine-readable JSON output
- You're performing the same operation repeatedly

## Launching Interactive Mode

```bash
sea
sea interactive
sea ui
```

All three commands open the same guided control panel.

## Main Menu

When you launch interactive mode, SEA:

1. Auto-detects the workspace (searches upward for `.sea/workspace.json`)
2. If no workspace found, asks for the path
3. Shows the main menu:

```
🔵 SEA Control Panel

✅ Detected workspace: my-enterprise-app

What would you like to do?
1. Start new engineering run
2. Continue existing run
3. View run status
4. Show next recommended action
5. Validate workspace
6. Search memory
7. Exit
```

## Menu Options

### 1. Start New Engineering Run

Prompts for the engineering task, then offers:
- **Plan only** — Runs planning phases without execution
- **Run until manual execution pause** — Full workflow that pauses at execution

Shows the run ID and next recommended action after creation.

### 2. Continue Existing Run

Lists recent runs with status and updated time. Select a run to:
- View the run board (status dashboard)
- See available actions based on current state
- Execute actions through the menu

### 3. View Run Status

Shows the **Run Board** — a dashboard with:

```
SEA Run Status
═══════════════════════════════════════════════════════════════
  Run             run-1234567890
  Status          awaiting_manual_execution
  Request         Add customer search feature
  Updated         2026-05-04 11:00 PM

──────────────────────────────────────────────────────────────
Components
──────────────────────────────────────────────────────────────
  Component      Role     ChangeRole   Decision    Changed  Cmds  Artifact  Next
──────────────────────────────────────────────────────────────
  backend        modify   pending     pending     0        0     n/a       await
  ui             modify   pending     pending     0        0     n/a       await
  war-builder    artifact pending    pending     0        0     missing   wait

Next Recommended Action
  backend is waiting for manual execution

  Command:
    sea request run-1234567890 -c backend -w .sea/workspace.json
```

### 4. Show Next Recommended Action

Shows only the next action for a selected run:

```
Next Action
═════════════════════════════════════
  backend is waiting for manual execution

  Command:
    sea request run-1234567890 -c backend -w .sea/workspace.json

  Can run interactively: Yes
```

### 5. Validate Workspace

Runs `sea validate-workspace` and shows:
- Each component's path validity
- Errors with explanations and fixes
- Warnings with context

### 6. Search Memory

Prompts for a search term, then shows matching entries from `engineering_memory.md`.

## Run Board Actions

When viewing a run's status, the interactive UI shows available actions based on current state:

| Next Action Type | Available Actions |
|-----------------|-------------------|
| OPEN_EXECUTION_REQUEST | Open execution request for component |
| CAPTURE_EVIDENCE | Capture evidence for component |
| RUN_VERIFICATION | Run verification |
| INSPECT_ARTIFACT | Inspect artifact for component |
| RESUME | Resume run to final decision |
| SHOW_REPORT | Show report |
| FIX_BLOCKER | Show blockers |

### Open Execution Request

When you select "Open execution request for {component}":

1. SEA reads and displays the full execution request content
2. Shows the file path and after-execution command
3. Asks if you want to open the file in `$EDITOR`
4. When done, run: `sea after-execution <run-id> -c <component> -w <workspace>`

### Run Verification

When you select "Run verification":

1. SEA shows a **preview** of components and their configured commands
2. Prompts for confirmation before running
3. Runs `sea verify` for all verifiable components
4. After completion, shows a **summary** with pass/fail per component
5. Shows the next recommended action

### Inspect Artifact

When you select "Inspect artifact for {component}":

1. SEA shows a **preview** with:
   - Component name
   - Artifact type
   - Output path / glob pattern
   - Required entries to check
2. Prompts for confirmation before running
3. Runs `sea inspect-artifact` for the component
4. After completion, shows inspection status and report path
5. Shows the next recommended action

## Workflow Progression

The interactive UI guides you through the workflow:

```
Start new run
    ↓
Plan → (or Run)
    ↓
[Manual Execution Required]
    ↓
Open execution request for backend
    ↓
Do work manually
    ↓
Capture evidence for backend
    ↓
Run verification
    ↓
Inspect artifact (WAR builder)
    ↓
Resume → Final decision
```

## JSON Output Commands

For automation, use `--json` flag with these commands:

```bash
# Get run status as JSON
sea status <run-id> -w .sea/workspace.json --json

# Get next action as JSON
sea next <run-id> -w .sea/workspace.json --json

# Validate workspace and get JSON results
sea validate-workspace -w .sea/workspace.json --json

# Get report as JSON
sea report <run-id> -w .sea/workspace.json --json
```

JSON output includes the actual workspace path (not a placeholder) in all command fields.

## Workspace Auto-Detection

Interactive mode auto-detects workspaces:

1. If current directory has `.sea/workspace.json` — use it
2. Search upward (max 10 levels) for `.sea/workspace.json`
3. If multiple found — ask user to select
4. If none found — prompt for path

## Custom Commands Still Work

Interactive mode doesn't replace raw commands. You can always use:

```bash
sea run "Add feature" -w .sea/workspace.json
sea after-execution <run-id> -c backend -w .sea/workspace.json
sea verify <run-id> -w .sea/workspace.json
```

## Next Action Logic

The `nextActionService` determines what to recommend based on state:

| State | Next Action |
|-------|-------------|
| awaiting_manual_execution + no evidence | OPEN_EXECUTION_REQUEST |
| awaiting_manual_execution + evidence captured | CAPTURE_EVIDENCE |
| evidence_captured | RUN_VERIFICATION |
| verification complete + no artifact inspection | INSPECT_ARTIFACT |
| All evidence captured | RESUME |
| Final decision exists | SHOW_REPORT |
| Errors present | FIX_BLOCKER |
