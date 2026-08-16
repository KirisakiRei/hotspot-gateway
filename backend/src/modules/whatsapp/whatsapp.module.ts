// ==========================================
// WHATSAPP GATEWAY - Module
// ==========================================

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '@/common/prisma.service';
import { SessionManager } from './session.manager';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';

@Module({
  imports: [ConfigModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, SessionManager, PrismaService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
