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
import { RouterService } from './router.service';
import { CreateRouterDto, UpdateRouterDto } from './dto/router.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ApiResponseDto } from '@/common/dto/api-response.dto';
import { AdminRole } from '@prisma/client';

@Controller('routers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RouterController {
  constructor(private readonly routerService: RouterService) {}

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR)
  async getAllRouters() {
    const routers = await this.routerService.getAllRouters();
    return ApiResponseDto.success('Daftar router', routers);
  }

  @Get('active-sessions')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR)
  async getActiveSessions(@Query('routerId') routerId?: string) {
    const sessions = await this.routerService.getActiveSessions(routerId);
    return ApiResponseDto.success('Daftar sesi aktif router', sessions);
  }

  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR)
  async getRouterById(@Param('id') id: string) {
    const router = await this.routerService.getRouterById(id);
    return ApiResponseDto.success('Detail router', router);
  }

  @Get(':id/script')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async getRouterScript(@Param('id') id: string) {
    const result = await this.routerService.generateSetupScript(id);
    return ApiResponseDto.success('Script setup router', result);
  }

  @Post()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createRouter(@Body() dto: CreateRouterDto) {
    const router = await this.routerService.createRouter(dto);
    return ApiResponseDto.success('Router berhasil ditambahkan', router);
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async updateRouter(@Param('id') id: string, @Body() dto: UpdateRouterDto) {
    const router = await this.routerService.updateRouter(id, dto);
    return ApiResponseDto.success('Router berhasil diupdate', router);
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async deleteRouter(@Param('id') id: string) {
    const result = await this.routerService.deleteRouter(id);
    return ApiResponseDto.success('Router berhasil dihapus', result);
  }
}
