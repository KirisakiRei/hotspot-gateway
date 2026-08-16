import { Module } from '@nestjs/common';
import { SettingController } from './setting.controller';
import { SettingService } from './setting.service';
import { PrismaService } from '@/common/prisma.service';
import { MikrotikModule } from '@/modules/mikrotik/mikrotik.module';

@Module({
  imports: [MikrotikModule],
  controllers: [SettingController],
  providers: [SettingService, PrismaService],
  exports: [SettingService],
})
export class SettingModule {}
