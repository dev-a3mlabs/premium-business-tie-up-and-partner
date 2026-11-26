-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `is_platform_admin` BOOLEAN NOT NULL DEFAULT false,
    `disabled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_uuid_key`(`uuid`),
    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_is_platform_admin_disabled_at_name_id_idx`(`is_platform_admin`, `disabled_at`, `name`, `id`),
    INDEX `users_created_at_id_idx`(`created_at`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(512) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_sessions_uuid_key`(`uuid`),
    INDEX `user_sessions_user_id_revoked_at_idx`(`user_id`, `revoked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` INTEGER NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_session_id_idx`(`session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organizations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `website` VARCHAR(300) NOT NULL DEFAULT '',
    `industry` VARCHAR(80) NOT NULL,
    `size` VARCHAR(10) NOT NULL,
    `location` VARCHAR(120) NOT NULL,
    `country` VARCHAR(80) NOT NULL,
    `description` VARCHAR(2000) NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `gstin` VARCHAR(15) NOT NULL,
    `pan` VARCHAR(10) NOT NULL,
    `udyam_number` VARCHAR(19) NULL,
    `created_by_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `organizations_uuid_key`(`uuid`),
    UNIQUE INDEX `organizations_slug_key`(`slug`),
    INDEX `organizations_created_at_id_idx`(`created_at`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `memberships` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `org_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `role` ENUM('owner', 'admin', 'member') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `memberships_user_id_created_at_org_id_idx`(`user_id`, `created_at`, `org_id`),
    UNIQUE INDEX `memberships_org_id_user_id_key`(`org_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tie_up_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `org_id` INTEGER NOT NULL,
    `submitted_by_id` INTEGER NOT NULL,
    `title` VARCHAR(140) NOT NULL,
    `category_id` VARCHAR(48) NULL,
    `subcategory_id` VARCHAR(48) NULL,
    `category_label` VARCHAR(120) NULL,
    `subcategory_label` VARCHAR(120) NULL,
    `custom_category` VARCHAR(120) NULL,
    `custom_subcategory` VARCHAR(120) NULL,
    `description` VARCHAR(3000) NOT NULL,
    `preferred_criteria` VARCHAR(1000) NOT NULL DEFAULT '',
    `location_preference` VARCHAR(120) NOT NULL DEFAULT '',
    `industries_served` JSON NOT NULL,
    `budget_range` VARCHAR(120) NOT NULL,
    `timeline` VARCHAR(120) NOT NULL,
    `intake` JSON NOT NULL,
    `status` ENUM('submitted', 'under_review', 'partner_search', 'shortlisted', 'intro_pending', 'intro_sent', 'discussion', 'established', 'closed', 'cancelled') NOT NULL DEFAULT 'submitted',
    `assigned_admin_id` INTEGER NULL,
    `policy_version` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tie_up_requests_uuid_key`(`uuid`),
    INDEX `tie_up_requests_org_id_created_at_id_idx`(`org_id`, `created_at`, `id`),
    INDEX `tie_up_requests_status_created_at_id_idx`(`status`, `created_at`, `id`),
    INDEX `tie_up_requests_assigned_admin_id_status_created_at_id_idx`(`assigned_admin_id`, `status`, `created_at`, `id`),
    INDEX `tie_up_requests_created_at_id_idx`(`created_at`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `introductions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `request_id` INTEGER NOT NULL,
    `specialist_name` VARCHAR(120) NOT NULL,
    `message` VARCHAR(2000) NOT NULL,
    `status` ENUM('pending', 'sent', 'accepted', 'declined') NOT NULL DEFAULT 'pending',
    `created_by_id` INTEGER NOT NULL,
    `sent_by_id` INTEGER NULL,
    `responded_by_id` INTEGER NULL,
    `discarded_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sent_at` DATETIME(3) NULL,
    `responded_at` DATETIME(3) NULL,
    `discarded_at` DATETIME(3) NULL,

    UNIQUE INDEX `introductions_uuid_key`(`uuid`),
    INDEX `introductions_request_id_created_at_id_idx`(`request_id`, `created_at`, `id`),
    INDEX `introductions_status_discarded_at_created_at_id_idx`(`status`, `discarded_at`, `created_at`, `id`),
    INDEX `introductions_created_at_id_idx`(`created_at`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `actor_id` INTEGER NULL,
    `org_id` INTEGER NULL,
    `request_id` INTEGER NULL,
    `entity_id` CHAR(36) NULL,
    `type` VARCHAR(48) NOT NULL,
    `message` VARCHAR(2000) NOT NULL,
    `visibility` ENUM('public', 'internal') NOT NULL,
    `status_at_event` ENUM('submitted', 'under_review', 'partner_search', 'shortlisted', 'intro_pending', 'intro_sent', 'discussion', 'established', 'closed', 'cancelled') NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `activity_events_uuid_key`(`uuid`),
    INDEX `activity_events_org_id_visibility_created_at_id_idx`(`org_id`, `visibility`, `created_at`, `id`),
    INDEX `activity_events_request_id_visibility_created_at_id_idx`(`request_id`, `visibility`, `created_at`, `id`),
    INDEX `activity_events_request_id_type_created_at_id_idx`(`request_id`, `type`, `created_at`, `id`),
    INDEX `activity_events_visibility_created_at_id_idx`(`visibility`, `created_at`, `id`),
    INDEX `activity_events_created_at_id_idx`(`created_at`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_submissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `subject` VARCHAR(48) NOT NULL,
    `message` VARCHAR(3000) NOT NULL,
    `status` ENUM('new', 'resolved') NOT NULL DEFAULT 'new',
    `resolved_at` DATETIME(3) NULL,
    `resolved_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `contact_submissions_uuid_key`(`uuid`),
    INDEX `contact_submissions_status_created_at_id_idx`(`status`, `created_at`, `id`),
    INDEX `contact_submissions_created_at_id_idx`(`created_at`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `user_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tie_up_requests` ADD CONSTRAINT `tie_up_requests_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tie_up_requests` ADD CONSTRAINT `tie_up_requests_submitted_by_id_fkey` FOREIGN KEY (`submitted_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tie_up_requests` ADD CONSTRAINT `tie_up_requests_assigned_admin_id_fkey` FOREIGN KEY (`assigned_admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `introductions` ADD CONSTRAINT `introductions_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `tie_up_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `introductions` ADD CONSTRAINT `introductions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `introductions` ADD CONSTRAINT `introductions_sent_by_id_fkey` FOREIGN KEY (`sent_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `introductions` ADD CONSTRAINT `introductions_responded_by_id_fkey` FOREIGN KEY (`responded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `introductions` ADD CONSTRAINT `introductions_discarded_by_id_fkey` FOREIGN KEY (`discarded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_events` ADD CONSTRAINT `activity_events_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_events` ADD CONSTRAINT `activity_events_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_events` ADD CONSTRAINT `activity_events_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `tie_up_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_submissions` ADD CONSTRAINT `contact_submissions_resolved_by_id_fkey` FOREIGN KEY (`resolved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
