import React from 'react';
import { marked } from 'marked';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    const html = React.useMemo(() => {
        return marked.parse(content, {
            gfm: true,
            breaks: true,
        }) as string;
    }, [content]);

    return (
        <div
            className={`chat-markdown ${className}`}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
