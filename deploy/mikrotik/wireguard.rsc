# WireGuard client di MikroTik (RouterOS 7+)
# Ganti key dan endpoint IP publik VPS.

/interface wireguard add name=wg-vps listen-port=13231 private-key="MIKROTIK_PRIVATE_KEY"
/ip address add address=10.8.0.2/24 interface=wg-vps
/interface wireguard peers add interface=wg-vps \
    public-key="VPS_PUBLIC_KEY" \
    endpoint-address=VPS_PUBLIC_IP \
    endpoint-port=51820 \
    allowed-address=10.8.0.1/32 \
    persistent-keepalive=25s

# Tes: /ping 10.8.0.1
# Di admin portal: MikroTik host = 10.8.0.2  port = 8728
