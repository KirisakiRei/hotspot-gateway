import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '@prisma/client';

export const Roles = (...roles: AdminRole[]) => SetMetadata('roles', roles);
