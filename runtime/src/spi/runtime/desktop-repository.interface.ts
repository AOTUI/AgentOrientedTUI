import type { DesktopID } from '../core/index.js';
import type { IRuntimeContext } from './context.interface.js';

export interface IDesktopRepository {
    create(desktopId?: DesktopID, context?: IRuntimeContext): Promise<DesktopID>;
    destroy(desktopId: DesktopID): Promise<void>;
    has(desktopId: DesktopID): boolean;
    get(desktopId: DesktopID): import('./kernel.interface.js').IDesktop | undefined;
}
