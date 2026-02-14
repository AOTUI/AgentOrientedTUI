import initSqlJs, { type Database } from 'sql.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import type { Plan, Phase, TaskItem, TaskStatus } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(PROJECT_ROOT, 'data');
const DB_FILE = join(DATA_DIR, 'planning.sqlite');

let db: Database | null = null;
let SQL: initSqlJs.SqlJsStatic | null = null;

export async function initDatabase(): Promise<Database> {
    if (db) return db;

    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!SQL) {
        SQL = await initSqlJs();
    }

    if (existsSync(DB_FILE)) {
        const buffer = readFileSync(DB_FILE);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
        saveToDisk();
    }

    initSchema();
    return db;
}

function saveToDisk() {
    if (!db) return;
    const data = db.export();
    writeFileSync(DB_FILE, data);
}

function initSchema() {
    if (!db) return;
    db.run(`
        CREATE TABLE IF NOT EXISTS plans (
            id TEXT PRIMARY KEY,
            desktop_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS phases (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending',
            position INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            completed_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS todos (
            id TEXT PRIMARY KEY,
            phase_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending',
            position INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            completed_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_plans_desktop_id ON plans(desktop_id);
        CREATE INDEX IF NOT EXISTS idx_phases_plan_id ON phases(plan_id);
        CREATE INDEX IF NOT EXISTS idx_phases_status ON phases(status);
        CREATE INDEX IF NOT EXISTS idx_todos_phase_id ON todos(phase_id);
        CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
    `);
}

function getDb(): Database {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

function queryAll<T>(sql: string, params: any[] = []): T[] {
    const db = getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
}

function queryOne<T>(sql: string, params: any[] = []): T | null {
    const rows = queryAll<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

function generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getNextPosition(table: 'phases' | 'todos', column: 'plan_id' | 'phase_id', id: string): number {
    const row = queryOne<{ max_pos: number }>(
        `SELECT COALESCE(MAX(position), 0) as max_pos FROM ${table} WHERE ${column} = ?`,
        [id]
    );
    return (row?.max_pos ?? 0) + 1;
}

function isPlanOwned(desktopId: string, planId: string): boolean {
    const row = queryOne<{ id: string }>(
        'SELECT id FROM plans WHERE id = ? AND desktop_id = ?',
        [planId, desktopId]
    );
    return Boolean(row);
}

function isPhaseOwned(desktopId: string, planId: string, phaseId: string): boolean {
    const row = queryOne<{ id: string }>(
        `SELECT phases.id as id
         FROM phases
         JOIN plans ON plans.id = phases.plan_id
         WHERE phases.id = ? AND phases.plan_id = ? AND plans.desktop_id = ?`,
        [phaseId, planId, desktopId]
    );
    return Boolean(row);
}

function isPhaseOwnedByDesktop(desktopId: string, phaseId: string): boolean {
    const row = queryOne<{ id: string }>(
        `SELECT phases.id as id
         FROM phases
         JOIN plans ON plans.id = phases.plan_id
         WHERE phases.id = ? AND plans.desktop_id = ?`,
        [phaseId, desktopId]
    );
    return Boolean(row);
}

function isTodoOwned(desktopId: string, planId: string, phaseId: string, todoId: string): boolean {
    const row = queryOne<{ id: string }>(
        `SELECT todos.id as id
         FROM todos
         JOIN phases ON phases.id = todos.phase_id
         JOIN plans ON plans.id = phases.plan_id
         WHERE todos.id = ? AND phases.id = ? AND plans.id = ? AND plans.desktop_id = ?`,
        [todoId, phaseId, planId, desktopId]
    );
    return Boolean(row);
}

function isTodoOwnedByDesktop(desktopId: string, todoId: string): boolean {
    const row = queryOne<{ id: string }>(
        `SELECT todos.id as id
         FROM todos
         JOIN phases ON phases.id = todos.phase_id
         JOIN plans ON plans.id = phases.plan_id
         WHERE todos.id = ? AND plans.desktop_id = ?`,
        [todoId, desktopId]
    );
    return Boolean(row);
}

export function getPlans(desktopId: string): Plan[] {
    const planRows = queryAll<{
        id: string;
        title: string;
        description: string;
    }>(
        'SELECT id, title, description FROM plans WHERE desktop_id = ? ORDER BY created_at ASC',
        [desktopId]
    );

    return planRows.map(planRow => {
        const phaseRows = queryAll<{
            id: string;
            title: string;
            description: string;
            status: TaskStatus;
        }>(
            'SELECT id, title, description, status FROM phases WHERE plan_id = ? ORDER BY position ASC',
            [planRow.id]
        );

        const phases: Phase[] = phaseRows.map(phaseRow => {
            const taskRows = queryAll<{
                id: string;
                title: string;
                description: string;
                status: TaskStatus;
            }>(
                'SELECT id, title, description, status FROM todos WHERE phase_id = ? ORDER BY position ASC',
                [phaseRow.id]
            );

            const tasks: TaskItem[] = taskRows.map(taskRow => ({
                id: taskRow.id,
                title: taskRow.title,
                description: taskRow.description,
                status: taskRow.status
            }));

            return {
                id: phaseRow.id,
                title: phaseRow.title,
                description: phaseRow.description,
                status: phaseRow.status,
                tasks
            };
        });

        return {
            id: planRow.id,
            title: planRow.title,
            description: planRow.description,
            phases
        };
    });
}

export function createPlan(desktopId: string, title: string, description: string = ''): Plan {
    const db = getDb();
    const now = Date.now();
    const plan: Plan = {
        id: generateId('plan'),
        title,
        description,
        phases: []
    };

    db.run(
        `INSERT INTO plans (id, desktop_id, title, description, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [plan.id, desktopId, plan.title, plan.description ?? '', now]
    );
    saveToDisk();
    return plan;
}

export function updatePlan(desktopId: string, planId: string, updates: { title?: string; description?: string }): boolean {
    if (!isPlanOwned(desktopId, planId)) {
        return false;
    }
    const current = queryOne<{ title: string; description: string }>(
        'SELECT title, description FROM plans WHERE id = ?',
        [planId]
    );
    if (!current) {
        return false;
    }
    const nextTitle = updates.title ?? current.title;
    const nextDescription = updates.description ?? current.description;
    const db = getDb();
    db.run('UPDATE plans SET title = ?, description = ? WHERE id = ?', [
        nextTitle,
        nextDescription,
        planId
    ]);
    const changes = db.getRowsModified();
    if (changes > 0) {
        saveToDisk();
    }
    return changes > 0;
}

export function deletePlan(desktopId: string, planId: string): boolean {
    if (!isPlanOwned(desktopId, planId)) {
        return false;
    }
    const db = getDb();
    db.run('DELETE FROM todos WHERE phase_id IN (SELECT id FROM phases WHERE plan_id = ?)', [planId]);
    db.run('DELETE FROM phases WHERE plan_id = ?', [planId]);
    db.run('DELETE FROM plans WHERE id = ?', [planId]);
    const changes = db.getRowsModified();
    if (changes > 0) {
        saveToDisk();
    }
    return changes > 0;
}

export function createPhase(desktopId: string, planId: string, title: string, description: string = ''): Phase | null {
    if (!isPlanOwned(desktopId, planId)) {
        return null;
    }
    const db = getDb();
    const now = Date.now();
    const phase: Phase = {
        id: generateId('phase'),
        title,
        description,
        status: 'pending',
        tasks: []
    };
    const position = getNextPosition('phases', 'plan_id', planId);
    db.run(
        `INSERT INTO phases (id, plan_id, title, description, status, position, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [phase.id, planId, phase.title, phase.description ?? '', phase.status, position, now]
    );
    saveToDisk();
    return phase;
}

export function deletePhase(desktopId: string, phaseId: string): boolean {
    if (!isPhaseOwnedByDesktop(desktopId, phaseId)) {
        return false;
    }
    const db = getDb();
    db.run('DELETE FROM todos WHERE phase_id = ?', [phaseId]);
    db.run('DELETE FROM phases WHERE id = ?', [phaseId]);
    const changes = db.getRowsModified();
    if (changes > 0) {
        saveToDisk();
    }
    return changes > 0;
}

export function completePhase(desktopId: string, phaseId: string): boolean {
    if (!isPhaseOwnedByDesktop(desktopId, phaseId)) {
        return false;
    }
    const db = getDb();
    const now = Date.now();
    db.run(
        `UPDATE phases
         SET status = 'completed', completed_at = ?
         WHERE id = ? AND status = 'pending'`,
        [now, phaseId]
    );
    const phaseChanges = db.getRowsModified();
    db.run(
        `UPDATE todos
         SET status = 'completed', completed_at = ?
         WHERE phase_id = ? AND status = 'pending'`,
        [now, phaseId]
    );
    const todoChanges = db.getRowsModified();
    if (phaseChanges > 0 || todoChanges > 0) {
        saveToDisk();
    }
    return phaseChanges > 0;
}

export function createTodo(
    desktopId: string,
    phaseId: string,
    title: string,
    description: string = ''
): TaskItem | null {
    if (!isPhaseOwnedByDesktop(desktopId, phaseId)) {
        return null;
    }
    const db = getDb();
    const now = Date.now();
    const task: TaskItem = {
        id: generateId('todo'),
        title,
        description,
        status: 'pending'
    };
    const position = getNextPosition('todos', 'phase_id', phaseId);
    db.run(
        `INSERT INTO todos (id, phase_id, title, description, status, position, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [task.id, phaseId, task.title, task.description ?? '', task.status, position, now]
    );
    saveToDisk();
    return task;
}

export function updateTodo(
    desktopId: string,
    todoId: string,
    updates: { title?: string; description?: string }
): boolean {
    if (!isTodoOwnedByDesktop(desktopId, todoId)) {
        return false;
    }
    const current = queryOne<{ title: string; description: string }>(
        'SELECT title, description FROM todos WHERE id = ?',
        [todoId]
    );
    if (!current) {
        return false;
    }
    const nextTitle = updates.title ?? current.title;
    const nextDescription = updates.description ?? current.description;
    const db = getDb();
    db.run('UPDATE todos SET title = ?, description = ? WHERE id = ?', [
        nextTitle,
        nextDescription,
        todoId
    ]);
    const changes = db.getRowsModified();
    if (changes > 0) {
        saveToDisk();
    }
    return changes > 0;
}

export function completeTodo(desktopId: string, todoId: string): boolean {
    if (!isTodoOwnedByDesktop(desktopId, todoId)) {
        return false;
    }
    const db = getDb();
    db.run(
        `UPDATE todos
         SET status = 'completed', completed_at = ?
         WHERE id = ? AND status = 'pending'`,
        [Date.now(), todoId]
    );
    const changes = db.getRowsModified();
    if (changes > 0) {
        saveToDisk();
    }
    return changes > 0;
}

export function deleteTodo(desktopId: string, todoId: string): boolean {
    if (!isTodoOwnedByDesktop(desktopId, todoId)) {
        return false;
    }
    const db = getDb();
    db.run('DELETE FROM todos WHERE id = ?', [todoId]);
    const changes = db.getRowsModified();
    if (changes > 0) {
        saveToDisk();
    }
    return changes > 0;
}

export function clearPlansForDesktop(desktopId: string): void {
    const db = getDb();
    db.run(
        `DELETE FROM todos
         WHERE phase_id IN (
             SELECT phases.id FROM phases
             JOIN plans ON plans.id = phases.plan_id
             WHERE plans.desktop_id = ?
         )`,
        [desktopId]
    );
    db.run(
        `DELETE FROM phases
         WHERE plan_id IN (SELECT id FROM plans WHERE desktop_id = ?)`,
        [desktopId]
    );
    db.run('DELETE FROM plans WHERE desktop_id = ?', [desktopId]);
    const changes = db.getRowsModified();
    if (changes > 0) {
        saveToDisk();
    }
}

export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
    }
}
