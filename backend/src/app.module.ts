import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './common/prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { AdvertisementModule } from './modules/advertisement/advertisement.module';
import { VoucherModule } from './modules/voucher/voucher.module';
import { MikrotikModule } from './modules/mikrotik/mikrotik.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { UserModule } from './modules/user/user.module';
import { SessionModule } from './modules/session/session.module';
import { SettingModule } from './modules/setting/setting.module';
import { LogModule } from './modules/log/log.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { RedisModule } from './modules/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Rate limiting configuration (global guard aktif)
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 100, // 100 requests per minute per IP
    }]),
    RedisModule,
    AuthModule,
    AdminModule,
    AdvertisementModule,
    VoucherModule,
    MikrotikModule,
    WhatsappModule,
    SessionModule,
    UserModule,
    SettingModule,
    LogModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
