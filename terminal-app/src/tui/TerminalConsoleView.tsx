import { useArrayRef } from '@aotui/sdk';
import type { TerminalSession } from '../types.js';

type TerminalConsoleViewProps = {
    projectPath: string;
    terminals: TerminalSession[];
};

export function TerminalConsoleView({ projectPath, terminals }: TerminalConsoleViewProps) {
    const terminalIds = terminals.map(terminal => terminal.id).join(', ') || 'None';
    const [terminalsRef, terminalRef] = useArrayRef('terminals', terminals, { itemType: 'Terminal' });

    return (
        <div>
            <h2>Terminal Console</h2>
            <ul>
                <li><strong>Project Path:</strong> {projectPath}</li>
                <li><strong>Open Terminals:</strong> {terminals.length}</li>
                <li><strong>Terminal Refs:</strong> {terminalsRef('Open Terminals')}</li>
                <li><strong>Terminal IDs:</strong> {terminalIds}</li>
            </ul>
            {terminals.length > 0 ? (
                <ul>
                    {terminals.map((terminal, index) => (
                        <li key={terminal.id}>{terminalRef(index, terminal.id)}</li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
