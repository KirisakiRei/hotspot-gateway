import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { YouTubeService } from './youtube.service';
import { CreateAdvertisementDto } from './dto/create-advertisement.dto';
import { UpdateAdvertisementDto } from './dto/update-advertisement.dto';
import { Advertisement, Prisma, VideoType } from '@prisma/client';

interface AdTargeting {
  timeSlots?: string[];
  deviceTypes?: string[];
  daysOfWeek?: number[];
}

const VIDEO_TYPES = new Set<string>(Object.values(VideoType));

@Injectable()
export class AdvertisementService {
  private readonly logger = new Logger(AdvertisementService.name);

  constructor(
    private prisma: PrismaService,
    private youtubeService: YouTubeService,
  ) {}

  async create(createDto: CreateAdvertisementDto) {
    // Extract YouTube ID if URL provided
    let youtubeId: string | undefined;

    if (createDto.videoType === 'YOUTUBE' && createDto.videoUrl) {
      youtubeId = this.youtubeService.extractYoutubeId(createDto.videoUrl) || undefined;
      if (!youtubeId) {
        throw new BadRequestException('Invalid YouTube URL');
      }

      // Auto-generate thumbnail if not provided
      if (!createDto.thumbnailUrl) {
        createDto.thumbnailUrl =
          this.youtubeService.getThumbnailUrl(youtubeId);
      }
    }

    // Calculate display duration
    const startTime = createDto.startTime ?? 0;
    const displayDuration = (createDto.endTime || createDto.duration) - startTime;

    const advertisement = await this.prisma.advertisement.create({
      data: {
        ...createDto,
        youtubeId,
        displayDuration,
      } as Prisma.AdvertisementCreateInput,
    });

    this.logger.log(`Created advertisement: ${advertisement.title}`);
    return advertisement;
  }

  async findAll(filters?: {
    isActive?: boolean;
    videoType?: string;
    search?: string;
  }) {
    const where: Prisma.AdvertisementWhereInput = {};

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.videoType && VIDEO_TYPES.has(filters.videoType)) {
      where.videoType = filters.videoType as VideoType;
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    return this.prisma.advertisement.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const ad = await this.prisma.advertisement.findUnique({
      where: { id },
      include: {
        fallback: true,
      },
    });

    if (!ad) {
      throw new NotFoundException(`Advertisement with ID ${id} not found`);
    }

    return ad;
  }

  async update(id: string, updateDto: UpdateAdvertisementDto) {
    const current = await this.findOne(id); // Check if exists

    // Update YouTube ID if URL changed
    let youtubeId = current.youtubeId;
    const videoUrl = updateDto.videoUrl;
    
    if (videoUrl) {
      const extractedId = this.youtubeService.extractYoutubeId(videoUrl);
      if (extractedId) {
        youtubeId = extractedId;
      }
    }

    // Recalculate display duration if needed
    let displayDuration = current.displayDuration;
    const startTimeUpdate = updateDto.startTime;
    const endTimeUpdate = updateDto.endTime;
    const durationUpdate = updateDto.duration;
    
    if (startTimeUpdate !== undefined || endTimeUpdate !== undefined || durationUpdate !== undefined) {
      const startTime = startTimeUpdate ?? current.startTime;
      const endTime = endTimeUpdate ?? current.endTime;
      const duration = durationUpdate ?? current.duration;

      displayDuration = (endTime || duration) - startTime;
    }

    const updated = await this.prisma.advertisement.update({
      where: { id },
      data: {
        ...updateDto,
        youtubeId,
        displayDuration,
      } as Prisma.AdvertisementUpdateInput,
    });

    this.logger.log(`Updated advertisement: ${updated.title}`);
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.advertisement.delete({
      where: { id },
    });

    this.logger.log(`Deleted advertisement: ${id}`);
    return { message: 'Advertisement deleted successfully' };
  }

  // Get active ad for portal (with rotation logic)
  async getActiveAd(options?: { deviceType?: string; timeSlot?: string }) {
    const now = new Date();

    // Get all active ads within date range
    const activeAds = await this.prisma.advertisement.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: null },
          { startDate: null, endDate: { gte: now } },
        ],
      },
      orderBy: { priority: 'desc' },
    });

    if (activeAds.length === 0) {
      return null;
    }

    // Filter by targeting if specified
    let filteredAds = activeAds.filter((ad) => {
      if (!ad.targeting) return true;

      const targeting = (ad.targeting ?? {}) as AdTargeting;

      // Check time slot
      if (options?.timeSlot && targeting.timeSlots) {
        if (!targeting.timeSlots.includes(options.timeSlot)) {
          return false;
        }
      }

      // Check device type
      if (options?.deviceType && targeting.deviceTypes) {
        if (!targeting.deviceTypes.includes(options.deviceType)) {
          return false;
        }
      }

      // Check day of week
      if (targeting.daysOfWeek) {
        const dayOfWeek = now.getDay();
        if (!targeting.daysOfWeek.includes(dayOfWeek)) {
          return false;
        }
      }

      return true;
    });

    if (filteredAds.length === 0) {
      filteredAds = activeAds; // Fallback to all active ads
    }

    // Check maxViewsPerDay
    filteredAds = await Promise.all(
      filteredAds.map(async (ad) => {
        if (ad.maxViewsPerDay) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          // This would require a separate tracking table for daily views
          // For now, we'll skip this check
        }
        return ad;
      }),
    ).then((ads) => ads.filter(Boolean));

    // Weighted random selection
    if (filteredAds.length === 1) {
      return filteredAds[0];
    }

    return this.selectByWeight(filteredAds);
  }

  // Weighted random selection algorithm
  private selectByWeight(ads: Advertisement[]) {
    const totalWeight = ads.reduce((sum, ad) => sum + ad.weight, 0);
    let random = Math.random() * totalWeight;

    for (const ad of ads) {
      random -= ad.weight;
      if (random <= 0) {
        return ad;
      }
    }

    return ads[0]; // Fallback
  }

  // Analytics tracking
  async trackView(id: string) {
    const ad = await this.findOne(id);

    await this.prisma.advertisement.update({
      where: { id },
      data: {
        views: ad.views + 1,
      },
    });

    this.logger.log(`Tracked view for advertisement: ${ad.title}`);
  }

  async trackCompletion(id: string, watchTime: number) {
    const ad = await this.findOne(id);

    // Calculate new average watch time
    const totalWatchTime = ad.avgWatchTime * ad.completions + watchTime;
    const newCompletions = ad.completions + 1;
    const newAvgWatchTime = totalWatchTime / newCompletions;

    // Calculate completion rate
    const newViews = ad.views || 1;
    const completionRate = (newCompletions / newViews) * 100;

    await this.prisma.advertisement.update({
      where: { id },
      data: {
        completions: newCompletions,
        avgWatchTime: newAvgWatchTime,
        completionRate,
      },
    });

    this.logger.log(`Tracked completion for advertisement: ${ad.title}`);
  }

  async trackSkip(id: string) {
    const ad = await this.findOne(id);

    await this.prisma.advertisement.update({
      where: { id },
      data: {
        skips: ad.skips + 1,
      },
    });

    this.logger.log(`Tracked skip for advertisement: ${ad.title}`);
  }

  // Get statistics
  async getStats() {
    const ads = await this.prisma.advertisement.findMany();

    const totalViews = ads.reduce((sum, ad) => sum + Number(ad.views), 0);
    const totalCompletions = ads.reduce((sum, ad) => sum + Number(ad.completions), 0);
    const totalSkips = ads.reduce((sum, ad) => sum + Number(ad.skips), 0);

    return {
      total: ads.length,
      active: ads.filter((ad) => ad.isActive).length,
      totalViews,
      totalCompletions,
      totalSkips,
      avgCompletionRate:
        totalViews > 0 ? (totalCompletions / totalViews) * 100 : 0,
    };
  }
}
