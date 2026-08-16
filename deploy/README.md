# Deploy produksi — wifi.rekavia.com

Satu origin: portal, API, video, dan WebSocket di `https://wifi.rekavia.com`.
MikroTik terhubung ke VPS lewat WireGuard. API `8728` tidak dibuka ke internet.

## 0. DNS

Buat record A:

```
wifi.rekavia.com  →  IP_PUBLIK_VPS
```

## 1. VPS (Ubuntu 22.04/24.04, RAM ≥ 2 GB)

```bash
sudo apt update && sudo apt install -y nginx mysql-server wireguard certbot python3-certbot-nginx unzip curl

# Bun
curl -fsSL https://bun.sh/install | bash
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
sudo ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun

# User layanan
sudo useradd --system --home /opt/hotspot-gateway --shell /usr/sbin/nologin hotspot
sudo mkdir -p /opt/hotspot-gateway /var/www/wifi.rekavia.com
```

MySQL:

```bash
sudo mysql -e "CREATE DATABASE hotspot_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'hotspot'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD';"
sudo mysql -e "GRANT ALL ON hotspot_db.* TO 'hotspot'@'localhost'; FLUSH PRIVILEGES;"
```

## 2. Aplikasi

```bash
cd /opt
sudo git clone https://github.com/KirisakiRei/hotspot-gateway.git hotspot-gateway
sudo chown -R hotspot:hotspot /opt/hotspot-gateway

cd /opt/hotspot-gateway/backend
sudo -u hotspot cp /opt/hotspot-gateway/deploy/env.production.example .env
sudo -u hotspot nano .env   # isi secret + DATABASE_URL

sudo -u hotspot bun install --frozen-lockfile
sudo -u hotspot bunx prisma migrate deploy
sudo -u hotspot bunx prisma generate
sudo -u hotspot bun run prisma:seed
sudo -u hotspot bunx nest build
sudo mkdir -p /opt/hotspot-gateway/backend/public/videos /opt/hotspot-gateway/backend/wa-auth
sudo chown -R hotspot:hotspot /opt/hotspot-gateway/backend/public /opt/hotspot-gateway/backend/wa-auth
```

Frontend (URL API di-bake saat build):

```bash
cd /opt/hotspot-gateway/frontend
sudo -u hotspot bash -lc 'echo "VITE_API_URL=https://wifi.rekavia.com/api" > .env'
sudo -u hotspot bun install --frozen-lockfile
sudo -u hotspot bun run build
sudo rsync -a --delete dist/ /var/www/wifi.rekavia.com/dist/
sudo chown -R www-data:www-data /var/www/wifi.rekavia.com

# Jika Nginx membaca langsung dari frontend/dist (bukan /var/www/wifi.rekavia.com):
# sudo bash /var/www/hotspot-gateway/deploy/update.sh
```

## 3. systemd

```bash
sudo cp /opt/hotspot-gateway/deploy/systemd/hotspot-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hotspot-backend
sudo systemctl status hotspot-backend
```

## 4. Nginx + TLS

```bash
sudo cp /opt/hotspot-gateway/deploy/nginx/wifi.rekavia.com.conf /etc/nginx/sites-available/wifi.rekavia.com
sudo ln -sf /etc/nginx/sites-available/wifi.rekavia.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d wifi.rekavia.com
```

Uji: `curl -I https://wifi.rekavia.com/portal`

## 5. WireGuard VPS ↔ MikroTik

Di VPS:

```bash
wg genkey | tee /etc/wireguard/vps.key | wg pubkey > /etc/wireguard/vps.pub
# Generate key MikroTik di router, salin public key ke sini
sudo cp /opt/hotspot-gateway/deploy/wireguard/wg0.conf.example /etc/wireguard/wg0.conf
sudo nano /etc/wireguard/wg0.conf
sudo ufw allow 51820/udp
sudo systemctl enable --now wg-quick@wg0
```

Di MikroTik: tempel `deploy/mikrotik/wireguard.rsc` (ganti key + IP VPS).
Tes: `/ping 10.8.0.1` dari router, `ping 10.8.0.2` dari VPS.

## 6. MikroTik hotspot

1. Import `hotspot-setup.rsc` (sesuaikan interface WAN/bridge).
2. Upload `login.html` ke `Files/hotspot/login.html`.
3. Upload `mikrotik-pages/alogin.html` dan `status.html` ke folder yang sama.
4. Pastikan walled garden **hanya** `wifi.rekavia.com` + WhatsApp (tanpa YouTube).
5. Admin → Settings → MikroTik: host `10.8.0.2`, port `8728`, test connection.
6. Settings → `portal_url` = `https://wifi.rekavia.com`

## 7. WhatsApp + video

1. Buka `https://wifi.rekavia.com/admin` — ganti password seed.
2. Settings → WhatsApp: tambah sesi, scan QR sekali.
3. Admin → Iklan: upload MP4 (maks 100 MB), aktifkan. File masuk `backend/public/videos`.

## 8. Uji lapangan

1. HP sambung SSID → popup Sign in (iOS/Android).
2. Portal memutar video lokal (bukan YouTube).
3. Isi nomor WA → kode masuk WhatsApp.
4. iPhone: buka WA, kembali ke halaman portal — tetap di langkah input kode.
5. Masukkan kode → internet terbuka.

## Catatan

- Satu proses Nest saja. Jangan scale horizontal (Baileys).
- Jangan `git push` folder `wa-auth/` atau `.env`.
- Rebuild frontend setiap kali `VITE_API_URL` berubah.
- Update berikutnya cukup satu perintah: `sudo bash /var/www/hotspot-gateway/deploy/update.sh`.
  Skrip itu menarik git, build backend/frontend, merapikan izin `dist/`, lalu restart PM2 + Nginx. Tidak perlu `chmod` manual.
