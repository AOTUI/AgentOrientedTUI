/**
 * @aotui/host - SystemPromptDrivenSource Tests
 * 
 * 单元测试
 */

import { describe, it, expect } from 'vitest';
import { SystemPromptDrivenSource } from '../src/adapters/system-prompt-source.js';

describe('SystemPromptDrivenSource', () => {
    describe('Constructor', () => {
        it('should create source with valid config', () => {
            const source = new SystemPromptDrivenSource({
                systemPrompt: 'Test prompt',
            });
            
            expect(source.name).toBe('SystemPrompt');
        });
        
        it('should throw error with empty prompt', () => {
            expect(() => {
                new SystemPromptDrivenSource({
                    systemPrompt: '',
                });
            }).toThrow('systemPrompt cannot be empty');
        });
        
        it('should throw error with whitespace-only prompt', () => {
            expect(() => {
                new SystemPromptDrivenSource({
                    systemPrompt: '   ',
                });
            }).toThrow('systemPrompt cannot be empty');
        });
    });
    
    describe('getMessages', () => {
        it('should return system message with timestamp 0', async () => {
            const source = new SystemPromptDrivenSource({
                systemPrompt: 'Test prompt',
            });
            
            const messages = await source.getMessages();
            
            expect(messages).toHaveLength(1);
            expect(messages[0]).toMatchObject({
                role: 'system',
                content: 'Test prompt',
                timestamp: 0,
            });
        });
        
        it('should return same message on multiple calls', async () => {
            const source = new SystemPromptDrivenSource({
                systemPrompt: 'Test prompt',
            });
            
            const messages1 = await source.getMessages();
            const messages2 = await source.getMessages();
            
            expect(messages1).toEqual(messages2);
        });
    });
    
    describe('getTools', () => {
        it('should return empty object', async () => {
            const source = new SystemPromptDrivenSource({
                systemPrompt: 'Test',
            });
            
            const tools = await source.getTools();
            expect(Object.keys(tools)).toHaveLength(0);
        });
    });
    
    describe('executeTool', () => {
        it('should return undefined', async () => {
            const source = new SystemPromptDrivenSource({
                systemPrompt: 'Test',
            });
            
            const result = await source.executeTool(
                'any_tool',
                {},
                'call_123'
            );
            
            expect(result).toBeUndefined();
        });
    });
    
    describe('onUpdate', () => {
        it('should return unsubscribe function', () => {
            const source = new SystemPromptDrivenSource({
                systemPrompt: 'Test',
            });
            
            const unsubscribe = source.onUpdate(() => {});
            expect(typeof unsubscribe).toBe('function');
            
            // Should not throw
            unsubscribe();
        });
        
        it('should never call callback', (done) => {
            const source = new SystemPromptDrivenSource({
                systemPrompt: 'Test',
            });
            
            let called = false;
            source.onUpdate(() => {
                called = true;
            });
            
            // Wait and verify callback was never called
            setTimeout(() => {
                expect(called).toBe(false);
                done();
            }, 100);
        });
    });
    
    describe('getMetadata', () => {
        it('should return empty object when no metadata provided', () => {
            const source = new SystemPromptDrivenSource({
                systemPrompt: 'Test',
            });
            
            const metadata = source.getMetadata();
            expect(metadata).toEqual({});
        });
        
        it('should return provided metadata', () => {
            const source = new SystemPromptDrivenSource({
                systemPrompt: 'Test',
                metadata: {
                    version: '1.0',
                    locale: 'en-US',
                },
            });
            
            const metadata = source.getMetadata();
            expect(metadata).toEqual({
                version: '1.0',
                locale: 'en-US',
            });
        });
    });
});
