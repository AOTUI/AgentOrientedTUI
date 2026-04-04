import type { SearchState } from '../types.js';

type SearchViewProps = {
    state: SearchState;
};

export function SearchView({ state }: SearchViewProps) {
    return (
        <div>
            <h2>Search</h2>
            <p>Status: {state.status}</p>
            {state.query ? (
                <p>Query: {state.query.query}</p>
            ) : null}
            {state.error ? (
                <p>Error: {state.error}</p>
            ) : null}
            {state.summary ? (
                <pre>{state.summary}</pre>
            ) : null}
        </div>
    );
}
