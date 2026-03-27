# GUIDE: Building an Agent Native iOS Calendar App

This guide is for a developer who wants to build a high-quality agent-native calendar app on iOS using `@aotui/mobile-ai-native`.

The goal is simple:

- humans use a normal GUI calendar
- the LLM uses tools through a snapshot
- both operate on the same app state
- the human can see the result of the LLM's actions

## 1. What You Are Actually Building

Do not think of this as:

- "an AI that clicks buttons"

Think of it as:

- "one calendar app with two input channels"

Those two channels are:

1. human input through GUI
2. LLM input through tools

They must meet in the same place:

- the same `State`
- the same `Action` layer

That is the whole trick.

## 2. How The Snapshot Works

The LLM should not guess ids from pixels.
It should read the current `SnapshotBundle`.

In the current runtime, the snapshot is assembled from ordered `<View>` fragments:

- the first fragment is the static root navigation fragment with `type: "Root"`
- later fragments are mounted business views derived from current state
- `markup` is the composed xml+markdown snapshot
- `views` preserves the fragment order
- `refIndex` resolves semantic refs by exact key lookup
- `visibleTools` is the tool list for that same render tick

`snapshotId` is non-negotiable.
If the app changes after the LLM reads a snapshot, the tool call must still be tied to the exact snapshot the model saw.

## 3. Why This Architecture Matters

If the LLM drives the GUI by fake taps, the system becomes fragile.

Why?

- the UI layout changes and the AI breaks
- the AI acts on pixels, not meaning
- debugging becomes miserable

Instead, this framework makes the LLM act on meaning:

- `openEvent`
- `createEvent`
- `moveEvent`
- `searchEvents`
- `changeCalendarView`

The GUI is one projection of state.
The snapshot is another projection of state.

The LLM should never infer refs from the visual layout.
It should receive semantic refs from the current `SnapshotBundle`.

## 4. The Core Mental Model

Your calendar app should follow this loop:

`State -> GUI`
`State -> Root view + mounted business views -> SnapshotBundle`
`Tool -> Action -> Event/Effect -> State`
`GUI Event -> Action -> Event/Effect -> State`

That means:

- GUI controls do not own business logic
- snapshot views do not own business logic
- tools do not own business logic
- `Action` is the one real business entry
- effects are framework-managed side effects, but the app still owns what they mean

## 5. Calendar App State

A good agent-native calendar app should have state shaped more like this:

```ts
type CalendarState = {
  shell: {
    currentView: "day" | "week" | "month";
    selectedDate: string;
    recentTrace: string | null;
  };
  events: {
    items: CalendarEvent[];
    selectedEventId: string | null;
    searchQuery: string;
    isLoading: boolean;
  };
};
```

Good rule:

- if it affects GUI, TUI, tool visibility, or trace, it belongs in framework state
- if it is only a tiny render helper, keep it local
- if it must be read by the host through a selector, keep it in the runtime store so `useRuntimeState()` can subscribe to it

## 6. Calendar Views And Tools

Model the app as a static root plus mounted runtime views:

- `RootView` is the navigation map, currently emitted with `type: "Root"`
- `CalendarView` can be always mounted when the calendar shell is active
- `EventDetailView` can mount only when an event is selected
- `SearchResultView` can mount only while search results are present

The tool surface should follow the same semantic grouping.

- register tools against a `viewType`
- filter them with `visibility(state)`
- only expose tools for currently relevant view types

That keeps the calendar agent surface aligned with the current screen reality without pretending the runtime is a desktop tree inspector.

## 7. Why Refs Matter In Calendar Apps

Calendars are full of structured data:

- one day
- one week
- one event
- one search result list

The LLM should see semantic markers like:

```text
(1:1 with Sarah at 14:00)[event:events[0]]
(Today)[day:visible_days[0]]
```

That is what `useDataRef` and `useArrayRef` are for.

### Use `useDataRef`

Use it for one event, one selected day, one active calendar.

```tsx
const selectedEventRef = useDataRef("event", selectedEvent, "selected_event");
<text>{selectedEventRef("Selected event")}</text>;
```

### Use `useArrayRef`

Use it for event lists, visible day buckets, agenda results.

```tsx
const [eventsRef, eventRef] = useArrayRef("event", visibleEvents, "events");
<text>{eventsRef("Visible events")}</text>
{visibleEvents.map((event, index) => (
  <item key={event.id}>{eventRef(index, event.title)}</item>
))}
```

## 8. Why `snapshotId` Is Non-Negotiable

The screen can change after the LLM reads it.

Maybe:

- the selected day changed
- search results refreshed
- the event was deleted

So tool execution must always be tied to the exact snapshot the LLM saw:

```ts
await bridge.executeTool("openEvent", { event: "events[0]" }, snapshotId);
```

That prevents the runtime from guessing against the latest UI.

In the hardened runtime, the snapshot registry distinguishes `SNAPSHOT_NOT_FOUND` from `SNAPSHOT_STALE`. A tool execution that mutates state marks its originating snapshot stale, even if the action returns a recoverable failure result. That forces the next reasoning turn to fetch a fresh snapshot.

## 9. How To Build The iOS App

### Step 1: Keep this package as the core

Use `@aotui/mobile-ai-native` for:

- state
- refs
- snapshot bundle creation
- tool bridge

### Step 2: Build a thin React Native host

The React Native app should do only host work:

- render native GUI
- host the agent session
- ask the framework for `SnapshotBundle`
- pass tool calls into `executeTool`
- subscribe to state and trace through the runtime hooks instead of copying framework state into local component state

### Step 3: Build GUI and snapshot views as separate projections

Do not auto-generate the snapshot from GUI.

For calendar apps this is especially important because:

- GUI cares about touch and spatial layout
- snapshot views care about semantic clarity for the model

### Step 4: Start with one vertical slice

Do not build the whole calendar app at once.

Start with:

- month or week view
- visible event list
- `openEvent`
- `searchEvents`

Only after that is stable, add:

- create
- move
- delete
- recurring events
- trace UI for recent AI actions

## 10. Suggested First Calendar Snapshot

Your first snapshot should be boring and clear, not clever:

```tsx
<View id="root" type="Root" name="Navigation">
  ## Calendar Navigation
  - Root
    - purpose: app navigation and view map
  - Calendar
    - enter: mounted by default after launch
    - actions: open_event, search_events, change_calendar_view
  - EventDetail
    - enter: use open_event from Calendar
    - actions: update_event, close_event
</View>

<View id="calendar" type="Calendar" name="Week Calendar">
  <text>View: week</text>
  <text>Date: 2026-03-24</text>
  <text>{daysRef("Visible days")}</text>
</View>
```

The LLM does not need visual beauty.
It needs:

- stable structure
- meaningful refs
- clear tool choices

## 11. Quality Bar For A Good Agent Native Calendar App

A good app should feel like one system, not two loosely related interfaces.

If the GUI and snapshot disagree, the user will feel it immediately.
If tools are visible in the wrong view type, the agent will feel it immediately.
If refs drift from the current render tick, both paths become unreliable.
