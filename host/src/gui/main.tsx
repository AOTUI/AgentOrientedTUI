/**
 * system-chat GUI - Main Entry
 */
import { createRoot } from 'react-dom/client';
import { HeroUIProvider } from '@heroui/react';
import { App } from './App.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import './styles/index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(
        <ErrorBoundary>
            <HeroUIProvider>
                <App />
            </HeroUIProvider>
        </ErrorBoundary>
    );
}