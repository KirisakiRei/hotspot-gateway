# MIKROTIK HOTSPOT SETUP

# 1. IP POOL
/ip pool add name=hotspot-pool ranges=192.168.10.2-192.168.10.254

# 2. BRIDGE IP
/ip address add address=192.168.10.1/24 interface=bridge

# 3. DHCP NETWORK
# DNS = router (192.168.10.1) agar host captive-detection bisa di-intercept
# sehingga perangkat SELALU memunculkan "Sign in required"
/ip dhcp-server network add address=192.168.10.0/24 gateway=192.168.10.1 dns-server=192.168.10.1

# 3b. BLOCK CAPTIVE-PORTAL DETECTION (WAJIB agar trigger muncul)
# Perangkat (Android/iOS/Windows) mengetes koneksi ke host di bawah ini.
# Jika host ini bisa diakses → perangkat mengira "sudah ada internet" → popup
# "Sign in required" TIDAK muncul. Dengan DNS static ke gateway (tidak ada web
# server di :80) tes selalu gagal → captive portal selalu ter-trigger.
/ip dns static add name=connectivitycheck.gstatic.com address=192.168.10.1
/ip dns static add name=connectivitycheck.android.com address=192.168.10.1
/ip dns static add name=clients3.google.com address=192.168.10.1
/ip dns static add name=captive.apple.com address=192.168.10.1
/ip dns static add name=www.msftconnecttest.com address=192.168.10.1
/ip dns static add name=detectportal.firefox.com address=192.168.10.1

# 4. HOTSPOT PROFILE
/ip hotspot profile add name=public-wifi
/ip hotspot profile set public-wifi login-by=http-chap,http-pap
/ip hotspot profile set public-wifi http-cookie-lifetime=1d
/ip hotspot profile set public-wifi use-radius=no

# 5. HOTSPOT SERVER
/ip hotspot add name=public-hotspot profile=public-wifi interface=bridge address-pool=hotspot-pool

# 6. WALLED GARDEN - YOUTUBE
/ip hotspot walled-garden add dst-host=localhost action=allow
/ip hotspot walled-garden add dst-host=*.youtube.com action=allow
/ip hotspot walled-garden add dst-host=*.googlevideo.com action=allow
/ip hotspot walled-garden add dst-host=*.ytimg.com action=allow
/ip hotspot walled-garden add dst-host=*.ggpht.com action=allow
/ip hotspot walled-garden add dst-host=*.google.com action=allow
/ip hotspot walled-garden add dst-host=*.gstatic.com action=allow
/ip hotspot walled-garden add dst-host=*.googleapis.com action=allow

# 6b. WALLED GARDEN - PORTAL & BACKEND (WAJIB!)
# Server aplikasi harus bisa diakses TANPA login (alur: redirect → portal → ad → WA → voucher)
# Ganti 192.168.88.100 dengan IP server Anda. Rule dst-host tanpa dst-port
# mencakup semua port (80/443/5173/3001) — cukup satu rule per host/IP.
/ip hotspot walled-garden add dst-host=192.168.88.100 action=allow

# 7. WALLED GARDEN - WHATSAPP
# WA harus bisa diakses tanpa login: user menerima voucher via WhatsApp SEBELUM login
/ip hotspot walled-garden add dst-host=*.whatsapp.com action=allow
/ip hotspot walled-garden add dst-host=*.whatsapp.net action=allow
/ip hotspot walled-garden add dst-host=*.w.app action=allow

# 8. WALLED GARDEN - CDN
/ip hotspot walled-garden add dst-host=*.cloudflare.com action=allow

# 9. DNS
/ip dns set allow-remote-requests=yes
/ip dns set servers=8.8.8.8,8.8.4.4

# 10. NAT
    /ip firewall nat add chain=srcnat out-interface=ether4 action=masquerade

    # 11. USER PROFILES
    /ip hotspot user profile add name=1-Hour-Free rate-limit=1M/1M session-timeout=1h shared-users=1
    /ip hotspot user profile add name=12-Hour-Standard rate-limit=2M/2M session-timeout=12h shared-users=1
    /ip hotspot user profile add name=1-Day-Premium rate-limit=5M/5M session-timeout=1d shared-users=1

    :put "Setup completed!"