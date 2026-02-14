import { createTUIApp, View, useCallback, useEffect, useMemo, useRef, useState, useAppEnv } from '@aotui/sdk';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { RootView } from './RootView.js';
import { TerminalConsoleView } from './TerminalConsoleView.js';
import { TerminalView } from './TerminalView.js';
import type { TerminalSession, CommandRecord, CommandStatus } from '../types.js';
import {
    DEFAULT_TAIL_LINES,
    hasChainedCd,
    isPathWithinProject,
    parseCdCommand,
    resolveNextCwd,
    splitLines
} from '../core/terminal-utils.js';

function createCommand(commandId: string, command: string): CommandRecord {
    return {
        id: commandId,
        command,
        status: 'running',
        startedAt: new Date().toISOString(),
        outputLines: []
    };
}

function TerminalRoot() {
    const envProjectPath = useAppEnv<string>('projectPath');
    const projectPath = useMemo(() => envProjectPath ?? process.cwd(), [envProjectPath]);
    const [terminals, setTerminals] = useState<TerminalSession[]>([]);
    const terminalsRef = useRef<TerminalSession[]>([]);
    const terminalCounter = useRef(0);
    const commandCounter = useRef(0);
    const processMap = useRef(new Map<string, ChildProcessWithoutNullStreams>());

    useEffect(() => {
        terminalsRef.current = terminals;
    }, [terminals]);

    const updateTerminal = useCallback((terminalId: string, updater: (terminal: TerminalSession) => TerminalSession) => {
        setTerminals((prev: TerminalSession[]) =>
            prev.map((terminal: TerminalSession) => (terminal.id === terminalId ? updater(terminal) : terminal))
        );
    }, []);

    const addTerminal = useCallback((initialPath?: string) => {
        const terminalId = `terminal_${terminalCounter.current++}`;
        const nextCwd = resolveNextCwd(projectPath, projectPath, initialPath);
        const safeCwd = isPathWithinProject(projectPath, nextCwd) ? nextCwd : projectPath;
        const terminal: TerminalSession = {
            id: terminalId,
            cwd: safeCwd,
            status: 'idle',
            createdAt: new Date().toISOString(),
            commands: [],
            outputTail: DEFAULT_TAIL_LINES
        };
        setTerminals((prev: TerminalSession[]) => {
            const next = [...prev, terminal];
            terminalsRef.current = next;
            return next;
        });
        return terminal;
    }, [projectPath]);

    const closeTerminal = useCallback((terminalId: string) => {
        const target = terminalsRef.current.find((terminal: TerminalSession) => terminal.id === terminalId);
        if (!target) {
            return false;
        }
        if (target.activeCommandId) {
            const proc = processMap.current.get(target.activeCommandId);
            if (proc) {
                proc.kill();
                processMap.current.delete(target.activeCommandId);
            }
        }
        setTerminals((prev: TerminalSession[]) =>
            prev.filter((terminal: TerminalSession) => terminal.id !== terminalId)
        );
        return true;
    }, []);

    const setOutputTail = useCallback((terminalId: string, tailLines: number) => {
        const normalized = Number.isFinite(tailLines) ? Math.max(1, Math.floor(tailLines)) : DEFAULT_TAIL_LINES;
        const target = terminalsRef.current.find((terminal: TerminalSession) => terminal.id === terminalId);
        if (!target) {
            return false;
        }
        updateTerminal(terminalId, (terminal: TerminalSession) => ({ ...terminal, outputTail: normalized }));
        return true;
    }, [updateTerminal]);

    const updateCommandOutput = useCallback((terminalId: string, commandId: string, lines: string[]) => {
        if (lines.length === 0) {
            return;
        }
        updateTerminal(terminalId, (terminal: TerminalSession) => {
            const nextCommands = terminal.commands.map((command: CommandRecord) => {
                if (command.id !== commandId) {
                    return command;
                }
                return { ...command, outputLines: [...command.outputLines, ...lines] };
            });
            return { ...terminal, commands: nextCommands };
        });
    }, [updateTerminal]);

    const sendCommand = useCallback(async (terminalId: string, command: string, terminalSnapshot?: TerminalSession) => {
        const terminal = terminalsRef.current.find((item: TerminalSession) => item.id === terminalId) ?? terminalSnapshot;
        if (!terminal) {
            return { success: false, message: 'Terminal not found.' };
        }
        if (terminal.status === 'running') {
            return { success: false, message: 'Terminal is busy running another command.' };
        }
        if (hasChainedCd(command)) {
            return { success: false, message: 'Chained cd commands are not supported.' };
        }
        const cdResult = parseCdCommand(command);
        if (cdResult.isCd) {
            const nextCwd = resolveNextCwd(terminal.cwd, projectPath, cdResult.target);
            if (!isPathWithinProject(projectPath, nextCwd)) {
                return { success: false, message: 'Target path is outside projectPath.' };
            }
            const commandId = `cmd_${commandCounter.current++}`;
            updateTerminal(terminalId, (current: TerminalSession) => ({
                ...current,
                cwd: nextCwd,
                commands: [
                    ...current.commands,
                    {
                        id: commandId,
                        command,
                        status: 'success',
                        startedAt: new Date().toISOString(),
                        finishedAt: new Date().toISOString(),
                        outputLines: [`Changed directory to ${nextCwd}`]
                    }
                ],
                activeCommandId: undefined,
                status: 'idle'
            }));
            return { success: true, message: `Directory changed to ${nextCwd}.` };
        }

        if (!isPathWithinProject(projectPath, terminal.cwd)) {
            return { success: false, message: 'Terminal working directory is outside projectPath.' };
        }

        const commandId = `cmd_${commandCounter.current++}`;
        updateTerminal(terminalId, (current: TerminalSession) => ({
            ...current,
            status: 'running',
            activeCommandId: commandId,
            commands: [...current.commands, createCommand(commandId, command)]
        }));

        const proc = spawn(command, {
            cwd: terminal.cwd,
            shell: true,
            env: process.env
        }) as ChildProcessWithoutNullStreams;

        processMap.current.set(commandId, proc);

        proc.stdout.on('data', (data: Buffer) => {
            updateCommandOutput(terminalId, commandId, splitLines(data.toString()));
        });
        proc.stderr.on('data', (data: Buffer) => {
            const lines = splitLines(data.toString()).map(line => `stderr: ${line}`);
            updateCommandOutput(terminalId, commandId, lines);
        });

        proc.on('close', (code: number | null) => {
            processMap.current.delete(commandId);
            updateTerminal(terminalId, (current: TerminalSession) => {
                const status: CommandStatus = code === 0 ? 'success' : 'failed';
                const nextCommands = current.commands.map((item: CommandRecord) => {
                    if (item.id !== commandId) {
                        return item;
                    }
                    return {
                        ...item,
                        status,
                        finishedAt: new Date().toISOString(),
                        exitCode: code ?? undefined
                    };
                });
                return {
                    ...current,
                    status: 'idle',
                    activeCommandId: undefined,
                    commands: nextCommands
                };
            });
        });

        return { success: true, message: `Command started in ${terminalId}.` };
    }, [commandCounter, projectPath, updateCommandOutput, updateTerminal]);

    const sendCommandNewTerminal = useCallback(async (command: string) => {
        const terminal = addTerminal();
        const result = await sendCommand(terminal.id, command, terminal);
        if (!result.success) {
            closeTerminal(terminal.id);
            return { success: false, message: result.message };
        }
        return { success: true, terminalId: terminal.id, message: result.message };
    }, [addTerminal, closeTerminal, sendCommand]);

    return (
        <>
            <View id="root" type="Root" name="Root">
                <RootView
                    projectPath={projectPath}
                    terminals={terminals}
                    onCloseTerminal={closeTerminal}
                    onSendCommand={sendCommand}
                    onSendCommandNewTerminal={sendCommandNewTerminal}
                    onLoadMoreOutput={setOutputTail}
                />
            </View>
            <View id="term_console" type="TerminalConsole" name="TerminalConsole">
                <TerminalConsoleView projectPath={projectPath} terminals={terminals} />
            </View>
            {terminals.map((terminal: TerminalSession) => (
                <View key={terminal.id} id={terminal.id} type="Terminal" name={`Terminal ${terminal.id}`}>
                    <TerminalView terminal={terminal} />
                </View>
            ))}
        </>
    );
}

export default createTUIApp({
    name: 'Terminal App',
    whatItIs: 'A multi-terminal command execution system constrained to the project path, providing command history, working directory tracking, and output tailing for LLM workflows.',
    whenToUse: 'Use Terminal App when you need to run shell commands, manage multiple terminal sessions, and review command outputs while staying within the current project directory.',
    component: TerminalRoot,
    launchConfig: {
        projectPath: process.env.PROJECT_PATH || process.argv[2] || process.cwd()
    }
});
