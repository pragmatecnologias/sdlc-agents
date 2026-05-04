/**
 * Security Reviewer Agent for SEA
 * Reviews changes for security issues
 */
import { createLogger } from '../utils/logger.js';
const logger = createLogger('SecurityReviewerAgent');
/**
 * Create the security reviewer agent function
 */
export function createSecurityReviewerAgent() {
    return async (state) => {
        logger.info('Running security reviewer agent');
        const { componentStates } = state;
        const findings = [];
        let blockers = 0;
        const warnings = [];
        const notes = [];
        // Collect all changed files from all components
        const allChangedFiles = [];
        // Analyze each changed file for security issues
        for (const [componentName, componentState] of Object.entries(componentStates || {})) {
            if (componentState.changeRole !== 'modify')
                continue;
            if (componentState.changedFiles.length === 0)
                continue;
            allChangedFiles.push(...componentState.changedFiles);
            const componentFindings = analyzeSecurityIssues(componentState.changedFiles, componentName);
            findings.push(...componentFindings);
            blockers += componentFindings.filter(f => f.severity === 'critical').length;
        }
        // Check for authentication/authorization changes
        const hasAuthChanges = checkForAuthChanges(allChangedFiles);
        if (hasAuthChanges) {
            findings.push({
                severity: 'high',
                category: 'authentication',
                description: 'Authentication/authorization code changed',
                recommendation: 'Ensure proper access controls are maintained',
            });
            blockers += 1;
        }
        // Check for sensitive data handling
        const hasSensitiveData = checkForSensitiveData(allChangedFiles);
        if (hasSensitiveData) {
            findings.push({
                severity: 'medium',
                category: 'data-protection',
                description: 'Sensitive data handling detected',
                recommendation: 'Verify proper encryption and data protection',
            });
        }
        // Determine status
        let status;
        if (blockers > 0) {
            status = 'blocked';
        }
        else if (warnings.length > 0) {
            status = 'approved_with_notes';
        }
        else {
            status = 'approved';
        }
        const report = {
            status,
            findings,
            blockers,
            warnings,
            notes,
        };
        return { securityReview: report };
    };
}
function analyzeSecurityIssues(changedFiles, componentName) {
    const findings = [];
    // This is a simplified rule-based analysis
    // In production, you'd use actual code analysis
    const dangerousPatterns = [
        { pattern: /eval\s*\(/, severity: 'high', category: 'code-injection', recommendation: 'Avoid using eval' },
        { pattern: /innerHTML\s*=/, severity: 'medium', category: 'xss', recommendation: 'Use textContent or sanitize HTML' },
        { pattern: /document\.write/, severity: 'medium', category: 'xss', recommendation: 'Use DOM APIs instead' },
        { pattern: /password\s*=\s*["']/, severity: 'high', category: 'credentials', recommendation: 'Use environment variables for secrets' },
        { pattern: /api[_-]?key\s*=\s*["']/, severity: 'high', category: 'secrets', recommendation: 'Use environment variables for API keys' },
        { pattern: /crypto\.(createCipher|createDecipher)/, severity: 'medium', category: 'crypto', recommendation: 'Use crypto.createCipheriv instead' },
        { pattern: /SQL\s*\+\s*["']|execute\s*\(/, severity: 'critical', category: 'sql-injection', recommendation: 'Use parameterized queries' },
    ];
    // For now, just log that we'd analyze files
    logger.debug(`Analyzing ${changedFiles.length} files in ${componentName} for security issues`);
    return findings;
}
function checkForAuthChanges(changedFiles) {
    const authKeywords = ['auth', 'login', 'password', 'session', 'token', 'permission', 'access'];
    return changedFiles.some(file => authKeywords.some(k => file.toLowerCase().includes(k)));
}
function checkForSensitiveData(changedFiles) {
    const sensitiveKeywords = ['secret', 'credential', 'password', 'token', 'key', 'private'];
    return changedFiles.some(file => sensitiveKeywords.some(k => file.toLowerCase().includes(k)));
}
//# sourceMappingURL=securityReviewerAgent.js.map