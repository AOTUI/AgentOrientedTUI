import type { Plan, Phase, PhaseInput, TaskInput, TaskItem } from '../types.js';
import * as db from '../db/index.js';

async function ensureDb() {
    await db.initDatabase();
}

function withTodoAlias(phase: Phase, todos: TaskItem[] = phase.tasks): Phase {
    return {
        ...phase,
        tasks: todos,
        todos
    };
}

function normalizeTaskInputs(phaseInput: PhaseInput): TaskInput[] {
    return phaseInput.tasks ?? phaseInput.todos ?? [];
}

export const planningService = {
    async init(): Promise<void> {
        await ensureDb();
    },

    async getPlans(desktopId: string): Promise<Plan[]> {
        await ensureDb();
        return db.getPlans(desktopId);
    },

    async createPlan(
        desktopId: string,
        title: string,
        description: string = '',
        phases: PhaseInput[] = []
    ): Promise<Plan> {
        await ensureDb();
        const plan = db.createPlan(desktopId, title, description);
        if (phases.length === 0) {
            return plan;
        }
        const createdPhases: Phase[] = [];
        for (const phaseInput of phases) {
            const phase = db.createPhase(desktopId, plan.id, phaseInput.title, phaseInput.description ?? '');
            if (!phase) {
                continue;
            }
            const createdTasks: TaskItem[] = [];
            const tasks: TaskInput[] = normalizeTaskInputs(phaseInput);
            for (const taskInput of tasks) {
                const task = db.createTodo(desktopId, phase.id, taskInput.title, taskInput.description ?? '');
                if (task) {
                    createdTasks.push(task);
                }
            }
            createdPhases.push(withTodoAlias(phase, createdTasks));
        }
        return { ...plan, phases: createdPhases };
    },

    async updatePlan(desktopId: string, planId: string, updates: { title?: string; description?: string }): Promise<boolean> {
        await ensureDb();
        return db.updatePlan(desktopId, planId, updates);
    },

    async deletePlan(desktopId: string, planId: string): Promise<boolean> {
        await ensureDb();
        return db.deletePlan(desktopId, planId);
    },

    async addPhase(
        desktopId: string,
        planId: string,
        title: string,
        description: string = '',
        tasks: TaskInput[] = []
    ): Promise<Phase | null> {
        await ensureDb();
        const phase = db.createPhase(desktopId, planId, title, description);
        if (!phase) {
            return null;
        }
        const createdTasks: TaskItem[] = [];
        for (const taskInput of tasks) {
            const task = db.createTodo(desktopId, phase.id, taskInput.title, taskInput.description ?? '');
            if (task) {
                createdTasks.push(task);
            }
        }
        return withTodoAlias(phase, createdTasks);
    },

    async deletePhase(desktopId: string, phaseId: string): Promise<boolean> {
        await ensureDb();
        return db.deletePhase(desktopId, phaseId);
    },

    async completePhase(desktopId: string, planIdOrPhaseId: string, maybePhaseId?: string): Promise<boolean> {
        await ensureDb();
        return db.completePhase(desktopId, maybePhaseId ?? planIdOrPhaseId);
    },

    async addTask(
        desktopId: string,
        phaseId: string,
        title: string,
        description: string = ''
    ): Promise<TaskItem | null> {
        await ensureDb();
        return db.createTodo(desktopId, phaseId, title, description);
    },

    async updateTask(
        desktopId: string,
        taskId: string,
        updates: { title?: string; description?: string }
    ): Promise<boolean> {
        await ensureDb();
        return db.updateTodo(desktopId, taskId, updates);
    },

    async deleteTask(desktopId: string, taskId: string): Promise<boolean> {
        await ensureDb();
        return db.deleteTodo(desktopId, taskId);
    },

    async completeTask(desktopId: string, taskId: string): Promise<boolean> {
        await ensureDb();
        return db.completeTodo(desktopId, taskId);
    },

    async addTodo(
        desktopId: string,
        planIdOrPhaseId: string,
        phaseIdOrTitle: string,
        titleOrDescription: string,
        maybeDescription: string = ''
    ): Promise<TaskItem | null> {
        const isLegacySignature = maybeDescription !== '';
        const phaseId = isLegacySignature ? phaseIdOrTitle : planIdOrPhaseId;
        const title = isLegacySignature ? titleOrDescription : phaseIdOrTitle;
        const description = isLegacySignature ? maybeDescription : titleOrDescription;
        return this.addTask(desktopId, phaseId, title, description);
    },

    async updateTodo(desktopId: string, todoId: string, updates: { title?: string; description?: string }): Promise<boolean> {
        return this.updateTask(desktopId, todoId, updates);
    },

    async deleteTodo(desktopId: string, todoId: string): Promise<boolean> {
        return this.deleteTask(desktopId, todoId);
    },

    async completeTodo(desktopId: string, planIdOrTodoId: string, phaseIdOrTodoId?: string, maybeTodoId?: string): Promise<boolean> {
        return this.completeTask(desktopId, maybeTodoId ?? phaseIdOrTodoId ?? planIdOrTodoId);
    },

    async clearDesktop(desktopId: string): Promise<void> {
        await ensureDb();
        db.clearPlansForDesktop(desktopId);
    },

    close(): void {
        db.closeDatabase();
    }
};
