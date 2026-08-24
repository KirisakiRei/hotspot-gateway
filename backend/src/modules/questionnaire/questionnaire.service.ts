import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { normalizeMac } from '@/common/utils/mac';
import {
  CreateQuestionnaireFieldDto,
  UpdateQuestionnaireFieldDto,
  SubmitQuestionnaireDto,
} from './dto/questionnaire.dto';

@Injectable()
export class QuestionnaireService {
  private readonly logger = new Logger(QuestionnaireService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // ADMIN — CRUD FIELD
  // ==========================================

  async getFields(includeInactive = false) {
    return this.prisma.questionnaireField.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getField(id: string) {
    const field = await this.prisma.questionnaireField.findUnique({ where: { id } });
    if (!field) throw new NotFoundException(`Field ${id} tidak ditemukan`);
    return field;
  }

  async createField(dto: CreateQuestionnaireFieldDto) {
    // Validasi key unik
    const existing = await this.prisma.questionnaireField.findUnique({
      where: { key: dto.key },
    });
    if (existing) throw new ConflictException(`Key "${dto.key}" sudah digunakan`);

    // Validasi options wajib ada jika tipe SELECT
    if (dto.type === 'SELECT' && (!dto.options || dto.options.length === 0)) {
      throw new BadRequestException('Field SELECT memerlukan opsi (options)');
    }

    // Jika order tidak ditentukan, ambil urutan terbesar + 1
    let order = dto.order;
    if (order === undefined || order === null) {
      const maxField = await this.prisma.questionnaireField.findFirst({
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      order = (maxField?.order ?? 0) + 1;
    }

    return this.prisma.questionnaireField.create({
      data: {
        key: dto.key,
        label: dto.label,
        type: dto.type,
        options: dto.options ? dto.options : undefined,
        placeholder: dto.placeholder,
        required: dto.required ?? false,
        order,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async reorderFields(orderedIds: string[]) {
    // Jalankan updates secara batch transaction
    const updates = orderedIds.map((id, index) =>
      this.prisma.questionnaireField.update({
        where: { id },
        data: { order: index + 1 },
      }),
    );
    await this.prisma.$transaction(updates);
    return this.getFields(true);
  }

  async updateField(id: string, dto: UpdateQuestionnaireFieldDto) {
    await this.getField(id); // pastikan exist

    if (dto.type === 'SELECT' && dto.options !== undefined && dto.options.length === 0) {
      throw new BadRequestException('Field SELECT memerlukan minimal satu opsi');
    }

    return this.prisma.questionnaireField.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.options !== undefined && { options: dto.options }),
        ...(dto.placeholder !== undefined && { placeholder: dto.placeholder }),
        ...(dto.required !== undefined && { required: dto.required }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteField(id: string) {
    await this.getField(id); // pastikan exist
    await this.prisma.questionnaireField.delete({ where: { id } });
    return { deleted: true };
  }

  // ==========================================
  // PORTAL — SUBMIT JAWABAN
  // ==========================================

  async submitAnswers(dto: SubmitQuestionnaireDto) {
    const mac = normalizeMac(dto.mac);
    if (!mac) throw new BadRequestException('MAC address tidak valid');

    // Ambil semua field aktif untuk validasi
    const activeFields = await this.prisma.questionnaireField.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    // Validasi field required
    const answerMap = new Map(dto.answers.map((a) => [a.key, a.value]));
    const missing = activeFields
      .filter((f) => f.required && !answerMap.get(f.key)?.trim())
      .map((f) => f.label);

    if (missing.length > 0) {
      throw new BadRequestException(`Field wajib belum diisi: ${missing.join(', ')}`);
    }

    const submission = await this.prisma.questionnaireSubmission.create({
      data: {
        macAddress: mac,
        voucherId: dto.voucherId ?? null,
        answers: dto.answers,
      },
    });

    this.logger.log(`Kuesioner disubmit: MAC=${mac} id=${submission.id}`);
    return submission;
  }

  // ==========================================
  // ADMIN — LIHAT JAWABAN
  // ==========================================

  async getSubmissions(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      this.prisma.questionnaireSubmission.count(),
      this.prisma.questionnaireSubmission.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  async getSubmissionByMac(mac: string) {
    const normalized = normalizeMac(mac);
    if (!normalized) throw new BadRequestException('MAC address tidak valid');
    return this.prisma.questionnaireSubmission.findMany({
      where: { macAddress: normalized },
      orderBy: { createdAt: 'desc' },
    });
  }
}
