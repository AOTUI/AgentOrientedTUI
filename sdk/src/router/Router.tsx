import { useState, useMemo, useEffect } from 'preact/hooks';
import { RouterContext, type Location, type Navigator } from './context.js';
import { createMemoryHistory, type MemoryHistory } from './history.js';
import type { ComponentChildren, VNode } from 'preact';

export interface RouteProps {
    path: string;
    component: (props: any) => VNode;
}

export function Route(_props: RouteProps) {
    return null; // Logic handled by Router
}

export interface RouterProps {
    initialEntries?: string[];
    initialIndex?: number;
    children: ComponentChildren;
}

export function Router({ initialEntries = ['/'], initialIndex = 0, children }: RouterProps) {
    // 1. Create History (stable instance)
    const history = useMemo(() => createMemoryHistory({
        initialEntries,
        initialIndex
    }), []);

    // 2. Subscribe to History changes
    const [location, setLocation] = useState<Location>(history.location);

    useEffect(() => {
        return history.listen((update) => {
            setLocation(update.location);
        });
    }, [history]);

    // 3. Route Matching
    // Flatten children to find Routes
    const routes = useMemo(() => {
        const routeList: { path: string; component: any }[] = [];
        const processChildren = (nodes: ComponentChildren) => {
            if (Array.isArray(nodes)) {
                nodes.forEach(processChildren);
            } else if (nodes && typeof nodes === 'object' && 'props' in nodes) {
                const vnode = nodes as any;
                // Check if it's a Route component (by checking props or type name if possible, 
                // but usually we rely on structure. For now, assume direct children are Routes or fragments)
                if (vnode.props.path && vnode.props.component) {
                    routeList.push({
                        path: vnode.props.path,
                        component: vnode.props.component
                    });
                }
            }
        };
        processChildren(children);
        return routeList;
    }, [children]);

    // Simple Matcher
    const { component: Component, params } = useMemo(() => {
        for (const route of routes) {
            const match = matchPath(route.path, location.pathname);
            if (match) {
                return { component: route.component, params: match.params };
            }
        }
        return { component: () => null, params: {} }; // 404 Not Found
    }, [routes, location.pathname]);

    // 4. Create Context
    const navigate: Navigator = (toOrDelta: string | number, options?: any) => {
        if (typeof toOrDelta === 'number') {
            history.go(toOrDelta);
        } else {
            if (options && options.replace) {
                history.replace(toOrDelta, options.state);
            } else {
                history.push(toOrDelta, options && options.state);
            }
        }
    };

    const ctxValue = {
        location,
        navigate,
        params
    };

    return (
        // @ts-ignore: Preact Context Provider
        <RouterContext.Provider value={ctxValue}>
            <Component />
        </RouterContext.Provider>
    );
}

// Helper: Simple path matcher
// Supports /users/:id
function matchPath(routePath: string, currentPath: string): { params: Record<string, string> } | null {
    const routeParts = routePath.split('/').filter(Boolean);
    const currentParts = currentPath.split('/').filter(Boolean);

    if (routeParts.length !== currentParts.length) {
        // Simple exact length check. 
        // TODO: Support wildcards * or optional params if needed.
        return null; 
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < routeParts.length; i++) {
        const routePart = routeParts[i];
        const currentPart = currentParts[i];

        if (routePart.startsWith(':')) {
            const paramName = routePart.slice(1);
            params[paramName] = currentPart;
        } else if (routePart !== currentPart) {
            return null;
        }
    }

    return { params };
}
