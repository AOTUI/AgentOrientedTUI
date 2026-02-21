import type { SearchQuery, SearchResultItem } from '../types.js';

type McpSearchResponse = {
    jsonrpc?: string;
    result?: {
        content?: Array<{
            type?: string;
            text?: string;
        }>;
    };
};

const API_CONFIG = {
    baseUrl: 'https://mcp.exa.ai',
    endpoint: '/mcp',
    defaultNumResults: 8
};

const defaultSummary = 'No search results found. Please try a different query.';

const extractSummary = (payload: string): string => {
    const lines = payload.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) {
            continue;
        }
        const jsonPart = trimmed.slice(6);
        try {
            const parsed = JSON.parse(jsonPart) as McpSearchResponse;
            const content = parsed.result?.content ?? [];
            const text = content.map(item => item.text).filter(Boolean).join('\n').trim();
            if (text) {
                return text;
            }
        } catch {
            continue;
        }
    }
    return defaultSummary;
};

const extractUrls = (summary: string): string[] => {
    const matches = summary.match(/https?:\/\/[^\s)]+/g);
    if (!matches) {
        return [];
    }
    const unique = new Set<string>();
    for (const match of matches) {
        const cleaned = match.replace(/[),.]+$/g, '');
        if (cleaned) {
            unique.add(cleaned);
        }
    }
    return Array.from(unique);
};

const titleForUrl = (value: string): string => {
    try {
        const url = new URL(value);
        return url.hostname;
    } catch {
        return value;
    }
};

const snippetForUrl = (summary: string, url: string): string => {
    const lines = summary.split('\n');
    for (const line of lines) {
        if (line.includes(url)) {
            return line.trim();
        }
    }
    return '';
};

export const runWebSearch = async (
    params: SearchQuery
): Promise<{ summary: string; results: SearchResultItem[] }> => {
    const searchRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
            name: 'web_search_exa',
            arguments: {
                query: params.query,
                type: params.type ?? 'auto',
                numResults: params.numResults ?? API_CONFIG.defaultNumResults,
                livecrawl: params.livecrawl ?? 'fallback',
                contextMaxCharacters: params.contextMaxCharacters
            }
        }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoint}`, {
            method: 'POST',
            headers: {
                accept: 'application/json, text/event-stream',
                'content-type': 'application/json'
            },
            body: JSON.stringify(searchRequest),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Web search failed: ${response.status} ${errorText}`);
        }

        const payload = await response.text();
        const summary = extractSummary(payload);
        const urls = extractUrls(summary);
        const results = urls.map((url, index) => ({
            id: `sr_${index + 1}`,
            title: titleForUrl(url),
            url,
            snippet: snippetForUrl(summary, url),
            rank: index + 1
        }));
        return { summary, results };
    } finally {
        clearTimeout(timeoutId);
    }
};
