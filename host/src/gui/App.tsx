/**
 * system-chat GUI - Main App Component
 * Immersive Dark Tech Style: Glassmorphism + FUI + Subdued Colors
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useChatBridge } from './ChatBridge.js';
import { TuiDesktopViewer } from './components/TuiDesktopViewer.js';
import type { Topic, Message, Project } from '../types.js';

// Components
import { ProjectSelector } from './components/ProjectSelector.js';
import { ConnectionScreen } from './components/ConnectionScreen.js';
import { Sidebar } from './components/Sidebar.js';
import { WorkspaceHeader } from './components/WorkspaceHeader.js';
import { ChatArea } from './components/ChatArea.js';
import { DeleteConfirmModal } from './components/DeleteConfirmModal.js';
import { Toast } from './components/Toast.js';
import { SettingsPanel } from './components/settings/SettingsPanel.js';

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
        items: Array<{ name: string; enabled: boolean }>;
    };
    apps: Array<{ name: string; enabled: boolean }>;
};

export function App() {
    const bridge = useChatBridge();

    // UI State
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('chat');
    const [isNewChat, setIsNewChat] = useState(false);
    const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);

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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [canSendMessage, setCanSendMessage] = useState(false);
    const [sendBlockedReason, setSendBlockedReason] = useState<string | null>(null);
    const [topicCapabilities, setTopicCapabilities] = useState<TopicCapabilities | null>(null);

    // Init Theme
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.className = theme;
        localStorage.setItem('aotui-theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const openSettings = () => {
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
        }
    }, [settingsPanelOpen, connected, refreshLLMReadiness]);

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
                setMessages([...bridge.getMessages(active)]);
                setTuiSnapshot(bridge.getSnapshot(active));
                setAgentThinking(bridge.getAgentThinking(active));
                setAgentReasoning(bridge.getAgentReasoning(active));
                setAgentState(bridge.getAgentState(active));
                setAgentPaused(bridge.isAgentPaused(active));
                setDisplayAgentState(bridge.getDisplayAgentState(active));
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
    const handleNewChat = useCallback(() => {
        if (!currentProjectId) return;
        setActiveTopicId(null);
        setIsNewChat(true);
        setMessages([]);
        setTuiSnapshot('');
        setAgentThinking('');
        setAgentReasoning('');
        setViewMode('chat');
    }, [currentProjectId]);

    const handleSelectTopic = useCallback((topicId: string) => {
        setIsNewChat(false);
        bridge.setActiveTopic(topicId);
        setActiveTopicId(topicId);
        setMessages([...bridge.getMessages(topicId)]);
        setTuiSnapshot(bridge.getSnapshot(topicId));
        setAgentThinking(bridge.getAgentThinking(topicId));
        setAgentReasoning(bridge.getAgentReasoning(topicId));
        setViewMode('chat');
    }, [bridge]);

    const handleSendMessage = useCallback(async (content: string) => {
        if (!canSendMessage) {
            showToast(sendBlockedReason || 'Please complete the LLM provider and model setup first.');
            setSettingsPanelOpen(true);
            return;
        }

        let currentTopicId = activeTopicId;

        // [UX Improvement] Implicitly create session if none exists
        if (!currentTopicId) {
            const title = content.length > 50 ? content.slice(0, 50) + '...' : content;
            const newTopic = await bridge.createTopic(title, currentProjectId || undefined);
            if (newTopic) {
                currentTopicId = newTopic.id;
                setActiveTopicId(currentTopicId);
                bridge.setActiveTopic(currentTopicId);
                setIsNewChat(false);
            } else {
                return;
            }
        }

        if (!currentTopicId) return;
        setAgentThinking('');
        setAgentReasoning('');
        try {
            await bridge.sendMessage(currentTopicId, content);
        } catch (error) {
            const raw = error instanceof Error ? error.message : String(error);
            const message = raw.includes('API key') || raw.includes('provider') || raw.includes('model')
                ? `LLM Provider 配置异常：${raw}。请前往 Settings 修复后重试。`
                : `发送失败：${raw}`;
            showToast(message);
            setSettingsPanelOpen(true);
            await refreshLLMReadiness();
        }
    }, [bridge, activeTopicId, currentProjectId, canSendMessage, sendBlockedReason, showToast, refreshLLMReadiness]);

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
            setActiveTopicId(null);
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
            setTopicCapabilities(data as TopicCapabilities);
        } catch (error) {
            console.error('[App] Failed to load topic capabilities:', error);
            setTopicCapabilities(null);
        }
    }, [bridge, currentProjectId]);

    useEffect(() => {
        if (!activeTopicId) {
            setTopicCapabilities(null);
            return;
        }
        void refreshTopicCapabilities(activeTopicId);
    }, [activeTopicId, refreshTopicCapabilities]);

    const handleToggleCapabilityGroup = useCallback(async (source: 'mcp' | 'skill', enabled: boolean) => {
        if (!activeTopicId) return;
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

    const handleToggleCapabilityItem = useCallback(async (source: 'mcp' | 'skill', itemName: string, enabled: boolean) => {
        if (!activeTopicId) return;
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

    const handleToggleApp = useCallback(async (name: string, enabled: boolean) => {
        try {
            await bridge.getTrpcClient().apps.setEnabled.mutate({ name, enabled });
            if (activeTopicId) await refreshTopicCapabilities(activeTopicId);
        } catch (error) {
            console.error('[App] Failed to toggle app:', error);
        }
    }, [bridge, activeTopicId, refreshTopicCapabilities]);

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
                                topicCapabilities={topicCapabilities}
                                onToggleCapabilityGroup={handleToggleCapabilityGroup}
                                onToggleCapabilityItem={handleToggleCapabilityItem}
                                onToggleApp={handleToggleApp}
                                capabilityHint="Temporary overrides for current topic only."
                            />
                        ) : (
                            <div className="absolute inset-0 bg-[var(--color-bg-base)] rounded-2xl overflow-hidden border border-[var(--mat-border)]">
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
            />
        </div>
    );
}
