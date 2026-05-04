/**
 * Output formatting utilities for SEA CLI
 */

import { FinalDecisionReport, WorkspaceState } from '../state/workspaceState.js';

/**
 * Print a formatted header
 */
export function printHeader(title: string): void {
  const line = '═'.repeat(Math.min(title.length + 4, 80));
  console.log(line);
  console.log(`  ${title}`);
  console.log(line);
}

/**
 * Print a section
 */
export function printSection(title: string, content: string | string[]): void {
  console.log(`\n## ${title}`);
  if (Array.isArray(content)) {
    for (const item of content) {
      console.log(`  ${item}`);
    }
  } else {
    console.log(content);
  }
}

/**
 * Print a key-value pair
 */
export function printKeyValue(key: string, value: string): void {
  console.log(`  ${key.padEnd(20)} ${value}`);
}

/**
 * Print final report
 */
export function printFinalReport(state: WorkspaceState): void {
  printHeader(`SEA Run Report: ${state.runId}`);

  printSection('Request', state.userRequest);

  if (state.finalDecision) {
    const verdict = state.finalDecision.decision;
    const verdictEmoji = getVerdictEmoji(verdict);
    printSection('Final Decision', `${verdictEmoji} ${verdict}`);
    printSection('Summary', state.finalDecision.summary);
  }

  if (state.brutalRealityCheck) {
    console.log(`\nBrutal Reality Check:`);
    console.log(`  Score: ${state.brutalRealityCheck.score}/100`);
    printList('REAL', state.brutalRealityCheck.real);
    printList('PARTIAL', state.brutalRealityCheck.partial);
    printList('FAKE_OR_UNVERIFIED', state.brutalRealityCheck.fakeOrUnverified);
    printList('MISSING', state.brutalRealityCheck.missing);
  }

  if (state.componentStates) {
    console.log('\n## Component Status');
    for (const [name, cs] of Object.entries(state.componentStates)) {
      const status = cs.componentDecision;
      const statusEmoji = getStatusEmoji(status);
      console.log(`  ${statusEmoji} ${name}: ${status} (${cs.changedFiles.length} files changed)`);
    }
  }

  if (state.verification) {
    console.log('\n## Verification');
    console.log(`  Commands Run: ${state.verification.totalCommandsRun}`);
    console.log(`  Passed: ${state.verification.totalPassed}`);
    console.log(`  Failed: ${state.verification.totalFailed}`);
  }

  if (state.finalDecision?.requiredFixes.length) {
    console.log('\n## Required Fixes');
    for (const fix of state.finalDecision.requiredFixes) {
      console.log(`  ⚠ ${fix}`);
    }
  }

  console.log('\n' + '═'.repeat(80));
}

function getVerdictEmoji(verdict: string): string {
  switch (verdict) {
    case 'APPROVED':
      return '✅';
    case 'APPROVED_WITH_NOTES':
      return '⚠️';
    case 'NEEDS_FIXES':
      return '🔧';
    case 'REJECTED':
      return '❌';
    case 'BLOCKED':
      return '🚫';
    default:
      return '❓';
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'verified':
      return '✅';
    case 'implemented':
      return '🔨';
    case 'needs_fix':
      return '🔧';
    case 'blocked':
      return '🚫';
    case 'skipped':
      return '⏭️';
    case 'pending':
    default:
      return '⏳';
  }
}

function printList(label: string, items: string[]): void {
  if (items.length === 0) return;
  console.log(`  ${label}:`);
  for (const item of items) {
    console.log(`    - ${item}`);
  }
}

/**
 * Print error message
 */
export function printError(message: string, error?: unknown): void {
  console.error(`\n❌ Error: ${message}`);
  if (error instanceof Error) {
    console.error(`  ${error.message}`);
  }
}

/**
 * Print success message
 */
export function printSuccess(message: string): void {
  console.log(`\n✅ ${message}`);
}

/**
 * Print info message
 */
export function printInfo(message: string): void {
  console.log(`\nℹ️  ${message}`);
}
