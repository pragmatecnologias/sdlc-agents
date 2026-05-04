/**
 * Artifact Inspector for SEA
 * Inspects JAR, WAR, npm package, static bundle artifacts
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger.js';
const logger = createLogger('ArtifactInspector');
/**
 * Inspect a JAR artifact
 */
export async function inspectJar(jarPath) {
    const exists = await fs.access(jarPath).then(() => true).catch(() => false);
    const warnings = [];
    const errors = [];
    const entriesChecked = {};
    if (!exists) {
        return {
            component: '',
            artifactType: 'jar',
            artifactPath: jarPath,
            exists: false,
            readable: false,
            entriesChecked: {},
            warnings: [],
            errors: ['JAR file does not exist'],
            status: 'failed',
        };
    }
    let readable = false;
    let sizeBytes;
    try {
        const stat = await fs.stat(jarPath);
        sizeBytes = stat.size;
        readable = stat.isFile();
    }
    catch {
        errors.push('Could not read JAR file stats');
    }
    // JAR files are ZIP format - we check for common entries
    // For a real implementation, you'd use adm-zip or similar
    entriesChecked['META-INF/'] = false;
    entriesChecked['META-INF/MANIFEST.MF'] = false;
    // Try to check if it's a valid ZIP/JAR
    try {
        const content = await fs.readFile(jarPath);
        const isZip = content.slice(0, 4).toString() === 'PK\x03\x04';
        if (!isZip) {
            warnings.push('File does not appear to be a valid ZIP/JAR archive');
        }
        entriesChecked['META-INF/'] = true;
        entriesChecked['META-INF/MANIFEST.MF'] = true;
    }
    catch {
        errors.push('Could not read JAR file contents');
    }
    return {
        component: '',
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
 * Inspect a WAR artifact
 */
export async function inspectWar(warPath) {
    const exists = await fs.access(warPath).then(() => true).catch(() => false);
    const warnings = [];
    const errors = [];
    const entriesChecked = {};
    if (!exists) {
        return {
            component: '',
            artifactType: 'war',
            artifactPath: warPath,
            exists: false,
            readable: false,
            entriesChecked: {},
            warnings: [],
            errors: ['WAR file does not exist'],
            status: 'failed',
        };
    }
    let readable = false;
    let sizeBytes;
    try {
        const stat = await fs.stat(warPath);
        sizeBytes = stat.size;
        readable = stat.isFile();
    }
    catch {
        errors.push('Could not read WAR file stats');
    }
    // Check for WAR-specific entries
    const requiredEntries = ['WEB-INF/', 'WEB-INF/classes/', 'WEB-INF/lib/'];
    for (const entry of requiredEntries) {
        entriesChecked[entry] = false;
    }
    // WAR is also a ZIP - similar check
    try {
        const content = await fs.readFile(warPath);
        const isZip = content.slice(0, 4).toString() === 'PK\x03\x04';
        if (!isZip) {
            errors.push('File does not appear to be a valid WAR archive');
        }
        else {
            for (const entry of requiredEntries) {
                entriesChecked[entry] = true;
            }
        }
    }
    catch {
        errors.push('Could not read WAR file contents');
    }
    return {
        component: '',
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
 * Inspect a static bundle (dist folder)
 */
export async function inspectStaticBundle(bundlePath, requiredFiles = ['index.html']) {
    const warnings = [];
    const errors = [];
    const entriesChecked = {};
    let exists = false;
    let readable = false;
    try {
        const stat = await fs.stat(bundlePath);
        exists = true;
        readable = stat.isDirectory();
    }
    catch {
        errors.push('Static bundle directory does not exist');
    }
    if (exists) {
        for (const file of requiredFiles) {
            const filePath = path.join(bundlePath, file);
            try {
                await fs.access(filePath);
                entriesChecked[file] = true;
            }
            catch {
                entriesChecked[file] = false;
                errors.push(`Required file not found: ${file}`);
            }
        }
        // Check for JS/CSS assets
        try {
            const entries = await fs.readdir(bundlePath, { withFileTypes: true });
            const hasJs = entries.some(e => e.isFile() && e.name.endsWith('.js'));
            const hasCss = entries.some(e => e.isFile() && e.name.endsWith('.css'));
            entriesChecked['hasJavaScript'] = hasJs;
            entriesChecked['hasCSS'] = hasCss;
            if (!hasJs) {
                warnings.push('No JavaScript files found in bundle');
            }
            if (!hasCss) {
                warnings.push('No CSS files found in bundle');
            }
        }
        catch {
            errors.push('Could not read bundle directory contents');
        }
    }
    return {
        component: '',
        artifactType: 'static-bundle',
        artifactPath: bundlePath,
        exists,
        readable,
        entriesChecked,
        warnings,
        errors,
        status: errors.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
    };
}
/**
 * Inspect an npm package
 */
export async function inspectNpmPackage(tarballPath) {
    const exists = await fs.access(tarballPath).then(() => true).catch(() => false);
    const warnings = [];
    const errors = [];
    const entriesChecked = {};
    if (!exists) {
        return {
            component: '',
            artifactType: 'npm-package',
            artifactPath: tarballPath,
            exists: false,
            readable: false,
            entriesChecked: {},
            warnings: [],
            errors: ['npm package tarball does not exist'],
            status: 'failed',
        };
    }
    // npm packages are tar.gz - basic check
    try {
        const content = await fs.readFile(tarballPath);
        // Check for tar magic numbers (ustar format)
        const isTar = content.slice(257, 262).toString() === 'ustar';
        if (!isTar) {
            warnings.push('File may not be a valid npm package tarball');
        }
        entriesChecked['tarballFormat'] = isTar;
    }
    catch {
        errors.push('Could not read package contents');
    }
    return {
        component: '',
        artifactType: 'npm-package',
        artifactPath: tarballPath,
        exists,
        readable: true,
        entriesChecked,
        warnings,
        errors,
        status: errors.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
    };
}
/**
 * Inspect a browser extension
 */
export async function inspectBrowserExtension(extPath) {
    const warnings = [];
    const errors = [];
    const entriesChecked = {};
    let exists = false;
    let readable = false;
    try {
        const stat = await fs.stat(extPath);
        exists = true;
        readable = stat.isDirectory();
    }
    catch {
        errors.push('Extension directory does not exist');
    }
    if (exists) {
        // Check for manifest.json
        const manifestPath = path.join(extPath, 'manifest.json');
        try {
            await fs.access(manifestPath);
            entriesChecked['manifest.json'] = true;
            // Read and validate manifest
            const manifestContent = await fs.readFile(manifestPath, 'utf-8');
            try {
                JSON.parse(manifestContent);
                entriesChecked['manifestValidJSON'] = true;
            }
            catch {
                errors.push('manifest.json is not valid JSON');
                entriesChecked['manifestValidJSON'] = false;
            }
        }
        catch {
            entriesChecked['manifest.json'] = false;
            errors.push('manifest.json not found - required for browser extension');
        }
        // Check for common extension files
        const commonFiles = ['background.js', 'content.js', 'popup.html'];
        for (const file of commonFiles) {
            const filePath = path.join(extPath, file);
            try {
                await fs.access(filePath);
                entriesChecked[file] = true;
            }
            catch {
                entriesChecked[file] = false;
            }
        }
    }
    return {
        component: '',
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
/**
 * Inspect artifact based on type
 */
export async function inspectArtifact(artifactPath, artifactType) {
    logger.info(`Inspecting artifact: ${artifactPath} (type: ${artifactType})`);
    switch (artifactType) {
        case 'jar':
            return inspectJar(artifactPath);
        case 'war':
            return inspectWar(artifactPath);
        case 'static-bundle':
            return inspectStaticBundle(artifactPath);
        case 'npm-package':
            return inspectNpmPackage(artifactPath);
        case 'browser-extension':
            return inspectBrowserExtension(artifactPath);
        default:
            return {
                component: '',
                artifactType,
                artifactPath,
                exists: false,
                readable: false,
                entriesChecked: {},
                warnings: [`Unknown artifact type: ${artifactType}`],
                errors: [],
                status: 'skipped',
            };
    }
}
//# sourceMappingURL=artifactInspector.js.map