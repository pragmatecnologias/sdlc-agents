/**
 * Unit tests for finalDecisionAgent
 *
 * Verifies verdict determination for different component changeRoles:
 * - artifact_verify: no diff required if artifact inspection passes
 * - verify_only: no diff required if verification commands pass
 * - modify: diff required; no diff means NEEDS_FIXES
 */

import { describe, it, expect } from 'vitest';
import { createFinalDecisionAgent } from '../../src/agents/finalDecisionAgent.js';
import type { WorkspaceState } from '../../src/state/workspaceState.js';

function makeBaseState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    runId: 'test-run',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userRequest: 'test request',
    baseDir: '.sea',
    workspace: {
      workspaceName: 'test',
      defaultExecutor: 'manual',
      approvalPolicy: 'required_for_all',
      qualityGates: { requireTests: true, requireBuild: true },
      components: [],
    } as any,
    projectProfile: null,
    memoryContext: null,
    requirement: { title: 'Test Feature', businessGoal: 'test', functionalRequirements: [], acceptanceCriteria: [] } as any,
    workspaceDiscovery: null,
    componentMap: null,
    impactAnalysis: null,
    architecturePlan: null,
    implementationPlan: null,
    approvals: [],
    executionGroups: [],
    componentStates: {},
    verification: null,
    artifactInspections: [],
    securityReview: null,
    performanceReview: null,
    brutalRealityCheck: null,
    finalDecision: null,
    artifacts: [],
    errors: [],
    runStatus: 'reviewing',
    currentPhase: 'final-decision',
    ...overrides,
  };
}

function makeComponentState(overrides: Record<string, any> = {}): any {
  return {
    componentName: 'test-component',
    componentPath: './test-component',
    kind: 'source',
    role: 'source',
    changeRole: 'modify',
    branchBefore: null,
    branchCreated: null,
    dirtyBefore: false,
    dirtyAfter: false,
    analysis: null,
    plan: null,
    executionRequestPath: null,
    executorResult: null,
    gitStatusBeforePath: null,
    gitStatusAfterPath: null,
    changedFiles: [],
    forbiddenPathViolations: [],
    protectedPathViolations: [],
    diffPath: null,
    commandResults: [],
    artifactInspection: null,
    fixAttempts: [],
    componentDecision: 'pending',
    ...overrides,
  };
}

describe('finalDecisionAgent', () => {
  const agent = createFinalDecisionAgent();

  it('BLOCKED when forbidden path violations exist', async () => {
    const state = makeBaseState({
      componentStates: {
        comp: makeComponentState({
          changeRole: 'modify',
          changedFiles: ['src/index.ts'],
          forbiddenPathViolations: ['src/secret.ts'],
          executorResult: { status: 'completed', changedFiles: ['src/index.ts'] },
          commandResults: [{ commandName: 'test', exitCode: 0 }],
        }),
      },
      verification: { testsRun: true, buildsRun: true, totalPassed: 1, totalFailed: 0, totalCommandsRun: 1 } as any,
      brutalRealityCheck: { verdict: 'APPROVED', score: 80, missing: [], partial: [] } as any,
    });

    const result = await agent(state);
    expect(result.finalDecision?.decision).toBe('BLOCKED');
  });

  it('NEEDS_FIXES when modify component has no diffs', async () => {
    const state = makeBaseState({
      componentStates: {
        comp: makeComponentState({
          changeRole: 'modify',
          changedFiles: [], // no files changed
          executorResult: { status: 'completed', changedFiles: [] },
          commandResults: [{ commandName: 'test', exitCode: 0 }],
        }),
      },
      verification: { testsRun: true, buildsRun: true, totalPassed: 1, totalFailed: 0, totalCommandsRun: 1 } as any,
      brutalRealityCheck: { verdict: 'APPROVED', score: 80, missing: [], partial: [] } as any,
    });

    const result = await agent(state);
    expect(result.finalDecision?.decision).toBe('NEEDS_FIXES');
  });

  it('NEEDS_FIXES when modify component has completed_no_changes', async () => {
    const state = makeBaseState({
      componentStates: {
        comp: makeComponentState({
          changeRole: 'modify',
          changedFiles: [],
          executorResult: { status: 'completed_no_changes', changedFiles: [] },
          commandResults: [{ commandName: 'test', exitCode: 0 }],
        }),
      },
      verification: { testsRun: true, buildsRun: true, totalPassed: 1, totalFailed: 0, totalCommandsRun: 1 } as any,
      brutalRealityCheck: { verdict: 'APPROVED', score: 80, missing: [], partial: [] } as any,
    });

    const result = await agent(state);
    expect(result.finalDecision?.decision).toBe('NEEDS_FIXES');
  });

  it('does not require diff for verify_only component with passing commands', async () => {
    const state = makeBaseState({
      componentStates: {
        comp: makeComponentState({
          changeRole: 'verify_only',
          changedFiles: [], // no changes expected
          executorResult: { status: 'completed', changedFiles: [] },
          commandResults: [
            { commandName: 'install', exitCode: 0 },
            { commandName: 'test', exitCode: 0 },
            { commandName: 'build', exitCode: 0 },
          ],
        }),
      },
      verification: { testsRun: true, buildsRun: true, totalPassed: 3, totalFailed: 0, totalCommandsRun: 3 } as any,
      brutalRealityCheck: { verdict: 'APPROVED', score: 90, missing: [], partial: [] } as any,
    });

    const result = await agent(state);
    // Should NOT be NEEDS_FIXES solely because there are no diffs
    expect(result.finalDecision?.decision).not.toBe('NEEDS_FIXES');
  });

  it('does not require diff for artifact_verify component with passing inspection', async () => {
    const state = makeBaseState({
      componentStates: {
        warBuilder: makeComponentState({
          componentName: 'war-builder',
          changeRole: 'artifact_verify',
          changedFiles: [],
          executorResult: { status: 'completed', changedFiles: [] },
          commandResults: [{ commandName: 'custom:package', exitCode: 0 }],
        }),
      },
      verification: { testsRun: false, buildsRun: true, totalPassed: 1, totalFailed: 0, totalCommandsRun: 1 } as any,
      artifactInspections: [{
        component: 'war-builder',
        artifactType: 'war',
        status: 'passed',
        entriesChecked: { 'WEB-INF/': true, 'WEB-INF/classes/': true },
        errors: [],
        warnings: [],
      }] as any,
      brutalRealityCheck: { verdict: 'APPROVED', score: 85, missing: [], partial: [] } as any,
    });

    const result = await agent(state);
    // artifact_verify with no diff should not fail because of missing diffs
    expect(result.finalDecision?.decision).not.toBe('NEEDS_FIXES');
  });

  it('NEEDS_FIXES when verify_only has failing commands', async () => {
    const state = makeBaseState({
      componentStates: {
        comp: makeComponentState({
          changeRole: 'verify_only',
          changedFiles: [],
          executorResult: { status: 'completed', changedFiles: [] },
          commandResults: [
            { commandName: 'test', exitCode: 1 },
          ],
        }),
      },
      verification: { testsRun: true, buildsRun: false, totalPassed: 0, totalFailed: 1, totalCommandsRun: 1 } as any,
      brutalRealityCheck: { verdict: 'NEEDS_FIXES', score: 40, missing: ['tests failed'], partial: [] } as any,
    });

    const result = await agent(state);
    expect(result.finalDecision?.decision).toBe('NEEDS_FIXES');
  });
});
