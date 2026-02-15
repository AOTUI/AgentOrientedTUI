#!/bin/bash
# Wrapper for npm run dev:all which utilizes concurrently
cd "$(dirname "$0")/.."
echo "Starting development environment with logs..."
npm run dev:all
