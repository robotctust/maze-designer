<?php
/**
 * 高級管理者專屬 API (初中級帳號管理 / 排位賽地圖審核 / 刪除排位地圖)
 */
require_once dirname(__DIR__) . '/includes/api_bootstrap.php';

$isLoggedIn = !empty($_SESSION['user_id']);
$userId = $isLoggedIn ? intval($_SESSION['user_id']) : 0;

$db = connectDbOrExit();

if (!$isLoggedIn) {
    http_response_code(401);
    echo json_encode(['success' => false, 'requireLogin' => true, 'message' => '請先登入高級管理員帳號！']);
    exit;
}

// 嚴格驗證必須為高級使用者 (senior)
$stmt = $db->prepare("SELECT role, username FROM `users` WHERE id = ? LIMIT 1");
$stmt->bind_param('i', $userId);
$stmt->execute();
$uRow = $stmt->get_result()->fetch_assoc();
$stmt->close();

$myRole = $uRow['role'] ?? ROLE_JUNIOR;
if ($myRole !== ROLE_SENIOR) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => '🔒 權限不足：此頁面與功能僅限【高級使用者】存取！']);
    exit;
}

// ============================================================
// 1. 取得未審核地圖數量 (Header 徽章)
// ============================================================
if ($action === 'pending_count') {
    $res = $db->query("SELECT COUNT(*) AS c FROM `ranked_submissions` WHERE status = 'pending'");
    $cnt = intval($res->fetch_assoc()['c'] ?? 0);
    echo json_encode(['success' => true, 'count' => $cnt]);
    exit;
}

// ============================================================
// 2. 帳號管理清單 (高級帳號看不見，僅列出初級與中級帳號)
// ============================================================
if ($action === 'list_users') {
    // 依使用者需求：高級帳號看不見，只列出初級與中級帳號
    $sql = "SELECT id, username, role, created_at, last_login 
            FROM `users` 
            WHERE role != 'senior' 
            ORDER BY created_at DESC, id DESC";
    $res = $db->query($sql);
    $users = [];
    while ($row = $res->fetch_assoc()) {
        $users[] = [
            'id' => intval($row['id']),
            'username' => $row['username'],
            'role' => $row['role'] ?: ROLE_JUNIOR,
            'roleTitle' => getRoleTitle($row['role'] ?: ROLE_JUNIOR),
            'createdAt' => $row['created_at'],
            'lastLogin' => $row['last_login']
        ];
    }

    echo json_encode(['success' => true, 'users' => $users]);
    exit;
}

// ============================================================
// 3. 修改帳號權限 (可將初級升中級、中級降初級，禁止修改高級帳號)
// ============================================================
if ($action === 'update_user_role') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '請使用 POST 方法']);
        exit;
    }

    $targetUserId = intval($jsonBody['userId'] ?? 0);
    $newRole = trim($jsonBody['role'] ?? '');

    if ($targetUserId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '請指定有效的使用者編號']);
        exit;
    }

    // 僅允許設定為 junior 或 intermediate
    if ($newRole !== ROLE_JUNIOR && $newRole !== ROLE_INTERMEDIATE) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '無效的權限角色，僅能設定為【初級】或【中級】！']);
        exit;
    }

    // 安全防護：禁止更改高級帳號 (例如 chao) 的權限
    $chk = $db->prepare("SELECT username, role FROM `users` WHERE id = ? LIMIT 1");
    $chk->bind_param('i', $targetUserId);
    $chk->execute();
    $tUser = $chk->get_result()->fetch_assoc();
    $chk->close();

    if (!$tUser) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => '查無該使用者帳號']);
        exit;
    }

    if ($tUser['role'] === ROLE_SENIOR) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => '高級使用者帳號為系統管理員，禁止在此變更！']);
        exit;
    }

    $up = $db->prepare("UPDATE `users` SET role = ? WHERE id = ?");
    $up->bind_param('si', $newRole, $targetUserId);
    if (!$up->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => '更新權限失敗：' . $up->error]);
        exit;
    }
    $up->close();

    $roleTitle = getRoleTitle($newRole);
    echo json_encode([
        'success' => true,
        'message' => "已成功將帳號【{$tUser['username']}】權限更新為【{$roleTitle}】！",
        'userId' => $targetUserId,
        'newRole' => $newRole,
        'newRoleTitle' => $roleTitle
    ]);
    exit;
}

// ============================================================
// 4. 取得待審核排位賽地圖列表 (含地圖 2D 數據)
// ============================================================
if ($action === 'list_submissions') {
    $filterStatus = $_GET['status'] ?? 'pending';
    if ($filterStatus === 'all') {
        $stmt = $db->prepare("SELECT id, size, name, author_id, author_name, grid_rows, grid_cols, maze_data, status, reviewer_id, reviewed_at, created_at FROM `ranked_submissions` ORDER BY status = 'pending' DESC, created_at DESC");
    } else {
        $stmt = $db->prepare("SELECT id, size, name, author_id, author_name, grid_rows, grid_cols, maze_data, status, reviewer_id, reviewed_at, created_at FROM `ranked_submissions` WHERE status = ? ORDER BY created_at DESC");
        $stmt->bind_param('s', $filterStatus);
    }

    $stmt->execute();
    $res = $stmt->get_result();
    $list = [];
    while ($row = $res->fetch_assoc()) {
        $mazeObj = json_decode($row['maze_data'], true);
        $list[] = [
            'id' => intval($row['id']),
            'size' => $row['size'],
            'name' => $row['name'],
            'authorId' => intval($row['author_id']),
            'authorName' => $row['author_name'],
            'rows' => intval($row['grid_rows']),
            'cols' => intval($row['grid_cols']),
            'status' => $row['status'],
            'createdAt' => $row['created_at'],
            'reviewedAt' => $row['reviewed_at'],
            'mazeData' => $mazeObj
        ];
    }
    $stmt->close();

    echo json_encode(['success' => true, 'submissions' => $list]);
    exit;
}

// ============================================================
// 5. 審核排位賽地圖 (核准入庫 / 退回駁回)
// ============================================================
if ($action === 'review_submission') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '請使用 POST 方法']);
        exit;
    }

    $subId = intval($jsonBody['submissionId'] ?? 0);
    $decision = trim($jsonBody['decision'] ?? ''); // 'approve' 或 'reject'

    if ($subId <= 0 || ($decision !== 'approve' && $decision !== 'reject')) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '無效的審核參數']);
        exit;
    }

    $stmt = $db->prepare("SELECT id, size, name, author_id, author_name, grid_rows, grid_cols, maze_data, status FROM `ranked_submissions` WHERE id = ? LIMIT 1");
    $stmt->bind_param('i', $subId);
    $stmt->execute();
    $sub = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$sub) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => '找不到該待審核地圖']);
        exit;
    }

    if ($sub['status'] === 'approved') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '此地圖已通過審核，無須重複操作！']);
        exit;
    }

    if ($decision === 'reject') {
        $up = $db->prepare("UPDATE `ranked_submissions` SET status = 'rejected', reviewer_id = ?, reviewed_at = NOW() WHERE id = ?");
        $up->bind_param('ii', $userId, $subId);
        $up->execute();
        $up->close();

        echo json_encode([
            'success' => true,
            'status' => 'rejected',
            'message' => "已退回地圖【{$sub['name']}】的排位賽發布申請。"
        ]);
        exit;
    }

    // 核准通過：將地圖正式加入官方排位賽檔案庫
    $size = $sub['size'];
    $mapDir = dirname(__DIR__) . "/data/ranked_maps/{$size}";
    if (!is_dir($mapDir)) {
        @mkdir($mapDir, 0777, true);
    }

    // 計算下一個檔案編號
    $existingFiles = glob("{$mapDir}/map_*.json");
    $maxIndex = 0;
    foreach ($existingFiles as $f) {
        $base = basename($f, '.json');
        if (preg_match('/map_(\d+)/', $base, $matches)) {
            $num = intval($matches[1]);
            if ($num > $maxIndex) $maxIndex = $num;
        }
    }
    $nextIndex = $maxIndex + 1;
    $newMapId = "map_{$nextIndex}";

    $mazeData = json_decode($sub['maze_data'], true);
    $finalOfficialName = "{$size} 官方排位賽地圖 #{$nextIndex} (由 {$sub['author_name']} 提供)";

    $fileData = [
        'mapId' => $newMapId,
        'name' => $finalOfficialName,
        'author' => $sub['author_name'],
        'authorId' => intval($sub['author_id']),
        'gridSize' => $mazeData['gridSize'] ?? ['rows' => intval($sub['grid_rows']), 'cols' => intval($sub['grid_cols'])],
        'cellSizeCm' => 30,
        'wallHeightCm' => 15,
        'start' => $mazeData['start'] ?? ['x' => 0, 'y' => intval($sub['grid_rows']) - 1],
        'goal' => $mazeData['goal'] ?? ['x' => intval($sub['grid_cols']) - 1, 'y' => 0],
        'hWalls' => $mazeData['hWalls'],
        'vWalls' => $mazeData['vWalls'],
        'approvedBy' => $userId,
        'createdAt' => date('Y-m-d H:i:s')
    ];

    $filePath = "{$mapDir}/{$newMapId}.json";
    $saved = @file_put_contents($filePath, json_encode($fileData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    if (!$saved) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => '寫入官方地圖檔案失敗，請檢查資料夾權限！']);
        exit;
    }

    // 更新資料庫狀態為 approved
    $up = $db->prepare("UPDATE `ranked_submissions` SET status = 'approved', reviewer_id = ?, reviewed_at = NOW() WHERE id = ?");
    $up->bind_param('ii', $userId, $subId);
    $up->execute();
    $up->close();

    $totalMaps = count(glob("{$mapDir}/map_*.json"));

    echo json_encode([
        'success' => true,
        'status' => 'approved',
        'message' => "🎉 審核通過！已將地圖正式收錄至 {$size} 官方排位賽題庫（地圖 #{$nextIndex}，全服可抽）！",
        'mapId' => $newMapId,
        'size' => $size,
        'totalMaps' => $totalMaps
    ]);
    exit;
}

// ============================================================
// 6. 刪除排位賽地圖 (官方題庫檔案刪除 / 投稿紀錄刪除)
// ============================================================
if ($action === 'delete_ranked_map') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '請使用 POST 方法']);
        exit;
    }

    $size = trim($jsonBody['size'] ?? '');
    $mapId = trim($jsonBody['mapId'] ?? '');
    $submissionId = intval($jsonBody['submissionId'] ?? 0);

    // 情況 A：刪除已存在官方題庫的檔案 (例如 map_3.json)
    if (!empty($size) && !empty($mapId)) {
        $allowedSizes = ['10x10', '15x15', '20x20', '25x25', '30x30'];
        if (!in_array($size, $allowedSizes)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => '無效的地圖規格']);
            exit;
        }

        $filePath = dirname(__DIR__) . "/data/ranked_maps/{$size}/{$mapId}.json";
        if (!file_exists($filePath)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => "找不到地圖檔案：{$size}/{$mapId}.json"]);
            exit;
        }

        // 安全限制：每個規格至少保留 1 張地圖，避免排位賽無圖可抽
        $allFiles = glob(dirname(__DIR__) . "/data/ranked_maps/{$size}/map_*.json");
        if (count($allFiles) <= 1) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "⚠️ 無法刪除：{$size} 級別至少需保留 1 張官方地圖以供排位賽抽題！"]);
            exit;
        }

        if (!@unlink($filePath)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => '刪除實體檔案失敗，請檢查檔案系統權限！']);
            exit;
        }

        $remainingCount = count(glob(dirname(__DIR__) . "/data/ranked_maps/{$size}/map_*.json"));

        echo json_encode([
            'success' => true,
            'message' => "🗑️ 已成功刪除官方排位賽地圖【{$size}/{$mapId}】！目前該級別剩餘 {$remainingCount} 張地圖。",
            'size' => $size,
            'mapId' => $mapId,
            'remainingCount' => $remainingCount
        ]);
        exit;
    }

    // 情況 B：刪除投稿紀錄
    if ($submissionId > 0) {
        $del = $db->prepare("DELETE FROM `ranked_submissions` WHERE id = ?");
        $del->bind_param('i', $submissionId);
        $del->execute();
        $del->close();

        echo json_encode([
            'success' => true,
            'message' => '已成功刪除該排位地圖投稿紀錄！'
        ]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => '缺少必要的刪除參數 (size+mapId 或 submissionId)']);
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'message' => '未知的管理員操作']);
