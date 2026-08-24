import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QuestionnaireService } from './questionnaire.service';
import {
  CreateQuestionnaireFieldDto,
  UpdateQuestionnaireFieldDto,
  ReorderFieldsDto,
  SubmitQuestionnaireDto,
} from './dto/questionnaire.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { ApiResponseDto } from '@/common/dto/api-response.dto';
import { AdminRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

@Controller('questionnaire')
export class QuestionnaireController {
  constructor(private readonly questionnaireService: QuestionnaireService) {}

  // ==========================================
  // PUBLIC — Portal
  // ==========================================

  /** Ambil semua field aktif untuk ditampilkan di portal */
  @Get('fields/active')
  @Public()
  async getActiveFields() {
    const fields = await this.questionnaireService.getFields(false);
    return ApiResponseDto.success('Field kuesioner', fields);
  }

  /** Submit jawaban kuesioner dari portal */
  @Post('submit')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async submit(@Body() dto: SubmitQuestionnaireDto) {
    const result = await this.questionnaireService.submitAnswers(dto);
    return ApiResponseDto.success('Jawaban disimpan', result);
  }

  // ==========================================
  // ADMIN — Field Management
  // ==========================================

  @Get('admin/fields')
  @UseGuards(JwtAuthGuard)
  async getAllFields(@Query('includeInactive') includeInactive?: string) {
    const fields = await this.questionnaireService.getFields(includeInactive === 'true');
    return ApiResponseDto.success('Daftar field kuesioner', fields);
  }

  @Get('admin/fields/:id')
  @UseGuards(JwtAuthGuard)
  async getField(@Param('id') id: string) {
    const field = await this.questionnaireService.getField(id);
    return ApiResponseDto.success('Field kuesioner', field);
  }

  @Post('admin/fields')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createField(@Body() dto: CreateQuestionnaireFieldDto) {
    const field = await this.questionnaireService.createField(dto);
    return ApiResponseDto.success('Field berhasil dibuat', field);
  }

  @Patch('admin/fields/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async updateField(@Param('id') id: string, @Body() dto: UpdateQuestionnaireFieldDto) {
    const field = await this.questionnaireService.updateField(id, dto);
    return ApiResponseDto.success('Field berhasil diupdate', field);
  }

  @Post('admin/fields/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async reorderFields(@Body() dto: ReorderFieldsDto) {
    const fields = await this.questionnaireService.reorderFields(dto.orderedIds);
    return ApiResponseDto.success('Urutan field berhasil diperbarui', fields);
  }

  @Delete('admin/fields/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async deleteField(@Param('id') id: string) {
    const result = await this.questionnaireService.deleteField(id);
    return ApiResponseDto.success('Field berhasil dihapus', result);
  }

  // ==========================================
  // ADMIN — Submissions
  // ==========================================

  @Get('admin/submissions')
  @UseGuards(JwtAuthGuard)
  async getSubmissions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.questionnaireService.getSubmissions(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return ApiResponseDto.success('Daftar jawaban kuesioner', result);
  }

  @Get('admin/submissions/mac/:mac')
  @UseGuards(JwtAuthGuard)
  async getSubmissionByMac(@Param('mac') mac: string) {
    const result = await this.questionnaireService.getSubmissionByMac(mac);
    return ApiResponseDto.success('Jawaban kuesioner per perangkat', result);
  }
}
