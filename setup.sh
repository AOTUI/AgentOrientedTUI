#!/bin/bash

# AOTUI Development Environment Setup Script
# This script installs dependencies and links all TUI applications

set -e  # Exit on error

echo "🚀 AOTUI Development Environment Setup"
echo "========================================"
echo ""

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed"
    echo "📦 Installing pnpm globally..."
    npm install -g pnpm
    echo "✅ pnpm installed successfully"
else
    echo "✅ pnpm is already installed ($(pnpm --version))"
fi

echo ""
echo "📦 Installing dependencies for all packages..."
echo "----------------------------------------------"

# Install root dependencies
echo "📦 Installing root dependencies..."
pnpm install

# Install dependencies for each package/app directory
install_targets=(
    "agent-driver-v2"
    "runtime"
    "sdk"
    "host"
    "aotui-ide"
    "planning-app"
    "terminal-app"
    "token-monitor-app"
    "lite-browser-app"
)

for target in "${install_targets[@]}"; do
    if [ -d "$target" ] && [ -f "$target/package.json" ]; then
        echo "📦 Installing dependencies in $target..."
        cd "$target"
        pnpm install

        # Build local packages immediately so downstream file: dependencies can resolve dist/types
        if [ "$target" = "agent-driver-v2" ] || [ "$target" = "runtime" ] || [ "$target" = "sdk" ]; then
            echo "🔨 Pre-building $target for local file: dependency consumers..."
            pnpm build
        fi

        # Self-heal Electron install when pnpm blocks build scripts and electron/path.txt is missing
        if [ "$target" = "host" ] && [ -f "node_modules/electron/install.js" ] && [ ! -f "node_modules/electron/path.txt" ]; then
            echo "🔧 Electron binary not detected (path.txt missing), running installer..."
            node node_modules/electron/install.js
        fi

        cd ..
    else
        echo "⚠️  $target/package.json not found, skipping dependency install"
    fi
done

echo ""
echo "✅ All dependencies installed successfully!"
echo ""

# Build order: agent-driver-v2 -> runtime -> sdk -> host -> apps
echo "🔨 Building packages in correct order..."
echo "----------------------------------------------"

echo "📦 Building agent-driver-v2..."
pnpm --filter ./agent-driver-v2 build

echo "📦 Building runtime..."
pnpm --filter ./runtime build

echo "📦 Building SDK..."
pnpm --filter ./sdk build

echo "📦 Building host..."
pnpm --filter ./host build

echo ""
echo "✅ All packages built successfully!"
echo ""

# Check if tui CLI is available
echo "🔗 Setting up TUI CLI..."
echo "----------------------------------------------"

# Link host as global tui command
cd host
npm link
cd ..

if command -v tui &> /dev/null; then
    echo "✅ tui CLI is now available ($(tui --version 2>/dev/null || echo 'version check not available'))"
else
    echo "⚠️  tui command may not be in PATH yet"
    echo "   Try running: source ~/.bashrc or source ~/.zshrc"
    echo "   Or restart your terminal"
fi

echo ""
echo "🔗 Linking TUI applications..."
echo "----------------------------------------------"

# Array of apps to link
apps=("aotui-ide" "planning-app" "terminal-app" "token-monitor-app" "lite-browser-app")

for app in "${apps[@]}"; do
    if [ -d "$app" ]; then
        echo "🔗 Linking $app with tui..."
        cd "$app"
        
        # Build app to generate dist artifacts
        if [ -f "package.json" ]; then
            pnpm build
        fi
        
        # Ensure dist exists before linking
        if [ ! -d "dist" ]; then
            echo "❌ $app build completed but dist directory was not found"
            echo "   Please check the build output path before running setup again"
            exit 1
        fi

        # Link current app directory to tui (idempotent on reruns)
        if ! link_output=$(tui link . 2>&1); then
            if echo "$link_output" | grep -q "already registered"; then
                app_name=$(echo "$link_output" | sed -n "s/.*Operation '\(.*\)' is already registered.*/\1/p")
                if [ -n "$app_name" ]; then
                    echo "ℹ️  App '$app_name' is already registered, replacing link..."
                    tui remove "$app_name"
                    tui link .
                else
                    echo "$link_output"
                    echo "❌ Failed to parse already-registered app name"
                    exit 1
                fi
            else
                echo "$link_output"
                echo "❌ Failed to link $app"
                exit 1
            fi
        else
            echo "$link_output"
        fi
        cd ..
        
        echo "✅ $app linked successfully"
    else
        echo "⚠️  $app directory not found, skipping..."
    fi
done

echo ""
echo "✅ All apps linked successfully!"
echo ""
echo "================================================================"
echo "✨ Setup Complete! ✨"
echo "================================================================"
echo ""
echo "Next steps:"
echo "1. Run './run.sh' to start the development server"
echo "2. Or run 'cd host && pnpm dev' to start manually"
echo ""
echo "Available TUI apps:"
for app in "${apps[@]}"; do
    echo "  - $app"
done
echo ""
echo "To verify installation:"
echo "  tui list              # List all available apps"
echo "  tui link <app-name>   # Link additional apps"
echo ""
