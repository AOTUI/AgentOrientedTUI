#!/bin/bash

# Patch electron-trpc to fix ESM import issue
# The main.mjs file incorrectly imports renderer APIs (contextBridge, ipcRenderer)
# which causes errors when loaded in the main process
# We keep ipcMain but remove the renderer-only APIs

# Resolve script directory to find node_modules relative to project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

patch_file() {
  local file="$1"
  if grep -q 'ipcRenderer' "$file" 2>/dev/null; then
    sed -i '' 's/import { ipcMain as \([^,]*\), contextBridge as [^,]*, ipcRenderer as [^ ]* } from "electron";/import { ipcMain as \1 } from "electron";/' "$file"
    if [ $? -eq 0 ]; then
      echo "✓ Patched $file"
    else
      echo "✗ Failed to patch $file"
      return 1
    fi
  else
    echo "✓ Already patched: $file"
  fi
}

PATCHED=0

# Patch top-level node_modules copy
MAIN_FILE="$PROJECT_DIR/node_modules/electron-trpc/dist/main.mjs"
if [ -f "$MAIN_FILE" ]; then
  patch_file "$MAIN_FILE" && PATCHED=$((PATCHED + 1))
fi

# Patch all copies in pnpm store (.pnpm directory)
for f in "$PROJECT_DIR"/node_modules/.pnpm/electron-trpc@*/node_modules/electron-trpc/dist/main.mjs; do
  if [ -f "$f" ]; then
    patch_file "$f" && PATCHED=$((PATCHED + 1))
  fi
done

if [ $PATCHED -eq 0 ]; then
  echo "⚠ electron-trpc/dist/main.mjs not found - package may not be installed"
fi
