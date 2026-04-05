import { defineParams, useViewTypeTool } from '@aotui/sdk';
import type { Phase, PhaseInput, Plan, TaskInput, TaskItem } from '../types.js';

type RootViewProps = {
    plans: Plan[];
    activePlanId: string | null;
    createPlan: (title: string, description?: string, phases?: PhaseInput[]) => Promise<string>;
    updatePlan: (planId: string, updates: { title?: string; description?: string }) => Promise<boolean>;
    deletePlan: (planId: string) => Promise<boolean>;
    openPlan: (planId: string) => Promise<boolean>;
    closePlan: () => void;
    addPhase: (title: string, description?: string, tasks?: TaskInput[]) => Promise<string | null>;
    deletePhase: (phaseId: string) => Promise<boolean>;
    completePhase: (phaseId: string) => Promise<boolean>;
    addTask: (phaseId: string, title: string, description?: string) => Promise<string | null>;
    updateTask: (
        taskId: string,
        updates: { title?: string; description?: string }
    ) => Promise<boolean>;
    deleteTask: (taskId: string) => Promise<boolean>;
    completeTask: (taskId: string) => Promise<boolean>;
};

type ToolPlanArg = Partial<Pick<Plan, 'id' | 'title'>>;
type ToolPhaseArg = Partial<Pick<Phase, 'id' | 'title'>>;
type ToolTaskArg = Partial<Pick<TaskItem, 'id' | 'title'>>;

export function RootView({
    plans,
    activePlanId,
    createPlan,
    updatePlan,
    deletePlan,
    openPlan,
    closePlan,
    addPhase,
    deletePhase,
    completePhase,
    addTask,
    updateTask,
    deleteTask,
    completeTask
}: RootViewProps) {
    const activePlan = plans.find(plan => plan.id === activePlanId) || null;

    const findPhaseIdByTaskId = (taskId: string): string | null => {
        if (!activePlan) {
            return null;
        }
        for (const phase of activePlan.phases) {
            if (phase.tasks.some(task => task.id === taskId)) {
                return phase.id;
            }
        }
        return null;
    };

    const [CreatePlanTool] = useViewTypeTool(
        'PlanList',
        'create_plan',
        {
            description: `Create a new plan, optionally with phases and tasks.`,
            params: defineParams({
                title: { type: 'string', required: true, desc: 'Plan title' },
                description: { type: 'string', required: false, desc: 'Optional plan description' },
                phases: {
                    type: 'array',
                    required: false,
                    itemType: 'object',
                    desc: 'Phases with tasks: [{ title, description?, tasks?: [{ title, description? }] }]'
                }
            })
        },
        async (args) => {
            const phases = (args.phases ?? []) as unknown as PhaseInput[];
            await createPlan(args.title, args.description, phases);
            const phaseCount = phases.length;
            const taskCount = phases.reduce((sum, phase) => sum + (phase.tasks?.length ?? 0), 0);
            return {
                success: true,
                data: {
                    message: `Plan created with ${phaseCount} phases and ${taskCount} tasks.`
                }
            };
        }
    );

    const [UpdatePlanTool] = useViewTypeTool(
        'PlanList',
        'update_plan',
        {
            description: `Update a plan. Pass a Plan reference (type: Plan). Omit plan to use active plan.`,
            params: defineParams({
                plan: { type: 'reference', refType: 'Plan', required: false, desc: 'Plan ref id (e.g., active_plan, completed_plans[5])' },
                title: { type: 'string', required: false, desc: 'New plan title' },
                description: { type: 'string', required: false, desc: 'New plan description' }
            })
        },
        async (args: { plan?: ToolPlanArg; title?: string; description?: string }) => {
            const planId = args.plan?.id ?? activePlan?.id ?? null;
            if (!planId) {
                return { success: false, error: { code: 'PLAN_NOT_FOUND', message: 'Plan reference is required or open a plan first.' } };
            }
            const updated = await updatePlan(planId, { title: args.title, description: args.description });
            if (!updated) {
                return { success: false, error: { code: 'PLAN_UPDATE_FAILED', message: 'Plan update failed' } };
            }
            return { success: true, data: { message: 'Plan updated.' } };
        }
    );

    const [DeletePlanTool] = useViewTypeTool(
        'PlanList',
        'delete_plan',
        {
            description: `Delete a plan. Pass a Plan reference (type: Plan). Omit plan to use active plan.`,
            params: defineParams({
                plan: { type: 'reference', refType: 'Plan', required: false, desc: 'Plan ref id' }
            })
        },
        async (args: { plan?: ToolPlanArg }) => {
            const planId = args.plan?.id ?? activePlan?.id ?? null;
            if (!planId) {
                return { success: false, error: { code: 'PLAN_NOT_FOUND', message: 'Plan reference is required or open a plan first.' } };
            }
            const deleted = await deletePlan(planId);
            if (!deleted) {
                return { success: false, error: { code: 'PLAN_DELETE_FAILED', message: 'Plan delete failed' } };
            }
            return { success: true, data: { message: 'Plan deleted.' } };
        }
    );

    const [OpenPlanTool] = useViewTypeTool(
        'PlanList',
        'open_plan',
        {
            description: `Open a plan by Plan reference (type: Plan).`,
            params: defineParams({
                plan: { type: 'reference', refType: 'Plan', required: true, desc: 'Plan ref id' }
            })
        },
        async (args: { plan: ToolPlanArg }) => {
            const planId = args.plan?.id ?? null;
            if (!planId) {
                return { success: false, error: { code: 'PLAN_NOT_FOUND', message: 'Plan reference is required.' } };
            }
            const opened = await openPlan(planId);
            if (!opened) {
                return { success: false, error: { code: 'PLAN_OPEN_FAILED', message: 'Plan open failed' } };
            }
            return { success: true, data: { message: 'Plan opened.' } };
        }
    );

    const [ClosePlanTool] = useViewTypeTool(
        'PlanList',
        'close_plan',
        {
            description: `Close the active plan.`,
            params: defineParams({})
        },
        async () => {
            closePlan();
            return { success: true, data: { message: 'Active plan closed.' } };
        }
    );

    const [AddPhaseTool] = useViewTypeTool(
        'PlanDetail',
        'add_phase',
        {
            description: `Add a phase to the current active plan in this PlanDetail view.`,
            params: defineParams({
                title: { type: 'string', required: true, desc: 'Phase title' },
                description: { type: 'string', required: false, desc: 'Optional phase description' },
                tasks: {
                    type: 'array',
                    required: false,
                    itemType: 'object',
                    desc: 'Initial tasks: [{ title, description? }]'
                }
            })
        },
        async (args) => {
            if (!activePlan) {
                return { success: false, error: { code: 'PLAN_NOT_FOUND', message: 'Open a plan first.' } };
            }
            const tasks = (args.tasks ?? []) as unknown as TaskInput[];
            const phaseId = await addPhase(args.title, args.description, tasks);
            if (!phaseId) {
                return { success: false, error: { code: 'PHASE_ADD_FAILED', message: 'Add phase failed' } };
            }
            return { success: true, data: { message: `Phase added with ${tasks.length} tasks.` } };
        },
        { enabled: Boolean(activePlanId) }
    );

    const [DeletePhaseTool] = useViewTypeTool(
        'PlanDetail',
        'delete_phase',
        {
            description: `Delete a phase by Phase reference (type: Phase).`,
            params: defineParams({
                phase: { type: 'reference', refType: 'Phase', required: true, desc: 'Phase ref id' }
            })
        },
        async (args: { phase: ToolPhaseArg }) => {
            const phaseId = args.phase?.id ?? null;
            if (!phaseId) {
                return { success: false, error: { code: 'PHASE_NOT_FOUND', message: 'Phase reference is required and a plan must be open.' } };
            }
            const deleted = await deletePhase(phaseId);
            if (!deleted) {
                return { success: false, error: { code: 'PHASE_DELETE_FAILED', message: 'Phase delete failed' } };
            }
            return { success: true, data: { message: 'Phase deleted.' } };
        },
        { enabled: Boolean(activePlanId) }
    );

    const [CompletePhaseTool] = useViewTypeTool(
        'PlanDetail',
        'complete_phase',
        {
            description: `Complete a phase by Phase reference (type: Phase).`,
            params: defineParams({
                phase: { type: 'reference', refType: 'Phase', required: true, desc: 'Phase ref id' }
            })
        },
        async (args: { phase: ToolPhaseArg }) => {
            const phaseId = args.phase?.id ?? null;
            if (!phaseId) {
                return { success: false, error: { code: 'PHASE_NOT_FOUND', message: 'Phase reference is required and a plan must be open.' } };
            }
            const completed = await completePhase(phaseId);
            if (!completed) {
                return { success: false, error: { code: 'PHASE_COMPLETE_FAILED', message: 'Complete phase failed' } };
            }
            return { success: true, data: { message: 'Phase completed.' } };
        },
        { enabled: Boolean(activePlanId) }
    );

    const [AddTaskTool] = useViewTypeTool(
        'PlanDetail',
        'add_task',
        {
            description: `Add a task to a phase by Phase reference (type: Phase).`,
            params: defineParams({
                phase: { type: 'reference', refType: 'Phase', required: true, desc: 'Phase ref id' },
                title: { type: 'string', required: true, desc: 'Task title' },
                description: { type: 'string', required: false, desc: 'Optional task description' }
            })
        },
        async (args: { phase: ToolPhaseArg; title: string; description?: string }) => {
            const phaseId = args.phase?.id ?? null;
            if (!phaseId) {
                return { success: false, error: { code: 'PHASE_NOT_FOUND', message: 'Phase reference is required and a plan must be open.' } };
            }
            const taskId = await addTask(phaseId, args.title, args.description);
            if (!taskId) {
                return { success: false, error: { code: 'TASK_ADD_FAILED', message: 'Add task failed' } };
            }
            return { success: true, data: { message: 'Task added.' } };
        },
        { enabled: Boolean(activePlanId) }
    );

    const [UpdateTaskTool] = useViewTypeTool(
        'PlanDetail',
        'update_task',
        {
            description: `Update a task by Task reference (type: Task). Pass the task ref id string from PlanDetail; runtime resolves it.`,
            params: defineParams({
                task: { type: 'reference', refType: 'Task', required: true, desc: 'Task ref id' },
                title: { type: 'string', required: false, desc: 'New task title' },
                description: { type: 'string', required: false, desc: 'New task description' }
            })
        },
        async (args: { task: ToolTaskArg; title?: string; description?: string }) => {
            const taskId = args.task?.id ?? null;
            const phaseId = taskId ? findPhaseIdByTaskId(taskId) : null;
            if (!phaseId || !taskId) {
                return { success: false, error: { code: 'TASK_NOT_FOUND', message: 'Task reference is required and task must belong to current plan.' } };
            }
            const updated = await updateTask(taskId, {
                title: args.title,
                description: args.description
            });
            if (!updated) {
                return { success: false, error: { code: 'TASK_UPDATE_FAILED', message: 'Update task failed' } };
            }
            return { success: true, data: { message: 'Task updated.' } };
        },
        { enabled: Boolean(activePlanId) }
    );

    const [DeleteTaskTool] = useViewTypeTool(
        'PlanDetail',
        'delete_task',
        {
            description: `Delete a task by Task reference (type: Task). Pass the task ref id string from PlanDetail; runtime resolves it.`,
            params: defineParams({
                task: { type: 'reference', refType: 'Task', required: true, desc: 'Task ref id' }
            })
        },
        async (args: { task: ToolTaskArg }) => {
            const taskId = args.task?.id ?? null;
            const phaseId = taskId ? findPhaseIdByTaskId(taskId) : null;
            if (!phaseId || !taskId) {
                return { success: false, error: { code: 'TASK_NOT_FOUND', message: 'Task reference is required and task must belong to current plan.' } };
            }
            const deleted = await deleteTask(taskId);
            if (!deleted) {
                return { success: false, error: { code: 'TASK_DELETE_FAILED', message: 'Delete task failed' } };
            }
            return { success: true, data: { message: 'Task deleted.' } };
        },
        { enabled: Boolean(activePlanId) }
    );

    const [CompleteTaskTool] = useViewTypeTool(
        'PlanDetail',
        'complete_task',
        {
            description: `Complete a task by Task reference (type: Task). Pass the task ref id string from PlanDetail; runtime resolves it.`,
            params: defineParams({
                task: { type: 'reference', refType: 'Task', required: true, desc: 'Task ref id' }
            })
        },
        async (args: { task: ToolTaskArg }) => {
            const taskId = args.task?.id ?? null;
            const phaseId = taskId ? findPhaseIdByTaskId(taskId) : null;
            if (!phaseId || !taskId) {
                return { success: false, error: { code: 'TASK_NOT_FOUND', message: 'Task reference is required and task must belong to current plan.' } };
            }
            const completed = await completeTask(taskId);
            if (!completed) {
                return { success: false, error: { code: 'TASK_COMPLETE_FAILED', message: 'Complete task failed' } };
            }
            return { success: true, data: { message: 'Task completed.' } };
        },
        { enabled: Boolean(activePlanId) }
    );

    return (
        <>
            <div data-role="application-instruction">
                <section>
                    <h1>Planning App - Application Instruction</h1>
                    <h2>What it is</h2>
                    <p>Planning App organizes work into Plans, Phases, and Tasks with progress tracking.</p>

                    <h2>How to use</h2>
                    <ul>
                        <li>Start in PlanList to create, update, open, close, or delete plans.</li>
                        <li>Open a plan before using PlanDetail tools for phases and tasks.</li>
                        <li>Use refs rendered in PlanList or PlanDetail views: <code>(content)[Plan:ref_id]</code>, <code>(content)[Phase:ref_id]</code>, and <code>(content)[Task:ref_id]</code>.</li>
                        <li>In tool args, pass ref ids such as <code>active_plan</code>, <code>completed_phases[0]</code>, or <code>pending_tasks[1]</code>.</li>
                        <li>Runtime resolves these refs to real data automatically; do not manually construct ids.</li>
                    </ul>

                    <h2>Views</h2>

                    <h3>PlanList</h3>
                    <p><strong>What it shows:</strong> The full list of plans and the currently active plan, if one is open.</p>
                    <p><strong>How to use:</strong> Use PlanList to create plans, open one for detailed work, or close/delete existing plans.</p>
                    <h4>Tool Preconditions</h4>
                    <ul>
                        <li><strong>create_plan</strong>: requires a title; optional phases and tasks can be supplied inline.</li>
                        <li><strong>update_plan</strong> / <strong>delete_plan</strong>: require a Plan reference or an already open active plan.</li>
                        <li><strong>open_plan</strong>: requires a Plan reference.</li>
                        <li><strong>close_plan</strong>: requires an active plan.</li>
                    </ul>

                    <h3>PlanDetail</h3>
                    <p><strong>What it shows:</strong> The phases and tasks for the currently active plan, including completion progress.</p>
                    <p><strong>How to use:</strong> Use PlanDetail after opening a plan to add, update, complete, or delete phases and tasks by reference.</p>
                    <h4>Tool Preconditions</h4>
                    <ul>
                        <li><strong>add_phase</strong>: requires an active plan.</li>
                        <li><strong>delete_phase</strong> / <strong>complete_phase</strong>: require an active plan and a Phase reference from the current PlanDetail view.</li>
                        <li><strong>add_task</strong>: requires an active plan and a Phase reference.</li>
                        <li><strong>update_task</strong> / <strong>delete_task</strong> / <strong>complete_task</strong>: require an active plan and a Task reference that belongs to the current plan.</li>
                    </ul>
                </section>
            </div>

            <div data-role="available-tools">
                <section>
                    <h2>PlanList View Tools</h2>
                    <ul>
                        <li><CreatePlanTool /></li>
                        <li><UpdatePlanTool /></li>
                        <li><DeletePlanTool /></li>
                        <li><OpenPlanTool /></li>
                        <li><ClosePlanTool /></li>
                    </ul>

                    {activePlan && (
                        <>
                            <h2>PlanDetail View Tools</h2>
                            <ul>
                                <li><AddPhaseTool /></li>
                                <li><DeletePhaseTool /></li>
                                <li><CompletePhaseTool /></li>
                                <li><AddTaskTool /></li>
                                <li><UpdateTaskTool /></li>
                                <li><DeleteTaskTool /></li>
                                <li><CompleteTaskTool /></li>
                            </ul>
                        </>
                    )}
                </section>
            </div>
        </>
    );
}
