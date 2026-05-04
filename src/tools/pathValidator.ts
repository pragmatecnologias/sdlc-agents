/**
 * Path Validator Tool for SEA
 * Validates changed files against path policies (allowed, protected, forbidden paths).
 */

import { minimatch } from 'minimatch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PathPolicy {
  /** Glob patterns for paths that are allowed. Empty array = all paths allowed. */
  allowedPaths: string[];
  /** Glob patterns for paths that require extra caution (e.g. config files). */
  protectedPaths: string[];
  /** Glob patterns for paths that must never be modified. */
  forbiddenPaths: string[];
}

export interface PathValidationResult {
  /** Files that matched allowed patterns and no forbidden/protected pattern. */
  allowedChanges: string[];
  /** Files that matched protected patterns (but not forbidden). */
  protectedViolations: string[];
  /** Files that matched forbidden patterns. */
  forbiddenViolations: string[];
  /** Files that did not match any allowed pattern (when allowedPaths is non-empty). */
  outOfScopeChanges: string[];
  /** Overall validation status. Priority: blocked > warning > clean. */
  status: 'clean' | 'warning' | 'blocked';
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Check whether a file path matches any of the given glob patterns.
 */
function matchesAnyPattern(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => minimatch(filePath, pattern));
}

/**
 * Determine the overall status from the validation buckets.
 *
 * - Any forbidden violation => 'blocked'
 * - Any protected or out-of-scope violation => 'warning'
 * - Otherwise => 'clean'
 */
function computeStatus(result: PathValidationResult): PathValidationResult['status'] {
  if (result.forbiddenViolations.length > 0) {
    return 'blocked';
  }
  if (result.protectedViolations.length > 0 || result.outOfScopeChanges.length > 0) {
    return 'warning';
  }
  return 'clean';
}

/**
 * Validate a list of changed files against a path policy.
 *
 * Rules (evaluated per file, in priority order):
 * 1. If the file matches a **forbidden** pattern => forbiddenViolation, status contribution 'blocked'
 * 2. If the file matches a **protected** pattern => protectedViolation, status contribution 'warning'
 * 3. If `allowedPaths` is non-empty and the file does **not** match any allowed pattern => outOfScopeChange, status contribution 'warning'
 * 4. Otherwise => allowedChange, status contribution 'clean'
 *
 * A single file can appear in at most one of the violation/allowed buckets.
 * Forbidden takes absolute priority, then protected, then scope check.
 */
export function validatePaths(
  changedFiles: string[],
  policy: PathPolicy,
): PathValidationResult {
  const result: PathValidationResult = {
    allowedChanges: [],
    protectedViolations: [],
    forbiddenViolations: [],
    outOfScopeChanges: [],
    status: 'clean',
  };

  const { allowedPaths, protectedPaths, forbiddenPaths } = policy;
  const hasAllowedRestriction = allowedPaths.length > 0;

  for (const filePath of changedFiles) {
    // 1. Forbidden takes highest priority
    if (matchesAnyPattern(filePath, forbiddenPaths)) {
      result.forbiddenViolations.push(filePath);
      continue;
    }

    // 2. Protected takes second priority
    if (matchesAnyPattern(filePath, protectedPaths)) {
      result.protectedViolations.push(filePath);
      continue;
    }

    // 3. Scope check — only when allowedPaths has entries
    if (hasAllowedRestriction && !matchesAnyPattern(filePath, allowedPaths)) {
      result.outOfScopeChanges.push(filePath);
      continue;
    }

    // 4. Clean
    result.allowedChanges.push(filePath);
  }

  result.status = computeStatus(result);
  return result;
}
