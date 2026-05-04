/**
 * Brutal Reality Check Agent for SEA
 * Classifies evidence as REAL, PARTIAL, FAKE_OR_UNVERIFIED, or MISSING
 * Uses weighted scoring to produce a meaningful verdict
 */

import { WorkspaceState } from '../state/workspaceState.js';
import { BrutalRealityCheckReport, FinalVerdict } from '../state/schemas.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('BrutalRealityCheckAgent');

// ---------------------------------------------------------------------------
// Evidence scoring weights (must sum to 100)
// ---------------------------------------------------------------------------
const WEIGHT_TESTS_PASSING = 25;
const WEIGHT_BUILDS_PASSING = 15;
const WEIGHT_DIFFS_CAPTURED = 20;
const WEIGHT_SECURITY_PASSED = 15;
const WEIGHT_NO_MISSING_EVIDENCE = 25;

/**
 * Create the brutal reality check agent function
 */
export function createBrutalRealityCheckAgent(): (
  state: WorkspaceState
) => Promise<Partial<WorkspaceState>> {
  return async (state: WorkspaceState) => {
    logger.info('Running brutal reality check agent');

    const {
      verification,
      componentStates,
      securityReview,
    } = state;

    const real: string[] = [];
    const partial: string[] = [];
    const fakeOrUnverified: string[] = [];
    const missing: string[] = [];

    // -----------------------------------------------------------------------
    // 1. Check diffs captured (20pts)
    // -----------------------------------------------------------------------
    const modifiedComponents = Object.entries(componentStates || {}).filter(
      ([, cs]) => cs.changeRole === 'modify' || cs.changeRole === 'package_only'
    );

    let allModifiedHaveDiffs = true;
    let anyModifiedHasDiffs = false;

    for (const [componentName, cs] of modifiedComponents) {
      if (cs.changedFiles.length > 0) {
        anyModifiedHasDiffs = true;
      } else {
        allModifiedHaveDiffs = false;
      }
    }

    if (modifiedComponents.length === 0) {
      // No modified components -- diffs not applicable, give partial credit
      real.push('No components required modification -- diffs check not applicable');
    } else if (allModifiedHaveDiffs) {
      real.push(`Diffs captured for all ${modifiedComponents.length} modified component(s)`);
    } else if (anyModifiedHasDiffs) {
      partial.push('Diffs captured for some modified components but not all');
    } else {
      fakeOrUnverified.push('No diffs captured for any modified component -- executor claims success but no file changes exist');
    }

    // -----------------------------------------------------------------------
    // 2. Check tests passing (25pts)
    // -----------------------------------------------------------------------
    let testsRunAtAll = false;
    let testsAllPassed = true;
    let totalTestCommands = 0;
    let totalTestPassed = 0;
    let totalTestFailed = 0;

    for (const [componentName, cs] of Object.entries(componentStates || {})) {
      for (const cr of cs.commandResults || []) {
        if (cr.commandName.includes('test') || cr.commandName === 'e2e' || cr.commandName === 'smoke') {
          totalTestCommands++;
          testsRunAtAll = true;
          if (cr.status === 'passed') {
            totalTestPassed++;
          } else {
            totalTestFailed++;
            testsAllPassed = false;
          }
        }
      }
    }

    if (testsRunAtAll) {
      if (testsAllPassed) {
        real.push(`All ${totalTestPassed} test command(s) passed`);
      } else {
        partial.push(`${totalTestFailed}/${totalTestCommands} test command(s) failed`);
      }
    } else if (modifiedComponents.length > 0) {
      missing.push('No tests were run for any modified component');
    }

    // -----------------------------------------------------------------------
    // 3. Check builds passing (15pts)
    // -----------------------------------------------------------------------
    let buildsRunAtAll = false;
    let buildsAllPassed = true;
    let totalBuildCommands = 0;
    let totalBuildFailed = 0;

    for (const [, cs] of Object.entries(componentStates || {})) {
      for (const cr of cs.commandResults || []) {
        if (cr.commandName === 'build') {
          totalBuildCommands++;
          buildsRunAtAll = true;
          if (cr.status !== 'passed') {
            totalBuildFailed++;
            buildsAllPassed = false;
          }
        }
      }
    }

    if (buildsRunAtAll) {
      if (buildsAllPassed) {
        real.push('All build command(s) passed');
      } else {
        partial.push(`${totalBuildFailed}/${totalBuildCommands} build command(s) failed`);
      }
    } else if (modifiedComponents.length > 0) {
      missing.push('No build commands were run');
    }

    // -----------------------------------------------------------------------
    // 4. Check artifact inspection
    // -----------------------------------------------------------------------
    const artifactsInspected = (state.artifactInspections?.length ?? 0) > 0;
    const componentsWithArtifacts = Object.entries(componentStates || {}).filter(
      ([, cs]) => cs.artifactInspection !== null
    );

    if (artifactsInspected || componentsWithArtifacts.length > 0) {
      real.push(`Artifacts inspected for ${Math.max(artifactsInspected ? state.artifactInspections!.length : 0, componentsWithArtifacts.length)} component(s)`);
    } else {
      // Only flag as missing if there were artifacts to inspect
      const hasArtifactComponents = Object.entries(componentStates || {}).some(
        ([name]) => {
          const comp = state.workspace.components?.find(c => c.name === name);
          return comp?.artifact && comp.artifact.type !== 'none';
        }
      );
      if (hasArtifactComponents) {
        missing.push('Artifacts exist but were not inspected');
      }
    }

    // -----------------------------------------------------------------------
    // 5. Check security (15pts)
    // -----------------------------------------------------------------------
    if (securityReview) {
      if (securityReview.status === 'approved') {
        real.push('Security review passed');
      } else if (securityReview.status === 'approved_with_notes') {
        partial.push(`Security review passed with ${securityReview.warnings.length} warning(s)`);
      } else if (securityReview.status === 'blocked') {
        fakeOrUnverified.push(`Security review blocked: ${securityReview.blockers} blocker(s)`);
      } else if (securityReview.status === 'needs_fix') {
        partial.push(`Security review needs fixes: ${securityReview.blockers} issue(s)`);
      }
    } else if (modifiedComponents.length > 0) {
      missing.push('No security review was performed');
    }

    // -----------------------------------------------------------------------
    // 6. Check for fake claims -- executor says success but no evidence
    // -----------------------------------------------------------------------
    for (const [componentName, cs] of Object.entries(componentStates || {})) {
      if (cs.changeRole === 'modify' && cs.changedFiles.length === 0) {
        fakeOrUnverified.push(`${componentName}: marked as modify but no files were changed`);
      }

      if (
        cs.changeRole === 'modify' &&
        cs.executorResult &&
        cs.executorResult.status === 'completed' &&
        cs.commandResults.length === 0
      ) {
        fakeOrUnverified.push(`${componentName}: executor claims completion but no command results captured`);
      }
    }

    // -----------------------------------------------------------------------
    // 7. Check for missing evidence
    // -----------------------------------------------------------------------
    if (!verification || verification.totalCommandsRun === 0) {
      if (modifiedComponents.length > 0) {
        missing.push('No verification commands were run at all');
      }
    }

    if (!verification?.buildsRun && modifiedComponents.length > 0) {
      missing.push('No build was run for modified components');
    }

    // -----------------------------------------------------------------------
    // Calculate weighted score
    // -----------------------------------------------------------------------
    const scoreTestsPassing = testsRunAtAll ? (testsAllPassed ? WEIGHT_TESTS_PASSING : Math.round(WEIGHT_TESTS_PASSING * 0.4)) : 0;
    const scoreBuildsPassing = buildsRunAtAll ? (buildsAllPassed ? WEIGHT_BUILDS_PASSING : Math.round(WEIGHT_BUILDS_PASSING * 0.4)) : 0;
    const scoreDiffsCaptured = modifiedComponents.length === 0
      ? WEIGHT_DIFFS_CAPTURED // N/A, full credit
      : allModifiedHaveDiffs
        ? WEIGHT_DIFFS_CAPTURED
        : anyModifiedHasDiffs
          ? Math.round(WEIGHT_DIFFS_CAPTURED * 0.5)
          : 0;
    const scoreSecurityPassed = securityReview
      ? securityReview.status === 'approved'
        ? WEIGHT_SECURITY_PASSED
        : securityReview.status === 'approved_with_notes'
          ? Math.round(WEIGHT_SECURITY_PASSED * 0.7)
          : 0
      : modifiedComponents.length > 0
        ? 0
        : WEIGHT_SECURITY_PASSED; // N/A, full credit
    const scoreNoMissing = missing.length === 0
      ? WEIGHT_NO_MISSING_EVIDENCE
      : missing.length <= 1
        ? Math.round(WEIGHT_NO_MISSING_EVIDENCE * 0.6)
        : 0;

    const score = scoreTestsPassing + scoreBuildsPassing + scoreDiffsCaptured + scoreSecurityPassed + scoreNoMissing;

    // -----------------------------------------------------------------------
    // Determine verdict
    // -----------------------------------------------------------------------
    let verdict: FinalVerdict;

    if (fakeOrUnverified.length > 0 || score < 30) {
      verdict = 'REJECTED';
    } else if (score < 60 || missing.length > 2) {
      verdict = 'NEEDS_FIXES';
    } else if (score < 80 || partial.length > 0 || missing.length > 0) {
      verdict = 'APPROVED_WITH_NOTES';
    } else {
      verdict = 'APPROVED';
    }

    const report: BrutalRealityCheckReport = {
      real,
      partial,
      fakeOrUnverified,
      missing,
      score,
      verdict,
    };

    logger.info(
      `Brutal reality check complete: ${verdict} (score: ${score}/100, ` +
      `real: ${real.length}, partial: ${partial.length}, fake: ${fakeOrUnverified.length}, missing: ${missing.length})`
    );

    return { brutalRealityCheck: report };
  };
}
