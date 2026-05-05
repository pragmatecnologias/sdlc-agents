/**
 * Component Analyzer
 *
 * Analyzes a component directory to provide context for execution requests:
 * - Detected framework and build system
 * - Key files (config, source, test, build)
 * - API/client files
 * - Existing patterns
 *
 * Uses fast file scanning and keyword matching — no vector DB needed.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface ComponentAnalysis {
  componentName: string;
  componentPath: string;
  framework: string | null;
  buildSystem: string | null;
  testFramework: string | null;
  keyFiles: string[];
  testFiles: string[];
  apiFiles: string[];
  configFiles: string[];
  insights: string[];
}

const FRAMEWORK_SIGNATURES: Array<{ pattern: RegExp; framework: string }> = [
  { pattern: /react/i, framework: 'React' },
  { pattern: /vue/i, framework: 'Vue' },
  { pattern: /angular/i, framework: 'Angular' },
  { pattern: /svelte/i, framework: 'Svelte' },
  { pattern: /next/i, framework: 'Next.js' },
  { pattern: /nuxt/i, framework: 'Nuxt' },
  { pattern: /spring/i, framework: 'Spring Boot' },
  { pattern: /django/i, framework: 'Django' },
  { pattern: /flask/i, framework: 'Flask' },
  { pattern: /fastapi/i, framework: 'FastAPI' },
  { pattern: /express/i, framework: 'Express' },
  { pattern: /fastify/i, framework: 'Fastify' },
  { pattern: /nest/i, framework: 'NestJS' },
];

const BUILD_SIGNATURES: Array<{ files: string[]; buildSystem: string }> = [
  { files: ['package.json'], buildSystem: 'npm' },
  { files: ['pom.xml'], buildSystem: 'Maven' },
  { files: ['build.gradle', 'build.gradle.kts'], buildSystem: 'Gradle' },
  { files: ['Makefile'], buildSystem: 'Make' },
  { files: ['Cargo.toml'], buildSystem: 'Cargo' },
  { files: ['go.mod'], buildSystem: 'Go' },
  { files: ['Pipfile', 'requirements.txt', 'setup.py'], buildSystem: 'Python' },
];

const TEST_SIGNATURES: Array<{ pattern: RegExp; testFramework: string }> = [
  { pattern: /vitest|jest\.config|@testing-library|mocha/i, testFramework: 'JavaScript/TypeScript testing' },
  { pattern: /junit|testng|spring-boot-test/i, testFramework: 'JUnit/Spring Test' },
  { pattern: /pytest|unittest/i, testFramework: 'Python unittest/pytest' },
  { pattern: /go test|testing\.T/i, testFramework: 'Go testing' },
  { pattern: /rspec|minitest/i, testFramework: 'Ruby testing' },
  { pattern: /rspec|minitest/i, testFramework: 'Ruby testing' },
];

const API_PATTERNS = [
  /controller/i, /handler/i, /router/i, /route/i, /endpoint/i,
  /api/i, /rest/i, /graphql/i, /grpc/i,
  /service\.ts|service\.js|service\.py/i, /repository/i,
];

const CONFIG_PATTERNS = [
  /\.eslintrc|\.prettierrc|tsconfig\.json|jsconfig\.json/i,
  /webpack\.config|babel\.config|vite\.config/i,
  /application\.yml|application\.properties|logback\.xml/i,
  /\.editorconfig|\.prettierrc|\.editorconfig/i,
];

/**
 * Analyze a component directory.
 * Returns framework detection, key files, test files, and insights.
 */
export async function analyzeComponent(
  componentName: string,
  componentPath: string
): Promise<ComponentAnalysis> {
  const insights: string[] = [];
  const keyFiles: string[] = [];
  const testFiles: string[] = [];
  const apiFiles: string[] = [];
  const configFiles: string[] = [];

  let framework: string | null = null;
  let buildSystem: string | null = null;
  let testFramework: string | null = null;

  // Scan directory (max depth 4, max files 500)
  const scanResult = await scanDirectory(componentPath, 4, 500);

  // Detect framework
  for (const file of scanResult.files) {
    for (const sig of FRAMEWORK_SIGNATURES) {
      if (sig.pattern.test(file)) {
        framework = sig.framework;
        insights.push(`Detected ${framework} framework`);
        break;
      }
    }
  }

  // Detect build system
  for (const sig of BUILD_SIGNATURES) {
    if (sig.files.some((f: string) => scanResult.files.includes(f))) {
      buildSystem = sig.buildSystem;
      insights.push(`Build system: ${sig.buildSystem}`);
      break;
    }
  }

  // Detect test framework
  for (const sig of TEST_SIGNATURES) {
    for (const file of scanResult.files) {
      if (sig.pattern.test(file)) {
        testFramework = sig.testFramework;
        insights.push(`Test framework: ${testFramework}`);
        break;
      }
    }
    if (testFramework) break;
  }

  // Categorize files
  for (const file of scanResult.files) {
    const relPath = path.relative(componentPath, file);

    // API files
    if (API_PATTERNS.some(p => p.test(file))) {
      apiFiles.push(relPath);
    }

    // Config files
    if (CONFIG_PATTERNS.some(p => p.test(file))) {
      configFiles.push(relPath);
    }

    // Test files
    if (/\.(test|spec)\.(ts|js|tsx|jsx)$/.test(file) ||
        /test[/\\]/.test(file) ||
        /__tests__/.test(file) ||
        /tests?[/\\]/.test(file)) {
      testFiles.push(relPath);
    }

    // Key files (source files in src/)
    if (/^src[/\\]/.test(relPath) && /\.(ts|js|tsx|jsx|java|py|go|rb)$/.test(file)) {
      keyFiles.push(relPath);
    }

    // Entry points
    if (/^src[/\\](index|main|app)\.(ts|js|tsx|jsx|java)$/i.test(relPath)) {
      keyFiles.unshift(relPath); // push to front
    }
  }

  // Limit lists
  const maxFiles = 20;
  const limitedKeyFiles = keyFiles.slice(0, maxFiles);
  const limitedTestFiles = testFiles.slice(0, maxFiles);
  const limitedApiFiles = apiFiles.slice(0, maxFiles);
  const limitedConfigFiles = configFiles.slice(0, maxFiles);

  if (keyFiles.length > maxFiles) {
    insights.push(`Found ${keyFiles.length} source files — showing first ${maxFiles}`);
  }
  if (testFiles.length > maxFiles) {
    insights.push(`Found ${testFiles.length} test files — showing first ${maxFiles}`);
  }
  if (apiFiles.length > maxFiles) {
    insights.push(`Found ${apiFiles.length} API/route files — showing first ${maxFiles}`);
  }

  // Directory structure insights
  const hasSrc = scanResult.directories.some(d => d.endsWith('/src') || d.endsWith('\\src'));
  const hasDist = scanResult.directories.some(d => d.includes('dist') || d.includes('build'));
  const hasTest = scanResult.directories.some(d => d.includes('test') || d.includes('spec') || d.includes('tests'));
  const hasDocs = scanResult.directories.some(d => d.includes('docs') || d.includes('doc'));

  if (hasSrc) insights.push('Standard src/ layout detected');
  if (hasDist) insights.push('Build output directory detected');
  if (hasTest) insights.push('Test directory detected');
  if (hasDocs) insights.push('Documentation directory detected');

  return {
    componentName,
    componentPath,
    framework,
    buildSystem,
    testFramework,
    keyFiles: limitedKeyFiles,
    testFiles: limitedTestFiles,
    apiFiles: limitedApiFiles,
    configFiles: limitedConfigFiles,
    insights,
  };
}

interface ScanResult {
  files: string[];
  directories: string[];
}

async function scanDirectory(
  dir: string,
  maxDepth: number,
  maxFiles: number
): Promise<ScanResult> {
  const files: string[] = [];
  const directories: string[] = [];

  async function walk(currentDir: string, depth: number): Promise<void> {
    if (depth > maxDepth || files.length >= maxFiles) return;

    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (files.length >= maxFiles) break;

        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(dir, fullPath);

        // Skip common non-interesting directories
        if (entry.isDirectory()) {
          const skipDirs = ['node_modules', '.git', 'dist', 'build', '.cache', '.parcel', '__pycache__', 'target', '.next'];
          if (!skipDirs.includes(entry.name) && !relPath.includes('node_modules')) {
            directories.push(relPath);
            await walk(fullPath, depth + 1);
          }
        } else if (entry.isFile()) {
          // Skip obviously non-source files
          const skipExtensions = ['.lock', '.map', '.min.js', '.bundle.js'];
          if (!skipExtensions.some(ext => entry.name.endsWith(ext))) {
            files.push(relPath);
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  await walk(dir, 0);
  return { files, directories };
}

/**
 * Format component analysis as markdown for inclusion in execution requests.
 */
export function formatComponentAnalysisMarkdown(analysis: ComponentAnalysis): string {
  const lines: string[] = [];

  lines.push('## Component Analysis');
  lines.push('');

  if (analysis.framework || analysis.buildSystem) {
    lines.push('### Technology Stack');
    if (analysis.framework) lines.push(`- **Framework:** ${analysis.framework}`);
    if (analysis.buildSystem) lines.push(`- **Build System:** ${analysis.buildSystem}`);
    if (analysis.testFramework) lines.push(`- **Test Framework:** ${analysis.testFramework}`);
    lines.push('');
  }

  if (analysis.keyFiles.length > 0) {
    lines.push('### Key Source Files');
    for (const f of analysis.keyFiles) {
      lines.push(`- \`${f}\``);
    }
    lines.push('');
  }

  if (analysis.testFiles.length > 0) {
    lines.push('### Test Files');
    for (const f of analysis.testFiles) {
      lines.push(`- \`${f}\``);
    }
    lines.push('');
  }

  if (analysis.apiFiles.length > 0) {
    lines.push('### API / Route Files');
    for (const f of analysis.apiFiles) {
      lines.push(`- \`${f}\``);
    }
    lines.push('');
  }

  if (analysis.configFiles.length > 0) {
    lines.push('### Configuration Files');
    for (const f of analysis.configFiles) {
      lines.push(`- \`${f}\``);
    }
    lines.push('');
  }

  if (analysis.insights.length > 0) {
    lines.push('### Insights');
    for (const insight of analysis.insights) {
      lines.push(`- ${insight}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}