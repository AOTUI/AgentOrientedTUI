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

echo ""
echo "✅ All dependencies installed successfully!"
echo ""

# Build order: runtime -> sdk -> host -> apps
echo "🔨 Building packages in correct order..."
echo "----------------------------------------------"

echo "📦 Building runtime..."
pnpm --filter ./runtime build

echo "📦 Building SDK..."
pnpm --filter ./sdk build

echo "📦 Building agent-driver-v2..."
pnpm --filter ./agent-driver-v2 build

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

        # Link current app directory to tui
        tui link .
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
