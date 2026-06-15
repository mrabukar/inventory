#!/usr/bin/env bash
# Create the first admin user via Better-Auth sign-up.
#
# Prerequisites:
#   1. API is running (PM2 or dev server).
#   2. ALLOW_SIGNUP=true in api/.env, then restart the API.
#   3. After success, set ALLOW_SIGNUP=false and restart again.
#
# Password rules: uppercase + number + special character (min 8 chars).
#
# Usage:
#   ./scripts/create-admin.sh <email> <password> [name]
#
# Examples:
#   ./scripts/create-admin.sh admin@example.com 'Admin123!' 'Admin User'
#   API_URL=http://127.0.0.1:4000 ORIGIN=https://mobilephoneinventory.com \
#     ./scripts/create-admin.sh admin@example.com 'Admin123!'

set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:4000}"
ORIGIN="${ORIGIN:-https://mobilephoneinventory.com}"

EMAIL="${1:-}"
PASSWORD="${2:-}"
NAME="${3:-Admin}"

if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "Usage: $0 <email> <password> [name]" >&2
  echo "" >&2
  echo "Requires ALLOW_SIGNUP=true in api/.env (restart API first)." >&2
  echo "Password must include uppercase, a number, and a special character." >&2
  exit 1
fi

payload=$(EMAIL="$EMAIL" PASSWORD="$PASSWORD" NAME="$NAME" node -e '
  const { EMAIL: email, PASSWORD: password, NAME: name } = process.env;
  console.log(JSON.stringify({ email, password, name, role: "admin" }));
')

echo "Creating admin: $EMAIL"
echo "API: $API_URL/api/auth/sign-up/email"

response=$(curl -sS -w "\n%{http_code}" -X POST "${API_URL}/api/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -H "Origin: ${ORIGIN}" \
  -d "$payload")

body="${response%$'\n'*}"
status="${response##*$'\n'}"

if [[ "$status" -ge 200 && "$status" -lt 300 ]]; then
  echo "Admin created successfully."
  echo "$body" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{console.log(JSON.stringify(JSON.parse(s),null,2))}catch{console.log(s)}})'
  echo ""
  echo "Next: set ALLOW_SIGNUP=false in api/.env, restart the API, then sign in."
  exit 0
fi

echo "Failed (HTTP $status):" >&2
echo "$body" >&2
exit 1
