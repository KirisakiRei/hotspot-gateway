# MikroTik Hotspot — produksi wifi.rekavia.com
# Sesuaikan: interface hotspot, out-interface NAT, IP VPS, peer WireGuard.

# 1. Pool & gateway hotspot
/ip pool add name=hotspot-pool ranges=192.168.10.2-192.168.10.254
/ip address add address=192.168.10.1/24 interface=bridge-hotspot
/ip dhcp-server network add address=192.168.10.0/24 gateway=192.168.10.1 dns-server=192.168.10.1

# 2. Captive portal detection
# JANGAN hijack domain captive detection ke router (192.168.10.1).
# Biarkan device resolve ke IP asli Apple/Google via DNS upstream.
# MikroTik akan memblok koneksi (karena belum auth) sehingga device
# mendeteksi captive portal dan menampilkan popup "Sign in required".
#
# www.icloud.com sengaja tidak di-static agar tidak bocor ke WAN sebelum login.
/ip dns static add name=www.icloud.com address=192.168.10.1

# 3. Hotspot profile + halaman login
/ip hotspot profile add name=public-wifi \
    hotspot-address=192.168.10.1 \
    dns-name=free.wifi \
    login-by=http-chap,http-pap,cookie,mac-cookie \
    http-cookie-lifetime=1d \
    use-radius=no \
    html-directory=hotspot
/ip hotspot add name=public-hotspot profile=public-wifi interface=bridge-hotspot address-pool=hotspot-pool

# 4. Walled garden HTTP — portal VPS (port 80)
/ip hotspot walled-garden add dst-host=wifi.rekavia.com action=allow comment="portal+api"

# 5. Walled garden IP — portal VPS (port 443 HTTPS, bypass SSL intercept)
# Tanpa ini, browser mendapat SSL error saat memuat portal HTTPS.
/ip hotspot walled-garden ip add dst-host=wifi.rekavia.com action=accept comment="Bypass HTTPS Portal"

# 6. DNS + NAT (ganti ether1 sesuai interface WAN)
/ip dns set allow-remote-requests=yes servers=1.1.1.1,8.8.8.8
/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade comment="defconf: masquerade"

# 7. Profil user hotspot (selaraskan nama dengan profil voucher di admin)
/ip hotspot user profile add name="Bronze - 1 Jam" rate-limit=2M/2M session-timeout=1h shared-users=1
/ip hotspot user profile add name="Silver - 3 Jam" rate-limit=5M/5M session-timeout=3h shared-users=1
/ip hotspot user profile add name="Gold - 1 Hari" rate-limit=10M/10M session-timeout=1d shared-users=2

# 8. API hanya dari tunnel WireGuard (VPS = 10.8.0.1)
/ip service set api address=10.8.0.1/32 port=8728 disabled=no
/ip service set www disabled=yes
/ip service set ftp disabled=yes
/ip service set telnet disabled=yes

# 9. Firewall input: izinkan API dari WireGuard sebelum rule drop
/ip firewall filter add chain=input protocol=tcp dst-port=8728 \
    src-address=10.8.0.1 action=accept comment="API dari VPS" \
    place-before=[find comment="defconf: drop all not coming from LAN"]

:put "Hotspot produksi siap. Upload login.html ke Files/hotspot/"
