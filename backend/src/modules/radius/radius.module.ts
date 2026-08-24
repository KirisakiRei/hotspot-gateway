import { Module } from '@nestjs/common';
import { RadiusService } from './radius.service';
import { RadiusController } from './radius.controller';
import { PrismaService } from '@/common/prisma.service';

@Module({
  controllers: [RadiusController],
  providers: [RadiusService, PrismaService],
  exports: [RadiusService],
})
export class RadiusModule {}
