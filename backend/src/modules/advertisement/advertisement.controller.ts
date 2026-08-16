import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { basename, extname, join } from 'path';
import type { Request } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { AdvertisementService } from './advertisement.service';
import { VideoMediaService } from './video-media.service';
import { CreateAdvertisementDto } from './dto/create-advertisement.dto';
import { UpdateAdvertisementDto } from './dto/update-advertisement.dto';
import { TrackViewDto, TrackCompletionDto } from './dto/track.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ApiResponseDto } from '@/common/dto/api-response.dto';
import { AdminRole } from '@prisma/client';

const uploadDir = join(process.cwd(), 'public', 'videos');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

@Controller('advertisements')
export class AdvertisementController {
  constructor(
    private readonly advertisementService: AdvertisementService,
    private readonly videoMediaService: VideoMediaService,
  ) {}

  // Upload video file
  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('video', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `ad-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
        const allowedMimes = ['video/mp4', 'video/webm', 'video/ogg'];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Hanya format MP4, WebM, dan OGG yang didukung'), false);
        }
      },
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max upload mentah
      },
    }),
  )
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File video tidak ditemukan');
    }

    const processed = await this.videoMediaService.processUpload(file.path);

    return ApiResponseDto.success('Video berhasil diupload dan diproses', {
      filename: basename(processed.videoUrl),
      originalName: file.originalname,
      size: processed.size,
      duration: processed.duration,
      transcoded: processed.transcoded,
      posterUrl: processed.posterUrl,
      videoUrl: processed.videoUrl,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async create(@Body() createDto: CreateAdvertisementDto) {
    const ad = await this.advertisementService.create(createDto);
    return ApiResponseDto.success('Advertisement created successfully', ad);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query('isActive') isActive?: string,
    @Query('videoType') videoType?: string,
    @Query('search') search?: string,
  ) {
    const filters = {
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      videoType,
      search,
    };
    const ads = await this.advertisementService.findAll(filters);
    return ApiResponseDto.success('Advertisements retrieved', ads);
  }

  @Get('active')
  async getActiveAd(
    @Query('deviceType') deviceType?: string,
    @Query('timeSlot') timeSlot?: string,
  ) {
    const ad = await this.advertisementService.getActiveAd({
      deviceType,
      timeSlot,
    });
    return ApiResponseDto.success(
      ad ? 'Active advertisement found' : 'No active advertisement',
      ad,
    );
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats() {
    const stats = await this.advertisementService.getStats();
    return ApiResponseDto.success('Statistics retrieved', stats);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    const ad = await this.advertisementService.findOne(id);
    return ApiResponseDto.success('Advertisement retrieved', ad);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAdvertisementDto,
  ) {
    const ad = await this.advertisementService.update(id, updateDto);
    return ApiResponseDto.success('Advertisement updated successfully', ad);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async remove(@Param('id') id: string) {
    const result = await this.advertisementService.remove(id);
    return ApiResponseDto.success(result.message);
  }

  @Post(':id/view')
  async trackView(@Param('id') id: string, @Body() trackDto: TrackViewDto) {
    await this.advertisementService.trackView(id);
    return ApiResponseDto.success('View tracked successfully');
  }

  @Post(':id/complete')
  async trackCompletion(
    @Param('id') id: string,
    @Body() trackDto: TrackCompletionDto,
  ) {
    await this.advertisementService.trackCompletion(id, trackDto.watchTime);
    return ApiResponseDto.success('Completion tracked successfully');
  }

  @Post(':id/skip')
  async trackSkip(@Param('id') id: string) {
    await this.advertisementService.trackSkip(id);
    return ApiResponseDto.success('Skip tracked successfully');
  }
}
