export type SearchQuery = {
    query: string;
    numResults?: number;
    livecrawl?: 'fallback' | 'preferred';
    type?: 'auto' | 'fast' | 'deep';
    contextMaxCharacters?: number;
};

export type SearchResultItem = {
    id: string;
    title: string;
    url: string;
    snippet: string;
    source?: string;
    rank: number;
};

export type SearchState = {
    status: 'idle' | 'loading' | 'success' | 'error';
    error?: string;
    query?: SearchQuery;
    summary?: string;
    results: SearchResultItem[];
    updatedAt?: number;
};

export type FetchFormat = 'text' | 'markdown' | 'html';

export type FetchAttachment = {
    name: string;
    mimeType: string;
    data: string;
};

export type FetchDocument = {
    url: string;
    title: string;
    contentType: string;
    format: FetchFormat;
    content: string;
    attachments?: FetchAttachment[];
    fetchedAt: number;
};

export type PageState = {
    status: 'idle' | 'loading' | 'success' | 'error';
    error?: string;
    document?: FetchDocument;
};
