# MikroTik Hotspot — produksi wifi.rekavia.com
# Arsitektur: Direct RADIUS (tanpa VPN/API)
# VPS menggunakan FreeRADIUS (UDP 1812/1813) langsung dari IP publik router.
# Tidak ada WireGuard, tidak ada API 8728.

# ============================================================
# 1. Pool & gateway hotspot
# ============================================================
/ip pool add name=hotspot-pool ranges=192.168.10.2-192.168.10.254
/ip address add address=192.168.10.1/24 interface=bridge-hotspot
/ip dhcp-server network add address=192.168.10.0/24 gateway=192.168.10.1 dns-server=192.168.10.1

# ============================================================
# 2. DNS
# www.icloud.com diarahkan ke router agar tidak bocor ke WAN sebelum login.
# JANGAN redirect domain captive detection (connectivitycheck.gstatic.com, dll.)
# — biarkan MikroTik memblok agar device menampilkan "Sign in required".
# ============================================================
/ip dns set allow-remote-requests=yes servers=1.1.1.1,8.8.8.8
/ip dns static add name=www.icloud.com address=192.168.10.1

# ============================================================
# 3. RADIUS (Direct ke VPS — tanpa tunnel)
# Ganti VPS_PUBLIC_IP dan RADIUS_SHARED_SECRET sesuai deployment.
# NAS-Identifier = system identity (unik per router, lihat step 4).
# ============================================================
/radius add \
    service=hotspot \
    address=VPS_PUBLIC_IP \
    secret=RADIUS_SHARED_SECRET \
    authentication-port=1812 \
    accounting-port=1813 \
    timeout=1000 \
    comment="FreeRADIUS VPS"

# Aktifkan incoming CoA/PoD (opsional — butuh port-forward UDP 3799 di modem)
/radius incoming set accept=yes port=3799

# ============================================================
# 4. System identity — unik per router (jadi NAS-Identifier di RADIUS)
# Ganti ROUTER-001 dengan nama unik tiap lokasi.
# ============================================================
/system identity set name=ROUTER-001

# ============================================================
# 5. Hotspot profile + server
# use-radius=yes: semua login diteruskan ke FreeRADIUS.
# ============================================================
/ip hotspot profile add name=public-wifi \
    hotspot-address=192.168.10.1 \
    dns-name=free.wifi \
    login-by=http-chap,http-pap,cookie,mac-cookie \
    http-cookie-lifetime=1d \
    use-radius=yes \
    radius-accounting=yes \
    radius-interim-update=1m \
    html-directory=hotspot
/ip hotspot add name=public-hotspot profile=public-wifi interface=bridge-hotspot address-pool=hotspot-pool

# ============================================================
# 6. Walled garden HTTP — portal VPS bisa diakses sebelum login
# ============================================================
/ip hotspot walled-garden add dst-host=wifi.rekavia.com action=allow comment="portal+api"

# ============================================================
# 7. Walled garden IP — bypass SSL intercept untuk portal HTTPS
# Router TIDAK melakukan SSL termination untuk wifi.rekavia.com.
# ============================================================
/ip hotspot walled-garden ip add dst-host=wifi.rekavia.com action=accept comment="Bypass HTTPS Portal"

# ============================================================
# 8. NAT masquerade (ganti ether1 sesuai interface WAN)
# ============================================================
/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade comment="defconf: masquerade"

# ============================================================
# 9. Profil user hotspot lokal (fallback jika RADIUS tidak tersedia)
# Nama profil ini juga bisa digunakan sebagai Mikrotik-Group di RADIUS reply.
# ============================================================
/ip hotspot user profile add name="free-1h"  rate-limit=2M/5M   session-timeout=1h  shared-users=1
/ip hotspot user profile add name="free-1d"  rate-limit=2M/5M   session-timeout=1d  shared-users=1
/ip hotspot user profile add name="Bronze"   rate-limit=2M/2M   session-timeout=1h  shared-users=1
/ip hotspot user profile add name="Silver"   rate-limit=5M/5M   session-timeout=3h  shared-users=1
/ip hotspot user profile add name="Gold"     rate-limit=10M/10M session-timeout=1d  shared-users=2

# ============================================================
# 10. Nonaktifkan service yang tidak diperlukan
# API (8728) dinonaktifkan — tidak lagi digunakan oleh backend RADIUS.
# ============================================================
/ip service set api     disabled=yes
/ip service set www     disabled=yes
/ip service set ftp     disabled=yes
/ip service set telnet  disabled=yes

# ============================================================
# 11. Firewall input: tolak akses API dari luar jika belum dimatikan
# ============================================================
/ip firewall filter add \
    chain=input protocol=tcp dst-port=8728 \
    action=drop comment="Block API — tidak digunakan"

:put "Hotspot Direct RADIUS siap. Upload login.html ke Files/hotspot/"
:put "Pastikan: VPS_PUBLIC_IP, RADIUS_SHARED_SECRET, dan /system identity sudah diganti."
