export type SkillScope = 'global' | 'project';

export interface SkillInfo {
    name: string;
    description: string;
    location: string;
    content: string;
    scope: SkillScope;
}
