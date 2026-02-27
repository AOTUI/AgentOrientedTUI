import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockRef = vi.hoisted(() => ({
    bridge: null as any,
}));

function createMockBridge() {
    const state = {
        activeTopicId: null as string | null,
        topics: new Map<string, any>([
            ['topic_legacy', {
                id: 'topic_legacy',
                title: 'Legacy Topic',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                status: 'hot',
                projectId: 'p1',
            }],
        ]),
    };

    const trpc = {
        prompts: { getTemplates: { query: vi.fn().mockResolvedValue([]) } },
        modelRegistry: { getModels: { query: vi.fn().mockResolvedValue([]) } },
        sourceControl: {
            getDraft: {
                query: vi.fn().mockResolvedValue({
                    apps: { enabled: true, items: [] },
                    mcp: { enabled: true, groups: [] },
                    skill: { enabled: true, items: [] },
                }),
            },
            getTopic: {
                query: vi.fn().mockResolvedValue({
                    apps: { enabled: true, items: [] },
                    mcp: { enabled: true, groups: [] },
                    skill: { enabled: true, items: [] },
                }),
            },
            setSourceEnabled: { mutate: vi.fn().mockResolvedValue(undefined) },
            setItemEnabled: { mutate: vi.fn().mockResolvedValue(undefined) },
        },
        db: {
            updateTopicConfig: { mutate: vi.fn().mockResolvedValue(undefined) },
        },
    };

    return {
        connect: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockImplementation(() => () => { }),
        getTrpcClient: vi.fn().mockReturnValue(trpc),
        getAllLLMConfigs: vi.fn().mockResolvedValue([
            { id: 'cfg1', providerId: 'openai', model: 'gpt-4.1' },
        ]),
        getActiveLLMConfig: vi.fn().mockResolvedValue({ id: 'cfg1', providerId: 'openai', model: 'gpt-4.1' }),
        listCustomProviders: vi.fn().mockResolvedValue([]),
        getProjects: vi.fn().mockReturnValue([
            { id: 'p1', path: '/tmp/p1', name: 'P1', createdAt: Date.now() },
        ]),
        getTopics: vi.fn().mockImplementation(() => Array.from(state.topics.values())),
        getActiveTopicId: vi.fn().mockImplementation(() => state.activeTopicId),
        getTopic: vi.fn().mockImplementation((id: string) => state.topics.get(id)),
        setActiveTopic: vi.fn().mockImplementation((id: string) => {
            state.activeTopicId = id;
            return Promise.resolve();
        }),
        clearActiveTopic: vi.fn().mockImplementation(() => {
            state.activeTopicId = null;
        }),
        getMessages: vi.fn().mockReturnValue([]),
        getSnapshot: vi.fn().mockReturnValue(''),
        getAgentThinking: vi.fn().mockReturnValue(''),
        getAgentReasoning: vi.fn().mockReturnValue(''),
        getAgentState: vi.fn().mockReturnValue('IDLE'),
        isAgentPaused: vi.fn().mockReturnValue(false),
        getDisplayAgentState: vi.fn().mockReturnValue('sleeping'),
        requestSnapshot: vi.fn().mockResolvedValue(undefined),
        pauseAgent: vi.fn(),
        resumeAgent: vi.fn(),
        destroyDesktop: vi.fn().mockResolvedValue(undefined),
        deleteTopic: vi.fn().mockResolvedValue(undefined),
        renameTopic: vi.fn().mockResolvedValue(undefined),
        getAgents: vi.fn().mockResolvedValue({
            list: [
                {
                    id: 'agent_1',
                    name: 'Agent One',
                    prompt: '',
                    modelId: 'openai:gpt-4.1',
                    enabledApps: [],
                    enabledSkills: {},
                    enabledMCPs: [],
                    disabledMcpTools: [],
                    skin: {},
                },
                {
                    id: 'agent_2',
                    name: 'Agent Two',
                    prompt: '',
                    modelId: 'openai:gpt-4.1-mini',
                    enabledApps: [],
                    enabledSkills: {},
                    enabledMCPs: [],
                    disabledMcpTools: [],
                    skin: {},
                },
            ],
            activeAgentId: 'agent_1',
        }),
        createTopic: vi.fn().mockImplementation((title: string, projectId?: string, options?: any) => {
            const topic = {
                id: 'topic_new',
                title,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                status: 'hot',
                projectId,
                agentId: options?.agentId,
            };
            state.topics.set(topic.id, topic);
            state.activeTopicId = topic.id;
            return Promise.resolve(topic);
        }),
        sendMessage: vi.fn().mockResolvedValue(undefined),
    };
}

vi.mock('../../src/gui/ChatBridge.js', () => ({
    useChatBridge: () => mockRef.bridge,
}));

vi.mock('../../src/gui/components/ProjectSelector.js', () => ({
    ProjectSelector: ({ onSelectProject }: any) => (
        <button data-testid="select-project" onClick={() => onSelectProject('p1')}>Select Project</button>
    ),
}));

vi.mock('../../src/gui/components/Sidebar.js', () => ({
    Sidebar: ({ onNewChat, onSelectTopic }: any) => (
        <div>
            <button data-testid="open-legacy-topic" onClick={() => onSelectTopic('topic_legacy')}>Open Legacy</button>
            <button data-testid="new-session" onClick={onNewChat}>New Session</button>
        </div>
    ),
}));

vi.mock('../../src/gui/components/ChatArea.js', () => ({
    ChatArea: ({ agents = [], selectedAgentId = null, onSelectAgent, onSendMessage }: any) => {
        const currentName = agents.find((a: any) => a.id === selectedAgentId)?.name || 'No Agent';
        return (
            <div>
                <div data-testid="agent-pill">{currentName}</div>
                <button data-testid="select-agent-2" onClick={() => onSelectAgent?.('agent_2')}>Select Agent Two</button>
                <button data-testid="send-message" onClick={() => onSendMessage?.('hello')}>Send</button>
            </div>
        );
    },
}));

vi.mock('../../src/gui/components/WorkspaceHeader.js', () => ({ WorkspaceHeader: () => <div data-testid="workspace-header" /> }));
vi.mock('../../src/gui/components/ConnectionScreen.js', () => ({ ConnectionScreen: () => <div data-testid="connection-screen" /> }));
vi.mock('../../src/gui/components/TuiDesktopViewer.js', () => ({ TuiDesktopViewer: () => <div data-testid="tui-viewer" /> }));
vi.mock('../../src/gui/components/DeleteConfirmModal.js', () => ({ DeleteConfirmModal: () => null }));
vi.mock('../../src/gui/components/Toast.js', () => ({ Toast: () => null }));
vi.mock('../../src/gui/components/settings/SettingsPanel.js', () => ({ SettingsPanel: () => null }));

import { App } from '../../src/gui/App.js';

describe('App agent flow around New Session', () => {
    beforeEach(() => {
        mockRef.bridge = createMockBridge();
    });

    it('updates agent pill immediately before first send and persists selected agent into createTopic', async () => {
        render(<App />);

        await waitFor(() => expect(screen.getByTestId('select-project')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('select-project'));

        await waitFor(() => expect(screen.getByTestId('open-legacy-topic')).toBeInTheDocument());

        fireEvent.click(screen.getByTestId('open-legacy-topic'));
        await waitFor(() => expect(screen.getByTestId('agent-pill')).toHaveTextContent('No Agent'));

        fireEvent.click(screen.getByTestId('new-session'));
        await waitFor(() => expect(screen.getByTestId('agent-pill')).toHaveTextContent('Agent One'));

        fireEvent.click(screen.getByTestId('select-agent-2'));
        await waitFor(() => expect(screen.getByTestId('agent-pill')).toHaveTextContent('Agent Two'));

        fireEvent.click(screen.getByTestId('send-message'));
        await waitFor(() => expect(mockRef.bridge.createTopic).toHaveBeenCalled());

        const createTopicArgs = (mockRef.bridge.createTopic as any).mock.calls.at(-1);
        expect(createTopicArgs?.[2]?.agentId).toBe('agent_2');
    });
});
