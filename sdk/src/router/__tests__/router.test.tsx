import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/preact';
import { Router, Route } from '../Router.js';
import { useNavigate, useParams } from '../context.js';
import { h } from 'preact';
import { useEffect } from 'preact/hooks';

// Helper component to display location
function LocationDisplay() {
    // We need to access context, but RouterContext is not exported for direct use in tests easily
    // Let's use a hook if available, or just render something that proves navigation
    return <div data-testid="location">Location Display</div>;
}

describe('Router', () => {
    it('should render matching route', () => {
        const { getByText } = render(
            <Router initialEntries={['/home']}>
                <Route path="/home" component={() => <div>Home Page</div>} />
                <Route path="/about" component={() => <div>About Page</div>} />
            </Router>
        );
        expect(getByText('Home Page')).toBeDefined();
    });

    it('should handle navigation', async () => {
        function Home() {
            const navigate = useNavigate();
            return <button onClick={() => navigate('/about')}>Go to About</button>;
        }

        const { getByText, findByText } = render(
            <Router initialEntries={['/']}>
                <Route path="/" component={Home} />
                <Route path="/about" component={() => <div>About Page</div>} />
            </Router>
        );

        const button = getByText('Go to About');
        button.click();

        expect(await findByText('About Page')).toBeDefined();
    });

    it('should handle params', () => {
        function User() {
            const { id } = useParams();
            return <div>User {id}</div>;
        }

        const { getByText } = render(
            <Router initialEntries={['/users/123']}>
                <Route path="/users/:id" component={User} />
            </Router>
        );

        expect(getByText('User 123')).toBeDefined();
    });
});
