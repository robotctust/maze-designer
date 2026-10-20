<?php
/**
 * 所有 api/*.php 共用的開頭：開啟 session、回傳 JSON、載入資料庫設定、讀取 action 與 JSON 請求內容
 */
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? '');

// 取得 JSON 請求主體 (若以 application/json 送出)
$jsonBody = json_decode(file_get_contents('php://input'), true) ?: [];

// 連線資料庫；連不上就直接回傳錯誤並結束
function connectDbOrExit() {
    try {
        return getDbConnection();
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => '資料庫連線失敗：' . $e->getMessage()]);
        exit;
    }
}
