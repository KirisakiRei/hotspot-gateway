import { Module } from '@nestjs/common';
import { RouterService } from './router.service';
import { RouterController } from './router.controller';
import { PrismaService } from '@/common/prisma.service';

@Module({
  controllers: [RouterController],
  providers: [RouterService, PrismaService],
  exports: [RouterService],
})
export class RouterModule {}
