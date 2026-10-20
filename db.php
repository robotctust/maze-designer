<?php
/**
 * 資料庫連線與自動初始化設定 (XAMPP MySQL)
 */

$dbHost = '127.0.0.1';
$dbUser = 'root';
$dbPass = '';
$dbName = 'maze_db';
$dbPort = 3306;

// 若有自訂本機設定檔 (已列入 .gitignore)，優先載入自訂設定
if (file_exists(__DIR__ . '/config.php')) {
    $customConfig = require __DIR__ . '/config.php';
    if (is_array($customConfig)) {
        $dbHost = $customConfig['db_host'] ?? $dbHost;
        $dbUser = $customConfig['db_user'] ?? $dbUser;
        $dbPass = $customConfig['db_pass'] ?? $dbPass;
        $dbName = $customConfig['db_name'] ?? $dbName;
        $dbPort = $customConfig['db_port'] ?? $dbPort;
    }
}

function getDbConnection() {
    global $dbHost, $dbUser, $dbPass, $dbName, $dbPort;
    static $conn = null;
    
    if ($conn !== null) {
        return $conn;
    }

    // 1. 先嘗試連接 MySQL 伺服器
    $conn = @new mysqli($dbHost, $dbUser, $dbPass, '', $dbPort);
    if ($conn->connect_error) {
        throw new Exception("無法連線至 MySQL 伺服器 (請確認 XAMPP MySQL 服務已啟動): " . $conn->connect_error);
    }

    $conn->set_charset('utf8mb4');

    // 2. 自動檢查並建立資料庫
    $createDbSql = "CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;";
    if (!$conn->query($createDbSql)) {
        throw new Exception("無法建立資料庫 `{$dbName}`: " . $conn->error);
    }

    // 3. 切換至指定資料庫
    if (!$conn->select_db($dbName)) {
        throw new Exception("無法選取資料庫 `{$dbName}`: " . $conn->error);
    }

    // 4. 自動檢查並建立 users 資料表
    $createUsersTable = "CREATE TABLE IF NOT EXISTS `users` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `username` VARCHAR(50) NOT NULL UNIQUE,
        `password_hash` VARCHAR(255) NOT NULL,
        `role` VARCHAR(20) NOT NULL DEFAULT 'junior',
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        `last_login` DATETIME NULL,
        INDEX (`role`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
    
    if (!$conn->query($createUsersTable)) {
        throw new Exception("無法建立 users 資料表: " . $conn->error);
    }

    // 4-1. 檢查並自動補充 role 欄位 (支援舊版昇級)
    $chkRoleCol = @$conn->query("SHOW COLUMNS FROM `users` LIKE 'role'");
    if ($chkRoleCol && $chkRoleCol->num_rows === 0) {
        @$conn->query("ALTER TABLE `users` ADD COLUMN `role` VARCHAR(20) NOT NULL DEFAULT 'junior' AFTER `password_hash`");
        @$conn->query("ALTER TABLE `users` ADD INDEX (`role`)");
    }

    // 4-2. 初始化權限：chao 設為高級使用者 (senior)，其餘帳號預設為初級使用者 (junior)
    @$conn->query("UPDATE `users` SET `role` = 'senior' WHERE `username` = 'chao'");
    @$conn->query("UPDATE `users` SET `role` = 'junior' WHERE `username` != 'chao' AND (`role` IS NULL OR `role` = '' OR `role` NOT IN ('junior', 'intermediate', 'senior'))");

    // 5. 自動檢查並建立 user_mazes 資料表 (儲存使用者專屬迷宮)
    $createMazesTable = "CREATE TABLE IF NOT EXISTS `user_mazes` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    if (!$conn->query($createMazesTable)) {
        // 若外鍵問題可能因舊表存在，不阻斷執行
        error_log("建立 user_mazes 資料表警告: " . $conn->error);
    }

    // 6. 自動檢查並建立 rankings 資料表 (排位賽排行榜成績紀錄，每位選手每種規格僅保留最佳成績)
    $createRankingsTable = "CREATE TABLE IF NOT EXISTS `rankings` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `user_id` INT NOT NULL,
        `grid_size` VARCHAR(10) NOT NULL,
        `map_id` VARCHAR(50) NOT NULL,
        `time_used_ms` INT NOT NULL,
        `time_remain_ms` INT NOT NULL,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (`grid_size`, `time_used_ms`),
        INDEX (`user_id`),
        UNIQUE KEY `uk_user_grid` (`user_id`, `grid_size`),
        CONSTRAINT `fk_rankings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    if (!$conn->query($createRankingsTable)) {
        error_log("建立 rankings 資料表警告: " . $conn->error);
    }

    // 6-1. 確保 (user_id, grid_size) 為唯一鍵，杜絕重複帳號 (僅於尚未建立唯一鍵時執行清理)
    $chkUniqueIndex = @$conn->query("SHOW INDEX FROM `rankings` WHERE Key_name = 'uk_user_grid'");
    if ($chkUniqueIndex && $chkUniqueIndex->num_rows === 0) {
        $cleanupDuplicatesSql = "DELETE r1 FROM `rankings` r1
            INNER JOIN `rankings` r2 
            WHERE r1.user_id = r2.user_id 
              AND r1.grid_size = r2.grid_size 
              AND (r1.time_used_ms > r2.time_used_ms OR (r1.time_used_ms = r2.time_used_ms AND r1.id > r2.id));";
        @$conn->query($cleanupDuplicatesSql);
        @$conn->query("ALTER TABLE `rankings` ADD UNIQUE KEY `uk_user_grid` (`user_id`, `grid_size`)");
    }

    // 7. 自動檢查並建立 share_codes 資料表 (分享碼：限時 1 分鐘，限 3 人使用)
    $createShareCodesTable = "CREATE TABLE IF NOT EXISTS `share_codes` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    if (!$conn->query($createShareCodesTable)) {
        error_log("建立 share_codes 資料表警告: " . $conn->error);
    }

    // 8. 自動檢查並建立 ranked_submissions 資料表 (中級使用者排位賽地圖待審核庫)
    $createRankedSubTable = "CREATE TABLE IF NOT EXISTS `ranked_submissions` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    if (!$conn->query($createRankedSubTable)) {
        error_log("建立 ranked_submissions 資料表警告: " . $conn->error);
    }

    return $conn;
}

// 權限角色常數與名稱轉換
const ROLE_JUNIOR = 'junior';             // 初級使用者
const ROLE_INTERMEDIATE = 'intermediate'; // 中級使用者
const ROLE_SENIOR = 'senior';             // 高級使用者

function getRoleTitle($role) {
    switch ($role) {
        case ROLE_SENIOR:
            return '高級使用者';
        case ROLE_INTERMEDIATE:
            return '中級使用者';
        case ROLE_JUNIOR:
        default:
            return '初級使用者';
    }
}

