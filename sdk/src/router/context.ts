import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

export interface Location {
    pathname: string;
    search: string;
    hash: string;
    state?: any;
    key: string;
}

export interface Navigator {
    (to: string, options?: { replace?: boolean; state?: any }): void;
    (delta: number): void;
}

export interface RouterContextValue {
    location: Location;
    navigate: Navigator;
    params: Record<string, string>;
}

export const RouterContext = createContext<RouterContextValue | null>(null);

export function useRouter() {
    const ctx = useContext(RouterContext);
    if (!ctx) {
        throw new Error('useRouter must be used within a <Router>');
    }
    return ctx;
}

export function useNavigate() {
    return useRouter().navigate;
}

export function useLocation() {
    return useRouter().location;
}

export function useParams() {
    return useRouter().params;
}
