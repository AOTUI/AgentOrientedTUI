/**
 * AOTUI SDK - Factory Pattern
 *
 * Unified factory interface for Views, Apps, and future factory types.
 * Enables consistent detection and handling of all AOTUI factories.
 *
 * [Phase 2 Task 2.2] Factory Pattern Unification
 *
 * @module @aotui/sdk/factory
 */

// ============================================================================
// Factory Symbol - Runtime Type Tag
// ============================================================================

/**
 * Symbol tag for AOTUI factories.
 *
 * Used to detect if an object is an AOTUI factory at runtime.
 * Uses Symbol.for() to ensure consistency across module boundaries.
 */
export const TUI_FACTORY = Symbol.for("aotui:factory");

// ============================================================================
// Factory Type Enum
// ============================================================================

/**
 * Type of factory - used for type discrimination.
 */
export type FactoryType = "view" | "app";

// ============================================================================
// Factory Interface - Unified Contract
// ============================================================================

/**
 * Unified Factory interface.
 *
 * All AOTUI factories (View, App) implement this interface.
 * The create() method instantiates the target object.
 *
 * @template T - The type created by this factory
 *
 * @example
 * ```typescript
 * // Check if something is a factory
 * if (isFactory(obj)) {
 *     const instance = obj.create('some-id');
 * }
 *
 * // Type-specific check
 * if (isViewFactory(obj)) {
 *     const view = obj.create('view_0', props);
 * }
 * ```
 */
export interface Factory<T> {
  /** Factory type tag */
  readonly [TUI_FACTORY]: FactoryType;

  /**
   * Display name for debugging and tree output.
   *
   * For ViewFactory: the view name (e.g., 'ChatView')
   * For AppFactory: the app name (e.g., 'System Chat')
   */
  readonly displayName?: string;

  /**
   * Create an instance.
   *
   * For ViewFactory: create(id: string, props?: Record<string, unknown>) => IView
   * For AppFactory: create() => IAOTUIApp
   */
  create: (...args: any[]) => T;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an object is an AOTUI factory.
 */
export function isFactory(obj: unknown): obj is Factory<unknown> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    TUI_FACTORY in obj &&
    typeof (obj as any).create === "function"
  );
}

/**
 * Check if a factory is a View factory.
 */
export function isViewFactory(
  obj: unknown,
): obj is Factory<unknown> & { [TUI_FACTORY]: "view" } {
  return isFactory(obj) && obj[TUI_FACTORY] === "view";
}

/**
 * Check if a factory is an App factory.
 */
export function isAppFactory(
  obj: unknown,
): obj is Factory<unknown> & { [TUI_FACTORY]: "app" } {
  return isFactory(obj) && obj[TUI_FACTORY] === "app";
}

// ============================================================================
// Factory Wrapper - Backward Compatibility Helper
// ============================================================================

/**
 * Create a callable factory that is both a function AND an object.
 *
 * This enables backward compatibility:
 * - Old way: `const view = MyViewFactory('view_0')` (call as function)
 * - New way: `const view = MyViewFactory.create('view_0')` (call create method)
 *
 * Uses Proxy to intercept function calls and redirect to create().
 */
export function createCallableFactory<T, Args extends any[]>(
  type: FactoryType,
  displayName: string,
  createFn: (...args: Args) => T,
): Factory<T> & ((...args: Args) => T) {
  // Create the factory object
  const factory: Factory<T> = {
    [TUI_FACTORY]: type,
    displayName,
    create: createFn,
  };

  // We must use a function as the target for the Proxy to be callable.
  // The properties will be accessed via the 'get' trap.
  const proxyTarget = function () { } as unknown as Factory<T> & ((...args: Args) => T);

  // Create a proxy that allows both:
  // - factory(id, props) -> calls create()
  // - factory.create(id, props) -> calls create() directly
  return new Proxy(proxyTarget, {
    // Intercept function call syntax: factory(id, props)
    apply(_target, _thisArg, args: Args) {
      return createFn(...args);
    },

    // Pass through property access to the internal factory object
    get(_target, prop) {
      // If the property exists on the factory object, return it
      if (prop in factory) {
        return (factory as any)[prop];
      }
      return undefined;
    },

    // Allow property checks to work
    has(_target, prop) {
      return prop in factory;
    },

    // Support correct instanceof checks if needed (optional)
    getPrototypeOf() {
      return Object.getPrototypeOf(factory);
    }
  });
}
