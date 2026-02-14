import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { planningService } from '../src/core/planning-service.js';

const TEST_DESKTOP = 'planning_test_desktop_1';
const OTHER_DESKTOP = 'planning_test_desktop_2';

describe('planning service with sqlite', () => {
    beforeAll(async () => {
        await planningService.init();
        await planningService.clearDesktop(TEST_DESKTOP);
        await planningService.clearDesktop(OTHER_DESKTOP);
    });

    afterAll(() => {
        planningService.close();
    });

    it('creates plan, phase, and todo', async () => {
        const plan = await planningService.createPlan(TEST_DESKTOP, 'Plan A', 'Desc A');
        const phase = await planningService.addPhase(TEST_DESKTOP, plan.id, 'Phase 1', 'P1');
        if (!phase) {
            throw new Error('phase not created');
        }
        const todo = await planningService.addTodo(TEST_DESKTOP, plan.id, phase.id, 'Todo 1', 'T1');
        if (!todo) {
            throw new Error('todo not created');
        }

        const plans = await planningService.getPlans(TEST_DESKTOP);
        expect(plans.length).toBe(1);
        expect(plans[0].phases.length).toBe(1);
        expect(plans[0].phases[0].todos.length).toBe(1);
    });

    it('creates plan with phases and todos in one call', async () => {
        const plan = await planningService.createPlan(TEST_DESKTOP, 'Plan Bulk', 'Desc Bulk', [
            {
                title: 'Phase A',
                description: 'Phase A Desc',
                todos: [
                    { title: 'Todo A1', description: 'Todo A1 Desc' },
                    { title: 'Todo A2' }
                ]
            },
            {
                title: 'Phase B',
                todos: [{ title: 'Todo B1' }]
            }
        ]);

        const plans = await planningService.getPlans(TEST_DESKTOP);
        const created = plans.find(item => item.id === plan.id);
        expect(created?.phases.length).toBe(2);
        expect(created?.phases[0].todos.length).toBe(2);
        expect(created?.phases[1].todos.length).toBe(1);
    });

    it('adds phase with todos in one call', async () => {
        const plan = await planningService.createPlan(TEST_DESKTOP, 'Plan Phase Bulk', 'Desc');
        const phase = await planningService.addPhase(TEST_DESKTOP, plan.id, 'Phase Bulk', 'Phase Desc', [
            { title: 'Todo 1', description: 'Todo 1 Desc' },
            { title: 'Todo 2' }
        ]);
        expect(phase?.todos.length).toBe(2);
        const plans = await planningService.getPlans(TEST_DESKTOP);
        const created = plans.find(item => item.id === plan.id);
        expect(created?.phases.length).toBe(1);
        expect(created?.phases[0].todos.length).toBe(2);
    });

    it('isolates data by desktop', async () => {
        await planningService.createPlan(OTHER_DESKTOP, 'Other Plan');
        const plans = await planningService.getPlans(TEST_DESKTOP);
        const otherPlans = await planningService.getPlans(OTHER_DESKTOP);
        expect(plans.every(plan => plan.title !== 'Other Plan')).toBe(true);
        expect(otherPlans.some(plan => plan.title === 'Other Plan')).toBe(true);
    });

    it('completes todo and phase', async () => {
        const plans = await planningService.getPlans(TEST_DESKTOP);
        const plan = plans.find(item => item.title === 'Plan A') ?? plans[0];
        const phase = plan.phases[0];
        const todo = phase.todos[0];
        const todoCompleted = await planningService.completeTodo(TEST_DESKTOP, plan.id, phase.id, todo.id);
        expect(todoCompleted).toBe(true);
        const phaseCompleted = await planningService.completePhase(TEST_DESKTOP, plan.id, phase.id);
        expect(phaseCompleted).toBe(true);

        const updated = await planningService.getPlans(TEST_DESKTOP);
        const updatedPhase = updated[0].phases[0];
        expect(updatedPhase.status).toBe('completed');
        expect(updatedPhase.todos.every(item => item.status === 'completed')).toBe(true);
    });

    it('deletes plan with phases and todos', async () => {
        const plans = await planningService.getPlans(TEST_DESKTOP);
        for (const plan of plans) {
            const deleted = await planningService.deletePlan(TEST_DESKTOP, plan.id);
            expect(deleted).toBe(true);
        }
        const updated = await planningService.getPlans(TEST_DESKTOP);
        expect(updated.length).toBe(0);
    });
});
