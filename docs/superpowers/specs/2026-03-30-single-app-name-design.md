# Single `app_name` Design

> This document defines the naming-source cleanup for AOTUI apps.
>
> Goal: remove parallel name concepts and keep exactly one globally unique `app_name` across SDK authoring, runtime loading, CLI output, tool namespaces, persistence, and config storage.

## 1. Problem

The current app metadata model has drifted into multiple overlapping names:

- SDK author input: `createTUIApp({ appName, name })`
- legacy manifest fields: `aoapp.json.name`, `aoapp.json.displayName`
- runtime registry key: config `apps` object key
- runtime/TUI display name: installed app metadata `name`
- tool namespace: `AppKernel.resolveToolAppName(...)`
- persistence namespace: `AOTUI_APP_KEY` / `AOTUI_APP_NAME`

These values can disagree today.

Examples already present in the repo:

- `aotui-ide`: config/manifest/tool name are all different
- `terminal-app`: manifest name, SDK display name, and tool namespace differ
- `token-monitor-app`: manifest display name and SDK name differ

This breaks a core framework property:

> An app should have one stable identity across authoring, loading, presentation, tool routing, and persistence.

## 2. Decision

The system keeps exactly one author-defined name field:

- `app_name`

Rules:

- `app_name` is globally unique
- `app_name` is the only name written by app authors
- `app_name` is used directly everywhere
- no display-name formatting or derived pretty label is allowed

Examples:

- `system_ide`
- `terminal`
- `planning_app`

## 3. Naming Contract

### 3.1 Validation

`app_name` must satisfy all of the following:

- regex: `^[a-z0-9_]+$`
- lowercase only
- underscore-separated when multiple words are needed
- no hyphen, whitespace, or case-based variants
- length cap may remain 50 characters unless implementation pressure suggests a stricter limit

This intentionally aligns:

- tool namespace safety
- config key stability
- snapshot readability
- filesystem persistence namespace safety

### 3.2 Single Semantic Meaning

`app_name` simultaneously serves as:

- app identity
- install key
- runtime app label
- CLI list label
- tool namespace prefix
- persistence namespace

There is no separate:

- `displayName`
- `alias`
- `toolAppName`
- `appKey`
- user-facing pretty title

## 4. Source Of Truth

`createTUIApp({ app_name })` becomes the single authoring source of truth.

Example:

```ts
export default createTUIApp({
  app_name: "system_ide",
  whatItIs: "...",
  whenToUse: "...",
  component: SystemIDEApp,
});
```

Implications:

- SDK no longer accepts author-facing `name`
- SDK no longer accepts author-facing `appName`
- runtime kernel config no longer relies on display-name fallback
- TUI and CLI display the raw `app_name`

## 5. Runtime Metadata Model

### 5.1 SDK API

Update `sdk/src/app-factory/createTUIApp.ts`:

- replace `appName` with `app_name`
- remove required `name`
- validate `app_name` with the new regex
- store the same value into runtime-facing config

Recommended runtime-facing shape:

```ts
interface AppKernelConfig {
  appName: string;
  ...
}
```

Notes:

- runtime internal field names may stay camelCase to limit churn
- author-facing SDK API must expose only `app_name`

### 5.2 Runtime Loading

Every runtime layer must consume the same value:

- `AppRegistry` registration key
- `LoadedApp.name`
- `InstalledApp.name`
- snapshot `appName`
- worker tool prefix
- injected app environment namespace

Fallback from human-readable display name must be removed.

### 5.3 Tool Naming

The tool namespace must use the raw `app_name` exactly.

Example:

- `tool:system_ide-FileDetail-open_file`

The system must not normalize from another field at runtime.

### 5.4 Persistence

`usePersistentState()` must use one app namespace input only.

Recommended cleanup:

- stop reading `AOTUI_APP_KEY`
- keep only one runtime env field carrying `app_name`
- persist under `<desktop>/<app_name>/<key>.json`

## 6. `aoapp.json` Strategy

`aoapp.json` is no longer the authoring source of truth for app identity.

It becomes:

- a generated compatibility/distribution artifact
- an entry-resolution artifact for runtime install/load flows

### 6.1 Generated Manifest Shape

Generated `aoapp.json` should contain:

```json
{
  "app_name": "system_ide",
  "version": "0.1.0",
  "entry": { "main": "./dist/index.js" }
}
```

Optional metadata can remain:

- `description`
- `whatItIs`
- `whenToUse`
- `runtime`
- `promptRole`

Removed fields:

- `name`
- `displayName`

### 6.2 Generation Flow

Each app package build should generate `aoapp.json` after TypeScript build:

1. import the built default export from `dist/index.js`
2. read the SDK-produced factory/kernel metadata
3. extract `app_name`
4. combine with `package.json` version and static manifest metadata
5. emit `aoapp.json`

This keeps one naming source while preserving runtime install compatibility.

## 7. Config And Registry Rules

`~/.agentina/config.json` must use `app_name` as the only app key.

### 7.1 Config Rules

- `apps.<app_name>` is the only legal storage key
- entry `alias` is removed
- CLI `install --as` style flows are removed
- registry key derivation from source path or package basename is removed

### 7.2 Registry Resolution

`AppRegistry` must resolve identity in this order:

1. explicit app metadata from loaded factory (`app_name`)
2. generated `aoapp.json.app_name` for manifest compatibility

If neither exists, loading fails.

The system must never silently invent app names from:

- source basename
- package basename
- display name
- ad-hoc alias

## 8. Migration

### 8.1 System App Canonical Names

Adopt the existing machine-safe namespaces as canonical names:

- `aotui-ide` -> `system_ide`
- `terminal-app` -> `terminal`
- `planning-app` -> `planning_app`
- `lite-browser-app` -> `lite_browser`
- `token-monitor-app` -> `token_monitor`

### 8.2 Config Migration

Runtime config loading should migrate legacy keys when possible:

1. load old config
2. load app metadata
3. compute canonical `app_name`
4. rewrite entry under canonical key
5. drop old alias/display-name-era key

Migration must be idempotent.

### 8.3 Legacy Manifest Compatibility

During transition, runtime may still read old manifests containing:

- `name`
- `displayName`

But writeback/generation must produce only the new schema.

## 9. Scope

### In Scope

- SDK API cleanup
- runtime registry identity cleanup
- tool namespace cleanup
- TUI / snapshot naming cleanup
- CLI list/install naming cleanup
- persistence namespace cleanup
- generated `aoapp.json`
- migration of built-in apps
- docs and tests

### Out Of Scope

- redesigning app descriptions or view naming
- changing operation naming beyond app namespace prefix
- redesigning catalog package metadata beyond app identity fields
- preserving install alias support

## 10. Risks

### 10.1 Breaking Change: aliases disappear

This is intentional.
Global uniqueness and aliasing are in tension.
The design chooses identity integrity over alias convenience.

### 10.2 Build-time manifest generation

Manifest generation must not require a full runtime boot.
The generator should only import already-built module metadata.

### 10.3 Existing user config migration

Migration logic must be explicit and tested, otherwise users may end up with duplicated app entries or orphaned state directories.

## 11. Acceptance Criteria

The design is complete when all of the following are true for every built-in app:

1. author writes exactly one app name: `app_name`
2. generated `aoapp.json` contains the same `app_name`
3. `agentina list` displays the same `app_name`
4. TUI installed-app snapshot displays the same `app_name`
5. tool names use the same `app_name`
6. `.agentina/config.json` stores the app under the same `app_name`
7. persistent state paths use the same `app_name`
8. no author-facing `displayName`, `name`, or alias remains in the app metadata path
