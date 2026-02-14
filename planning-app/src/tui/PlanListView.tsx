import { useArrayRef, useDataRef } from '@aotui/sdk';
import type { Plan } from '../types.js';

type PlanListViewProps = {
    plans: Plan[];
    activePlanId: string | null;
};

const isPlanCompleted = (plan: Plan) => {
    if (plan.phases.length === 0) {
        return false;
    }
    return plan.phases.every(phase => phase.status === 'completed');
};

export function PlanListView({ plans, activePlanId }: PlanListViewProps) {
    const unfinishedPlans = plans.filter(plan => !isPlanCompleted(plan));
    const activePlan = plans.find(plan => plan.id === activePlanId) || null;

    const activePlanRef = useDataRef('active_plan', activePlan ?? { title: 'No Active Plan' });
    const [, unfinishedPlanRef] = useArrayRef('unfinished_plans', unfinishedPlans, { itemType: 'Plan' });

    return (
        <div>
            <h1>Plan List</h1>
            <p>Only one plan can be open at a time.</p>
            {activePlan ? (
                <div>
                    <h2>Active Plan</h2>
                    <p>{activePlanRef(activePlan.title)}</p>
                </div>
            ) : (
                <p>No active plan.</p>
            )}
            <h2>Unfinished Plans</h2>
            {unfinishedPlans.length === 0 ? (
                <p>No unfinished plans.</p>
            ) : (
                <ul>
                    {unfinishedPlans.map((plan, index) => {
                        const completedCount = plan.phases.filter(phase => phase.status === 'completed').length;
                        const totalCount = plan.phases.length;
                        return (
                            <li key={plan.id}>
                                <div>
                                    <strong>{unfinishedPlanRef(index, plan.title)}</strong>
                                </div>
                                <div>
                                    Phases completed: {completedCount}/{totalCount}
                                </div>
                                {plan.description ? <div>{plan.description}</div> : null}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
