import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/common/prisma.service';
import { requireSecret } from '@/common/config/env';
import type { StringValue } from 'ms';
import { LoginDto } from './dto/login.dto';
import { Admin, AdminRole } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find admin by email
    const admin = await this.prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if admin is active
    if (!admin.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(admin);

    // Log login
    await this.prisma.systemLog.create({
      data: {
        adminId: admin.id,
        type: 'AUTH',
        action: 'LOGIN',
        description: `Admin ${admin.email} logged in`,
        status: 'SUCCESS',
      },
    });

    this.logger.log(`Admin ${admin.email} logged in successfully`);

    return {
      admin: this.sanitizeAdmin(admin),
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
      });

      if (!admin || !admin.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateTokens(admin);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateUser(userId: string): Promise<Admin> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: userId },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return admin;
  }

  async getProfile(userId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: userId },
    });

    if (!admin) {
      throw new UnauthorizedException('User not found');
    }

    return this.sanitizeAdmin(admin);
  }

  private async generateTokens(admin: Admin) {
    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: requireSecret(this.configService, 'JWT_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') || '7d') as StringValue,
      }),
      this.jwtService.signAsync(payload, {
        secret: requireSecret(this.configService, 'JWT_REFRESH_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d') as StringValue,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private sanitizeAdmin(admin: Admin) {
    const { password, ...sanitized } = admin;
    return sanitized;
  }

  // Helper method to hash passwords
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }
}
