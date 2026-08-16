import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { getErrorMessage } from '@/common/utils/error';

declare global {
  interface BigInt {
    toJSON(): number;
  }
}

BigInt.prototype.toJSON = function () {
  return Number(this);
};

const SAFE_NETWORK_CODES = new Set([
  'UNKNOWNREPLY',
  'SOCKTMOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'EHOSTUNREACH',
]);

function getNetworkCode(error: unknown): string | number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const record = error as { errno?: unknown; code?: unknown };
  if (typeof record.errno === 'number' || typeof record.errno === 'string') return record.errno;
  if (typeof record.code === 'string' || typeof record.code === 'number') return record.code;
  return undefined;
}

function isBenignNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error, '');
  const code = getNetworkCode(error);
  if (code === 'UNKNOWNREPLY' && message.includes('!empty')) return true;
  if (code === -4077) return true;
  if (typeof code === 'string' && SAFE_NETWORK_CODES.has(code)) return true;
  return (
    message.includes('Timed out') ||
    message.includes('socket') ||
    message.includes('RouterOS') ||
    message.includes('Connection')
  );
}

const logger = new Logger('GlobalErrorHandler');
process.on('uncaughtException', (error: Error) => {
  if (isBenignNetworkError(error)) {
    logger.warn(`MikroTik connection error (suppressed crash): ${error.message} (errno: ${getNetworkCode(error)})`);
    return;
  }
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  if (isBenignNetworkError(reason)) {
    logger.warn(`MikroTik connection error in promise (suppressed): ${getErrorMessage(reason)} (errno: ${getNetworkCode(reason)})`);
    return;
  }
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Global prefix
  app.setGlobalPrefix('api');

  // Serve static video files from public/videos
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/videos/',
  });
  logger.log('📹 Static video files served from /videos endpoint');

  // Add request logging middleware for debugging routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.url.includes('generate-settings')) {
      logger.debug(`📥 ${req.method} ${req.url}`);
    }
    next();
  });

  // Enable CORS with dynamic origin
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) {
        return callback(null, true);
      }

      // List of allowed origins
      const allowedOrigins = [
        configService.get('FRONTEND_URL') || 'http://localhost:5173',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:8080',
        'http://10.10.10.2:5173', // Laptop IP
        'http://10.10.10.2:5174',
        'http://127.0.0.1:5173',
      ];

      // Check if origin matches any allowed pattern (exact match, bukan startsWith)
      const isAllowed = allowedOrigins.some(allowed => origin === allowed) ||
        // Allow any origin from 192.168.10.x network (hotspot clients)
        /^http:\/\/192\.168\.10\.\d{1,3}(:\d+)?$/.test(origin) ||
        // Allow any origin from 10.10.10.x network (management network)
        /^http:\/\/10\.10\.10\.\d{1,3}(:\d+)?$/.test(origin);

      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn(`⚠️ CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    maxAge: 3600,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.get('PORT') || 3001;
  await app.listen(port);
  
  console.log(`🚀 Backend server running on: http://localhost:${port}/api`);
  console.log(`📝 Environment: ${configService.get('NODE_ENV')}`);
  console.log(`🗄️  Database: MySQL (${configService.get('DATABASE_URL')?.split('@')[1]?.split('/')[0]})`);
}

bootstrap();
