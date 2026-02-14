import { useDataRef } from '@aotui/sdk';
import type { TerminalSession, CommandRecord } from '../types.js';

type TerminalViewProps = {
    terminal: TerminalSession;
};

function tailLines(lines: string[], count: number): string[] {
    if (count <= 0) {
        return [];
    }
    return lines.slice(-count);
}

function getActiveCommand(terminal: TerminalSession): CommandRecord | undefined {
    if (terminal.activeCommandId) {
        return terminal.commands.find(cmd => cmd.id === terminal.activeCommandId);
    }
    return terminal.commands[terminal.commands.length - 1];
}

export function TerminalView({ terminal }: TerminalViewProps) {
    const terminalRef = useDataRef(`terminal_detail_${terminal.id}`, terminal);
    const activeCommand = getActiveCommand(terminal);
    const outputLines = activeCommand ? tailLines(activeCommand.outputLines, terminal.outputTail) : [];
    const outputText = outputLines.join('\n');

    return (
        <div>
            <h2>Terminal {terminal.id}</h2>
            <p>{terminalRef(`Terminal Ref: ${terminal.id}`)}</p>
            <ul>
                <li><strong>Status:</strong> {terminal.status}</li>
                <li><strong>Current Path:</strong> {terminal.cwd}</li>
                <li><strong>Output Tail:</strong> {terminal.outputTail} lines</li>
            </ul>

            <h3>History Commands</h3>
            {terminal.commands.length === 0 ? (
                <p>No commands yet.</p>
            ) : (
                <ul>
                    {terminal.commands.map(command => (
                        <li key={command.id}>
                            <strong>{command.command}</strong> - {command.status}
                        </li>
                    ))}
                </ul>
            )}

            <h3>Current Command</h3>
            {activeCommand ? (
                <ul>
                    <li><strong>Command:</strong> {activeCommand.command}</li>
                    <li><strong>Status:</strong> {activeCommand.status}</li>
                    {activeCommand.exitCode !== undefined && (
                        <li><strong>Exit Code:</strong> {activeCommand.exitCode}</li>
                    )}
                </ul>
            ) : (
                <p>No active command.</p>
            )}

            <h3>Command Output</h3>
            {outputText ? (
                <pre><code>{outputText}</code></pre>
            ) : (
                <p>No output.</p>
            )}
        </div>
    );
}
