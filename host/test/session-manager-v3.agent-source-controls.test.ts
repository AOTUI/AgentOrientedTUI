import { afterEach, describe, expect, it } from 'vitest';
import { SessionManagerV3 } from '../src/core/session-manager-v3.js';

describe('SessionManagerV3 agent MCP source controls', () => {
  let manager: SessionManagerV3 | null = null;

  afterEach(async () => {
    if (manager) {
      await manager.cleanup();
      manager = null;
    }
  });

  it('derives server-level disabled items from agent enabledMCPs', () => {
    manager = new SessionManagerV3(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const controls = (manager as any).createSourceControlsFromAgent(
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
});
