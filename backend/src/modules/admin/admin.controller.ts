import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto, UpdateAdminDto } from './dto/admin.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ApiResponseDto } from '@/common/dto/api-response.dto';
import type { RolePermissions } from '@/common/types/permissions';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ==========================================
  // ADMIN USERS CRUD
  // ==========================================

  @Get('users')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async findAllAdmins() {
    const admins = await this.adminService.findAll();
    return ApiResponseDto.success('Admins retrieved', admins);
  }

  @Get('users/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async findAdmin(@Param('id') id: string) {
    const admin = await this.adminService.findById(id);
    return ApiResponseDto.success('Admin retrieved', admin);
  }

  @Post('users')
  @Roles('SUPER_ADMIN')
  async createAdmin(@Body() createDto: CreateAdminDto) {
    const admin = await this.adminService.create(createDto);
    return ApiResponseDto.success('Admin created', admin);
  }

  @Put('users/:id')
  @Roles('SUPER_ADMIN')
  async updateAdmin(@Param('id') id: string, @Body() updateDto: UpdateAdminDto) {
    const admin = await this.adminService.update(id, updateDto);
    return ApiResponseDto.success('Admin updated', admin);
  }

  @Delete('users/:id')
  @Roles('SUPER_ADMIN')
  async deleteAdmin(@Param('id') id: string) {
    await this.adminService.delete(id);
    return ApiResponseDto.success('Admin deleted');
  }

  // ==========================================
  // ROLE PERMISSIONS
  // ==========================================

  @Get('roles')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getRolePermissions() {
    const permissions = await this.adminService.getRolePermissions();
    return ApiResponseDto.success('Role permissions retrieved', permissions);
  }

  @Put('roles/:role')
  @Roles('SUPER_ADMIN')
  async updateRolePermissions(
    @Param('role') role: string,
    @Body() permissions: RolePermissions,
  ) {
    const updated = await this.adminService.updateRolePermissions(role, permissions);
    return ApiResponseDto.success('Role permissions updated', updated);
  }

  @Post('roles')
  @Roles('SUPER_ADMIN')
  async createRole(@Body() data: { id: string; name: string; permissions: RolePermissions }) {
    const role = await this.adminService.createRole(data);
    return ApiResponseDto.success('Role created', role);
  }

  @Delete('roles/:role')
  @Roles('SUPER_ADMIN')
  async deleteRole(@Param('role') role: string) {
    await this.adminService.deleteRole(role);
    return ApiResponseDto.success('Role deleted');
  }
}
