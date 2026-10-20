-- 3D 迷宮系統 資料庫結構 (XAMPP MySQL)
-- 資料庫名稱: maze_db

CREATE DATABASE IF NOT EXISTS `maze_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `maze_db`;

-- 1. 使用者資料表
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `last_login` DATETIME NULL
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
