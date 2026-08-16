import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { join, parse } from 'path';

const execFileAsync = promisify(execFile);

export interface ProcessedVideo {
  videoUrl: string;
  posterUrl: string | null;
  duration: number;
  size: number;
  transcoded: boolean;
}

const MAX_DURATION_SECONDS = 60;

@Injectable()
export class VideoMediaService {
  private readonly logger = new Logger(VideoMediaService.name);
  private readonly videoDir = join(process.cwd(), 'public', 'videos');
  private readonly posterDir = join(this.videoDir, 'posters');
  private ffmpegAvailable: boolean | null = null;
  private ffprobeAvailable: boolean | null = null;

  constructor() {
    if (!existsSync(this.videoDir)) {
      mkdirSync(this.videoDir, { recursive: true });
    }
    if (!existsSync(this.posterDir)) {
      mkdirSync(this.posterDir, { recursive: true });
    }
  }

  private async checkBinary(kind: 'ffmpeg' | 'ffprobe'): Promise<boolean> {
    const cached = kind === 'ffmpeg' ? this.ffmpegAvailable : this.ffprobeAvailable;
    if (cached !== null) return cached;

    try {
      await execFileAsync(kind, ['-version'], { timeout: 5000, maxBuffer: 1024 * 1024 });
      if (kind === 'ffmpeg') this.ffmpegAvailable = true;
      else this.ffprobeAvailable = true;
      return true;
    } catch {
      if (kind === 'ffmpeg') this.ffmpegAvailable = false;
      else this.ffprobeAvailable = false;
      return false;
    }
  }

  private async probeDuration(filePath: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath],
        { timeout: 20000, maxBuffer: 1024 * 1024 },
      );
      const duration = parseFloat((stdout || '').trim());
      return Number.isFinite(duration) ? Math.round(duration) : 0;
    } catch (error) {
      this.logger.warn(`Gagal membaca metadata durasi: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  private async runFfmpeg(args: string[]): Promise<void> {
    try {
      await execFileAsync('ffmpeg', args, { timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
    } catch (error) {
      const err = error as { stderr?: string; message?: string };
      throw new Error(`ffmpeg gagal: ${(err.stderr || err.message || '').toString().slice(-400)}`);
    }
  }

  /**
   * Proses file video yang baru diupload:
   * 1. Validasi durasi (maks 60 detik bila ffprobe tersedia)
   * 2. Transcode ke 720p H.264 + AAC (bila ffmpeg tersedia)
   * 3. Ekstrak poster frame di detik ke-1
   * 4. Fallback aman bila ffmpeg tidak terpasang di host
   */
  async processUpload(filePath: string): Promise<ProcessedVideo> {
    const hasFfmpeg = await this.checkBinary('ffmpeg');
    const hasFfprobe = await this.checkBinary('ffprobe');
    const { name, ext } = parse(filePath);
    const originalVideoUrl = `/videos/${name}${ext}`;
    const originalSize = existsSync(filePath) ? statSync(filePath).size : 0;

    let duration = 0;
    if (hasFfprobe) {
      duration = await this.probeDuration(filePath);
      if (duration > MAX_DURATION_SECONDS) {
        if (existsSync(filePath)) unlinkSync(filePath);
        throw new BadRequestException(
          `Durasi video maksimal ${MAX_DURATION_SECONDS} detik (video ini terdeteksi ${duration} detik). Silakan potong video terlebih dahulu.`,
        );
      }
    } else {
      this.logger.warn('ffprobe tidak ditemukan di PATH — durasi tidak dapat divalidasi di server');
    }

    if (!hasFfmpeg) {
      this.logger.warn('ffmpeg tidak ditemukan di PATH — file asli disimpan langsung tanpa transcode');
      return {
        videoUrl: originalVideoUrl,
        posterUrl: null,
        duration,
        size: originalSize,
        transcoded: false,
      };
    }

    const outputName = `${name}-720p.mp4`;
    const outputPath = join(this.videoDir, outputName);

    try {
      // 720p H.264 + AAC, CRF 27, preset veryfast, +faststart untuk streaming cepat
      await this.runFfmpeg([
        '-y',
        '-i',
        filePath,
        '-vf',
        'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '27',
        '-c:a',
        'aac',
        '-b:a',
        '96k',
        '-movflags',
        '+faststart',
        outputPath,
      ]);
    } catch (error) {
      this.logger.warn(`Transcode 720p gagal (${error instanceof Error ? error.message : String(error)}) — memakai file asli`);
      return {
        videoUrl: originalVideoUrl,
        posterUrl: null,
        duration,
        size: originalSize,
        transcoded: false,
      };
    }

    // Berhasil transcode: hapus file mentah asli
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    const transcodedSize = existsSync(outputPath) ? statSync(outputPath).size : 0;
    this.logger.log(`Video berhasil ditranscode ke 720p: ${outputName} (${Math.round(transcodedSize / 1024)} KB)`);

    // Ekstrak poster frame di detik ke-1
    let posterUrl: string | null = null;
    try {
      const posterName = `${name}-poster.jpg`;
      const posterPath = join(this.posterDir, posterName);
      await this.runFfmpeg([
        '-y',
        '-ss',
        '1',
        '-i',
        outputPath,
        '-frames:v',
        '1',
        '-q:v',
        '3',
        posterPath,
      ]);
      posterUrl = `/videos/posters/${posterName}`;
      this.logger.log(`Poster frame dibuat: ${posterName}`);
    } catch (error) {
      this.logger.warn(`Pembuatan poster frame gagal: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      videoUrl: `/videos/${outputName}`,
      posterUrl,
      duration,
      size: transcodedSize,
      transcoded: true,
    };
  }
}
