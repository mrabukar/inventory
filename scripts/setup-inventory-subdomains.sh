#!/usr/bin/env bash
# Add inventory app subdomains to nginx + expand Let's Encrypt SSL.
# Run on the VPS as root:
#   sudo bash /var/www/inventory/scripts/setup-inventory-subdomains.sh
set -euo pipefail

CERT_NAME="mobilephoneinventory.com"
NGINX_SITE="/etc/nginx/sites-available/inventory"
REPO_CONF="/var/www/inventory/deploy/nginx-inventory.conf"

SUBDOMAINS=(
  sanabil.mobilephoneinventory.com
  fonex.mobilephoneinventory.com
)

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash $0" >&2
  exit 1
fi

echo "==> Installing nginx site config"
cp "$REPO_CONF" "$NGINX_SITE"
nginx -t

CERT_ARGS=(
  --cert-name "$CERT_NAME"
  -d mobilephoneinventory.com
  -d www.mobilephoneinventory.com
)
for domain in "${SUBDOMAINS[@]}"; do
  CERT_ARGS+=(-d "$domain")
done

echo "==> Expanding SSL certificate"
certbot certonly --nginx \
  "${CERT_ARGS[@]}" \
  --expand \
  --non-interactive \
  --agree-tos \
  --keep-until-expiring

echo "==> Reloading nginx"
systemctl reload nginx

echo "Done. Inventory app subdomains:"
for domain in "${SUBDOMAINS[@]}"; do
  echo "  https://${domain}"
done
