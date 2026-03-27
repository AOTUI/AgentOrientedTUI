# Mobile AI-Native App Framework Design

> Status: In progress. This document is updated continuously during brainstorming so implementation does not drift.
>
> Technical design continuation:
> [2026-03-24-mobile-ai-native-framework-technical-design.md](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/docs/superpowers/specs/2026-03-24-mobile-ai-native-framework-technical-design.md)

## Confirmed Conclusions

### 1. Project Goal

Build a single-app AI-native mobile framework for iPhone.

The framework goal is not to migrate the current desktop TUI app container to React Native.
The goal is to let:

- human users operate the app through GUI
- LLM agents operate the same app through tools
- both paths affect the same App State
- GUI reflects all state changes caused by LLM actions so humans can observe them

### 2. Non-Goals

- Do not migrate the existing desktop `runtime + sdk + apps` architecture as-is.
- Do not prioritize running current TUI apps on iOS.
- Do not redesign the Agent loop here; the mobile side already has an Agent Driver-based implementation.

### 3. Chosen Product Shape

- Target is a single AI-native app framework, not a mobile super-host with multiple sub-apps.
- Agent orchestration should be local-first on iPhone, with cloud model calls only when needed.

### 4. Chosen Tooling Philosophy

- Tools are explicitly declared.
- Tools are not auto-generated from GUI controls.
- GUI and LLM both invoke the same underlying action contracts.

### 5. Chosen Projection Philosophy

GUI and TUI are declared separately, but share the same:

- state
- action contracts
- semantic model

This means:

- developers write GUI JSX for human-facing interaction
- developers write TUI JSX for LLM-facing perception
- both projections are backed by the same App State and action system

### 6. Current Abstract Model

The current agreed model is:

1. `State`
   Single source of truth.

2. `JSX / HTML`
   Authoring layer for interface and semantics.

3. `Projection`
   Human-facing GUI and LLM-facing TUI are two projections over shared state and actions.

4. `Action`
   Human-facing affordances such as buttons, tabs, forms, and search inputs map to explicit actions.
   LLM-facing affordances expose the same actions as tools.

### 7. Chosen Authoring Model

The framework will be `State-first`.

That means the developer workflow should begin with:

1. defining state
2. defining state transitions / actions
3. declaring GUI projection
4. declaring TUI projection

GUI and TUI are therefore downstream consumers of the state model, not the source of truth.

### 8. Chosen State Topology

The framework will use a mixed state topology:

- a top-level app shell state for global concerns
- feature-level or screen-level state slices for business domains

This avoids both extremes:

- not a single monolithic global tree
- not fully disconnected local state islands

The composed app state remains the canonical source of truth, but its internals are modular.

### 9. Chosen Action Runtime

The default action model will be a transactional command pipeline.

The framework-standard execution stages are:

1. `schema`
   Validate and normalize input.

2. `guard`
   Check whether the action is currently allowed.

3. `effect`
   Execute async work or side effects.

4. `commit`
   Apply the state update.

5. `observe`
   Emit action logs, traces, and projection refresh signals.

This is preferred over:

- pure reducer/event-only models, which are too weak for tool execution and async work
- monolithic command handlers, which are too opaque and hard to audit

### 10. Complexity Strategy

Although the internal runtime is pipeline-based, the developer-facing API should use progressive disclosure.

That means:

- simple actions should be definable with a very small API surface
- advanced hooks such as `guard`, `effect`, `commit`, and `observe` are optional
- the framework should provide safe defaults for common actions

The intended developer experience is:

- easy path for ordinary UI actions
- explicit and powerful path for complex AI-facing actions

The complexity belongs inside the framework runtime, not in every app author's day-to-day code.

## Open Design Questions

These are still being refined:

- What is the canonical schema for state, action, GUI projection, and TUI projection?
- What exact role should JSX/HTML play in the authoring model?
- How should actions be bound to GUI controls and tool definitions?
- What runtime contract should guarantee that GUI and TUI stay consistent?
- Should effects be allowed to update state directly, or must they feed results back through domain events?
- How should humans observe LLM operations: only final state changes, or the full action/effect/event process?

## Action Model Evaluation Notes

This section captures the current design discussion and is not final yet.

### Candidate A: Pure reducer / event model

- public actions dispatch events
- reducers perform pure state transitions
- side effects live in a separate effect system

Pros:

- highly deterministic
- replayable and testable
- fits React mental model well

Cons:

- tool metadata, authorization, and async execution need extra layers
- can feel too indirect for domain actions unless the framework shapes it well

### Candidate B: Imperative command model

- actions are executable commands
- commands may validate, perform side effects, and update state directly

Pros:

- straightforward mental model
- explicit imperative control for tool execution

Cons:

- easy to mix concerns
- weaker determinism and replayability
- less React-native in style

### Candidate C: Hybrid command pipeline

- actions enter a unified pipeline
- pipeline stages may include guard, effect, state patch, and projection refresh

Pros:

- practical for GUI and tool unification
- allows explicit control points

Cons:

- can become framework-heavy
- if not constrained, it may degrade into opaque command handlers

### Emerging Recommendation: Intent + reducer + effect handlers

Current thinking is moving toward a more React-friendly model:

- public contract is an explicit `intent`
- GUI and tools both dispatch intents
- reducer computes pure state transitions
- effect handlers execute async or device side effects
- effects emit results or domain events back into the state system

Why this looks promising:

- preserves React-style unidirectional data flow
- keeps state transitions deterministic
- still provides explicit tool contracts for LLM usage
- makes auditing and replay easier because agent operations become typed intents and events

## Newly Confirmed Conclusions

### 9. Core Runtime Vocabulary

The public conceptual vocabulary of the framework will be:

- `State`
- `Action`
- `Event`
- `Effect`

The framework will not use `Intent` as the primary public name, even though some internal design logic may still treat actions as intent-like contracts.

### 10. Current Direction for Action Semantics

The framework should remain React-friendly.

Current direction:

- `Action` is the public contract dispatched by both GUI and tools
- `State` remains the source of truth
- `Event` captures state-relevant results and observable transitions
- `Effect` handles asynchronous work and platform side effects outside pure state transition logic

This keeps a unidirectional flow while preserving explicit tool contracts for LLM usage.

### 11. GUI Must React to Two Things

The human-facing GUI must react to:

- `State`
- `LLM Action Trace`

The GUI should not be modeled as reacting to TUI directly.

Instead:

- TUI/tool activity invokes domain capabilities
- domain capabilities affect state
- GUI reflects state changes
- GUI also reflects LLM action trace visibility

### 12. Chosen Visibility Level for LLM Operations

For the first version:

- the default GUI should show final result changes
- the default GUI should also show the current or most recent AI action

At the same time, the system must persist a richer action history containing:

- started
- in progress
- succeeded
- failed

Humans do not need to see the full stream by default, but they must be able to expand and inspect history on demand.

### 13. LLM Action Trace Structure

`LLM Action Trace` will use a dual-layer structure:

1. **structured trace layer**
   Machine-friendly records for runtime, debugging, history, replay, and inspection.

2. **human summary layer**
   Short human-readable descriptions for GUI display, such as current action or recent action summaries.

This means the framework should not treat user-facing AI activity text as the source of truth.
The source of truth is the structured trace record, while GUI-facing summaries are derived projections.

### 14. Action-to-Tool Mapping Policy

The mapping policy should stay simple by default, but flexible when needed.

Chosen direction:

- default mapping should be `one domain action -> one tool`
- advanced composition is allowed when necessary
- specifically, `many actions -> one higher-level tool` must be allowed

This keeps the normal case easy to understand while still supporting richer agent-facing workflows.

### 15. TUI Responsibility Boundary

The TUI projection should do two things:

1. expose LLM-facing state and structure
2. expose or hint the currently relevant tool entry points

The TUI projection should not be responsible for full procedural guidance by default.

So the chosen boundary is:

- not pure display only
- not a step-by-step agent coach
- but display plus tool-entry visibility

### 16. State Update Rule

The framework will enforce a strict state update rule:

- `Effect` must not update `State` directly
- `Effect` must emit `Event`
- `Event` is what drives state transition

So the canonical flow is:

`Action -> Effect -> Event -> State`

This rule is chosen for determinism, replayability, auditability, and cleaner GUI/TUI consistency.

### 17. Two Legal Action Flows

The framework should support two legal flows:

1. **pure local action**

`Action -> Event -> State`

Used when no external side effect is needed.
Examples:

- switch tab
- toggle panel
- expand section

2. **side-effect action**

`Action -> Effect -> Event -> State`

Used when the action must touch the outside world.
Examples:

- network request
- local persistence
- device capability
- permission gate

This preserves the strict rule that `Effect` never mutates `State` directly,
while avoiding unnecessary ceremony for simple local actions.

### 18. Framework State vs Local UI State

The framework will use a two-level state rule:

- state that affects `GUI`, `TUI`, `Tool`, or `LLM Action Trace` must live in framework-managed `State`
- purely local, temporary, render-only helper state may remain in component-local state

Examples of framework-managed state:

- current tab if it changes what GUI/TUI/tool visibility means
- search query if it is part of business state or AI-observable state
- remote data and request lifecycle state
- current or recent AI action summary
- any state that should survive across projections

Examples of component-local state:

- short-lived animation flags
- transient visual hover/focus helpers
- purely presentational expansion state that is not agent-visible and not business-relevant

Rule of thumb:

If a piece of state must be visible, explainable, replayable, or shared across human/LLM projections, it belongs in framework `State`.

### 19. Action Authoring Style

The framework should use a mixed authoring model:

- developers write actions in a function-friendly style
- the framework compiles those definitions into richer internal object metadata

Why:

- keeps the authoring experience closer to normal React and TypeScript code
- avoids forcing app developers into verbose configuration objects too early
- still gives the framework enough metadata for tools, visibility, tracing, and runtime control

### 20. TUI Authoring Strategy

The TUI projection will be explicitly authored by developers.

Chosen direction:

- no fully automatic TUI generation as the default model
- no "best effort" projection magic as the primary workflow
- developers write the TUI view intentionally

Reason:

- TUI is an LLM-facing interface, so precision matters more than convenience
- automatic generation is likely to drift away from what the agent actually needs
- explicit authorship gives tighter control over state exposure, language, structure, and tool-entry hints

### 21. Consequence of Explicit TUI Authorship

Because TUI is fully handwritten, the framework should not assume projection consistency happens automatically.

So even though TUI stays explicit, the framework should eventually provide some form of:

- GUI/TUI drift detection
- projection consistency checks
- or authoring-time validation that helps developers detect projection mismatch

This is a framework responsibility, not something to hand-wave away as purely app-level discipline.

### 22. Projection Authoring Surface

The chosen direction is mixed:

- GUI projection uses React Native JSX
- TUI projection uses a semantic / HTML-like JSX surface

Reason:

- GUI should stay native to the React Native host environment
- TUI should stay optimized for semantic clarity and LLM-facing structure
- the framework should not force a fake visual syntax unification if the two projections have different jobs

### 23. Tool Visibility Rule

Tool visibility is state-driven.

Chosen direction:

- `defineAction()` may declare visibility as a state-based boolean
- state decides whether a tool is visible
- visible means callable

This intentionally keeps the first version simple:

- no separate "visible but not callable" model
- no extra permission layer beyond current state-based visibility
- no split between recommendation visibility and execution capability

In other words, for v1:

- if the current state says a tool is visible, the LLM may call it
- if the current state says it is not visible, it is not available

### 24. Action Parameter Schema Responsibility

Action parameter schema should not be the primary way to model GUI forms or React component props.

Chosen direction:

- GUI uses normal React / React Native props, local state, and form state patterns
- action schema mainly serves:
  - LLM tool calling
  - runtime validation
- action boundary validation

This keeps the GUI authoring experience idiomatic while still giving the framework a strong contract at the tool and runtime boundary.

### 25. Action Result Model

Action execution should return a structured result while still using events for state evolution.

Chosen direction:

- action callers may receive a structured result such as:
  - `success`
  - `message`
  - `data`
- but internal state transition still depends on emitted `Event`

So the split is:

- `Result` is for caller feedback
- `Event` is for state transition

This is especially useful for LLM tool calls, because tools often need immediate structured feedback,
while the framework still needs deterministic state flow through events.

### 26. Minimal Public Shape of `defineAction()`

The minimum public action definition should stay small but still carry enough semantics for tools, TUI, and trace.

Chosen minimum fields:

- `name`
- `schema`
- `visibility`
- `description`
- `handler`

Why this is the right minimum:

- `name` gives the stable identity
- `schema` defines the runtime and tool boundary
- `visibility` lets state decide whether the tool is available
- `description` supports tool exposure, TUI hints, and trace readability
- `handler` contains the execution entry logic

### 27. `handler` Responsibility Boundary

The action `handler` should be the main business orchestration point.

Chosen direction:

- the handler may decide:
  - which effects to run
  - which events to emit
  - what structured result to return
- the handler is not merely a thin router
- the handler is not just an effect wrapper

This gives the developer one clear place to express the business logic of an action,
while still preserving the rule that effects do not mutate state directly.

### 28. `handler` State Access Rule

The action handler may read current state, but it must not mutate state directly.

Chosen direction:

- handler can inspect current state
- state changes must still happen only through emitted events

So the handler model is:

- read state
- decide what to do
- run effects if needed
- emit events
- return structured result

But never:

- write state directly

### 23. Tool Visibility Must Be State-Driven

Tool visibility should be derived from `State`.

Chosen direction:

- `defineAction()` may declare a `visibility` rule
- that rule is evaluated against current framework state
- the result determines whether the tool is currently visible to the LLM

This means tool visibility is not hard-coded as a static property.
It is a dynamic projection of current app state.

### 24. Important Distinction: Visibility vs Executability

Current direction:

- state should determine whether a tool is visible
- action rules should also remain able to determine whether the action is actually executable

These two things are related but not identical.

Examples:

- a tool may be hidden because it is irrelevant right now
- a tool may be visible but currently blocked by guard conditions
- a tool may be visible in TUI as an available next move, while execution still performs final guard validation

## Working Hypotheses Under Review

### A. Human path vs LLM path

Current discussion hypothesis:

- LLM may interact through TUI-facing domain tools / domain functions
- human users may interact through GUI controls
- GUI controls should not become the canonical business API
- GUI-triggered behavior likely needs to flow into the same domain capability layer used by LLM

This section is intentionally provisional and will be refined into a stricter contract after clarification.

### B. GUI reaction to LLM-side TUI operations

A newly surfaced design question:

When the LLM operates through TUI/tools, what exactly should the human-facing GUI reflect?

This appears to contain two separate requirements:

1. **State/result reflection**
   If LLM changes app state, the GUI must update accordingly.

2. **Process visibility**
   Humans may also need to observe that the LLM is currently acting, what action it is taking, and whether it succeeded or failed.

This distinction matters because "GUI should react" can mean either:

- only final state/result synchronization
- or both result synchronization and intermediate action trace visibility
