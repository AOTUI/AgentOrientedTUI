import { createTUIApp, View, useEffect, useMemo, useState, useAppRuntimeContext, usePersistentState } from '@aotui/sdk';
import type { Plan, Phase, PhaseInput, TaskInput, TaskItem, TaskStatus } from '../types.js';
import { RootView } from './RootView.js';
import { PlanListView } from './PlanListView.js';
import { PlanDetailView } from './PlanDetailView.js';
import { planningService } from '../core/planning-service.js';
import type { AppContext } from '@aotui/sdk';

const isPlanCompleted = (plan: Plan) => {
    if (plan.phases.length === 0) {
        return false;
    }
    return plan.phases.every(phase => phase.status === 'completed');
};

function PlanningApp() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [activePlanId, setActivePlanId] = usePersistentState<string | null>('activePlanId', null, {
        deserialize: (value) => {
            if (typeof value === 'string') {
                return value;
            }
            return null;
        },
        serialize: (value) => (typeof value === 'string' ? value : null),
    });
    const { desktopId } = useAppRuntimeContext();

    const activePlan = useMemo(
        () => plans.find(plan => plan.id === activePlanId) || null,
        [plans, activePlanId]
    );

    useEffect(() => {
        let cancelled = false;
        const loadPlans = async () => {
            await planningService.init();
            const loadedPlans = await planningService.getPlans(desktopId);
            if (cancelled) {
                return;
            }
            setPlans(loadedPlans);
            if (activePlanId && !loadedPlans.some(plan => plan.id === activePlanId)) {
                setActivePlanId(null);
            }
        };
        void loadPlans();
        return () => {
            cancelled = true;
        };
    }, [desktopId]);

    const createPlan = async (title: string, description?: string, phases: PhaseInput[] = []) => {
        const plan = await planningService.createPlan(desktopId, title, description ?? '', phases);
        setPlans((prev: Plan[]) => [...prev, plan]);
        setActivePlanId(plan.id);
        return plan.id;
    };

    const updatePlan = async (planId: string, updates: { title?: string; description?: string }) => {
        const updated = await planningService.updatePlan(desktopId, planId, updates);
        if (!updated) {
            return false;
        }
        setPlans((prev: Plan[]) =>
            prev.map((plan: Plan) => {
                if (plan.id !== planId) {
                    return plan;
                }
                return {
                    ...plan,
                    title: updates.title ?? plan.title,
                    description: updates.description ?? plan.description
                };
            })
        );
        return true;
    };

    const deletePlan = async (planId: string) => {
        const removed = await planningService.deletePlan(desktopId, planId);
        if (!removed) {
            return false;
        }
        setPlans((prev: Plan[]) => prev.filter((plan: Plan) => plan.id !== planId));
        if (activePlanId === planId) {
            setActivePlanId(null);
        }
        return true;
    };

    const openPlan = async (planId: string) => {
        const exists = plans.some(plan => plan.id === planId);
        if (exists) {
            setActivePlanId(planId);
        }
        return exists;
    };

    const closePlan = () => {
        setActivePlanId(null);
    };

    const addPhase = async (title: string, description?: string, tasks: TaskInput[] = []) => {
        const planId = activePlanId;
        if (!planId) {
            return null;
        }
        const phase = await planningService.addPhase(desktopId, planId, title, description ?? '', tasks);
        if (!phase) {
            return null;
        }
        setPlans((prev: Plan[]) =>
            prev.map((plan: Plan) => {
                if (plan.id !== planId) {
                    return plan;
                }
                return {
                    ...plan,
                    phases: [...plan.phases, phase]
                };
            })
        );
        return phase.id;
    };

    const findPhaseLocation = (phaseId: string): { planId: string; phaseId: string } | null => {
        for (const plan of plans) {
            const phase = plan.phases.find(item => item.id === phaseId);
            if (phase) {
                return { planId: plan.id, phaseId: phase.id };
            }
        }
        return null;
    };

    const deletePhase = async (phaseId: string) => {
        const location = findPhaseLocation(phaseId);
        if (!location) {
            return false;
        }
        const { planId } = location;
        const deleted = await planningService.deletePhase(desktopId, phaseId);
        if (!deleted) {
            return false;
        }
        setPlans((prev: Plan[]) =>
            prev.map((plan: Plan) => {
                if (plan.id !== planId) {
                    return plan;
                }
                const nextPhases = plan.phases.filter((phase: Phase) => phase.id !== phaseId);
                return { ...plan, phases: nextPhases };
            })
        );
        return true;
    };

    const completePhase = async (phaseId: string) => {
        const location = findPhaseLocation(phaseId);
        if (!location) {
            return false;
        }
        const { planId } = location;
        const completed = await planningService.completePhase(desktopId, phaseId);
        if (!completed) {
            return false;
        }
        setPlans((prev: Plan[]) =>
            prev.map((plan: Plan) => {
                if (plan.id !== planId) {
                    return plan;
                }
                const nextPhases = plan.phases.map((phase: Phase) => {
                    if (phase.id !== phaseId) {
                        return phase;
                    }
                    const nextTasks = phase.tasks.map((task: TaskItem) => ({
                        ...task,
                        status: 'completed' as TaskStatus
                    }));
                    return { ...phase, status: 'completed' as TaskStatus, tasks: nextTasks };
                });
                return { ...plan, phases: nextPhases };
            })
        );
        return true;
    };

    const addTask = async (phaseId: string, title: string, description?: string) => {
        const location = findPhaseLocation(phaseId);
        if (!location) {
            return null;
        }
        const { planId } = location;
        const task = await planningService.addTask(desktopId, phaseId, title, description ?? '');
        if (!task) {
            return null;
        }
        setPlans((prev: Plan[]) =>
            prev.map((plan: Plan) => {
                if (plan.id !== planId) {
                    return plan;
                }
                const nextPhases = plan.phases.map((phase: Phase) => {
                    if (phase.id !== phaseId) {
                        return phase;
                    }
                    return { ...phase, tasks: [...phase.tasks, task] };
                });
                return { ...plan, phases: nextPhases };
            })
        );
        return task.id;
    };

    const findTaskLocation = (taskId: string): { planId: string; phaseId: string } | null => {
        for (const plan of plans) {
            for (const phase of plan.phases) {
                if (phase.tasks.some(task => task.id === taskId)) {
                    return { planId: plan.id, phaseId: phase.id };
                }
            }
        }
        return null;
    };

    const updateTask = (
        taskId: string,
        updates: { title?: string; description?: string }
    ) => {
        const run = async () => {
            const location = findTaskLocation(taskId);
            if (!location) {
                return false;
            }
            const { planId, phaseId } = location;
            const updated = await planningService.updateTask(desktopId, taskId, updates);
            if (!updated) {
                return false;
            }
            setPlans((prev: Plan[]) =>
                prev.map((plan: Plan) => {
                    if (plan.id !== planId) {
                        return plan;
                    }
                    const nextPhases = plan.phases.map((phase: Phase) => {
                        if (phase.id !== phaseId) {
                            return phase;
                        }
                        const nextTasks = phase.tasks.map((task: TaskItem) => {
                            if (task.id !== taskId) {
                                return task;
                            }
                            return {
                                ...task,
                                title: updates.title ?? task.title,
                                description: updates.description ?? task.description
                            };
                        });
                        return { ...phase, tasks: nextTasks };
                    });
                    return { ...plan, phases: nextPhases };
                })
            );
            return true;
        };
        return run();
    };

    const deleteTask = async (taskId: string) => {
        const location = findTaskLocation(taskId);
        if (!location) {
            return false;
        }
        const { planId, phaseId } = location;
        const deleted = await planningService.deleteTask(desktopId, taskId);
        if (!deleted) {
            return false;
        }
        setPlans((prev: Plan[]) =>
            prev.map((plan: Plan) => {
                if (plan.id !== planId) {
                    return plan;
                }
                const nextPhases = plan.phases.map((phase: Phase) => {
                    if (phase.id !== phaseId) {
                        return phase;
                    }
                    const nextTasks = phase.tasks.filter((task: TaskItem) => task.id !== taskId);
                    return { ...phase, tasks: nextTasks };
                });
                return { ...plan, phases: nextPhases };
            })
        );
        return true;
    };

    const completeTask = async (taskId: string) => {
        const location = findTaskLocation(taskId);
        if (!location) {
            return false;
        }
        const { planId, phaseId } = location;
        const completed = await planningService.completeTask(desktopId, taskId);
        if (!completed) {
            return false;
        }
        setPlans((prev: Plan[]) =>
            prev.map((plan: Plan) => {
                if (plan.id !== planId) {
                    return plan;
                }
                const nextPhases = plan.phases.map((phase: Phase) => {
                    if (phase.id !== phaseId) {
                        return phase;
                    }
                    const nextTasks = phase.tasks.map((task: TaskItem) => {
                        if (task.id !== taskId) {
                            return task;
                        }
                        return { ...task, status: 'completed' as TaskStatus };
                    });
                    return { ...phase, tasks: nextTasks };
                });
                return { ...plan, phases: nextPhases };
            })
        );
        return true;
    };

    const planListName = activePlan ? 'Plan List (Active Plan Open)' : 'Plan List';
    const planDetailName = activePlan ? `Plan: ${activePlan.title}` : 'Plan Detail';

    return (
        <>
            <View id="root" type="Root" name="Root">
                <RootView
                    plans={plans}
                    activePlanId={activePlanId}
                    createPlan={createPlan}
                    updatePlan={updatePlan}
                    deletePlan={deletePlan}
                    openPlan={openPlan}
                    closePlan={closePlan}
                    addPhase={addPhase}
                    deletePhase={deletePhase}
                    completePhase={completePhase}
                    addTask={addTask}
                    updateTask={updateTask}
                    deleteTask={deleteTask}
                    completeTask={completeTask}
                />
            </View>

            <View id="plan_list" type="PlanList" name={planListName}>
                <PlanListView plans={plans} activePlanId={activePlanId} />
            </View>

            {activePlan ? (
                <View id="plan_detail" type="PlanDetail" name={planDetailName}>
                    <PlanDetailView plan={activePlan} />
                </View>
            ) : null}
        </>
    );
}

export default createTUIApp({
    app_name: 'planning_app',
    whatItIs: 'A hierarchical task planning and progress tracking system that organizes work into three levels: Plans (projects), Phases (major milestones), and Tasks (individual work items). Each level supports full CRUD operations and tracks completion status. All data is persisted per-desktop using SQLite.',
    whenToUse: 'Use Planning App when you need to: (1) Break down complex projects into manageable phases and tasks, (2) Track progress across multiple work streams or milestones, (3) Create structured, hierarchical work plans with descriptions and metadata, (4) Monitor completion status at plan, phase, and task levels, (5) Organize iterative development with clear phases and actionable tasks.',
    component: PlanningApp,
    onDelete: async (context: AppContext) => {
        await planningService.clearDesktop(context.desktopId);
        planningService.close();
    }
});
