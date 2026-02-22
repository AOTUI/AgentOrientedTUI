import React, { useState, useEffect } from 'react';

interface McpJsonEditorProps {
    config: Record<string, any>;
    onSave: (config: Record<string, any>) => void;
    isSaving?: boolean;
}

export const McpJsonEditor: React.FC<McpJsonEditorProps> = ({
    config,
    onSave,
    isSaving = false
}) => {
    const [jsonText, setJsonText] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Sync incoming config to text
    useEffect(() => {
        setJsonText(JSON.stringify(config || {}, null, 2));
        setError(null);
    }, [config]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setJsonText(text);

        try {
            if (text.trim()) {
                JSON.parse(text); // Validate
            }
            setError(null);
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleSave = () => {
        if (error) return; // Don't save if invalid
        try {
            const parsed = jsonText.trim() ? JSON.parse(jsonText) : {};
            onSave(parsed);
        } catch (err) {
            setError((err as Error).message);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--lg-bg-alt)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--lg-bg)]">
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">Raw JSON Config</span>
                <button
                    onClick={handleSave}
                    disabled={!!error || isSaving}
                    className={`
                        px-4 py-1.5 rounded-[var(--r-control)] text-sm font-medium transition-colors
                        ${error ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-[var(--ac-blue)] text-white hover:bg-blue-600'}
                    `}
                >
                    {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>
            </div>

            <div className="relative flex-1 p-4">
                <textarea
                    value={jsonText}
                    onChange={handleChange}
                    spellCheck={false}
                    className={`
                        w-full h-full font-mono text-[13px] p-4 rounded-lg resize-none outline-none
                        bg-[#0a0a0a] text-zinc-300 border
                        ${error ? 'border-red-500/50 focus:border-red-500' : 'border-zinc-800 focus:border-[var(--ac-blue-subtle)]'}
                        focus:ring-1 focus:ring-[var(--ac-blue-subtle)]
                    `}
                    placeholder="{\n  // Enter your MCP JSON configuration here\n}"
                />

                {error && (
                    <div className="absolute bottom-6 left-6 right-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-mono break-words">
                        JSON Error: {error}
                    </div>
                )}
            </div>
        </div>
    );
};
