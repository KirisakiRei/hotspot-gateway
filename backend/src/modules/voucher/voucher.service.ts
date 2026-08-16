import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import {
  CreateVoucherProfileDto,
  UpdateVoucherProfileDto,
} from './dto/voucher-profile.dto';
import { GenerateVoucherDto, RedeemVoucherDto } from './dto/voucher.dto';
import { Prisma, Voucher, VoucherProfile, VoucherStatus } from '@prisma/client';
import { WhatsappService } from '@/modules/whatsapp/whatsapp.service';
import { MikrotikService } from '@/modules/mikrotik/mikrotik.service';
import { normalizeMac } from '@/common/utils/mac';
import { getErrorMessage, getPrismaUniqueTarget, isPrismaUniqueViolation } from '@/common/utils/error';
import * as crypto from 'crypto';

@Injectable()
export class VoucherService {
  private readonly logger = new Logger(VoucherService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => WhatsappService))
    private whatsappService: WhatsappService,
    private mikrotikService: MikrotikService,
  ) {}

  // ==========================================
  // VOUCHER PROFILES
  // ==========================================

  async createProfile(createDto: CreateVoucherProfileDto) {
    this.logger.log(`Creating voucher profile: ${createDto.name}`);
    
    // STEP 1: Validate profile name (no spaces, dashes OK)
    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nameRegex.test(createDto.name)) {
      this.logger.warn(`Invalid profile name: "${createDto.name}". Must only contain alphanumeric characters, underscores, and hyphens.`);
      throw new BadRequestException(
        `Profile name can only contain letters, numbers, underscores, and hyphens (no spaces)`
      );
    }

    // STEP 2: Check if profile already exists in database
    const existingProfile = await this.prisma.voucherProfile.findUnique({
      where: { name: createDto.name },
    });

    if (existingProfile) {
      this.logger.warn(`Profile already exists in database: "${createDto.name}"`);
      throw new BadRequestException(`Profile with name "${createDto.name}" already exists`);
    }

    // STEP 3: Check Mikrotik connection (Graceful fallback if router offline)
    try {
      await this.mikrotikService.checkConnection();
    } catch {
      // Ignore initial ping failure
    }

    // STEP 4: Try creating in Mikrotik (synchronous if online, queued if offline)
    if (this.mikrotikService.getConnectionStatus()) {
      this.logger.log(`Provisioning profile "${createDto.name}" in Mikrotik router`);
      try {
        const sessionTimeout = createDto.duration ? `${createDto.duration}m` : undefined;
        let rateLimit: string | undefined;
        if (createDto.uploadSpeed && createDto.downloadSpeed) {
          rateLimit = `${createDto.uploadSpeed}k/${createDto.downloadSpeed}k`;
        }

        const mikrotikData = {
          name: createDto.name,
          sharedUsers: createDto.sharedUsers || 1,
          rateLimit,
          sessionTimeout,
        };
        
        await this.mikrotikService.createHotspotProfile(mikrotikData);
        this.logger.log(`Profile created in Mikrotik: ${createDto.name}`);
      } catch (mikrotikError: unknown) {
        const msg = mikrotikError instanceof Error ? mikrotikError.message : String(mikrotikError);
        this.logger.warn(`Mikrotik profile synchronization warning: ${msg}`);
      }
    } else {
      this.logger.warn(`Mikrotik is offline. Profile "${createDto.name}" created in database only.`);
    }

    // STEP 5: Create in database SECOND
    let profile;
    try {
      profile = await this.prisma.voucherProfile.create({
        data: createDto,
      });
      
      // STEP 6: Refresh profile cache so the new profile is immediately available for edit
      await this.mikrotikService.refreshProfileCache();
      
      this.logger.log(`Profile successfully created: ${profile.name}`);
      return profile;
    } catch (dbError: unknown) {
      this.logger.error(`Database profile creation failed: ${getErrorMessage(dbError)}`);
      try {
        await this.mikrotikService.deleteHotspotProfile(createDto.name);
        this.logger.log(`Cleaned up orphaned profile from Mikrotik: ${createDto.name}`);
      } catch (cleanupError: unknown) {
        this.logger.error(`Cleanup failed: ${getErrorMessage(cleanupError)}`);
      }
      throw new InternalServerErrorException(
        `Failed to create profile in database: ${getErrorMessage(dbError)}`
      );
    }
  }

  // Async sync profile to Mikrotik
  private async syncProfileToMikrotik(profile: VoucherProfile): Promise<void> {
    try {
      // Ensure connection
      await this.mikrotikService.checkConnection();
      
      if (!this.mikrotikService.getConnectionStatus()) {
        this.logger.warn(`Mikrotik not connected. Profile "${profile.name}" not synchronized.`);
        return;
      }

      // Convert duration (minutes) to Mikrotik session-timeout format
      const sessionTimeout = profile.duration ? `${profile.duration}m` : undefined;
      
      // Convert speeds to rate-limit format (upload/download)
      let rateLimit: string | undefined;
      if (profile.uploadSpeed && profile.downloadSpeed) {
        rateLimit = `${profile.uploadSpeed}k/${profile.downloadSpeed}k`;
      }

      await this.mikrotikService.createHotspotProfile({
        name: profile.name,
        sharedUsers: profile.sharedUsers,
        sessionTimeout,
        rateLimit,
      });
      
      this.logger.log(`Profile "${profile.name}" synchronized to Mikrotik router`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to synchronize profile "${profile.name}" to Mikrotik: ${message}`);
      // Don't throw - profile is saved in database, can retry sync later
    }
  }

  /**
   * Sync all profiles from database to Mikrotik
   * Use this to ensure all profiles exist in Mikrotik
   */
  async syncAllProfilesToMikrotik(): Promise<{ synced: number; failed: number; errors: string[] }> {
    const profiles = await this.prisma.voucherProfile.findMany({
      where: { isActive: true },
    });

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    this.logger.log(`Synchronizing ${profiles.length} voucher profiles to Mikrotik router`);

    for (const profile of profiles) {
      try {
        // Check if profile already exists in Mikrotik
        const exists = await this.mikrotikService.checkProfileExists(profile.name);
        
        if (!exists) {
          await this.syncProfileToMikrotik(profile);
          synced++;
        } else {
          this.logger.log(`Profile "${profile.name}" already exists in Mikrotik router`);
          synced++;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        failed++;
        errors.push(`${profile.name}: ${message}`);
        this.logger.error(`Failed to synchronize profile "${profile.name}": ${message}`);
      }
    }

    this.logger.log(`Profile synchronization completed: ${synced} synchronized, ${failed} failed`);
    return { synced, failed, errors };
  }

  async findAllProfiles(activeOnly = false) {
    return this.prisma.voucherProfile.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: {
        _count: {
          select: { vouchers: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findProfile(id: string) {
    const profile = await this.prisma.voucherProfile.findUnique({
      where: { id },
      include: {
        _count: {
          select: { vouchers: true },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(`Voucher profile with ID ${id} not found`);
    }

    return profile;
  }

  async updateProfile(id: string, updateDto: UpdateVoucherProfileDto) {
    this.logger.log(`Updating profile ID: ${id}`);
    
    // Get existing profile (need old name for Mikrotik update)
    const existing = await this.findProfile(id);

    // STEP 2: Check Mikrotik connection (Graceful fallback if offline)
    try {
      await this.mikrotikService.checkConnection();
    } catch {
      // Ignore
    }

    // STEP 3: Update in Mikrotik if online
    if (this.mikrotikService.getConnectionStatus()) {
      try {
        const sessionTimeout = updateDto.duration ? `${updateDto.duration}m` : undefined;
        let rateLimit: string | undefined;
        if (updateDto.uploadSpeed && updateDto.downloadSpeed) {
          rateLimit = `${updateDto.uploadSpeed}k/${updateDto.downloadSpeed}k`;
        }

        await this.mikrotikService.updateHotspotProfile(existing.name, {
          sharedUsers: updateDto.sharedUsers,
          sessionTimeout,
          rateLimit,
        });
        this.logger.log(`Profile "${existing.name}" updated in Mikrotik`);
        
        if (updateDto.name && existing.name !== updateDto.name) {
          this.logger.warn(`Profile name change requested but not supported in Mikrotik. Keeping name as "${existing.name}"`);
          delete updateDto.name;
        }
      } catch (mikrotikError: unknown) {
        const msg = mikrotikError instanceof Error ? mikrotikError.message : String(mikrotikError);
        this.logger.warn(`Mikrotik profile update warning: ${msg}`);
      }
    } else {
      this.logger.warn(`Mikrotik is offline. Profile "${existing.name}" updated in database only.`);
    }

    // STEP 4: Update in database SECOND
    const updated = await this.prisma.voucherProfile.update({
      where: { id },
      data: updateDto,
    });

    // STEP 5: Refresh profile cache to ensure consistency
    await this.mikrotikService.refreshProfileCache();

    this.logger.log(`Profile updated successfully: ${updated.name}`);
    return updated;
  }

  async deleteProfile(id: string, forceDelete = false) {
    this.logger.log(`Deleting profile ID: ${id} (forceDelete: ${forceDelete})`);
    
    // STEP 1: Find profile - handle already deleted (idempotency)
    const profile = await this.prisma.voucherProfile.findUnique({
      where: { id },
    });
    
    if (!profile) {
      this.logger.warn(`Profile ID not found or already deleted: ${id}`);
      return { message: `Profile already deleted or not found` };
    }

    // Check if profile has vouchers
    const voucherCount = await this.prisma.voucher.count({
      where: { profileId: id },
    });

    if (voucherCount > 0 && !forceDelete) {
      this.logger.warn(`Cannot delete profile "${profile.name}". ${voucherCount} vouchers are actively associated.`);
      throw new BadRequestException(
        `Cannot delete profile "${profile.name}": ${voucherCount} vouchers are using this profile. Use force delete to remove vouchers as well.`,
      );
    }

    // STEP 3: Check Mikrotik connection
    await this.mikrotikService.checkConnection();
    if (!this.mikrotikService.getConnectionStatus()) {
      this.logger.error(`Mikrotik is offline. Aborting safe profile deletion.`);
      throw new InternalServerErrorException('Mikrotik connection required for safe profile deletion');
    }

    // STEP 4: If force delete, delete vouchers from Mikrotik first (BATCH)
    if (voucherCount > 0 && forceDelete) {
      this.logger.log(`Force deleting ${voucherCount} associated vouchers from router`);
      
      const vouchers = await this.prisma.voucher.findMany({
        where: { profileId: id },
        select: { code: true },
      });

      // Use batch delete for better performance
      const usernames = vouchers.map(v => v.code);
      const result = await this.mikrotikService.removeHotspotUsersBatch(usernames);
      this.logger.log(`Batch deletion completed: ${result.success} succeeded, ${result.failed} failed`);
    }

    // STEP 5: Delete profile from Mikrotik FIRST (synchronous)
    try {
      await this.mikrotikService.deleteHotspotProfile(profile.name);
      this.logger.log(`Profile "${profile.name}" deleted from Mikrotik router`);
    } catch (mikrotikError: unknown) {
      const msg = mikrotikError instanceof Error ? mikrotikError.message : String(mikrotikError);
      // If profile doesn't exist in Mikrotik, continue
      if (msg.includes('not found') || msg.includes('no such')) {
        this.logger.warn(`Profile "${profile.name}" was not found in Mikrotik router`);
      } else {
        this.logger.error(`Failed to delete profile from Mikrotik: ${msg}`);
        throw new InternalServerErrorException(
          `Failed to delete profile from Mikrotik: ${msg}`
        );
      }
    }

    // STEP 6: Delete vouchers from database (if force) - use transaction
    if (voucherCount > 0 && forceDelete) {
      const deleteResult = await this.prisma.voucher.deleteMany({
        where: { profileId: id },
      });
      this.logger.log(`Deleted ${deleteResult.count} vouchers from database`);
    }

    // STEP 7: Delete profile from database LAST - handle already deleted
    try {
      await this.prisma.voucherProfile.delete({
        where: { id },
      });
      this.logger.log(`Profile "${profile.name}" deleted successfully from database`);
      return { message: `Profile "${profile.name}" deleted successfully` };
    } catch (prismaError: unknown) {
      const message = getErrorMessage(prismaError);
      const code = prismaError && typeof prismaError === 'object' && 'code' in prismaError
        ? String((prismaError as { code?: string }).code)
        : '';
      if (code === 'P2025' || message.includes('not found')) {
        this.logger.warn(`Profile "${profile.name}" was already deleted from database`);
        return { message: `Profile "${profile.name}" deleted successfully` };
      }
      throw prismaError;
    }
  }

  // ==========================================
  // VOUCHERS
  // ==========================================

  async generateVouchers(generateDto: GenerateVoucherDto) {
    const profile = await this.findProfile(generateDto.profileId);

    const batchId = this.generateBatchId();
    
    // Voucher code total max 6 karakter
    // Prefix max 2 karakter, sisanya adalah generated code
    const prefix = generateDto.prefix?.toUpperCase().slice(0, 2) || '';
    const totalLength = 6; // Fixed 6 karakter total
    const generatedLength = totalLength - prefix.length; // 4-6 karakter generate
    const format = generateDto.format || 'mixed_upper';

    // Batch insert dalam satu transaction + retry kode duplikat
    const vouchers = await this.prisma.$transaction(async (tx) => {
      const created: Voucher[] = [];
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + profile.validityDays);

      for (let i = 0; i < generateDto.quantity; i++) {
        let voucher: Voucher | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          const code = this.generateVoucherCode(prefix, generatedLength, format);
          try {
            voucher = await tx.voucher.create({
              data: {
                code,
                profileId: profile.id,
                batchId,
                expiresAt,
                status: VoucherStatus.UNUSED,
              },
            });
            break;
          } catch (error: unknown) {
            if (isPrismaUniqueViolation(error) && attempt < 4) continue;
            throw error;
          }
        }
        if (voucher) created.push(voucher);
      }

      // Create batch record
      await tx.voucherBatch.create({
        data: {
          name: generateDto.batchName || `Batch ${batchId}`,
          profileId: profile.id,
          quantity: generateDto.quantity,
          prefix: generateDto.prefix,
          createdBy: generateDto.createdBy || 'system',
        },
      });

      return created;
    });

    this.logger.log(
      `Generated ${vouchers.length} vouchers for profile ${profile.name}`,
    );

    return {
      batchId,
      vouchers,
      profile,
    };
  }

  async findAllVouchers(filters?: {
    status?: VoucherStatus;
    profileId?: string;
    batchId?: string;
    search?: string;
  }) {
    const where: Prisma.VoucherWhereInput = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.profileId) where.profileId = filters.profileId;
    if (filters?.batchId) where.batchId = filters.batchId;
    if (filters?.search) where.code = { contains: filters.search };

    return this.prisma.voucher.findMany({
      where,
      include: {
        profile: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit for performance
    });
  }

  async findVoucher(id: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id },
      include: {
        profile: true,
        users: true,
      },
    });

    if (!voucher) {
      throw new NotFoundException(`Voucher with ID ${id} not found`);
    }

    return voucher;
  }

  async findVoucherByCode(code: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        profile: true,
      },
    });

    if (!voucher) {
      throw new NotFoundException(`Voucher not found`);
    }

    return voucher;
  }

  // ==========================================
  // PORTAL FLOW - REQUEST & REDEEM
  // ==========================================

  // Generate and send voucher to user (called from portal after ad)
  async requestVoucher(phone: string, mac?: string, ip?: string) {
    // Normalize phone number (remove non-digits)
    const normalizedPhone = phone.replace(/[^\d]/g, '');
    
    // Generate MAC if not provided (for testing/demo purposes)
    const macAddress = mac || this.generateRandomMac();
    const ipAddress = ip || '0.0.0.0';

    // Get voucher generate settings from database
    const generateSettingsRecord = await this.prisma.setting.findUnique({
      where: { key: 'voucher_generate_settings' },
    });

    let settings = {
      profileId: '',
      prefix: '',
      length: 6, // Default 6 digit total
      format: 'mixed_upper' as 'number' | 'text' | 'mixed' | 'mixed_upper',
    };

    if (generateSettingsRecord?.value) {
      try {
        const parsed = JSON.parse(generateSettingsRecord.value);
        settings = { ...settings, ...parsed };
        // Ensure length is max 6
        if (settings.length > 6) settings.length = 6;
      } catch (e) {
        this.logger.warn('Failed to parse voucher generate settings');
      }
    }

    // Get profile from settings or first active profile
    let profile = null;
    if (settings.profileId) {
      profile = await this.prisma.voucherProfile.findUnique({
        where: { id: settings.profileId, isActive: true },
      });
    }

    // Fallback to first active profile if setting profile not found
    if (!profile) {
      profile = await this.prisma.voucherProfile.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!profile) {
      throw new NotFoundException('No active voucher profile found');
    }

    // Generate single voucher using saved settings
    // Prefix max 2 karakter, total code max 6 karakter
    const prefix = (settings.prefix || '').toUpperCase().slice(0, 2);
    const totalLength = 6;
    const generatedLength = totalLength - prefix.length;
    const code = this.generateVoucherCode(prefix, generatedLength, settings.format);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + profile.validityDays);

    this.logger.log(`Generating voucher with format: ${settings.format}, prefix: "${prefix}", generated length: ${generatedLength}, total: 6 digits`);

    const voucher = await this.prisma.voucher.create({
      data: {
        code,
        profileId: profile.id,
        expiresAt,
        status: VoucherStatus.UNUSED,
      },
    });

    // Get WhatsApp contact name
    let contactName: string | null = null;
    try {
      const contactInfo = await this.whatsappService.getContactInfo(normalizedPhone);
      contactName = contactInfo.name || contactInfo.pushName;
      this.logger.log(`Got contact name from WhatsApp: ${contactName || 'Not found'}`);
    } catch (error) {
      this.logger.warn(`Failed to get contact name: ${error.message}`);
    }

    // Check if user already exists by phone
    let user = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    // Also check by MAC address if user not found by phone
    if (!user && macAddress) {
      user = await this.prisma.user.findUnique({
        where: { macAddress },
      });
    }

    if (!user) {
      // Create new user with contact name
      user = await this.prisma.user.create({
        data: {
          phone: normalizedPhone,
          name: contactName,
          macAddress,
          ipAddress,
          status: 'OFFLINE',
          loginAt: new Date(),
          voucher: { connect: { id: voucher.id } },
        },
      });
    } else {
      // Update existing user with latest info
      const updateData: Prisma.UserUpdateInput = {
        loginAt: new Date(),
      };
      
      // Handle MAC address update with conflict resolution
      if (macAddress && macAddress !== user.macAddress) {
        try {
          // Check if the new MAC is already used by another user
          const conflictUser = await this.prisma.user.findUnique({
            where: { macAddress },
          });

          if (conflictUser && conflictUser.id !== user.id) {
            // MAC address conflict! Another user is using this MAC
            this.logger.warn(
              `MAC conflict detected: ${macAddress} is associated with ${conflictUser.phone}, transferring to ${normalizedPhone}`
            );

            // Strategy: Force override - kick the old user from this device
            // 1. Disconnect old user's active session in Mikrotik
            try {
              await this.mikrotikService.disconnectUserByMac(macAddress);
              this.logger.log(`Disconnected previous session from Mikrotik for MAC ${macAddress}`);
            } catch (error: unknown) {
              const msg = error instanceof Error ? error.message : String(error);
              this.logger.warn(`Failed to disconnect previous session from Mikrotik: ${msg}`);
            }

            // 2. Clear the MAC from the conflicting user (set to null)
            await this.prisma.user.update({
              where: { id: conflictUser.id },
              data: { 
                macAddress: null,
                status: 'OFFLINE',
              },
            });
            this.logger.log(`Disassociated MAC ${macAddress} from user ${conflictUser.phone}`);
          }

          // Now safe to update current user's MAC
          updateData.macAddress = macAddress;
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to resolve MAC conflict: ${msg}`);
          this.logger.warn(`Skipping MAC update due to conflict resolution failure`);
        }
      }

      if (ipAddress && ipAddress !== user.ipAddress) {
        updateData.ipAddress = ipAddress;
      }
      // Update name if we have a new one and user doesn't have one
      if (contactName && !user.name) {
        updateData.name = contactName;
      }
      // Update phone if different (user found by MAC)
      if (normalizedPhone !== user.phone) {
        updateData.phone = normalizedPhone;
      }

      updateData.voucher = { connect: { id: voucher.id } };

      try {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      } catch (error) {
        // Handle any remaining unique constraint errors gracefully
        if (isPrismaUniqueViolation(error)) {
          this.logger.error(`Unique constraint violation: ${getPrismaUniqueTarget(error)}`);
          throw new BadRequestException(
            'Gagal memperbarui data pengguna. MAC address mungkin sedang digunakan. Silakan coba lagi.'
          );
        }
        throw error;
      }
    }

    // Send voucher via WhatsApp
    try {
      await this.whatsappService.sendVoucher(normalizedPhone, code, {
        name: profile.name,
        duration: profile.duration,
        quota: profile.quota ? Number(profile.quota) : undefined,
        validityDays: profile.validityDays,
      });
      this.logger.log(`Voucher ${code} sent to recipient ${normalizedPhone} via WhatsApp`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send voucher via WhatsApp: ${msg}`);
      // Don't throw - voucher is still generated, just not sent via WA
    }

    // Log the request
    await this.prisma.systemLog.create({
      data: {
        userId: user.id,
        type: 'VOUCHER',
        action: 'REQUEST',
        description: `User requested voucher: ${code}${contactName ? ` (${contactName})` : ''}`,
        ipAddress: ipAddress,
        macAddress: macAddress,
        status: 'SUCCESS',
      },
    });

    this.logger.log(`Voucher ${code} requested by ${normalizedPhone} (${contactName || 'Unknown'})`);

    return {
      voucher,
      profile,
      user,
    };
  }

  // Redeem voucher (called from portal when user inputs code)
  async redeemVoucher(redeemDto: RedeemVoucherDto) {
    const { code, mac, ip } = redeemDto;

    // Find voucher
    const voucher = await this.findVoucherByCode(code);

    // Validate voucher status
    if (voucher.status === VoucherStatus.USED) {
      throw new BadRequestException('Voucher has already been used');
    }

    if (voucher.status === VoucherStatus.EXPIRED) {
      throw new BadRequestException('Voucher has expired');
    }

    if (voucher.status === VoucherStatus.DISABLED) {
      throw new BadRequestException('Voucher is disabled');
    }

    // Check expiry date
    if (voucher.expiresAt && new Date() > voucher.expiresAt) {
      await this.prisma.voucher.update({
        where: { id: voucher.id },
        data: { status: VoucherStatus.EXPIRED },
      });
      throw new BadRequestException('Voucher has expired');
    }

    // Find user - try multiple methods
    let user = null;
    
    // 1. Try find by MAC address
    if (mac) {
      user = await this.prisma.user.findUnique({
        where: { macAddress: mac },
      });
    }
    
    // 2. If not found, try find by voucher's usedBy (phone) if it was already assigned
    if (!user && voucher.usedBy) {
      user = await this.prisma.user.findUnique({
        where: { phone: voucher.usedBy },
      });
    }
    
    // 3. If still not found, create a new user based on MAC
    if (!user) {
      // Create guest user for this MAC address
      user = await this.prisma.user.create({
        data: {
          phone: `guest-${Date.now()}`, // Temporary phone
          macAddress: mac || this.generateRandomMac(),
          ipAddress: ip || '0.0.0.0',
          name: 'Guest User',
          status: 'OFFLINE',
        },
      });
      this.logger.log(`Created new guest user for MAC: ${mac}`);
    }

    // Update voucher status — conditional update mencegah race condition
    // usedBy = MAC address (normalisasi), lifecycle seragam: UNUSED → USED
    const deviceMac = normalizeMac(mac || user.macAddress) || undefined;
    const claimed = await this.prisma.voucher.updateMany({
      where: {
        id: voucher.id,
        status: { notIn: [VoucherStatus.USED, VoucherStatus.EXPIRED, VoucherStatus.DISABLED] },
        OR: [{ usedBy: null }, { usedBy: deviceMac ?? null }],
      },
      data: {
        status: VoucherStatus.USED,
        usedBy: deviceMac,
        usedAt: new Date(),
        activatedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      throw new BadRequestException('Voucher sudah digunakan');
    }

    // Update user with voucher
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        voucherId: voucher.id,
        status: 'ONLINE',
        loginAt: new Date(),
      },
    });

    // Create session
    await this.prisma.session.create({
      data: {
        userId: user.id,
        ipAddress: ip || user.ipAddress || '0.0.0.0',
        macAddress: (mac || user.macAddress) || 'UNKNOWN',
        startedAt: new Date(),
      },
    });

    // ==========================================
    // MIKROTIK INTEGRATION - Add user to hotspot
    // ==========================================
    try {
      // Use the profile from the voucher (not default)
      await this.mikrotikService.addHotspotUser({
        username: voucher.code,
        password: voucher.code, // Using voucher code as both username/password
        profile: voucher.profile.name, // ← CRITICAL: Use voucher's profile!
        macAddress: (mac || user.macAddress) || undefined,
        comment: `Voucher: ${voucher.profile.name} | ${user.phone} | ${user.name || 'Unknown'}`,
      });
      
      this.logger.log(
        `✅ Added user ${voucher.code} to Mikrotik hotspot with profile: ${voucher.profile.name}`,
      );
    } catch (mikrotikError: unknown) {
      this.logger.warn(`Failed to add user to Mikrotik router: ${getErrorMessage(mikrotikError)}`);
    }

    // Log redemption
    await this.prisma.systemLog.create({
      data: {
        userId: user.id,
        type: 'VOUCHER',
        action: 'REDEEM',
        description: `User redeemed voucher: ${code}`,
        ipAddress: ip || user.ipAddress,
        macAddress: mac || user.macAddress || undefined,
        status: 'SUCCESS',
      },
    });

    this.logger.log(`Voucher ${code} redeemed by user ${user.id}`);

    return {
      voucher,
      profile: voucher.profile,
      user,
    };
  }

  // ==========================================
  // RESEND VOUCHER - Disable old voucher and generate new one
  // ==========================================
  
  async resendVoucher(phone: string, macAddress?: string, ipAddress?: string) {
    // Normalize phone number
    let normalizedPhone = phone.replace(/[^0-9]/g, '');
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '62' + normalizedPhone.substring(1);
    } else if (!normalizedPhone.startsWith('62')) {
      normalizedPhone = '62' + normalizedPhone;
    }

    this.logger.log(`Resending voucher for phone: ${normalizedPhone}`);

    // Find user by phone
    const user = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!user) {
      throw new NotFoundException('User not found. Please request a new voucher first.');
    }

    // Find all UNUSED vouchers for this user and disable them
    const unusedVouchers = await this.prisma.voucher.findMany({
      where: {
        usedBy: normalizedPhone,
        status: VoucherStatus.UNUSED,
      },
    });

    if (unusedVouchers.length > 0) {
      // Disable all old unused vouchers to prevent fraud
      await this.prisma.voucher.updateMany({
        where: {
          usedBy: normalizedPhone,
          status: VoucherStatus.UNUSED,
        },
        data: {
          status: VoucherStatus.DISABLED,
        },
      });

      this.logger.log(`Disabled ${unusedVouchers.length} old voucher(s) for user ${normalizedPhone}`);
    }

    // Also check vouchers linked to the user's voucher ID
    if (user.voucherId) {
      const currentVoucher = await this.prisma.voucher.findUnique({
        where: { id: user.voucherId },
      });
      
      if (currentVoucher && currentVoucher.status === VoucherStatus.UNUSED) {
        await this.prisma.voucher.update({
          where: { id: user.voucherId },
          data: { status: VoucherStatus.DISABLED },
        });
        this.logger.log(`Disabled user's current voucher: ${currentVoucher.code}`);
      }
    }

    // Generate new voucher using the same requestVoucher logic
    const result = await this.requestVoucher(normalizedPhone, macAddress, ipAddress);

    this.logger.log(`New voucher ${result.voucher.code} sent to ${normalizedPhone}`);

    return result;
  }

  async disableVoucher(id: string) {
    await this.findVoucher(id);

    return this.prisma.voucher.update({
      where: { id },
      data: { status: VoucherStatus.DISABLED },
    });
  }

  // ==========================================
  // AUTHENTICATION API
  // ==========================================

  /**
   * Authenticate voucher and create Mikrotik session
   * Used by portal when user submits voucher code
   */
  async authenticateVoucher(
    code: string,
    mac: string,
    ip: string,
    linkOrig?: string,
  ) {
    // Normalisasi MAC: uppercase + ':' (4A:F4:A0:95:92:95)
    const normalizedMac = normalizeMac(mac) || mac;

    // 1. Find voucher by code
    const voucher = await this.prisma.voucher.findUnique({
      where: { code: code.toUpperCase() },
      include: { profile: true },
    });

    // 2. Validate voucher existence
    if (!voucher) {
      throw new NotFoundException('Voucher tidak ditemukan');
    }

    // 3. Validate voucher status
    if (voucher.status === 'EXPIRED') {
      throw new BadRequestException('Voucher sudah expired');
    }

    // Check if voucher already used by different device
    if (voucher.status === 'USED' && voucher.usedBy && voucher.usedBy !== normalizedMac) {
      throw new BadRequestException('Voucher sudah digunakan oleh device lain');
    }

    // 4. Check if MAC already has active session
    const existingSession = await this.mikrotikService.getActiveSessionByMac(normalizedMac);
    if (existingSession) {
      this.logger.log(`MAC ${normalizedMac} already has active session`);
      return {
        success: true,
        message: 'Already connected',
        alreadyConnected: true,
        session: existingSession,
      };
    }

    // 5. Create or update Mikrotik hotspot user with correct profile
    this.logger.log(`Authenticating voucher: ${voucher.code}, profile: ${voucher.profile.name}`);
    
    try {
      // First, create/update the hotspot user with the correct profile
      this.logger.log(`Configuring hotspot user on router: ${voucher.code} (profile: ${voucher.profile.name})`);
      
      const userCreated = await this.mikrotikService.createOrUpdateHotspotUser(
        voucher.code,
        voucher.code,
        voucher.profile.name,
      );

      if (!userCreated) {
        this.logger.error(`Failed to configure hotspot user on router: ${voucher.code}`);
        throw new BadRequestException('Gagal membuat user di Mikrotik. Profile mungkin tidak sesuai.');
      }

      this.logger.log(`Hotspot user ready on router: ${voucher.code}`);

      // Authenticate - get login URL for browser redirect
      const authResult = await this.mikrotikService.authenticateUser(
        voucher.code,
        voucher.code,
        normalizedMac,
        ip,
      );

      if (!authResult.success) {
        this.logger.error(`Authentication rejected for user: ${voucher.code} (${authResult.message})`);
        throw new BadRequestException('Autentikasi gagal. Silakan coba lagi.');
      }

      this.logger.log(
        `User authenticated with voucher: ${voucher.code} (profile: ${voucher.profile.name})`,
      );
      
      // Store loginUrl for later use
      var loginUrl = authResult.loginUrl;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create Mikrotik session: ${msg}`);
      
      // Return user-friendly error messages
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Gagal membuat session di Mikrotik. Silakan hubungi admin.');
    }

    // 6. Update voucher status — conditional update mencegah race condition
    const now = new Date();
    const expiresAt = new Date(now.getTime() + voucher.profile.duration * 60 * 1000);

    const claimed = await this.prisma.voucher.updateMany({
      where: {
        id: voucher.id,
        // Tidak boleh diklaim ulang jika sudah dipakai device lain
        status: { notIn: [VoucherStatus.EXPIRED, VoucherStatus.DISABLED] },
        OR: [{ usedBy: null }, { usedBy: normalizedMac }],
      },
      data: {
        status: VoucherStatus.USED,
        usedBy: normalizedMac,
        usedAt: now,
        expiresAt,
      },
    });

    if (claimed.count === 0) {
      // Kalah race — voucher sudah diklaim device lain bersamaan
      this.logger.warn(`Race condition detected: voucher ${voucher.code} claimed concurrently`);
      throw new BadRequestException('Voucher sudah digunakan oleh device lain');
    }

    // 7. Create or update User record
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { macAddress: normalizedMac },
      });

      if (existingUser) {
        // Update existing user
        const updateData: Prisma.UserUpdateInput = {
          voucher: { connect: { id: voucher.id } },
          ipAddress: ip,
          status: 'ONLINE',
          loginAt: now,
        };
        
        // If user doesn't have name, try to get it from user with same MAC
        if (!existingUser.name && voucher.usedBy) {
          const macOwner = await this.prisma.user.findUnique({
            where: { macAddress: voucher.usedBy },
            select: { name: true },
          });
          if (macOwner?.name) {
            updateData.name = macOwner.name;
          }
        }
        
        await this.prisma.user.update({
          where: { macAddress: normalizedMac },
          data: updateData,
        });
        this.logger.log(`Updated user record for MAC: ${normalizedMac}`);
      } else {
        // Create new user (guest — phone tidak tersedia di jalur authenticate)
        const phone = `guest-${Date.now()}`;
        let name: string | null = null;
        
        if (voucher.usedBy) {
          const macOwner = await this.prisma.user.findUnique({
            where: { macAddress: voucher.usedBy },
            select: { name: true },
          });
          name = macOwner?.name || null;
        }
        
        await this.prisma.user.create({
          data: {
            macAddress: normalizedMac,
            ipAddress: ip,
            phone: phone,
            name: name,
            voucherId: voucher.id,
            status: 'ONLINE',
            loginAt: now,
          },
        });
        this.logger.log(`Created user record for MAC: ${normalizedMac}${name ? ` (${name})` : ''}`);
      }

      // Create session record
      await this.prisma.session.create({
        data: {
          user: {
            connect: { macAddress: normalizedMac },
          },
          startedAt: now,
          ipAddress: ip,
          macAddress: normalizedMac,
        },
      });
      this.logger.log(`Created session record for MAC: ${normalizedMac}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create or update user record: ${msg}`);
      // Don't fail the authentication, just log the error
    }

    // 8. Log authentication
    await this.prisma.systemLog.create({
      data: {
        type: 'USER',
        action: 'VOUCHER_AUTH',
        description: `Voucher ${code} authenticated for MAC ${normalizedMac}`,
        macAddress: normalizedMac,
        ipAddress: ip,
        metadata: {
          voucherCode: code,
          profile: voucher.profile.name,
          linkOrig,
        },
      },
    });

    return {
      success: true,
      message: 'Authentication successful',
      alreadyConnected: false,
      loginUrl, // Frontend should redirect to this URL for actual Mikrotik login
      session: {
        mac,
        ip,
        profile: voucher.profile.name,
        expiresAt,
        duration: voucher.profile.duration,
      },
    };
  }

  /**
   * Check if MAC address has active session
   * Used by portal on load to detect existing connection
   */
  async checkActiveSession(mac: string) {
    this.logger.log(`Checking active session for MAC: ${mac}`);
    
    // 1. Check Mikrotik for active session
    // Graceful saat router offline: portal harus tetap bisa dimuat
    let session: Record<string, unknown> | null = null;
    try {
      session = await this.mikrotikService.getActiveSessionByMac(mac);
    } catch (error: unknown) {
      this.logger.warn(`Mikrotik unreachable during session check: ${getErrorMessage(error)}`);
      return {
        active: false,
        message: 'Mikrotik unreachable',
      };
    }

    if (!session) {
      this.logger.log(`No active session found in Mikrotik for MAC: ${mac}`);
      return {
        active: false,
        message: 'No active session',
      };
    }

    this.logger.log(`Active session found in Mikrotik: ${session.mac} (${session.username})`);

    // 2. Get voucher info from database
    const voucher = await this.prisma.voucher.findFirst({
      where: {
        usedBy: mac,
        status: VoucherStatus.USED,
      },
      include: { profile: true },
      orderBy: { usedAt: 'desc' },
    });

    if (voucher) {
      this.logger.log(`Voucher record located: ${voucher.code} (profile: ${voucher.profile.name})`);
    } else {
      this.logger.warn(`No voucher record located in database for active MAC: ${mac}`);
    }

    return {
      active: true,
      session: {
        mac: session.mac,
        ip: session.ip,
        username: session.username,
        uptime: session.uptime,
        bytesIn: session.bytesIn,
        bytesOut: session.bytesOut,
        voucher: voucher ? {
          code: voucher.code,
          profile: {
            name: voucher.profile.name,
            duration: voucher.profile.duration,
            uploadSpeed: voucher.profile.uploadSpeed,
            downloadSpeed: voucher.profile.downloadSpeed,
          }
        } : undefined,
        expiresAt: voucher?.expiresAt,
      },
    };
  }

  /**
   * Disconnect user session by MAC address
   * Used by portal logout functionality
   */
  async disconnectSession(mac: string) {
    // 1. Disconnect from Mikrotik
    try {
      await this.mikrotikService.disconnectUserByMac(mac);
      this.logger.log(`Disconnected MAC from router: ${mac}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to disconnect MAC ${mac} from Mikrotik: ${msg}`);
      // Continue anyway to log the disconnect attempt
    }

    // 2. Log disconnect action
    await this.prisma.systemLog.create({
      data: {
        type: 'USER',
        action: 'VOUCHER_DISCONNECT',
        description: `User disconnected: MAC ${mac}`,
        macAddress: mac,
      },
    });

    return {
      success: true,
      message: 'Disconnected successfully',
    };
  }

  /**
   * Resume portal after iOS CNA closes (user opened WhatsApp).
   * Looks up the latest unused voucher bound to this MAC.
   */
  async getPendingVoucher(mac: string) {
    const normalizedMac = mac.trim();
    if (!normalizedMac) {
      return { pending: false as const };
    }

    const user = await this.prisma.user.findFirst({
      where: { macAddress: normalizedMac },
      orderBy: { updatedAt: 'desc' },
    });

    if (!user?.voucherId) {
      return { pending: false as const };
    }

    const voucher = await this.prisma.voucher.findFirst({
      where: {
        id: user.voucherId,
        status: { in: [VoucherStatus.UNUSED, VoucherStatus.ACTIVE] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { profile: true },
    });

    if (!voucher) {
      return { pending: false as const };
    }

    return {
      pending: true as const,
      phone: user.phone,
      voucher: {
        id: voucher.id,
        codeLength: voucher.code.length,
        profileName: voucher.profile.name,
        expiresAt: voucher.expiresAt,
      },
    };
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private generateVoucherCode(
    prefix?: string,
    length: number = 8,
    format: 'number' | 'text' | 'mixed' | 'mixed_upper' = 'mixed_upper',
  ): string {
    let chars: string;
    
    switch (format) {
      case 'number':
        chars = '0123456789';
        break;
      case 'text':
        chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        break;
      case 'mixed':
        chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        break;
      case 'mixed_upper':
      default:
        chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        break;
    }

    let code = prefix || '';

    for (let i = 0; i < length; i++) {
      code += chars.charAt(crypto.randomInt(0, chars.length));
    }

    return code;
  }

  private generateBatchId(): string {
    return `BATCH-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  }

  private generateRandomMac(): string {
    const bytes = crypto.randomBytes(6);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(':');
  }

  // ==========================================
  // STATISTICS
  // ==========================================

  async getStats() {
    const [total, unused, active, used, expired] = await Promise.all([
      this.prisma.voucher.count(),
      this.prisma.voucher.count({ where: { status: VoucherStatus.UNUSED } }),
      this.prisma.voucher.count({ where: { status: VoucherStatus.ACTIVE } }),
      this.prisma.voucher.count({ where: { status: VoucherStatus.USED } }),
      this.prisma.voucher.count({ where: { status: VoucherStatus.EXPIRED } }),
    ]);

    return {
      total,
      unused,
      active,
      used,
      expired,
    };
  }
}
