#!/bin/bash

# Patch electron-trpc to fix ESM import issue
# The main.mjs file incorrectly imports renderer APIs (contextBridge, ipcRenderer)
# which causes errors when loaded in the main process
# We keep ipcMain but remove the renderer-only APIs

MAIN_FILE="node_modules/electron-trpc/dist/main.mjs"

if [ -f "$MAIN_FILE" ]; then
  echo "Patching electron-trpc/dist/main.mjs..."
  
  # Backup if not already done
  [ ! -f "$MAIN_FILE.bak" ] && cp "$MAIN_FILE" "$MAIN_FILE.bak"
  
  # Find and replace the import line to only keep ipcMain with its alias
  # This regex preserves the variable name that ipcMain is aliased to
  sed -i '' 's/import { ipcMain as \([^,]*\), contextBridge as [^,]*, ipcRenderer as [^ ]* } from "electron";/import { ipcMain as \1 } from "electron";/' "$MAIN_FILE"
  
  if [ $? -eq 0 ]; then
    echo "✓ Patched electron-trpc successfully"
  else
    echo "✗ Failed to patch electrontrpc"
    exit 1
  fi
else
  echo "⚠ electron-trpc/dist/main.mjs not found - package may not be installed"
fi
