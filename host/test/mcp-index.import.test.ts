import { describe, expect, it } from 'vitest';

describe('MCP module import', () => {
    it('loads the MCP index without dependency resolution errors', async () => {
        const mod = await import('../src/mcp/index.js');
        expect(mod.MCP).toBeDefined();
    });
});
