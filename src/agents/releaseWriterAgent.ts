/**
 * Release Writer Agent for SEA
 * Generates release notes and final report, writes them to the run artifacts directory
 */

import { WorkspaceState, ArtifactRecord } from '../state/workspaceState.js';
import { saveArtifact } from '../workflow/checkpoint.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ReleaseWriterAgent');

/**
 * Create the release writer agent function
 */
export function createReleaseWriterAgent(): (
  state: WorkspaceState
) => Promise<Partial<WorkspaceState>> {
  return async (state: WorkspaceState) => {
    logger.info('Running release writer agent');

    const { requirement, finalDecision, componentStates, verification, brutalRealityCheck, securityReview, performanceReview } = state;

    const artifacts: ArtifactRecord[] = [];
    const now = new Date().toISOString();

    // --- Generate final-report.md ---
    const finalReport = generateFinalReport(state);
    await saveArtifact(state, 'final-report.md', finalReport);
    artifacts.push({
      component: '_report',
      artifactType: 'none',
      path: 'artifacts/final-report.md',
      createdAt: now,
    });

    // --- Generate release-notes.md ---
    const releaseNotes = generateReleaseNotes(state);
    await saveArtifact(state, 'release-notes.md', releaseNotes);
    artifacts.push({
      component: '_report',
      artifactType: 'none',
      path: 'artifacts/release-notes.md',
      createdAt: now,
    });

    // --- Generate verification-report.md if verification ran ---
    if (verification) {
      const verificationReport = generateVerificationReport(state);
      await saveArtifact(state, 'verification-report.md', verificationReport);
      artifacts.push({
        component: '_report',
        artifactType: 'none',
        path: 'artifacts/verification-report.md',
        createdAt: now,
      });
    }

    logger.info(`Release artifacts written: ${artifacts.length} files`);

    return { artifacts };
  };
}

/**
 * Generate a comprehensive final report
 */
function generateFinalReport(state: WorkspaceState): string {
  const lines: string[] = [];

  lines.push(`# Final Report - ${state.runId}`);
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Request:** ${state.requirement?.title || 'N/A'}`);
  lines.push(`**Decision:** ${state.finalDecision?.decision || 'PENDING'}`);
  lines.push(`**Score:** ${state.finalDecision?.score ?? 'N/A'}/100`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(state.finalDecision?.summary || 'No summary available.');
  lines.push('');

  // Requirement details
  if (state.requirement) {
    lines.push('## Requirement');
    lines.push('');
    lines.push(`**Business Goal:** ${state.requirement.businessGoal}`);
    lines.push(`**Risk Level:** ${state.requirement.riskLevel}`);
    lines.push('');

    if (state.requirement.functionalRequirements.length > 0) {
      lines.push('### Functional Requirements');
      for (const req of state.requirement.functionalRequirements) {
        lines.push(`- ${req}`);
      }
      lines.push('');
    }

    if (state.requirement.acceptanceCriteria.length > 0) {
      lines.push('### Acceptance Criteria');
      for (const ac of state.requirement.acceptanceCriteria) {
        lines.push(`- ${ac}`);
      }
      lines.push('');
    }
  }

  // Components
  lines.push('## Components');
  lines.push('');
  lines.push('| Component | Role | Change | Decision | Files Changed |');
  lines.push('|-----------|------|--------|----------|---------------|');
  for (const [name, cs] of Object.entries(state.componentStates || {})) {
    lines.push(`| ${name} | ${cs.role} | ${cs.changeRole} | ${cs.componentDecision} | ${cs.changedFiles.length} |`);
  }
  lines.push('');

  // Command results summary
  if (state.verification) {
    const v = state.verification;
    lines.push('## Verification Summary');
    lines.push('');
    lines.push(`**Overall Status:** ${v.overallStatus}`);
    lines.push(`**Commands Run:** ${v.totalCommandsRun}`);
    lines.push(`**Passed:** ${v.totalPassed}`);
    lines.push(`**Failed:** ${v.totalFailed}`);
    lines.push(`**Tests Run:** ${v.testsRun ? 'Yes' : 'No'}`);
    lines.push(`**Builds Run:** ${v.buildsRun ? 'Yes' : 'No'}`);
    lines.push('');

    if (Object.keys(v.componentResults).length > 0) {
      lines.push('| Component | Status | Commands | Passed | Failed |');
      lines.push('|-----------|--------|----------|--------|--------|');
      for (const [compName, compResult] of Object.entries(v.componentResults)) {
        lines.push(`| ${compName} | ${compResult.status} | ${compResult.commandsRun} | ${compResult.commandsPassed} | ${compResult.commandsFailed} |`);
      }
      lines.push('');
    }
  }

  // Brutal reality check
  if (state.brutalRealityCheck) {
    const brc = state.brutalRealityCheck;
    lines.push('## Evidence Assessment');
    lines.push('');
    lines.push(`**Score:** ${brc.score}/100`);
    lines.push(`**Verdict:** ${brc.verdict}`);
    lines.push('');

    if (brc.real.length > 0) {
      lines.push('### Verified Evidence');
      for (const item of brc.real) {
        lines.push(`- [x] ${item}`);
      }
      lines.push('');
    }

    if (brc.partial.length > 0) {
      lines.push('### Partial Evidence');
      for (const item of brc.partial) {
        lines.push(`- [~] ${item}`);
      }
      lines.push('');
    }

    if (brc.fakeOrUnverified.length > 0) {
      lines.push('### Unverified / Fake Evidence');
      for (const item of brc.fakeOrUnverified) {
        lines.push(`- [!] ${item}`);
      }
      lines.push('');
    }

    if (brc.missing.length > 0) {
      lines.push('### Missing Evidence');
      for (const item of brc.missing) {
        lines.push(`- [ ] ${item}`);
      }
      lines.push('');
    }
  }

  // Security review
  if (state.securityReview) {
    lines.push('## Security Review');
    lines.push('');
    lines.push(`**Status:** ${state.securityReview.status}`);
    lines.push(`**Blockers:** ${state.securityReview.blockers}`);
    if (state.securityReview.warnings.length > 0) {
      lines.push('');
      for (const w of state.securityReview.warnings) {
        lines.push(`- ${w}`);
      }
    }
    lines.push('');
  }

  // Performance review
  if (state.performanceReview) {
    lines.push('## Performance Review');
    lines.push('');
    lines.push(`**Status:** ${state.performanceReview.status}`);
    lines.push(`**Blockers:** ${state.performanceReview.blockers}`);
    if (state.performanceReview.warnings.length > 0) {
      lines.push('');
      for (const w of state.performanceReview.warnings) {
        lines.push(`- ${w}`);
      }
    }
    lines.push('');
  }

  // Required fixes
  if (state.finalDecision?.requiredFixes?.length) {
    lines.push('## Required Fixes');
    lines.push('');
    for (const fix of state.finalDecision.requiredFixes) {
      lines.push(`- [ ] ${fix}`);
    }
    lines.push('');
  }

  // Warnings
  if (state.finalDecision?.warnings?.length) {
    lines.push('## Warnings');
    lines.push('');
    for (const warning of state.finalDecision.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push('');
  }

  // Next action
  if (state.finalDecision?.nextAction) {
    lines.push('## Next Action');
    lines.push('');
    lines.push(state.finalDecision.nextAction);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate release notes
 */
function generateReleaseNotes(state: WorkspaceState): string {
  const lines: string[] = [];

  lines.push(`# Release Notes - ${state.runId}`);
  lines.push('');
  lines.push(`**Request:** ${state.requirement?.title || 'N/A'}`);
  lines.push(`**Decision:** ${state.finalDecision?.decision || 'PENDING'}`);
  lines.push(`**Score:** ${state.finalDecision?.score ?? 'N/A'}/100`);
  lines.push(`**Date:** ${new Date().toISOString().split('T')[0]}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(state.finalDecision?.summary || 'No summary available.');
  lines.push('');

  // What changed
  lines.push('## What Changed');
  lines.push('');
  const modifiedComponents = Object.entries(state.componentStates || {})
    .filter(([, cs]) => cs.changeRole === 'modify' || cs.changeRole === 'package_only');
  if (modifiedComponents.length > 0) {
    for (const [name, cs] of modifiedComponents) {
      lines.push(`- **${name}**: ${cs.changedFiles.length} file(s) changed`);
      if (cs.changedFiles.length > 0 && cs.changedFiles.length <= 20) {
        for (const file of cs.changedFiles) {
          lines.push(`  - ${file}`);
        }
      } else if (cs.changedFiles.length > 20) {
        for (const file of cs.changedFiles.slice(0, 20)) {
          lines.push(`  - ${file}`);
        }
        lines.push(`  - ... and ${cs.changedFiles.length - 20} more`);
      }
    }
  } else {
    lines.push('No components were modified.');
  }
  lines.push('');

  // Verification results
  if (state.verification && state.verification.totalCommandsRun > 0) {
    lines.push('## Verification');
    lines.push('');
    lines.push(`- ${state.verification.totalPassed}/${state.verification.totalCommandsRun} commands passed`);
    if (state.verification.testsRun) lines.push('- Tests: passed');
    if (state.verification.buildsRun) lines.push('- Build: passed');
    lines.push('');
  }

  // Required fixes (if any)
  if (state.finalDecision?.requiredFixes?.length) {
    lines.push('## Outstanding Issues');
    lines.push('');
    for (const fix of state.finalDecision.requiredFixes) {
      lines.push(`- ${fix}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate a detailed verification report
 */
function generateVerificationReport(state: WorkspaceState): string {
  const lines: string[] = [];
  const verification = state.verification;
  if (!verification) return 'No verification data available.';

  lines.push('# Verification Report');
  lines.push('');
  lines.push(`**Run ID:** ${state.runId}`);
  lines.push(`**Overall Status:** ${verification.overallStatus}`);
  lines.push(`**Date:** ${new Date().toISOString()}`);
  lines.push('');

  lines.push(`## Summary`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Commands | ${verification.totalCommandsRun} |`);
  lines.push(`| Passed | ${verification.totalPassed} |`);
  lines.push(`| Failed | ${verification.totalFailed} |`);
  lines.push(`| Tests Run | ${verification.testsRun ? 'Yes' : 'No'} |`);
  lines.push(`| Builds Run | ${verification.buildsRun ? 'Yes' : 'No'} |`);
  lines.push('');

  // Per-component command details
  for (const [componentName, componentState] of Object.entries(state.componentStates || {})) {
    if (!componentState.commandResults || componentState.commandResults.length === 0) continue;

    lines.push(`## ${componentName}`);
    lines.push('');

    for (const result of componentState.commandResults) {
      const icon = result.status === 'passed' ? 'PASS' : 'FAIL';
      lines.push(`### [${icon}] ${result.commandName}`);
      lines.push('');
      lines.push(`- **Command:** \`${result.command}\``);
      lines.push(`- **Exit Code:** ${result.exitCode}`);
      lines.push(`- **Duration:** ${result.durationMs}ms`);
      lines.push(`- **Started:** ${result.startedAt}`);
      lines.push(`- **Finished:** ${result.finishedAt}`);
      if (result.stdoutPath) {
        lines.push(`- **Stdout:** ${result.stdoutPath}`);
      }
      if (result.stderrPath) {
        lines.push(`- **Stderr:** ${result.stderrPath}`);
      }

      // Show first 500 chars of stderr on failure
      if (result.status === 'failed' && result.stderr) {
        lines.push('');
        lines.push('**Stderr (first 500 chars):**');
        lines.push('```');
        lines.push(result.stderr.slice(0, 500));
        if (result.stderr.length > 500) {
          lines.push('... (truncated)');
        }
        lines.push('```');
      }

      lines.push('');
    }
  }

  return lines.join('\n');
}
