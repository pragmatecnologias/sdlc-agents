/**
 * Checkpoint system for SEA workflow
 * Saves and loads workspace state at each phase
 */
import * as fs from 'fs/promises';
import * as path from 'path';
/**
 * Get paths for a run
 */
export function getRunPaths(runId, baseDir = '.sea') {
    return {
        baseDir,
        runsDir: path.join(baseDir, 'runs'),
        runDir: path.join(baseDir, 'runs', runId),
        checkpointsDir: path.join(baseDir, 'runs', runId, 'checkpoints'),
        artifactsDir: path.join(baseDir, 'runs', runId, 'artifacts'),
        componentsDir: path.join(baseDir, 'runs', runId, 'components'),
    };
}
/**
 * Create checkpoint name from phase name
 */
export function checkpointName(phase) {
    return `${phase}.json`;
}
/**
 * Save a checkpoint
 */
export async function saveCheckpoint(state, phase, baseDir = '.sea') {
    const paths = getRunPaths(state.runId, baseDir);
    const checkpointPath = path.join(paths.checkpointsDir, checkpointName(phase));
    // Ensure directories exist
    await fs.mkdir(paths.checkpointsDir, { recursive: true });
    await fs.mkdir(paths.artifactsDir, { recursive: true });
    await fs.mkdir(paths.componentsDir, { recursive: true });
    // Update state timestamp
    const stateToSave = {
        ...state,
        updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(checkpointPath, JSON.stringify(stateToSave, null, 2), 'utf-8');
}
/**
 * Load a checkpoint
 */
export async function loadCheckpoint(runId, phase, baseDir = '.sea') {
    const paths = getRunPaths(runId, baseDir);
    const checkpointPath = path.join(paths.checkpointsDir, checkpointName(phase));
    const content = await fs.readFile(checkpointPath, 'utf-8');
    return JSON.parse(content);
}
/**
 * List all checkpoints for a run
 */
export async function listCheckpoints(runId, baseDir = '.sea') {
    const paths = getRunPaths(runId, baseDir);
    try {
        const files = await fs.readdir(paths.checkpointsDir);
        const checkpoints = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(paths.checkpointsDir, file);
                const stat = await fs.stat(filePath);
                checkpoints.push({
                    name: file.replace('.json', ''),
                    path: filePath,
                    timestamp: stat.mtime.toISOString(),
                });
            }
        }
        return checkpoints.sort((a, b) => a.name.localeCompare(b.name));
    }
    catch {
        return [];
    }
}
/**
 * Get the latest checkpoint
 */
export async function getLatestCheckpoint(runId, baseDir = '.sea') {
    const checkpoints = await listCheckpoints(runId, baseDir);
    return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
}
/**
 * Save full state (not a checkpoint, but current state)
 */
export async function saveState(state, baseDir = '.sea') {
    const paths = getRunPaths(state.runId, baseDir);
    const statePath = path.join(paths.runDir, 'state.json');
    await fs.mkdir(paths.runDir, { recursive: true });
    const stateToSave = {
        ...state,
        updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(statePath, JSON.stringify(stateToSave, null, 2), 'utf-8');
}
/**
 * Load full state
 */
export async function loadState(runId, baseDir = '.sea') {
    const paths = getRunPaths(runId, baseDir);
    const statePath = path.join(paths.runDir, 'state.json');
    const content = await fs.readFile(statePath, 'utf-8');
    return JSON.parse(content);
}
/**
 * Save an artifact file
 */
export async function saveArtifact(state, name, content, baseDir = '.sea') {
    const paths = getRunPaths(state.runId, baseDir);
    const artifactPath = path.join(paths.artifactsDir, name);
    await fs.mkdir(paths.artifactsDir, { recursive: true });
    await fs.writeFile(artifactPath, content, 'utf-8');
}
/**
 * Save a component-specific artifact
 */
export async function saveComponentArtifact(state, componentName, name, content, baseDir = '.sea') {
    const paths = getRunPaths(state.runId, baseDir);
    const componentDir = path.join(paths.componentsDir, componentName);
    const artifactPath = path.join(componentDir, name);
    await fs.mkdir(componentDir, { recursive: true });
    await fs.writeFile(artifactPath, content, 'utf-8');
}
/**
 * Save component state
 */
export async function saveComponentState(state, componentName, baseDir = '.sea') {
    const componentState = state.componentStates[componentName];
    if (componentState) {
        await saveComponentArtifact(state, componentName, 'component-state.json', JSON.stringify(componentState, null, 2));
    }
}
//# sourceMappingURL=checkpoint.js.map