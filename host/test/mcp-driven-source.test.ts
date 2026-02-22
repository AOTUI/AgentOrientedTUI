import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpDrivenSource } from '../src/mcp/source.js';
import { MCP } from '../src/mcp/index.js';

// Mock MCP Manager
vi.mock('../src/mcp/index.js', () => ({
    MCP: {
        tools: vi.fn(),
    }
}));

describe('McpDrivenSource', () => {
    let source: McpDrivenSource;

    beforeEach(() => {
        vi.clearAllMocks();
        source = new McpDrivenSource();
    });

    it('should have the correct name', () => {
        expect(source.name).toBe('mcp-driven-source');
    });

    it('should fetch tools correctly', async () => {
        const mockTool = {
            execute: vi.fn().mockResolvedValue('tool_success_result')
        };
        (MCP.tools as any).mockResolvedValue({ 'test-tool': mockTool });

        const tools = await source.getTools();
        expect(MCP.tools).toHaveBeenCalled();
        expect(tools['test-tool']).toBe(mockTool);
    });

    it('should execute tool successfully', async () => {
        const mockTool = {
            execute: vi.fn().mockResolvedValue('tool_success_result')
        };
        (MCP.tools as any).mockResolvedValue({ 'test-tool': mockTool });
        await source.getTools(); // prime the cache

        const result = await source.executeTool('test-tool', { arg1: 'value' }, 'call_123');

        expect(mockTool.execute).toHaveBeenCalledWith(
            { arg1: 'value' },
            { toolCallId: 'call_123', messages: [] }
        );
        expect(result).toEqual({
            toolCallId: 'call_123',
            toolName: 'test-tool',
            result: 'tool_success_result'
        });
    });

    it('should handle tool execution errors', async () => {
        const mockTool = {
            execute: vi.fn().mockRejectedValue(new Error('Tool failed'))
        };
        (MCP.tools as any).mockResolvedValue({ 'error-tool': mockTool });
        await source.getTools(); // prime the cache

        const result = await source.executeTool('error-tool', {}, 'call_456');

        expect(result).toEqual({
            toolCallId: 'call_456',
            toolName: 'error-tool',
            result: 'Error: Tool failed'
        });
    });

    it('should handle missing tools gracefully', async () => {
        const result = await source.executeTool('non-existent-tool', {}, 'call_789');
        expect(result).toBeUndefined();
    });
});
