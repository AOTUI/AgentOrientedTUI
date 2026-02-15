/**
 * ViewBlock Component
 * 
 * Renders a single <view> block with its content.
 * Uses dashed border to distinguish from application blocks.
 * 
 * @module system-chat/gui/components/ViewBlock
 */
import type { TuiView } from './TuiParser.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';

interface ViewBlockProps {
    view: TuiView;
}

export function ViewBlock({ view }: ViewBlockProps) {
    return (
        <div className="tui-block tui-block--view">
            {/* View Header */}
            <div className="tui-block__header tui-block__header--view">
                <div className="tui-block__title-group">
                    <span className="tui-block__label">VIEW</span>
                    <span className="tui-block__name">{view.name}</span>
                </div>
                <div className="tui-block__meta">
                    <span className="tui-block__id">{view.id}</span>
                    <span className="status-badge status-badge--mounted">MOUNTED</span>
                </div>
            </div>

            {/* View Content */}
            <MarkdownRenderer
                content={view.content}
                className="tui-block__content tui-markdown"
            />
        </div>
    );
}
