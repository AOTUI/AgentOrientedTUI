import { useArrayRef, useDataRef } from '@aotui/sdk';
import type { Plan, Phase, TaskItem } from '../types.js';

type PlanDetailViewProps = {
    plan: Plan;
};

const splitPhases = (phases: Phase[]) => {
    const completed: Phase[] = [];
    const pending: Phase[] = [];
    phases.forEach(phase => {
        if (phase.status === 'completed') {
            completed.push(phase);
        } else {
            pending.push(phase);
        }
    });
    const current = pending[0] || null;
    const upcoming = pending.slice(1);
    return { completed, current, upcoming };
};

export function PlanDetailView({ plan }: PlanDetailViewProps) {
    const { completed, current, upcoming } = splitPhases(plan.phases);
    const completedTasks = current ? current.tasks.filter(task => task.status === 'completed') : [];
    const pendingTasks = current ? current.tasks.filter(task => task.status === 'pending') : [];

    const planRef = useDataRef('plan_detail_current', plan);
    const currentPhaseRef = useDataRef('current_phase', current ?? { title: 'No current phase' });
    const [, completedPhaseRef] = useArrayRef('completed_phases', completed, { itemType: 'Phase' });
    const [, pendingTaskRef] = useArrayRef('pending_tasks', pendingTasks, { itemType: 'Task' });
    const [, completedTaskRef] = useArrayRef('completed_tasks', completedTasks, { itemType: 'Task' });
    const [, upcomingPhaseRef] = useArrayRef('upcoming_phases', upcoming, { itemType: 'Phase' });

    const PhaseTaskList = ({ refKey, tasks }: { refKey: string; tasks: TaskItem[] }) => {
        const [, phaseTaskRef] = useArrayRef(refKey, tasks, { itemType: 'Task' });
        if (tasks.length === 0) {
            return <p>No tasks.</p>;
        }
        return (
            <ul>
                {tasks.map((task, index) => (
                    <li key={task.id}>{phaseTaskRef(index, task.title)}</li>
                ))}
            </ul>
        );
    };

    return (
        <div>
            <h1>Plan Detail</h1>
            <h2>{planRef(plan.title)}</h2>
            {plan.description ? <p>{plan.description}</p> : null}

            <h3>Completed Phases</h3>
            {completed.length === 0 ? (
                <p>No completed phases.</p>
            ) : (
                <ul>
                    {completed.map((phase, index) => {
                        return (
                            <li key={phase.id}>
                                <div>{completedPhaseRef(index, phase.title)}</div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <h3>Current Phase</h3>
            {current ? (
                <div>
                    <h4>{currentPhaseRef(current.title)}</h4>
                    {current.description ? <p>{current.description}</p> : null}

                    <h5>Pending Tasks</h5>
                    {pendingTasks.length === 0 ? (
                        <p>No pending tasks.</p>
                    ) : (
                        <ul>
                            {pendingTasks.map((task, index) => (
                                <li key={task.id}>{pendingTaskRef(index, task.title)}</li>
                            ))}
                        </ul>
                    )}

                    <h5>Completed Tasks</h5>
                    {completedTasks.length === 0 ? (
                        <p>No completed tasks.</p>
                    ) : (
                        <ul>
                            {completedTasks.map((task, index) => (
                                <li key={task.id}>{completedTaskRef(index, task.title)}</li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : (
                <p>No active phase. Add a phase to start.</p>
            )}

            <h3>Upcoming Phases</h3>
            {upcoming.length === 0 ? (
                <p>No upcoming phases.</p>
            ) : (
                <ul>
                    {upcoming.map((phase, index) => {
                        return (
                            <li key={phase.id}>
                                <div>{upcomingPhaseRef(index, phase.title)}</div>
                                <PhaseTaskList refKey={`upcoming_phase_${index}_tasks`} tasks={phase.tasks} />
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
