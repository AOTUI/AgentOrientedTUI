import { Window } from 'happy-dom';
import { parseHTML } from 'linkedom';
import { performance } from 'perf_hooks';

// Helper to measure memory
function getMemoryUsage() {
    if (global.gc) { global.gc(); }
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    return Math.round(used * 100) / 100;
}

const ITERATIONS = 100;

console.log('--- DOM Engine Benchmark: LinkeDOM vs HappyDOM ---');

// Warmup
if (global.gc) { global.gc(); }
const baselineMemory = getMemoryUsage();
console.log(`Baseline Memory: ${baselineMemory} MB`);

async function benchLinkeDOM() {
    const memoryStart = getMemoryUsage();
    const timeStart = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
        const { window, document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
        // Simple DOM Ops
        for (let j = 0; j < 100; j++) {
            const div = document.createElement('div');
            div.setAttribute('id', `div-${j}`);
            div.innerHTML = '<span>Hello</span>';
            document.body.appendChild(div);
        }
    }

    const timeEnd = performance.now();
    const memoryEnd = getMemoryUsage();

    return {
        name: 'LinkeDOM',
        time: (timeEnd - timeStart) / ITERATIONS,
        memoryDelta: memoryEnd - memoryStart
    };
}

async function benchHappyDOM() {
    const memoryStart = getMemoryUsage();
    const timeStart = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
        const window = new Window();
        const document = window.document;
        document.write('<!DOCTYPE html><html><body></body></html>');

        // Simple DOM Ops
        for (let j = 0; j < 100; j++) {
            const div = document.createElement('div');
            div.setAttribute('id', `div-${j}`);
            div.innerHTML = '<span>Hello</span>';
            document.body.appendChild(div);
        }

        window.close();
    }

    const timeEnd = performance.now();
    const memoryEnd = getMemoryUsage();

    return {
        name: 'HappyDOM',
        time: (timeEnd - timeStart) / ITERATIONS,
        memoryDelta: memoryEnd - memoryStart
    };
}

async function run() {
    // Run LinkeDOM
    if (global.gc) { global.gc(); }
    const r1 = await benchLinkeDOM();
    console.log(`[LinkeDOM] Avg Time: ${r1.time.toFixed(2)}ms, Memory Delta: ${r1.memoryDelta} MB`);

    // Run HappyDOM
    if (global.gc) { global.gc(); }
    const r2 = await benchHappyDOM();
    console.log(`[HappyDOM] Avg Time: ${r2.time.toFixed(2)}ms, Memory Delta: ${r2.memoryDelta} MB`);

    // Comparison
    console.log('\n--- Comparison ---');
    console.log(`Speed Ratio (LinkeDOM/HappyDOM): ${(r2.time / r1.time).toFixed(2)}x (Lower is better for LinkeDOM)`);
    // Note: If result > 1, HappyDOM is slower.
}

run();
