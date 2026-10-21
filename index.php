<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>10×10 3D 迷宮模擬與自訂牆壁規劃器</title>
<?php foreach (['base', 'topbar', 'editor', 'simulator', 'ranked', 'dialogs', 'admin', 'ranked-entry', 'leaderboard'] as $css): ?>
    <link rel="stylesheet" href="assets/css/<?= $css ?>.css?v=<?= filemtime(__DIR__ . "/assets/css/$css.css") ?>">
<?php endforeach; ?>
</head>
<body>

    <?php include __DIR__ . '/views/topbar.php'; ?>

    <!-- 設計窗口：上方編輯列，下方左側 2D 編輯器、右側 3D 模擬視窗，以分割線隔開 -->
    <div class="workspace">
        <?php include __DIR__ . '/views/editbar.php'; ?>

        <div class="app-container">
            <?php include __DIR__ . '/views/editor-panel.php'; ?>

            <?php include __DIR__ . '/views/ranked-lobby.php'; ?>

            <?php include __DIR__ . '/views/simulator-panel.php'; ?>
        </div>
    </div>

    <!-- 提示訊息 -->
    <div class="toast" id="toastMsg" role="status" aria-live="polite"></div>

    <?php include __DIR__ . '/views/dialogs/auth.php'; ?>

    <?php include __DIR__ . '/views/dialogs/ranked.php'; ?>

    <?php include __DIR__ . '/views/dialogs/maps.php'; ?>

    <?php include __DIR__ . '/views/dialogs/admin.php'; ?>

    <?php include __DIR__ . '/views/dialogs/confirm.php'; ?>

    <!-- 腳本引入 -->
    <script src="assets/js/lib/three.min.js"></script>
    <script src="assets/js/lib/OrbitControls.js"></script>
    <script src="assets/js/core/maze-editor.js?v=<?= filemtime(__DIR__ . "/assets/js/core/maze-editor.js") ?>"></script>
    <script src="assets/js/core/maze-3d.js?v=<?= filemtime(__DIR__ . "/assets/js/core/maze-3d.js") ?>"></script>
    <script src="assets/js/core/ranked-fx.js?v=<?= filemtime(__DIR__ . "/assets/js/core/ranked-fx.js") ?>"></script>

<?php foreach (['common', 'timer', 'scene', 'editor', 'drive', 'auth', 'maps', 'ranked', 'share', 'publish', 'admin', 'main'] as $js): ?>
    <script src="assets/js/app/<?= $js ?>.js?v=<?= filemtime(__DIR__ . "/assets/js/app/$js.js") ?>"></script>
<?php endforeach; ?>
</body>
</html>
