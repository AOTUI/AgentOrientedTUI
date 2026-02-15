#!/bin/bash

# AOTUI Development Runner
# This script builds all packages and starts the host Electron app

set -e  # Exit on error

echo "🚀 Starting AOTUI Development Environment"
echo "=========================================="
echo ""

# Check if setup has been run
if [ ! -d "node_modules" ]; then
    echo "⚠️  Dependencies not installed!"
    echo "🔧 Running setup first..."
    echo ""
    ./setup.sh
    echo ""
fi

# Build packages that might have changed
echo "🔨 Building packages..."
echo "----------------------------------------------"

echo "📦 Building runtime..."
pnpm --filter ./runtime build

echo "📦 Building SDK..."
pnpm --filter ./sdk build

echo "📦 Building agent-driver-v2..."
pnpm --filter ./agent-driver-v2 build

# Build apps
apps=("aotui-ide" "planning-app" "terminal-app" "token-monitor-app")

for app in "${apps[@]}"; do
    if [ -d "$app" ]; then
        echo "📦 Building $app..."
        pnpm --filter "./$app" build 2>/dev/null || echo "   (no build or already built)"
    fi
done

echo "📦 Building host..."
pnpm --filter ./host build

echo ""
echo "✅ All packages built successfully!"
echo ""

# Start the host Electron app
echo "🌟 Starting host Electron development app..."
echo "----------------------------------------------"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

cd host
pnpm electron:dev
