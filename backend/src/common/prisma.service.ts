import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

type DeletableModel = { deleteMany: () => Promise<unknown> };

function hasDeleteMany(value: unknown): value is DeletableModel {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'deleteMany' in value &&
      typeof (value as DeletableModel).deleteMany === 'function',
  );
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');
    } catch (error) {
      this.logger.error('❌ Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  // Utility method for clean database queries
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production!');
    }

    const models = Reflect.ownKeys(this).filter((key) => {
      const keyStr = String(key);
      return keyStr[0] !== '_' && keyStr[0] !== '$';
    });

    return Promise.all(
      models.map((modelKey) => {
        const model = this[modelKey as keyof this];
        if (hasDeleteMany(model)) {
          return model.deleteMany();
        }
        return Promise.resolve();
      }),
    );
  }
}
