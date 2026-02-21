import type { PageState } from '../types.js';

type PageViewProps = {
    state: PageState;
};

export function PageView({ state }: PageViewProps) {
    return (
        <div>
            <h2>Page</h2>
            <p>Status: {state.status}</p>
            {state.error ? <p>Error: {state.error}</p> : null}
            {state.document ? (
                <div>
                    <p>URL: {state.document.url}</p>
                    <p>Content Type: {state.document.contentType || 'unknown'}</p>
                    <p>Format: {state.document.format}</p>
                    {state.document.attachments && state.document.attachments.length > 0 ? (
                        <ul>
                            {state.document.attachments.map((attachment, index) => (
                                <li key={`${attachment.name}_${index}`}>{attachment.mimeType}</li>
                            ))}
                        </ul>
                    ) : null}
                    <pre>{state.document.content}</pre>
                </div>
            ) : null}
        </div>
    );
}
