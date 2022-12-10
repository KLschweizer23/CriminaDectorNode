/*
  Warnings:

  - You are about to alter the column `description` on the `criminal` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `lastSeen` on the `criminal` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - Added the required column `percentage` to the `Logs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `criminal` MODIFY `description` VARCHAR(191) NULL,
    MODIFY `lastSeen` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `logs` ADD COLUMN `percentage` VARCHAR(255) NOT NULL;
