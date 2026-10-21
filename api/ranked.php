<?php
/**
 * 排位賽 API (取得隨機官方地圖 / 提交成績 / 排行榜查詢)
 */
require_once dirname(__DIR__) . '/includes/api_bootstrap.php';

$allowedSizes = [
    '10x10' => ['dim' => 10, 'limitMs' => 60 * 1000, 'desc' => '1 分鐘 (60秒)'],
    '15x15' => ['dim' => 15, 'limitMs' => 180 * 1000, 'desc' => '3 分鐘 (180秒)'],
    '20x20' => ['dim' => 20, 'limitMs' => 20 * 60 * 1000, 'desc' => '20 分鐘 (1200秒)'],
    '25x25' => ['dim' => 25, 'limitMs' => 30 * 60 * 1000, 'desc' => '30 分鐘 (1800秒)'],
    '30x30' => ['dim' => 30, 'limitMs' => 40 * 60 * 1000, 'desc' => '40 分鐘 (2400秒)'],
    'apex' => ['dim' => 50, 'limitMs' => 60 * 60 * 1000, 'desc' => '60 分鐘 (3600秒)'],
    'special' => ['dim' => 30, 'limitMs' => 40 * 60 * 1000, 'desc' => '40 分鐘 (2400秒)']
];

$db = connectDbOrExit();

/**
 * 取得排位賽地圖之自訂名稱（若創作者有命名）
 */
function getRankedMapCustomName(array $mapData): string {
    if (!empty($mapData['customName'])) {
        return trim($mapData['customName']);
    }
    if (!empty($mapData['name']) && preg_match('/\(([^)]+)\)$/', trim($mapData['name']), $matches)) {
        $candidate = trim($matches[1]);
        if (!str_starts_with($candidate, '由 ') && !str_ends_with($candidate, '發布') && !str_ends_with($candidate, '提供')) {
            return $candidate;
        }
    }
    return '';
}

// 1. 取得隨機排位賽地圖
if ($action === 'get_map') {
    $size = $_GET['size'] ?? '10x10';
    if (!isset($allowedSizes[$size])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '無效的排位賽規格，僅支援 10x10, 15x15, 20x20, 25x25, 30x30, special 特殊賽以及 apex 巔峰賽']);
        exit;
    }

    if (empty($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'requireLogin' => true,
            'message' => '🔒 排位賽需要登入帳號方可出戰與記錄天梯排名！'
        ]);
        exit;
    }

    $mapDir = dirname(__DIR__) . "/data/ranked_maps/{$size}";
    $mapFiles = glob("{$mapDir}/map_*.json");

    if (empty($mapFiles)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => "找不到 {$size} 的官方排位賽地圖"]);
        exit;
    }

    // 隨機抽選一張地圖
    $chosenFile = $mapFiles[array_rand($mapFiles)];
    $mapContent = file_get_contents($chosenFile);
    $mapData = json_decode($mapContent, true);

    if (!$mapData) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => '解析地圖資料失敗']);
        exit;
    }

    $customName = getRankedMapCustomName($mapData);
    $defaultName = ($size === 'special') ? "特殊排位賽官方地圖" : (($size === 'apex') ? "巔峰排位賽官方地圖" : "{$size} 官方排位賽地圖");
    $mapName = $mapData['name'] ?? $defaultName;
    $displayName = !empty($customName) ? $customName : $mapName;

    echo json_encode([
        'success' => true,
        'size' => $size,
        'mapId' => $mapData['mapId'] ?? basename($chosenFile, '.json'),
        'mapName' => $mapName,
        'customName' => $customName,
        'displayName' => $displayName,
        'timeLimitMs' => $allowedSizes[$size]['limitMs'],
        'timeLimitDesc' => $allowedSizes[$size]['desc'],
        'mapData' => array_merge($mapData, ['customName' => $customName, 'displayName' => $displayName])
    ]);
    exit;
}

// 2. 提交完賽成績
if ($action === 'submit_score') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '請使用 POST 方法']);
        exit;
    }

    if (empty($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'requireLogin' => true, 'message' => '請先登入帳號！']);
        exit;
    }

    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true) ?: [];

    $size = $payload['size'] ?? $payload['grid_size'] ?? '';
    $mapId = trim($payload['map_id'] ?? $payload['mapId'] ?? 'map_1');
    $timeUsedMs = intval($payload['time_used_ms'] ?? 0);
    $timeRemainMs = intval($payload['time_remain_ms'] ?? 0);

    if (!isset($allowedSizes[$size]) || $timeUsedMs <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '無效的成績資料']);
        exit;
    }

    $userId = intval($_SESSION['user_id']);

    // 檢查目前此用戶在該規格是否已有紀錄 (每個帳號只保留一筆個人最佳成績)
    $chkStmt = $db->prepare("SELECT id, time_used_ms, time_remain_ms FROM `rankings` WHERE user_id = ? AND grid_size = ? LIMIT 1");
    $chkStmt->bind_param('is', $userId, $size);
    $chkStmt->execute();
    $chkRes = $chkStmt->get_result();
    $existing = $chkRes->fetch_assoc();
    $chkStmt->close();

    $isBest = false;
    $recordId = null;
    $message = '';

    if ($existing) {
        $existingTime = intval($existing['time_used_ms']);
        if ($timeUsedMs < $existingTime) {
            // 打破歷史最佳紀錄！更新為全新最佳成績
            $upStmt = $db->prepare("UPDATE `rankings` SET map_id = ?, time_used_ms = ?, time_remain_ms = ?, created_at = NOW() WHERE id = ?");
            $upStmt->bind_param('siii', $mapId, $timeUsedMs, $timeRemainMs, $existing['id']);
            $upStmt->execute();
            $upStmt->close();

            $isBest = true;
            $recordId = intval($existing['id']);
            $bestTimeMs = $timeUsedMs;
            $diffSec = number_format(($existingTime - $timeUsedMs) / 1000, 2);
            $message = "🔥 太強了！成功刷新個人最佳紀錄（進步 {$diffSec} 秒）！已更新至天梯排行榜！";
        } else {
            // 未能打破歷史最佳紀錄，天梯榜保留原最佳成績，不重複覆蓋
            $isBest = false;
            $recordId = intval($existing['id']);
            $bestTimeMs = $existingTime;
            $diffSec = number_format(($timeUsedMs - $existingTime) / 1000, 2);
            $message = "完賽！本次耗時未超過您的歷史最佳紀錄 (+{$diffSec} 秒)，天梯排行榜保留您的最佳成績！";
        }
    } else {
        // 首次登錄該規格成績
        $inStmt = $db->prepare("INSERT INTO `rankings` (user_id, grid_size, map_id, time_used_ms, time_remain_ms, created_at) VALUES (?, ?, ?, ?, ?, NOW())");
        $inStmt->bind_param('issii', $userId, $size, $mapId, $timeUsedMs, $timeRemainMs);
        if (!$inStmt->execute()) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => '寫入成績失敗：' . $inStmt->error]);
            exit;
        }
        $recordId = $inStmt->insert_id;
        $inStmt->close();

        $isBest = true;
        $bestTimeMs = $timeUsedMs;
        $message = "🎉 恭喜！排位賽成績已成功登錄天梯排行榜！";
    }

    // 計算當前該使用者的個人最佳成績在全服中的即時天梯排名 (每位選手只佔一位，無重複帳號)
    $rankStmt = $db->prepare("SELECT COUNT(*) + 1 AS user_rank FROM `rankings` WHERE grid_size = ? AND time_used_ms < ?");
    $rankStmt->bind_param('si', $size, $bestTimeMs);
    $rankStmt->execute();
    $rankRes = $rankStmt->get_result();
    $rankRow = $rankRes->fetch_assoc();
    $currentRank = intval($rankRow['user_rank'] ?? 1);
    $rankStmt->close();

    // 取得該級別天梯總選手人數 (不重複人數)
    $totalStmt = $db->prepare("SELECT COUNT(*) AS total FROM `rankings` WHERE grid_size = ?");
    $totalStmt->bind_param('s', $size);
    $totalStmt->execute();
    $totalRes = $totalStmt->get_result();
    $totalRow = $totalRes->fetch_assoc();
    $totalPlayers = intval($totalRow['total'] ?? 1);
    $totalStmt->close();

    echo json_encode([
        'success' => true,
        'message' => $message,
        'rank' => $currentRank,
        'totalPlayers' => $totalPlayers,
        'isBest' => $isBest,
        'bestTimeMs' => $bestTimeMs,
        'thisTimeMs' => $timeUsedMs,
        'recordId' => $recordId
    ]);
    exit;
}

// 3. 查詢天梯排行榜 (每位選手僅保留個人最佳成績，不重複帳號)
if ($action === 'leaderboard') {
    $size = $_GET['size'] ?? '10x10';
    if (!isset($allowedSizes[$size])) {
        $size = '10x10';
    }

    $stmt = $db->prepare("
        SELECT r.id, r.user_id, u.username, r.grid_size, r.map_id, r.time_used_ms, r.time_remain_ms, r.created_at
        FROM `rankings` r
        JOIN `users` u ON r.user_id = u.id
        WHERE r.grid_size = ?
        ORDER BY r.time_used_ms ASC, r.created_at ASC
        LIMIT 50
    ");
    $stmt->bind_param('s', $size);
    $stmt->execute();
    $res = $stmt->get_result();

    $list = [];
    $rank = 1;
    while ($row = $res->fetch_assoc()) {
        $list[] = [
            'rank' => $rank++,
            'userId' => intval($row['user_id']),
            'username' => $row['username'],
            'gridSize' => $row['grid_size'],
            'mapId' => $row['map_id'],
            'timeUsedMs' => intval($row['time_used_ms']),
            'timeRemainMs' => intval($row['time_remain_ms']),
            'createdAt' => $row['created_at']
        ];
    }
    $stmt->close();

    // 若有登入，查詢該用戶的個人最佳成績與最高排名
    $userBest = null;
    if (!empty($_SESSION['user_id'])) {
        $userId = intval($_SESSION['user_id']);
        $uStmt = $db->prepare("SELECT time_used_ms, time_remain_ms, map_id, created_at FROM `rankings` WHERE user_id = ? AND grid_size = ? LIMIT 1");
        $uStmt->bind_param('is', $userId, $size);
        $uStmt->execute();
        $uRes = $uStmt->get_result();
        if ($uRow = $uRes->fetch_assoc()) {
            $bestMs = intval($uRow['time_used_ms']);
            $rStmt = $db->prepare("SELECT COUNT(*) + 1 AS user_rank FROM `rankings` WHERE grid_size = ? AND time_used_ms < ?");
            $rStmt->bind_param('si', $size, $bestMs);
            $rStmt->execute();
            $rRes = $rStmt->get_result();
            $rRow = $rRes->fetch_assoc();
            $rStmt->close();

            $userBest = [
                'bestMs' => $bestMs,
                'remainMs' => intval($uRow['time_remain_ms']),
                'rank' => intval($rRow['user_rank'] ?? 1),
                'mapId' => $uRow['map_id'],
                'createdAt' => $uRow['created_at']
            ];
        }
        $uStmt->close();
    }

    // 若有登入，統計該用戶發布至排位圖庫的地圖數量 (全部 / 本級別，含已收錄與審核中)
    $myMapCount = null;
    if (!empty($_SESSION['user_id'])) {
        $userId = intval($_SESSION['user_id']);
        $myMapCount = ['total' => 0, 'size' => 0, 'pending' => 0, 'approved' => 0];

        $cntStmt = $db->prepare("SELECT status, size, COUNT(*) as c FROM `ranked_submissions` WHERE author_id = ? GROUP BY status, size");
        if ($cntStmt) {
            $cntStmt->bind_param('i', $userId);
            $cntStmt->execute();
            $cntRes = $cntStmt->get_result();
            $subTotals = [];
            while ($cRow = $cntRes->fetch_assoc()) {
                if ($cRow['status'] === 'pending') {
                    $myMapCount['pending'] += intval($cRow['c']);
                } elseif ($cRow['status'] === 'approved') {
                    $myMapCount['approved'] += intval($cRow['c']);
                }
                $subTotals[$cRow['size']] = ($subTotals[$cRow['size']] ?? 0) + intval($cRow['c']);
            }
            $cntStmt->close();
        }

        $diskCount = 0;
        $diskSizeCount = 0;
        foreach (glob(dirname(__DIR__) . '/data/ranked_maps/*/map_*.json') as $f) {
            $m = json_decode(file_get_contents($f), true);
            if (intval($m['authorId'] ?? 0) === $userId) {
                $diskCount++;
                if (basename(dirname($f)) === $size) $diskSizeCount++;
            }
        }

        $myMapCount['total'] = max($myMapCount['pending'] + $myMapCount['approved'], $diskCount + $myMapCount['pending']);
        $myMapCount['size'] = max($subTotals[$size] ?? 0, $diskSizeCount);
    }

    echo json_encode([
        'success' => true,
        'size' => $size,
        'allowedSizes' => array_keys($allowedSizes),
        'list' => $list,
        'userBest' => $userBest,
        'myMapCount' => $myMapCount
    ]);
    exit;
}

// 4. 發布練習賽迷宮至官方排位賽圖庫
if ($action === 'publish_map') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '請使用 POST 方法']);
        exit;
    }

    if (empty($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'requireLogin' => true, 'message' => '🔒 發布排位賽地圖需要登入帳號！請先登入。']);
        exit;
    }

    $userId = intval($_SESSION['user_id']);
    $uStmt = $db->prepare("SELECT role, username FROM `users` WHERE id = ? LIMIT 1");
    $uStmt->bind_param('i', $userId);
    $uStmt->execute();
    $uRow = $uStmt->get_result()->fetch_assoc();
    $uStmt->close();

    $role = $uRow['role'] ?? ROLE_JUNIOR;
    $username = $uRow['username'] ?? ($_SESSION['username'] ?? 'Anonymous');

    // 1. 初級使用者禁止上傳排位賽地圖
    if ($role === ROLE_JUNIOR) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => '🔒 權限限制：初級使用者不能上傳排位賽地圖！需由高級使用者提升為中級或高級使用者。'
        ]);
        exit;
    }

    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true) ?: [];

    $mapData = $payload['mapData'] ?? $payload;
    $rows = intval($mapData['gridSize']['rows'] ?? (isset($mapData['hWalls']) ? count($mapData['hWalls']) - 1 : 0));
    $cols = intval($mapData['gridSize']['cols'] ?? (isset($mapData['hWalls'][0]) ? count($mapData['hWalls'][0]) : 0));
    if ($cols !== $rows) {
        // 長方形地圖：歸類於「特殊排位賽」
        if (max($cols, $rows) > 30) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => "⚠️ 特殊排位賽規格限制：長方形地圖最大邊不能超過 30 格！目前為 {$cols}×{$rows}。"
            ]);
            exit;
        }
        if (min($cols, $rows) < 2) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => "⚠️ 地圖尺寸過小，最小邊至少需 2 格！目前為 {$cols}×{$rows}。"
            ]);
            exit;
        }
        $size = 'special';
    } else {
        // 正方形地圖
        if ($cols > 30) {
            if (in_array($cols, [35, 40, 45, 50])) {
                $size = 'apex';
            } else {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => "⚠️ 巔峰排位賽規格限制：正方形超大地圖僅支援 35×35、40×40、45×45、50×50 四種規格！目前為 {$cols}×{$rows}。"
                ]);
                exit;
            }
        } else {
            $size = "{$cols}x{$rows}";
            if (!isset($allowedSizes[$size])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => "⚠️ 規格不符：標準正方形官方排位賽僅支援 10×10、15×15、20×20、25×25、30×30 五種規格！目前為 {$size}。"
                ]);
                exit;
            }
        }
    }

    // 2. 中級使用者：每一類只能上傳 3 張，需由高級使用者審核
    if ($role === ROLE_INTERMEDIATE) {
        $subStmt = $db->prepare("SELECT COUNT(*) AS c FROM `ranked_submissions` WHERE author_id = ? AND size = ? AND status IN ('pending', 'approved')");
        $subStmt->bind_param('is', $userId, $size);
        $subStmt->execute();
        $subCount = intval($subStmt->get_result()->fetch_assoc()['c'] ?? 0);
        $subStmt->close();

        // 同步檢查磁碟官方題庫檔案中是否已有由該帳號發布的此規格地圖
        $diskCount = 0;
        foreach (glob(dirname(__DIR__) . "/data/ranked_maps/{$size}/map_*.json") as $f) {
            $m = json_decode(file_get_contents($f), true);
            if (intval($m['authorId'] ?? 0) === $userId) $diskCount++;
        }
        $totalMySizeMaps = max($subCount, $diskCount);

        if ($totalMySizeMaps >= 3) {
            http_response_code(400);
$sizeLabel = ($size === 'special') ? '特殊排位賽（長方形）' : (($size === 'apex') ? '巔峰排位賽（35~50）' : $size);
            echo json_encode([
                'success' => false,
                'message' => "⚠️ 達到上傳上限：中級使用者在每一類規格（{$sizeLabel}）最多只能上傳 3 張排位賽地圖！您目前已有 {$totalMySizeMaps} 張（含審核中與已通過）。"
            ]);
            exit;
        }
    }

    $hWalls = $mapData['hWalls'] ?? null;
    $vWalls = $mapData['vWalls'] ?? null;
    $start = $mapData['start'] ?? ['x' => 0, 'y' => $rows - 1];
    $goal = $mapData['goal'] ?? ['x' => $cols - 1, 'y' => 0];

    if (!$hWalls || !$vWalls) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '地圖資料格式不正確，缺少牆壁數據。']);
        exit;
    }

    // 後端嚴格執行 BFS 檢驗起點到終點的可解性
    $visited = array_fill(0, $rows, array_fill(0, $cols, false));
    $queue = [ ['x' => intval($start['x']), 'y' => intval($start['y'])] ];
    $visited[intval($start['y'])][intval($start['x'])] = true;
    $solvable = false;

    while (!empty($queue)) {
        $curr = array_shift($queue);
        if ($curr['x'] === intval($goal['x']) && $curr['y'] === intval($goal['y'])) {
            $solvable = true;
            break;
        }
        $cx = $curr['x'];
        $cy = $curr['y'];

        // 上 (y - 1)
        if ($cy > 0 && !$visited[$cy - 1][$cx] && empty($hWalls[$cy][$cx])) {
            $visited[$cy - 1][$cx] = true;
            $queue[] = ['x' => $cx, 'y' => $cy - 1];
        }
        // 下 (y + 1)
        if ($cy < $rows - 1 && !$visited[$cy + 1][$cx] && empty($hWalls[$cy + 1][$cx])) {
            $visited[$cy + 1][$cx] = true;
            $queue[] = ['x' => $cx, 'y' => $cy + 1];
        }
        // 左 (x - 1)
        if ($cx > 0 && !$visited[$cy][$cx - 1] && empty($vWalls[$cy][$cx])) {
            $visited[$cy][$cx - 1] = true;
            $queue[] = ['x' => $cx - 1, 'y' => $cy];
        }
        // 右 (x + 1)
        if ($cx < $cols - 1 && !$visited[$cy][$cx + 1] && empty($vWalls[$cy][$cx + 1])) {
            $visited[$cy][$cx + 1] = true;
            $queue[] = ['x' => $cx + 1, 'y' => $cy];
        }
    }

    if (!$solvable) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => '❌ 發布失敗：伺服器路徑運算檢驗此迷宮無法從起點到達終點！請修改內部牆壁確保有通行路徑。'
        ]);
        exit;
    }

    // 確定存放資料夾
    $mapDir = dirname(__DIR__) . "/data/ranked_maps/{$size}";
    if (!is_dir($mapDir)) {
        mkdir($mapDir, 0777, true);
    }

    $customName = trim($payload['name'] ?? '');

    // 中級使用者：進入審核隊列，需由高級使用者審核通過後才正式生效
    if ($role === ROLE_INTERMEDIATE) {
        $subPrefix = ($size === 'special') ? "特殊排位賽投稿 ({$cols}×{$rows})" : (($size === 'apex') ? "巔峰排位賽投稿 ({$cols}×{$rows})" : "{$size} 排位賽投稿");
        $finalName = !empty($customName) 
            ? "{$subPrefix} ({$customName})" 
            : "{$subPrefix} (由 {$username} 發布)";

        $submissionData = [
            'name' => $finalName,
            'customName' => $customName,
            'author' => $username,
            'authorId' => $userId,
            'gridSize' => ['rows' => $rows, 'cols' => $cols],
            'cellSizeCm' => 30,
            'wallHeightCm' => 15,
            'start' => $start,
            'goal' => $goal,
            'hWalls' => $hWalls,
            'vWalls' => $vWalls,
            'createdAt' => date('Y-m-d H:i:s')
        ];
        $subJson = json_encode($submissionData, JSON_UNESCAPED_UNICODE);

        $inSub = $db->prepare("INSERT INTO `ranked_submissions` (size, name, author_id, author_name, grid_rows, grid_cols, maze_data, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())");
        $inSub->bind_param('ssisiis', $size, $finalName, $userId, $username, $rows, $cols, $subJson);
        if (!$inSub->execute()) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => '儲存待審核地圖失敗：' . $inSub->error]);
            exit;
        }
        $subId = $inSub->insert_id;
        $inSub->close();

        $currentTotal = $totalMySizeMaps + 1;

        echo json_encode([
            'success' => true,
            'isPending' => true,
            'submissionId' => $subId,
            'size' => $size,
            'message' => "📤 地圖【{$finalName}】已成功送交審核！中級使用者上傳之地圖需由高級使用者審核通過後方能啟用。目前已上傳 {$currentTotal}/3 張（{$size} 級別）。",
            'mySizeCount' => $currentTotal,
            'maxPerSize' => 3
        ]);
        exit;
    }

    // 高級使用者 (senior)：直接發布入庫
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

    $offPrefix = ($size === 'special') ? "特殊排位賽官方地圖 ({$cols}×{$rows})" : (($size === 'apex') ? "巔峰排位賽官方地圖 ({$cols}×{$rows})" : "{$size} 官方排位賽地圖");
    $finalName = !empty($customName) 
        ? "{$offPrefix} #{$nextIndex} ({$customName})" 
        : "{$offPrefix} #{$nextIndex} (由 {$username} 發布)";

    $fileData = [
        'mapId' => $newMapId,
        'name' => $finalName,
            'customName' => $customName,
        'author' => $username,
        'authorId' => $userId,
        'gridSize' => ['rows' => $rows, 'cols' => $cols],
        'cellSizeCm' => 30,
        'wallHeightCm' => 15,
        'start' => $start,
        'goal' => $goal,
        'hWalls' => $hWalls,
        'vWalls' => $vWalls,
        'createdAt' => date('Y-m-d H:i:s')
    ];

    $filePath = "{$mapDir}/{$newMapId}.json";
    $saved = file_put_contents($filePath, json_encode($fileData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    if (!$saved) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => '儲存地圖檔案至排位圖庫失敗，請確認檔案寫入權限。']);
        exit;
    }

    // 紀錄至 submissions 表標記為 approved
    $subJson = json_encode($fileData, JSON_UNESCAPED_UNICODE);
    $inSub = $db->prepare("INSERT INTO `ranked_submissions` (size, name, author_id, author_name, grid_rows, grid_cols, maze_data, status, reviewer_id, reviewed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, NOW(), NOW())");
    $inSub->bind_param('ssisiisi', $size, $finalName, $userId, $username, $rows, $cols, $subJson, $userId);
    @$inSub->execute();
    $subId = $inSub->insert_id;
    @$inSub->close();

    // 將產生的 submissionId 補充寫入官方地圖檔案
    if ($subId > 0) {
        $fileData['submissionId'] = $subId;
        @file_put_contents($filePath, json_encode($fileData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    $totalMaps = count(glob("{$mapDir}/map_*.json"));

    echo json_encode([
        'success' => true,
        'isPending' => false,
        'message' => "🎉 成功發布！迷宮已正式加入 {$size} 官方排位賽地圖庫（地圖 #{$nextIndex}）！",
        'mapId' => $newMapId,
        'size' => $size,
        'totalMaps' => $totalMaps
    ]);
    exit;
}

// 5. 列出所有排位賽地圖 (供地圖總覽預覽)
if ($action === 'list_maps') {
    if (empty($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'requireLogin' => true, 'message' => '🔒 查看排位賽地圖總覽需要登入帳號！']);
        exit;
    }

    $maps = [];
    foreach (array_keys($allowedSizes) as $size) {
        $maps[$size] = [];
        $files = glob(dirname(__DIR__) . "/data/ranked_maps/{$size}/map_*.json");
        natsort($files);
        foreach ($files as $f) {
            $m = json_decode(file_get_contents($f), true);
            if ($m) {
                $m['mapId'] = basename($f, '.json');
                $m['customName'] = getRankedMapCustomName($m);
                $maps[$size][] = $m;
            }
        }
    }

    echo json_encode(['success' => true, 'maps' => $maps]);
    exit;
}

// 6. 取得當前用戶發布的所有排位賽地圖（含地圖規格、審核狀態與 2D 迷宮結構數據）
if ($action === 'my_published_maps') {
    if (empty($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'requireLogin' => true, 'message' => '🔒 請先登入帳號以查看您發布的排位賽地圖！']);
        exit;
    }

    $userId = intval($_SESSION['user_id']);

    // 1. 從 ranked_submissions 表查詢該用戶所有投稿紀錄（含 pending, approved, rejected）
    $stmt = $db->prepare("SELECT id, size, name, author_id, author_name, grid_rows, grid_cols, maze_data, status, reviewer_id, reviewed_at, created_at FROM `ranked_submissions` WHERE author_id = ? ORDER BY created_at DESC");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $subRes = $stmt->get_result();

    $myMaps = [];
    $seenDiskMaps = [];

    while ($sub = $subRes->fetch_assoc()) {
        $mazeData = json_decode($sub['maze_data'], true) ?: [];
        $cName = getRankedMapCustomName(['customName' => $mazeData['customName'] ?? '', 'name' => $sub['name']]);
        $rows = intval($sub['grid_rows'] ?? ($mazeData['gridSize']['rows'] ?? 10));
        $cols = intval($sub['grid_cols'] ?? ($mazeData['gridSize']['cols'] ?? 10));
        $hWalls = $mazeData['hWalls'] ?? [];
        $vWalls = $mazeData['vWalls'] ?? [];
        $start = $mazeData['start'] ?? ['x' => 0, 'y' => $rows - 1];
        $goal = $mazeData['goal'] ?? ['x' => $cols - 1, 'y' => 0];

        // 計算牆面段數
        $wallCount = 0;
        foreach ($hWalls as $r) { foreach ($r as $w) { if (!empty($w)) $wallCount++; } }
        foreach ($vWalls as $r) { foreach ($r as $w) { if (!empty($w)) $wallCount++; } }

        $size = $sub['size'];
        $tierName = ($size === 'special') ? "特殊賽（長方形 {$cols}×{$rows}）" : (($size === 'apex') ? "巔峰賽（超大型 {$cols}×{$rows}）" : "{$size} 標準排位賽");
        if ($size !== 'special' && $size !== 'apex') {
            $tierName = str_replace('x', ' × ', $size);
        }

        $item = [
            'id' => intval($sub['id']),
            'submissionId' => intval($sub['id']),
            'size' => $size,
            'tierName' => $tierName,
            'name' => $sub['name'],
            'customName' => $cName,
            'displayName' => !empty($cName) ? $cName : $sub['name'],
            'author' => $sub['author_name'],
            'authorId' => intval($sub['author_id']),
            'gridSize' => ['rows' => $rows, 'cols' => $cols],
            'totalWidthCm' => $cols * 30,
            'totalHeightCm' => $rows * 30,
            'wallCount' => $wallCount,
            'start' => $start,
            'goal' => $goal,
            'hWalls' => $hWalls,
            'vWalls' => $vWalls,
            'status' => $sub['status'], // 'pending', 'approved', 'rejected'
            'reviewedAt' => $sub['reviewed_at'],
            'createdAt' => $sub['created_at'],
            'mapId' => $mazeData['mapId'] ?? null
        ];

        // 如果已核准，嘗試找到對應的官方檔案 ID
        if ($sub['status'] === 'approved') {
            $matchedFile = null;
            foreach (glob(dirname(__DIR__) . "/data/ranked_maps/{$size}/map_*.json") as $f) {
                $m = json_decode(file_get_contents($f), true);
                if (intval($m['authorId'] ?? 0) === $userId) {
                    if (($m['name'] ?? '') === ($sub['name'] ?? '') || ($cName !== '' && getRankedMapCustomName($m) === $cName)) {
                        $matchedFile = basename($f, '.json');
                        $seenDiskMaps[$f] = true;
                        break;
                    }
                }
            }
            if ($matchedFile) {
                $item['mapId'] = $matchedFile;
            }
        }

        $myMaps[] = $item;
    }
    $stmt->close();

    // 2. 補充：檢查磁碟中 authorId 為此用戶、但未被上述 submission 關聯到的官方排位圖
    foreach (glob(dirname(__DIR__) . '/data/ranked_maps/*/map_*.json') as $f) {
        if (isset($seenDiskMaps[$f])) continue;
        $m = json_decode(file_get_contents($f), true);
        if (!$m || intval($m['authorId'] ?? 0) !== $userId) continue;

        $fBase = basename($f, '.json');
        $size = basename(dirname($f));
        $alreadyExists = false;
        foreach ($myMaps as $existingItem) {
            if ($existingItem['size'] === $size && ($existingItem['mapId'] === $fBase || $existingItem['name'] === ($m['name'] ?? ''))) {
                $alreadyExists = true;
                break;
            }
        }
        if ($alreadyExists) continue;

        $cName = getRankedMapCustomName($m);
        $rows = intval($m['gridSize']['rows'] ?? (isset($m['hWalls']) ? count($m['hWalls']) - 1 : 10));
        $cols = intval($m['gridSize']['cols'] ?? (isset($m['hWalls'][0]) ? count($m['hWalls'][0]) : 10));
        $hWalls = $m['hWalls'] ?? [];
        $vWalls = $m['vWalls'] ?? [];
        $start = $m['start'] ?? ['x' => 0, 'y' => $rows - 1];
        $goal = $m['goal'] ?? ['x' => $cols - 1, 'y' => 0];

        $wallCount = 0;
        foreach ($hWalls as $r) { foreach ($r as $w) { if (!empty($w)) $wallCount++; } }
        foreach ($vWalls as $r) { foreach ($r as $w) { if (!empty($w)) $wallCount++; } }

        $tierName = ($size === 'special') ? "特殊賽（長方形 {$cols}×{$rows}）" : (($size === 'apex') ? "巔峰賽（超大型 {$cols}×{$rows}）" : "{$size} 標準排位賽");
        if ($size !== 'special' && $size !== 'apex') {
            $tierName = str_replace('x', ' × ', $size);
        }

        $myMaps[] = [
            'id' => null,
            'mapId' => $fBase,
            'size' => $size,
            'tierName' => $tierName,
            'name' => $m['name'] ?? "{$size} 官方排位賽地圖",
            'customName' => $cName,
            'displayName' => !empty($cName) ? $cName : ($m['name'] ?? $fBase),
            'author' => $m['author'] ?? ($_SESSION['username'] ?? 'User'),
            'authorId' => $userId,
            'gridSize' => ['rows' => $rows, 'cols' => $cols],
            'totalWidthCm' => $cols * 30,
            'totalHeightCm' => $rows * 30,
            'wallCount' => $wallCount,
            'start' => $start,
            'goal' => $goal,
            'hWalls' => $hWalls,
            'vWalls' => $vWalls,
            'status' => 'approved',
            'reviewedAt' => $m['createdAt'] ?? null,
            'createdAt' => $m['createdAt'] ?? null
        ];
    }

    echo json_encode([
        'success' => true,
        'count' => count($myMaps),
        'maps' => $myMaps
    ]);
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'message' => '未知的操作 (支援 action: get_map, submit_score, leaderboard, publish_map, list_maps, my_published_maps)']);

