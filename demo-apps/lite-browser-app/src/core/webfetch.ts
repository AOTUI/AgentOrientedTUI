import type { FetchDocument, FetchFormat, FetchAttachment } from '../types.js';

const MAX_BYTES = 5 * 1024 * 1024;

const buildAccept = (format: FetchFormat): string => {
    if (format === 'html') {
        return 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
    }
    if (format === 'text') {
        return 'text/plain, text/html;q=0.7, application/xhtml+xml;q=0.7, */*;q=0.5';
    }
    return 'text/markdown, text/html;q=0.8, application/xhtml+xml;q=0.7, */*;q=0.5';
};

const ensureUrl = (value: string) => {
    if (!/^https?:\/\//i.test(value)) {
        throw new Error('URL must start with http:// or https://');
    }
};

const stripHtml = (html: string): string => {
    const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/gi, '');
    const withoutTags = withoutStyles.replace(/<\/?[^>]+>/g, ' ');
    return withoutTags.replace(/\s+/g, ' ').trim();
};

const decodeToText = async (response: Response): Promise<string> => {
    const text = await response.text();
    if (text.length * 2 > MAX_BYTES) {
        throw new Error('Response size exceeds 5MB limit');
    }
    return text;
};

const decodeToBase64 = async (response: Response): Promise<string> => {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
        throw new Error('Response size exceeds 5MB limit');
    }
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    if (typeof btoa === 'function') {
        return btoa(binary);
    }
    const buffer = (globalThis as { Buffer?: { from: (data: Uint8Array) => { toString: (enc: string) => string } } }).Buffer;
    if (buffer) {
        return buffer.from(bytes).toString('base64');
    }
    throw new Error('Base64 encoder not available in runtime');
};

const normalizeContentType = (value: string | null): string => value?.split(';')[0]?.trim() ?? '';

export const runWebFetch = async (params: {
    url: string;
    format?: FetchFormat;
    timeout?: number;
}): Promise<FetchDocument> => {
    ensureUrl(params.url);
    const format = params.format ?? 'markdown';
    const controller = new AbortController();
    const timeoutMs = Math.min((params.timeout ?? 30) * 1000, 120000);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(params.url, {
            method: 'GET',
            headers: {
                accept: buildAccept(format),
                'user-agent': 'AOTUI-LiteBrowser/1.0'
            },
            signal: controller.signal
        });

        let finalResponse = response;
        if (finalResponse.status === 403 && finalResponse.headers.get('cf-mitigated') === 'challenge') {
            finalResponse = await fetch(params.url, {
                method: 'GET',
                headers: {
                    accept: buildAccept(format),
                    'user-agent': 'opencode'
                },
                signal: controller.signal
            });
        }

        if (!finalResponse.ok) {
            const errorText = await finalResponse.text();
            throw new Error(`Fetch failed: ${finalResponse.status} ${errorText}`);
        }

        const contentType = normalizeContentType(finalResponse.headers.get('content-type'));
        const title = `${params.url} (${contentType || 'unknown'})`;

        if (contentType.startsWith('image/') && !contentType.includes('svg')) {
            const base64 = await decodeToBase64(finalResponse);
            const attachment: FetchAttachment = {
                name: 'image',
                mimeType: contentType,
                data: `data:${contentType};base64,${base64}`
            };
            return {
                url: params.url,
                title,
                contentType,
                format,
                content: 'Image fetched successfully',
                attachments: [attachment],
                fetchedAt: Date.now()
            };
        }

        const bodyText = await decodeToText(finalResponse);
        if (format === 'html') {
            return {
                url: params.url,
                title,
                contentType,
                format,
                content: bodyText,
                fetchedAt: Date.now()
            };
        }

        const textContent = contentType.includes('html') ? stripHtml(bodyText) : bodyText;
        if (format === 'markdown') {
            return {
                url: params.url,
                title,
                contentType,
                format,
                content: textContent,
                fetchedAt: Date.now()
            };
        }
        return {
            url: params.url,
            title,
            contentType,
            format,
            content: textContent,
            fetchedAt: Date.now()
        };
    } finally {
        clearTimeout(timeoutId);
    }
};
