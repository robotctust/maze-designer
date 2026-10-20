-- 3D 迷宮系統 資料庫結構 (XAMPP MySQL)
-- 資料庫名稱: maze_db

CREATE DATABASE IF NOT EXISTS `maze_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `maze_db`;

-- 1. 使用者資料表 (含初級、中級、高級權限)
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'junior',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `last_login` DATETIME NULL,
    INDEX (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 使用者迷宮存檔資料表
CREATE TABLE IF NOT EXISTS `user_mazes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `maze_name` VARCHAR(100) DEFAULT '我的迷宮',
    `grid_rows` INT NOT NULL,
    `grid_cols` INT NOT NULL,
    `maze_data` LONGTEXT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (`user_id`),
    CONSTRAINT `fk_user_mazes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 排位賽排行榜成績資料表
CREATE TABLE IF NOT EXISTS `rankings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `grid_size` VARCHAR(10) NOT NULL,
    `map_id` VARCHAR(50) NOT NULL,
    `time_used_ms` INT NOT NULL,
    `time_remain_ms` INT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX (`grid_size`, `time_used_ms`),
    INDEX (`user_id`),
    CONSTRAINT `fk_rankings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 分享碼資料表 (限時 1 分鐘，限 3 人使用)
CREATE TABLE IF NOT EXISTS `share_codes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(32) NOT NULL UNIQUE,
    `user_id` INT NOT NULL,
    `maze_name` VARCHAR(100) DEFAULT '分享迷宮',
    `grid_rows` INT NOT NULL,
    `grid_cols` INT NOT NULL,
    `maze_data` LONGTEXT NOT NULL,
    `max_uses` INT NOT NULL DEFAULT 3,
    `used_count` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `expires_at` DATETIME NOT NULL,
    INDEX (`code`),
    INDEX (`user_id`),
    INDEX (`expires_at`),
    CONSTRAINT `fk_share_codes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 待審核排位賽地圖資料表 (中級使用者上傳需經高級審核)
CREATE TABLE IF NOT EXISTS `ranked_submissions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `size` VARCHAR(10) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `author_id` INT NOT NULL,
    `author_name` VARCHAR(50) NOT NULL,
    `grid_rows` INT NOT NULL,
    `grid_cols` INT NOT NULL,
    `maze_data` LONGTEXT NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `reviewer_id` INT NULL,
    `reviewed_at` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX (`status`),
    INDEX (`author_id`, `size`),
    CONSTRAINT `fk_ranked_sub_user` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
