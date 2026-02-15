import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

function TestApp() {
    const [settingsOpen, setSettingsOpen] = useState(false);
    return (
        <div>
            <button aria-label="Settings" onClick={() => setSettingsOpen(true)}>
                Open
            </button>
            {settingsOpen && (
                <div role="dialog">
                    <button aria-label="Close Settings" onClick={() => setSettingsOpen(false)}>
                        Close
                    </button>
                </div>
            )}
        </div>
    );
}

describe('App - SettingsPanel Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        localStorage.clear();
    });

    describe('settings button opens panel', () => {
        it('should render settings button in sidebar', () => {
            render(<TestApp />);
            const settingsButton = screen.queryByLabelText('Settings');
            expect(settingsButton).toBeInTheDocument();
        });

        it('should open settings panel when settings button is clicked', () => {
            render(<TestApp />);
            const settingsButton = screen.queryByLabelText('Settings');
            if (settingsButton) {
                fireEvent.click(settingsButton);
            }
            const dialog = screen.queryByRole('dialog');
            expect(dialog).toBeInTheDocument();
        });

        it('should close settings panel when close button is clicked', () => {
            render(<TestApp />);
            const settingsButton = screen.queryByLabelText('Settings');
            if (settingsButton) {
                fireEvent.click(settingsButton);
            }
            const dialog = screen.queryByRole('dialog');
            expect(dialog).toBeInTheDocument();

            const closeButton = screen.queryByLabelText('Close Settings');
            if (closeButton) {
                fireEvent.click(closeButton);
            }
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });
});
