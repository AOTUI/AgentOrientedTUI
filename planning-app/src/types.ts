export type TaskStatus = 'pending' | 'completed';

export interface TaskItem {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
}

export interface TaskInput {
    title: string;
    description?: string;
}

export interface Phase {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    tasks: TaskItem[];
}

export interface PhaseInput {
    title: string;
    description?: string;
    tasks?: TaskInput[];
}

export interface Plan {
    id: string;
    title: string;
    description?: string;
    phases: Phase[];
}

export interface PlanInput {
    title: string;
    description?: string;
    phases?: PhaseInput[];
}
