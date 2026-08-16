import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { PrismaService } from '@/common/prisma.service';
import { MikrotikModule } from '@/modules/mikrotik/mikrotik.module';

@Module({
  imports: [MikrotikModule],
  providers: [SessionService, PrismaService],
  exports: [SessionService],
})
export class SessionModule {}
