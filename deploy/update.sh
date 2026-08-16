#!/usr/bin/env bash
# Satu perintah update produksi. Tidak perlu chmod manual setelah build.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hotspot-gateway}"
APP_USER="${APP_USER:-hotspot}"
WEB_GROUP="${WEB_GROUP:-www-data}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Jalankan sebagai root: sudo bash deploy/update.sh"
  exit 1
fi

cd "$APP_DIR"
sudo -u "$APP_USER" git pull --ff-only

cd "$APP_DIR/backend"
sudo -u "$APP_USER" bun run build

cd "$APP_DIR/frontend"
sudo -u "$APP_USER" bun run build

# Nginx (www-data) harus bisa melewati folder induk dan membaca dist.
chmod 755 /var /var/www "$APP_DIR" "$APP_DIR/frontend" "$APP_DIR/frontend/dist"
find "$APP_DIR/frontend/dist" -type d -exec chmod 755 {} +
find "$APP_DIR/frontend/dist" -type f -exec chmod 644 {} +
chown -R "${APP_USER}:${WEB_GROUP}" "$APP_DIR/frontend/dist"
chown -R "${APP_USER}:${WEB_GROUP}" "$APP_DIR/backend/public" || true

if command -v setfacl >/dev/null 2>&1; then
  setfacl -R -m "u:${WEB_GROUP}:rx" "$APP_DIR/frontend"
  setfacl -R -d -m "u:${WEB_GROUP}:rx" "$APP_DIR/frontend"
fi

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart hotspot-backend
fi

nginx -t && systemctl reload nginx
echo "Update selesai."
