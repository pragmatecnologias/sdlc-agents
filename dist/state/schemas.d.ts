/**
 * Zod schemas for all SEA types
 * Used for validation and type inference
 */
import { z } from 'zod';
export declare const ChangeRoleSchema: z.ZodEnum<["modify", "verify_only", "package_only", "artifact_verify", "no_change", "blocked", "unknown"]>;
export type ChangeRole = z.infer<typeof ChangeRoleSchema>;
export declare const ComponentKindSchema: z.ZodEnum<["ui", "frontend", "backend", "service", "assembly", "package", "library", "infra", "test", "docs", "game", "cli", "contract", "generated", "unknown"]>;
export type ComponentKind = z.infer<typeof ComponentKindSchema>;
export declare const ComponentRoleSchema: z.ZodEnum<["source", "application", "service", "packager", "assembler", "contract", "test-suite", "infrastructure", "documentation", "generated", "verification-only"]>;
export type ComponentRole = z.infer<typeof ComponentRoleSchema>;
export declare const ProjectProfileNameSchema: z.ZodEnum<["SINGLE_REPO_FRONTEND", "SINGLE_REPO_BACKEND", "MONOREPO_WEB_APP", "MULTI_REPO_ENTERPRISE_APP", "WAR_COMPOSITE_APP", "SPRING_BOOT_SERVICE", "NODE_API", "REACT_APP", "ANGULAR_APP", "VUE_APP", "CHROME_EXTENSION", "THREEJS_GAME", "PYTHON_CLI", "LIBRARY_PACKAGE", "MICROSERVICES_WORKSPACE", "INFRASTRUCTURE_REPO", "DOCUMENTATION_REPO", "CUSTOM"]>;
export type ProjectProfileName = z.infer<typeof ProjectProfileNameSchema>;
export declare const ArtifactTypeSchema: z.ZodEnum<["none", "static-bundle", "jar", "war", "ear", "docker-image", "npm-package", "python-package", "browser-extension", "game-build", "custom"]>;
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;
export declare const ExecutorTypeSchema: z.ZodEnum<["manual", "copilot-cli", "copilot-coding-agent", "claude-code", "codex-cli", "openclaw", "local-agent", "shell", "mock", "other"]>;
export type ExecutorType = z.infer<typeof ExecutorTypeSchema>;
export declare const ExecutorStatusSchema: z.ZodEnum<["completed", "cancelled", "failed", "manual_required", "blocked"]>;
export type ExecutorStatus = z.infer<typeof ExecutorStatusSchema>;
export declare const ComponentDecisionSchema: z.ZodEnum<["pending", "implemented", "verified", "needs_fix", "blocked", "skipped"]>;
export type ComponentDecision = z.infer<typeof ComponentDecisionSchema>;
export declare const ArchitectureDecisionSchema: z.ZodEnum<["proceed", "proceed_with_constraints", "revise_request", "reject", "blocked"]>;
export type ArchitectureDecision = z.infer<typeof ArchitectureDecisionSchema>;
export declare const FinalVerdictSchema: z.ZodEnum<["APPROVED", "APPROVED_WITH_NOTES", "NEEDS_FIXES", "REJECTED", "BLOCKED"]>;
export type FinalVerdict = z.infer<typeof FinalVerdictSchema>;
export declare const CommandStatusSchema: z.ZodEnum<["passed", "failed", "skipped", "blocked"]>;
export type CommandStatus = z.infer<typeof CommandStatusSchema>;
export declare const SecurityStatusSchema: z.ZodEnum<["approved", "approved_with_notes", "needs_fix", "blocked"]>;
export type SecurityStatus = z.infer<typeof SecurityStatusSchema>;
export declare const PerformanceStatusSchema: z.ZodEnum<["approved", "approved_with_notes", "needs_fix", "blocked"]>;
export type PerformanceStatus = z.infer<typeof PerformanceStatusSchema>;
export declare const ComponentConfigSchema: z.ZodObject<{
    name: z.ZodString;
    path: z.ZodString;
    kind: z.ZodEnum<["ui", "frontend", "backend", "service", "assembly", "package", "library", "infra", "test", "docs", "game", "cli", "contract", "generated", "unknown"]>;
    role: z.ZodEnum<["source", "application", "service", "packager", "assembler", "contract", "test-suite", "infrastructure", "documentation", "generated", "verification-only"]>;
    technology: z.ZodOptional<z.ZodString>;
    framework: z.ZodOptional<z.ZodString>;
    packageManager: z.ZodOptional<z.ZodString>;
    commands: z.ZodOptional<z.ZodObject<{
        install: z.ZodOptional<z.ZodString>;
        lint: z.ZodOptional<z.ZodString>;
        typecheck: z.ZodOptional<z.ZodString>;
        test: z.ZodOptional<z.ZodString>;
        build: z.ZodOptional<z.ZodString>;
        package: z.ZodOptional<z.ZodString>;
        e2e: z.ZodOptional<z.ZodString>;
        smoke: z.ZodOptional<z.ZodString>;
        custom: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        package?: string | undefined;
        test?: string | undefined;
        custom?: Record<string, string> | undefined;
        install?: string | undefined;
        lint?: string | undefined;
        typecheck?: string | undefined;
        build?: string | undefined;
        e2e?: string | undefined;
        smoke?: string | undefined;
    }, {
        package?: string | undefined;
        test?: string | undefined;
        custom?: Record<string, string> | undefined;
        install?: string | undefined;
        lint?: string | undefined;
        typecheck?: string | undefined;
        build?: string | undefined;
        e2e?: string | undefined;
        smoke?: string | undefined;
    }>>;
    artifact: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["none", "static-bundle", "jar", "war", "ear", "docker-image", "npm-package", "python-package", "browser-extension", "game-build", "custom"]>;
        outputPath: z.ZodOptional<z.ZodString>;
        outputGlob: z.ZodOptional<z.ZodString>;
        inspectionProfile: z.ZodOptional<z.ZodString>;
        requiredEntries: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        optionalEntries: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "none" | "static-bundle" | "jar" | "war" | "ear" | "docker-image" | "npm-package" | "python-package" | "browser-extension" | "game-build" | "custom";
        outputPath?: string | undefined;
        outputGlob?: string | undefined;
        inspectionProfile?: string | undefined;
        requiredEntries?: string[] | undefined;
        optionalEntries?: string[] | undefined;
    }, {
        type: "none" | "static-bundle" | "jar" | "war" | "ear" | "docker-image" | "npm-package" | "python-package" | "browser-extension" | "game-build" | "custom";
        outputPath?: string | undefined;
        outputGlob?: string | undefined;
        inspectionProfile?: string | undefined;
        requiredEntries?: string[] | undefined;
        optionalEntries?: string[] | undefined;
    }>>;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    produces: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    consumes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    contracts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        path: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        path?: string | undefined;
    }, {
        type: string;
        path?: string | undefined;
    }>, "many">>;
    protectedPaths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    forbiddenPaths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    generatedPaths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    ignoredPaths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    path: string;
    name: string;
    kind: "unknown" | "ui" | "frontend" | "backend" | "service" | "assembly" | "package" | "library" | "infra" | "test" | "docs" | "game" | "cli" | "contract" | "generated";
    role: "service" | "contract" | "generated" | "source" | "application" | "packager" | "assembler" | "test-suite" | "infrastructure" | "documentation" | "verification-only";
    technology?: string | undefined;
    framework?: string | undefined;
    packageManager?: string | undefined;
    commands?: {
        package?: string | undefined;
        test?: string | undefined;
        custom?: Record<string, string> | undefined;
        install?: string | undefined;
        lint?: string | undefined;
        typecheck?: string | undefined;
        build?: string | undefined;
        e2e?: string | undefined;
        smoke?: string | undefined;
    } | undefined;
    artifact?: {
        type: "none" | "static-bundle" | "jar" | "war" | "ear" | "docker-image" | "npm-package" | "python-package" | "browser-extension" | "game-build" | "custom";
        outputPath?: string | undefined;
        outputGlob?: string | undefined;
        inspectionProfile?: string | undefined;
        requiredEntries?: string[] | undefined;
        optionalEntries?: string[] | undefined;
    } | undefined;
    dependencies?: string[] | undefined;
    produces?: string[] | undefined;
    consumes?: string[] | undefined;
    contracts?: {
        type: string;
        path?: string | undefined;
    }[] | undefined;
    protectedPaths?: string[] | undefined;
    forbiddenPaths?: string[] | undefined;
    generatedPaths?: string[] | undefined;
    ignoredPaths?: string[] | undefined;
    notes?: string | undefined;
}, {
    path: string;
    name: string;
    kind: "unknown" | "ui" | "frontend" | "backend" | "service" | "assembly" | "package" | "library" | "infra" | "test" | "docs" | "game" | "cli" | "contract" | "generated";
    role: "service" | "contract" | "generated" | "source" | "application" | "packager" | "assembler" | "test-suite" | "infrastructure" | "documentation" | "verification-only";
    technology?: string | undefined;
    framework?: string | undefined;
    packageManager?: string | undefined;
    commands?: {
        package?: string | undefined;
        test?: string | undefined;
        custom?: Record<string, string> | undefined;
        install?: string | undefined;
        lint?: string | undefined;
        typecheck?: string | undefined;
        build?: string | undefined;
        e2e?: string | undefined;
        smoke?: string | undefined;
    } | undefined;
    artifact?: {
        type: "none" | "static-bundle" | "jar" | "war" | "ear" | "docker-image" | "npm-package" | "python-package" | "browser-extension" | "game-build" | "custom";
        outputPath?: string | undefined;
        outputGlob?: string | undefined;
        inspectionProfile?: string | undefined;
        requiredEntries?: string[] | undefined;
        optionalEntries?: string[] | undefined;
    } | undefined;
    dependencies?: string[] | undefined;
    produces?: string[] | undefined;
    consumes?: string[] | undefined;
    contracts?: {
        type: string;
        path?: string | undefined;
    }[] | undefined;
    protectedPaths?: string[] | undefined;
    forbiddenPaths?: string[] | undefined;
    generatedPaths?: string[] | undefined;
    ignoredPaths?: string[] | undefined;
    notes?: string | undefined;
}>;
export type ComponentConfig = z.infer<typeof ComponentConfigSchema>;
export declare const ApprovalPolicySchema: z.ZodObject<{
    requireBeforeImplementation: z.ZodBoolean;
    requireForAuthChanges: z.ZodBoolean;
    requireForDatabaseMigrations: z.ZodBoolean;
    requireForPackageChanges: z.ZodBoolean;
    requireForBuildConfigChanges: z.ZodBoolean;
    requireForDeletingFiles: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    requireBeforeImplementation: boolean;
    requireForAuthChanges: boolean;
    requireForDatabaseMigrations: boolean;
    requireForPackageChanges: boolean;
    requireForBuildConfigChanges: boolean;
    requireForDeletingFiles: boolean;
}, {
    requireBeforeImplementation: boolean;
    requireForAuthChanges: boolean;
    requireForDatabaseMigrations: boolean;
    requireForPackageChanges: boolean;
    requireForBuildConfigChanges: boolean;
    requireForDeletingFiles: boolean;
}>;
export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;
export declare const QualityGatesSchema: z.ZodObject<{
    requireSourceRepoCleanBeforeRun: z.ZodBoolean;
    requireFinalArtifactBuild: z.ZodBoolean;
    requireArtifactInspection: z.ZodBoolean;
    blockOnForbiddenPathModification: z.ZodBoolean;
    blockOnProtectedPathModificationWithoutApproval: z.ZodBoolean;
    warnIfNoSmokeTest: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    requireSourceRepoCleanBeforeRun: boolean;
    requireFinalArtifactBuild: boolean;
    requireArtifactInspection: boolean;
    blockOnForbiddenPathModification: boolean;
    blockOnProtectedPathModificationWithoutApproval: boolean;
    warnIfNoSmokeTest: boolean;
}, {
    requireSourceRepoCleanBeforeRun: boolean;
    requireFinalArtifactBuild: boolean;
    requireArtifactInspection: boolean;
    blockOnForbiddenPathModification: boolean;
    blockOnProtectedPathModificationWithoutApproval: boolean;
    warnIfNoSmokeTest: boolean;
}>;
export type QualityGates = z.infer<typeof QualityGatesSchema>;
export declare const WorkspaceConfigSchema: z.ZodObject<{
    workspaceName: z.ZodString;
    projectProfile: z.ZodOptional<z.ZodEnum<["SINGLE_REPO_FRONTEND", "SINGLE_REPO_BACKEND", "MONOREPO_WEB_APP", "MULTI_REPO_ENTERPRISE_APP", "WAR_COMPOSITE_APP", "SPRING_BOOT_SERVICE", "NODE_API", "REACT_APP", "ANGULAR_APP", "VUE_APP", "CHROME_EXTENSION", "THREEJS_GAME", "PYTHON_CLI", "LIBRARY_PACKAGE", "MICROSERVICES_WORKSPACE", "INFRASTRUCTURE_REPO", "DOCUMENTATION_REPO", "CUSTOM"]>>;
    defaultExecutor: z.ZodString;
    approvalPolicy: z.ZodObject<{
        requireBeforeImplementation: z.ZodBoolean;
        requireForAuthChanges: z.ZodBoolean;
        requireForDatabaseMigrations: z.ZodBoolean;
        requireForPackageChanges: z.ZodBoolean;
        requireForBuildConfigChanges: z.ZodBoolean;
        requireForDeletingFiles: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        requireBeforeImplementation: boolean;
        requireForAuthChanges: boolean;
        requireForDatabaseMigrations: boolean;
        requireForPackageChanges: boolean;
        requireForBuildConfigChanges: boolean;
        requireForDeletingFiles: boolean;
    }, {
        requireBeforeImplementation: boolean;
        requireForAuthChanges: boolean;
        requireForDatabaseMigrations: boolean;
        requireForPackageChanges: boolean;
        requireForBuildConfigChanges: boolean;
        requireForDeletingFiles: boolean;
    }>;
    qualityGates: z.ZodObject<{
        requireSourceRepoCleanBeforeRun: z.ZodBoolean;
        requireFinalArtifactBuild: z.ZodBoolean;
        requireArtifactInspection: z.ZodBoolean;
        blockOnForbiddenPathModification: z.ZodBoolean;
        blockOnProtectedPathModificationWithoutApproval: z.ZodBoolean;
        warnIfNoSmokeTest: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        requireSourceRepoCleanBeforeRun: boolean;
        requireFinalArtifactBuild: boolean;
        requireArtifactInspection: boolean;
        blockOnForbiddenPathModification: boolean;
        blockOnProtectedPathModificationWithoutApproval: boolean;
        warnIfNoSmokeTest: boolean;
    }, {
        requireSourceRepoCleanBeforeRun: boolean;
        requireFinalArtifactBuild: boolean;
        requireArtifactInspection: boolean;
        blockOnForbiddenPathModification: boolean;
        blockOnProtectedPathModificationWithoutApproval: boolean;
        warnIfNoSmokeTest: boolean;
    }>;
    components: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        path: z.ZodString;
        kind: z.ZodEnum<["ui", "frontend", "backend", "service", "assembly", "package", "library", "infra", "test", "docs", "game", "cli", "contract", "generated", "unknown"]>;
        role: z.ZodEnum<["source", "application", "service", "packager", "assembler", "contract", "test-suite", "infrastructure", "documentation", "generated", "verification-only"]>;
        technology: z.ZodOptional<z.ZodString>;
        framework: z.ZodOptional<z.ZodString>;
        packageManager: z.ZodOptional<z.ZodString>;
        commands: z.ZodOptional<z.ZodObject<{
            install: z.ZodOptional<z.ZodString>;
            lint: z.ZodOptional<z.ZodString>;
            typecheck: z.ZodOptional<z.ZodString>;
            test: z.ZodOptional<z.ZodString>;
            build: z.ZodOptional<z.ZodString>;
            package: z.ZodOptional<z.ZodString>;
            e2e: z.ZodOptional<z.ZodString>;
            smoke: z.ZodOptional<z.ZodString>;
            custom: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            package?: string | undefined;
            test?: string | undefined;
            custom?: Record<string, string> | undefined;
            install?: string | undefined;
            lint?: string | undefined;
            typecheck?: string | undefined;
            build?: string | undefined;
            e2e?: string | undefined;
            smoke?: string | undefined;
        }, {
            package?: string | undefined;
            test?: string | undefined;
            custom?: Record<string, string> | undefined;
            install?: string | undefined;
            lint?: string | undefined;
            typecheck?: string | undefined;
            build?: string | undefined;
            e2e?: string | undefined;
            smoke?: string | undefined;
        }>>;
        artifact: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["none", "static-bundle", "jar", "war", "ear", "docker-image", "npm-package", "python-package", "browser-extension", "game-build", "custom"]>;
            outputPath: z.ZodOptional<z.ZodString>;
            outputGlob: z.ZodOptional<z.ZodString>;
            inspectionProfile: z.ZodOptional<z.ZodString>;
            requiredEntries: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            optionalEntries: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: "none" | "static-bundle" | "jar" | "war" | "ear" | "docker-image" | "npm-package" | "python-package" | "browser-extension" | "game-build" | "custom";
            outputPath?: string | undefined;
            outputGlob?: string | undefined;
            inspectionProfile?: string | undefined;
            requiredEntries?: string[] | undefined;
            optionalEntries?: string[] | undefined;
        }, {
            type: "none" | "static-bundle" | "jar" | "war" | "ear" | "docker-image" | "npm-package" | "python-package" | "browser-extension" | "game-build" | "custom";
            outputPath?: string | undefined;
            outputGlob?: string | undefined;
            inspectionProfile?: string | undefined;
            requiredEntries?: string[] | undefined;
            optionalEntries?: string[] | undefined;
        }>>;
        dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        produces: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        consumes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        contracts: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            path?: string | undefined;
        }, {
            type: string;
            path?: string | undefined;
        }>, "many">>;
        protectedPaths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        forbiddenPaths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        generatedPaths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        ignoredPaths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        name: string;
        kind: "unknown" | "ui" | "frontend" | "backend" | "service" | "assembly" | "package" | "library" | "infra" | "test" | "docs" | "game" | "cli" | "contract" | "generated";
        role: "service" | "contract" | "generated" | "source" | "application" | "packager" | "assembler" | "test-suite" | "infrastructure" | "documentation" | "verification-only";
        technology?: string | undefined;
        framework?: string | undefined;
        packageManager?: string | undefined;
        commands?: {
            package?: string | undefined;
            test?: string | undefined;
            custom?: Record<string, string> | undefined;
            install?: string | undefined;
            lint?: string | undefined;
            typecheck?: string | undefined;
            build?: string | undefined;
            e2e?: string | undefined;
            smoke?: string | undefined;
        } | undefined;
        artifact?: {
            type: "none" | "static-bundle" | "jar" | "war" | "ear" | "docker-image" | "npm-package" | "python-package" | "browser-extension" | "game-build" | "custom";
            outputPath?: string | undefined;
            outputGlob?: string | undefined;
            inspectionProfile?: string | undefined;
            requiredEntries?: string[] | undefined;
            optionalEntries?: string[] | undefined;
        } | undefined;
        dependencies?: string[] | undefined;
        produces?: string[] | undefined;
        consumes?: string[] | undefined;
        contracts?: {
            type: string;
            path?: string | undefined;
        }[] | undefined;
        protectedPaths?: string[] | undefined;
        forbiddenPaths?: string[] | undefined;
        generatedPaths?: string[] | undefined;
        ignoredPaths?: string[] | undefined;
        notes?: string | undefined;
    }, {
        path: string;
        name: string;
        kind: "unknown" | "ui" | "frontend" | "backend" | "service" | "assembly" | "package" | "library" | "infra" | "test" | "docs" | "game" | "cli" | "contract" | "generated";
        role: "service" | "contract" | "generated" | "source" | "application" | "packager" | "assembler" | "test-suite" | "infrastructure" | "documentation" | "verification-only";
        technology?: string | undefined;
        framework?: string | undefined;
        packageManager?: string | undefined;
        commands?: {
            package?: string | undefined;
            test?: string | undefined;
            custom?: Record<string, string> | undefined;
            install?: string | undefined;
            lint?: string | undefined;
            typecheck?: string | undefined;
            build?: string | undefined;
            e2e?: string | undefined;
            smoke?: string | undefined;
        } | undefined;
        artifact?: {
            type: "none" | "static-bundle" | "jar" | "war" | "ear" | "docker-image" | "npm-package" | "python-package" | "browser-extension" | "game-build" | "custom";
            outputPath?: string | undefined;
            outputGlob?: string | undefined;
            inspectionProfile?: string | undefined;
            requiredEntries?: string[] | undefined;
            optionalEntries?: string[] | undefined;
        } | undefined;
        dependencies?: string[] | undefined;
        produces?: string[] | undefined;
        consumes?: string[] | undefined;
        contracts?: {
            type: string;
            path?: string | undefined;
        }[] | undefined;
        protectedPaths?: string[] | undefined;
        forbiddenPaths?: string[] | undefined;
        generatedPaths?: string[] | undefined;
        ignoredPaths?: string[] | undefined;
        notes?: string | undefined;
    }>, "many">;
    globalProtectedPaths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    memory: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        path: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        enabled: boolean;
    }, {
        path: string;
        enabled: boolean;
    }>>;
    artifacts: z.ZodOptional<z.ZodObject<{
        rootDir: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rootDir: string;
    }, {
        rootDir: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    workspaceName: string;
    defaultExecutor: string;
    approvalPolicy: {
        requireBeforeImplementation: boolean;
        requireForAuthChanges: boolean;
        requireForDatabaseMigrations: boolean;
        requireForPackageChanges: boolean;
        requireForBuildConfigChanges: boolean;
        requireForDeletingFiles: boolean;
    };
    qualityGates: {
        requireSourceRepoCleanBeforeRun: boolean;
        requireFinalArtifactBuild: boolean;
        requireArtifactInspection: boolean;
        blockOnForbiddenPathModification: boolean;
        blockOnProtectedPathModificationWithoutApproval: boolean;
        warnIfNoSmokeTest: boolean;
    };
    components: {
        path: string;
        name: string;
        kind: "unknown" | "ui" | "frontend" | "backend" | "service" | "assembly" | "package" | "library" | "infra" | "test" | "docs" | "game" | "cli" | "contract" | "generated";
        role: "service" | "contract" | "generated" | "source" | "application" | "packager" | "assembler" | "test-suite" | "infrastructure" | "documentation" | "verification-only";
        technology?: string | undefined;
        framework?: string | undefined;
        packageManager?: string | undefined;
        commands?: {
            package?: string | undefined;
            test?: string | undefined;
            custom?: Record<string, string> | undefined;
            install?: string | undefined;
            lint?: string | undefined;
            typecheck?: string | undefined;
            build?: string | undefined;
            e2e?: string | undefined;
            smoke?: string | undefined;
        } | undefined;
        artifact?: {
            type: "none" | "static-bundle" | "jar" | "war" | "ear" | "docker-image" | "npm-package" | "python-package" | "browser-extension" | "game-build" | "custom";
            outputPath?: string | undefined;
            outputGlob?: string | undefined;
            inspectionProfile?: string | undefined;
            requiredEntries?: string[] | undefined;
            optionalEntries?: string[] | undefined;
        } | undefined;
        dependencies?: string[] | undefined;
        produces?: string[] | undefined;
        consumes?: string[] | undefined;
        contracts?: {
            type: string;
            path?: string | undefined;
        }[] | undefined;
        protectedPaths?: string[] | undefined;
        forbiddenPaths?: string[] | undefined;
        generatedPaths?: string[] | undefined;
        ignoredPaths?: string[] | undefined;
        notes?: string | undefined;
    }[];
    projectProfile?: "SINGLE_REPO_FRONTEND" | "SINGLE_REPO_BACKEND" | "MONOREPO_WEB_APP" | "MULTI_REPO_ENTERPRISE_APP" | "WAR_COMPOSITE_APP" | "SPRING_BOOT_SERVICE" | "NODE_API" | "REACT_APP" | "ANGULAR_APP" | "VUE_APP" | "CHROME_EXTENSION" | "THREEJS_GAME" | "PYTHON_CLI" | "LIBRARY_PACKAGE" | "MICROSERVICES_WORKSPACE" | "INFRASTRUCTURE_REPO" | "DOCUMENTATION_REPO" | "CUSTOM" | undefined;
    globalProtectedPaths?: string[] | undefined;
    memory?: {
        path: string;
        enabled: boolean;
    } | undefined;
    artifacts?: {
        rootDir: string;
    } | undefined;
}, {
    workspaceName: string;
    defaultExecutor: string;
    approvalPolicy: {
        requireBeforeImplementation: boolean;
        requireForAuthChanges: boolean;
        requireForDatabaseMigrations: boolean;
        requireForPackageChanges: boolean;
        requireForBuildConfigChanges: boolean;
        requireForDeletingFiles: boolean;
    };
    qualityGates: {
        requireSourceRepoCleanBeforeRun: boolean;
        requireFinalArtifactBuild: boolean;
        requireArtifactInspection: boolean;
        blockOnForbiddenPathModification: boolean;
        blockOnProtectedPathModificationWithoutApproval: boolean;
        warnIfNoSmokeTest: boolean;
    };
    components: {
        path: string;
        name: string;
        kind: "unknown" | "ui" | "frontend" | "backend" | "service" | "assembly" | "package" | "library" | "infra" | "test" | "docs" | "game" | "cli" | "contract" | "generated";
        role: "service" | "contract" | "generated" | "source" | "application" | "packager" | "assembler" | "test-suite" | "infrastructure" | "documentation" | "verification-only";
        technology?: string | undefined;
        framework?: string | undefined;
        packageManager?: string | undefined;
        commands?: {
            package?: string | undefined;
            test?: string | undefined;
            custom?: Record<string, string> | undefined;
            install?: string | undefined;
            lint?: string | undefined;
            typecheck?: string | undefined;
            build?: string | undefined;
            e2e?: string | undefined;
            smoke?: string | undefined;
        } | undefined;
        artifact?: {
            type: "none" | "static-bundle" | "jar" | "war" | "ear" | "docker-image" | "npm-package" | "python-package" | "browser-extension" | "game-build" | "custom";
            outputPath?: string | undefined;
            outputGlob?: string | undefined;
            inspectionProfile?: string | undefined;
            requiredEntries?: string[] | undefined;
            optionalEntries?: string[] | undefined;
        } | undefined;
        dependencies?: string[] | undefined;
        produces?: string[] | undefined;
        consumes?: string[] | undefined;
        contracts?: {
            type: string;
            path?: string | undefined;
        }[] | undefined;
        protectedPaths?: string[] | undefined;
        forbiddenPaths?: string[] | undefined;
        generatedPaths?: string[] | undefined;
        ignoredPaths?: string[] | undefined;
        notes?: string | undefined;
    }[];
    projectProfile?: "SINGLE_REPO_FRONTEND" | "SINGLE_REPO_BACKEND" | "MONOREPO_WEB_APP" | "MULTI_REPO_ENTERPRISE_APP" | "WAR_COMPOSITE_APP" | "SPRING_BOOT_SERVICE" | "NODE_API" | "REACT_APP" | "ANGULAR_APP" | "VUE_APP" | "CHROME_EXTENSION" | "THREEJS_GAME" | "PYTHON_CLI" | "LIBRARY_PACKAGE" | "MICROSERVICES_WORKSPACE" | "INFRASTRUCTURE_REPO" | "DOCUMENTATION_REPO" | "CUSTOM" | undefined;
    globalProtectedPaths?: string[] | undefined;
    memory?: {
        path: string;
        enabled: boolean;
    } | undefined;
    artifacts?: {
        rootDir: string;
    } | undefined;
}>;
export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;
export declare const RequirementReportSchema: z.ZodObject<{
    title: z.ZodString;
    businessGoal: z.ZodString;
    functionalRequirements: z.ZodArray<z.ZodString, "many">;
    nonFunctionalRequirements: z.ZodArray<z.ZodString, "many">;
    acceptanceCriteria: z.ZodArray<z.ZodString, "many">;
    outOfScope: z.ZodArray<z.ZodString, "many">;
    riskLevel: z.ZodEnum<["low", "medium", "high", "critical"]>;
    riskReasons: z.ZodArray<z.ZodString, "many">;
    approvalTriggers: z.ZodArray<z.ZodString, "many">;
    suspectedAffectedComponents: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    title: string;
    businessGoal: string;
    functionalRequirements: string[];
    nonFunctionalRequirements: string[];
    acceptanceCriteria: string[];
    outOfScope: string[];
    riskLevel: "low" | "medium" | "high" | "critical";
    riskReasons: string[];
    approvalTriggers: string[];
    suspectedAffectedComponents: string[];
}, {
    title: string;
    businessGoal: string;
    functionalRequirements: string[];
    nonFunctionalRequirements: string[];
    acceptanceCriteria: string[];
    outOfScope: string[];
    riskLevel: "low" | "medium" | "high" | "critical";
    riskReasons: string[];
    approvalTriggers: string[];
    suspectedAffectedComponents: string[];
}>;
export type RequirementReport = z.infer<typeof RequirementReportSchema>;
export declare const ProjectProfileSchema: z.ZodObject<{
    name: z.ZodEnum<["SINGLE_REPO_FRONTEND", "SINGLE_REPO_BACKEND", "MONOREPO_WEB_APP", "MULTI_REPO_ENTERPRISE_APP", "WAR_COMPOSITE_APP", "SPRING_BOOT_SERVICE", "NODE_API", "REACT_APP", "ANGULAR_APP", "VUE_APP", "CHROME_EXTENSION", "THREEJS_GAME", "PYTHON_CLI", "LIBRARY_PACKAGE", "MICROSERVICES_WORKSPACE", "INFRASTRUCTURE_REPO", "DOCUMENTATION_REPO", "CUSTOM"]>;
    confidence: z.ZodNumber;
    requiredComponentRoles: z.ZodArray<z.ZodString, "many">;
    recommendedVerification: z.ZodArray<z.ZodString, "many">;
    requiredVerification: z.ZodArray<z.ZodString, "many">;
    artifactStrategy: z.ZodOptional<z.ZodString>;
    notes: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    name: "SINGLE_REPO_FRONTEND" | "SINGLE_REPO_BACKEND" | "MONOREPO_WEB_APP" | "MULTI_REPO_ENTERPRISE_APP" | "WAR_COMPOSITE_APP" | "SPRING_BOOT_SERVICE" | "NODE_API" | "REACT_APP" | "ANGULAR_APP" | "VUE_APP" | "CHROME_EXTENSION" | "THREEJS_GAME" | "PYTHON_CLI" | "LIBRARY_PACKAGE" | "MICROSERVICES_WORKSPACE" | "INFRASTRUCTURE_REPO" | "DOCUMENTATION_REPO" | "CUSTOM";
    notes: string[];
    confidence: number;
    requiredComponentRoles: string[];
    recommendedVerification: string[];
    requiredVerification: string[];
    artifactStrategy?: string | undefined;
}, {
    name: "SINGLE_REPO_FRONTEND" | "SINGLE_REPO_BACKEND" | "MONOREPO_WEB_APP" | "MULTI_REPO_ENTERPRISE_APP" | "WAR_COMPOSITE_APP" | "SPRING_BOOT_SERVICE" | "NODE_API" | "REACT_APP" | "ANGULAR_APP" | "VUE_APP" | "CHROME_EXTENSION" | "THREEJS_GAME" | "PYTHON_CLI" | "LIBRARY_PACKAGE" | "MICROSERVICES_WORKSPACE" | "INFRASTRUCTURE_REPO" | "DOCUMENTATION_REPO" | "CUSTOM";
    notes: string[];
    confidence: number;
    requiredComponentRoles: string[];
    recommendedVerification: string[];
    requiredVerification: string[];
    artifactStrategy?: string | undefined;
}>;
export type ProjectProfile = z.infer<typeof ProjectProfileSchema>;
export declare const ExecutionRequestSchema: z.ZodObject<{
    workspaceRunId: z.ZodString;
    componentName: z.ZodString;
    componentPath: z.ZodString;
    taskTitle: z.ZodString;
    prompt: z.ZodString;
    allowedPaths: z.ZodArray<z.ZodString, "many">;
    protectedPaths: z.ZodArray<z.ZodString, "many">;
    forbiddenPaths: z.ZodArray<z.ZodString, "many">;
    mode: z.ZodEnum<["plan", "edit", "test", "fix", "review", "docs", "refactor"]>;
    interactive: z.ZodBoolean;
    requireHumanApproval: z.ZodBoolean;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    protectedPaths: string[];
    forbiddenPaths: string[];
    workspaceRunId: string;
    componentName: string;
    componentPath: string;
    taskTitle: string;
    prompt: string;
    allowedPaths: string[];
    mode: "test" | "docs" | "plan" | "edit" | "fix" | "review" | "refactor";
    interactive: boolean;
    requireHumanApproval: boolean;
    metadata?: Record<string, unknown> | undefined;
}, {
    protectedPaths: string[];
    forbiddenPaths: string[];
    workspaceRunId: string;
    componentName: string;
    componentPath: string;
    taskTitle: string;
    prompt: string;
    allowedPaths: string[];
    mode: "test" | "docs" | "plan" | "edit" | "fix" | "review" | "refactor";
    interactive: boolean;
    requireHumanApproval: boolean;
    metadata?: Record<string, unknown> | undefined;
}>;
export type ExecutionRequest = z.infer<typeof ExecutionRequestSchema>;
export declare const ExecutorResultSchema: z.ZodObject<{
    executor: z.ZodEnum<["manual", "copilot-cli", "copilot-coding-agent", "claude-code", "codex-cli", "openclaw", "local-agent", "shell", "mock", "other"]>;
    status: z.ZodEnum<["completed", "cancelled", "failed", "manual_required", "blocked"]>;
    stdout: z.ZodOptional<z.ZodString>;
    stderr: z.ZodOptional<z.ZodString>;
    exitCode: z.ZodOptional<z.ZodNumber>;
    changedFiles: z.ZodArray<z.ZodString, "many">;
    diffPath: z.ZodNullable<z.ZodString>;
    startedAt: z.ZodString;
    finishedAt: z.ZodString;
    notes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    status: "blocked" | "completed" | "cancelled" | "failed" | "manual_required";
    executor: "manual" | "copilot-cli" | "copilot-coding-agent" | "claude-code" | "codex-cli" | "openclaw" | "local-agent" | "shell" | "mock" | "other";
    changedFiles: string[];
    diffPath: string | null;
    startedAt: string;
    finishedAt: string;
    notes?: string[] | undefined;
    stdout?: string | undefined;
    stderr?: string | undefined;
    exitCode?: number | undefined;
}, {
    status: "blocked" | "completed" | "cancelled" | "failed" | "manual_required";
    executor: "manual" | "copilot-cli" | "copilot-coding-agent" | "claude-code" | "codex-cli" | "openclaw" | "local-agent" | "shell" | "mock" | "other";
    changedFiles: string[];
    diffPath: string | null;
    startedAt: string;
    finishedAt: string;
    notes?: string[] | undefined;
    stdout?: string | undefined;
    stderr?: string | undefined;
    exitCode?: number | undefined;
}>;
export type ExecutorResult = z.infer<typeof ExecutorResultSchema>;
export declare const ComponentAnalysisReportSchema: z.ZodObject<{
    componentName: z.ZodString;
    path: z.ZodString;
    kind: z.ZodEnum<["ui", "frontend", "backend", "service", "assembly", "package", "library", "infra", "test", "docs", "game", "cli", "contract", "generated", "unknown"]>;
    role: z.ZodEnum<["source", "application", "service", "packager", "assembler", "contract", "test-suite", "infrastructure", "documentation", "generated", "verification-only"]>;
    technology: z.ZodOptional<z.ZodString>;
    framework: z.ZodOptional<z.ZodString>;
    buildSystem: z.ZodOptional<z.ZodString>;
    testFramework: z.ZodOptional<z.ZodString>;
    keyFiles: z.ZodArray<z.ZodString, "many">;
    dependencies: z.ZodArray<z.ZodString, "many">;
    insights: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    path: string;
    kind: "unknown" | "ui" | "frontend" | "backend" | "service" | "assembly" | "package" | "library" | "infra" | "test" | "docs" | "game" | "cli" | "contract" | "generated";
    role: "service" | "contract" | "generated" | "source" | "application" | "packager" | "assembler" | "test-suite" | "infrastructure" | "documentation" | "verification-only";
    dependencies: string[];
    componentName: string;
    keyFiles: string[];
    insights: string[];
    technology?: string | undefined;
    framework?: string | undefined;
    buildSystem?: string | undefined;
    testFramework?: string | undefined;
}, {
    path: string;
    kind: "unknown" | "ui" | "frontend" | "backend" | "service" | "assembly" | "package" | "library" | "infra" | "test" | "docs" | "game" | "cli" | "contract" | "generated";
    role: "service" | "contract" | "generated" | "source" | "application" | "packager" | "assembler" | "test-suite" | "infrastructure" | "documentation" | "verification-only";
    dependencies: string[];
    componentName: string;
    keyFiles: string[];
    insights: string[];
    technology?: string | undefined;
    framework?: string | undefined;
    buildSystem?: string | undefined;
    testFramework?: string | undefined;
}>;
export type ComponentAnalysisReport = z.infer<typeof ComponentAnalysisReportSchema>;
export declare const ComponentStateSchema: z.ZodObject<{
    componentName: z.ZodString;
    componentPath: z.ZodString;
    kind: z.ZodEnum<["ui", "frontend", "backend", "service", "assembly", "package", "library", "infra", "test", "docs", "game", "cli", "contract", "generated", "unknown"]>;
    role: z.ZodEnum<["source", "application", "service", "packager", "assembler", "contract", "test-suite", "infrastructure", "documentation", "generated", "verification-only"]>;
    changeRole: z.ZodEnum<["modify", "verify_only", "package_only", "artifact_verify", "no_change", "blocked", "unknown"]>;
    branchBefore: z.ZodNullable<z.ZodString>;
    branchCreated: z.ZodNullable<z.ZodString>;
    dirtyBefore: z.ZodBoolean;
    dirtyAfter: z.ZodBoolean;
    analysis: z.ZodNullable<z.ZodObject<{
        componentName: z.ZodString;
        path: z.ZodString;
        kind: z.ZodEnum<["ui", "frontend", "backend", "service", "assembly", "package", "library", "infra", "test", "docs", "game", "cli", "contract", "generated", "unknown"]>;
        role: z.ZodEnum<["source", "application", "service", "packager", "assembler", "contract", "test-suite", "infrastructure", "documentation", "generated", "verification-only"]>;
        technology: z.ZodOptional<z.ZodString>;
        framework: z.ZodOptional<z.ZodString>;
        buildSystem: z.ZodOptional<z.ZodString>;
        testFramework: z.ZodOptional<z.ZodString>;
        keyFiles: z.ZodArray<z.ZodString, "many">;
        dependencies: z.ZodArray<z.ZodString, "many">;
        insights: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        path: string;
        kind: "unknown" | "ui" | "frontend" | "backend" | "service" | "assembly" | "package" | "library" | "infra" | "test" | "docs" | "game" | "cli" | "contract" | "generated";
        role: "service" | "contract" | "generated" | "source" | "application" | "packager" | "assembler" | "test-suite" | "infrastructure" | "documentation" | "verification-only";
        dependencies: string[];
        componentName: string;
        keyFiles: string[];
        insights: string[];
        technology?: string | undefined;
        framework?: string | undefined;
        buildSystem?: string | undefined;
        testFramework?: string | undefined;
    }, {
        path: string;
        kind: "unknown" | "ui" | "frontend" | "backend" | "service" | "assembly" | "package" | "library" | "infra" | "test" | "docs" | "game" | "cli" | "contract" | "generated";
        role: "service" | "contract" | "generated" | "source" | "application" | "packager" | "assembler" | "test-suite" | "infrastructure" | "documentation" | "verification-only";
        dependencies: string[];
        componentName: string;
        keyFiles: string[];
        insights: string[];
        technology?: string | undefined;
        framework?: string | undefined;
        buildSystem?: string | undefined;
        testFramework?: string | undefined;
    }>>;
    plan: z.ZodNullable<z.ZodAny>;
    executionRequestPath: z.ZodNullable<z.ZodString>;
    executorResult: z.ZodNullable<z.ZodObject<{
        executor: z.ZodEnum<["manual", "copilot-cli", "copilot-coding-agent", "claude-code", "codex-cli", "openclaw", "local-agent", "shell", "mock", "other"]>;
        status: z.ZodEnum<["completed", "cancelled", "failed", "manual_required", "blocked"]>;
        stdout: z.ZodOptional<z.ZodString>;
        stderr: z.ZodOptional<z.ZodString>;
        exitCode: z.ZodOptional<z.ZodNumber>;
        changedFiles: z.ZodArray<z.ZodString, "many">;
        diffPath: z.ZodNullable<z.ZodString>;
        startedAt: z.ZodString;
        finishedAt: z.ZodString;
        notes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        status: "blocked" | "completed" | "cancelled" | "failed" | "manual_required";
        executor: "manual" | "copilot-cli" | "copilot-coding-agent" | "claude-code" | "codex-cli" | "openclaw" | "local-agent" | "shell" | "mock" | "other";
        changedFiles: string[];
        diffPath: string | null;
        startedAt: string;
        finishedAt: string;
        notes?: string[] | undefined;
        stdout?: string | undefined;
        stderr?: string | undefined;
        exitCode?: number | undefined;
    }, {
        status: "blocked" | "completed" | "cancelled" | "failed" | "manual_required";
        executor: "manual" | "copilot-cli" | "copilot-coding-agent" | "claude-code" | "codex-cli" | "openclaw" | "local-agent" | "shell" | "mock" | "other";
        changedFiles: string[];
        diffPath: string | null;
        startedAt: string;
        finishedAt: string;
        notes?: string[] | undefined;
        stdout?: string | undefined;
        stderr?: string | undefined;
        exitCode?: number | undefined;
    }>>;
    gitStatusBeforePath: z.ZodNullable<z.ZodString>;
    gitStatusAfterPath: z.ZodNullable<z.ZodString>;
    changedFiles: z.ZodArray<z.ZodString, "many">;
    forbiddenPathViolations: z.ZodArray<z.ZodString, "many">;
    protectedPathViolations: z.ZodArray<z.ZodString, "many">;
    diffPath: z.ZodNullable<z.ZodString>;
    commandResults: z.ZodArray<z.ZodAny, "many">;
    artifactInspection: z.ZodNullable<z.ZodAny>;
    fixAttempts: z.ZodArray<z.ZodAny, "many">;
    componentDecision: z.ZodEnum<["pending", "implemented", "verified", "needs_fix", "blocked", "skipped"]>;
}, "strip", z.ZodTypeAny, {
    kind: "unknown" | "ui" | "frontend" | "backend" | "service" | "assembly" | "package" | "library" | "infra" | "test" | "docs" | "game" | "cli" | "contract" | "generated";
    role: "service" | "contract" | "generated" | "source" | "application" | "packager" | "assembler" | "test-suite" | "infrastructure" | "documentation" | "verification-only";
    componentName: string;
    componentPath: string;
    changedFiles: string[];
    diffPath: string | null;
    changeRole: "modify" | "verify_only" | "package_only" | "artifact_verify" | "no_change" | "blocked" | "unknown";
    branchBefore: string | null;
    branchCreated: string | null;
    dirtyBefore: boolean;
    dirtyAfter: boolean;
    analysis: {
        path: string;
        kind: "unknown" | "ui" | "frontend" | "backend" | "service" | "assembly" | "package" | "library" | "infra" | "test" | "docs" | "game" | "cli" | "contract" | "generated";
        role: "service" | "contract" | "generated" | "source" | "application" | "packager" | "assembler" | "test-suite" | "infrastructure" | "documentation" | "verification-only";
        dependencies: string[];
        componentName: string;
        keyFiles: string[];
        insights: string[];
        technology?: string | undefined;
        framework?: string | undefined;
        buildSystem?: string | undefined;
        testFramework?: string | undefined;
    } | null;
    executionRequestPath: string | null;
    executorResult: {
        status: "blocked" | "completed" | "cancelled" | "failed" | "manual_required";
        executor: "manual" | "copilot-cli" | "copilot-coding-agent" | "claude-code" | "codex-cli" | "openclaw" | "local-agent" | "shell" | "mock" | "other";
        changedFiles: string[];
        diffPath: string | null;
        startedAt: string;
        finishedAt: string;
        notes?: string[] | undefined;
        stdout?: string | undefined;
        stderr?: string | undefined;
        exitCode?: number | undefined;
    } | null;
    gitStatusBeforePath: string | null;
    gitStatusAfterPath: string | null;
    forbiddenPathViolations: string[];
    protectedPathViolations: string[];
    commandResults: any[];
    fixAttempts: any[];
    componentDecision: "blocked" | "pending" | "implemented" | "verified" | "needs_fix" | "skipped";
    plan?: any;
    artifactInspection?: any;
}, {
    kind: "unknown" | "ui" | "frontend" | "backend" | "service" | "assembly" | "package" | "library" | "infra" | "test" | "docs" | "game" | "cli" | "contract" | "generated";
    role: "service" | "contract" | "generated" | "source" | "application" | "packager" | "assembler" | "test-suite" | "infrastructure" | "documentation" | "verification-only";
    componentName: string;
    componentPath: string;
    changedFiles: string[];
    diffPath: string | null;
    changeRole: "modify" | "verify_only" | "package_only" | "artifact_verify" | "no_change" | "blocked" | "unknown";
    branchBefore: string | null;
    branchCreated: string | null;
    dirtyBefore: boolean;
    dirtyAfter: boolean;
    analysis: {
        path: string;
        kind: "unknown" | "ui" | "frontend" | "backend" | "service" | "assembly" | "package" | "library" | "infra" | "test" | "docs" | "game" | "cli" | "contract" | "generated";
        role: "service" | "contract" | "generated" | "source" | "application" | "packager" | "assembler" | "test-suite" | "infrastructure" | "documentation" | "verification-only";
        dependencies: string[];
        componentName: string;
        keyFiles: string[];
        insights: string[];
        technology?: string | undefined;
        framework?: string | undefined;
        buildSystem?: string | undefined;
        testFramework?: string | undefined;
    } | null;
    executionRequestPath: string | null;
    executorResult: {
        status: "blocked" | "completed" | "cancelled" | "failed" | "manual_required";
        executor: "manual" | "copilot-cli" | "copilot-coding-agent" | "claude-code" | "codex-cli" | "openclaw" | "local-agent" | "shell" | "mock" | "other";
        changedFiles: string[];
        diffPath: string | null;
        startedAt: string;
        finishedAt: string;
        notes?: string[] | undefined;
        stdout?: string | undefined;
        stderr?: string | undefined;
        exitCode?: number | undefined;
    } | null;
    gitStatusBeforePath: string | null;
    gitStatusAfterPath: string | null;
    forbiddenPathViolations: string[];
    protectedPathViolations: string[];
    commandResults: any[];
    fixAttempts: any[];
    componentDecision: "blocked" | "pending" | "implemented" | "verified" | "needs_fix" | "skipped";
    plan?: any;
    artifactInspection?: any;
}>;
export type ComponentState = z.infer<typeof ComponentStateSchema>;
export declare const CommandResultSchema: z.ZodObject<{
    component: z.ZodString;
    commandName: z.ZodString;
    command: z.ZodString;
    exitCode: z.ZodNumber;
    status: z.ZodEnum<["passed", "failed", "skipped", "blocked"]>;
    stdout: z.ZodOptional<z.ZodString>;
    stderr: z.ZodOptional<z.ZodString>;
    stdoutPath: z.ZodString;
    stderrPath: z.ZodString;
    durationMs: z.ZodNumber;
    startedAt: z.ZodString;
    finishedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "blocked" | "failed" | "skipped" | "passed";
    exitCode: number;
    startedAt: string;
    finishedAt: string;
    component: string;
    commandName: string;
    command: string;
    stdoutPath: string;
    stderrPath: string;
    durationMs: number;
    stdout?: string | undefined;
    stderr?: string | undefined;
}, {
    status: "blocked" | "failed" | "skipped" | "passed";
    exitCode: number;
    startedAt: string;
    finishedAt: string;
    component: string;
    commandName: string;
    command: string;
    stdoutPath: string;
    stderrPath: string;
    durationMs: number;
    stdout?: string | undefined;
    stderr?: string | undefined;
}>;
export type CommandResult = z.infer<typeof CommandResultSchema>;
export declare const VerificationSummarySchema: z.ZodObject<{
    overallStatus: z.ZodEnum<["passed", "failed", "partial", "skipped"]>;
    componentResults: z.ZodRecord<z.ZodString, z.ZodObject<{
        status: z.ZodEnum<["passed", "failed", "skipped", "blocked"]>;
        commandsRun: z.ZodNumber;
        commandsPassed: z.ZodNumber;
        commandsFailed: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "blocked" | "failed" | "skipped" | "passed";
        commandsRun: number;
        commandsPassed: number;
        commandsFailed: number;
    }, {
        status: "blocked" | "failed" | "skipped" | "passed";
        commandsRun: number;
        commandsPassed: number;
        commandsFailed: number;
    }>>;
    totalCommandsRun: z.ZodNumber;
    totalPassed: z.ZodNumber;
    totalFailed: z.ZodNumber;
    testsRun: z.ZodOptional<z.ZodBoolean>;
    buildsRun: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    overallStatus: "failed" | "skipped" | "passed" | "partial";
    componentResults: Record<string, {
        status: "blocked" | "failed" | "skipped" | "passed";
        commandsRun: number;
        commandsPassed: number;
        commandsFailed: number;
    }>;
    totalCommandsRun: number;
    totalPassed: number;
    totalFailed: number;
    testsRun?: boolean | undefined;
    buildsRun?: boolean | undefined;
}, {
    overallStatus: "failed" | "skipped" | "passed" | "partial";
    componentResults: Record<string, {
        status: "blocked" | "failed" | "skipped" | "passed";
        commandsRun: number;
        commandsPassed: number;
        commandsFailed: number;
    }>;
    totalCommandsRun: number;
    totalPassed: number;
    totalFailed: number;
    testsRun?: boolean | undefined;
    buildsRun?: boolean | undefined;
}>;
export type VerificationSummary = z.infer<typeof VerificationSummarySchema>;
export declare const ArtifactRecordSchema: z.ZodObject<{
    component: z.ZodString;
    artifactType: z.ZodEnum<["none", "static-bundle", "jar", "war", "ear", "docker-image", "npm-package", "python-package", "browser-extension", "game-build", "custom"]>;
    path: z.ZodString;
    createdAt: z.ZodString;
    sizeBytes: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    path: string;
    component: string;
    artifactType: "none" | "static-bundle" | "jar" | "war" | "ear" | "docker-image" | "npm-package" | "python-package" | "browser-extension" | "game-build" | "custom";
    createdAt: string;
    sizeBytes?: number | undefined;
}, {
    path: string;
    component: string;
    artifactType: "none" | "static-bundle" | "jar" | "war" | "ear" | "docker-image" | "npm-package" | "python-package" | "browser-extension" | "game-build" | "custom";
    createdAt: string;
    sizeBytes?: number | undefined;
}>;
export type ArtifactRecord = z.infer<typeof ArtifactRecordSchema>;
export declare const ArtifactInspectionReportSchema: z.ZodObject<{
    component: z.ZodString;
    artifactType: z.ZodEnum<["none", "static-bundle", "jar", "war", "ear", "docker-image", "npm-package", "python-package", "browser-extension", "game-build", "custom"]>;
    artifactPath: z.ZodString;
    exists: z.ZodBoolean;
    readable: z.ZodBoolean;
    sizeBytes: z.ZodOptional<z.ZodNumber>;
    entriesChecked: z.ZodRecord<z.ZodString, z.ZodBoolean>;
    warnings: z.ZodArray<z.ZodString, "many">;
    errors: z.ZodArray<z.ZodString, "many">;
    status: z.ZodEnum<["passed", "failed", "warning", "skipped"]>;
}, "strip", z.ZodTypeAny, {
    status: "failed" | "skipped" | "passed" | "warning";
    component: string;
    artifactType: "none" | "static-bundle" | "jar" | "war" | "ear" | "docker-image" | "npm-package" | "python-package" | "browser-extension" | "game-build" | "custom";
    artifactPath: string;
    exists: boolean;
    readable: boolean;
    entriesChecked: Record<string, boolean>;
    warnings: string[];
    errors: string[];
    sizeBytes?: number | undefined;
}, {
    status: "failed" | "skipped" | "passed" | "warning";
    component: string;
    artifactType: "none" | "static-bundle" | "jar" | "war" | "ear" | "docker-image" | "npm-package" | "python-package" | "browser-extension" | "game-build" | "custom";
    artifactPath: string;
    exists: boolean;
    readable: boolean;
    entriesChecked: Record<string, boolean>;
    warnings: string[];
    errors: string[];
    sizeBytes?: number | undefined;
}>;
export type ArtifactInspectionReport = z.infer<typeof ArtifactInspectionReportSchema>;
export declare const SecurityReviewReportSchema: z.ZodObject<{
    status: z.ZodEnum<["approved", "approved_with_notes", "needs_fix", "blocked"]>;
    findings: z.ZodArray<z.ZodObject<{
        severity: z.ZodEnum<["critical", "high", "medium", "low"]>;
        category: z.ZodString;
        description: z.ZodString;
        location: z.ZodOptional<z.ZodString>;
        recommendation: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        severity: "low" | "medium" | "high" | "critical";
        category: string;
        description: string;
        recommendation: string;
        location?: string | undefined;
    }, {
        severity: "low" | "medium" | "high" | "critical";
        category: string;
        description: string;
        recommendation: string;
        location?: string | undefined;
    }>, "many">;
    blockers: z.ZodNumber;
    warnings: z.ZodArray<z.ZodString, "many">;
    notes: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    status: "blocked" | "needs_fix" | "approved" | "approved_with_notes";
    notes: string[];
    warnings: string[];
    findings: {
        severity: "low" | "medium" | "high" | "critical";
        category: string;
        description: string;
        recommendation: string;
        location?: string | undefined;
    }[];
    blockers: number;
}, {
    status: "blocked" | "needs_fix" | "approved" | "approved_with_notes";
    notes: string[];
    warnings: string[];
    findings: {
        severity: "low" | "medium" | "high" | "critical";
        category: string;
        description: string;
        recommendation: string;
        location?: string | undefined;
    }[];
    blockers: number;
}>;
export type SecurityReviewReport = z.infer<typeof SecurityReviewReportSchema>;
export declare const PerformanceReviewReportSchema: z.ZodObject<{
    status: z.ZodEnum<["approved", "approved_with_notes", "needs_fix", "blocked"]>;
    findings: z.ZodArray<z.ZodObject<{
        severity: z.ZodEnum<["critical", "high", "medium", "low"]>;
        category: z.ZodString;
        description: z.ZodString;
        location: z.ZodOptional<z.ZodString>;
        recommendation: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        severity: "low" | "medium" | "high" | "critical";
        category: string;
        description: string;
        recommendation: string;
        location?: string | undefined;
    }, {
        severity: "low" | "medium" | "high" | "critical";
        category: string;
        description: string;
        recommendation: string;
        location?: string | undefined;
    }>, "many">;
    blockers: z.ZodNumber;
    warnings: z.ZodArray<z.ZodString, "many">;
    notes: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    status: "blocked" | "needs_fix" | "approved" | "approved_with_notes";
    notes: string[];
    warnings: string[];
    findings: {
        severity: "low" | "medium" | "high" | "critical";
        category: string;
        description: string;
        recommendation: string;
        location?: string | undefined;
    }[];
    blockers: number;
}, {
    status: "blocked" | "needs_fix" | "approved" | "approved_with_notes";
    notes: string[];
    warnings: string[];
    findings: {
        severity: "low" | "medium" | "high" | "critical";
        category: string;
        description: string;
        recommendation: string;
        location?: string | undefined;
    }[];
    blockers: number;
}>;
export type PerformanceReviewReport = z.infer<typeof PerformanceReviewReportSchema>;
export declare const BrutalRealityCheckReportSchema: z.ZodObject<{
    real: z.ZodArray<z.ZodString, "many">;
    partial: z.ZodArray<z.ZodString, "many">;
    fakeOrUnverified: z.ZodArray<z.ZodString, "many">;
    missing: z.ZodArray<z.ZodString, "many">;
    score: z.ZodNumber;
    verdict: z.ZodEnum<["APPROVED", "APPROVED_WITH_NOTES", "NEEDS_FIXES", "REJECTED", "BLOCKED"]>;
}, "strip", z.ZodTypeAny, {
    partial: string[];
    real: string[];
    fakeOrUnverified: string[];
    missing: string[];
    score: number;
    verdict: "APPROVED" | "APPROVED_WITH_NOTES" | "NEEDS_FIXES" | "REJECTED" | "BLOCKED";
}, {
    partial: string[];
    real: string[];
    fakeOrUnverified: string[];
    missing: string[];
    score: number;
    verdict: "APPROVED" | "APPROVED_WITH_NOTES" | "NEEDS_FIXES" | "REJECTED" | "BLOCKED";
}>;
export type BrutalRealityCheckReport = z.infer<typeof BrutalRealityCheckReportSchema>;
export declare const FinalDecisionReportSchema: z.ZodObject<{
    decision: z.ZodEnum<["APPROVED", "APPROVED_WITH_NOTES", "NEEDS_FIXES", "REJECTED", "BLOCKED"]>;
    summary: z.ZodString;
    score: z.ZodNumber;
    componentStatuses: z.ZodArray<z.ZodObject<{
        component: z.ZodString;
        status: z.ZodString;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: string;
        component: string;
        reason: string;
    }, {
        status: string;
        component: string;
        reason: string;
    }>, "many">;
    evidence: z.ZodObject<{
        diffsCaptured: z.ZodBoolean;
        testsRun: z.ZodBoolean;
        buildsRun: z.ZodBoolean;
        artifactsInspected: z.ZodBoolean;
        forbiddenPathViolations: z.ZodNumber;
        protectedPathViolations: z.ZodNumber;
        securityBlockers: z.ZodNumber;
        performanceBlockers: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        forbiddenPathViolations: number;
        protectedPathViolations: number;
        testsRun: boolean;
        buildsRun: boolean;
        diffsCaptured: boolean;
        artifactsInspected: boolean;
        securityBlockers: number;
        performanceBlockers: number;
    }, {
        forbiddenPathViolations: number;
        protectedPathViolations: number;
        testsRun: boolean;
        buildsRun: boolean;
        diffsCaptured: boolean;
        artifactsInspected: boolean;
        securityBlockers: number;
        performanceBlockers: number;
    }>;
    requiredFixes: z.ZodArray<z.ZodString, "many">;
    warnings: z.ZodArray<z.ZodString, "many">;
    nextAction: z.ZodString;
}, "strip", z.ZodTypeAny, {
    warnings: string[];
    score: number;
    decision: "APPROVED" | "APPROVED_WITH_NOTES" | "NEEDS_FIXES" | "REJECTED" | "BLOCKED";
    summary: string;
    componentStatuses: {
        status: string;
        component: string;
        reason: string;
    }[];
    evidence: {
        forbiddenPathViolations: number;
        protectedPathViolations: number;
        testsRun: boolean;
        buildsRun: boolean;
        diffsCaptured: boolean;
        artifactsInspected: boolean;
        securityBlockers: number;
        performanceBlockers: number;
    };
    requiredFixes: string[];
    nextAction: string;
}, {
    warnings: string[];
    score: number;
    decision: "APPROVED" | "APPROVED_WITH_NOTES" | "NEEDS_FIXES" | "REJECTED" | "BLOCKED";
    summary: string;
    componentStatuses: {
        status: string;
        component: string;
        reason: string;
    }[];
    evidence: {
        forbiddenPathViolations: number;
        protectedPathViolations: number;
        testsRun: boolean;
        buildsRun: boolean;
        diffsCaptured: boolean;
        artifactsInspected: boolean;
        securityBlockers: number;
        performanceBlockers: number;
    };
    requiredFixes: string[];
    nextAction: string;
}>;
export type FinalDecisionReport = z.infer<typeof FinalDecisionReportSchema>;
export declare const ApprovalRecordSchema: z.ZodObject<{
    timestamp: z.ZodString;
    type: z.ZodString;
    approved: z.ZodBoolean;
    approver: z.ZodOptional<z.ZodString>;
    reasons: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: string;
    approved: boolean;
    timestamp: string;
    notes?: string | undefined;
    approver?: string | undefined;
    reasons?: string[] | undefined;
}, {
    type: string;
    approved: boolean;
    timestamp: string;
    notes?: string | undefined;
    approver?: string | undefined;
    reasons?: string[] | undefined;
}>;
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;
export declare const WorkflowErrorSchema: z.ZodObject<{
    timestamp: z.ZodString;
    phase: z.ZodString;
    component: z.ZodOptional<z.ZodString>;
    error: z.ZodString;
    recoverable: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    phase: string;
    error: string;
    recoverable: boolean;
    component?: string | undefined;
}, {
    timestamp: string;
    phase: string;
    error: string;
    recoverable: boolean;
    component?: string | undefined;
}>;
export type WorkflowError = z.infer<typeof WorkflowErrorSchema>;
export declare const ExecutionGroupStateSchema: z.ZodObject<{
    groupId: z.ZodString;
    description: z.ZodString;
    components: z.ZodArray<z.ZodString, "many">;
    status: z.ZodEnum<["pending", "in_progress", "completed", "failed"]>;
    startedAt: z.ZodOptional<z.ZodString>;
    completedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "completed" | "failed" | "pending" | "in_progress";
    components: string[];
    description: string;
    groupId: string;
    startedAt?: string | undefined;
    completedAt?: string | undefined;
}, {
    status: "completed" | "failed" | "pending" | "in_progress";
    components: string[];
    description: string;
    groupId: string;
    startedAt?: string | undefined;
    completedAt?: string | undefined;
}>;
export type ExecutionGroupState = z.infer<typeof ExecutionGroupStateSchema>;
export declare function createDefaultApprovalPolicy(): ApprovalPolicy;
export declare function createDefaultQualityGates(): QualityGates;
//# sourceMappingURL=schemas.d.ts.map