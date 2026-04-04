export type TerminalStatus = 'idle' | 'running' | 'closed';

export type CommandStatus = 'running' | 'success' | 'failed';

export interface CommandRecord {
    id: string;
    command: string;
    status: CommandStatus;
    startedAt: string;
    finishedAt?: string;
    exitCode?: number;
    outputLines: string[];
}

export interface TerminalSession {
    id: string;
    cwd: string;
    status: TerminalStatus;
    createdAt: string;
    commands: CommandRecord[];
    activeCommandId?: string;
    outputTail: number;
}
