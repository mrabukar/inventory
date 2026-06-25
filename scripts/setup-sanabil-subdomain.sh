#!/usr/bin/env bash
# Add sanabil.mobilephoneinventory.com to nginx + Let's Encrypt SSL.
# Prefer: sudo bash /var/www/inventory/scripts/setup-inventory-subdomains.sh
# Run on the VPS as a user with sudo:
#   sudo bash /var/www/inventory/scripts/setup-sanabil-subdomain.sh
set -euo pipefail

DOMAIN="sanabil.mobilephoneinventory.com"
CERT_NAME="mobilephoneinventory.com"
NGINX_SITE="/etc/nginx/sites-available/inventory"
REPO_CONF="/var/www/inventory/deploy/nginx-inventory.conf"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash $0" >&2
  exit 1
fi

echo "==> Installing nginx site config (adds ${DOMAIN})"
cp "$REPO_CONF" "$NGINX_SITE"
nginx -t

echo "==> Expanding SSL certificate for ${DOMAIN}"
certbot certonly --nginx \
  --cert-name "$CERT_NAME" \
  -d mobilephoneinventory.com \
  -d www.mobilephoneinventory.com \
  -d "$DOMAIN" \
  --expand \
  --non-interactive \
  --agree-tos \
  --keep-until-expiring

echo "==> Reloading nginx"
systemctl reload nginx

echo "Done. HTTPS should work at https://${DOMAIN}"
