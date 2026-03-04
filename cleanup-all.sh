#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🧹 AOTUI cleanup started"
echo "========================"
echo ""

echo "🔗 Removing all registered TUI apps..."
if command -v agentina >/dev/null 2>&1; then
    tui_list_output="$(agentina list 2>&1 || true)"

    app_names="$({
        printf '%s\n' "$tui_list_output" | sed -n 's/^\[AppRegistry\] Loaded app: //p'
        printf '%s\n' "$tui_list_output" | sed -n 's/^\[AppRegistry\] Failed to load app "\(.*\)":.*/\1/p'
        printf '%s\n' "$tui_list_output" | awk '
            /^Installed apps:/ { in_section=1; next }
            /^Legend:/ { in_section=0 }
            in_section && /^  / && /\(/{
                line=$0
                sub(/^  [^[:alnum:]]*/, "", line)
                sub(/[[:space:]]*\(.*/, "", line)
                if (length(line) > 0) print line
            }
        '
    } | sort -u)"

    if [ -z "$app_names" ]; then
        echo "ℹ️  No registered TUI apps found"
    else
        while IFS= read -r app_name; do
            [ -z "$app_name" ] && continue
            echo "🗑️  Removing app: $app_name"
            agentina remove "$app_name" || true
        done <<< "$app_names"
    fi
else
    echo "⚠️  agentina command not found, skipping app removal"
fi

echo ""
echo "🗑️  Removing all dist/ directories..."
find . -type d -name dist -prune -print -exec rm -rf {} +

echo ""
echo "🗑️  Removing all node_modules/ directories..."
find . -type d -name node_modules -prune -print -exec rm -rf {} +

echo ""
echo "✅ Cleanup complete"
