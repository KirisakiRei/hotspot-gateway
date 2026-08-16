# MikroTik Hotspot — produksi wifi.rekavia.com
# Sesuaikan: interface hotspot, out-interface NAT, IP VPS, peer WireGuard.

# 1. Pool & gateway hotspot
/ip pool add name=hotspot-pool ranges=192.168.10.2-192.168.10.254
/ip address add address=192.168.10.1/24 interface=bridge
/ip dhcp-server network add address=192.168.10.0/24 gateway=192.168.10.1 dns-server=192.168.10.1

# 2. Hijack captive-detection (wajib agar popup Sign in muncul)
# Jangan izinkan host ini ke internet sebelum login.
/ip dns static add name=captive.apple.com address=192.168.10.1
/ip dns static add name=www.apple.com address=192.168.10.1
/ip dns static add name=www.icloud.com address=192.168.10.1
/ip dns static add name=gsp1.apple.com address=192.168.10.1
/ip dns static add name=connectivitycheck.gstatic.com address=192.168.10.1
/ip dns static add name=connectivitycheck.android.com address=192.168.10.1
/ip dns static add name=clients3.google.com address=192.168.10.1
/ip dns static add name=www.msftconnecttest.com address=192.168.10.1
/ip dns static add name=detectportal.firefox.com address=192.168.10.1

# 3. Hotspot profile + halaman login
/ip hotspot profile add name=public-wifi login-by=http-chap,http-pap http-cookie-lifetime=1d use-radius=no html-directory=hotspot
/ip hotspot add name=public-hotspot profile=public-wifi interface=bridge address-pool=hotspot-pool

# 4. Walled garden — HANYA portal VPS + WhatsApp
# Tidak ada YouTube/Google: video diputar dari VPS.
/ip hotspot walled-garden add dst-host=wifi.rekavia.com action=allow comment="portal+api"
/ip hotspot walled-garden add dst-host=*.whatsapp.com action=allow comment="wa"
/ip hotspot walled-garden add dst-host=*.whatsapp.net action=allow comment="wa"
/ip hotspot walled-garden add dst-host=*.w.app action=allow comment="wa"

# 5. DNS + NAT (ganti ether4 sesuai WAN)
/ip dns set allow-remote-requests=yes servers=1.1.1.1,8.8.8.8
/ip firewall nat add chain=srcnat out-interface=ether4 action=masquerade

# 6. Profil user hotspot (selaraskan nama dengan profil voucher di admin)
/ip hotspot user profile add name="Bronze - 1 Jam" rate-limit=2M/2M session-timeout=1h shared-users=1
/ip hotspot user profile add name="Silver - 3 Jam" rate-limit=5M/5M session-timeout=3h shared-users=1
/ip hotspot user profile add name="Gold - 1 Hari" rate-limit=10M/10M session-timeout=1d shared-users=2

# 7. API hanya dari tunnel WireGuard (VPS = 10.8.0.1)
/ip service set api address=10.8.0.1/32 port=8728 disabled=no
/ip service set www disabled=yes
/ip service set ftp disabled=yes
/ip service set telnet disabled=yes

:put "Hotspot produksi siap. Upload login.html ke Files/hotspot/"
