#!/bin/bash

# AOTUI Development Runner
# This script builds all packages and starts the host Electron app

set -e  # Exit on error

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting AOTUI Development Environment"
echo "=========================================="
echo ""

force_local_package_link() {
    local target="$1"
    local package_name="$2"
    local source_dir="$3"
    local scope_dir="$REPO_ROOT/$target/node_modules/@aotui"
    local source_path

    source_path="$REPO_ROOT/$source_dir"
    mkdir -p "$scope_dir"
    rm -rf "$scope_dir/$package_name"
    ln -sfn "$source_path" "$scope_dir/$package_name"
}

link_local_core_deps() {
    local target="$1"

    if [ ! -d "$target" ] || [ ! -f "$target/package.json" ]; then
        return
    fi

    case "$target" in
        "runtime")
            force_local_package_link "$target" "agent-driver-v2" "agent-driver-v2"
            ;;
        "sdk")
            force_local_package_link "$target" "runtime" "runtime"
            ;;
        "host")
            force_local_package_link "$target" "agent-driver-v2" "agent-driver-v2"
            force_local_package_link "$target" "runtime" "runtime"
            force_local_package_link "$target" "sdk" "sdk"
            ;;
        "planning-app"|"terminal-app"|"token-monitor-app")
            force_local_package_link "$target" "sdk" "sdk"
            force_local_package_link "$target" "runtime" "runtime"
            ;;
        "aotui-ide"|"lite-browser-app")
            force_local_package_link "$target" "sdk" "sdk"
            ;;
    esac
}

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

link_targets=(
    "runtime"
    "sdk"
    "host"
    "aotui-ide"
    "planning-app"
    "terminal-app"
    "token-monitor-app"
    "lite-browser-app"
)

for target in "${link_targets[@]}"; do
    echo "🔗 Refreshing local core links in $target..."
    link_local_core_deps "$target"
done

echo "📦 Building agent-driver-v2..."
pnpm -C agent-driver-v2 build

echo "📦 Building runtime..."
pnpm -C runtime build

echo "📦 Building SDK..."
pnpm -C sdk build

# Build apps
apps=("aotui-ide" "planning-app" "terminal-app" "token-monitor-app" "lite-browser-app")

for app in "${apps[@]}"; do
    if [ -d "$app" ]; then
        echo "📦 Building $app..."
        pnpm -C "$app" build 2>/dev/null || echo "   (no build or already built)"
    fi
done

echo "📦 Building host..."
pnpm -C host build

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
