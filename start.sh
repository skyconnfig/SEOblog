#!/usr/bin/env bash
set -e
cd "$(dirname "$0")" || exit 1

echo ""
echo "========================================"
echo "  LXSBest Blog - Starting..."
echo "========================================"
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "[ERROR] Node.js not found. Install from https://nodejs.org"
  exit 1
fi

node scripts/start.js
