# Designing Software for AI Agents

> Experimental project. This repository is for research, prototyping, and internal exploration. It is not production-ready and should not be used as-is in production environments.

For decades, mainstream interactive software has largely assumed that the user is human.

That assumption shaped the modern GUI: an interface optimized for visual attention, pointer input, and continuous local feedback.

Once the primary actor is an LLM-driven agent rather than a person, the central question is no longer just whether the model can call a tool. It becomes: **what kind of interface lets an agent understand the current world, act on real objects, and stay aligned with changing state over time?**

`AgentOrientedTUI` is an attempt to answer that question.

## The Core Idea

`AgentOrientedTUI` is an interface and runtime model for agent-facing software.

Its goal is to let an agent work against runtime-managed state: persistent `View`s, stable references to domain objects, and actions that remain aligned with the current world.

In short:

> **AgentOrientedTUI tries to replace historical output reconstruction with direct work on the current world.**

This article makes four claims.

First, append-only transcripts are a poor substitute for maintained working state.
Second, agent-facing software needs explicit views, references, and state-aligned actions.
Third, this changes interaction from result accumulation to world maintenance.
Finally, the model is promising but operationally constrained by real systems concerns such as invalidation, concurrency, and context management.

## Why Append-Only Results Break Down

The problem is easy to miss if we frame it as "CLI versus GUI" or "tool calling versus no tool calling." Those frames are too coarse.

The deeper limitation appears in a specific execution pattern: **results are appended into context as historical observations, and the transcript is then treated as a proxy for current state, even though the system does not maintain a current working object for the agent.**

A file is the simplest example.

Suppose an agent is working on `file.txt`.

At `t1`, it runs:

```bash
cat file.txt
```

Now one version of the file has entered context.

At `t2`, the file is edited.

The world has changed, but the previous result has not. The output from `t1` remains in context as a historically correct but now stale observation.

At `t3`, the agent reads the file again:

```bash
cat file.txt
```

Now context contains two snapshots of the same file: one historical, one current.

The problem is not that either snapshot is false. The problem is that the runtime still has not maintained which one should count as the current working state.

In controlled cases, the runtime may be able to update its maintained state from the tool call alone. But once external edits, formatter rewrites, partial failure, or asynchronous side effects enter the picture, that assumption becomes unreliable.

Only one snapshot should ground the next action, but the system has not explicitly maintained that fact. It has only appended another observation, leaving the agent to infer:

- which version is stale
- which version is current
- which version should ground the next step

It is not that the tools cannot do anything useful. They can. The issue is that action execution and state maintenance are being treated as the same problem, when they are not.

In short tasks, this may be survivable. In longer tasks, it becomes structural:

- stale observations accumulate in context
- the model spends tokens and attention on reconciliation
- the "current world" remains an inference rather than a maintained object

So the core question is not simply "can the model issue commands?"

It is:

> **who is responsible for maintaining the current world as the work continues?**

## A Smaller Shift: File View

If the main issue is not command dispatch but state continuity, then one natural shift is to stop treating every read as a new result and start treating it as access to a live working object.

That is the role of a `File View`.

In a typical result-oriented flow, `Read File` means:

- read the file once
- return its contents
- append that result into context

In `AgentOrientedTUI`, `Read File` can mean something different:

- open a `File View`
- make that `File View` the current file-shaped object in context
- let later actions update or close that object

For example, at `t1`, the runtime might insert:

```xml
<view id="file:src/index.ts" type="FileView">
  path: src/index.ts
  language: typescript
  dirty: false
  visible_range: 120-180
  content: ...
  diff_against: HEAD
  diagnostics: ...

  available_actions:
  - edit_file
  - save_file
  - close_file
</view>
```

The point is not the markup but the semantic contract: a `File View` is a runtime-managed handle to a file-shaped working object, not just another returned blob of text.

That also means it does not have to expose a whole-file snapshot every time. Depending on the task, a file-facing view can be line-addressable, slice-based, diff-aware, or oriented around partial edits rather than full-file replacement.

At `t2`, the agent calls `Edit File`. The runtime does not need to append a second full file result into context. It can update the existing handle in place:

- `content` changes
- `dirty` changes
- `visible_range` can shift
- `diff_against` can change
- available actions can change with it

At `t3`, if the file is no longer relevant, the agent closes the view and the object can leave context.

That does not solve every problem. Real file work becomes more complicated with large files, pagination, diffs, partial edits, formatter rewrites, and concurrent modification. In practice, a file-facing view may need to expose line ranges, git-backed diffs, or task-relevant slices instead of a single whole-file snapshot. But that complication does not weaken the model. It clarifies that the maintained object is richer than a returned blob.

> **the primitive of an agent-facing interface does not have to be a returned result; it can be a live view onto a current object.**

## What This Is Not

This is not an argument against tool calling.
It is not an attempt to serialize every GUI pixel into text.
And it does not require the runtime to mirror the entire application state at all times.

The claim is narrower: the agent should work against maintained, actionable views of the current world rather than reconstructing that world from accumulated historical outputs.

## A Full Interaction Model: A Messaging App

A file is only a minimal case. Real applications are more demanding because they involve more than reading state. They involve object selection, object identity, action availability, and state transitions across views.

That is where a messaging example becomes more useful.

Suppose the user says:

> Send "Hi" to `JY Chen`.

For a human, this feels trivial:

- look at the contact list
- find `JY Chen`
- open the chat
- type "Hi"
- press send

For a human, this feels trivial because the GUI hides most of the machinery.

The human appears to click a name and an avatar. Underneath, the system is selecting a contact object, opening the correct conversation, carrying message-routing context forward, and exposing the actions valid in that state.

A text-first LLM agent, especially one operating without a persistent GUI abstraction, does not usually have that same bridge. It may have access to tools, or even pixels, but that still does not automatically provide a stable, explicit model of object identity, state transition, and action availability. If we want software to be reliably usable by such agents, we need to make the hidden mechanics of GUI explicit.

That usually means at least four primitives.

### 1. View

First, the system exposes a view of the current world:

```xml
<view id="contacts" type="ContactList" name="Contacts" app_id="messaging">
  ## Contacts

  - [Wills Guo](Contact:contacts[0]) - online
  - [Emma Chen](Contact:contacts[1]) - away
  - [JY Chen](Contact:contacts[2]) - online

  available_actions:
  - open_chat(contact: Contact)
</view>
```

This view does not expose pixels. It exposes which objects currently exist and which actions are valid from this state.

### 2. Reference

The crucial step is not the label by itself, but the typed reference:

```md
[JY Chen](Contact:contacts[2])
```

`JY Chen` is the readable label.

`Contact:contacts[2]` is the resolvable reference.

That turns "seeing a name" into "binding to a concrete object."

Without references, an agent may know what exists in the application while still lacking a reliable way to determine what a given action should target.

### 3. Tool

Given the contact list view, the correct next step is not to send a message immediately. It is to enter the chat context:

```json
{
  "tool": "open_chat",
  "arguments": {
    "contact": "Contact:contacts[2]"
  }
}
```

The tool here is not a text-returning helper. It is a state transition request. The runtime resolves the reference into the real contact object and moves the application into the corresponding conversation state.

### 4. State Update

After that transition, the runtime can expose a new current view:

```xml
<view id="chat_jy" type="ChatDetail" name="Chat with JY Chen">
  ## Chat with [JY Chen](Contact:contacts[2])

  available_actions:
  - send_message(message: string)
  - close_view()
</view>
```

Now, and only now, does the agent call:

```json
{
  "tool": "send_message",
  "arguments": {
    "message": "Hi"
  }
}
```

The important detail is not that the interface is textual. The important detail is that object selection, state transition, and action availability are all made explicit and kept aligned with the current view.

That is the larger point of an agent-oriented interface.

In a GUI, the pointer hides object selection, buttons hide action affordances, and screen refresh hides state transition.

In an agent-oriented interface, those responsibilities have to be represented explicitly:

- `View` exposes the current world
- `Reference` binds the relevant object
- `Tool` requests a state transition or action
- the runtime updates the current world into the next view

This is not just a thin wrapper over tool calls. It is a different way of organizing interaction around maintained state rather than accumulated outputs.

## The Minimal Runtime Contract

For this model to work reliably, the runtime has to guarantee at least four things:

- references remain stable and resolvable across view transitions
- actions declare which object types they accept
- the runtime, not the model, is responsible for updating or invalidating the current view
- concurrent or external mutation has explicit conflict semantics

## What This Model Changes

If an application is structured this way, the gain is not merely cleaner interaction. The work model itself changes.

### 1. Rich Domain Objects

Files, contacts, chats, tasks, and search results stop being temporary payloads and start behaving more like working objects with state, behavior, and lifecycle.

### 2. State-Driven Progress

The system advances by updating the current world rather than appending another result. That reduces ambiguity, duplication, and stale context.

### 3. Secondary Implications

A state-driven interface also has two practical consequences.

First, agent work can be triggered by more than user prompts alone: file changes, diagnostics, task transitions, and external events can all become meaningful inputs.

Second, this model does not require abandoning the web stack. HTML, JS, JSX, component state, and event systems can remain the developer-facing layer, while agent-facing views become the runtime projection of that layer.

## One Immediate Constraint

There is, however, a real constraint that cannot be ignored. It is not a side note; it is one of the main reasons this model is easier to describe than to operationalize.

### KV Cache Invalidation

An interface like this wants the working world in context to stay current. That implies view updates, state removal, and occasional context replacement or reordering.

Modern model-serving infrastructure often prefers the opposite: stable prefixes and maximal KV cache reuse.

That tension does not invalidate the interface model, but it does impose a real systems constraint.

### Concurrent and External Mutation

A maintained view is only useful if it stays trustworthy. Once files, tasks, or application objects can change outside the agent's immediate action loop, the runtime needs a clear strategy for refresh, conflict detection, and recovery.

If agent-oriented interfaces are going to mature into infrastructure rather than remain a design idea, they will have to confront these constraints directly.

## Repository Guide

This README focuses on the interface model itself. If you want the repository map, architecture layers, tech stack, and local development workflow, see [GUIDE.md](./GUIDE.md).
