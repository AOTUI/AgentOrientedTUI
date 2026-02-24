import type { MessageWithTimestamp, ToolResult } from '@aotui/agent-driver-v2';
import { dynamicTool, jsonSchema } from 'ai';
import { Logger } from '../utils/logger.js';
import { SkillCatalogService } from './skill-catalog-service.js';

interface SkillToolInput {
    name: string;
}

export interface SkillDrivenSourceOptions {
    projectPath?: string;
}

export class SkillDrivenSource {
    readonly name = 'Skill';

    private listeners = new Set<() => void>();
    private logger = new Logger('SkillDrivenSource');
    private catalog: SkillCatalogService;

    constructor(options: SkillDrivenSourceOptions = {}) {
        this.catalog = new SkillCatalogService({ projectPath: options.projectPath });
    }

    async getMessages(): Promise<MessageWithTimestamp[]> {
        return [];
    }

    // @ts-ignore - AI SDK Tool schemas version mismatch across workspace packages
    async getTools(): Promise<Record<string, any>> {
        const skills = await this.catalog.listSkills();
        const description =
            skills.length === 0
                ? 'Load a specialized skill. No skills are currently available.'
                : [
                    'Load a specialized skill by name. Available skills:',
                    ...skills.map((skill) => `- ${skill.name}: ${skill.description}`),
                ].join('\n');

        const skillTool = dynamicTool({
            description,
            inputSchema: jsonSchema({
                type: 'object',
                additionalProperties: false,
                properties: {
                    name: {
                        type: 'string',
                        description: 'Skill name from available list',
                    },
                },
                required: ['name'],
            }),
            execute: async (_args: unknown) => {
                return 'Use AgentDriver executeTool routing for skill execution.';
            },
        });

        return {
            skill: skillTool,
        };
    }

    async executeTool(toolName: string, args: unknown, toolCallId: string): Promise<ToolResult | undefined> {
        if (toolName !== 'skill') {
            return undefined;
        }

        const input = (args || {}) as Partial<SkillToolInput>;
        const requested = input.name?.trim();
        if (!requested) {
            return {
                toolCallId,
                toolName,
                error: {
                    code: 'E_INVALID_ARGS',
                    message: 'Missing required field: name',
                },
            };
        }

        const skill = await this.catalog.getSkill(requested);
        if (!skill) {
            const available = (await this.catalog.listSkills()).map((x) => x.name).join(', ') || 'none';
            return {
                toolCallId,
                toolName,
                error: {
                    code: 'E_SKILL_NOT_FOUND',
                    message: `Skill "${requested}" not found. Available skills: ${available}`,
                },
            };
        }

        this.logger.info('Skill loaded', {
            name: skill.name,
            scope: skill.scope,
            location: skill.location,
        });

        return {
            toolCallId,
            toolName,
            result: [
                `<skill_content name="${skill.name}">`,
                `# Skill: ${skill.name}`,
                '',
                skill.content,
                '',
                `Location: ${skill.location}`,
                `Scope: ${skill.scope}`,
                '</skill_content>',
            ].join('\n'),
        };
    }

    onUpdate(callback: () => void): () => void {
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
        };
    }
}
