import { defineParams, useViewTypeTool } from '@aotui/sdk';
import type { TerminalSession } from '../types.js';

type RootViewProps = {
    projectPath: string;
    terminals: TerminalSession[];
    onCloseTerminal: (terminalId: string) => boolean;
    onSendCommand: (terminalId: string, command: string) => Promise<{ success: boolean; message: string }>;
    onSendCommandNewTerminal: (command: string) => Promise<{ success: boolean; terminalId?: string; message: string }>;
    onLoadMoreOutput: (terminalId: string, tailLines: number) => boolean;
};

type ToolTerminalArg = Partial<Pick<TerminalSession, 'id' | 'cwd' | 'status'>>;

export function RootView({
    projectPath,
    terminals,
    onCloseTerminal,
    onSendCommand,
    onSendCommandNewTerminal,
    onLoadMoreOutput
}: RootViewProps) {
    const terminalIds = terminals.map(terminal => terminal.id).join(', ') || 'None';
    const hasTerminals = terminals.length > 0;
    const [CloseTerminalsTool] = useViewTypeTool(
        'TerminalConsole',
        'close_terminals',
        {
            description: `WHEN TO USE: Close one or more existing terminal sessions.
HOW TO USE: Provide one or more Terminal reference ids (type: Terminal).`,
            params: defineParams({
                terminals: { type: 'array', itemType: 'reference', refType: 'Terminal', required: true, desc: 'Terminal ref ids to close' }
            })
        },
        async (args) => {
            const terminals = (args.terminals as ToolTerminalArg[]);
            if (!terminals?.length) {
                return { success: false, error: { code: 'TERMINAL_NOT_FOUND', message: 'At least one Terminal reference is required.' } };
            }
            const closed: string[] = [];
            const notFound: string[] = [];
            for (const t of terminals) {
                const terminalId = t?.id;
                if (!terminalId) { notFound.push('unknown'); continue; }
                if (onCloseTerminal(terminalId)) { closed.push(terminalId); }
                else { notFound.push(terminalId); }
            }
            if (closed.length === 0) {
                return { success: false, error: { code: 'TERMINAL_NOT_FOUND', message: `No terminals found: ${notFound.join(', ')}` } };
            }
            return { success: true, data: { message: `Closed: ${closed.join(', ')}.${notFound.length ? ` Not found: ${notFound.join(', ')}` : ''}` } };
        },
        { enabled: hasTerminals }
    );

    const [SendCommandTool] = useViewTypeTool(
        'TerminalConsole',
        'send_command_to_exist_terminal',
        {
            description: `WHEN TO USE: Execute a command in an existing terminal.
HOW TO USE: Provide terminal reference and command.`,
            params: defineParams({
                terminal: { type: 'reference', refType: 'Terminal', required: true, desc: 'Terminal ref id' },
                command: { type: 'string', required: true, desc: 'Shell command' }
            })
        },
        async (args: { terminal: ToolTerminalArg; command: string }) => {
            const terminalId = args.terminal?.id ?? null;
            if (!terminalId) {
                return { success: false, error: { code: 'TERMINAL_NOT_FOUND', message: 'Terminal reference is required.' } };
            }

            const result = await onSendCommand(terminalId, args.command);
            if (!result.success) {
                return { success: false, error: { code: 'COMMAND_REJECTED', message: result.message } };
            }
            return { success: true, data: { message: result.message, terminal_id: terminalId } };
        },
        { enabled: hasTerminals }
    );

    const [SendCommandNewTerminalTool] = useViewTypeTool(
        'TerminalConsole',
        'new_terminal_and_send_command',
        {
            description: `WHEN TO USE: Create a new terminal and execute a command immediately.
HOW TO USE: Provide command.`,
            params: defineParams({
                command: { type: 'string', required: true, desc: 'Shell command' }
            })
        },
        async (args: { command: string }) => {
            const result = await onSendCommandNewTerminal(args.command);
            if (!result.success || !result.terminalId) {
                return { success: false, error: { code: 'COMMAND_REJECTED', message: result.message } };
            }
            return {
                success: true,
                data: { message: `Terminal opened (${result.terminalId}) and command started.`, terminal_id: result.terminalId }
            };
        }
    );

    const [LoadMoreOutputTool] = useViewTypeTool(
        'Terminal',
        'load_more_output',
        {
            description: `WHEN TO USE: Increase the output tail size for a terminal.
HOW TO USE: Provide terminal reference and tail_lines.`,
            params: defineParams({
                terminal: { type: 'reference', refType: 'Terminal', required: true, desc: 'Terminal ref id' },
                tail_lines: { type: 'number', required: true, desc: 'Number of additional lines to load' }
            })
        },
        async (args: { terminal: ToolTerminalArg; tail_lines: number }) => {
            const terminalId = args.terminal?.id ?? null;
            if (!terminalId) {
                return { success: false, error: { code: 'TERMINAL_NOT_FOUND', message: 'Terminal reference is required.' } };
            }

            const updated = onLoadMoreOutput(terminalId, args.tail_lines);
            if (!updated) {
                return { success: false, error: { code: 'TERMINAL_NOT_FOUND', message: 'Terminal not found' } };
            }
            return { success: true, data: { message: `Loaded ${args.tail_lines} more lines of output.`, terminal_id: terminalId } };
        },
        { enabled: hasTerminals }
    );

    return (
        <>
            <div data-role="application-instruction">
                <section>
                    <h1>Terminal Application Instruction</h1>
                    <h2>What Terminal is</h2>
                    <p>Terminal App manages multiple shell sessions constrained to the project path and tracks command history, working directory, and output tails.</p>
                    <h2>How to use Terminal</h2>
                    <ul>
                        <li>Send commands to an existing terminal by passing terminal refs.</li>
                        <li>Create a new terminal and run a command in one step.</li>
                        <li>Adjust output tail to view more lines from the latest command.</li>
                        <li>Use cd commands to change directories within projectPath only.</li>
                    </ul>
                    <h2>How to pass tool params</h2>
                    <ul>
                        <li>Use refs rendered in Terminal Console/Terminal views: (content)[Terminal:ref_id].</li>
                        <li>In tool args, pass terminal ref ids (for example: terminals[0]).</li>
                        <li>Runtime resolves refs to real terminal data automatically; do not pass view ids.</li>
                    </ul>
                    <h2>Views of Terminal</h2>
                    <h3>Terminal Console View</h3>
                    <h4>Terminal Console Instruction</h4>
                    <p>Shows project path, terminal list, and console tools.</p>
                    <h4>Terminal Console Available Tools</h4>
                    <ul>
                        <li><SendCommandNewTerminalTool /></li>
                        {hasTerminals && <li><CloseTerminalsTool /></li>}
                        {hasTerminals && <li><SendCommandTool /></li>}
                    </ul>
                    {hasTerminals && (
                        <>
                            <h3>Terminal View</h3>
                            <h4>Terminal View Instruction</h4>
                            <p>Shows command history, current directory, current command status, and output tail.</p>
                            <h4>Terminal View Available Tools</h4>
                            <ul>
                                <li><LoadMoreOutputTool /></li>
                            </ul>
                        </>
                    )}
                    <h2>Current State</h2>
                    <ul>
                        <li><strong>Project Path:</strong> {projectPath}</li>
                        <li><strong>Open Terminals:</strong> {terminals.length}</li>
                        <li><strong>Terminal IDs:</strong> {terminalIds}</li>
                    </ul>
                </section>
            </div>


            <div data-role="available-tools">
                <section>
                    <h2>Terminal Console Tools</h2>
                    <ul>
                        <li><SendCommandNewTerminalTool /></li>
                        {hasTerminals && <li><CloseTerminalsTool /></li>}
                        {hasTerminals && <li><SendCommandTool /></li>}
                    </ul>
                    {hasTerminals && (
                        <>
                            <h2>Terminal Tools</h2>
                            <ul>
                                <li><LoadMoreOutputTool /></li>
                            </ul>
                        </>
                    )}
                </section>
            </div>
        </>
    );
}
