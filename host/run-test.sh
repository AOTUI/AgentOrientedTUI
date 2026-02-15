#!/bin/bash
cd "$(dirname "$0")"
npx vitest run --config vitest.gui.config.ts "$@"
