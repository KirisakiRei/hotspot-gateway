import { LogStatus, LogType, PrismaClient, SettingType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...\n');

  // Clear existing data (development only)
  if (process.env.NODE_ENV !== 'production') {
    console.log('🗑️  Clearing existing data...');
    await prisma.systemLog.deleteMany();
    await prisma.session.deleteMany();
    await prisma.voucherBatch.deleteMany();
    await prisma.voucher.deleteMany();
    await prisma.voucherProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.advertisement.deleteMany();
    await prisma.setting.deleteMany();
    await prisma.admin.deleteMany();
    console.log('✅ Existing data cleared\n');
  }

  // ==========================================
  // 1. CREATE ADMINS
  // ==========================================
  console.log('👤 Creating admins...');
  
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const superAdmin = await prisma.admin.create({
    data: {
      email: 'admin@hotspot.local',
      password: hashedPassword,
      name: 'Super Administrator',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  const admin = await prisma.admin.create({
    data: {
      email: 'operator@hotspot.local',
      password: await bcrypt.hash('operator123', 10),
      name: 'Admin Operator',
      role: 'ADMIN',
      isActive: true,
    },
  });

  const operator = await prisma.admin.create({
    data: {
      email: 'viewer@hotspot.local',
      password: await bcrypt.hash('viewer123', 10),
      name: 'Operator Viewer',
      role: 'OPERATOR',
      isActive: true,
    },
  });

  console.log(`✅ Created ${3} admins`);
  console.log(`   - admin@hotspot.local (password: admin123)`);
  console.log(`   - operator@hotspot.local (password: operator123)`);
  console.log(`   - viewer@hotspot.local (password: viewer123)\n`);

  // ==========================================
  // 2. CREATE VOUCHER PROFILES
  // ==========================================
  console.log('🎫 Creating voucher profiles...');

  const bronzeProfile = await prisma.voucherProfile.create({
    data: {
      name: 'Bronze - 1 Jam',
      description: 'Paket bronze untuk akses internet 1 jam',
      duration: 60, // 1 hour
      quota: BigInt(500 * 1024 * 1024), // 500MB
      uploadSpeed: 2048, // 2Mbps
      downloadSpeed: 2048,
      sharedUsers: 1,
      validityDays: 30,
      price: 5000,
      isActive: true,
    },
  });

  const silverProfile = await prisma.voucherProfile.create({
    data: {
      name: 'Silver - 3 Jam',
      description: 'Paket silver untuk akses internet 3 jam',
      duration: 180, // 3 hours
      quota: BigInt(1 * 1024 * 1024 * 1024), // 1GB
      uploadSpeed: 5120, // 5Mbps
      downloadSpeed: 5120,
      sharedUsers: 1,
      validityDays: 30,
      price: 10000,
      isActive: true,
    },
  });

  const goldProfile = await prisma.voucherProfile.create({
    data: {
      name: 'Gold - 1 Hari',
      description: 'Paket gold untuk akses internet 1 hari penuh',
      duration: 1440, // 24 hours
      quota: BigInt(5 * 1024 * 1024 * 1024), // 5GB
      uploadSpeed: 10240, // 10Mbps
      downloadSpeed: 10240,
      sharedUsers: 2,
      validityDays: 30,
      price: 25000,
      isActive: true,
    },
  });

  console.log(`✅ Created ${3} voucher profiles\n`);

  // ==========================================
  // 3. CREATE VOUCHERS
  // ==========================================
  console.log('🎟️  Creating vouchers...');

  const voucherBatch = `SEED-${Date.now()}`;
  let totalVouchers = 0;

  // Bronze vouchers
  for (let i = 1; i <= 20; i++) {
    await prisma.voucher.create({
      data: {
        code: `HOTBRONZE${String(i).padStart(4, '0')}`,
        profileId: bronzeProfile.id,
        status: 'UNUSED',
        batchId: voucherBatch,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    totalVouchers++;
  }

  // Silver vouchers
  for (let i = 1; i <= 15; i++) {
    await prisma.voucher.create({
      data: {
        code: `HOTSILVER${String(i).padStart(4, '0')}`,
        profileId: silverProfile.id,
        status: 'UNUSED',
        batchId: voucherBatch,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    totalVouchers++;
  }

  // Gold vouchers
  for (let i = 1; i <= 10; i++) {
    await prisma.voucher.create({
      data: {
        code: `HOTGOLD${String(i).padStart(5, '0')}`,
        profileId: goldProfile.id,
        status: 'UNUSED',
        batchId: voucherBatch,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    totalVouchers++;
  }

  console.log(`✅ Created ${totalVouchers} vouchers\n`);

  // ==========================================
  // 4. CREATE USERS
  // ==========================================
  console.log('👥 Creating users...');

  const users = [];
  for (let i = 1; i <= 10; i++) {
    const user = await prisma.user.create({
      data: {
        phone: `+62812345${String(i).padStart(4, '0')}`,
        macAddress: `AA:BB:CC:DD:EE:${String(i).padStart(2, '0')}`,
        ipAddress: `192.168.10.${100 + i}`,
        status: i <= 3 ? 'ONLINE' : 'OFFLINE',
        loginAt: i <= 3 ? new Date() : null,
      },
    });
    users.push(user);
  }

  console.log(`✅ Created ${users.length} users\n`);

  // ==========================================
  // 5. CREATE SESSIONS
  // ==========================================
  console.log('📊 Creating sessions...');

  for (let i = 0; i < 3; i++) {
    // Only create session if user has MAC address
    if (users[i].macAddress) {
      await prisma.session.create({
        data: {
          userId: users[i].id,
          ipAddress: users[i].ipAddress!,
          macAddress: users[i].macAddress!, // Assert non-null since we checked
          bytesIn: BigInt(Math.floor(Math.random() * 100000000)),
          bytesOut: BigInt(Math.floor(Math.random() * 500000000)),
          startedAt: new Date(Date.now() - Math.random() * 3600000),
        },
      });
    }
  }

  console.log(`✅ Created ${3} active sessions\n`);

  // ==========================================
  // 6. CREATE ADVERTISEMENTS
  // ==========================================
  console.log('🎬 Creating advertisements...');

  console.log('ℹ️  Iklan YouTube tidak di-seed. Upload video lokal lewat Admin → Iklan.\n');

  // ==========================================
  // 7. CREATE SETTINGS
  // ==========================================
  console.log('⚙️  Creating settings...');

  const settings = [
    // Mikrotik Settings
    {
      key: 'mikrotik_host',
      value: '10.10.10.1',
      type: SettingType.STRING,
      group: 'mikrotik',
      description: 'Mikrotik router IP address',
    },
    {
      key: 'mikrotik_port',
      value: '8728',
      type: SettingType.NUMBER,
      group: 'mikrotik',
      description: 'Mikrotik API port',
    },
    {
      key: 'mikrotik_username',
      value: 'admin',
      type: SettingType.STRING,
      group: 'mikrotik',
      description: 'Mikrotik admin username',
    },
    {
      key: 'mikrotik_password',
      value: '',
      type: SettingType.PASSWORD,
      group: 'mikrotik',
      description: 'Mikrotik admin password',
      isEncrypted: true,
    },
    // WhatsApp Gateway (Baileys) Settings
    {
      key: 'wa_enabled',
      value: 'true',
      type: SettingType.BOOLEAN,
      group: 'whatsapp',
      description: 'Master switch gateway WhatsApp',
    },
    {
      key: 'wa_round_robin_threshold',
      value: '5',
      type: SettingType.NUMBER,
      group: 'whatsapp',
      description: 'Jumlah pesan per nomor sebelum round-robin berganti',
    },
    {
      key: 'wa_auto_reconnect',
      value: 'true',
      type: SettingType.BOOLEAN,
      group: 'whatsapp',
      description: 'Auto-reconnect saat koneksi WhatsApp putus',
    },
    // Portal Settings
    {
      key: 'portal_url',
      value: 'https://wifi.rekavia.com',
      type: SettingType.STRING,
      group: 'portal',
      description: 'Base URL portal (tanpa /portal) untuk template pesan WhatsApp',
    },
    {
      key: 'portal_title',
      value: 'Free WiFi Hotspot',
      type: SettingType.STRING,
      group: 'portal',
      description: 'Portal page title',
    },
    {
      key: 'portal_description',
      value: 'Connect and enjoy free internet access',
      type: SettingType.STRING,
      group: 'portal',
      description: 'Portal page description',
    },
  ];

  for (const setting of settings) {
    await prisma.setting.create({ data: setting });
  }

  console.log(`✅ Created ${settings.length} settings\n`);

  // ==========================================
  // 8. CREATE SYSTEM LOGS
  // ==========================================
  console.log('📝 Creating system logs...');

  const logTypes: LogType[] = [LogType.AUTH, LogType.USER, LogType.VOUCHER, LogType.SYSTEM];
  const actions = ['LOGIN', 'CREATE', 'UPDATE', 'DELETE'] as const;
  const statuses: LogStatus[] = [LogStatus.SUCCESS, LogStatus.ERROR];

  for (let i = 0; i < 20; i++) {
    await prisma.systemLog.create({
      data: {
        adminId: Math.random() > 0.5 ? superAdmin.id : admin.id,
        type: logTypes[Math.floor(Math.random() * logTypes.length)],
        action: actions[Math.floor(Math.random() * actions.length)],
        description: `System log entry ${i + 1}`,
        status: Math.random() > 0.1 ? statuses[0] : statuses[1],
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log(`✅ Created ${20} system logs\n`);

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('✨ Seeding completed successfully!\n');
  console.log('📊 Summary:');
  console.log(`   - Admins: 3`);
  console.log(`   - Voucher Profiles: 3`);
  console.log(`   - Vouchers: ${totalVouchers}`);
  console.log(`   - Users: ${users.length}`);
  console.log(`   - Sessions: 3`);
      console.log(`   - Advertisements: 0 (upload video lokal di Admin)`);
  console.log(`   - Settings: ${settings.length}`);
  console.log(`   - System Logs: 20\n`);

  console.log('🔐 Login Credentials:');
  console.log('   Super Admin: admin@hotspot.local / admin123');
  console.log('   Admin: operator@hotspot.local / operator123');
  console.log('   Operator: viewer@hotspot.local / viewer123\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
