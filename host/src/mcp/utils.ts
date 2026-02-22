import fs from 'fs/promises';
import path from 'path';

export namespace Global {
    export namespace Path {
        export const data = path.join(process.cwd(), '.aotui', 'mcp');
    }
}

export namespace Filesystem {
    export async function readJson<T>(filepath: string): Promise<T> {
        try {
            const data = await fs.readFile(filepath, 'utf8');
            return JSON.parse(data);
        } catch (e: any) {
            if (e.code === 'ENOENT') throw e;
            throw new Error(`Failed to parse JSON at ${filepath}: ${e.message}`);
        }
    }

    export async function writeJson(filepath: string, data: any, mode?: number): Promise<void> {
        await fs.mkdir(path.dirname(filepath), { recursive: true });
        await fs.writeFile(filepath, JSON.stringify(data, null, 2), { mode });
    }
}

import app from 'electron'; // or we can handle it dynamically

export namespace Log {
    export function create({ service }: { service: string }) {
        return {
            debug: (...args: any[]) => console.debug(`[${service}]`, ...args),
            info: (...args: any[]) => console.info(`[${service}]`, ...args),
            warn: (...args: any[]) => console.warn(`[${service}]`, ...args),
            error: (...args: any[]) => console.error(`[${service}]`, ...args),
        };
    }
}

export namespace NamedError {
    export function create(name: string, schema: any) {
        return class extends Error {
            constructor(public data: any) {
                super(name);
                this.name = name;
            }
        };
    }
}

export namespace Instance {
    export function state<T, U>(init: () => Promise<T>, cleanup?: (state: T) => Promise<U>) {
        let instance: T | undefined;
        let initializing: Promise<T> | undefined;

        const getState = async () => {
            if (instance) return instance;
            if (initializing) return initializing;
            initializing = init().then((res) => {
                instance = res;
                return res;
            });
            return initializing;
        };

        // Note: we might need a way to trigger cleanup.
        return getState;
    }

    export const directory = process.cwd();
}

export namespace Installation {
    export const VERSION = "0.1.0";
}

export namespace BusEvent {
    export function define(name: string, schema: any) {
        return name;
    }
}

export namespace Bus {
    export async function publish(event: string, data: any) {
        // Stub for now, can wire up Emittery if needed.
        console.log(`[Bus] Event published: ${event}`, data);
    }
}

export namespace TuiEvent {
    export const ToastShow = "tui.toast.show";
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout after ${ms}ms`));
        }, ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}
