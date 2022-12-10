/*
  Warnings:

  - Made the column `violation` on table `criminal` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `criminal` MODIFY `violation` VARCHAR(255) NOT NULL;
