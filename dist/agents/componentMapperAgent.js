/**
 * Component Mapper Agent for SEA
 * Maps requirement to workspace components
 */
import { createLogger } from '../utils/logger.js';
const logger = createLogger('ComponentMapperAgent');
/**
 * Create the component mapper agent function
 */
export function createComponentMapperAgent() {
    return async (state) => {
        logger.info('Running component mapper agent');
        const { workspace, requirement } = state;
        const report = {
            components: [],
            dependencyGraph: {},
            artifactFlow: [],
        };
        // Map requirement to components based on workspace config
        if (workspace.components && requirement) {
            for (const component of workspace.components) {
                // Simple heuristic: match component name or path to requirement keywords
                const nameMatch = requirement.title.toLowerCase().includes(component.name.toLowerCase());
                const pathMatch = requirement.title.toLowerCase().includes(component.path.toLowerCase());
                if (nameMatch || pathMatch) {
                    report.components.push({
                        component: component.name,
                        produces: component.produces || [],
                        consumes: component.dependencies || [],
                        contracts: (component.contracts || []).map(c => ({
                            type: c.type,
                            path: c.path || '',
                            consumers: [],
                        })),
                    });
                }
            }
        }
        // If no components mapped, mark all as potential targets with default mapping
        if (report.components.length === 0 && workspace.components) {
            for (const component of workspace.components) {
                report.components.push({
                    component: component.name,
                    produces: component.produces || [],
                    consumes: component.dependencies || [],
                    contracts: (component.contracts || []).map(c => ({
                        type: c.type,
                        path: c.path || '',
                        consumers: [],
                    })),
                });
            }
        }
        // Build simple dependency graph
        for (const comp of report.components) {
            report.dependencyGraph[comp.component] = comp.consumes || [];
        }
        logger.info(`Mapped ${report.components.length} components`);
        return { componentMap: report };
    };
}
//# sourceMappingURL=componentMapperAgent.js.map