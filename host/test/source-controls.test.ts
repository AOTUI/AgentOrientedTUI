import { describe, expect, it, vi } from 'vitest';
import {
    applySourceControlsToSources,
    createSourceControlsFromAgent,
    normalizeSourceControlsSnapshot,
} from '../src/core/source-controls.js';

describe('source-controls', () => {
    it('derives server-level disabled items from agent enabledMCPs', () => {
        const controls = createSourceControlsFromAgent(
            {
                enabledMCPs: ['server-a'],
                disabledMcpTools: ['server-a::search'],
            },
            {
                mcp: {
                    'server-a': { type: 'local', command: ['node', 'a.js'], enabled: true },
                    'server-b': { type: 'local', command: ['node', 'b.js'], enabled: true },
                },
            },
        );

        expect(controls.mcp.enabled).toBe(true);
        expect(controls.mcp.disabledItems).toContain('server:server-b');
        expect(controls.mcp.disabledItems).toContain('mcp-server-a-search');
    });

    it('applies source controls across aotui, mcp, and skill sources', () => {
        const aotuiSource = {
            setEnabled: vi.fn(),
            setAppEnabled: vi.fn(),
        };
        const mcpSource = {
            setEnabled: vi.fn(),
            setServerEnabled: vi.fn(),
            setToolEnabled: vi.fn(),
        };
        const skillSource = {
            setEnabled: vi.fn(),
            setSkillEnabled: vi.fn(),
        };

        const controls = normalizeSourceControlsSnapshot({
            apps: { enabled: false, disabledItems: ['app-x'] },
            mcp: { enabled: true, disabledItems: ['server:server-b', 'mcp-server-a-search'] },
            skill: { enabled: true, disabledItems: ['skill-a'] },
        });

        applySourceControlsToSources(controls, {
            aotuiSource: aotuiSource as any,
            mcpSource: mcpSource as any,
            skillSource: skillSource as any,
        });

        expect(aotuiSource.setEnabled).toHaveBeenCalledWith(false);
        expect(aotuiSource.setAppEnabled).toHaveBeenCalledWith('app-x', false);
        expect(mcpSource.setEnabled).toHaveBeenCalledWith(true);
        expect(mcpSource.setServerEnabled).toHaveBeenCalledWith('server-b', false);
        expect(mcpSource.setToolEnabled).toHaveBeenCalledWith('mcp-server-a-search', false);
        expect(skillSource.setEnabled).toHaveBeenCalledWith(true);
        expect(skillSource.setSkillEnabled).toHaveBeenCalledWith('skill-a', false);
    });
});
