import { createPublicKey, verify } from 'crypto';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { DEFAULT_APP_CATALOG, type CatalogData } from './default-catalog.js';
import { isCatalogData } from './catalog.js';
import type { CatalogConfig, CatalogTrustKeyConfig } from '../engine/app/config.js';

export interface CatalogSignature {
    keyId: string;
    algorithm?: 'ed25519';
    value: string;
}

export interface RemoteCatalogEnvelope {
    catalog: CatalogData;
    signature?: CatalogSignature;
}

interface CachedCatalogRecord {
    remoteUrl: string;
    cachedAt: string;
    signatureVerified: boolean;
    catalog: CatalogData;
    signature?: CatalogSignature;
}

export interface TrustedCatalogKey {
    keyId: string;
    algorithm: 'ed25519';
    publicKey: string;
}

export interface CatalogResolverOptions {
    remoteUrl?: string;
    cachePath?: string;
    requireSignature?: boolean;
    trustedKeys?: TrustedCatalogKey[];
    fetchImpl?: typeof fetch;
}

export interface ResolvedCatalog {
    source: 'remote' | 'cache' | 'builtin';
    catalog: CatalogData;
    remoteUrl?: string;
    cachedAt?: string;
    signatureVerified: boolean;
    warnings: string[];
}

export function resolveCatalogOptionsFromConfig(config?: CatalogConfig): CatalogResolverOptions {
    return {
        remoteUrl: config?.url ?? process.env.AOTUI_APP_CATALOG_URL,
        cachePath: config?.cachePath,
        requireSignature: config?.requireSignature ?? false,
        trustedKeys: (config?.trustedKeys ?? []).map((key) => ({
            keyId: key.keyId,
            algorithm: key.algorithm ?? 'ed25519',
            publicKey: key.publicKey
        }))
    };
}

export async function resolveCatalog(options: CatalogResolverOptions = {}): Promise<ResolvedCatalog> {
    const remoteUrl = options.remoteUrl?.trim();
    const cachePath = options.cachePath ?? getDefaultCatalogCachePath();
    const warnings: string[] = [];

    if (remoteUrl) {
        try {
            const remote = await fetchRemoteCatalog(remoteUrl, options);
            await writeCatalogCache(cachePath, {
                remoteUrl,
                cachedAt: new Date().toISOString(),
                signatureVerified: remote.signatureVerified,
                catalog: remote.catalog,
                signature: remote.signature
            });

            return {
                source: 'remote',
                catalog: remote.catalog,
                remoteUrl,
                cachedAt: new Date().toISOString(),
                signatureVerified: remote.signatureVerified,
                warnings: remote.warnings
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            warnings.push(`Remote catalog unavailable: ${message}`);

            const cached = await readCatalogCache(cachePath);
            if (cached) {
                return {
                    source: 'cache',
                    catalog: cached.catalog,
                    remoteUrl: cached.remoteUrl,
                    cachedAt: cached.cachedAt,
                    signatureVerified: cached.signatureVerified,
                    warnings
                };
            }
        }
    }

    return {
        source: 'builtin',
        catalog: DEFAULT_APP_CATALOG,
        signatureVerified: false,
        warnings
    };
}

export async function fetchRemoteCatalog(
    remoteUrl: string,
    options: CatalogResolverOptions = {}
): Promise<{ catalog: CatalogData; signature?: CatalogSignature; signatureVerified: boolean; warnings: string[] }> {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) {
        throw new Error('Fetch API is not available in this runtime');
    }

    const response = await fetchImpl(remoteUrl, {
        headers: {
            accept: 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }

    const json = await response.json();
    const envelope = normalizeEnvelope(json);
    const trustedKeys = options.trustedKeys ?? [];
    const requireSignature = options.requireSignature ?? false;
    const warnings: string[] = [];

    let signatureVerified = false;
    if (envelope.signature) {
        if (envelope.signature.algorithm && envelope.signature.algorithm !== 'ed25519') {
            throw new Error(`Unsupported catalog signature algorithm: ${envelope.signature.algorithm}`);
        }

        const key = trustedKeys.find((item) => item.keyId === envelope.signature?.keyId);
        if (!key) {
            if (requireSignature || trustedKeys.length > 0) {
                throw new Error(`Missing trusted key for catalog signature: ${envelope.signature.keyId}`);
            }
            warnings.push(`Catalog signature present but key "${envelope.signature.keyId}" is not configured as trusted.`);
        } else {
            const verified = verifyCatalogSignature(envelope.catalog, envelope.signature, key);
            if (!verified) {
                throw new Error(`Catalog signature verification failed for key "${envelope.signature.keyId}"`);
            }
            signatureVerified = true;
        }
    } else if (requireSignature || trustedKeys.length > 0) {
        throw new Error('Remote catalog is unsigned, but signature verification is required');
    }

    return {
        catalog: envelope.catalog,
        signature: envelope.signature,
        signatureVerified,
        warnings
    };
}

export function verifyCatalogSignature(
    catalog: CatalogData,
    signature: CatalogSignature,
    key: TrustedCatalogKey | CatalogTrustKeyConfig
): boolean {
    const normalizedAlgorithm = key.algorithm ?? 'ed25519';
    if (normalizedAlgorithm !== 'ed25519') {
        throw new Error(`Unsupported trusted key algorithm: ${normalizedAlgorithm}`);
    }

    const publicKey = createPublicKey(key.publicKey);
    const payload = Buffer.from(stableStringify(catalog), 'utf-8');
    const signatureBytes = Buffer.from(signature.value, 'base64');
    return verify(null, payload, publicKey, signatureBytes);
}

export function stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, entryValue]) => entryValue !== undefined)
            .sort(([left], [right]) => left.localeCompare(right));
        return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
    }

    return JSON.stringify(value);
}

function normalizeEnvelope(value: unknown): RemoteCatalogEnvelope {
    if (isCatalogData(value)) {
        return { catalog: value };
    }

    if (typeof value !== 'object' || value === null) {
        throw new Error('Catalog response is not a valid JSON object');
    }

    const envelope = value as Partial<RemoteCatalogEnvelope>;
    if (!isCatalogData(envelope.catalog)) {
        throw new Error('Catalog response does not include a valid "catalog" payload');
    }

    if (envelope.signature !== undefined) {
        if (typeof envelope.signature !== 'object' || envelope.signature === null) {
            throw new Error('Catalog signature must be an object');
        }
        const signature = envelope.signature as Partial<CatalogSignature>;
        if (typeof signature.keyId !== 'string' || typeof signature.value !== 'string') {
            throw new Error('Catalog signature is missing keyId or value');
        }
        if (signature.algorithm !== undefined && signature.algorithm !== 'ed25519') {
            throw new Error(`Unsupported catalog signature algorithm: ${signature.algorithm}`);
        }
    }

    return envelope as RemoteCatalogEnvelope;
}

function getDefaultCatalogCachePath(): string {
    return path.join(os.homedir(), '.agentina', 'cache', 'app-catalog.json');
}

async function readCatalogCache(cachePath: string): Promise<CachedCatalogRecord | null> {
    try {
        const content = await fs.readFile(cachePath, 'utf-8');
        const cached = JSON.parse(content) as CachedCatalogRecord;
        if (!isCatalogData(cached.catalog)) {
            return null;
        }
        if (typeof cached.remoteUrl !== 'string' || typeof cached.cachedAt !== 'string' || typeof cached.signatureVerified !== 'boolean') {
            return null;
        }
        return cached;
    } catch (error: any) {
        if (error?.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

async function writeCatalogCache(cachePath: string, record: CachedCatalogRecord): Promise<void> {
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(record, null, 2), 'utf-8');
}
