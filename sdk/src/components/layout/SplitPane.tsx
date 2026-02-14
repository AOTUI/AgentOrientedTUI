import { ComponentChildren } from 'preact';

export interface SplitPaneProps {
    direction: 'horizontal' | 'vertical';
    sizes?: number[]; // Percentages, e.g. [30, 70]
    children: ComponentChildren;
}

export function SplitPane({ direction, sizes, children }: SplitPaneProps) {
    const isHorizontal = direction === 'horizontal';
    const childrenArray = Array.isArray(children) ? children : [children];
    
    return (
        <div style={{
            display: 'flex',
            flexDirection: isHorizontal ? 'row' : 'column',
            width: '100%',
            height: '100%'
        }}>
            {childrenArray.map((child, index) => {
                const size = sizes && sizes[index] ? `${sizes[index]}%` : '100%';
                return (
                    <div style={{
                        flex: sizes ? `0 0 ${size}` : 1,
                        overflow: 'hidden',
                        // Basic border for visual separation in TUI
                        borderRight: isHorizontal && index < childrenArray.length - 1 ? '1px solid gray' : 'none',
                        borderBottom: !isHorizontal && index < childrenArray.length - 1 ? '1px solid gray' : 'none'
                    }}>
                        {child}
                    </div>
                );
            })}
        </div>
    );
}
