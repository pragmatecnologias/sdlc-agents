/**
 * Memory Retrieval Agent for SEA
 * Retrieves relevant past engineering decisions from memory
 */
import * as fs from 'fs/promises';
import { createLogger } from '../utils/logger.js';
const logger = createLogger('MemoryRetrievalAgent');
/**
 * Create the memory retrieval agent function
 */
export function createMemoryRetrievalAgent(memoryPath = '.sea/engineering_memory.md') {
    return async (state) => {
        logger.info('Running memory retrieval agent');
        const { userRequest, workspace } = state;
        // Check if memory is enabled
        if (workspace.memory?.enabled === false) {
            return { memoryContext: null };
        }
        // Read memory file
        const effectiveMemoryPath = workspace.memory?.path || memoryPath;
        let memoryContent = null;
        try {
            memoryContent = await fs.readFile(effectiveMemoryPath, 'utf-8');
        }
        catch {
            logger.info('No memory file found, starting fresh');
            return { memoryContext: null };
        }
        // Find relevant entries
        const relevantEntries = await findRelevantEntries(memoryContent, userRequest);
        if (relevantEntries.length === 0) {
            return { memoryContext: null };
        }
        // Build context string
        const memoryContext = formatMemoryContext(relevantEntries, userRequest);
        return { memoryContext };
    };
}
/**
 * Find entries relevant to the current request
 */
async function findRelevantEntries(memoryContent, request) {
    const entries = parseMemoryLog(memoryContent);
    const requestLower = request.toLowerCase();
    const requestWords = requestLower.split(/\s+/).filter(w => w.length > 3);
    const scoredEntries = [];
    for (const entry of entries) {
        let score = 0;
        // Direct keyword matches
        const entryLower = entry.request.toLowerCase();
        for (const word of requestWords) {
            if (entryLower.includes(word)) {
                score += 1;
            }
            if (entry.lessons.some(l => l.toLowerCase().includes(word))) {
                score += 2;
            }
            if (entry.rules.some(r => r.toLowerCase().includes(word))) {
                score += 3;
            }
        }
        // Check related entries
        if (entry.relatedEntries.length > 0) {
            score += entry.relatedEntries.length * 0.5;
        }
        if (score > 0) {
            scoredEntries.push({ entry, score });
        }
    }
    // Sort by score and return top entries
    scoredEntries.sort((a, b) => b.score - a.score);
    return scoredEntries.slice(0, 5).map(s => s.entry);
}
/**
 * Parse memory log into entries
 */
function parseMemoryLog(content) {
    const entries = [];
    // Split by entry separator
    const entryBlocks = content.split(/(?=^## \d{4}-\d{2}-\d{2})/m);
    for (const block of entryBlocks) {
        if (!block.trim())
            continue;
        const entry = parseMemoryEntry(block);
        if (entry) {
            entries.push(entry);
        }
    }
    return entries;
}
function parseMemoryEntry(block) {
    // Extract date from "## YYYY-MM-DD — Title"
    const dateMatch = block.match(/^## (\d{4}-\d{2}-\d{2})/);
    if (!dateMatch)
        return null;
    const date = dateMatch[1];
    const lines = block.split('\n');
    const entry = {
        id: date,
        date,
        request: '',
        decision: '',
        whatWorked: [],
        whatFailed: [],
        lessons: [],
        rules: [],
        relatedEntries: [],
    };
    let currentSection = '';
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('### Request')) {
            currentSection = 'request';
        }
        else if (trimmed.startsWith('### Decision')) {
            currentSection = 'decision';
        }
        else if (trimmed.startsWith('### What Worked')) {
            currentSection = 'whatWorked';
        }
        else if (trimmed.startsWith('### What Failed')) {
            currentSection = 'whatFailed';
        }
        else if (trimmed.startsWith('### Lessons')) {
            currentSection = 'lessons';
        }
        else if (trimmed.startsWith('### Future Rules')) {
            currentSection = 'rules';
        }
        else if (trimmed.startsWith('- ')) {
            const item = trimmed.slice(2);
            switch (currentSection) {
                case 'request':
                case 'decision':
                    // Single line fields
                    if (currentSection === 'request')
                        entry.request = item;
                    else
                        entry.decision = item;
                    break;
                case 'whatWorked':
                    entry.whatWorked.push(item);
                    break;
                case 'whatFailed':
                    entry.whatFailed.push(item);
                    break;
                case 'lessons':
                    entry.lessons.push(item);
                    break;
                case 'rules':
                    entry.rules.push(item);
                    break;
            }
        }
    }
    return entry.request ? entry : null;
}
function formatMemoryContext(entries, request) {
    const lines = [
        '# Relevant Past Engineering Decisions',
        '',
        `Current request: ${request}`,
        '',
    ];
    for (const entry of entries) {
        lines.push(`## ${entry.date}`);
        lines.push(`**Request:** ${entry.request}`);
        lines.push(`**Decision:** ${entry.decision}`);
        lines.push('');
        if (entry.lessons.length > 0) {
            lines.push('**Key Lessons:**');
            for (const lesson of entry.lessons) {
                lines.push(`- ${lesson}`);
            }
            lines.push('');
        }
        if (entry.rules.length > 0) {
            lines.push('**Rules to Apply:**');
            for (const rule of entry.rules) {
                lines.push(`- ${rule}`);
            }
            lines.push('');
        }
    }
    return lines.join('\n');
}
/**
 * Create a new memory entry
 */
export async function createMemoryEntry(entry, memoryPath = '.sea/engineering_memory.md') {
    const lines = [
        '',
        `## ${entry.date} — ${entry.request}`,
        '',
        `### Decision`,
        `- ${entry.decision}`,
        '',
    ];
    if (entry.whatWorked.length > 0) {
        lines.push('### What Worked');
        for (const item of entry.whatWorked) {
            lines.push(`- ${item}`);
        }
        lines.push('');
    }
    if (entry.whatFailed.length > 0) {
        lines.push('### What Failed');
        for (const item of entry.whatFailed) {
            lines.push(`- ${item}`);
        }
        lines.push('');
    }
    if (entry.lessons.length > 0) {
        lines.push('### Lessons');
        for (const lesson of entry.lessons) {
            lines.push(`- ${lesson}`);
        }
        lines.push('');
    }
    if (entry.rules.length > 0) {
        lines.push('### Future Rules');
        for (const rule of entry.rules) {
            lines.push(`- ${rule}`);
        }
        lines.push('');
    }
    // Append to memory file
    await fs.appendFile(memoryPath, lines.join('\n'), 'utf-8');
}
//# sourceMappingURL=memoryRetrievalAgent.js.map