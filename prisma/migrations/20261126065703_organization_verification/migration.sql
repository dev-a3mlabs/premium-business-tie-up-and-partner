-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `gstin_verified_at` DATETIME(3) NULL,
    ADD COLUMN `legal_name` VARCHAR(200) NULL,
    ADD COLUMN `pan_verified_at` DATETIME(3) NULL,
    ADD COLUMN `udyam_verified_at` DATETIME(3) NULL;
