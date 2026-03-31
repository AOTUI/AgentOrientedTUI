# Thread Drafts For "CLI Is Not a State Model"

These are launch threads for the article:

- Article: `docs/articles/2026-03-24-cli-is-not-a-state-model.md`
- Core thesis: CLI is strong at action, but weak at owning live state. Agent-native systems need a runtime that keeps the world coherent as actions happen.

---

## Recommended First Launch Thread

This is the version I would ship first. It is the best balance of:

- sharp hook
- technical credibility
- low defensiveness
- strong article click-through

1. The problem with CLI-first agents is not action.

   It is stale state.

2. CLI can execute commands.

   It cannot hold a world.

3. Example:

   - `ls -la`
   - create a file
   - `ls -la` again

   Now the context contains two snapshots of the same directory.

   Both are true historically.
   Only one is current.

4. Same for files:

   - `cat file.txt`
   - edit the file
   - `cat file.txt` again

   The model now has two versions in context and has to reconcile them itself.

5. That’s the hidden tax in a lot of CLI-first agent loops.

   Every repeated read is a new snapshot, not a state update.

6. So the model is not just solving the task.

   It is also rebuilding the current world from stale samples.

7. That’s why I don’t think “more CLI” is the final answer.

   CLI is a strong command layer.
   It is a weak state layer.

8. I also don’t think this is “CLI vs MCP.”

   MCP is valuable as a capability layer.
   CLI is valuable as a command layer.
   But neither one, by itself, gives the agent a coherent work surface.

9. The better mental model is not “a smarter terminal.”

   It is **an IDE installed inside the agent’s context**.

10. That’s the design direction behind Agent Oriented Text-based UI (AOTUI).

    Instead of repeatedly dumping file contents into context, AOTUI can open a File View, update that File View in place, and remove it when the file is no longer needed.

11. That means the model is no longer drowning in transcripts.

    It is working with runtime-managed objects.

12. I wrote a deeper piece on this:

    **CLI Is Not the Final Interface for Agents**

    The core thesis is simple:

    CLI can execute commands.
    It cannot hold a world.

### Suggested post copy for the article link

The problem with CLI-first agents is not action.
It is stale state.

CLI can execute commands.
It cannot hold a world.

I wrote a deeper piece on why I don’t think CLI becomes the final interface for agents, and why agent-native systems need a runtime that keeps the world coherent as actions happen:

---

## Thread 1: Main Launch Thread

1. CLI is great for invoking actions.

   It is terrible at owning state.

2. That’s the part I think the current agent interface discourse is missing.

   We keep talking about commands, tools, and protocols.
   We talk much less about how an agent keeps a coherent world model after it changes the world.

3. Example:

   - `ls -la`
   - create a file
   - `ls -la` again

   Now the context contains two directory snapshots.
   Both are true.
   Only one is current.

4. Same for files:

   - `cat file.txt`
   - edit `file.txt`
   - `cat file.txt` again

   The model now has two versions in context and has to reconcile them itself.

5. That means a pure CLI loop pushes part of the runtime problem upward into the model.

   The model is not just solving the task.
   It is also doing state reconciliation.

6. This is why I don’t think “more CLI” is the full answer.

   CLI solves the action plane.
   It does not automatically solve the state plane.

7. And I don’t think MCP alone solves this either.

   MCP is important.
   It standardizes connection and tool transport.
   But standardized connection is still not the same thing as live state ownership.

8. The missing layer is runtime.

   A runtime should decide:

   - what state enters context
   - how existing state gets updated
   - how stale state gets removed
   - what the model should consider current

9. That’s the design direction behind Agent Oriented Text-based UI (AOTUI).

   Instead of repeatedly dumping snapshots into context, AOTUI treats important things as managed semantic views.

10. Read File doesn’t need to keep appending file contents as tool results.

    It can open a File View.

    Edit File can update that existing File View.

    Close File can remove it from context entirely.

11. That is a different mental model:

    not transcript accumulation,
    but runtime-managed state surfaces.

12. I wrote a deeper piece on this:

    **CLI Is Not a State Model**

    It’s about why agent-native systems need a runtime that owns state, not just commands.

---

## Thread 2: Sharper, More Opinionated

1. CLI is not a state model.

2. It’s a command surface.

   That’s useful.
   But people are starting to mistake “good command invocation” for “a complete agent computer interface.”

3. That’s a category error.

4. The moment an agent mutates the world, its previous CLI outputs become stale.

   That means the context stops being a world model and starts becoming a historical log.

5. Example:

   `cat file.txt`
   -> edit file
   -> `cat file.txt` again

   Now both old and new state live in context.
   The runtime didn’t resolve that.
   The model has to.

6. This is the hidden tax in CLI-first agent loops.

   They look simple because commands are simple.
   They are not simple once you care about state coherence over time.

7. MCP helps standardize tool transport.

   Good.

   But a standard transport layer is still not a runtime.

8. Agent-native systems need a runtime that owns:

   - semantic state
   - state mutation
   - invalidation
   - removal
   - lifecycle

9. In AOTUI, a file can be a managed File View instead of repeated `cat` output.

   That means the state surface evolves in place instead of duplicating itself in context.

10. That’s a very different architecture.

    Tools expose actions.
    Runtime owns state.

11. I think the market is still underestimating that distinction.

12. Wrote about it here:

    **CLI Is Not a State Model**

---

## Thread 3: Framework-Engineer Version

1. I think a lot of agent interface discussion is collapsing three different layers into one:

   - action plane
   - state plane
   - runtime plane

2. CLI is strong on the action plane.

   It gives the model a huge space of things it can do.

3. MCP is strong on protocol and integration boundaries.

   It helps tools become portable and standardized.

4. But neither one automatically gives the model a coherent state plane.

5. The state problem appears the moment outputs become stale.

   `ls`
   -> mutate directory
   -> `ls` again

   `cat`
   -> edit file
   -> `cat` again

   You now have multiple valid but temporally conflicting snapshots.

6. That means the system is representing state as repeated observations rather than owned semantic objects.

7. Once that happens, the model becomes the runtime of last resort.

   It has to infer:

   - which snapshot is current
   - which one is stale
   - whether two outputs refer to the same underlying thing

8. That is exactly the kind of responsibility that should sit below the model, not above it.

9. My view:

   agent-native systems need a runtime that can:

   - create state surfaces
   - mutate them in place
   - remove them cleanly
   - expose them semantically

10. That’s the design direction behind Agent Oriented Text-based UI (AOTUI).

11. I wrote a longer piece on why I think CLI alone is not enough:

    **CLI Is Not a State Model**

---

## Thread 4: AOTUI Mechanism Thread

1. Here’s the simplest way to explain what AOTUI is trying to do differently.

2. In a CLI loop:

   - read file
   - edit file
   - read file again

   State enters context as repeated snapshots.

3. In AOTUI:

   - Read File opens a File View
   - Edit File updates that File View
   - Close File removes it

4. That means the model is not reading “one more dump”.

   It is interacting with a managed state surface.

5. This is subtle, but I think it matters a lot.

   Repeated dumps create stale context.
   Managed views create owned state.

6. Once you frame the problem this way, the point of a runtime becomes much clearer.

   The runtime is not just there to execute tools.

7. It is there to maintain a coherent world model as the agent acts.

8. This is why I don’t think the future agent interface is “just CLI” or “just MCP.”

9. We need:

   - action layers
   - protocol layers
   - and a runtime layer that owns semantic state

10. I wrote a deeper piece on this design:

    **CLI Is Not a State Model**

---

## Suggested Opening One-Liners

Use these as first posts, quote cards, or image captions:

- CLI is not a state model.
- The problem with CLI-first agents is not action. It’s stale state.
- Commands are easy. Coherent world models are hard.
- CLI gives agents actions. Runtime gives them a world.
- MCP can standardize connections. It still does not own state.
- If every read becomes a new snapshot, your agent does not have a world model. It has a transcript.
