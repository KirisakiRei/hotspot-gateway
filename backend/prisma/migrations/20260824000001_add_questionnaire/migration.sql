-- Migration: add_questionnaire
-- Tambah tabel questionnaire_fields dan questionnaire_submissions

-- CreateEnum
CREATE TYPE "QuestionnaireFieldType" AS ENUM ('TEXT', 'EMAIL', 'PHONE', 'NUMBER', 'SELECT', 'TEXTAREA');

-- CreateTable
CREATE TABLE "questionnaire_fields" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "QuestionnaireFieldType" NOT NULL,
    "options" JSONB,
    "placeholder" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questionnaire_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaire_submissions" (
    "id" TEXT NOT NULL,
    "macAddress" TEXT NOT NULL,
    "voucherId" TEXT,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questionnaire_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_fields_key_key" ON "questionnaire_fields"("key");

-- CreateIndex
CREATE INDEX "questionnaire_fields_isActive_order_idx" ON "questionnaire_fields"("isActive", "order");

-- CreateIndex
CREATE INDEX "questionnaire_submissions_macAddress_idx" ON "questionnaire_submissions"("macAddress");

-- CreateIndex
CREATE INDEX "questionnaire_submissions_voucherId_idx" ON "questionnaire_submissions"("voucherId");
