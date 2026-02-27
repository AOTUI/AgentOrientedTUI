# Building TUI Applications for AI Agents

## Introduction: Rethinking UI for the Age of AI Agents

For decades, user interfaces have been designed exclusively for humans—graphical, interactive, and optimized for eyes and hands. But as Large Language Models (LLMs) emerge as a new class of users, we face a fundamental question: **What does a user interface look like when the user isn't human?**

This document explores the design principles, patterns, and rationale behind **Agent-Oriented Text-based User Interfaces (TUI)**—a paradigm where **LLM agents are first-class citizens**. We'll walk through the thought process that leads to TUI, examine why traditional GUIs fail for AI agents, and reveal how to build applications that LLMs can "see," understand, and manipulate as naturally as humans interact with graphical interfaces.

---

## Part 1: The Fundamental Difference — Humans vs. LLMs

### How Humans Interact with GUIs

Let's start by examining what makes a Graphical User Interface (GUI) work for humans:

**Physical Capabilities:**
- **Eyes**: Humans perceive visual information—colors, layouts, spatial relationships, animations
- **Hands**: Humans manipulate interfaces through pointing devices (mouse, trackpad) and keyboards
- **Continuous Perception**: Humans experience reality as a continuous stream of sensory input

**GUI Design Implications:**
1. **Visual Hierarchy**: CSS, colors, fonts, and layout matter because humans scan visually
2. **Interactive Elements**: Buttons, input fields, sliders—designed for cursor-based interaction
3. **Real-time Feedback**: Animations, hover states, loading spinners—because humans perceive change continuously
4. **Screen Real Estate**: Limited by physical display size (1920x1080, etc.)

### How LLMs Interact with Information

Now consider the nature of Large Language Models:

**Cognitive Characteristics:**
- **No Eyes**: LLMs consume text tokens, not pixels. They cannot "see" CSS, colors, or spatial layouts
- **No Hands**: LLMs cannot click, drag, or type in the traditional sense
- **Discrete Snapshots**: LLMs process information as isolated moments in time—they don't experience continuous change
- **Context Window Constraints**: Limited by token count (e.g., 128K tokens), not screen size

**Fundamental Implications:**
1. **CSS is Meaningless**: An LLM cannot perceive that a button is red or positioned at the top-right
2. **Cursors Don't Exist**: There's no pointer to hover, no input field to focus
3. **No Animation**: LLMs don't see loading states or transitions—only before/after states
4. **Snapshot-Driven**: Each interaction is based on a static snapshot of the application state

> **The Core Insight**: Humans and LLMs experience reality through fundamentally different modalities. This difference demands a fundamentally different interface paradigm.

---

## Part 2: Deconstructing Interaction — What Do "Click" and "Type" Really Mean?

Before we can design for LLMs, we need to understand what human interactions actually accomplish at a semantic level.

### Anatomy of a "Click"

When a human clicks a UI element, two things happen:

1. **Selection (Context Binding)**
   - Choosing **which data** to operate on
   - Implicitly providing **arguments** to a function
   - Establishing **context** for the subsequent action

2. **Triggering (Action Invocation)**
   - Executing a command
   - Initiating a state transition

### Anatomy of "Typing"

When a human types into an input field:

- **Parameter Filling**: Providing explicit arguments to a function
- **Text Input**: The raw data that will be processed

### Real-World Example: Sending a Message

Let's observe Johnny using WeChat to message Wills:

**Human Actions:**
1. **Sees** Wills's avatar and name in the contact list
2. **Clicks** on Wills's chat (Selection)
3. **Types** "Hey, how are you?" (Parameter Filling)
4. **Clicks** the Send button (Triggering)

**What's Actually Happening Under the Hood:**
1. The application renders contact data: `{id: "user_123", name: "Wills Guo", avatar: "..."}`
2. Johnny's click selects this data object—he doesn't know Wills's user ID or IP address
3. The UI automatically binds: `sendMessage(recipient: User("user_123"))`
4. Johnny fills the `message` parameter: `sendMessage(recipient: ..., message: "Hey, how are you?")`
5. The Send button invokes: `executeAction(sendMessage)`

**The Insight:**
> The visual UI (avatar, name, layout) serves as a **semantic bridge** that allows Johnny to **identify** and **reference** data without knowing its internal representation.

Johnny doesn't manipulate user IDs; he manipulates **human-readable identifiers** that the application maps to actual data. This is precisely what we need to replicate for LLMs.

---

## Part 3: Building the Semantic Bridge for LLMs

### The Challenge

LLMs already excel at:
- ✅ **Filling parameters** (`message: "Hey, how are you?"`)
- ✅ **Triggering function calls** (`sendMessage(...)`)

What they lack is:
- ❌ **Selecting data from visual cues** (avatars, layouts, colors)

**The Question:** How do we enable LLMs to "select" data when they can't see?

**The Answer:** Replace visual identifiers with **textual identifiers**.

### The Solution: Text-Based Data References

Consider how Johnny perceives Wills in the GUI:
- Visual: Sees avatar + name → Recognizes "Wills Guo" → Clicks
- Semantic: `Contact object at index 0`

In a TUI, we expose the same semantic information textually:

```markdown
## Contacts

- [Wills Guo](Contact:contacts[0])
- [Emma Chen](Contact:contacts[1])
- [Alex Johnson](Contact:contacts[2])
```

**How This Works:**
1. **Human-Readable Label**: `Wills Guo` — what the LLM "sees"
2. **Semantic Reference**: `Contact:contacts[0]` — how the LLM references it
3. **Markdown Link Syntax**: Familiar format that LLMs understand as "clickable" references

When the LLM wants to send a message to Wills, it references:
```
sendMessage(recipient: "contacts[0]", message: "Hey, how are you?")
```

The application resolves `contacts[0]` to the actual `User("user_123")` object—just like the GUI did when Johnny clicked.

---

## Part 4: Core Design Principles of TUI

### Principle 1: Views as Data Containers

In GUIs, **pages** organize visual information for human eyes. In TUIs, **Views** organize textual information for LLM context.

**View Characteristics:**
- **Clear Boundaries**: Use XML/HTML-like structure for explicit separation
- **Semantic Identity**: Each View has an ID and purpose
- **Self-Contained Context**: Each View represents a logical unit of information

**Example Structure:**
```xml
\<view id="contacts" type="ContactList" name="Contact List" app_id="wechat" app_name="WeChat"\>
  \<!-- Contact data here --\>
\</view\>

\<view id="chat_wills" type="ChatDetail" name="Chat with Wills" app_id="wechat" app_name="WeChat"\>
  \<!-- Conversation data here --\>
\</view\>
```

### Principle 2: Markdown as the Rendering Language

**Why Markdown?**
- ✅ **LLM-Native**: Models are trained extensively on Markdown-formatted text
- ✅ **Structured but Readable**: Hierarchical (headers, lists) yet human-readable
- ✅ **Semantic Links**: Built-in link syntax `[text](reference)` for data binding
- ✅ **Tool-Friendly**: Compatible with function calling mechanisms

**What We Don't Need:**
- ❌ CSS styling
- ❌ JavaScript event handlers (visible to users)
- ❌ Pixel-perfect layouts
- ❌ Animation or transitions

### Principle 3: Value-Driven References

Instead of exposing internal IDs (`user_5f3a8b2c`), use **semantic paths**:

```markdown
- [Current User: Wills](User:currentUser)
- [Latest Message](Message:messages[0])
- [Active Project](Project:workspace.activeProject)
```

**Benefits:**
1. **Self-Documenting**: The type (`Message`, `User`) conveys semantics
2. **Path-Based**: Uses familiar array/object notation
3. **Resolution at Runtime**: Application resolves paths to actual data when operations execute

### Principle 4: Operations as Function Calls

LLMs interact via **tool calls** (function calling). Each interactive element in the TUI maps to a callable function.

**Example:**
```markdown
## Available Actions

- **Send Message**: `send_message(recipient: Contact, message: string)`
- **Open Chat**: `open_chat(contact: Contact)`
- **Search Contacts**: `search_contacts(query: string)`
```

The LLM invokes these as:
```json
{
  "tool": "send_message",
  "arguments": {
    "recipient": "contacts[0]",
    "message": "Hey, how are you?"
  }
}
```

---

## Part 5: Putting It All Together — A Complete Example

Let's walk through a complete TUI interaction:

### Step 1: The Application Snapshot

The application sends this TUI snapshot to the LLM:

```xml
\<view id="contacts" type="ContactList" name="Contact List" app_id="wechat" app_name="WeChat Messenger"\>
  ## Contacts (3 total)

  - [Wills Guo](Contact:contacts[0]) — Online
  - [Emma Chen](Contact:contacts[1]) — Away  
  - [Alex Johnson](Contact:contacts[2]) — Offline

  ### Available Operations
  - **Open Chat**: Select a contact to start conversation
  - **Search**: `search_contacts(query: string)`
\</view\>

\<tools\>
  - open_chat(contact: Contact) — Opens 1-on-1 chat view
  - send_message(recipient: Contact, message: string) — Sends a message
  - search_contacts(query: string) — Filters contact list
\</tools\>
```

### Step 2: LLM Decides to Act

User instruction: *"Send 'Hello!' to Wills"*

The LLM reasons:
1. Identifies Wills: `[Wills Guo](Contact:contacts[0])`
2. Recognizes the `send_message` tool
3. Constructs the call:

```json
{
  "tool": "send_message",
  "arguments": {
    "recipient": "contacts[0]",
    "message": "Hello!"
  }
}
```

### Step 3: Application Resolves and Executes

The application:
1. **Resolves** `contacts[0]` → `{id: "user_123", name: "Wills Guo"}`
2. **Validates** the operation
3. **Executes** the send message logic
4. **Updates State** — new message appears

### Step 4: Updated Snapshot

The application sends an updated snapshot:

```xml
\<view id="chat_wills" type="ChatDetail" name="Chat with Wills Guo" app_id="wechat" app_name="WeChat Messenger"\>
  ## Conversation with [Wills](Contact:contacts[0])

  ### Messages
  - [You](User:currentUser): Hello! — *Just now*

  ### Available Operations
  - **Send Message**: `send_message(message: string)` (recipient auto-filled)
  - **Back to Contacts**: `close_view()`
\</view\>
```

**Notice:**
- The View changed from `contacts` to `chat_wills`
- New message appears in the conversation
- The recipient is now auto-filled (context-aware)

---

## Part 6: Key Insights and Patterns

### Insight 1: Tool Calls Are Commands, Not Data Queries

**Anti-Pattern:**
```json
// ❌ Don't return large data payloads from tool calls
{
  "tool": "get_messages",
  "result": {
    "messages": [ /* 500 message objects */ ]
  }
}
```

**Best Practice:**
```json
// ✅ Return success/failure, reflect data in Views
{
  "tool": "load_more_messages",
  "result": {"success": true, "loaded": 20}
}

// The View updates automatically:
\<view id="chat"\>
  ### Messages (Showing 1-50 of 200)
  - [Message 1](Message:messages[0])
  - [Message 2](Message:messages[1])
  ...
\</view\>
```

**Rationale:**
- Views are the **source of truth** for data presentation
- Tool calls trigger **state transitions**
- Data changes manifest as **View updates** or **new Views**

### Insight 2: Views Are Ephemeral Data Projections

Views don't need to persist—they're **snapshots** of application state at a moment in time. Just like a human seeing a webpage refresh, the LLM receives:

```
Previous Snapshot → Operation Execution → New Snapshot
```

The LLM doesn't need to "track" changes; it simply processes the latest snapshot.

### Insight 3: Context as a First-Class Citizen

Unlike GUIs where context is implicit (cursor position, focused element), TUI context must be **explicit**:

```markdown
\<view id="chat_wills"\>
  ## Active Context
  - **Chatting with**: [Wills Guo](Contact:contacts[0])
  - **Current Topic**: Project deadline discussion
  
  ### Quick Actions
  - `send_message(message: string)` — No need to specify recipient
  - `share_file()` — Will share with Wills automatically
\</view\>
```

The application tracks context, reducing cognitive load for the LLM.

---

## Part 7: Implementation Foundation — Why HTML + JavaScript Works

You might wonder: *"If we're building for text-only LLMs, why use HTML/JavaScript at all?"*

### The HTML/JS Advantage

1. **Mature Ecosystem**: Leverage existing frameworks (React, Vue, Preact)
2. **Virtual DOM**: Use LinkedOM for server-side rendering without browser overhead
3. **Component Patterns**: Reusable UI components (even for text interfaces)
4. **Developer Familiarity**: Millions of developers already know HTML/JS
5. **Transformation Layer**: HTML → Markdown transformation is straightforward

### The Architecture

```
┌─────────────────────────────────────────┐
│  Developer Writes: React/Preact JSX    │
│  \<View id="contacts"\>                   │
│    \<Operation name="send_message"\>      │
│  \</View\>                                │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Runtime Renders: HTML in Worker       │
│  \<div id="contacts" data-view="..."\>    │
│    \<button data-operation="..."\>        │
│  \</div\>                                 │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Transformer Converts: Markdown TUI     │
│  \<view id="contacts"\>                   │
│    ## Contacts                          │
│    - [Wills](Contact:contacts[0])       │
│  \</view\>                                │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  LLM Receives: Text Snapshot            │
│  (Included in chat context)             │
└─────────────────────────────────────────┘
```

**Benefits:**
- Developers use familiar tools and patterns
- Runtime handles the complexity of HTML→TUI transformation
- LLMs receive clean, semantic text interfaces

---

## Part 8: Delivering TUI to LLM Context

**Q: How does the TUI reach the LLM?**

**A: As a special User Message.**

In a conversation with an LLM:

```json
[
  {
    "role": "system",
    "content": "You are an AI assistant with access to applications..."
  },
  {
    "role": "user",
    "content": "\<view id=\"chat_wills\" type=\"ChatDetail\" name=\"Chat with Wills\" app_id=\"wechat\" app_name=\"WeChat\"\>...\</view\>\n\nUser request: Send a message to Wills"
  }
]
```

The TUI snapshot is injected into the context, making the "screen" readable to the LLM. The model then responds with tool calls, and the cycle continues.

**Key Points:**
- Snapshots are **pull-based**: The LLM requests when it needs fresh data
- Snapshots are **immutable**: Each represents a frozen moment
- Snapshots are **self-contained**: Include all necessary context

---

## Conclusion: A New Paradigm for a New User

Building applications for AI agents isn't about shrinking GUIs or removing CSS. It's about **fundamentally rethinking** what an interface means when the user:
- Reads tokens, not pixels
- Invokes functions, not clicks buttons  
- Processes snapshots, not continuous streams

**The TUI Paradigm:**
- ✅ **Views** replace visual pages with semantic containers
- ✅ **Markdown** replaces HTML rendering with LLM-native text
- ✅ **Value References** replace visual identifiers with textual paths
- ✅ **Tool Calls** replace mouse/keyboard with function invocation
- ✅ **Snapshots** replace continuous UI with discrete state projections

By embracing these principles, we can build applications that LLMs interact with as naturally and efficiently as humans interact with GUIs—unlocking a new era of **Agent-Oriented Computing**.

---

## What's Next?

This document established the **"why"** and **"what"** of TUI applications. To actually build them, you'll need:

- **Runtime System**: Manages application lifecycle, View rendering, operation dispatch
- **SDK Framework**: Provides developer-friendly APIs for building TUI apps
- **Type Safety**: TypeScript definitions for Views, Operations, and data references
- **Testing Tools**: Validate TUI snapshots and operation execution

These implementation details are covered in the project's technical documentation. But the core insight remains: **When building for AI, think in text, not pixels.**
