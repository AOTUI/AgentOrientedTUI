/**
 * TUI Snapshot Parser
 * 
 * Parses TUI snapshot XML format into structured data for rendering.
 * Handles <desktop>, <application>, <view> blocks with their attributes.
 * 
 * @module system-chat/gui/components/TuiParser
 */

// ============ Type Definitions ============

export interface TuiDesktop {
    content: string;
    applications: TuiApplication[];
}

export interface TuiApplication {
    id: string;
    name: string;
    infoContent: string;      // <application_info> 内容
    views: TuiView[];
    rawContent: string;       // 原始内容（不含 views）
}

export interface TuiView {
    id: string;
    name: string;
    content: string;
}

export interface ParsedTuiSnapshot {
    desktop: TuiDesktop | null;
    parseErrors: string[];
}

// ============ Parser Functions ============

/**
 * Parse a TUI snapshot string into structured data
 */
export function parseTuiSnapshot(snapshot: string): ParsedTuiSnapshot {
    const errors: string[] = [];

    if (!snapshot || snapshot.trim() === '') {
        return { desktop: null, parseErrors: ['Empty snapshot'] };
    }

    try {
        const desktop = parseDesktop(snapshot);
        return { desktop, parseErrors: errors };
    } catch (e) {
        errors.push(`Parse error: ${e instanceof Error ? e.message : String(e)}`);
        return { desktop: null, parseErrors: errors };
    }
}

/**
 * Parse <desktop> block
 */
function parseDesktop(snapshot: string): TuiDesktop | null {
    // Match <desktop> ... </desktop>
    const desktopMatch = snapshot.match(/<desktop>([\s\S]*?)<\/desktop>/);

    if (!desktopMatch) {
        // No desktop block, treat entire content as desktop
        return {
            content: snapshot,
            applications: parseApplications(snapshot)
        };
    }

    const desktopContent = desktopMatch[1].trim();

    // Parse applications from the rest of the snapshot (outside desktop block)
    const afterDesktop = snapshot.slice(snapshot.indexOf('</desktop>') + '</desktop>'.length);
    const applications = parseApplications(afterDesktop);

    return {
        content: desktopContent,
        applications
    };
}

/**
 * Parse all <application> blocks
 */
function parseApplications(content: string): TuiApplication[] {
    const applications: TuiApplication[] = [];

    const appRegex = /<application\b([^>]*)>([\s\S]*?)<\/application>/g;

    let match;
    while ((match = appRegex.exec(content)) !== null) {
        const [, attrText, appContent] = match;
        const idMatch = attrText.match(/\bid="([^"]+)"/);
        const nameMatch = attrText.match(/\bname="([^"]*)"/);
        const id = idMatch?.[1];
        const name = nameMatch?.[1] ?? id ?? '';
        if (!id) continue;

        const infoMatch = appContent.match(/<application_info>([\s\S]*?)<\/application_info>/);
        const infoContent = infoMatch ? infoMatch[1].trim() : '';

        const views = parseViews(appContent);

        let rawContent = appContent;
        if (infoMatch) {
            rawContent = rawContent.replace(/<application_info>[\s\S]*?<\/application_info>/, '');
        }
        rawContent = rawContent.replace(/<view[\s\S]*?<\/view>/g, '').trim();

        applications.push({
            id,
            name,
            infoContent,
            views,
            rawContent
        });
    }

    return applications;
}

/**
 * Parse all <view> blocks
 */
function parseViews(content: string): TuiView[] {
    const views: TuiView[] = [];

    const viewRegex = /<view\b([^>]*)>([\s\S]*?)<\/view>/g;

    let match;
    while ((match = viewRegex.exec(content)) !== null) {
        const [, attrText, viewContent] = match;
        const idMatch = attrText.match(/\bid="([^"]+)"/);
        const nameMatch = attrText.match(/\bname="([^"]*)"/);
        const id = idMatch?.[1];
        const name = nameMatch?.[1] ?? id ?? '';
        if (!id) continue;

        views.push({
            id,
            name,
            content: viewContent.trim()
        });
    }

    return views;
}

// ============ Helper Functions ============

/**
 * Extract status from application info (e.g., "RUNNING", "MOUNTED")
 */
export function extractStatus(infoContent: string): 'running' | 'closed' | 'collapsed' {
    if (infoContent.toLowerCase().includes('running')) return 'running';
    if (infoContent.toLowerCase().includes('closed')) return 'closed';
    return 'running'; // Default
}

/**
 * Extract recent operations from application info
 */
export function extractRecentOperations(infoContent: string): string[] {
    const operations: string[] = [];
    const opSection = infoContent.match(/## Recent Operations([\s\S]*?)(?=##|$)/);

    if (opSection) {
        const lines = opSection[1].split('\n').filter(line => line.trim().startsWith('-'));
        operations.push(...lines.map(l => l.replace(/^-\s*/, '').trim()));
    }

    return operations;
}

/**
 * Extract view tree from application info
 */
export function extractViewTree(infoContent: string): string {
    const treeSection = infoContent.match(/## Application View Tree([\s\S]*?)(?=<\/application_info>|##|$)/);
    return treeSection ? treeSection[1].trim() : '';
}

// ============ Desktop Content Extraction ============

export interface InstalledApp {
    name: string;
    id: string;
    status: 'running' | 'stopped' | 'pending';
}

export interface SystemLog {
    timestamp: string;
    message: string;
}

/**
 * Extract installed applications from desktop content
 */
/**
 * Extract installed applications (Running)
 */
export function extractInstalledApps(desktopContent: string): InstalledApp[] {
    const apps: InstalledApp[] = [];
    // Match "### Running Applications" specifically (level 3 header)
    const section = desktopContent.match(/(?:^|\n)### Running Applications([\s\S]*?)(?=(?:^|\n)#{2,3} |$)/);

    if (!section) return apps;

    const appRegex = /- \[([^\]]+)\]\(application:(app_\d+)\)[\s\S]*?- State: (\w+)/g;
    let match;

    while ((match = appRegex.exec(section[1])) !== null) {
        apps.push({
            name: match[1],
            id: match[2],
            status: match[3].toLowerCase() === 'running' ? 'running' : 'stopped'
        });
    }

    return apps;
}

/**
 * Extract pending applications (Available / Not Started)
 */
export function extractPendingApps(desktopContent: string): InstalledApp[] {
    const apps: InstalledApp[] = [];
    // Match "### Available Applications (Not Started)"
    const section = desktopContent.match(/(?:^|\n)#{2,3} Available Applications([\s\S]*?)(?=(?:^|\n)#{2,3}|$)/);

    if (!section) return apps;

    // Match simpler format: - [AppName](application:app_xxx) - State: pending
    const appRegex = /- \[([^\]]+)\]\(application:(app_\d+)\)[\s\S]*?- State: (\w+)/g;
    let match;

    while ((match = appRegex.exec(section[1])) !== null) {
        apps.push({
            name: match[1],
            id: match[2],
            status: 'pending'
        });
    }
    return apps;
}

/**
 * Extract system logs from desktop content
 */
export function extractSystemLogs(desktopContent: string): SystemLog[] {
    const logs: SystemLog[] = [];
    const section = desktopContent.match(/(?:^|\n)#{2,3} System Logs([\s\S]*?)(?=(?:^|\n)#{2,3}|$)/);

    if (!section) return logs;

    const logRegex = /-\s*\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\s*(.+)/g;
    let match;

    while ((match = logRegex.exec(section[1])) !== null) {
        logs.push({
            timestamp: match[1],
            message: match[2].trim()
        });
    }

    return logs;
}

/**
 * Extract system instructions section
 */
export function extractSystemInstructions(desktopContent: string): string {
    const match = desktopContent.match(/(?:^|\n)#{2,3} (?:Running|Installed) Applications/);
    if (!match || match.index === undefined) return desktopContent;
    return desktopContent.substring(0, match.index).trim();
}

/**
 * Get app icon emoji
 */
export function getAppIcon(appName: string): string {
    const name = appName.toLowerCase();
    if (name.includes('chat')) return '💬';
    if (name.includes('todo')) return '📋';
    if (name.includes('thought') || name.includes('recorder')) return '💭';
    if (name.includes('log')) return '📜';
    if (name.includes('file')) return '📁';
    if (name.includes('setting')) return '⚙️';
    return '📦';
}
