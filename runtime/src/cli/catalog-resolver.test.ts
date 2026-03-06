import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { generateKeyPairSync, sign } from 'crypto';
import { DEFAULT_APP_CATALOG, type CatalogData } from './default-catalog.js';
import {
    resolveCatalog,
    stableStringify,
    type CatalogSignature,
    type TrustedCatalogKey
} from './catalog-resolver.js';

function createFetchResponse(payload: unknown, ok = true, status = 200, statusText = 'OK'): Response {
    return {
        ok,
        status,
        statusText,
        json: async () => payload,
    } as Response;
}

function signCatalog(catalog: CatalogData): { signature: CatalogSignature; trustedKey: TrustedCatalogKey } {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const payload = Buffer.from(stableStringify(catalog), 'utf-8');
    const signatureBytes = sign(null, payload, privateKey);

    return {
        signature: {
            keyId: 'catalog-root',
            algorithm: 'ed25519',
            value: signatureBytes.toString('base64')
        },
        trustedKey: {
            keyId: 'catalog-root',
            algorithm: 'ed25519',
            publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString()
        }
    };
}

describe('catalog-resolver', () => {
    let tempDir: string | null = null;

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
            tempDir = null;
        }
    });

    it('returns builtin catalog when no remote url is configured', async () => {
        const result = await resolveCatalog();

        expect(result.source).toBe('builtin');
        expect(result.catalog).toEqual(DEFAULT_APP_CATALOG);
        expect(result.signatureVerified).toBe(false);
    });

    it('fetches and verifies a signed remote catalog', async () => {
        const catalog: CatalogData = {
            version: 2,
            updatedAt: '2026-03-06T00:00:00.000Z',
            apps: [
                {
                    id: 'weather-app',
                    name: 'Weather App',
                    packageName: '@aotui/weather-app',
                    description: 'Weather forecasts for agents.',
                    latestVersion: '1.2.3'
                }
            ]
        };
        const { signature, trustedKey } = signCatalog(catalog);
        tempDir = await mkdtemp(path.join(os.tmpdir(), 'catalog-resolver-'));
        const cachePath = path.join(tempDir, 'catalog-cache.json');

        const result = await resolveCatalog({
            remoteUrl: 'https://registry.example.com/catalog.json',
            cachePath,
            requireSignature: true,
            trustedKeys: [trustedKey],
            fetchImpl: async () => createFetchResponse({ catalog, signature })
        });

        expect(result.source).toBe('remote');
        expect(result.catalog).toEqual(catalog);
        expect(result.signatureVerified).toBe(true);

        const cacheContent = JSON.parse(await readFile(cachePath, 'utf-8')) as { catalog: CatalogData; signatureVerified: boolean };
        expect(cacheContent.catalog).toEqual(catalog);
        expect(cacheContent.signatureVerified).toBe(true);
    });

    it('falls back to cached catalog when remote fetch fails', async () => {
        tempDir = await mkdtemp(path.join(os.tmpdir(), 'catalog-resolver-'));
        const cachePath = path.join(tempDir, 'catalog-cache.json');
        const cachedCatalog: CatalogData = {
            version: 2,
            updatedAt: '2026-03-05T00:00:00.000Z',
            apps: [
                {
                    id: 'cached-terminal',
                    name: 'Cached Terminal',
                    packageName: '@aotui/cached-terminal',
                    description: 'Cached app entry.',
                    latestVersion: '0.9.0'
                }
            ]
        };

        await writeFile(cachePath, JSON.stringify({
            remoteUrl: 'https://registry.example.com/catalog.json',
            cachedAt: '2026-03-05T12:00:00.000Z',
            signatureVerified: true,
            catalog: cachedCatalog
        }, null, 2), 'utf-8');

        const result = await resolveCatalog({
            remoteUrl: 'https://registry.example.com/catalog.json',
            cachePath,
            requireSignature: true,
            trustedKeys: [],
            fetchImpl: async () => {
                throw new Error('network unreachable');
            }
        });

        expect(result.source).toBe('cache');
        expect(result.catalog).toEqual(cachedCatalog);
        expect(result.warnings[0]).toContain('Remote catalog unavailable');
    });

    it('falls back to builtin catalog when signature verification fails and no cache exists', async () => {
        const catalog: CatalogData = {
            version: 2,
            updatedAt: '2026-03-06T00:00:00.000Z',
            apps: [
                {
                    id: 'unsigned-app',
                    name: 'Unsigned App',
                    packageName: '@aotui/unsigned-app',
                    description: 'Unsigned catalog entry.',
                    latestVersion: '0.1.0'
                }
            ]
        };
        const { trustedKey } = signCatalog(catalog);
        tempDir = await mkdtemp(path.join(os.tmpdir(), 'catalog-resolver-'));

        const result = await resolveCatalog({
            remoteUrl: 'https://registry.example.com/catalog.json',
            cachePath: path.join(tempDir, 'catalog-cache.json'),
            requireSignature: true,
            trustedKeys: [trustedKey],
            fetchImpl: async () => createFetchResponse({ catalog })
        });

        expect(result.source).toBe('builtin');
        expect(result.catalog).toEqual(DEFAULT_APP_CATALOG);
        expect(result.warnings[0]).toContain('Remote catalog unavailable');
    });
});
