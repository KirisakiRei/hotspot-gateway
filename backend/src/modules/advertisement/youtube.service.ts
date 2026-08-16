import { Injectable } from '@nestjs/common';

@Injectable()
export class YouTubeService {
  // Extract YouTube ID from various URL formats
  extractYoutubeId(url: string): string | null {
    if (!url) return null;

    // Handle direct ID
    if (url.length === 11 && !url.includes('/') && !url.includes('.')) {
      return url;
    }

    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  // Validate YouTube URL
  validateYoutubeUrl(url: string): boolean {
    return this.extractYoutubeId(url) !== null;
  }

  // Generate thumbnail URL from YouTube ID
  getThumbnailUrl(
    videoId: string,
    quality: 'default' | 'hq' | 'mq' | 'sd' | 'maxres' = 'maxres',
  ): string {
    const qualityMap = {
      default: 'default',
      mq: 'mqdefault',
      hq: 'hqdefault',
      sd: 'sddefault',
      maxres: 'maxresdefault',
    };

    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
  }

  // Generate YouTube embed URL
  getEmbedUrl(videoId: string, options?: {
    autoplay?: boolean;
    controls?: boolean;
    rel?: boolean;
    modestbranding?: boolean;
    start?: number;
    end?: number;
  }): string {
    const params = new URLSearchParams();

    if (options?.autoplay) params.append('autoplay', '1');
    if (options?.controls === false) params.append('controls', '0');
    if (options?.rel === false) params.append('rel', '0');
    if (options?.modestbranding) params.append('modestbranding', '1');
    if (options?.start) params.append('start', options.start.toString());
    if (options?.end) params.append('end', options.end.toString());

    params.append('playsinline', '1');
    params.append('enablejsapi', '1');

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }
}
