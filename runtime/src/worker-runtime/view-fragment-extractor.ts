import { transformElement } from '../engine/view/transformer/pure.js';
import type { AppID, ViewID } from '../spi/index.js';

export type ViewFragmentKind = 'application-instruction' | 'view-state';

export interface WorkerRuntimeViewFragment {
    viewId: ViewID;
    viewType: string;
    viewName?: string;
    markup: string;
    timestamp: number;
    kind: ViewFragmentKind;
}

export interface ViewFragmentExtractor {
    (container: Element, appId: AppID, now: number): WorkerRuntimeViewFragment[];
    clear(): void;
}

function computeViewDigest(markup: string, kind: ViewFragmentKind): string {
    let hash = 2166136261;
    const cacheInput = `${kind}\u0000${markup}`;
    for (let i = 0; i < cacheInput.length; i++) {
        hash ^= cacheInput.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return `v_${(hash >>> 0).toString(16)}`;
}

function classifyViewFragment(node: Element): ViewFragmentKind {
    if (
        node.getAttribute('data-role') === 'application-instruction' ||
        node.querySelector('[data-role="application-instruction"]')
    ) {
        return 'application-instruction';
    }

    return 'view-state';
}

export function createViewFragmentExtractor(): ViewFragmentExtractor {
    const viewDigestCache = new Map<string, string>();
    const viewTimestampCache = new Map<string, number>();

    const extractViewFragments = function (
        container: Element,
        appId: AppID,
        now: number
    ): WorkerRuntimeViewFragment[] {
        const result: WorkerRuntimeViewFragment[] = [];
        const viewNodes = Array.from(container.querySelectorAll('[data-view-id]')) as Element[];
        const aliveKeys = new Set<string>();

        for (const node of viewNodes) {
            const rawViewId = node.getAttribute('data-view-id') || node.getAttribute('id');
            if (!rawViewId) continue;

            const viewId = rawViewId as ViewID;
            const viewType = node.getAttribute('data-view-type') || rawViewId;
            const viewName = node.getAttribute('data-view-name') || undefined;
            const kind = classifyViewFragment(node);

            const transformed = transformElement(node, appId);
            const viewMarkup = transformed.markup?.trim();
            if (!viewMarkup) continue;

            const key = `${appId}:${rawViewId}`;
            aliveKeys.add(key);

            const digest = computeViewDigest(viewMarkup, kind);
            const prevDigest = viewDigestCache.get(key);

            if (prevDigest !== digest) {
                viewDigestCache.set(key, digest);
                viewTimestampCache.set(key, now);
            }

            result.push({
                viewId,
                viewType,
                viewName,
                markup: viewMarkup,
                timestamp: viewTimestampCache.get(key) ?? now,
                kind,
            });
        }

        for (const key of Array.from(viewDigestCache.keys())) {
            if (!aliveKeys.has(key)) {
                viewDigestCache.delete(key);
                viewTimestampCache.delete(key);
            }
        }

        return result;
    } as ViewFragmentExtractor;

    extractViewFragments.clear = () => {
        viewDigestCache.clear();
        viewTimestampCache.clear();
    };

    return extractViewFragments;
}
