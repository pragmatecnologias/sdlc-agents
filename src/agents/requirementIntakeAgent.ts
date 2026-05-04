/**
 * Requirement Intake Agent for SEA
 * Converts raw user request into structured requirement report
 */

import { WorkspaceState, RequirementReport } from '../state/workspaceState.js';
import { RequirementReportSchema } from '../state/schemas.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('RequirementIntakeAgent');

export interface RequirementIntakeOptions {
  llmClient?: LLMClient;
}

export interface LLMClient {
  complete(prompt: string): Promise<string>;
}

/**
 * Create the requirement intake agent function
 */
export function createRequirementIntakeAgent(
  options: RequirementIntakeOptions = {}
): (state: WorkspaceState) => Promise<Partial<WorkspaceState>> {
  return async (state: WorkspaceState) => {
    logger.info('Running requirement intake agent');

    const { userRequest } = state;

    if (!userRequest || userRequest.trim().length === 0) {
      throw new Error('User request is required');
    }

    // For MVP, use rule-based parsing instead of LLM
    // This can be replaced with LLM call when available
    const requirement = await parseRequirement(userRequest, options.llmClient);

    // Validate against schema
    const parsed = RequirementReportSchema.safeParse(requirement);
    if (!parsed.success) {
      logger.warn('Requirement validation failed, using defaults', parsed.error);
    }

    return {
      requirement: parsed.success ? parsed.data : requirement,
    };
  };
}

/**
 * Parse requirement using rules (MVP) or LLM
 */
async function parseRequirement(
  request: string,
  llmClient?: LLMClient
): Promise<RequirementReport> {
  if (llmClient) {
    try {
      const prompt = buildRequirementIntakePrompt(request);
      const response = await llmClient.complete(prompt);
      return JSON.parse(response) as RequirementReport;
    } catch (error) {
      logger.warn('LLM parsing failed, falling back to rules', error);
    }
  }

  // Rule-based parsing for MVP
  return ruleBasedRequirementParse(request);
}

/**
 * Rule-based requirement parsing
 */
function ruleBasedRequirementParse(request: string): RequirementReport {
  const lowerRequest = request.toLowerCase();

  // Detect risk level based on keywords
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  const riskIndicators = {
    critical: ['security', 'auth', 'payment', 'database', 'migration', 'delete'],
    high: ['api', 'refactor', 'performance', 'cache', 'deploy'],
    medium: ['feature', 'add', 'create', 'implement', 'update'],
    low: ['docs', 'comment', 'typo', 'format'],
  };

  for (const [level, keywords] of Object.entries(riskIndicators)) {
    if (keywords.some(k => lowerRequest.includes(k))) {
      riskLevel = level as typeof riskLevel;
      break;
    }
  }

  // Extract potential component hints
  const componentHints = extractComponentHints(request);

  // Generate title from request
  const title = generateTitle(request);

  return {
    title,
    businessGoal: request,
    functionalRequirements: [request],
    nonFunctionalRequirements: [],
    acceptanceCriteria: [
      'Code compiles without errors',
      'Existing tests pass',
      'New functionality works as expected',
    ],
    outOfScope: [],
    riskLevel,
    riskReasons: getRiskReasons(request, riskLevel),
    approvalTriggers: getApprovalTriggers(request),
    suspectedAffectedComponents: componentHints,
  };
}

function extractComponentHints(request: string): string[] {
  const hints: string[] = [];
  const lowerRequest = request.toLowerCase();

  const componentKeywords: Record<string, string[]> = {
    frontend: ['frontend', 'ui', 'button', 'page', 'component', 'react', 'vue', 'angular'],
    backend: ['backend', 'api', 'server', 'endpoint', 'service'],
    database: ['database', 'db', 'schema', 'table', 'query'],
    auth: ['auth', 'login', 'password', 'session', 'token'],
    tests: ['test', 'spec', 'unit', 'integration'],
  };

  for (const [component, keywords] of Object.entries(componentKeywords)) {
    if (keywords.some(k => lowerRequest.includes(k))) {
      hints.push(component);
    }
  }

  return hints;
}

function generateTitle(request: string): string {
  // Take first sentence and clean it up
  const firstSentence = request.split(/[.!?]/)[0];
  const cleaned = firstSentence
    .replace(/^(add|create|implement|update|fix|remove)/i, '')
    .trim();

  const title = cleaned
    .split(' ')
    .slice(0, 8)
    .join(' ');

  return title.charAt(0).toUpperCase() + title.slice(1);
}

function getRiskReasons(request: string, riskLevel: string): string[] {
  const reasons: string[] = [];
  const lowerRequest = request.toLowerCase();

  if (lowerRequest.includes('database') || lowerRequest.includes('migration')) {
    reasons.push('Database changes can cause data loss if not handled carefully');
  }
  if (lowerRequest.includes('auth') || lowerRequest.includes('security')) {
    reasons.push('Security-related changes require careful review');
  }
  if (lowerRequest.includes('api') || lowerRequest.includes('endpoint')) {
    reasons.push('API changes may affect existing clients');
  }
  if (riskLevel === 'high' || riskLevel === 'critical') {
    reasons.push('High-risk change requires additional verification');
  }

  return reasons;
}

function getApprovalTriggers(request: string): string[] {
  const triggers: string[] = [];
  const lowerRequest = request.toLowerCase();

  if (lowerRequest.includes('auth') || lowerRequest.includes('permission')) {
    triggers.push('Security team review required');
  }
  if (lowerRequest.includes('database') || lowerRequest.includes('migration')) {
    triggers.push('Database administrator review required');
  }
  if (lowerRequest.includes('delete') || lowerRequest.includes('remove')) {
    triggers.push('Deletion requires senior engineer approval');
  }
  if (lowerRequest.includes('payment') || lowerRequest.includes('billing')) {
    triggers.push('Finance team notification required');
  }

  return triggers;
}

function buildRequirementIntakePrompt(request: string): string {
  return `You are a requirements analyst. Convert the following user request into a structured requirement report.

User Request:
${request}

Output a JSON object with this structure:
{
  "title": "Short descriptive title",
  "businessGoal": "Why is this needed?",
  "functionalRequirements": ["list of functional requirements"],
  "nonFunctionalRequirements": ["list of non-functional requirements"],
  "acceptanceCriteria": ["list of acceptance criteria"],
  "outOfScope": ["list of things not included"],
  "riskLevel": "low|medium|high|critical",
  "riskReasons": ["reasons for risk assessment"],
  "approvalTriggers": ["when human approval is required"],
  "suspectedAffectedComponents": ["components likely to be affected"]
}

Respond with only the JSON object, no markdown formatting.`;
}
