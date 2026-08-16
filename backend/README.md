# Backend — Hotspot Gateway

API NestJS untuk portal hotspot, voucher, MikroTik, dan gateway WhatsApp (Baileys).

Dokumentasi setup lengkap ada di [README root](../README.md).

```bash
cp .env.example .env
bun install
bunx prisma migrate deploy
bunx prisma generate
bun run prisma:seed
bunx nest build
bun dist/src/main.js
```

Server default: `http://localhost:3001/api`.
