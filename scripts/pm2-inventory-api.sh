#!/usr/bin/env bash
# Start/restart inventory API with system Node (not Cursor's bundled node).
set -euo pipefail

API_DIR="/var/www/inventory/api"
NODE="/usr/bin/node"
ENTRY="$API_DIR/dist/src/main.js"

cd "$API_DIR"
pm2 delete inventory-api 2>/dev/null || true
pm2 start "$ENTRY" \
  --name inventory-api \
  --interpreter "$NODE" \
  --cwd "$API_DIR"
pm2 save
