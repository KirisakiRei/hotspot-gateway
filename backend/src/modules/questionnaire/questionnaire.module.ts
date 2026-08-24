import { Module } from '@nestjs/common';
import { QuestionnaireService } from './questionnaire.service';
import { QuestionnaireController } from './questionnaire.controller';
import { PrismaService } from '@/common/prisma.service';

@Module({
  controllers: [QuestionnaireController],
  providers: [QuestionnaireService, PrismaService],
  exports: [QuestionnaireService],
})
export class QuestionnaireModule {}
