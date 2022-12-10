-- CreateTable
CREATE TABLE `ActivityLogs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `policeId` INTEGER NOT NULL,
    `message` VARCHAR(255) NOT NULL,
    `date_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ActivityLogs` ADD CONSTRAINT `ActivityLogs_policeId_fkey` FOREIGN KEY (`policeId`) REFERENCES `Police`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
