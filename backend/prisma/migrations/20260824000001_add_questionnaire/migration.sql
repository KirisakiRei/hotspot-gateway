-- Migration: add_questionnaire
-- Tambah tabel questionnaire_fields dan questionnaire_submissions
-- Dialek: MySQL

-- CreateTable
CREATE TABLE `questionnaire_fields` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `type` ENUM('TEXT', 'EMAIL', 'PHONE', 'NUMBER', 'SELECT', 'TEXTAREA') NOT NULL,
    `options` JSON NULL,
    `placeholder` VARCHAR(191) NULL,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `questionnaire_fields_key_key`(`key`),
    INDEX `questionnaire_fields_isActive_order_idx`(`isActive`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questionnaire_submissions` (
    `id` VARCHAR(191) NOT NULL,
    `macAddress` VARCHAR(191) NOT NULL,
    `voucherId` VARCHAR(191) NULL,
    `answers` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `questionnaire_submissions_macAddress_idx`(`macAddress`),
    INDEX `questionnaire_submissions_voucherId_idx`(`voucherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;