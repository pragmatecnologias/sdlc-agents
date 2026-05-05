# Real Enterprise WAR Workspace

This guide walks through setting up SEA for a real enterprise WAR application with three separate components: a UI repo, a backend repo, and a WAR builder repo.

## 1. Folder Assumptions

SEA assumes this layout on disk:

```
my-enterprise-app/              # Workspace root (parent of .sea/)
├── .sea/
│   ├── workspace.json          # SEA workspace config (you edit this)
│   └── engineering_memory.md   # Auto-managed memory log
├── ui/                         # Frontend component (its own git repo or subdir)
│   ├── src/
│   ├── package.json
│   └── dist/                   # Build output (index.html, assets/)
├── backend/                    # Backend component (its own git repo or subdir)
│   ├── src/
│   ├── pom.xml
│   └── target/                 # Build output (backend.jar, classes/)
└── war-builder/                # Assembly/packaging component
    ├── assemble.sh             # Copies ui/dist + backend JAR into WAR layout
    ├── verify-war.sh           # Validates WAR structure
    └── output/                 # WAR output directory
        └── app.war
```

**Key facts:**
- All component `path` values in workspace.json are **relative to the workspace root** (the directory containing `.sea/`).
- SEA resolves them to absolute paths at runtime via `resolveComponentPathFromState()`.
- If a component path is already absolute, it is used as-is.

## 2. Example workspace.json

See `templates/war-composite-workspace.json` for the full JSON file. The key sections are documented below.

## 3. How Component Paths Are Resolved

SEA uses a single centralized resolver (`src/tools/resolvePath.ts`):

```
workspace.json path: "ui"
         ↓
resolveComponentPathFromState(state, component)
         ↓
resolveWorkspaceRoot(state) → "/Users/you/my-enterprise-app"
         ↓
path.resolve("/Users/you/my-enterprise-app", "ui")
         ↓
Absolute: "/Users/you/my-enterprise-app/ui"
```

**All operations use this resolver:** git commands, artifact inspection, verification command execution, diff capture, and execution request generation. No operation uses `process.cwd()` as a fallback for component paths.

If `state.baseDir` is set (e.g., `/Users/you/my-enterprise-app/.sea`), the workspace root is derived as its parent.

## 4. UI Component Configuration

```json
{
  "name": "ui",
  "path": "ui",
  "kind": "frontend",
  "role": "source",
  "technology": "typescript",
  "framework": "react",
  "packageManager": "npm",
  "commands": {
    "install": "npm ci",
    "lint": "npm run lint",
    "typecheck": "npm run typecheck",
    "test": "npm test",
    "build": "npm run build"
  },
  "artifact": {
    "type": "static-bundle",
    "outputPath": "dist/index.html"
  },
  "dependencies": [],
  "produces": ["static-assets"],
  "protectedPaths": ["public/"],
  "forbiddenPaths": ["node_modules/", ".env"]
}
```

**Notes:**
- `outputPath` points to the entry file of the build output. SEA uses this to verify the build produced output.
- If you use `outputGlob` instead, see section 7 for supported patterns.
- `protectedPaths` prevents SEA from approving changes to public assets without explicit approval.
- `forbiddenPaths` blocks SEA from modifying node_modules or environment files.

## 5. Backend Component Configuration

```json
{
  "name": "backend",
  "path": "backend",
  "kind": "backend",
  "role": "source",
  "technology": "java",
  "framework": "spring-boot",
  "packageManager": "maven",
  "commands": {
    "install": "mvn dependency:resolve",
    "test": "mvn test",
    "build": "mvn package -DskipTests",
    "lint": "mvn checkstyle:check"
  },
  "artifact": {
    "type": "jar",
    "outputPath": "target/backend.jar"
  },
  "dependencies": [],
  "produces": ["classes"],
  "protectedPaths": ["src/main/resources/application-prod.yml"],
  "forbiddenPaths": ["src/main/resources/application-prod.yml"]
}
```

**Notes:**
- `outputPath` is the exact JAR path after `mvn package`.
- The same file is listed in both `protectedPaths` and `forbiddenPaths` — this means SEA will block any modification to it entirely.
- Commands run in the resolved component directory (`/path/to/workspace/backend`).

## 6. WAR Builder Component Configuration

```json
{
  "name": "war-builder",
  "path": "war-builder",
  "kind": "assembly",
  "role": "packager",
  "technology": "shell",
  "commands": {
    "build": "./assemble.sh",
    "test": "./verify-war.sh",
    "custom": {
      "package": "./assemble.sh"
    }
  },
  "artifact": {
    "type": "war",
    "outputPath": "output/app.war",
    "requiredEntries": [
      "WEB-INF/",
      "WEB-INF/classes/",
      "WEB-INF/lib/",
      "WEB-INF/web.xml"
    ],
    "inspectionProfile": "war"
  },
  "dependencies": ["ui", "backend"],
  "produces": ["war"],
  "forbiddenPaths": ["ui/", "backend/"]
}
```

**Notes:**
- `dependencies: ["ui", "backend"]` tells SEA that war-builder consumes outputs from both components.
- `forbiddenPaths: ["ui/", "backend/"]` prevents the WAR builder from modifying source code in other components.
- `requiredEntries` are validated at `inspect-artifact` time. Missing entries are a hard error.
- `custom.package` runs the same script as `build` — use custom commands for packaging-specific logic.

## 7. How to Configure outputGlob

Use `outputGlob` when the output filename varies (e.g., version-stamped builds). Use `outputPath` when the path is fixed.

**Supported glob patterns** (single-directory, filename only):

| Pattern | Example match | Notes |
|---------|--------------|-------|
| `output/*.war` | `output/app.war`, `output/app-1.2.3.war` | Selects newest by mtime |
| `target/*.jar` | `target/backend-2.0.jar` | Single-directory only |
| `dist/*.html` | `dist/index.html` | Top-level files only |

**NOT supported:**
- `dist/**/*` — recursive `**` patterns are not implemented. Use `outputPath` instead.
- Patterns spanning multiple directory levels.

**When multiple files match**, SEA selects the newest file by mtime. This is useful for version-stamped artifacts:

```json
{
  "artifact": {
    "type": "war",
    "outputGlob": "output/app-*.war"
  }
}
```

If `output/app-1.0.war` and `output/app-1.1.war` exist, SEA picks `app-1.1.war` (newest).

**Recommended approach for each component type:**

| Component | Recommended | Why |
|-----------|-------------|-----|
| UI (React, Angular) | `outputPath: "dist/index.html"` | Fixed entry point, always present after build |
| Backend (JAR) | `outputPath: "target/backend.jar"` | Fixed by maven convention |
| WAR builder | `outputPath: "output/app.war"` or `outputGlob: "output/app-*.war"` | Use glob only if version-stamped |

## 8. Required WAR Entries

When `artifact.type` is `"war"`, you **must** specify `requiredEntries`. SEA validates these at `inspect-artifact` time by opening the WAR as a ZIP file and checking for the listed paths.

**Minimum required (structural):**

```json
"requiredEntries": [
  "WEB-INF/",
  "WEB-INF/classes/",
  "WEB-INF/lib/"
]
```

**Recommended (complete):**

```json
"requiredEntries": [
  "WEB-INF/",
  "WEB-INF/classes/",
  "WEB-INF/lib/",
  "WEB-INF/web.xml",
  "index.html"
]
```

**What each entry validates:**
- `WEB-INF/` — Standard Java web application directory exists
- `WEB-INF/classes/` — Compiled classes directory exists
- `WEB-INF/lib/` — Library JARs directory exists
- `WEB-INF/web.xml` — Deployment descriptor exists
- `index.html` — Entry point for the UI exists

Missing any required entry produces a hard error. The workflow will not approve the artifact.

## 9. Protected Paths Examples

Protected paths require explicit approval before modification. If a modified file matches a protected path pattern, SEA flags it and the final decision includes a warning (or blocks if `blockOnProtectedPathModificationWithoutApproval` is true).

```json
"protectedPaths": ["public/"]
```

```json
"protectedPaths": ["src/main/resources/application-prod.yml"]
```

```json
"globalProtectedPaths": [".git/", ".env", "*.key", "*.pem"]
```

**Matching:** Uses minimatch-style glob patterns. Paths from `git diff` are matched against these patterns.

## 10. Forbidden Paths Examples

Forbidden paths block the workflow entirely if any modified file matches. Use this for files that must never be touched by automated changes.

```json
"forbiddenPaths": ["node_modules/"]
```

```json
"forbiddenPaths": ["src/main/resources/application-prod.yml"]
```

```json
"forbiddenPaths": ["ui/", "backend/"]
```

**Priority:** Forbidden paths are checked first. If a file matches both forbidden and protected, forbidden wins and the workflow is blocked.

**Common patterns:**

| Pattern | Blocks |
|---------|--------|
| `node_modules/` | Any change inside node_modules |
| `.env` | Environment file modification |
| `*.key`, `*.pem` | Private key files |
| `ui/` | Any file in the UI component (from war-builder perspective) |
| `src/main/resources/application-prod.yml` | Production config changes |

## 11. Safe First Trial Command Sequence

Follow these steps in order. Each step is safe and reversible.

### Step 1: Create the workspace directory

```bash
mkdir my-enterprise-app && cd my-enterprise-app
git init
```

### Step 2: Create your component directories

```bash
mkdir -p ui backend war-builder/output
```

At minimum, create placeholder files so paths exist:

```bash
echo '<!DOCTYPE html>' > ui/dist/index.html
echo 'class Main {}' > backend/src/Main.java
echo '#!/bin/bash' > war-builder/assemble.sh
chmod +x war-builder/assemble.sh
```

### Step 3: Copy the workspace template

```bash
mkdir -p .sea
cp /path/to/sdlc-agents/templates/war-composite-workspace.json .sea/workspace.json
```

Edit `.sea/workspace.json` — update paths, commands, and artifact config to match your actual project structure.

### Step 4: Validate the workspace

```bash
npx sea validate-workspace --workspace .sea/workspace.json
```

Fix all errors before proceeding. Warnings are acceptable.

### Step 5: Plan only (no execution)

```bash
npx sea plan "Add customer search feature" --workspace .sea/workspace.json
```

Review the plan output in `.sea/runs/<runId>/checkpoints/`. No files are modified.

### Step 6: Run the full workflow

```bash
npx sea run "Add customer search feature" --workspace .sea/workspace.json
```

SEA generates execution requests and pauses at "Manual Execution Required".

### Step 7: View execution requests

```bash
npx sea request <runId> --component backend --workspace .sea/workspace.json
npx sea request <runId> --component ui --workspace .sea/workspace.json
npx sea request <runId> --component war-builder --workspace .sea/workspace.json
```

### Step 8: Do the work manually

Edit source files in each component directory. Make real changes.

### Step 9: Capture evidence

```bash
npx sea after-execution <runId> --component backend --workspace .sea/workspace.json
npx sea after-execution <runId> --component ui --workspace .sea/workspace.json
npx sea after-execution <runId> --component war-builder --workspace .sea/workspace.json
```

Each `after-execution` captures: git status before/after, changed files, diff.patch, and validates path policy.

### Step 10: Verify

```bash
npx sea verify <runId> --workspace .sea/workspace.json
```

Runs all configured commands (install, lint, typecheck, test, build, custom) for each component that had changes.

### Step 11: Inspect artifact

```bash
npx sea inspect-artifact <runId> --component war-builder --workspace .sea/workspace.json
```

Validates WAR structure: required entries, file count, total size.

### Step 12: Report

```bash
npx sea report <runId> --workspace .sea/workspace.json
```

Shows current state, changed files, verification results, missing evidence, and next action.

### Step 13: Resume to final decision

```bash
npx sea resume <runId> --workspace .sea/workspace.json
```

Runs security review, performance review, brutal reality check, and produces final decision (APPROVED, APPROVED_WITH_NOTES, NEEDS_FIXES, or REJECTED).

## 12. Troubleshooting

### "Component path does not exist"

The `path` in workspace.json must point to an existing directory. Run `validate-workspace` to check:

```bash
npx sea validate-workspace --workspace .sea/workspace.json
```

### "WAR artifact missing required entry"

The WAR file does not contain the expected directory structure. Check:
- Your `assemble.sh` creates `WEB-INF/classes/` and `WEB-INF/lib/`
- The WAR was built before running `inspect-artifact`
- The `outputPath` or `outputGlob` points to the correct file

### "outputGlob failed: No files matching"

The glob pattern did not match any files. Check:
- The pattern is relative to the component directory
- Only simple patterns are supported: `*.war`, `app-*.jar`, `output/*.war`
- `**` recursive patterns are NOT supported — use `outputPath` instead
- The directory exists and contains files

### "Forbidden path modified"

SEA detected changes to a forbidden path. Options:
- Revert the forbidden changes: `git checkout -- <forbidden-file>`
- Remove the path from `forbiddenPaths` in workspace.json (not recommended for production configs)
- Use `after-execution` again after reverting

### "BRC score low / REJECTED"

The Brutal Reality Check assigns weights:
- Tests run and passed: 25 points
- Builds run and passed: 15 points
- Diffs present for modify components: 20 points
- No missing evidence: 25 points
- Security clean: 15 points

If your score is low, check:
- Did `verify` run all configured commands?
- Do `modify` components have actual file changes (not `completed_no_changes`)?
- Are all evidence files present in the run directory?

### "after-execution shows 0 changed files"

The component has no uncommitted changes. Either:
- You forgot to make changes (run the commands from step 8)
- Changes were already committed (after-execution compares against the BEFORE snapshot)

### "Commands saved with wrong names"

Verification commands are saved using the logical name from the config (e.g., "test", "build", "lint"), not the shell command word. If you see unexpected names in command output, check the `commands` section in workspace.json.

### Command output not found

Command stdout/stderr are saved to:
```
.sea/runs/<runId>/components/<componentName>/<commandName>-stdout.txt
.sea/runs/<runId>/components/<componentName>/<commandName>-stderr.txt
```

Check the exact `commandName` from the verification results in state.json.

## What SEA Checks

| Check | Source | Blocks? |
|-------|--------|---------|
| Forbidden path modified | git diff vs forbiddenPaths | Yes |
| Protected path modified without approval | git diff vs protectedPaths | Yes |
| Tests failed | command exit code | Yes |
| Build failed | command exit code | Yes |
| WAR missing required entries | ZIP inspection | Yes |
| Security blockers | security review | Yes |
| No diffs for modify component | git status | Yes |
| completed_no_changes for modify | executor result | Yes |
| Optional smoke test missing | verification | Warning |
| Large diff | diff size | Warning |

## Files Generated

After a full run, evidence is in:

```
.sea/runs/<runId>/
├── state.json                              # Full workflow state
├── final-report.md                         # Human-readable report
├── final-decision.json                     # Decision with evidence
├── checkpoints/                            # State at each phase
├── components/
│   ├── backend/
│   │   ├── execution-request.md            # What to implement
│   │   ├── git-status-before.json          # Snapshot before changes
│   │   ├── git-status-after.json           # Snapshot after changes
│   │   ├── diff.patch                      # Unified diff of changes
│   │   ├── command-results.json            # Verification summary
│   │   ├── test-stdout.txt                 # Test command output
│   │   ├── test-stderr.txt                 # Test command errors
│   │   ├── build-stdout.txt                # Build command output
│   │   ├── build-stderr.txt                # Build command errors
│   │   ├── lint-stdout.txt                 # Lint command output
│   │   └── artifact-inspection.json        # Artifact validation
│   ├── ui/
│   │   └── ...                             # Same structure
│   └── war-builder/
│       ├── ...
│       └── artifact-inspection.json        # WAR structure validation
└── artifacts/
    ├── security-review.md
    ├── performance-review.md
    └── brutal-reality-check.md
```
