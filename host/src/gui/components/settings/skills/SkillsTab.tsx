import React, { useEffect, useMemo, useState } from 'react';
import { useChatBridge } from '../../../ChatBridge.js';
import { LoadingState } from '../LoadingState.js';

type SkillsConfig = {
    enabled: boolean;
    disabledSkills: string[];
};

type SkillLocations = {
    globalPath: string;
    projectPath: string | null;
};

type RuntimeSkill = {
    name: string;
    description: string;
    scope: 'global' | 'project';
    enabled: boolean;
};

const defaultConfig: SkillsConfig = {
    enabled: true,
    disabledSkills: [],
};

interface SkillsTabProps {
    projectPath?: string | null;
}

interface ToggleProps {
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    size?: 'sm' | 'md';
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, disabled = false, size = 'md' }) => {
    const w = size === 'sm' ? 'w-7 h-4' : 'w-9 h-5';
    const thumb = size === 'sm' ? 'w-3 h-3 translate-x-0.5' : 'w-4 h-4 translate-x-0.5';
    const on = size === 'sm' ? 'translate-x-3' : 'translate-x-4';

    return (
        <button
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`
                relative inline-flex items-center shrink-0 rounded-full border border-transparent
                transition-colors duration-200 focus:outline-none
                ${w}
                ${checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--mat-border)]'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            `}
        >
            <span
                className={`
                    inline-block rounded-full bg-white shadow transition-transform duration-200
                    ${thumb}
                    ${checked ? on : ''}
                `}
            />
        </button>
    );
};

export const SkillsTab: React.FC<SkillsTabProps> = ({ projectPath }) => {
    const bridge = useChatBridge();
    const [config, setConfig] = useState<SkillsConfig>(defaultConfig);
    const [locations, setLocations] = useState<SkillLocations>({ globalPath: '', projectPath: null });
    const [runtimeSkills, setRuntimeSkills] = useState<RuntimeSkill[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedBanner, setSavedBanner] = useState(false);
    const [bannerText, setBannerText] = useState('');
    const [activeScope, setActiveScope] = useState<'global' | 'project'>('global');

    const fetchAll = async () => {
        try {
            const [cfg, runtime, resolvedLocations] = await Promise.all([
                bridge.getTrpcClient().skills.getConfig.query(),
                bridge.getTrpcClient().skills.getRuntime.query(projectPath ? { projectPath } : undefined),
                bridge.getTrpcClient().skills.getLocations.query(projectPath ? { projectPath } : undefined),
            ]);

            setConfig(cfg);
            setRuntimeSkills(runtime.skills);
            setLocations(resolvedLocations);
        } catch (error) {
            console.error('[SkillsTab] Failed to load skills settings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        void fetchAll();
    }, [projectPath]);

    const mergedSkills = useMemo(() => {
        const disabled = new Set(config.disabledSkills || []);
        return runtimeSkills.map((skill) => ({
            ...skill,
            enabled: !disabled.has(skill.name),
        }));
    }, [runtimeSkills, config.disabledSkills]);

    const saveConfig = async (next: SkillsConfig) => {
        setSaving(true);
        setSavedBanner(false);
        try {
            await bridge.getTrpcClient().skills.updateConfig.mutate({ skills: next });
            setConfig(next);
            await fetchAll();
            setSavedBanner(true);
            setBannerText('Skills config saved');
            setTimeout(() => setSavedBanner(false), 3000);
        } catch (error) {
            console.error('[SkillsTab] Failed to save skills settings:', error);
            alert('Failed to save skills settings. Check console for details.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleAll = async (enabled: boolean) => {
        await saveConfig({ ...config, enabled });
    };

    const handleToggleSkill = async (name: string, enabled: boolean) => {
        const disabled = new Set(config.disabledSkills || []);
        if (enabled) {
            disabled.delete(name);
        } else {
            disabled.add(name);
        }
        await saveConfig({ ...config, disabledSkills: Array.from(disabled).sort((a, b) => a.localeCompare(b)) });
    };

    const handleImportZip = async (scope: 'global' | 'project') => {
        setSaving(true);
        setSavedBanner(false);
        try {
            const result = await bridge.getTrpcClient().skills.importZip.mutate({
                scope,
                projectPath: projectPath || undefined,
            });

            if (result?.canceled) {
                return;
            }

            await fetchAll();
            setSavedBanner(true);
            setBannerText(
                scope === 'global'
                    ? `Imported ${result.writtenFiles} files into global skills`
                    : `Imported ${result.writtenFiles} files into project skills`,
            );
            setTimeout(() => setSavedBanner(false), 3000);
        } catch (error) {
            console.error('[SkillsTab] Failed to import skills zip:', error);
            const message = error instanceof Error ? error.message : 'Failed to import skills zip.';
            alert(message);
        } finally {
            setSaving(false);
        }
    };

    const globalSkills = useMemo(() => mergedSkills.filter((skill) => skill.scope === 'global'), [mergedSkills]);
    const projectSkills = useMemo(() => mergedSkills.filter((skill) => skill.scope === 'project'), [mergedSkills]);

    const renderSkillList = (skills: RuntimeSkill[]) => {
        if (skills.length === 0) {
            return <p className="text-[12px] text-[var(--color-text-tertiary)]">No skills found in this scope.</p>;
        }

        return (
            <div className="space-y-2">
                {skills.map((skill) => (
                    <label key={skill.name} className="flex items-start justify-between gap-3 px-3 py-2 rounded-xl bg-[var(--mat-content-card-hover-bg)]">
                        <div>
                            <div className="text-[12px] font-medium text-[var(--color-text-primary)]">{skill.name}</div>
                            <div className="text-[11px] text-[var(--color-text-tertiary)]">{skill.description || 'No description'}</div>
                        </div>
                        <Toggle
                            checked={skill.enabled}
                            disabled={saving}
                            size="sm"
                            onChange={(value) => void handleToggleSkill(skill.name, value)}
                        />
                    </label>
                ))}
            </div>
        );
    };

    if (loading) {
        return <LoadingState message="Loading skills configuration..." size="md" />;
    }

    return (
        <div className="relative flex flex-col h-full min-h-0 gap-4">
            <div>
                <div className="flex items-center justify-between gap-4">
                    <h3 className="text-[13px] font-medium text-[var(--color-text-secondary)]">Skills</h3>
                    <div className="inline-flex items-center gap-2">
                        <span className="text-[12px] text-[var(--color-text-secondary)]">Enable by default</span>
                        <Toggle
                            checked={config.enabled}
                            disabled={saving}
                            onChange={(value) => void handleToggleAll(value)}
                        />
                    </div>
                </div>
                <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1">
                    Skills are loaded from fixed local directories by scope. Agent status bar toggles are topic-scoped temporary overrides.
                </p>
            </div>

            <div className="mat-content rounded-[16px] p-4 space-y-4">
                <div className="flex items-center mat-lg-regular rounded-full p-1 shadow-sm w-fit">
                    <button
                        onClick={() => setActiveScope('global')}
                        className={`px-3 py-1.5 text-[12px] font-medium rounded-full transition-colors ${activeScope === 'global' ? 'bg-[var(--mat-content-card-hover-bg)] text-[var(--color-text-primary)] shadow-sm border border-[var(--mat-border)]' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'}`}
                    >
                        Global
                    </button>
                    <button
                        onClick={() => setActiveScope('project')}
                        className={`px-3 py-1.5 text-[12px] font-medium rounded-full transition-colors ${activeScope === 'project' ? 'bg-[var(--mat-content-card-hover-bg)] text-[var(--color-text-primary)] shadow-sm border border-[var(--mat-border)]' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'}`}
                    >
                        Project
                    </button>
                </div>

                <div className="rounded-xl border border-[var(--mat-border)] p-3 space-y-2">
                    <div className="text-[12px] font-medium text-[var(--color-text-secondary)]">
                        {activeScope === 'global' ? 'Global Skills' : 'Project Skills'}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-tertiary)] break-all">
                        {activeScope === 'global' ? locations.globalPath : (locations.projectPath || 'No active project path')}
                    </div>
                    <button
                        onClick={() => void handleImportZip(activeScope)}
                        disabled={saving || (activeScope === 'project' && !projectPath)}
                        className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-[var(--color-accent)] text-white disabled:opacity-60"
                    >
                        Import .zip
                    </button>
                </div>
            </div>

            <div className="mat-content rounded-[16px] p-4 min-h-0 overflow-auto space-y-4">
                <div>
                    <div className="text-[13px] font-medium text-[var(--color-text-secondary)] mb-2">
                        {activeScope === 'global' ? 'Global Skill Availability' : 'Project Skill Availability'}
                    </div>
                    {renderSkillList(activeScope === 'global' ? globalSkills : projectSkills)}
                </div>
            </div>

            {savedBanner && (
                <div className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-success)]/90 text-white text-[13px] shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    {bannerText}
                </div>
            )}
        </div>
    );
};
