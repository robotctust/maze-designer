<?php
/**
 * 分享碼 API (中高級使用者產生 / 全員兌換載入 / 狀態查詢)
 * 規則：限時 1 分鐘，限 3 人使用，儲存於資料庫
 */
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$isLoggedIn = !empty($_SESSION['user_id']);
$userId = $isLoggedIn ? intval($_SESSION['user_id']) : 0;

try {
    $db = getDbConnection();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '資料庫連線失敗：' . $e->getMessage()]);
    exit;
}

$rawInput = file_get_contents('php://input');
$jsonBody = json_decode($rawInput, true) ?: [];

// 輔助函式：取得使用者即時角色
function getUserRole($db, $userId) {
    if (!$userId) return null;
    $stmt = $db->prepare("SELECT role FROM `users` WHERE id = ? LIMIT 1");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res->fetch_assoc();
    $stmt->close();
    return $row['role'] ?? ROLE_JUNIOR;
}

// 輔助函式：驗證迷宮結構合法性
function isValidMazeStructure($data) {
    if (!isset($data['hWalls']) || !isset($data['vWalls']) || !is_array($data['hWalls']) || !is_array($data['vWalls'])) {
        return false;
    }
    $rows = isset($data['gridSize']['rows']) ? intval($data['gridSize']['rows']) : (count($data['hWalls']) - 1);
    $cols = isset($data['gridSize']['cols']) ? intval($data['gridSize']['cols']) : count($data['hWalls'][0]);
    if ($rows < 2 || $cols < 2 || $rows > 30 || $cols > 30) return false;
    if (count($data['hWalls']) !== ($rows + 1)) return false;
    if (count($data['vWalls']) !== $rows) return false;
    return true;
}

// 輔助函式：產生好辨識的 6 碼分享碼 (排除易混淆字元如 0, O, 1, I, L)
function generateShareCode($db) {
    $chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    $charsLen = strlen($chars);
    for ($attempt = 0; $attempt < 10; $attempt++) {
        $code = '';
        for ($i = 0; $i < 6; $i++) {
            $code .= $chars[random_int(0, $charsLen - 1)];
        }
        // 檢查唯一性
        $stmt = $db->prepare("SELECT id FROM `share_codes` WHERE code = ? LIMIT 1");
        $stmt->bind_param('s', $code);
        $stmt->execute();
        $stmt->store_result();
        $exists = $stmt->num_rows > 0;
        $stmt->close();
        if (!$exists) {
            return $code;
        }
    }
    return strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 6));
}

// ============================================================
// 1. 產生分享碼 (中級、高級使用者專屬)
// ============================================================
if ($action === 'create') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '請使用 POST 方法']);
        exit;
    }

    if (!$isLoggedIn) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'requireLogin' => true,
            'message' => '請先登入帳號以使用分享碼功能！'
        ]);
        exit;
    }

    $currentRole = getUserRole($db, $userId);
    if ($currentRole !== ROLE_INTERMEDIATE && $currentRole !== ROLE_SENIOR) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => '初級使用者不能產生分享碼，只能使用別人的分享碼載入地圖！請向管理員申請提升為中級或高級使用者。'
        ]);
        exit;
    }

    $payload = $jsonBody;
    $mapData = $payload['mapData'] ?? $payload['data'] ?? null;
    if (!$mapData || !isValidMazeStructure($mapData)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '迷宮資料不完整或無效！']);
        exit;
    }

    $rows = isset($mapData['gridSize']['rows']) ? intval($mapData['gridSize']['rows']) : (count($mapData['hWalls']) - 1);
    $cols = isset($mapData['gridSize']['cols']) ? intval($mapData['gridSize']['cols']) : count($mapData['hWalls'][0]);
    $mazeName = trim($payload['name'] ?? ($mapData['name'] ?? "分享迷宮 ({$cols}×{$rows})"));
    if (empty($mazeName)) {
        $mazeName = "分享迷宮 ({$cols}×{$rows})";
    }

    $code = generateShareCode($db);
    $mazeJson = json_encode($mapData, JSON_UNESCAPED_UNICODE);
    $maxUses = 3; // 限 3 人使用
    $durationSec = 60; // 限時 1 分鐘
    $now = date('Y-m-d H:i:s');
    $expiresAt = date('Y-m-d H:i:s', time() + $durationSec);

    $stmt = $db->prepare("INSERT INTO `share_codes` (code, user_id, maze_name, grid_rows, grid_cols, maze_data, max_uses, used_count, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW(), DATE_ADD(NOW(), INTERVAL 1 MINUTE))");
    $stmt->bind_param('sisiisi', $code, $userId, $mazeName, $rows, $cols, $mazeJson, $maxUses);
    
    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => '產生分享碼失敗：' . $stmt->error]);
        exit;
    }
    $stmt->close();

    // 取得資料庫中實際的 expires_at
    $exStmt = $db->prepare("SELECT expires_at FROM `share_codes` WHERE code = ? LIMIT 1");
    $exStmt->bind_param('s', $code);
    $exStmt->execute();
    $exRow = $exStmt->get_result()->fetch_assoc();
    $exStmt->close();
    $realExpiresAt = $exRow ? $exRow['expires_at'] : $expiresAt;

    echo json_encode([
        'success' => true,
        'message' => "🎉 分享碼已成功產生！限時 1 分鐘，最多供 3 人使用。",
        'code' => $code,
        'name' => $mazeName,
        'spec' => "{$cols}×{$rows}",
        'maxUses' => $maxUses,
        'usedCount' => 0,
        'expiresAt' => $realExpiresAt,
        'durationSec' => $durationSec
    ]);
    exit;
}

// ============================================================
// 2. 兌換分享碼並載入迷宮 (初級、中級、高級皆可使用)
// ============================================================
if ($action === 'redeem') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '請使用 POST 方法']);
        exit;
    }

    if (!$isLoggedIn) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'requireLogin' => true,
            'message' => '請先登入帳號以使用分享碼載入迷宮！'
        ]);
        exit;
    }

    $code = strtoupper(trim($jsonBody['code'] ?? $_POST['code'] ?? ''));
    if (empty($code)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '請輸入分享碼！']);
        exit;
    }

    // 查詢分享碼資料 (使用 MySQL NOW() 精準比對過期狀態)
    $stmt = $db->prepare("SELECT id, user_id, maze_name, grid_rows, grid_cols, maze_data, max_uses, used_count, expires_at, (NOW() > expires_at) AS is_expired FROM `share_codes` WHERE code = ? LIMIT 1");
    $stmt->bind_param('s', $code);
    $stmt->execute();
    $res = $stmt->get_result();
    $share = $res->fetch_assoc();
    $stmt->close();

    if (!$share) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => '查無此分享碼，請確認是否輸入正確！']);
        exit;
    }

    // 檢查是否超過 1 分鐘有效時間
    if (!empty($share['is_expired'])) {
        http_response_code(410);
        echo json_encode(['success' => false, 'message' => '此分享碼已逾期失效（限時 1 分鐘）！請請對方重新產生。']);
        exit;
    }

    // 檢查使用次數是否已滿 3 人
    if (intval($share['used_count']) >= intval($share['max_uses'])) {
        http_response_code(410);
        echo json_encode(['success' => false, 'message' => '此分享碼已達 3 人使用上限，無法再次使用！']);
        exit;
    }

    // 原子操作更新使用次數
    $upStmt = $db->prepare("UPDATE `share_codes` SET used_count = used_count + 1 WHERE id = ? AND used_count < max_uses AND expires_at > NOW()");
    $upStmt->bind_param('i', $share['id']);
    $upStmt->execute();
    $affected = $upStmt->affected_rows;
    $upStmt->close();

    if ($affected <= 0) {
        http_response_code(410);
        echo json_encode(['success' => false, 'message' => '該分享碼剛剛已達使用人數上限或已逾期！']);
        exit;
    }

    $mazeData = json_decode($share['maze_data'], true);
    if (!$mazeData) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => '解析分享迷宮資料失敗！']);
        exit;
    }

    $newUsedCount = intval($share['used_count']) + 1;

    echo json_encode([
        'success' => true,
        'message' => "🎉 成功載入分享迷宮【{$share['maze_name']}】({$share['grid_cols']}×{$share['grid_rows']})！(目前使用人數：{$newUsedCount}/{$share['max_uses']})",
        'name' => $share['maze_name'],
        'gridRows' => intval($share['grid_rows']),
        'gridCols' => intval($share['grid_cols']),
        'data' => $mazeData,
        'usedCount' => $newUsedCount,
        'maxUses' => intval($share['max_uses'])
    ]);
    exit;
}

// ============================================================
// 3. 查詢分享碼即時狀態 (供產生者彈窗倒數與人數更新)
// ============================================================
if ($action === 'status') {
    $code = strtoupper(trim($_GET['code'] ?? ''));
    if (empty($code)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '缺少分享碼參數']);
        exit;
    }

    $stmt = $db->prepare("SELECT id, user_id, maze_name, max_uses, used_count, expires_at, GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), expires_at)) AS remain_sec, (NOW() > expires_at) AS is_expired FROM `share_codes` WHERE code = ? LIMIT 1");
    $stmt->bind_param('s', $code);
    $stmt->execute();
    $res = $stmt->get_result();
    $share = $res->fetch_assoc();
    $stmt->close();

    if (!$share) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => '查無此分享碼']);
        exit;
    }

    $remainSec = intval($share['remain_sec']);
    $isExpired = !empty($share['is_expired']) || ($remainSec <= 0);
    $isFull = (intval($share['used_count']) >= intval($share['max_uses']));

    echo json_encode([
        'success' => true,
        'code' => $code,
        'usedCount' => intval($share['used_count']),
        'maxUses' => intval($share['max_uses']),
        'remainSec' => $remainSec,
        'isExpired' => $isExpired,
        'isFull' => $isFull
    ]);
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'message' => '未知的操作 (支援 action: create, redeem, status)']);
