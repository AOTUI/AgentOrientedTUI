import { useArrayRef } from '@aotui/sdk';
import type { SearchResultItem } from '../types.js';

type ResultListViewProps = {
    results: SearchResultItem[];
};

export function ResultListView({ results }: ResultListViewProps) {
    const [listRef, itemRef] = useArrayRef('results', results, { itemType: 'SearchResult' });

    return (
        <div>
            <h2>{listRef('Search Results')}</h2>
            <p>Total: {results.length}</p>
            {results.length > 0 ? (
                <ul>
                    {results.map((result, index) => (
                        <li key={result.id}>
                            <p>{itemRef(index, result.title || result.url)}</p>
                            <p>{result.url}</p>
                            {result.snippet ? <p>{result.snippet}</p> : null}
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
