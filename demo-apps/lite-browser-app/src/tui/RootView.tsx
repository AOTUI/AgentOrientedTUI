import { defineParams, useViewTypeTool } from '@aotui/sdk';
import type { FetchFormat, SearchQuery } from '../types.js';

type RootViewProps = {
    hasResults: boolean;
    hasPage: boolean;
    onSearch: (params: SearchQuery) => Promise<{ summary: string; resultCount: number }>;
    onOpenResult: (url: string) => Promise<string>;
    onClearResults: () => void;
    onFetch: (params: { url: string; format?: FetchFormat; timeout?: number }) => Promise<string>;
    onClosePage: () => void;
};

type SearchToolArgs = {
    query: string;
    numResults?: number;
    livecrawl?: string;
    type?: string;
    contextMaxCharacters?: number;
};

type OpenResultArgs = {
    result?: { url?: string };
    url?: string;
};

type FetchArgs = {
    url: string;
    format?: string;
    timeout?: number;
};

const searchParams = defineParams({
    query: { type: 'string', required: true, desc: 'Web search query' },
    numResults: { type: 'number', required: false, desc: 'Number of results to return (default: 8)' },
    livecrawl: { type: 'string', required: false, desc: 'Live crawl mode: fallback or preferred' },
    type: { type: 'string', required: false, desc: 'Search type: auto, fast, deep' },
    contextMaxCharacters: { type: 'number', required: false, desc: 'Maximum characters for context string' }
});

const openResultParams = defineParams({
    result: { type: 'reference', refType: 'SearchResult', required: false, desc: 'Result ref id' },
    url: { type: 'string', required: false, desc: 'Direct URL if no reference is used' }
});

const fetchParams = defineParams({
    url: { type: 'string', required: true, desc: 'The URL to fetch content from' },
    format: { type: 'string', required: false, desc: 'Return format: text, markdown, html' },
    timeout: { type: 'number', required: false, desc: 'Timeout in seconds (max 120)' }
});

const emptyParams = defineParams({});

function SearchToolSection({ onSearch }: { onSearch: RootViewProps['onSearch'] }) {
    const [SearchTool] = useViewTypeTool(
        'Search',
        'search_web',
        {
            description: `When to use: run a web search for a query.\nHow to use: provide query and optional search parameters.`,
            params: searchParams
        },
        async (args: SearchToolArgs) => {
            try {
                const livecrawl = args.livecrawl === 'preferred' ? 'preferred' : args.livecrawl === 'fallback' ? 'fallback' : undefined;
                const type = args.type === 'fast' ? 'fast' : args.type === 'deep' ? 'deep' : args.type === 'auto' ? 'auto' : undefined;
                const result = await onSearch({
                    query: args.query,
                    numResults: args.numResults,
                    livecrawl,
                    type,
                    contextMaxCharacters: args.contextMaxCharacters
                });
                return {
                    success: true,
                    data: {
                        message: `Search completed with ${result.resultCount} results.`,
                        result_count: result.resultCount
                    }
                };
            } catch (error) {
                const message = (error as Error).message;
                return {
                    success: false,
                    error: { code: 'SEARCH_FAILED', message }
                };
            }
        }
    );

    return (
        <section data-category="search-tools">
            <h3>Search Tools</h3>
            <ul>
                <li><SearchTool>Run Web Search</SearchTool></li>
            </ul>
        </section>
    );
}

function ResultListToolSection({
    onOpenResult,
    onClearResults
}: {
    onOpenResult: RootViewProps['onOpenResult'];
    onClearResults: RootViewProps['onClearResults'];
}) {
    const [OpenResultTool] = useViewTypeTool(
        'ResultList',
        'open_result',
        {
            description: `When to use: open a search result URL in Page View.\nHow to use: pass a SearchResult reference or a direct URL.`,
            params: openResultParams
        },
        async (args: OpenResultArgs) => {
            const url = args.result?.url ?? args.url;
            if (!url) {
                return {
                    success: false,
                    error: { code: 'RESULT_URL_MISSING', message: 'Result reference or URL is required.' }
                };
            }
            try {
                const viewId = await onOpenResult(url);
                return {
                    success: true,
                    data: {
                        message: `Page fetched for ${url}.`,
                        view_id: viewId
                    }
                };
            } catch (error) {
                const message = (error as Error).message;
                return {
                    success: false,
                    error: { code: 'OPEN_RESULT_FAILED', message }
                };
            }
        }
    );

    const [ClearResultsTool] = useViewTypeTool(
        'ResultList',
        'clear_results',
        {
            description: `When to use: clear the current search results.\nHow to use: call without parameters.`,
            params: emptyParams
        },
        async () => {
            onClearResults();
            return {
                success: true,
                data: {
                    message: 'Search results cleared.'
                }
            };
        }
    );

    return (
        <section data-category="resultlist-tools">
            <h3>ResultList Tools</h3>
            <ul>
                <li><OpenResultTool>Open Result URL</OpenResultTool></li>
                <li><ClearResultsTool>Clear Results</ClearResultsTool></li>
            </ul>
        </section>
    );
}

function PageToolSection({
    onFetch,
    onClosePage,
    hasPage
}: {
    onFetch: RootViewProps['onFetch'];
    onClosePage: RootViewProps['onClosePage'];
    hasPage: boolean;
}) {
    const [FetchTool] = useViewTypeTool(
        'Page',
        'fetch_url',
        {
            description: `When to use: fetch content for a URL.\nHow to use: pass url and optional format or timeout.`,
            params: fetchParams
        },
        async (args: FetchArgs) => {
            const format = args.format === 'text' || args.format === 'markdown' || args.format === 'html' ? args.format : undefined;
            try {
                const viewId = await onFetch({ url: args.url, format, timeout: args.timeout });
                return {
                    success: true,
                    data: {
                        message: `Fetched ${args.url}.`,
                        view_id: viewId
                    }
                };
            } catch (error) {
                const message = (error as Error).message;
                return {
                    success: false,
                    error: { code: 'FETCH_FAILED', message }
                };
            }
        }
    );

    const [CloseTool] = useViewTypeTool(
        'Page',
        'close_page',
        {
            description: `When to use: close the Page view.\nHow to use: call without parameters.`,
            params: emptyParams
        },
        async () => {
            onClosePage();
            return {
                success: true,
                data: { message: 'Page view closed.' }
            };
        },
        {
            enabled: hasPage
        }
    );

    return (
        <section data-category="page-tools">
            <h3>Page Tools</h3>
            <ul>
                <li><FetchTool>Fetch URL</FetchTool></li>
                {hasPage ? <li><CloseTool>Close Page</CloseTool></li> : null}
            </ul>
        </section>
    );
}

export function RootView({
    hasResults,
    hasPage,
    onSearch,
    onOpenResult,
    onClearResults,
    onFetch,
    onClosePage
}: RootViewProps) {
    return (
        <>
            <div data-role="application-instruction">
                <section>
                    <h1>Lite Browser - Application Instruction</h1>
                    <h2>What it is</h2>
                    <p>A lightweight TUI browser that searches the web and fetches page content into structured views.</p>
                    <h2>How to use</h2>
                    <ul>
                        <li>Use Search to run a web query and create fresh search results.</li>
                        <li>Use ResultList to open a result URL into Page or clear outdated results.</li>
                        <li>Use Page to fetch a specific URL again or close the current page view when finished.</li>
                    </ul>
                    <h2>Views</h2>
                    <h3>Search</h3>
                    <p><strong>What it shows:</strong> The current search entry point and the tools for starting a web search.</p>
                    <p><strong>How to use:</strong> Start here whenever you need a new query.</p>
                    <h4>Tool Preconditions</h4>
                    <ul>
                        <li><strong>search_web</strong>: requires a non-empty query; optional search parameters can refine result count or crawl mode.</li>
                    </ul>

                    <h3>ResultList</h3>
                    <p><strong>What it shows:</strong> Ranked search results with titles, URLs, and snippets.</p>
                    <p><strong>How to use:</strong> Review results first, then open a promising URL or clear the list before starting another search.</p>
                    <h4>Tool Preconditions</h4>
                    <ul>
                        <li><strong>open_result</strong>: requires either a SearchResult reference or a direct URL.</li>
                        <li><strong>clear_results</strong>: requires an existing result list.</li>
                    </ul>

                    <h3>Page</h3>
                    <p><strong>What it shows:</strong> Fetched page content in the selected format together with any extracted attachments.</p>
                    <p><strong>How to use:</strong> Use Page for deeper reading after selecting or manually providing a URL.</p>
                    <h4>Tool Preconditions</h4>
                    <ul>
                        <li><strong>fetch_url</strong>: requires a URL; optional format and timeout refine the fetch.</li>
                        <li><strong>close_page</strong>: requires an active Page view.</li>
                    </ul>
                </section>
            </div>

            <div data-role="view-content">
                <SearchToolSection onSearch={onSearch} />
                {hasResults ? (
                    <ResultListToolSection onOpenResult={onOpenResult} onClearResults={onClearResults} />
                ) : null}
                <PageToolSection onFetch={onFetch} onClosePage={onClosePage} hasPage={hasPage} />
            </div>
        </>
    );
}
