import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { SplitPane } from '../SplitPane.js';
import { Box } from '../Box.js';
import { h } from 'preact';

describe('Layout Kit', () => {
    describe('SplitPane', () => {
        it('should render horizontal split', () => {
            const { getByText, container } = render(
                <SplitPane direction="horizontal" sizes={[30, 70]}>
                    <div>Left</div>
                    <div>Right</div>
                </SplitPane>
            );

            expect(getByText('Left')).toBeDefined();
            expect(getByText('Right')).toBeDefined();
            
            const parent = container.firstChild as HTMLElement;
            expect(parent.style.flexDirection).toBe('row');
        });

        it('should render vertical split', () => {
            const { container } = render(
                <SplitPane direction="vertical">
                    <div>Top</div>
                    <div>Bottom</div>
                </SplitPane>
            );
            
            const parent = container.firstChild as HTMLElement;
            expect(parent.style.flexDirection).toBe('column');
        });
    });

    describe('Box', () => {
        it('should apply flex styles', () => {
            const { container } = render(
                <Box flex={1} padding={1}>Content</Box>
            );
            
            const div = container.firstChild as HTMLElement;
            // Flex shorthand expansion check
            expect(div.style.flex).toBe('1 1 0%');
            expect(div.style.padding).toBe('1px');
        });
    });
});
