# GUIDE: Building an Agent Native iOS Calendar App

This guide is for a developer who wants to build a high-quality Agent Native calendar app on iOS using `@aotui/mobile-ai-native`.

The goal is simple:

- humans use a normal GUI calendar
- the LLM uses tools through a TUI snapshot
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

## 2. Why This Architecture Matters

If the LLM drives the GUI by fake taps, your system becomes fragile.

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
The TUI snapshot is another projection of state.

The LLM should never guess ids from the screen.
It should receive semantic refs from the current `SnapshotBundle`.

## 3. The Core Mental Model

Your calendar app should follow this loop:

`State -> GUI`
`State -> TUI Snapshot`
`Tool -> Action -> Event/Effect -> State`
`GUI Event -> Action -> Event/Effect -> State`

That means:

- GUI controls do not own business logic
- TUI does not own business logic
- tools do not own business logic
- `Action` is the one real business entry

## 4. Calendar App State

A good Agent Native calendar app should have state shaped more like this:

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

## 5. Calendar Actions

Your first calendar app should expose a very small action set:

- `openEvent`
- `searchEvents`
- `createEvent`
- `moveEvent`
- `changeCalendarView`

Start smaller than you want.
You can always add more later.

The important rule is:

- actions should be domain actions
- not UI actions like `tapButton` or `scrollList`

## 6. Why Refs Matter in Calendar Apps

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

## 7. Why `snapshotId` Is Non-Negotiable

The screen can change after the LLM reads it.

Maybe:

- the selected day changed
- search results refreshed
- the event was deleted

So tool execution must always be tied to the exact snapshot the LLM saw:

```ts
await bridge.executeTool("openEvent", { event: "events[0]" }, snapshotId);
```

This prevents the runtime from guessing against the latest UI.

That is a big deal.
It is the difference between:

- a reliable system
- and a haunted house

## 8. How To Build the iOS App

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

### Step 3: Build GUI and TUI as separate projections

Do not auto-generate TUI from GUI.

For calendar apps this is especially important because:

- GUI cares about touch and spatial layout
- TUI cares about semantic clarity for the model

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

## 9. Suggested First Calendar TUI

Your first TUI should be boring and clear, not clever:

```tsx
<screen name="Calendar">
  <text>View: week</text>
  <text>Date: 2026-03-24</text>
  <text>{daysRef("Visible days")}</text>
  {events.map((event, index) => (
    <item key={event.id}>{eventRef(index, `${event.title} at ${event.startTime}`)}</item>
  ))}
</screen>
```

The LLM does not need visual beauty.
It needs:

- stable structure
- meaningful refs
- clear tool choices

## 10. Quality Bar for a Good Agent Native Calendar App

Before you call the app "good", verify these:

### State correctness

- GUI and TUI always reflect the same event state
- tool calls only act on snapshot-scoped refs

### Tool correctness

- invisible tools are not callable
- stale `snapshotId` fails cleanly
- missing refs fail with explicit errors

### UX correctness

- human sees the result of AI actions
- recent AI action summary is visible
- event openings, searches, and edits are understandable

### Product correctness

- no tool is named after a button
- tools match domain intent
- TUI exposes enough semantic data without dumping noise

## 11. What This Package Does Not Give You Yet

Be honest with yourself:

this package is still an alpha core.

It does not yet give you:

- a full React Native adapter
- iOS simulator harness
- production persistence
- production networking
- voice or background agent integration

That is okay.

It gives you the hardest part first:

- the protocol spine

## 12. Recommended Build Order

If your friend is building the calendar app, this is the order I recommend:

1. build one RN screen shell
2. integrate framework state and tool bridge
3. implement week view with event refs
4. implement `openEvent`
5. implement `searchEvents`
6. add trace banner for recent AI action
7. add create/edit flows
8. only then add advanced calendar features

## 13. The One Sentence To Remember

An Agent Native iOS app is not:

- "AI controlling UI"

It is:

- "one app where GUI and LLM share the same domain actions and the same state"
