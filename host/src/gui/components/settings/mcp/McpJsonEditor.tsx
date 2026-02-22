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
        <div className="flex flex-col h-full mat-content">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--mat-border)] mat-lg-clear">
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">Raw JSON Config</span>
                <button
                    onClick={handleSave}
                    disabled={!!error || isSaving}
                    className={`
                        px-4 py-1.5 rounded-full text-sm font-medium transition-colors active:scale-95
                        ${error ? 'bg-[var(--mat-content-card-bg)] text-[var(--color-text-tertiary)] cursor-not-allowed' : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90'}
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
                        mat-content text-[var(--color-text-primary)] border
                        ${error ? 'border-[var(--color-danger)]/50 focus:border-[var(--color-danger)]' : 'border-[var(--mat-border)] focus:border-[var(--color-accent)/15]'}
                        focus:ring-1 focus:ring-[var(--color-accent)/15]
                    `}
                    placeholder="{\n  // Enter your MCP JSON configuration here\n}"
                />

                {error && (
                    <div className="absolute bottom-6 left-6 right-6 p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-[var(--color-danger)] text-sm font-mono break-words">
                        JSON Error: {error}
                    </div>
                )}
            </div>
        </div>
    );
};
