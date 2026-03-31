# AOTUI Development Guide

Welcome to AOTUI! This guide will help you set up your development environment and start building TUI applications for AI agents.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18 or higher
- **pnpm**: Package manager (will be installed automatically if missing)
- **Git**: For version control

## Quick Start

### Option 1: Automated Setup (Recommended)

Run the setup script to install all dependencies and link TUI apps:

```bash
# Make scripts executable
chmod +x setup.sh run.sh

# Run setup (installs dependencies, builds packages, links apps)
./setup.sh

# Start Electron development app
./run.sh
```

### Option 2: Manual Setup

If you prefer to set up manually, follow these steps:

#### 1. Install pnpm (if not already installed)

```bash
npm install -g pnpm
```

#### 2. Install Dependencies

```bash
# Install all workspace dependencies
pnpm install
```

#### 3. Build Packages in Order

The build order is important due to dependencies:

```bash
# Build runtime (required by SDK and apps)
pnpm --filter ./runtime build

# Build SDK (required by apps)
pnpm --filter ./sdk build

# Build agent-driver (required by host)
pnpm --filter ./agent-driver-v2 build

# Build host
pnpm --filter ./host build

# Build individual apps (optional, built on-demand)
pnpm --filter ./aotui-ide build
pnpm --filter ./planning-app build
pnpm --filter ./terminal-app build
pnpm --filter ./token-monitor-app build
```

#### 4. Install agentina CLI

```bash
# Link host as global 'agentina' command
cd host
npm link
cd ..

# Verify installation
agentina --version
```

#### 5. Link TUI Applications

```bash
# Link each app
cd aotui-ide && npm link && cd ..
cd planning-app && npm link && cd ..
cd terminal-app && npm link && cd ..
cd token-monitor-app && npm link && cd ..

# Install linked apps to host
cd host
npm link aotui-ide
npm link planning-app
npm link terminal-app
npm link token-monitor-app
cd ..
```

#### 6. Start Electron Development App

```bash
cd host
pnpm electron:dev
```

## Project Structure

```
aotui_v6/
├── runtime/              # Core runtime system (microkernel + worker isolation)
├── sdk/                  # SDK for building TUI apps (Preact components)
├── host/                 # Host application (runs the runtime)
├── agent-driver-v2/      # Agent driver for LLM integration
├── aotui-ide/            # System IDE TUI app
├── planning-app/         # Planning/project management TUI app
├── terminal-app/         # Terminal TUI app
├── token-monitor-app/    # Token monitoring TUI app
├── setup.sh              # Automated setup script
├── run.sh                # Electron development app runner
└── package.json          # Workspace configuration
```

## Development Workflow

### Building Individual Packages

```bash
# Build specific package
pnpm --filter ./runtime build
pnpm --filter ./sdk build
pnpm --filter ./aotui-ide build

# Build all packages
pnpm -r build
```

### Running Tests

```bash
# Run tests for specific package
pnpm --filter ./runtime test
pnpm --filter ./sdk test

# Run all tests
pnpm -r test
```

### Watch Mode (for active development)

```bash
# Watch runtime changes
pnpm --filter ./runtime dev

# Watch SDK changes
pnpm --filter ./sdk dev

# Run host Electron app with hot-reload
cd host && pnpm electron:dev
```

### Adding a New TUI App

1. **Create app directory** with required structure:
   ```
   my-app/
   ├── package.json
   ├── tsconfig.json
   ├── src/
   │   ├── index.ts        # Export createTUIApp factory
   │   ├── tui/           # TUI components
   │   └── core/          # Business logic
   └── test/
   ```

2. **Define the canonical `app_name` in `createTUIApp()`**:
   ```ts
   export default createTUIApp({
     app_name: "my_app",
     component: MyApp,
     whatItIs: "Describe what the app is",
     whenToUse: "Describe when the agent should use it",
   });
   ```

3. **Generate `aoapp.json` as a build artifact**:
   ```json
   {
     "scripts": {
       "build": "tsc && node ../scripts/generate-aoapp.mjs ."
     }
   }
   ```

4. **Build and link**:
   ```bash
   cd my-app
   pnpm build
   npm link
   cd ../host
   npm link my-app
   ```

5. **Use in host**:
   ```typescript
   // host/src/examples/my-app-example.ts
   import myApp from 'my-app';
   
   await desktop.installApp('my-app', myApp);
   await desktop.openApp('my-app', { /* config */ });
   ```

## agentina CLI Commands

Once the `agentina` CLI is installed, you can use these commands:

```bash
# List all available TUI apps
agentina list

# Link a new app to the host
agentina link <app-name>

# Show app information
agentina info <app-name>

# Unlink an app
agentina unlink <app-name>

# Show version
agentina --version
```

## Troubleshooting

### pnpm not found

```bash
npm install -g pnpm
```

### tui command not found after installation

Try sourcing your shell configuration:

```bash
# For bash
source ~/.bashrc

# For zsh
source ~/.zshrc

# Or restart your terminal
```

### Build errors

Make sure you build packages in the correct order:

```bash
# Clean and rebuild
pnpm -r clean
pnpm --filter ./runtime build
pnpm --filter ./sdk build
pnpm --filter ./agent-driver-v2 build
pnpm --filter ./host build
```

### App not appearing in host

Verify the app is linked:

```bash
cd host
npm list --depth=0 | grep <app-name>

# If not found, link again
npm link <app-name>
```

### Worker thread errors

If you see errors related to worker threads, ensure:
- Node.js v18+ is installed
- The runtime is built correctly: `pnpm --filter ./runtime build`

## Development Tips

### Fast Iteration

For rapid development on a single app:

```bash
# Terminal 1: Watch runtime/SDK
pnpm --filter ./runtime dev &
pnpm --filter ./sdk dev

# Terminal 2: Watch your app
pnpm --filter ./my-app dev

# Terminal 3: Run host Electron app
cd host && pnpm electron:dev
```

### Debugging

```bash
# Run host with inspector
cd host
node --inspect node_modules/.bin/vite

# Or use VS Code debugger with launch.json
```

### Type Checking

```bash
# Check types without building
pnpm --filter ./runtime typecheck
pnpm --filter ./sdk typecheck
```

## Next Steps

- Read the [AOTUI Spec](./AOTUI%20Spec.md) to understand the system architecture
- Review [Building TUI Applications for AI Agents](./Building%20TUI%20Application%20for%20AI%20Agent.md)
- Check [Runtime Developer Guide](./runtime/RUNTIME_DEVELOPER_GUIDE.md)
- Explore [SDK Developer Guide](./sdk/SDK_DEVELOPER_GUIDE.md)
- Study example apps: `aotui-ide`, `planning-app`, `terminal-app`

## Contributing

Before submitting a PR:

1. Ensure all tests pass: `pnpm -r test`
2. Build successfully: `pnpm -r build`
3. Follow the coding conventions in existing packages
4. Update documentation for new features

## Support

If you encounter issues:

1. Check this guide's Troubleshooting section
2. Review existing documentation in `runtime/` and `sdk/`
3. Check package-specific README files
4. Open an issue with detailed reproduction steps

---

Happy building! 🚀
