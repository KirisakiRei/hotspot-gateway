import { Module, forwardRef } from '@nestjs/common';
import { VoucherService } from './voucher.service';
import { VoucherController } from './voucher.controller';
import { PrismaService } from '@/common/prisma.service';
import { WhatsappModule } from '@/modules/whatsapp/whatsapp.module';
import { MikrotikModule } from '@/modules/mikrotik/mikrotik.module';
import { SessionModule } from '@/modules/session/session.module';

@Module({
  imports: [forwardRef(() => WhatsappModule), MikrotikModule, SessionModule],
  controllers: [VoucherController],
  providers: [VoucherService, PrismaService],
  exports: [VoucherService],
})
export class VoucherModule {}
