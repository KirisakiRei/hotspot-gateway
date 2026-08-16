import { Module } from '@nestjs/common';
import { AdvertisementService } from './advertisement.service';
import { AdvertisementController } from './advertisement.controller';
import { YouTubeService } from './youtube.service';
import { VideoMediaService } from './video-media.service';
import { PrismaService } from '@/common/prisma.service';

@Module({
  controllers: [AdvertisementController],
  providers: [AdvertisementService, YouTubeService, VideoMediaService, PrismaService],
  exports: [AdvertisementService, VideoMediaService],
})
export class AdvertisementModule {}
