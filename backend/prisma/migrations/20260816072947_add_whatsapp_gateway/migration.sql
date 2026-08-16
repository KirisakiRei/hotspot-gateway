/*
  Warnings:

  - You are about to alter the column `role` on the `admins` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(4))` to `VarChar(191)`.

*/
-- AlterTable
ALTER TABLE `admins` MODIFY `role` VARCHAR(191) NOT NULL DEFAULT 'OPERATOR';

-- AlterTable
ALTER TABLE `sessions` ADD COLUMN `routerId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` MODIFY `macAddress` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `routers` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NULL,
    `host` VARCHAR(191) NOT NULL,
    `port` INTEGER NOT NULL DEFAULT 8728,
    `username` VARCHAR(191) NOT NULL DEFAULT 'admin',
    `password` VARCHAR(191) NULL,
    `radiusSecret` VARCHAR(191) NULL,
    `monitoringInterval` INTEGER NOT NULL DEFAULT 30,
    `apiEnabled` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `lastSeenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `routers_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `state` VARCHAR(191) NOT NULL DEFAULT 'DISCONNECTED',
    `sentCount` INTEGER NOT NULL DEFAULT 0,
    `pairedAt` DATETIME(3) NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wa_sessions_phone_key`(`phone`),
    INDEX `wa_sessions_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_message_logs` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `sessionPhone` VARCHAR(191) NOT NULL,
    `recipientPhone` VARCHAR(191) NOT NULL,
    `messageType` VARCHAR(191) NOT NULL DEFAULT 'TEXT',
    `message` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `errorMessage` TEXT NULL,
    `voucherCode` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `wa_message_logs_sessionPhone_createdAt_idx`(`sessionPhone`, `createdAt`),
    INDEX `wa_message_logs_recipientPhone_createdAt_idx`(`recipientPhone`, `createdAt`),
    INDEX `wa_message_logs_status_idx`(`status`),
    INDEX `wa_message_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `sessions_routerId_idx` ON `sessions`(`routerId`);

-- CreateIndex
CREATE INDEX `sessions_macAddress_endedAt_idx` ON `sessions`(`macAddress`, `endedAt`);

-- CreateIndex
CREATE INDEX `users_loginAt_idx` ON `users`(`loginAt`);

-- CreateIndex
CREATE INDEX `vouchers_usedBy_expiresAt_batchId_idx` ON `vouchers`(`usedBy`, `expiresAt`, `batchId`);

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_routerId_fkey` FOREIGN KEY (`routerId`) REFERENCES `routers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_message_logs` ADD CONSTRAINT `wa_message_logs_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `wa_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `system_logs` RENAME INDEX `system_logs_adminId_fkey` TO `system_logs_adminId_idx`;
