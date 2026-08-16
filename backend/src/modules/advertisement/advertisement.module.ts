import { Module } from '@nestjs/common';
import { AdvertisementService } from './advertisement.service';
import { AdvertisementController } from './advertisement.controller';
import { YouTubeService } from './youtube.service';
import { PrismaService } from '@/common/prisma.service';

@Module({
  controllers: [AdvertisementController],
  providers: [AdvertisementService, YouTubeService, PrismaService],
  exports: [AdvertisementService],
})
export class AdvertisementModule {}
