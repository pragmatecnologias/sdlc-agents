Final Spec
Generic Software Engineering Agent Pipeline
Executor-Agnostic, Profile-Based, Evidence-Driven Engineering Control Plane
1. Purpose

Build a reusable software engineering agentic control plane that can take an engineering request and coordinate:

requirement understanding
workspace discovery
project profile detection
component mapping
impact analysis
architecture planning
implementation planning
execution
verification
evidence collection
reality checking
final decision
memory update
release/report generation

The system must work across many kinds of projects:

single-repo frontend app
single-repo backend app
monorepo
multi-repo enterprise app
WAR-based Java application
Spring Boot service
Node API
React/Angular/Vue frontend
Chrome extension
Python CLI
Three.js game
microservices workspace
library/package
infrastructure repo
documentation repo
custom enterprise workspace

The system must not be hardcoded to one project structure, one executor, one programming language, or one build style.

2. Core Principle
The orchestrator is the control brain.
Agents provide specialized reasoning.
Executors perform bounded implementation work.
Tools collect evidence.
Quality gates decide whether the work is acceptable.
The human remains the final authority when risk is high.

The system must never accept an executor’s completion claim as truth.

Truth comes from evidence:

git diff
changed files
test output
build output
lint output
typecheck output
artifact inspection
runtime logs
browser screenshots
smoke tests
deployment verification
human approval
3. Generic Mental Model

The generic model is:

Workspace
   └── Components
          ├── source components
          ├── service components
          ├── UI components
          ├── package/assembly components
          ├── test components
          ├── infrastructure components
          ├── documentation components
          ├── generated components
          └── artifact components

Each component may:

own source code
produce artifacts
consume artifacts
depend on other components
expose contracts
require tests
require builds
require packaging
require deployment
require smoke verification

Generic system model:

Components → Planned Changes → Execution → Evidence → Verification → Final Decision
4. High-Level Architecture
User Request
   │
   ▼
Generic Engineering Orchestrator
   │
   ├── Requirement Intake Agent
   ├── Memory Retrieval Agent
   ├── Workspace Discovery Agent
   ├── Project Profile Detector
   ├── Component Mapper
   ├── Impact Analysis Agent
   ├── Architecture Planning Agent
   ├── Implementation Planning Agent
   ├── Human Approval Gate
   │
   ├── Execution Engine
   │     ├── Executor Adapter Interface
   │     ├── Manual Executor
   │     ├── Copilot Executor Adapter
   │     ├── Claude Code Executor Adapter
   │     ├── Codex Executor Adapter
   │     ├── OpenClaw Executor Adapter
   │     ├── Local Agent Executor Adapter
   │     ├── Shell Executor Adapter
   │     └── Mock Executor
   │
   ├── Verification Engine
   │     ├── Test Runner
   │     ├── Build Runner
   │     ├── Lint Runner
   │     ├── Typecheck Runner
   │     ├── Artifact Inspector
   │     ├── Smoke Test Runner
   │     ├── Browser/E2E Runner
   │     └── Custom Verification Runner
   │
   ├── Security Reviewer
   ├── Performance Reviewer
   ├── Brutal Reality Check Agent
   ├── Final Decision Agent
   ├── Release Writer Agent
   └── Memory Update Agent
5. What the System Is

This system is a software engineering control plane.

It owns:

workflow
state
planning
component mapping
approval gates
execution boundaries
verification requirements
evidence collection
quality gates
final judgment
memory
reports

It does not assume one coding agent.

It does not assume one repository.

It does not assume one artifact type.

It does not assume one verification strategy.

6. What an Executor Is

An Executor is any implementation worker that performs or assists with bounded engineering work inside a component.

Examples:

Manual human execution
GitHub Copilot CLI
GitHub Copilot Coding Agent
Claude Code
Codex CLI
OpenClaw worker
Local LLM coding agent
MCP-based coding agent
Shell script executor
Mock executor for testing

Executors may perform:

code edits
test creation
refactoring
bug fixes
documentation updates
configuration changes
small migrations
generated code updates

The orchestrator is executor-agnostic.

The orchestrator depends only on an executor interface.

The executor receives scoped work:

component
task
plan
allowed paths
protected paths
forbidden paths
constraints
definition of done
verification expectations

The executor does not own final truth.

The executor’s output must be verified by evidence.

7. Project Profiles

A Project Profile describes the structure, build strategy, artifact strategy, and verification strategy of a workspace.

The generic pipeline stays the same.

The profile changes how the pipeline behaves.

Example profiles:

SINGLE_REPO_FRONTEND
SINGLE_REPO_BACKEND
MONOREPO_WEB_APP
MULTI_REPO_ENTERPRISE_APP
WAR_COMPOSITE_APP
SPRING_BOOT_SERVICE
NODE_API
REACT_APP
ANGULAR_APP
VUE_APP
CHROME_EXTENSION
THREEJS_GAME
PYTHON_CLI
LIBRARY_PACKAGE
MICROSERVICES_WORKSPACE
INFRASTRUCTURE_REPO
DOCUMENTATION_REPO
CUSTOM
8. Generic Workspace Model
export type WorkspaceConfig = {
  workspaceName: string;

  projectProfile?: ProjectProfileName;

  defaultExecutor: string;

  approvalPolicy: ApprovalPolicy;

  qualityGates: QualityGates;

  components: ComponentConfig[];

  globalProtectedPaths?: string[];

  memory?: {
    enabled: boolean;
    path: string;
  };

  artifacts?: {
    rootDir: string;
  };
};
9. Generic Component Model
export type ComponentConfig = {
  name: string;

  path: string;

  kind:
    | "ui"
    | "frontend"
    | "backend"
    | "service"
    | "assembly"
    | "package"
    | "library"
    | "infra"
    | "test"
    | "docs"
    | "game"
    | "cli"
    | "contract"
    | "generated"
    | "unknown";

  role:
    | "source"
    | "application"
    | "service"
    | "packager"
    | "assembler"
    | "contract"
    | "test-suite"
    | "infrastructure"
    | "documentation"
    | "generated"
    | "verification-only";

  technology?: string;

  framework?: string;

  packageManager?: string;

  commands?: {
    install?: string;
    lint?: string;
    typecheck?: string;
    test?: string;
    build?: string;
    package?: string;
    e2e?: string;
    smoke?: string;
    custom?: Record<string, string>;
  };

  artifact?: {
    type?:
      | "none"
      | "static-bundle"
      | "jar"
      | "war"
      | "ear"
      | "docker-image"
      | "npm-package"
      | "python-package"
      | "browser-extension"
      | "game-build"
      | "custom";

    outputPath?: string;

    outputGlob?: string;

    inspectionProfile?: string;

    requiredEntries?: string[];

    optionalEntries?: string[];
  };

  dependencies?: string[];

  produces?: string[];

  consumes?: string[];

  contracts?: {
    type: "openapi" | "graphql" | "typescript-types" | "protobuf" | "java-dto" | "custom";
    path?: string;
  }[];

  protectedPaths?: string[];

  forbiddenPaths?: string[];

  generatedPaths?: string[];

  ignoredPaths?: string[];

  notes?: string;
};
10. Generic Change Roles

For every request, every component receives one of these roles:

modify
verify_only
package_only
artifact_verify
no_change
blocked
unknown
modify

The component requires code, test, configuration, documentation, or artifact source changes.

verify_only

The component does not require changes but should be tested or built because it may be affected.

package_only

The component packages or assembles outputs from other components.

artifact_verify

The component is involved only in verifying a produced artifact.

no_change

The component is not affected.

blocked

The component cannot be safely processed.

unknown

The orchestrator does not have enough confidence and must mark the component for human review.

11. Main Workflow
START
  │
  ▼
Load Workspace Config
  │
  ▼
Memory Retrieval
  │
  ▼
Requirement Intake
  │
  ▼
Workspace Discovery
  │
  ▼
Project Profile Detection
  │
  ▼
Component Mapping
  │
  ▼
Impact Analysis
  │
  ▼
Architecture Planning
  │
  ▼
Implementation Planning
  │
  ▼
Approval Gate
  │
  ▼
Generate Execution Requests
  │
  ▼
Execute Component Plans
  │
  ▼
Inspect Diffs
  │
  ▼
Run Verification
  │
  ▼
Inspect Artifacts
  │
  ▼
Security Review
  │
  ▼
Performance Review
  │
  ▼
Brutal Reality Check
  │
  ▼
Final Decision
  │
  ▼
Memory Update
  │
  ▼
Release Notes / Report
  │
  ▼
END
12. Component Execution Flow

For each affected component:

1. Prepare component
2. Capture git status before execution
3. Generate component-specific execution prompt/request
4. Execute using selected executor
5. Capture git status after execution
6. Capture changed files
7. Capture git diff
8. Validate changed files against allowed/protected/forbidden paths
9. Run configured verification commands
10. Capture command outputs
11. Run fix loop if needed
12. Produce component execution report
13. Workflow Runner

The workflow runner must support graph-shaped execution.

It does not need to use LangGraph in v1, but it must support LangGraph-like primitives.

export type WorkflowStep =
  | {
      type: "node";
      id: string;
      run: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    }
  | {
      type: "sequence";
      id?: string;
      steps: WorkflowStep[];
    }
  | {
      type: "parallel";
      id?: string;
      steps: WorkflowStep[];
      maxConcurrency?: number;
    }
  | {
      type: "condition";
      id: string;
      decide: (state: WorkspaceState) => WorkflowStep;
    }
  | {
      type: "loop";
      id: string;
      step: WorkflowStep;
      until: (state: WorkspaceState) => boolean;
      maxAttempts: number;
    }
  | {
      type: "approval";
      id: string;
      message: string;
      required: boolean;
    };
14. State Model
export type WorkspaceState = {
  runId: string;

  createdAt: string;

  updatedAt: string;

  userRequest: string;

  workspace: WorkspaceConfig;

  projectProfile: ProjectProfile | null;

  memoryContext: string | null;

  requirement: RequirementReport | null;

  workspaceDiscovery: WorkspaceDiscoveryReport | null;

  componentMap: ComponentMapReport | null;

  impactAnalysis: ImpactAnalysisReport | null;

  architecturePlan: ArchitecturePlan | null;

  implementationPlan: ImplementationPlan | null;

  approvals: ApprovalRecord[];

  executionGroups: ExecutionGroupState[];

  componentStates: Record<string, ComponentState>;

  verification: VerificationSummary | null;

  artifactInspections: ArtifactInspectionReport[];

  securityReview: SecurityReviewReport | null;

  performanceReview: PerformanceReviewReport | null;

  brutalRealityCheck: BrutalRealityCheckReport | null;

  finalDecision: FinalDecisionReport | null;

  artifacts: ArtifactRecord[];

  errors: WorkflowError[];
};
15. Component State Model
export type ComponentState = {
  componentName: string;

  componentPath: string;

  kind: ComponentConfig["kind"];

  role: ComponentConfig["role"];

  changeRole:
    | "modify"
    | "verify_only"
    | "package_only"
    | "artifact_verify"
    | "no_change"
    | "blocked"
    | "unknown";

  branchBefore: string | null;

  branchCreated: string | null;

  dirtyBefore: boolean;

  dirtyAfter: boolean;

  analysis: ComponentAnalysisReport | null;

  plan: ComponentImplementationPlan | null;

  executionRequestPath: string | null;

  executorResult: ExecutorResult | null;

  gitStatusBeforePath: string | null;

  gitStatusAfterPath: string | null;

  changedFiles: string[];

  forbiddenPathViolations: string[];

  protectedPathViolations: string[];

  diffPath: string | null;

  commandResults: CommandResult[];

  artifactInspection: ArtifactInspectionReport | null;

  fixAttempts: FixAttempt[];

  componentDecision:
    | "pending"
    | "implemented"
    | "verified"
    | "needs_fix"
    | "blocked"
    | "skipped";
};
16. Executor Interface
export interface ExecutorAdapter {
  name: string;

  execute(request: ExecutionRequest): Promise<ExecutorResult>;
}
export type ExecutionRequest = {
  workspaceRunId: string;

  componentName: string;

  componentPath: string;

  taskTitle: string;

  prompt: string;

  plan: ComponentImplementationPlan;

  allowedPaths: string[];

  protectedPaths: string[];

  forbiddenPaths: string[];

  mode:
    | "plan"
    | "edit"
    | "test"
    | "fix"
    | "review"
    | "docs"
    | "refactor";

  interactive: boolean;

  requireHumanApproval: boolean;

  metadata?: Record<string, unknown>;
};
export type ExecutorResult = {
  executor:
    | "manual"
    | "copilot-cli"
    | "copilot-coding-agent"
    | "claude-code"
    | "codex-cli"
    | "openclaw"
    | "local-agent"
    | "shell"
    | "mock"
    | "other";

  status:
    | "completed"
    | "cancelled"
    | "failed"
    | "manual_required"
    | "blocked";

  stdout?: string;

  stderr?: string;

  exitCode?: number;

  changedFiles: string[];

  diffPath: string | null;

  startedAt: string;

  finishedAt: string;

  notes?: string[];
};
17. Executor Modes
17.1 Manual Executor

The system generates an execution prompt/request.

A human or external tool performs the work.

Then the system resumes and verifies evidence.

17.2 Copilot Executor Adapter

Uses Copilot tooling to perform bounded code changes.

17.3 Claude Code Executor Adapter

Uses Claude Code to perform bounded code changes.

17.4 Codex Executor Adapter

Uses Codex CLI or another OpenAI coding agent interface.

17.5 OpenClaw Executor Adapter

Uses OpenClaw as a worker runtime.

17.6 Shell Executor Adapter

Runs deterministic commands or scripts.

17.7 Mock Executor

Used for testing the orchestrator.

18. Requirement Intake Agent

Converts user request into structured requirements.

Must produce:

title
business goal
functional requirements
non-functional requirements
acceptance criteria
out of scope
risk level
risk reasons
approval triggers
suspected affected components

Schema:

export type RequirementReport = {
  title: string;

  businessGoal: string;

  functionalRequirements: string[];

  nonFunctionalRequirements: string[];

  acceptanceCriteria: string[];

  outOfScope: string[];

  riskLevel: "low" | "medium" | "high" | "critical";

  riskReasons: string[];

  approvalTriggers: string[];

  suspectedAffectedComponents: string[];
};
19. Memory Retrieval Agent

Retrieves prior lessons relevant to the request.

Memory may include:

previous architectural decisions
known fragile areas
testing lessons
component-specific constraints
executor behavior lessons
release mistakes
packaging lessons
security lessons
performance lessons
20. Workspace Discovery Agent

Scans the workspace and configured components.

Must collect:

component exists
component path valid
is git repo
current branch
dirty status
framework/build hints
available scripts
package/build files
test folders
artifact output hints
dependency hints
protected paths
generated paths

Must block when:

required component path does not exist
component is not accessible
component has dirty state and policy requires clean workspace
required commands are missing
21. Project Profile Detector

Determines or validates project profile.

Inputs:

workspace config
component roles
component kinds
build files
artifact types
dependency graph

Outputs:

selected profile
confidence score
profile-specific verification requirements
profile-specific artifact strategy
profile-specific risk rules

Schema:

export type ProjectProfile = {
  name: ProjectProfileName;

  confidence: number;

  requiredComponentRoles: string[];

  recommendedVerification: string[];

  requiredVerification: string[];

  artifactStrategy?: string;

  notes: string[];
};
22. Component Mapper

Builds the component relationship map.

Must identify:

which components produce artifacts
which components consume artifacts
which components expose contracts
which components depend on others
which components are verification-only
which components are packaging/assembly components

Example relationship:

backend service produces API contract
frontend consumes API contract
packager consumes frontend static bundle and backend artifact
e2e component verifies deployed application
23. Impact Analysis Agent

Classifies components for the specific request.

Must produce:

component change roles
reasons for classification
execution order hints
cross-component risks
contract risks
artifact risks
testing risks
human review needs

Schema:

export type ImpactAnalysisReport = {
  affectedComponents: {
    component: string;

    changeRole:
      | "modify"
      | "verify_only"
      | "package_only"
      | "artifact_verify"
      | "no_change"
      | "blocked"
      | "unknown";

    reason: string;
  }[];

  executionOrderHints: string[];

  crossComponentRisks: string[];

  contractRisks: string[];

  artifactRisks: string[];

  requiresHumanReview: boolean;

  humanReviewReasons: string[];
};
24. Architecture Planning Agent

Creates system-level approach.

Must produce:

architecture decision
component responsibilities
contract changes
data flow changes
artifact changes
constraints
approval requirements
rollback strategy
execution order

Schema:

export type ArchitecturePlan = {
  decision:
    | "proceed"
    | "proceed_with_constraints"
    | "revise_request"
    | "reject"
    | "blocked";

  approach: string;

  componentResponsibilities: {
    component: string;
    responsibility: string;
  }[];

  constraints: string[];

  contractChanges: string[];

  artifactChanges: string[];

  executionOrder: string[];

  approvalRequired: boolean;

  approvalReasons: string[];

  rollbackStrategy: string[];
};
25. Implementation Planning Agent

Creates component-specific plans.

Must produce:

execution groups
component-specific steps
allowed paths
protected paths
forbidden paths
commands to run
definition of done
verification expectations
fix-loop policy

Schema:

export type ImplementationPlan = {
  executionGroups: ExecutionGroupPlan[];

  componentPlans: ComponentImplementationPlan[];
};
export type ExecutionGroupPlan = {
  groupId: string;

  description: string;

  components: string[];

  parallel: boolean;

  dependsOn: string[];
};
export type ComponentImplementationPlan = {
  component: string;

  changeRole:
    | "modify"
    | "verify_only"
    | "package_only"
    | "artifact_verify"
    | "no_change"
    | "blocked"
    | "unknown";

  steps: string[];

  allowedPaths: string[];

  protectedPaths: string[];

  forbiddenPaths: string[];

  commands: {
    install?: string;
    lint?: string;
    typecheck?: string;
    test?: string;
    build?: string;
    package?: string;
    e2e?: string;
    smoke?: string;
    custom?: Record<string, string>;
  };

  definitionOfDone: string[];

  verificationExpectations: string[];

  requiresExecutor: boolean;
};
26. Execution Request Generator

Generates a scoped request for the selected executor.

The request must include:

workspace task
component name
component role
business goal
component responsibility
architecture constraints
allowed paths
protected paths
forbidden paths
implementation steps
verification expectations
definition of done
evidence requirements

Generic prompt template:

You are executing one component-specific part of a software engineering task.

Workspace task:
{{taskTitle}}

Component:
{{componentName}}

Component kind:
{{componentKind}}

Component role:
{{componentRole}}

Change role:
{{changeRole}}

Business goal:
{{businessGoal}}

Component responsibility:
{{componentResponsibility}}

Acceptance criteria:
{{acceptanceCriteria}}

Architecture constraints:
{{architectureConstraints}}

Allowed paths:
{{allowedPaths}}

Protected paths:
{{protectedPaths}}

Forbidden paths:
{{forbiddenPaths}}

Implementation steps:
{{steps}}

Verification expectations:
{{verificationExpectations}}

Definition of done:
{{definitionOfDone}}

Important rules:
1. Work only inside this component unless explicitly instructed otherwise.
2. Keep changes minimal and aligned with existing project conventions.
3. Do not modify protected paths unless the plan explicitly allows it.
4. Do not modify forbidden paths.
5. Do not introduce placeholder code.
6. Do not skip tests because they are inconvenient.
7. Do not claim success without evidence.
8. Summarize changed files, reasons, tests run, risks, and follow-up needs.
27. Diff Inspector

After execution, inspect:

git status
changed files
diff
deleted files
new files
renamed files
protected path changes
forbidden path changes
generated file changes
large changes
unrelated changes
package/dependency changes
environment/config changes

Diff status:

clean
warning
blocked

Blocked when:

forbidden path modified
protected path modified without approval
unexpected component modified
large unexplained deletion
environment config modified without approval
security-sensitive file modified without approval
28. Verification Engine

Runs configured verification commands.

Command result schema:

export type CommandResult = {
  component: string;

  commandName: string;

  command: string;

  exitCode: number;

  status: "passed" | "failed" | "skipped" | "blocked";

  stdoutPath: string;

  stderrPath: string;

  durationMs: number;

  startedAt: string;

  finishedAt: string;
};

Verification may include:

install
lint
typecheck
unit tests
integration tests
build
package
e2e tests
smoke tests
custom commands
29. Artifact Inspection

The system must support generic artifact inspection.

Artifact types:

static-bundle
jar
war
ear
docker-image
npm-package
python-package
browser-extension
game-build
custom

Artifact inspection schema:

export type ArtifactInspectionReport = {
  component: string;

  artifactType: string;

  artifactPath: string;

  exists: boolean;

  readable: boolean;

  sizeBytes?: number;

  entriesChecked: Record<string, boolean>;

  warnings: string[];

  errors: string[];

  status: "passed" | "failed" | "warning" | "skipped";
};

Examples:

Static Bundle

Check:

dist exists
index.html exists
JS bundle exists
CSS bundle exists
asset folder exists
JAR

Check:

JAR exists
manifest exists
classes exist
dependencies included when expected
WAR

Check:

WAR exists
WEB-INF exists
WEB-INF/classes exists when expected
WEB-INF/lib exists when expected
frontend assets exist when expected
deployment descriptors exist when expected
Browser Extension

Check:

manifest.json exists
background/service worker exists
content scripts exist
icons exist
dist is loadable
Game Build

Check:

build folder exists
asset manifest exists
main bundle exists
required models/textures exist
browser smoke test can load scene
30. Security Reviewer

Checks for security-sensitive changes.

Security review should inspect:

authentication
authorization
session handling
tokens
passwords
secrets
environment config
logging of sensitive data
dependency changes
CORS
CSRF
SQL/NoSQL injection risks
path traversal
unsafe file handling
unsafe eval/dynamic code
exposed internal APIs

Security status:

approved
approved_with_notes
needs_fix
blocked
31. Performance Reviewer

Checks for performance-sensitive changes.

Performance review should inspect:

large frontend bundle growth
slow rendering paths
blocking backend operations
N+1 queries
large memory usage
slow startup
expensive synchronous calls
unbounded loops
excessive logging
artifact size increase
inefficient asset loading

Performance status:

approved
approved_with_notes
needs_fix
blocked
32. Brutal Reality Check Agent

Classifies evidence into:

REAL
PARTIAL
FAKE_OR_UNVERIFIED
MISSING

Schema:

export type BrutalRealityCheckReport = {
  real: string[];

  partial: string[];

  fakeOrUnverified: string[];

  missing: string[];

  score: number;

  verdict:
    | "APPROVED"
    | "APPROVED_WITH_NOTES"
    | "NEEDS_FIXES"
    | "REJECTED"
    | "BLOCKED";
};

Example:

{
  "real": [
    "Component diffs were captured.",
    "Configured tests were run.",
    "Build command passed.",
    "Artifact inspection passed."
  ],
  "partial": [
    "No browser smoke test was run."
  ],
  "fakeOrUnverified": [
    "Executor claimed all tests passed, but one component has no test output."
  ],
  "missing": [
    "No verification exists for generated client compatibility."
  ],
  "score": 82,
  "verdict": "APPROVED_WITH_NOTES"
}
33. Final Decision Agent

Produces one of:

APPROVED
APPROVED_WITH_NOTES
NEEDS_FIXES
REJECTED
BLOCKED

Decision rules:

APPROVED
Required changes implemented.
Required verification passed.
Required artifact inspection passed.
No blockers.
No unresolved critical risks.
APPROVED_WITH_NOTES
Required gates passed.
Optional validation is missing or partial.
No critical blockers.
NEEDS_FIXES
Implementation exists but verification, tests, artifact inspection, or quality gates found fixable issues.
REJECTED
Approach violates architecture or request should not be implemented as planned.
BLOCKED
Missing component
Dirty workspace when clean state required
Forbidden path modified
Protected path modified without approval
Required command missing
Required verification could not run
Approval denied

Final decision schema:

export type FinalDecisionReport = {
  decision:
    | "APPROVED"
    | "APPROVED_WITH_NOTES"
    | "NEEDS_FIXES"
    | "REJECTED"
    | "BLOCKED";

  summary: string;

  score: number;

  componentStatuses: {
    component: string;
    status: string;
    reason: string;
  }[];

  evidence: {
    diffsCaptured: boolean;
    testsRun: boolean;
    buildsRun: boolean;
    artifactsInspected: boolean;
    forbiddenPathViolations: number;
    protectedPathViolations: number;
    securityBlockers: number;
    performanceBlockers: number;
  };

  requiredFixes: string[];

  warnings: string[];

  nextAction: string;
};
34. Memory System

Memory stores durable engineering lessons.

Memory entry format:

## {{date}} — {{title}}

### Workspace
{{workspaceName}}

### Profile
{{projectProfile}}

### Components
{{components}}

### Decision
{{decision}}

### What Worked
- ...

### What Failed
- ...

### Lessons
- ...

### Future Rules
- ...

Memory should be used during planning.

Examples of memory:

For auth changes, require sensitive-data logging tests.
For WAR composite apps, source builds are not enough; final WAR must be verified.
For generated API clients, regenerate clients after backend contract changes.
For game builds, validate asset loading in browser, not only TypeScript build.
35. Artifact Structure

Each run must produce auditable files.

.sea/
  workspace.json
  engineering_memory.md

  runs/
    {{runId}}/
      state.json
      final-report.md
      final-decision.json

      checkpoints/
        01-memory-retrieval.json
        02-requirement.json
        03-workspace-discovery.json
        04-profile-detection.json
        05-component-map.json
        06-impact-analysis.json
        07-architecture-plan.json
        08-implementation-plan.json
        09-approval.json
        10-execution.json
        11-verification.json
        12-artifact-inspection.json
        13-security-review.json
        14-performance-review.json
        15-brutal-reality-check.json
        16-final-decision.json

      artifacts/
        execution-plan.md
        approval-request.md
        security-review.md
        performance-review.md
        brutal-reality-check.md
        release-notes.md

      components/
        {{componentName}}/
          component-analysis.md
          implementation-plan.md
          execution-request.md
          git-status-before.txt
          git-status-after.txt
          diff.patch
          command-results.json
          test-output.txt
          build-output.txt
          artifact-inspection.json
          component-report.md
36. CLI Commands
Initialize
sea init --workspace <name>

Creates:

.sea/workspace.json
.sea/engineering_memory.md
Plan
sea plan "<request>" --workspace .sea/workspace.json

Runs planning only.

Produces:

requirement report
workspace discovery
profile detection
impact analysis
architecture plan
implementation plan
execution requests
Run
sea run "<request>" --workspace .sea/workspace.json

Runs the full workflow.

Show Execution Request
sea prompt <runId> --component <componentName>

or:

sea request <runId> --component <componentName>

Shows the executor-specific request for a component.

Continue After Manual Execution
sea after-execution <runId> --component <componentName>

Captures evidence after manual execution.

Verify
sea verify <runId>

Runs verification for affected components.

Inspect Artifact
sea inspect-artifact <runId> --component <componentName>

or:

sea inspect-artifact --path <artifactPath> --type <artifactType>
Resume
sea resume <runId>

Resumes from latest checkpoint.

Report
sea report <runId>

Shows final report.

Memory Search
sea memory search "<query>"

Searches memory.

37. Project Profile: WAR Composite App

This is one profile, not the global architecture.

Profile Name
WAR_COMPOSITE_APP
Description

A workspace where one or more source components produce frontend/backend artifacts and an assembly component creates a final deployable WAR.

Typical Components
ui-source component
backend-source component
war-assembler component
optional e2e component
Example Config
{
  "workspaceName": "enterprise-war-app",
  "projectProfile": "WAR_COMPOSITE_APP",
  "defaultExecutor": "manual",
  "approvalPolicy": {
    "requireBeforeImplementation": true,
    "requireForAuthChanges": true,
    "requireForDatabaseMigrations": true,
    "requireForPackageChanges": true,
    "requireForBuildConfigChanges": true,
    "requireForDeletingFiles": true
  },
  "qualityGates": {
    "requireSourceRepoCleanBeforeRun": true,
    "requireFinalArtifactBuild": true,
    "requireArtifactInspection": true,
    "blockOnForbiddenPathModification": true,
    "blockOnProtectedPathModificationWithoutApproval": true,
    "warnIfNoSmokeTest": true
  },
  "components": [
    {
      "name": "ui",
      "path": "../ui-repo",
      "kind": "ui",
      "role": "source",
      "technology": "typescript",
      "framework": "Angular",
      "packageManager": "npm",
      "commands": {
        "install": "npm install",
        "lint": "npm run lint",
        "test": "npm test",
        "build": "npm run build"
      },
      "artifact": {
        "type": "static-bundle",
        "outputPath": "dist"
      },
      "protectedPaths": [
        "package.json",
        "package-lock.json",
        "angular.json",
        "src/environments/**"
      ]
    },
    {
      "name": "backend",
      "path": "../backend-repo",
      "kind": "backend",
      "role": "source",
      "technology": "java",
      "framework": "Spring/Tomcat",
      "packageManager": "maven",
      "commands": {
        "test": "mvn test",
        "build": "mvn clean package"
      },
      "artifact": {
        "type": "war",
        "outputGlob": "target/*.war"
      },
      "protectedPaths": [
        "pom.xml",
        "src/main/resources/application*.properties",
        "src/main/resources/application*.yml",
        "src/main/webapp/WEB-INF/web.xml"
      ]
    },
    {
      "name": "war-builder",
      "path": "../build-repo",
      "kind": "assembly",
      "role": "assembler",
      "technology": "java",
      "framework": "Maven/Ant/Custom",
      "packageManager": "custom",
      "commands": {
        "build": "mvn clean package"
      },
      "artifact": {
        "type": "war",
        "outputGlob": "target/*.war",
        "inspectionProfile": "war",
        "requiredEntries": [
          "WEB-INF/",
          "WEB-INF/classes/",
          "WEB-INF/lib/"
        ],
        "optionalEntries": [
          "index.html",
          ".js",
          ".css"
        ]
      },
      "dependencies": [
        "ui",
        "backend"
      ],
      "protectedPaths": [
        "pom.xml",
        "build.xml",
        "*.properties",
        "**/deployment/**",
        "**/env/**"
      ]
    }
  ]
}
WAR Composite App Verification Strategy

Required:

verify modified source components
build final WAR
inspect final WAR

Optional:

deploy to local Tomcat
run browser smoke test
run API smoke test
run E2E tests
WAR Artifact Inspection

Check:

WAR exists
WAR is readable
WAR size is reasonable
WEB-INF exists
WEB-INF/classes exists when expected
WEB-INF/lib exists when expected
frontend assets exist when expected
deployment descriptors exist when expected
38. Project Profile: Single Repo Frontend
Profile Name
SINGLE_REPO_FRONTEND

Typical verification:

npm install
npm run lint
npm test
npm run build
optional Playwright smoke
static bundle inspection
39. Project Profile: Spring Boot Service
Profile Name
SPRING_BOOT_SERVICE

Typical verification:

mvn test
mvn package
optional API smoke test
JAR inspection
40. Project Profile: Three.js Game
Profile Name
THREEJS_GAME

Typical verification:

npm run build
unit tests if available
browser smoke test
asset loading verification
screenshot validation
optional FPS/performance check
41. Project Profile: Chrome Extension
Profile Name
CHROME_EXTENSION

Typical verification:

npm run build
manifest inspection
extension dist inspection
browser load test
content script smoke test
42. Quality Gates
Hard Blockers
forbidden path modified
protected path modified without approval
required verification failed
required artifact missing
required artifact inspection failed
required component missing
dirty workspace when clean state is required
executor changed unrelated component
security blocker found
approval denied
Warnings
no tests added
optional smoke test missing
large diff
generated files not refreshed
artifact size increased significantly
executor claimed success without evidence
verification-only component was not verified
43. MVP Scope
MVP Must Have
workspace config
generic component model
project profile field
manual executor mode
executor adapter interface
requirement report
workspace discovery
profile detection
impact analysis
architecture plan
implementation plan
component-specific execution requests
diff capture
protected/forbidden path validation
command runner
artifact inspection framework
brutal reality check
final decision
memory log
final report
MVP Can Skip
fully automated executor spawning
parallel execution
web dashboard
LangGraphJS migration
database-backed memory
advanced semantic indexing
full PR creation
deep security scanning
full deployment automation
44. Recommended Implementation Stack
Language: TypeScript
Runtime: Node.js
CLI framework: Commander.js or similar
Validation: Zod
State storage: JSON files
Artifact storage: filesystem
Command execution: child_process
Git operations: shell git or simple-git
Markdown reports: generated files
Executor integration: adapter interface
45. Required Folder Structure
src/
  index.ts

  cli/
    commands.ts

  workflow/
    runner.ts
    steps.ts
    checkpoint.ts

  state/
    workspaceState.ts
    schemas.ts

  profiles/
    ProjectProfile.ts
    profileDetector.ts
    profiles/
      warCompositeApp.ts
      singleRepoFrontend.ts
      springBootService.ts
      threeJsGame.ts
      chromeExtension.ts

  agents/
    requirementIntakeAgent.ts
    memoryRetrievalAgent.ts
    workspaceDiscoveryAgent.ts
    projectProfileDetectorAgent.ts
    componentMapperAgent.ts
    impactAnalysisAgent.ts
    architecturePlanningAgent.ts
    implementationPlanningAgent.ts
    executionRequestAgent.ts
    diffInspectorAgent.ts
    verificationPlannerAgent.ts
    securityReviewerAgent.ts
    performanceReviewerAgent.ts
    brutalRealityCheckAgent.ts
    finalDecisionAgent.ts
    memoryUpdateAgent.ts
    releaseWriterAgent.ts

  executors/
    ExecutorAdapter.ts
    ManualExecutor.ts
    MockExecutor.ts
    # The following executor adapters are defined by this spec but not yet implemented:
    # CopilotExecutor.ts, ClaudeCodeExecutor.ts, CodexExecutor.ts, OpenClawExecutor.ts, ShellExecutor.ts

  tools/
    gitTool.ts
    commandRunner.ts
    fileSystemTool.ts
    repoScanner.ts
    workspaceTool.ts
    artifactWriter.ts
    artifactInspector.ts
    zipInspector.ts

  prompts/
    requirementIntake.md
    impactAnalysis.md
    architecturePlanning.md
    implementationPlanning.md
    executionRequest.md
    brutalRealityCheck.md
    finalDecision.md

  config/
    defaultConfig.ts
46. Final Implementation Prompt
Build a TypeScript/Node.js CLI called SEA, short for Software Engineering Agents.

SEA is a generic software engineering agentic control plane.

It must be executor-agnostic, project-profile-based, multi-component, evidence-driven, and reusable across many types of software projects.

SEA must not be hardcoded to Copilot.
SEA must not be hardcoded to WAR applications.
SEA must not be hardcoded to a single repository.

Core architecture:
- The orchestrator owns workflow, state, planning, quality gates, evidence, and final decision.
- Agents perform specialized reasoning.
- Executors perform bounded implementation work.
- Tools collect evidence.
- Project profiles define how a workspace should be understood and verified.

Executors:
- Implement an ExecutorAdapter interface.
- Include ManualExecutor for v1.
- Include placeholder adapters for Copilot, Claude Code, Codex, OpenClaw, Shell, and Mock.
- The orchestrator must call executors through the interface only.

Project profiles:
- Implement a generic ProjectProfile model.
- Support at least these profiles:
  - WAR_COMPOSITE_APP
  - SINGLE_REPO_FRONTEND
  - SPRING_BOOT_SERVICE
  - THREEJS_GAME
  - CHROME_EXTENSION
- Profiles define recommended verification and artifact inspection strategy.

Workspace model:
- A workspace contains components.
- A component has name, path, kind, role, technology, framework, commands, artifact, dependencies, protected paths, forbidden paths, generated paths, and ignored paths.
- Components can be classified as modify, verify_only, package_only, artifact_verify, no_change, blocked, or unknown for each run.

Workflow:
1. Load workspace config.
2. Retrieve relevant memory.
3. Convert user request into a structured requirement.
4. Discover workspace/components.
5. Detect or validate project profile.
6. Build component map.
7. Perform impact analysis.
8. Create architecture plan.
9. Create implementation plan.
10. Ask for approval if required.
11. Generate component-specific execution requests.
12. Execute component plans through selected executor.
13. Capture git status, changed files, and diff.
14. Validate changed files against allowed/protected/forbidden paths.
15. Run verification commands.
16. Inspect artifacts when required by profile.
17. Run security review.
18. Run performance review.
19. Run Brutal Reality Check.
20. Produce final decision.
21. Update memory.
22. Generate final report.

Manual executor v1:
- Generate execution-request.md for each affected component.
- User performs work manually or with any external tool.
- User runs `sea after-execution <runId> --component <componentName>`.
- SEA captures evidence and continues verification.

Required CLI commands:
- sea init --workspace <name>
- sea plan "<request>" --workspace .sea/workspace.json
- sea run "<request>" --workspace .sea/workspace.json
- sea request <runId> --component <componentName>
- sea after-execution <runId> --component <componentName>
- sea verify <runId>
- sea inspect-artifact <runId> --component <componentName>
- sea resume <runId>
- sea report <runId>
- sea memory search "<query>"

Required artifacts:
- state.json
- checkpoints
- component execution requests
- git status before/after
- diff.patch
- command outputs
- artifact inspection reports
- brutal reality check
- final decision
- final report
- memory entry

Quality gates:
- Block forbidden path changes.
- Block protected path changes without approval.
- Block failed required verification.
- Block missing required artifact.
- Block failed artifact inspection.
- Warn if no tests were added.
- Warn if optional smoke tests were not run.
- Warn if executor claims success without evidence.

Build this as a real foundation, not a toy demo.