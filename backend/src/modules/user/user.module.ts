import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaService } from '@/common/prisma.service';
import { SessionModule } from '@/modules/session/session.module';

@Module({
  imports: [SessionModule],
  controllers: [UserController],
  providers: [UserService, PrismaService],
  exports: [UserService],
})
export class UserModule {}
