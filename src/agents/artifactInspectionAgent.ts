/**
 * Artifact Inspection Agent for SEA
 * Inspects built artifacts for validation using adm-zip for JAR/WAR inspection
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { WorkspaceState } from '../state/workspaceState.js';
import { ArtifactInspectionReport, ArtifactType } from '../state/schemas.js';
import { saveComponentArtifact } from '../workflow/checkpoint.js';
import { resolveComponentPathFromState } from '../tools/resolvePath.js';
import { resolveComponentArtifact } from '../tools/artifactResolver.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ArtifactInspectionAgent');

/**
 * Create the artifact inspection agent function
 */
export function createArtifactInspectionAgent(): (
  state: WorkspaceState,
  onlyComponent?: string
) => Promise<Partial<WorkspaceState>> {
  return async (state: WorkspaceState, onlyComponent?: string) => {
    logger.info('Running artifact inspection agent');

    const { componentStates, workspace } = state;

    // Deep clone component states so we can mutate them
    const updatedComponentStates: Record<string, any> = {};
    for (const [name, cs] of Object.entries(componentStates || {})) {
      updatedComponentStates[name] = { ...cs };
    }

    const inspections: ArtifactInspectionReport[] = [];

    for (const [componentName, componentState] of Object.entries(componentStates || {})) {
      // If onlyComponent is specified, skip others
      if (onlyComponent && componentName !== onlyComponent) continue;

      const component = workspace.components?.find(c => c.name === componentName);
      if (!component || !component.artifact) continue;

      // Only inspect if component was modified (unless targeting a specific component)
      if (!onlyComponent && componentState.changeRole === 'no_change') continue;

      // Determine the artifact path using shared resolver
      const componentPath = resolveComponentPathFromState(state, component);
      const resolution = await resolveComponentArtifact(
        componentPath,
        component.artifact.outputPath,
        component.artifact.outputGlob
      );

      if (resolution.artifactPath === undefined) {
        const skipReport: ArtifactInspectionReport = {
          component: componentName,
          artifactType: component.artifact.type,
          artifactPath: '(none resolved)',
          exists: false,
          readable: false,
          entriesChecked: {},
          warnings: [],
          errors: [resolution.error],
          status: 'failed',
        };
        inspections.push(skipReport);
        updatedComponentStates[componentName].artifactInspection = skipReport;
        continue;
      }

      const artifactPath = resolution.artifactPath;
      if (resolution.resolvedVia === 'outputGlob' && resolution.globInfo) {
        logger.info(`outputGlob resolved: ${resolution.globInfo.reason}`);
      }

      try {
        let report: ArtifactInspectionReport;

        switch (component.artifact.type) {
          case 'jar':
            report = await inspectJar(componentName, artifactPath, component.artifact.requiredEntries);
            break;
          case 'war':
            report = await inspectWar(componentName, artifactPath, component.artifact.requiredEntries);
            break;
          case 'static-bundle':
            report = await inspectStaticBundle(componentName, artifactPath, component.artifact.requiredEntries);
            break;
          case 'browser-extension':
            report = await inspectBrowserExtension(componentName, artifactPath, component.artifact.requiredEntries);
            break;
          default:
            report = {
              component: componentName,
              artifactType: component.artifact.type,
              artifactPath,
              exists: false,
              readable: false,
              entriesChecked: {},
              warnings: [`Unsupported artifact type: ${component.artifact.type}`],
              errors: [],
              status: 'skipped',
            };
        }

        inspections.push(report);

        // Store inspection on component state
        updatedComponentStates[componentName].artifactInspection = report;

        // Save inspection report to component artifact directory
        await saveComponentArtifact(
          state,
          componentName,
          'artifact-inspection.json',
          JSON.stringify(report, null, 2)
        );
      } catch (error) {
        logger.warn(`Failed to inspect artifact for ${componentName}: ${error}`);

        const errorReport: ArtifactInspectionReport = {
          component: componentName,
          artifactType: component.artifact.type,
          artifactPath,
          exists: false,
          readable: false,
          entriesChecked: {},
          warnings: [],
          errors: [`Inspection failed: ${error instanceof Error ? error.message : String(error)}`],
          status: 'failed',
        };

        inspections.push(errorReport);
        updatedComponentStates[componentName].artifactInspection = errorReport;
      }
    }

    logger.info(`Inspected ${inspections.length} artifacts`);

    return {
      artifactInspections: inspections,
      componentStates: updatedComponentStates,
    };
  };
}

/**
 * Inspect a JAR artifact using adm-zip
 */
async function inspectJar(
  componentName: string,
  jarPath: string,
  requiredEntries?: string[]
): Promise<ArtifactInspectionReport> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const entriesChecked: Record<string, boolean> = {};

  // Check existence and readability
  let exists = false;
  let readable = false;
  let sizeBytes: number | undefined;

  try {
    const stat = await fs.stat(jarPath);
    exists = true;
    readable = stat.isFile();
    sizeBytes = stat.size;
  } catch {
    errors.push('JAR file does not exist');
  }

  if (!exists || !readable) {
    return {
      component: componentName,
      artifactType: 'jar',
      artifactPath: jarPath,
      exists,
      readable,
      entriesChecked,
      warnings,
      errors,
      status: 'failed',
    };
  }

  // Open as ZIP using adm-zip
  try {
    const zip = new AdmZip(jarPath);
    const zipEntries = zip.getEntries();

    // Get list of all entry paths
    const entryPaths = zipEntries.map(e => e.entryName);

    // Check META-INF/MANIFEST.MF
    const manifestEntry = zipEntries.find(e => e.entryName === 'META-INF/MANIFEST.MF');
    entriesChecked['META-INF/'] = entryPaths.some(p => p.startsWith('META-INF/'));
    if (manifestEntry) {
      entriesChecked['META-INF/MANIFEST.MF'] = true;
      try {
        const manifestContent = manifestEntry.getData().toString('utf-8');
        // Extract key manifest attributes
        const mainClass = extractManifestAttribute(manifestContent, 'Main-Class');
        if (mainClass) {
          entriesChecked['manifest:Main-Class'] = true;
        }
      } catch {
        warnings.push('Could not read META-INF/MANIFEST.MF content');
      }
    } else {
      entriesChecked['META-INF/MANIFEST.MF'] = false;
      warnings.push('META-INF/MANIFEST.MF not found in JAR');
    }

    // Check required entries from component config
    if (requiredEntries && requiredEntries.length > 0) {
      for (const reqEntry of requiredEntries) {
        const found = entryPaths.some(p => p === reqEntry || p.startsWith(reqEntry));
        entriesChecked[reqEntry] = found;
        if (!found) {
          errors.push(`Required entry not found: ${reqEntry}`);
        }
      }
    }

    // Check for .class files
    const hasClassFiles = entryPaths.some(p => p.endsWith('.class'));
    entriesChecked['hasClassFiles'] = hasClassFiles;
    if (!hasClassFiles) {
      warnings.push('No .class files found in JAR');
    }

    // Check for library JARs in META-INF/lib/ or BOOT-INF/lib/
    const hasLibJars = entryPaths.some(
      p => (p.startsWith('META-INF/lib/') || p.startsWith('BOOT-INF/lib/')) && p.endsWith('.jar')
    );
    entriesChecked['hasDependencyJars'] = hasLibJars;

    logger.debug(`JAR inspection for ${componentName}: ${zipEntries.length} entries, ${sizeBytes} bytes`);

  } catch (error) {
    errors.push(`Failed to open JAR with adm-zip: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    component: componentName,
    artifactType: 'jar',
    artifactPath: jarPath,
    exists,
    readable,
    sizeBytes,
    entriesChecked,
    warnings,
    errors,
    status: errors.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
  };
}

/**
 * Inspect a WAR artifact using adm-zip
 */
async function inspectWar(
  componentName: string,
  warPath: string,
  requiredEntries?: string[]
): Promise<ArtifactInspectionReport> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const entriesChecked: Record<string, boolean> = {};

  let exists = false;
  let readable = false;
  let sizeBytes: number | undefined;

  try {
    const stat = await fs.stat(warPath);
    exists = true;
    readable = stat.isFile();
    sizeBytes = stat.size;
  } catch {
    errors.push('WAR file does not exist');
  }

  if (!exists || !readable) {
    return {
      component: componentName,
      artifactType: 'war',
      artifactPath: warPath,
      exists,
      readable,
      entriesChecked,
      warnings,
      errors,
      status: 'failed',
    };
  }

  try {
    const zip = new AdmZip(warPath);
    const zipEntries = zip.getEntries();
    const entryPaths = zipEntries.map(e => e.entryName);

    // Check WEB-INF/web.xml
    const webXmlEntry = zipEntries.find(e => e.entryName === 'WEB-INF/web.xml');
    entriesChecked['WEB-INF/web.xml'] = !!webXmlEntry;
    if (webXmlEntry) {
      try {
        const webXmlContent = webXmlEntry.getData().toString('utf-8');
        // Validate it's parseable XML
        if (webXmlContent.includes('<web-app') || webXmlContent.includes('web-app xmlns')) {
          entriesChecked['webXmlValid'] = true;
        } else {
          warnings.push('WEB-INF/web.xml does not appear to be a valid web application descriptor');
          entriesChecked['webXmlValid'] = false;
        }
      } catch {
        warnings.push('Could not read WEB-INF/web.xml content');
      }
    } else {
      // Modern WARs may not have web.xml if using annotations
      warnings.push('WEB-INF/web.xml not found (may be using annotation-based configuration)');
    }

    // Check WEB-INF/classes/
    entriesChecked['WEB-INF/classes/'] = entryPaths.some(
      p => p.startsWith('WEB-INF/classes/') && p.endsWith('.class')
    );

    // Check WEB-INF/lib/
    const libEntries = entryPaths.filter(p => p.startsWith('WEB-INF/lib/') && p.endsWith('.jar'));
    entriesChecked['WEB-INF/lib/'] = libEntries.length > 0;
    if (libEntries.length === 0) {
      warnings.push('No library JARs found in WEB-INF/lib/');
    }

    // Check META-INF/
    entriesChecked['META-INF/'] = entryPaths.some(p => p.startsWith('META-INF/'));

    // Check required entries from component config
    if (requiredEntries && requiredEntries.length > 0) {
      for (const reqEntry of requiredEntries) {
        const found = entryPaths.some(p => p === reqEntry || p.startsWith(reqEntry));
        entriesChecked[reqEntry] = found;
        if (!found) {
          errors.push(`Required entry not found: ${reqEntry}`);
        }
      }
    }

    logger.debug(`WAR inspection for ${componentName}: ${zipEntries.length} entries, ${sizeBytes} bytes`);

  } catch (error) {
    errors.push(`Failed to open WAR with adm-zip: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    component: componentName,
    artifactType: 'war',
    artifactPath: warPath,
    exists,
    readable,
    sizeBytes,
    entriesChecked,
    warnings,
    errors,
    status: errors.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
  };
}

/**
 * Inspect a static bundle (directory-based artifact)
 */
async function inspectStaticBundle(
  componentName: string,
  bundlePath: string,
  requiredEntries?: string[]
): Promise<ArtifactInspectionReport> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const entriesChecked: Record<string, boolean> = {};

  let exists = false;
  let readable = false;
  let sizeBytes: number | undefined;

  try {
    const stat = await fs.stat(bundlePath);
    exists = true;
    readable = stat.isDirectory();
  } catch {
    errors.push('Static bundle directory does not exist');
  }

  if (!exists) {
    return {
      component: componentName,
      artifactType: 'static-bundle',
      artifactPath: bundlePath,
      exists,
      readable,
      entriesChecked,
      warnings,
      errors,
      status: 'failed',
    };
  }

  if (!readable) {
    errors.push('Artifact path is not a directory');
    return {
      component: componentName,
      artifactType: 'static-bundle',
      artifactPath: bundlePath,
      exists,
      readable,
      entriesChecked,
      warnings,
      errors,
      status: 'failed',
    };
  }

  // Check required files from config, or default to index.html
  const filesToCheck = requiredEntries?.length ? requiredEntries : ['index.html'];

  for (const file of filesToCheck) {
    const filePath = path.join(bundlePath, file);
    try {
      const fileStat = await fs.stat(filePath);
      entriesChecked[file] = fileStat.isFile();
      if (!fileStat.isFile()) {
        errors.push(`Expected file but found directory: ${file}`);
      }
    } catch {
      entriesChecked[file] = false;
      errors.push(`Required file not found: ${file}`);
    }
  }

  // Check for common static bundle assets
  try {
    const entries = await fs.readdir(bundlePath, { withFileTypes: true });
    const jsFiles = entries.filter(e => e.isFile() && e.name.endsWith('.js'));
    const cssFiles = entries.filter(e => e.isFile() && e.name.endsWith('.css'));
    const htmlFiles = entries.filter(e => e.isFile() && e.name.endsWith('.html'));

    entriesChecked['hasJavaScript'] = jsFiles.length > 0;
    entriesChecked['hasCSS'] = cssFiles.length > 0;
    entriesChecked['hasHTML'] = htmlFiles.length > 0;

    if (jsFiles.length === 0) {
      warnings.push('No JavaScript files found in bundle');
    }
    if (cssFiles.length === 0) {
      warnings.push('No CSS files found in bundle');
    }

    // Check for source maps (warning if present in production)
    const hasSourceMaps = entries.some(
      e => e.isFile() && e.name.endsWith('.map')
    );
    entriesChecked['hasSourceMaps'] = hasSourceMaps;
    if (hasSourceMaps) {
      warnings.push('Source map files found in bundle (may not be desired for production)');
    }
  } catch {
    errors.push('Could not read bundle directory contents');
  }

  // Calculate total size
  try {
    const dirSize = await getDirectorySize(bundlePath);
    sizeBytes = dirSize;
  } catch {
    // Ignore size calculation errors
  }

  return {
    component: componentName,
    artifactType: 'static-bundle',
    artifactPath: bundlePath,
    exists,
    readable,
    sizeBytes,
    entriesChecked,
    warnings,
    errors,
    status: errors.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
  };
}

/**
 * Inspect a browser extension (directory with manifest.json)
 */
async function inspectBrowserExtension(
  componentName: string,
  extPath: string,
  requiredEntries?: string[]
): Promise<ArtifactInspectionReport> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const entriesChecked: Record<string, boolean> = {};

  let exists = false;
  let readable = false;
  let sizeBytes: number | undefined;

  try {
    const stat = await fs.stat(extPath);
    exists = true;
    readable = stat.isDirectory();
  } catch {
    errors.push('Browser extension directory does not exist');
  }

  if (!exists) {
    return {
      component: componentName,
      artifactType: 'browser-extension',
      artifactPath: extPath,
      exists,
      readable,
      entriesChecked,
      warnings,
      errors,
      status: 'failed',
    };
  }

  // Check manifest.json (required for browser extensions)
  const manifestPath = path.join(extPath, 'manifest.json');
  try {
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    entriesChecked['manifest.json'] = true;

    // Parse and validate manifest
    let manifest: any;
    try {
      manifest = JSON.parse(manifestContent);
      entriesChecked['manifestValidJSON'] = true;
    } catch {
      errors.push('manifest.json is not valid JSON');
      entriesChecked['manifestValidJSON'] = false;
      return {
        component: componentName,
        artifactType: 'browser-extension',
        artifactPath: extPath,
        exists,
        readable,
        entriesChecked,
        warnings,
        errors,
        status: 'failed',
      };
    }

    // Validate manifest version (v2 or v3)
    const manifestVersion = manifest.manifest_version;
    entriesChecked['manifestVersion'] = !!manifestVersion;
    if (manifestVersion === 3) {
      entriesChecked['manifestV3'] = true;
    } else if (manifestVersion === 2) {
      entriesChecked['manifestV2'] = true;
      warnings.push('manifest_version is 2 (v3 is recommended for modern extensions)');
    } else {
      warnings.push(`Unexpected or missing manifest_version: ${manifestVersion}`);
    }

    // Check for required manifest fields
    if (manifest.name) entriesChecked['hasName'] = true;
    else errors.push('manifest.json missing "name" field');

    if (manifest.version) entriesChecked['hasVersion'] = true;
    else errors.push('manifest.json missing "version" field');

    // Check for background script/page
    if (manifest.background) {
      entriesChecked['hasBackground'] = true;
      if (manifest.background.service_worker) {
        entriesChecked['hasServiceWorker'] = true;
      } else if (manifest.background.scripts) {
        entriesChecked['hasBackgroundScripts'] = true;
        warnings.push('Background uses scripts array (v2 style), consider migrating to service_worker');
      }
    }

    // Check for content scripts
    if (manifest.content_scripts && manifest.content_scripts.length > 0) {
      entriesChecked['hasContentScripts'] = true;
    }

    // Check for popup
    if (manifest.action?.default_popup || manifest.browser_action?.default_popup) {
      entriesChecked['hasPopup'] = true;
      const popupPath = manifest.action?.default_popup || manifest.browser_action?.default_popup;
      const fullPopupPath = path.join(extPath, popupPath);
      try {
        await fs.access(fullPopupPath);
        entriesChecked['popupFileExists'] = true;
      } catch {
        errors.push(`Popup file not found: ${popupPath}`);
        entriesChecked['popupFileExists'] = false;
      }
    }

  } catch {
    entriesChecked['manifest.json'] = false;
    errors.push('manifest.json not found - required for browser extension');
  }

  // Check required entries from component config
  if (requiredEntries && requiredEntries.length > 0) {
    for (const reqEntry of requiredEntries) {
      const filePath = path.join(extPath, reqEntry);
      try {
        await fs.access(filePath);
        entriesChecked[reqEntry] = true;
      } catch {
        entriesChecked[reqEntry] = false;
        errors.push(`Required entry not found: ${reqEntry}`);
      }
    }
  }

  // Check for common extension files
  const commonFiles = ['background.js', 'content.js', 'popup.html', 'popup.js'];
  for (const file of commonFiles) {
    const filePath = path.join(extPath, file);
    try {
      await fs.access(filePath);
      entriesChecked[file] = true;
    } catch {
      entriesChecked[file] = false;
    }
  }

  return {
    component: componentName,
    artifactType: 'browser-extension',
    artifactPath: extPath,
    exists,
    readable,
    entriesChecked,
    warnings,
    errors,
    status: errors.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a simple attribute value from a MANIFEST.MF content string.
 * MANIFEST.MF attributes are formatted as `Key: Value`.
 */
function extractManifestAttribute(manifest: string, attributeName: string): string | null {
  const lines = manifest.split('\n');
  for (const line of lines) {
    const trimmed = line.trimEnd();
    const match = trimmed.match(new RegExp(`^${attributeName}:\\s*(.+)`));
    if (match) {
      return match[1].trim();
    }
    // Continuation lines start with a single space
    if (line.startsWith(' ')) {
      // We only care about the first match, so if we already have a value
      // from a previous line, append the continuation. For simplicity, skip.
    }
  }
  return null;
}

/**
 * Recursively calculate the total size of a directory in bytes.
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isFile()) {
      const stat = await fs.stat(fullPath);
      totalSize += stat.size;
    } else if (entry.isDirectory()) {
      totalSize += await getDirectorySize(fullPath);
    }
  }
  return totalSize;
}
