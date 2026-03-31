import type { AOTUIDrivenSource } from '@aotui/runtime/adapters';
import type { McpDrivenSource } from '../mcp/source.js';
import type { SkillDrivenSource } from '../skills/skill-driven-source.js';
import {
    buildMcpServerItemKey,
    buildMcpToolItemKey,
    isMcpServerItemKey,
    parseMcpServerItemKey,
} from '../shared/source-control-keys.js';

type AOTUIControllableSource = {
    setEnabled(enabled: boolean): void;
    setAppEnabled(appName: string, enabled: boolean): void;
};

export type SourceControlsSnapshot = {
    apps: { enabled: boolean; disabledItems: string[] };
    mcp: { enabled: boolean; disabledItems: string[] };
    skill: { enabled: boolean; disabledItems: string[] };
};

export function createDefaultSourceControls(): SourceControlsSnapshot {
    return {
        apps: { enabled: true, disabledItems: [] },
        mcp: { enabled: true, disabledItems: [] },
        skill: { enabled: true, disabledItems: [] },
    };
}

export function normalizeSourceControlsSnapshot(
    input?: Partial<SourceControlsSnapshot> | null,
): SourceControlsSnapshot {
    const defaults = createDefaultSourceControls();
    if (!input) {
        return defaults;
    }

    const normalizeBucket = (
        bucket: Partial<SourceControlsSnapshot['apps']> | undefined,
        fallback: SourceControlsSnapshot['apps'],
    ) => ({
        enabled: typeof bucket?.enabled === 'boolean' ? bucket.enabled : fallback.enabled,
        disabledItems: Array.isArray(bucket?.disabledItems)
            ? bucket.disabledItems.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            : fallback.disabledItems,
    });

    return {
        apps: normalizeBucket(input.apps, defaults.apps),
        mcp: normalizeBucket(input.mcp, defaults.mcp),
        skill: normalizeBucket(input.skill, defaults.skill),
    };
}

export function normalizeAgentDisabledMcpToolKeys(rawDisabledTools: unknown): string[] {
    if (!Array.isArray(rawDisabledTools)) {
        return [];
    }

    const normalized = new Set<string>();
    for (const item of rawDisabledTools) {
        if (typeof item !== 'string') {
            continue;
        }

        const key = item.trim();
        if (!key) {
            continue;
        }

        if (key.startsWith('mcp-')) {
            normalized.add(key);
            continue;
        }

        const separatorIndex = key.indexOf('::');
        if (separatorIndex > 0 && separatorIndex < key.length - 2) {
            const serverName = key.slice(0, separatorIndex);
            const toolName = key.slice(separatorIndex + 2);
            normalized.add(buildMcpToolItemKey(serverName, toolName));
            continue;
        }

        normalized.add(key);
    }

    return Array.from(normalized);
}

export function createSourceControlsFromAgent(
    agent: any,
    config: { mcp?: Record<string, unknown> },
): SourceControlsSnapshot {
    const enabledApps = Array.isArray(agent?.enabledApps)
        ? agent.enabledApps.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
    const enabledSkills = agent?.enabledSkills && typeof agent.enabledSkills === 'object'
        ? Object.values(agent.enabledSkills as Record<string, unknown>)
            .flatMap((bucket) => Array.isArray(bucket)
                ? bucket.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
                : [])
        : [];
    const enabledMcpServers = Array.isArray(agent?.enabledMCPs)
        ? agent.enabledMCPs.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];

    const enabledMcpSet = new Set(enabledMcpServers);
    const allConfiguredMcpServers = Object.keys((config.mcp || {}) as Record<string, unknown>);
    const disabledServerKeys = allConfiguredMcpServers
        .filter((serverName) => !enabledMcpSet.has(serverName))
        .map((serverName) => buildMcpServerItemKey(serverName));

    const disabledToolKeys = normalizeAgentDisabledMcpToolKeys(agent?.disabledMcpTools);

    return normalizeSourceControlsSnapshot({
        apps: {
            enabled: enabledApps.length > 0,
            disabledItems: [],
        },
        skill: {
            enabled: enabledSkills.length > 0,
            disabledItems: [],
        },
        mcp: {
            enabled: enabledMcpSet.size > 0,
            disabledItems: Array.from(new Set([...disabledServerKeys, ...disabledToolKeys])),
        },
    });
}

function asAOTUIControllableSource(source: AOTUIDrivenSource): AOTUIControllableSource | null {
    const candidate = source as unknown as Partial<AOTUIControllableSource>;
    if (typeof candidate.setEnabled !== 'function' || typeof candidate.setAppEnabled !== 'function') {
        return null;
    }

    return candidate as AOTUIControllableSource;
}

export function applySourceControlsToSources(
    controlsInput: SourceControlsSnapshot | undefined,
    options: {
        aotuiSource?: AOTUIDrivenSource;
        mcpSource?: McpDrivenSource;
        skillSource?: SkillDrivenSource;
    },
): SourceControlsSnapshot {
    const controls = normalizeSourceControlsSnapshot(controlsInput);

    if (options.aotuiSource) {
        const controllableSource = asAOTUIControllableSource(options.aotuiSource);
        if (controllableSource) {
            controllableSource.setEnabled(controls.apps.enabled);
            controls.apps.disabledItems.forEach((item) => controllableSource.setAppEnabled(item, false));
        }
    }

    if (options.mcpSource) {
        options.mcpSource.setEnabled(controls.mcp.enabled);
        controls.mcp.disabledItems.forEach((item) => {
            if (isMcpServerItemKey(item)) {
                const serverName = parseMcpServerItemKey(item);
                if (serverName) {
                    options.mcpSource?.setServerEnabled(serverName, false);
                }
                return;
            }

            options.mcpSource?.setToolEnabled(item, false);
        });
    }

    if (options.skillSource) {
        options.skillSource.setEnabled(controls.skill.enabled);
        controls.skill.disabledItems.forEach((item) => options.skillSource?.setSkillEnabled(item, false));
    }

    return controls;
}
