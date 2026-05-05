# Real Enterprise WAR Workspace

This guide shows how to set up SEA for a real enterprise WAR application with multiple components.

## Workspace Structure

```
my-enterprise-app/
├── .sea/
│   └── workspace.json          # SEA workspace config
├── ui/                          # Frontend component
│   ├── src/
│   ├── package.json
│   └── dist/                    # Build output
├── backend/                     # Java Spring Boot backend
│   ├── src/
│   ├── pom.xml
│   └── target/                  # Build output
├── war-builder/                 # Assembly/packaging component
│   ├── assemble.sh              # Creates the WAR
│   ├── verify-war.sh            # Validates WAR structure
│   └── output/                  # WAR output directory
│       └── app.war
└── templates/
    └── war-composite-workspace.json  # Copy this to .sea/workspace.json
```

## Component Configuration

### UI Component

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
    "outputGlob": "dist/**/*"
  },
  "protectedPaths": ["public/"],
  "forbiddenPaths": ["node_modules/"]
}
```

### Backend Component

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
  "protectedPaths": ["src/main/resources/application-prod.yml"],
  "forbiddenPaths": ["src/main/resources/application-prod.yml"]
}
```

### WAR Builder Component

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

## outputGlob Example

The `outputGlob` pattern lets SEA find artifacts by pattern when the exact path varies:

```json
{
  "artifact": {
    "type": "static-bundle",
    "outputGlob": "dist/**/*"
  }
}
```

SEA resolves the glob against the component directory and selects the newest file by mtime when multiple matches exist. Directories are ignored.

## Required WAR Entries

When `artifact.type` is `"war"`, you **must** specify `requiredEntries`. SEA validates these at inspect-artifact time. Missing entries are an error, not a warning.

Minimum required entries:

```json
"requiredEntries": [
  "WEB-INF/",
  "WEB-INF/classes/",
  "WEB-INF/lib/"
]
```

Optional but recommended:

```json
"requiredEntries": [
  "WEB-INF/",
  "WEB-INF/classes/",
  "WEB-INF/lib/",
  "WEB-INF/web.xml",
  "index.html"
]
```

## Validating Your Workspace

Before running SEA, validate your workspace configuration:

```bash
npx sea validate-workspace --workspace .sea/workspace.json
```

This checks:
- All component paths exist
- Required commands are defined
- Artifact configuration is valid
- WAR components have requiredEntries
- Protected/forbidden paths don't overlap with component paths

## Safe Trial Flow

Follow this sequence to try SEA on your real workspace without risk:

### 1. Initialize

```bash
npx sea init --workspace my-enterprise-app
```

This creates `.sea/workspace.json` with defaults. Replace it with the template:

```bash
cp templates/war-composite-workspace.json .sea/workspace.json
```

Edit the paths and commands to match your actual project.

### 2. Validate

```bash
npx sea validate-workspace --workspace .sea/workspace.json
```

Fix any errors before proceeding.

### 3. Plan Only

```bash
npx sea plan "Add customer search feature" --workspace .sea/workspace.json
```

This runs planning phases (memory, requirement, discovery, profile, mapping, impact, architecture, implementation) without executing anything. Review the plan in `.sea/runs/<runId>/`.

### 4. Run (Manual Executor)

```bash
npx sea run "Add customer search feature" --workspace .sea/workspace.json --executor manual
```

SEA generates execution requests for each component and pauses. You do the work manually.

### 5. View Execution Request

```bash
npx sea request <runId> --component backend --workspace .sea/workspace.json
```

### 6. Do the Work

Make your changes to the source code.

### 7. Capture Evidence

```bash
npx sea after-execution <runId> --component backend --workspace .sea/workspace.json
npx sea after-execution <runId> --component ui --workspace .sea/workspace.json
```

### 8. Verify

```bash
npx sea verify <runId> --workspace .sea/workspace.json
```

### 9. Inspect Artifact

```bash
npx sea inspect-artifact <runId> --component war-builder --workspace .sea/workspace.json
```

### 10. Report

```bash
npx sea report <runId> --workspace .sea/workspace.json
```

### 11. Resume to Final Decision

```bash
npx sea resume <runId> --workspace .sea/workspace.json
```

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

After a full run, you'll find evidence in:

```
.sea/runs/<runId>/
├── state.json                              # Full workflow state
├── final-report.md                         # Human-readable report
├── final-decision.json                     # Decision with evidence
├── checkpoints/                            # State at each phase
├── components/
│   ├── backend/
│   │   ├── execution-request.md
│   │   ├── git-status-before.json
│   │   ├── git-status-after.json
│   │   ├── diff.patch
│   │   ├── command-results.json
│   │   └── artifact-inspection.json
│   ├── ui/
│   │   └── ...
│   └── war-builder/
│       └── ...
└── artifacts/
    ├── security-review.md
    ├── performance-review.md
    └── brutal-reality-check.md
```
