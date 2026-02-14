import { ComponentChildren } from 'preact';

export interface BoxProps {
    children?: ComponentChildren;
    flex?: number | string;
    flexDirection?: 'row' | 'column';
    padding?: number | string;
    border?: string;
    width?: string | number;
    height?: string | number;
    style?: any;
}

export function Box({ children, flex, flexDirection, padding, border, width, height, style }: BoxProps) {
    return (
        <div style={{
            display: 'flex',
            flexDirection,
            flex,
            padding,
            border,
            width,
            height,
            boxSizing: 'border-box',
            ...style
        }}>
            {children}
        </div>
    );
}
