import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikrotikService } from './mikrotik.service';
import { MikrotikController } from './mikrotik.controller';
import { MikrotikGateway } from './mikrotik.gateway';
import { MikrotikConnectionManager } from './mikrotik-connection.manager';
import { PrismaService } from '@/common/prisma.service';
import { requireSecret } from '@/common/config/env';
import { RedisModule } from '@/modules/redis/redis.module';

@Module({
  imports: [
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: requireSecret(configService, 'JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [MikrotikController],
  providers: [MikrotikService, MikrotikConnectionManager, MikrotikGateway, PrismaService],
  exports: [MikrotikService, MikrotikGateway],
})
export class MikrotikModule {}
