#!/usr/bin/env bash
# Apply inventory nginx config from repo and reload.
#   sudo bash /var/www/inventory/scripts/apply-nginx-inventory.sh
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash $0" >&2
  exit 1
fi

cp /var/www/inventory/deploy/nginx-inventory.conf /etc/nginx/sites-available/inventory
nginx -t
systemctl reload nginx
echo "Nginx reloaded."
