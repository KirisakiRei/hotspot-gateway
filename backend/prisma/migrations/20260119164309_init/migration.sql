-- CreateTable
CREATE TABLE `admins` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'ADMIN', 'OPERATOR') NOT NULL DEFAULT 'OPERATOR',
    `avatar` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admins_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `macAddress` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `deviceName` VARCHAR(191) NULL,
    `voucherId` VARCHAR(191) NULL,
    `status` ENUM('ONLINE', 'OFFLINE', 'BLOCKED', 'EXPIRED') NOT NULL DEFAULT 'OFFLINE',
    `server` VARCHAR(191) NULL,
    `loginAt` DATETIME(3) NULL,
    `logoutAt` DATETIME(3) NULL,
    `quotaUsed` BIGINT NOT NULL DEFAULT 0,
    `timeUsed` INTEGER NOT NULL DEFAULT 0,
    `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    `blockReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_phone_key`(`phone`),
    UNIQUE INDEX `users_macAddress_key`(`macAddress`),
    INDEX `users_status_idx`(`status`),
    INDEX `users_macAddress_idx`(`macAddress`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NOT NULL,
    `macAddress` VARCHAR(191) NOT NULL,
    `server` VARCHAR(191) NULL,
    `bytesIn` BIGINT NOT NULL DEFAULT 0,
    `bytesOut` BIGINT NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,

    INDEX `sessions_userId_idx`(`userId`),
    INDEX `sessions_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voucher_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `duration` INTEGER NOT NULL,
    `quota` BIGINT NULL,
    `uploadSpeed` INTEGER NULL,
    `downloadSpeed` INTEGER NULL,
    `sharedUsers` INTEGER NOT NULL DEFAULT 1,
    `validityDays` INTEGER NOT NULL DEFAULT 30,
    `price` DECIMAL(10, 2) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `voucher_profiles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vouchers` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `profileId` VARCHAR(191) NOT NULL,
    `status` ENUM('UNUSED', 'ACTIVE', 'USED', 'EXPIRED', 'DISABLED') NOT NULL DEFAULT 'UNUSED',
    `usedBy` VARCHAR(191) NULL,
    `usedAt` DATETIME(3) NULL,
    `activatedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `batchId` VARCHAR(191) NULL,
    `quotaUsed` BIGINT NOT NULL DEFAULT 0,
    `timeUsed` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vouchers_code_key`(`code`),
    INDEX `vouchers_code_idx`(`code`),
    INDEX `vouchers_status_idx`(`status`),
    INDEX `vouchers_profileId_idx`(`profileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voucher_batches` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `profileId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `prefix` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `advertisements` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `videoType` ENUM('YOUTUBE', 'LOCAL', 'GDRIVE', 'URL') NOT NULL DEFAULT 'YOUTUBE',
    `videoUrl` TEXT NOT NULL,
    `youtubeId` VARCHAR(191) NULL,
    `thumbnailUrl` TEXT NULL,
    `duration` INTEGER NOT NULL,
    `startTime` INTEGER NOT NULL DEFAULT 0,
    `endTime` INTEGER NULL,
    `displayDuration` INTEGER NOT NULL,
    `skipable` BOOLEAN NOT NULL DEFAULT true,
    `skipAfter` INTEGER NOT NULL DEFAULT 5,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `weight` INTEGER NOT NULL DEFAULT 1,
    `maxViewsPerDay` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `views` INTEGER NOT NULL DEFAULT 0,
    `completions` INTEGER NOT NULL DEFAULT 0,
    `skips` INTEGER NOT NULL DEFAULT 0,
    `avgWatchTime` DOUBLE NOT NULL DEFAULT 0,
    `completionRate` DOUBLE NOT NULL DEFAULT 0,
    `targeting` JSON NULL,
    `fallbackAdId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `advertisements_priority_isActive_idx`(`priority`, `isActive`),
    INDEX `advertisements_youtubeId_idx`(`youtubeId`),
    INDEX `advertisements_startDate_endDate_idx`(`startDate`, `endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_logs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `adminId` VARCHAR(191) NULL,
    `type` ENUM('AUTH', 'USER', 'VOUCHER', 'SESSION', 'ADMIN', 'SYSTEM', 'ERROR') NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `macAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `metadata` JSON NULL,
    `status` ENUM('SUCCESS', 'WARNING', 'ERROR', 'INFO') NOT NULL DEFAULT 'SUCCESS',
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `system_logs_type_idx`(`type`),
    INDEX `system_logs_status_idx`(`status`),
    INDEX `system_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `type` ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'PASSWORD') NOT NULL DEFAULT 'STRING',
    `group` VARCHAR(191) NOT NULL DEFAULT 'general',
    `description` TEXT NULL,
    `isEncrypted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `settings_key_key`(`key`),
    INDEX `settings_group_idx`(`group`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vouchers` ADD CONSTRAINT `vouchers_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `voucher_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `advertisements` ADD CONSTRAINT `advertisements_fallbackAdId_fkey` FOREIGN KEY (`fallbackAdId`) REFERENCES `advertisements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_logs` ADD CONSTRAINT `system_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_logs` ADD CONSTRAINT `system_logs_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
