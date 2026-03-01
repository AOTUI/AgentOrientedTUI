/**
 * system-chat GUI - Main App Component
 * Immersive Dark Tech Style: Glassmorphism + FUI + Subdued Colors
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useChatBridge } from './ChatBridge.js';
import { TuiDesktopViewer } from './components/TuiDesktopViewer.js';
import type { Topic, Message, Project, ImageAttachment } from '../types.js';

// Components
import { ProjectSelector } from './components/ProjectSelector.js';
import { ConnectionScreen } from './components/ConnectionScreen.js';
import { Sidebar } from './components/Sidebar.js';
import { WorkspaceHeader } from './components/WorkspaceHeader.js';
import { ChatArea } from './components/ChatArea.js';
import { DeleteConfirmModal } from './components/DeleteConfirmModal.js';
import { Toast } from './components/Toast.js';
import { SettingsPanel } from './components/settings/SettingsPanel.js';
import type { AgentConfig } from './components/settings/agent/AgentTab.js';
import { buildMcpToolItemKey } from '../core/source-control-keys.js';

type ViewMode = 'chat' | 'tui';

type TopicCapabilities = {
    mcp: {
        enabled: boolean;
        groups: Array<{
            key: string;
            serverName: string;
            enabled: boolean;
            connected: boolean;
            items: Array<{ key: string; name: string; enabled: boolean }>;
        }>;
    };
    skill: {
        enabled: boolean;
        items: Array<{ name: string; enabled: boolean; scope?: 'global' | 'project' }>;
    };
    apps: {
        enabled: boolean;
        items: Array<{ name: string; enabled: boolean }>;
    };
    modelOverride?: string | null;
    promptOverride?: string | null;
};

export function App() {
    const bridge = useChatBridge();

    // UI State
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('chat');
    const [isNewChat, setIsNewChat] = useState(false);
    const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
    const [settingsInitialTab, setSettingsInitialTab] = useState<'model' | 'agent' | 'prompt' | 'theme' | 'apps' | 'mcp' | 'skills' | undefined>(undefined);

    // Theme
    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        const savedTheme = localStorage.getItem('aotui-theme');
        return savedTheme === 'light' ? 'light' : 'dark';
    });

    // Data State
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(true);
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null); // [RFC-025]
    const [topics, setTopics] = useState<Topic[]>([]);
    const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [tuiSnapshot, setTuiSnapshot] = useState('');
    const [agentThinking, setAgentThinking] = useState('');
    const [agentReasoning, setAgentReasoning] = useState('');
    const [agentState, setAgentState] = useState('IDLE');
    const [agentPaused, setAgentPaused] = useState(false);
    const [displayAgentState, setDisplayAgentState] = useState<'sleeping' | 'idle' | 'working' | 'paused'>('sleeping');
    const syncedAgentTopicIdRef = useRef<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [canSendMessage, setCanSendMessage] = useState(false);
    const [sendBlockedReason, setSendBlockedReason] = useState<string | null>(null);
    const [topicCapabilities, setTopicCapabilities] = useState<TopicCapabilities | null>(null);
    const [draftCapabilities, setDraftCapabilities] = useState<TopicCapabilities | null>(null);
    const [topicModelOverride, setTopicModelOverride] = useState<string | null>(null);
    const [topicPromptOverride, setTopicPromptOverride] = useState<string>('');
    const [draftModelOverride, setDraftModelOverride] = useState<string | null>(null);
    const [draftPromptOverride, setDraftPromptOverride] = useState<string>('');
    const [promptTemplates, setPromptTemplates] = useState<Array<{ id: string; name: string; content: string }>>([]);
    const [modelGroups, setModelGroups] = useState<Array<{ providerId: string; models: string[]; displayName?: string }>>([]);
    const [activeModelId, setActiveModelId] = useState<string | null>(null);
    const [agents, setAgents] = useState<AgentConfig[]>([]);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [draftAgentId, setDraftAgentId] = useState<string | null>(null);

    // Init Theme
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.className = theme;
        localStorage.setItem('aotui-theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const openSettings = (tab?: string) => {
        if (tab) setSettingsInitialTab(tab as 'model' | 'agent' | 'prompt' | 'theme' | 'apps' | 'mcp' | 'skills');
        else setSettingsInitialTab(undefined);
        setSettingsPanelOpen(true);
    };

    const closeSettings = () => {
        setSettingsPanelOpen(false);
    };

    const showToast = useCallback((message: string) => {
        setToastMessage(message);
    }, []);

    useEffect(() => {
        if (!toastMessage) return;
        const timer = setTimeout(() => setToastMessage(null), 3500);
        return () => clearTimeout(timer);
    }, [toastMessage]);

    const refreshLLMReadiness = useCallback(async () => {
        try {
            const [allConfigs, activeConfig] = await Promise.all([
                bridge.getAllLLMConfigs(),
                bridge.getActiveLLMConfig()
            ]);

            if (!Array.isArray(allConfigs) || allConfigs.length === 0) {
                setCanSendMessage(false);
                setSendBlockedReason('No LLM provider or model configured. Please go to Settings to add a provider and select a model.');
                return;
            }

            if (!activeConfig) {
                setCanSendMessage(false);
                setSendBlockedReason('尚未激活任何 LLM 配置。请在 Settings 里选择一个 Provider 与模型并设为 Active。');
                return;
            }

            if (!activeConfig.providerId || !activeConfig.model) {
                setCanSendMessage(false);
                setSendBlockedReason('当前 LLM 配置不完整（缺少 Provider 或模型）。请前往 Settings 修复。');
                return;
            }

            setCanSendMessage(true);
            setSendBlockedReason(null);
        } catch (error) {
            console.error('[App] Failed to check LLM readiness:', error);
            setCanSendMessage(false);
            setSendBlockedReason('无法读取 LLM 配置。请前往 Settings 检查 Provider 与模型设置。');
        }
    }, [bridge]);

    const refreshPromptTemplates = useCallback(async () => {
        try {
            const rows = await bridge.getTrpcClient().prompts.getTemplates.query();
            setPromptTemplates((rows as Array<{ id: string; name: string; content: string }>) || []);
        } catch (error) {
            console.error('[App] Failed to load prompt templates:', error);
        }
    }, [bridge]);

    const refreshModelGroups = useCallback(async () => {
        try {
            const [allConfigs, activeConfig, customProvidersList] = await Promise.all([
                bridge.getAllLLMConfigs(),
                bridge.getActiveLLMConfig(),
                bridge.listCustomProviders().catch(() => [] as Array<{ id: string; name: string }>),
            ]);

            // Build a map of custom provider id → display name
            const customNameMap = new Map<string, string>(
                (customProvidersList).map((cp: { id: string; name: string }) => [cp.id, cp.name])
            );

            const configuredGroupsMap = new Map<string, Set<string>>();
            (allConfigs || []).forEach((config: any) => {
                const providerId = config?.providerId?.trim();
                const model = config?.model?.trim();
                if (!providerId || !model) {
                    return;
                }
                if (!configuredGroupsMap.has(providerId)) {
                    configuredGroupsMap.set(providerId, new Set<string>());
                }
                configuredGroupsMap.get(providerId)?.add(model);
            });

            const providerIds = Array.from(configuredGroupsMap.keys());
            const groups = await Promise.all(providerIds.map(async (providerId) => {
                const mergedModels = new Set(Array.from(configuredGroupsMap.get(providerId) || []));
                const isCustom = providerId.startsWith('custom:');

                if (!isCustom) {
                    try {
                        const models = await bridge.getTrpcClient().modelRegistry.getModels.query({ providerId });
                        (models as Array<{ id?: string; name?: string }>).forEach((item) => {
                            const raw = item?.id || item?.name;
                            if (!raw || typeof raw !== 'string') {
                                return;
                            }
                            const normalized = raw.startsWith(`${providerId}/`) ? raw.slice(providerId.length + 1) : raw;
                            if (normalized.trim()) {
                                mergedModels.add(normalized.trim());
                            }
                        });
                    } catch (error) {
                        console.warn(`[App] Failed to load models from registry for provider: ${providerId}`, error);
                    }
                }

                return {
                    providerId,
                    models: Array.from(mergedModels).sort((a, b) => a.localeCompare(b)),
                    displayName: customNameMap.get(providerId),
                };
            }));

            groups.sort((a, b) => a.providerId.localeCompare(b.providerId));

            setModelGroups(groups);
            setActiveModelId(
                activeConfig?.providerId && activeConfig?.model
                    ? `${activeConfig.providerId}:${activeConfig.model}`
                    : null,
            );
        } catch (error) {
            console.error('[App] Failed to load model groups:', error);
        }
    }, [bridge]);

    const refreshDraftCapabilities = useCallback(async () => {
        const projectPath = currentProjectId
            ? bridge.getProjects().find((project) => project.id === currentProjectId)?.path
            : undefined;

        try {
            const data = await bridge.getTrpcClient().sourceControl.getDraft.query({ projectPath });
            setDraftCapabilities(data as TopicCapabilities);
            return data as TopicCapabilities;
        } catch (error) {
            console.error('[App] Failed to load draft capabilities:', error);
            setDraftCapabilities(null);
            return null;
        }
    }, [bridge, currentProjectId]);

    /** Apply an agent's capability config to draft capabilities (source-level + item-level). */
    const applyAgentConfigToDraftCaps = useCallback((agent: AgentConfig, caps: TopicCapabilities | null) => {
        if (!caps) return;
        const enabledAppsSet = new Set(agent.enabledApps || []);
        const enabledMCPsSet = new Set(agent.enabledMCPs || []);
        const disabledToolsSet = new Set(agent.disabledMcpTools || []);
        const enabledSkillNames = new Set(Object.values(agent.enabledSkills || {}).flat());
        setDraftModelOverride(agent.modelId || null);
        setDraftPromptOverride(agent.prompt || '');
        setDraftCapabilities({
            ...caps,
            apps: {
                enabled: enabledAppsSet.size > 0,
                items: caps.apps.items.map((item) => ({ ...item, enabled: enabledAppsSet.has(item.name) })),
            },
            skill: {
                enabled: enabledSkillNames.size > 0,
                items: caps.skill.items.map((item) => ({ ...item, enabled: enabledSkillNames.has(item.name) })),
            },
            mcp: {
                enabled: enabledMCPsSet.size > 0,
                groups: caps.mcp.groups.map((group) => ({
                    ...group,
                    enabled: enabledMCPsSet.has(group.serverName),
                    items: group.items.map((item) => {
                        const canonicalKey = buildMcpToolItemKey(group.serverName, item.name);
                        const legacyScopedKey = `${group.serverName}::${item.name}`;
                        const legacyUnscopedKey = item.name;
                        const isDisabled = disabledToolsSet.has(item.key)
                            || disabledToolsSet.has(canonicalKey)
                            || disabledToolsSet.has(legacyScopedKey)
                            || disabledToolsSet.has(legacyUnscopedKey);
                        return { ...item, enabled: !isDisabled };
                    }),
                })),
            },
        });
    }, []);

    const refreshAgents = useCallback(async () => {
        try {
            const data = await bridge.getAgents();
            setAgents(data.list || []);
            setDraftAgentId(data.activeAgentId || null);
        } catch (error) {
            console.error('[App] Failed to load agents:', error);
        }
    }, [bridge]);

    // Helper: Time Ago
    const formatTimeAgo = (timestamp: number) => {
        if (!timestamp) return '';
        const diff = Date.now() - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    };

    // Connect
    useEffect(() => {
        const connectToServer = async () => {
            try {
                setConnecting(true);
                await bridge.connect();
                setConnected(true);
                await refreshLLMReadiness();
            } catch (error) {
                console.error('Failed to connect:', error);
                setConnected(false);
            } finally {
                setConnecting(false);
            }
        };
        connectToServer();
    }, [bridge, refreshLLMReadiness]);

    useEffect(() => {
        if (!settingsPanelOpen && connected) {
            void refreshLLMReadiness();
            void refreshPromptTemplates();
            void refreshModelGroups();
            // Load draft caps + agents, then apply agent config if active
            (async () => {
                const [freshCaps, agentData] = await Promise.all([
                    refreshDraftCapabilities(),
                    bridge.getAgents().catch(() => null),
                ]);
                if (agentData) {
                    setAgents(agentData.list || []);
                    setDraftAgentId(agentData.activeAgentId || null);
                    const activeAgent = agentData.activeAgentId
                        ? (agentData.list || []).find((a: AgentConfig) => a.id === agentData.activeAgentId)
                        : null;
                    if (activeAgent && freshCaps) {
                        applyAgentConfigToDraftCaps(activeAgent, freshCaps);
                    }
                }
            })();
        }
    }, [settingsPanelOpen, connected, refreshLLMReadiness, refreshPromptTemplates, refreshModelGroups, refreshDraftCapabilities, bridge, applyAgentConfigToDraftCaps]);

    // Subscribe
    useEffect(() => {
        const updateTopics = () => {
            const allTopics = bridge.getTopics();
            if (currentProjectId) {
                const filteredTopics = allTopics.filter(t => t.projectId === currentProjectId);
                setTopics(filteredTopics);

                const activeId = bridge.getActiveTopicId();
                if (activeId) {
                    const activeTopic = bridge.getTopic(activeId);
                    if (!activeTopic || activeTopic.projectId !== currentProjectId) {
                        setActiveTopicId(null);
                        setSelectedAgentId(null);
                        setMessages([]);
                        setTuiSnapshot('');
                        setAgentThinking('');
                        setAgentReasoning('');
                        setAgentState('IDLE');
                        setAgentPaused(false);
                        setDisplayAgentState('sleeping');
                        setViewMode('chat');
                    }
                }
            } else {
                setTopics([]);
                setActiveTopicId(null);
                setSelectedAgentId(null);
                setMessages([]);
                setTuiSnapshot('');
                setAgentThinking('');
                setAgentReasoning('');
                setAgentState('IDLE');
                setAgentPaused(false);
                setDisplayAgentState('sleeping');
                setViewMode('chat');
            }
        };

        const unsubscribe = bridge.subscribe((event: unknown) => {
            updateTopics();

            const active = bridge.getActiveTopicId();
            setActiveTopicId(active);
            if (active) {
                if (syncedAgentTopicIdRef.current !== active) {
                    setSelectedAgentId(bridge.getTopic(active)?.agentId || null);
                    syncedAgentTopicIdRef.current = active;
                }
                setMessages([...bridge.getMessages(active)]);
                setTuiSnapshot(bridge.getSnapshot(active));
                setAgentThinking(bridge.getAgentThinking(active));
                setAgentReasoning(bridge.getAgentReasoning(active));
                setAgentState(bridge.getAgentState(active));
                setAgentPaused(bridge.isAgentPaused(active));
                setDisplayAgentState(bridge.getDisplayAgentState(active));
            } else {
                syncedAgentTopicIdRef.current = null;
                setSelectedAgentId(null);
            }
        });

        // Initial update when dependency changes
        updateTopics();

        return unsubscribe;
    }, [bridge, currentProjectId]);

    useEffect(() => {
        if (viewMode !== 'tui' || !activeTopicId) return;
        void bridge.requestSnapshot(activeTopicId);
    }, [bridge, viewMode, activeTopicId]);

    useEffect(() => {
        if (viewMode !== 'tui') return;
        const preview = tuiSnapshot.length > 800 ? `${tuiSnapshot.slice(0, 800)}...` : tuiSnapshot;
        console.log('[TUI VIEW] snapshot length', tuiSnapshot.length);
        console.log('[TUI VIEW] snapshot preview', preview);
    }, [viewMode, tuiSnapshot]);

    // Actions
    const handleNewChat = useCallback(async () => {
        if (!currentProjectId) return;

        setViewMode('chat');
        setIsNewChat(true);
        bridge.clearActiveTopic();
        setActiveTopicId(null);
        setMessages([]);
        setTuiSnapshot('');
        setAgentThinking('');
        setAgentReasoning('');
        setDraftModelOverride(null);
        setDraftPromptOverride('');
        setSelectedAgentId(null);
        const activeAgent = agents.find(a => a.id === draftAgentId) || null;
        setDraftAgentId(activeAgent?.id || null);
        // Refresh draft capabilities, then re-apply agent config if active
        const freshCaps = await refreshDraftCapabilities();
        if (activeAgent && freshCaps) {
            applyAgentConfigToDraftCaps(activeAgent, freshCaps);
        }
    }, [currentProjectId, refreshDraftCapabilities, agents, draftAgentId, applyAgentConfigToDraftCaps, bridge]);

    const handleSelectTopic = useCallback((topicId: string) => {
        setIsNewChat(false);
        setDraftModelOverride(null);
        setDraftPromptOverride('');
        setSelectedAgentId(bridge.getTopic(topicId)?.agentId || null);
        bridge.setActiveTopic(topicId);
        setActiveTopicId(topicId);
        setMessages([...bridge.getMessages(topicId)]);
        setTuiSnapshot(bridge.getSnapshot(topicId));
        setAgentThinking(bridge.getAgentThinking(topicId));
        setAgentReasoning(bridge.getAgentReasoning(topicId));
        setViewMode('chat');
    }, [bridge]);

    const handleSendMessage = useCallback(async (content: string, attachments: ImageAttachment[] = []) => {
        if (!canSendMessage) {
            showToast(sendBlockedReason || 'Please complete the LLM provider and model setup first.');
            setSettingsPanelOpen(true);
            return;
        }

        let currentTopicId = activeTopicId;

        // [UX Improvement] Implicitly create session if none exists
        if (!currentTopicId) {
            const title = content.length > 50 ? content.slice(0, 50) + '...' : content;
            const sourceControls = draftCapabilities
                ? {
                    apps: {
                        enabled: draftCapabilities.apps.enabled,
                        disabledItems: draftCapabilities.apps.items.filter((item) => !item.enabled).map((item) => item.name),
                    },
                    mcp: {
                        enabled: draftCapabilities.mcp.enabled,
                        disabledItems: [
                            ...draftCapabilities.mcp.groups.filter((group) => !group.enabled).map((group) => group.key),
                            ...draftCapabilities.mcp.groups.flatMap((group) => group.items.filter((item) => !item.enabled).map((item) => item.key)),
                        ],
                    },
                    skill: {
                        enabled: draftCapabilities.skill.enabled,
                        disabledItems: draftCapabilities.skill.items.filter((item) => !item.enabled).map((item) => item.name),
                    },
                }
                : undefined;

            const newTopic = await bridge.createTopic(
                title,
                currentProjectId || undefined,
                {
                    modelOverride: draftModelOverride || undefined,
                    promptOverride: draftPromptOverride || undefined,
                    agentId: draftAgentId || undefined,
                    sourceControls,
                }
            );
            if (newTopic) {
                currentTopicId = newTopic.id;
                setActiveTopicId(currentTopicId);
                setSelectedAgentId(draftAgentId);
                setIsNewChat(false);
            } else {
                return;
            }
        }

        if (!currentTopicId) return;
        setAgentThinking('');
        setAgentReasoning('');
        try {
            await bridge.sendMessage(currentTopicId, content, attachments);
        } catch (error) {
            const raw = error instanceof Error ? error.message : String(error);
            const message = raw.includes('API key') || raw.includes('provider') || raw.includes('model')
                ? `LLM Provider 配置异常：${raw}。请前往 Settings 修复后重试。`
                : `发送失败：${raw}`;
            showToast(message);
            setSettingsPanelOpen(true);
            await refreshLLMReadiness();
        }
    }, [bridge, activeTopicId, currentProjectId, canSendMessage, sendBlockedReason, showToast, refreshLLMReadiness, draftCapabilities, draftModelOverride, draftPromptOverride, draftAgentId]);

    const handlePauseAgent = useCallback(() => {
        if (activeTopicId) bridge.pauseAgent(activeTopicId);
    }, [bridge, activeTopicId]);

    const handleResumeAgent = useCallback(() => {
        if (activeTopicId) bridge.resumeAgent(activeTopicId);
    }, [bridge, activeTopicId]);

    const handleDeleteTopicById = useCallback(async (topicId: string) => {
        await bridge.destroyDesktop(topicId);
        await bridge.deleteTopic(topicId);

        if (topicId === activeTopicId) {
            bridge.clearActiveTopic();
            setActiveTopicId(null);
            setSelectedAgentId(null);
            setMessages([]);
            setTuiSnapshot('');
            setAgentThinking('');
            setAgentReasoning('');
            setViewMode('chat');
        }
    }, [bridge, activeTopicId]);

    const handleRenameTopicById = useCallback(async (topicId: string, newTitle: string) => {
        await bridge.renameTopic(topicId, newTitle);
    }, [bridge]);

    const refreshTopicCapabilities = useCallback(async (topicId: string) => {
        const projectPath = currentProjectId
            ? bridge.getProjects().find((project) => project.id === currentProjectId)?.path
            : undefined;

        try {
            const data = await bridge.getTrpcClient().sourceControl.getTopic.query({
                id: topicId,
                projectPath,
            });
            const typed = data as TopicCapabilities;
            setTopicCapabilities(typed);
            setTopicModelOverride(typed.modelOverride || null);
            setTopicPromptOverride(typed.promptOverride || '');
        } catch (error) {
            console.error('[App] Failed to load topic capabilities:', error);
            setTopicCapabilities(null);
        }
    }, [bridge, currentProjectId]);

    useEffect(() => {
        if (!activeTopicId) {
            setTopicCapabilities(null);
            setTopicModelOverride(null);
            setTopicPromptOverride('');
            void refreshDraftCapabilities();
            return;
        }
        setDraftModelOverride(null);
        setDraftPromptOverride('');
        void refreshTopicCapabilities(activeTopicId);
    }, [activeTopicId, refreshTopicCapabilities, refreshDraftCapabilities]);

    const handleToggleCapabilityGroup = useCallback(async (source: 'apps' | 'mcp' | 'skill', enabled: boolean) => {
        if (!activeTopicId) {
            setDraftCapabilities((prev) => {
                if (!prev) return prev;
                if (source === 'apps') return { ...prev, apps: { ...prev.apps, enabled } };
                if (source === 'mcp') return { ...prev, mcp: { ...prev.mcp, enabled } };
                return { ...prev, skill: { ...prev.skill, enabled } };
            });
            return;
        }
        try {
            await bridge.getTrpcClient().sourceControl.setSourceEnabled.mutate({
                id: activeTopicId,
                source,
                enabled,
            });
            await refreshTopicCapabilities(activeTopicId);
        } catch (error) {
            console.error('[App] Failed to toggle capability group:', error);
        }
    }, [bridge, activeTopicId, refreshTopicCapabilities]);

    const handleToggleCapabilityItem = useCallback(async (source: 'apps' | 'mcp' | 'skill', itemName: string, enabled: boolean) => {
        if (!activeTopicId) {
            setDraftCapabilities((prev) => {
                if (!prev) return prev;
                if (source === 'apps') {
                    return {
                        ...prev,
                        apps: {
                            ...prev.apps,
                            items: prev.apps.items.map((item) => item.name === itemName ? { ...item, enabled } : item),
                        },
                    };
                }
                if (source === 'skill') {
                    return {
                        ...prev,
                        skill: {
                            ...prev.skill,
                            items: prev.skill.items.map((item) => item.name === itemName ? { ...item, enabled } : item),
                        },
                    };
                }
                return {
                    ...prev,
                    mcp: {
                        ...prev.mcp,
                        groups: prev.mcp.groups.map((group) => {
                            if (group.key === itemName) {
                                return { ...group, enabled };
                            }
                            return {
                                ...group,
                                items: group.items.map((item) => item.key === itemName ? { ...item, enabled } : item),
                            };
                        }),
                    },
                };
            });
            return;
        }
        try {
            await bridge.getTrpcClient().sourceControl.setItemEnabled.mutate({
                id: activeTopicId,
                source,
                itemName,
                enabled,
            });
            await refreshTopicCapabilities(activeTopicId);
        } catch (error) {
            console.error('[App] Failed to toggle capability item:', error);
        }
    }, [bridge, activeTopicId, refreshTopicCapabilities]);

    const handleSelectTopicModel = useCallback(async (modelId: string) => {
        if (!activeTopicId) {
            setDraftModelOverride(modelId);
            return;
        }
        setTopicModelOverride(modelId);
        try {
            await bridge.getTrpcClient().db.updateTopicConfig.mutate({ id: activeTopicId, modelOverride: modelId });
            bridge.patchTopic(activeTopicId, { modelOverride: modelId });
        } catch (error) {
            console.error('[App] Failed to persist topic model override:', error);
        }
    }, [activeTopicId, bridge]);

    const handleChangeTopicPrompt = useCallback(async (prompt: string) => {
        if (!activeTopicId) {
            setDraftPromptOverride(prompt);
            return;
        }
        setTopicPromptOverride(prompt);
        try {
            await bridge.getTrpcClient().db.updateTopicConfig.mutate({ id: activeTopicId, promptOverride: prompt });
            bridge.patchTopic(activeTopicId, { promptOverride: prompt });
        } catch (error) {
            console.error('[App] Failed to persist topic prompt override:', error);
        }
    }, [activeTopicId, bridge]);

    const handleSelectAgent = useCallback(async (agentId: string | null) => {
        const agent = agentId ? agents.find(a => a.id === agentId) : null;

        if (!activeTopicId) {
            // ── Draft path: update local draft state ──
            setDraftAgentId(agentId);
            setSelectedAgentId(null);
            if (agent) {
                // Use the shared helper that sets source-level enabled + item-level
                applyAgentConfigToDraftCaps(agent, draftCapabilities);
            } else {
                // No agent selected — reset overrides, restore defaults
                setDraftModelOverride(null);
                setDraftPromptOverride('');
                void refreshDraftCapabilities();
            }
            return;
        }

        // ── Active topic path: persist via tRPC ──
        try {
            const trpc = bridge.getTrpcClient();
            // 1. Model + prompt + agentId
            await trpc.db.updateTopicConfig.mutate({
                id: activeTopicId,
                agentId: agentId || undefined,
                modelOverride: agent?.modelId || undefined,
                promptOverride: agent?.prompt ?? undefined,
            });
            setSelectedAgentId(agentId);
            bridge.patchTopic(activeTopicId, {
                agentId: agentId || undefined,
                modelOverride: agent?.modelId || undefined,
                promptOverride: agent?.prompt ?? undefined,
            });

            if (agent) {
                // 2. Source-level toggles: enable/disable each driven source
                const enabledAppsSet = new Set(agent.enabledApps || []);
                const enabledSkillNames = new Set(Object.values(agent.enabledSkills || {}).flat());
                const enabledMCPsSet = new Set(agent.enabledMCPs || []);
                const disabledToolsSet = new Set(agent.disabledMcpTools || []);

                await trpc.sourceControl.setSourceEnabled.mutate({ id: activeTopicId, source: 'apps', enabled: enabledAppsSet.size > 0 });
                await trpc.sourceControl.setSourceEnabled.mutate({ id: activeTopicId, source: 'skill', enabled: enabledSkillNames.size > 0 });
                await trpc.sourceControl.setSourceEnabled.mutate({ id: activeTopicId, source: 'mcp', enabled: enabledMCPsSet.size > 0 });

                // 3. Item-level toggles
                const currentCaps = topicCapabilities;
                if (currentCaps) {
                    for (const item of currentCaps.apps.items) {
                        const shouldEnable = enabledAppsSet.has(item.name);
                        if (item.enabled !== shouldEnable) {
                            await trpc.sourceControl.setItemEnabled.mutate({
                                id: activeTopicId, source: 'apps', itemName: item.name, enabled: shouldEnable,
                            });
                        }
                    }
                    for (const item of currentCaps.skill.items) {
                        const shouldEnable = enabledSkillNames.has(item.name);
                        if (item.enabled !== shouldEnable) {
                            await trpc.sourceControl.setItemEnabled.mutate({
                                id: activeTopicId, source: 'skill', itemName: item.name, enabled: shouldEnable,
                            });
                        }
                    }
                    for (const group of currentCaps.mcp.groups) {
                        const serverShouldEnable = enabledMCPsSet.has(group.serverName);
                        if (group.enabled !== serverShouldEnable) {
                            await trpc.sourceControl.setItemEnabled.mutate({
                                id: activeTopicId, source: 'mcp', itemName: group.key, enabled: serverShouldEnable,
                            });
                        }
                        for (const item of group.items) {
                            const canonicalKey = buildMcpToolItemKey(group.serverName, item.name);
                            const legacyScopedKey = `${group.serverName}::${item.name}`;
                            const legacyUnscopedKey = item.name;
                            const toolShouldEnable = !(
                                disabledToolsSet.has(item.key)
                                || disabledToolsSet.has(canonicalKey)
                                || disabledToolsSet.has(legacyScopedKey)
                                || disabledToolsSet.has(legacyUnscopedKey)
                            );
                            if (item.enabled !== toolShouldEnable) {
                                await trpc.sourceControl.setItemEnabled.mutate({
                                    id: activeTopicId, source: 'mcp', itemName: item.key, enabled: toolShouldEnable,
                                });
                            }
                        }
                    }
                }
                // Refresh capabilities after batch updates
                await refreshTopicCapabilities(activeTopicId);
            }
        } catch (error) {
            console.error('[App] Failed to apply agent config:', error);
        }
    }, [activeTopicId, bridge, agents, topicCapabilities, draftCapabilities, refreshTopicCapabilities, refreshDraftCapabilities, applyAgentConfigToDraftCaps]);

    const handleApplyPromptTemplate = useCallback((templateId: string) => {
        const template = promptTemplates.find((item) => item.id === templateId);
        if (!template) return;
        void handleChangeTopicPrompt(template.content);
    }, [promptTemplates, handleChangeTopicPrompt]);

    const handleDeleteTopic = useCallback(async () => {
        if (!activeTopicId) return;
        await bridge.destroyDesktop(activeTopicId);
        await bridge.deleteTopic(activeTopicId);
        setActiveTopicId(null);
        setMessages([]);
        setTuiSnapshot('');
        setShowDeleteConfirm(false);
    }, [bridge, activeTopicId]);

    const activeTopic = (activeTopicId && bridge.getTopic(activeTopicId)) || null;
    const currentProject: Project | null = currentProjectId
        ? bridge.getProjects().find((project) => project.id === currentProjectId) ?? null
        : null;

    if (connecting) return <ConnectionScreen status="connecting" />;
    if (!connected) return <ConnectionScreen status="error" onRetry={() => window.location.reload()} />;

    if (!currentProjectId) {
        return (
            <>
                <ProjectSelector
                    onSelectProject={(projectId) => {
                        setSettingsPanelOpen(false);
                        setActiveTopicId(null);
                        setMessages([]);
                        setTuiSnapshot('');
                        setAgentThinking('');
                        setAgentReasoning('');
                        setAgentState('IDLE');
                        setAgentPaused(false);
                        setDisplayAgentState('sleeping');
                        setViewMode('chat');
                        setCurrentProjectId(projectId);
                    }}
                    theme={theme}
                    toggleTheme={toggleTheme}
                    onOpenSettings={openSettings}
                />
                <SettingsPanel
                    isOpen={settingsPanelOpen}
                    onClose={closeSettings}
                    theme={theme}
                    onThemeChange={setTheme}
                    currentProjectPath={null}
                    initialTab={settingsInitialTab}
                />
            </>
        );
    }

    return (
        <div className="w-screen h-screen bg-[var(--mat-base)] rounded-[24px] overflow-hidden text-[var(--color-text-primary)] font-system selection:bg-[var(--color-accent)] selection:text-white relative flex box-border">
            {/* Background Layers */}

            {/* Window Drag Regions (segmented to avoid pills) */}
            <div className={`fixed top-0 left-0 h-10 title-drag-region z-10 ${sidebarOpen ? 'w-[280px]' : 'w-[56px]'}`} />
            <div className={`fixed top-0 h-10 title-drag-region z-10 ${sidebarOpen ? 'left-[700px]' : 'left-[540px]'} right-[140px]`} />
            <div className="fixed top-0 right-0 w-3 h-10 title-drag-region z-10" />

            {/* ======== Area 1: Sidebar (Layer 2) ======== */}
            <Sidebar
                sidebarOpen={sidebarOpen}
                topics={topics}
                activeTopicId={activeTopicId}
                showDraftCurrent={isNewChat && !activeTopicId}
                currentProjectPath={currentProject?.path ?? null}
                theme={theme}
                onNewChat={handleNewChat}
                onSelectTopic={handleSelectTopic}
                toggleTheme={toggleTheme}
                onSwitchProject={() => {
                    setCurrentProjectId(null);
                    setActiveTopicId(null);
                    setMessages([]);
                    setTuiSnapshot('');
                    setAgentThinking('');
                    setAgentReasoning('');
                    setAgentState('IDLE');
                    setAgentPaused(false);
                    setDisplayAgentState('sleeping');
                    setViewMode('chat');
                }}
                onOpenSettings={openSettings}
                getTopicState={(topicId) => bridge.getAgentState(topicId)}
                getTopicPaused={(topicId) => bridge.isAgentPaused(topicId)}
            />

            {/* ======== Area 2: Main Workspace (Layer 1) ======== */}
            <div className="flex-1 flex flex-col min-w-0 h-full relative">
                {/* Area 2.1: Header (Layer 2 Islands) */}
                <WorkspaceHeader
                    activeTopic={activeTopic}
                    emptyTitle={'What’s on your mind today?'}
                    connected={connected}
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    onDeleteActiveTopic={() => setShowDeleteConfirm(true)}
                    onRenameActiveTopic={(title) => {
                        if (activeTopicId) void handleRenameTopicById(activeTopicId, title);
                    }}
                />

                {/* Area 2.2: Content (Chat / TUI) */}
                <main className="flex-1 overflow-hidden relative flex flex-col">
                    <div className="flex-1 overflow-hidden relative">
                        {viewMode === 'chat' ? (
                            <ChatArea
                                messages={messages}
                                agentThinking={agentThinking}
                                agentReasoning={agentReasoning}
                                onSendMessage={handleSendMessage}
                                canSendMessage={canSendMessage}
                                sendBlockedReason={sendBlockedReason}
                                onOpenSettings={openSettings}
                                displayAgentState={displayAgentState}
                                onPauseAgent={handlePauseAgent}
                                onResumeAgent={handleResumeAgent}
                                topicCapabilities={activeTopicId ? topicCapabilities : draftCapabilities}
                                onToggleCapabilityGroup={handleToggleCapabilityGroup}
                                onToggleCapabilityItem={handleToggleCapabilityItem}
                                capabilityHint="Temporary overrides for current topic only."
                                modelGroups={modelGroups}
                                selectedModel={(activeTopicId ? topicModelOverride : draftModelOverride) || activeModelId}
                                onSelectModel={handleSelectTopicModel}
                                promptTemplates={promptTemplates}
                                topicPrompt={activeTopicId ? topicPromptOverride : draftPromptOverride}
                                onChangeTopicPrompt={handleChangeTopicPrompt}
                                onApplyPromptTemplate={handleApplyPromptTemplate}
                                agents={agents}
                                selectedAgentId={activeTopicId ? selectedAgentId : draftAgentId}
                                onSelectAgent={handleSelectAgent}
                            />
                        ) : (
                            <div className="absolute inset-0 rounded-2xl overflow-hidden border border-transparent">
                                <TuiDesktopViewer
                                    snapshot={tuiSnapshot}
                                    agentThinking={agentThinking}
                                />
                            </div>
                        )}
                    </div>
                </main>
            </div>

            <Toast message={toastMessage} />

            <DeleteConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteTopic}
            />

            <SettingsPanel
                isOpen={settingsPanelOpen}
                onClose={closeSettings}
                theme={theme}
                onThemeChange={setTheme}
                currentProjectPath={currentProject?.path ?? null}
                initialTab={settingsInitialTab}
            />
        </div>
    );
}
