<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>10×10 3D 迷宮模擬與自訂牆壁規劃器</title>
<?php foreach (['base', 'topbar', 'editor', 'simulator', 'ranked', 'dialogs', 'admin', 'ranked-entry', 'leaderboard'] as $css): ?>
    <link rel="stylesheet" href="assets/css/<?= $css ?>.css?v=<?= time() ?>">
<?php endforeach; ?>
</head>
<body>

    <?php include __DIR__ . '/views/topbar.php'; ?>

    <?php include __DIR__ . '/views/editbar.php'; ?>

    <!-- 主操作區域：左側 2D 編輯器，右側 3D 模擬視窗 -->
    <div class="app-container">
        <?php include __DIR__ . '/views/editor-panel.php'; ?>

        <?php include __DIR__ . '/views/ranked-lobby.php'; ?>

        <?php include __DIR__ . '/views/simulator-panel.php'; ?>
    </div>

    <!-- 提示訊息 -->
    <div class="toast" id="toastMsg" role="status" aria-live="polite"></div>

    <?php include __DIR__ . '/views/dialogs/auth.php'; ?>

    <?php include __DIR__ . '/views/dialogs/ranked.php'; ?>

    <?php include __DIR__ . '/views/dialogs/maps.php'; ?>

    <?php include __DIR__ . '/views/dialogs/admin.php'; ?>

    <!-- 腳本引入 -->
    <script src="assets/js/lib/three.min.js"></script>
    <script src="assets/js/lib/OrbitControls.js"></script>
    <script src="assets/js/core/maze-editor.js?v=<?= time() ?>"></script>
    <script src="assets/js/core/maze-3d.js?v=<?= time() ?>"></script>
    <script src="assets/js/core/ranked-fx.js?v=<?= time() ?>"></script>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const svgElement = document.getElementById('mazeSvg');
            const canvasContainer = document.getElementById('canvasContainer');

            // Toast 訊息提示
            function showToast(msg, isError = false) {
                const toast = document.getElementById('toastMsg');
                if (!toast) return;
                toast.textContent = msg;
                toast.classList.toggle('error', isError);
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 2800);
            }

            const btnStartDrive = document.getElementById('btnStartDrive');
            const btnStopDrive = document.getElementById('btnStopDrive');
            const btnResetCar = document.getElementById('btnResetCar');
            const btnModeOrbit = document.getElementById('btnModeOrbit');
            const btnModeDriver = document.getElementById('btnModeDriver');
            const btnResetCam = document.getElementById('btnResetCam');
            const driveStatusBadge = document.getElementById('driveStatusBadge');
            const driveStatusText = document.getElementById('driveStatusText');
            const driveStatusDot = document.getElementById('driveStatusDot');

            // 賽事模式：'practice' (練習賽) | 'ranked' (排位賽)
            let currentGameMode = 'practice';
            let currentRankedSize = '10x10'; // 10x10, 15x15, 20x20, 25x25, 30x30
            let currentRankedMapId = 'map_1';
            let currentRankedLimitMs = 90 * 1000;

            // ============================================
            // 計時系統 (完賽計時 / 倒數挑戰模式)
            // ============================================
            let currentTimerMode = 'up'; // 'up' (正數完賽計時) 或 'down' (限時挑戰倒數)
            let timerRunning = false;
            let timerElapsedMs = 0;
            let timerStartTimestamp = 0;
            let timerIntervalId = null;
            let countdownLimitMs = 60 * 1000;
            let countdownLabel = '1分鐘挑戰';
            let countdownDesc = '1 分鐘';

            const timerDigits = document.getElementById('timerDigits');
            const timerIcon = document.getElementById('timerIcon');
            const timerDisplay = document.getElementById('timerDisplay');
            const btnTimerCountUp = document.getElementById('btnTimerCountUp');
            const btnTimerCountDown = document.getElementById('btnTimerCountDown');
            const countdownBtnLabel = document.getElementById('countdownBtnLabel');
            const selectCountdownDuration = document.getElementById('selectCountdownDuration');
            const customTimerGroup = document.getElementById('customTimerGroup');
            const customMinInput = document.getElementById('customMinInput');
            const customSecInput = document.getElementById('customSecInput');
            const btnApplyCustomTimer = document.getElementById('btnApplyCustomTimer');

            function formatTimeDisplay(ms) {
                const totalTenths = Math.floor(ms / 100);
                const tenths = totalTenths % 10;
                const totalSec = Math.floor(totalTenths / 10);
                const sec = totalSec % 60;
                const min = Math.floor(totalSec / 60);
                return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${tenths}`;
            }

            const timerBarFill = document.getElementById('timerBarFill');
            let warnPlayed = false;   // 排位賽：進入最後衝刺的警示音只響一次
            let lastTickSec = 0;

            function updateTimerUI() {
                let displayMs = 0;

                if (currentTimerMode === 'up') {
                    displayMs = timerElapsedMs;
                    if (timerIcon) timerIcon.textContent = '完賽計時';
                    if (timerDisplay) timerDisplay.className = 'timer-display';
                    document.body.classList.remove('ranked-warn');
                } else {
                    const remainMs = Math.max(0, countdownLimitMs - timerElapsedMs);
                    const isRanked = currentGameMode === 'ranked';
                    // 排位賽：剩最後 10%（至少 10 秒）進入最後衝刺；練習賽維持最後 10 秒
                    const dangerMs = isRanked ? Math.max(countdownLimitMs * 0.1, 10000) : 10000;
                    const isDanger = timerRunning && remainMs <= dangerMs;
                    displayMs = remainMs;
                    if (timerIcon) timerIcon.textContent = isRanked ? (isDanger ? '最後衝刺！' : '剩餘時間') : '倒數';
                    if (timerDisplay) timerDisplay.className = isDanger ? 'timer-display countdown danger' : 'timer-display countdown';

                    if (isRanked) {
                        document.body.classList.toggle('ranked-warn', isDanger);
                        if (timerBarFill) timerBarFill.style.width = `${(remainMs / countdownLimitMs) * 100}%`;
                        if (isDanger) {
                            const sec = Math.ceil(remainMs / 1000);
                            if (!warnPlayed) {
                                warnPlayed = true;
                                lastTickSec = sec;
                                RankedFx.play('warn');
                            } else if (sec <= 10 && sec !== lastTickSec) {
                                lastTickSec = sec;
                                RankedFx.play('tick');
                            }
                        }
                    }
                }

                const timeStr = formatTimeDisplay(displayMs);
                if (timerDigits) timerDigits.textContent = timeStr;
            }

            function startTimer(reset = true) {
                if (reset) {
                    timerElapsedMs = 0;
                    warnPlayed = false;
                }
                timerStartTimestamp = performance.now();
                timerRunning = true;

                if (timerIntervalId) clearInterval(timerIntervalId);
                timerIntervalId = setInterval(() => {
                    const now = performance.now();
                    const delta = now - timerStartTimestamp;
                    timerStartTimestamp = now;
                    timerElapsedMs += delta;

                    // 倒數挑戰結束判定
                    if (currentTimerMode === 'down' && timerElapsedMs >= countdownLimitMs) {
                        timerElapsedMs = countdownLimitMs;
                        updateTimerUI();
                        pauseTimer();
                        maze3D.stopDriving();

                        if (currentGameMode === 'ranked') {
                            const rankedTimeoutModal = document.getElementById('rankedTimeoutModal');
                            const rankedTimeoutValue = document.getElementById('rankedTimeoutValue');
                            const rankedTimeoutSub = document.getElementById('rankedTimeoutSub');

                            if (rankedTimeoutValue) rankedTimeoutValue.textContent = formatTimeDisplay(countdownLimitMs);
                            if (rankedTimeoutSub) rankedTimeoutSub.textContent = `沒在 ${currentRankedSize.replace('x', ' × ')} 的 ${countdownDesc} 內抵達終點`;
                            if (rankedTimeoutModal) rankedTimeoutModal.style.display = 'block';
                            document.body.classList.add('ranked-live');
                            RankedFx.play('timeout');
                        } else {
                            const timeoutModal = document.getElementById('timeoutModal');
                            const timeoutTimeValue = document.getElementById('timeoutTimeValue');
                            const timeoutTimeSub = document.getElementById('timeoutTimeSub');
                            const btnTimeoutRestart = document.getElementById('btnTimeoutRestart');

                            if (timeoutTimeValue) timeoutTimeValue.textContent = formatTimeDisplay(countdownLimitMs);
                            if (timeoutTimeSub) timeoutTimeSub.textContent = `沒在 ${countdownDesc} 內抵達終點`;
                            if (btnTimeoutRestart) btnTimeoutRestart.textContent = '再跑一次';

                            if (timeoutModal) timeoutModal.style.display = 'block';
                        }
                        return;
                    }

                    updateTimerUI();
                }, 33);

                updateTimerUI();
            }

            function pauseTimer() {
                timerRunning = false;
                if (timerIntervalId) {
                    clearInterval(timerIntervalId);
                    timerIntervalId = null;
                }
                if (timerDisplay) {
                    timerDisplay.classList.remove('danger');
                }
                document.body.classList.remove('ranked-warn');
            }

            function resetTimer() {
                pauseTimer();
                timerElapsedMs = 0;
                updateTimerUI();
            }

            // 切換計時模式按鈕
            btnTimerCountUp.addEventListener('click', () => {
                if (currentGameMode === 'ranked') {
                    showToast('官方排位賽強制使用限時倒數規則！', true);
                    return;
                }
                if (currentTimerMode === 'up') return;
                currentTimerMode = 'up';
                btnTimerCountUp.classList.add('active');
                btnTimerCountDown.classList.remove('active');
                maze3D.stopDriving();
                resetTimer();
                showToast('已切換為【完賽計時】模式 (從0開始記錄跑完時間)');
            });

            btnTimerCountDown.addEventListener('click', () => {
                if (currentTimerMode === 'down') return;
                currentTimerMode = 'down';
                btnTimerCountDown.classList.add('active');
                btnTimerCountUp.classList.remove('active');
                maze3D.stopDriving();
                resetTimer();
                showToast(`已切換為【${countdownLabel}】模式 (限時倒數)`);
            });

            // 倒數時限下拉選單切換
            if (selectCountdownDuration) {
                selectCountdownDuration.addEventListener('change', () => {
                    if (currentGameMode === 'ranked') {
                        showToast('排位賽挑戰限時由官方級別統一規定！', true);
                        return;
                    }
                    const val = selectCountdownDuration.value;
                    if (val === 'custom') {
                        // 展開自訂時間輸入區
                        if (customTimerGroup) customTimerGroup.style.display = 'inline-flex';
                        if (customMinInput) customMinInput.focus();
                        return;
                    }

                    // 選擇預設時限
                    if (customTimerGroup) customTimerGroup.style.display = 'none';
                    const chosenMin = parseInt(val, 10) || 1;
                    countdownLimitMs = chosenMin * 60 * 1000;
                    countdownLabel = `${chosenMin}分鐘挑戰`;
                    countdownDesc = `${chosenMin} 分鐘`;

                    if (countdownBtnLabel) {
                        countdownBtnLabel.textContent = countdownLabel;
                    }
                    if (currentTimerMode !== 'down') {
                        currentTimerMode = 'down';
                        btnTimerCountDown.classList.add('active');
                        btnTimerCountUp.classList.remove('active');
                    }
                    if (timerRunning) {
                        maze3D.stopDriving();
                    }
                    resetTimer();
                    showToast(`⏳ 已設定為【${countdownLabel}】模式！`);
                });
            }

            // 套用自訂時間邏輯
            function applyCustomDuration() {
                const min = Math.max(0, parseInt(customMinInput ? customMinInput.value : 0, 10) || 0);
                const sec = Math.max(0, Math.min(59, parseInt(customSecInput ? customSecInput.value : 0, 10) || 0));
                const totalSec = min * 60 + sec;

                if (totalSec <= 0) {
                    showToast('自訂挑戰時間必須大於 0 秒！', true);
                    return;
                }

                countdownLimitMs = totalSec * 1000;

                if (sec === 0) {
                    countdownLabel = `${min}分鐘挑戰`;
                    countdownDesc = `${min} 分鐘`;
                } else if (min === 0) {
                    countdownLabel = `${sec}秒挑戰`;
                    countdownDesc = `${sec} 秒`;
                } else {
                    countdownLabel = `${min}分${sec}秒挑戰`;
                    countdownDesc = `${min} 分 ${sec} 秒`;
                }

                if (countdownBtnLabel) countdownBtnLabel.textContent = countdownLabel;

                // 更新下拉選單中的自訂選項文字
                const customOpt = selectCountdownDuration ? selectCountdownDuration.querySelector('option[value="custom"]') : null;
                if (customOpt) {
                    customOpt.textContent = `自訂（${countdownDesc}）`;
                }

                if (currentTimerMode !== 'down') {
                    currentTimerMode = 'down';
                    btnTimerCountDown.classList.add('active');
                    btnTimerCountUp.classList.remove('active');
                }
                if (timerRunning) {
                    maze3D.stopDriving();
                }
                resetTimer();
                showToast(`⏳ 已套用自訂挑戰時間：${countdownDesc}！`);
            }

            if (btnApplyCustomTimer) {
                btnApplyCustomTimer.addEventListener('click', applyCustomDuration);
            }

            [customMinInput, customSecInput].forEach(inp => {
                if (inp) {
                    inp.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            applyCustomDuration();
                        }
                    });
                }
            });

            function updateDrivingUI(isDriving) {
                if (isDriving) {
                    btnStartDrive.disabled = true;
                    btnStartDrive.classList.add('driving-active');
                    btnStopDrive.disabled = false;

                    driveStatusBadge.className = 'drive-status-tag active';
                    driveStatusText.textContent = '操控中';
                    document.getElementById('simulatorPanel').classList.add('is-driving');
                    document.body.classList.toggle('ranked-live', currentGameMode === 'ranked');

                    if (currentGameMode === 'ranked') {
                        // 排位賽模式：按下開始後強制切換並鎖定車子視角
                        if (maze3D && maze3D.currentMode !== 'driver') {
                            maze3D.setMode('driver');
                        }
                        if (btnModeDriver) btnModeDriver.classList.add('active');
                        if (btnModeOrbit) {
                            btnModeOrbit.classList.remove('active');
                            btnModeOrbit.disabled = true;
                            btnModeOrbit.title = '排位賽進行中只能使用車子視角';
                        }
                        if (btnResetCam) {
                            btnResetCam.disabled = true;
                            btnResetCam.title = '排位賽進行中已鎖定車子視角';
                        }
                    } else {
                        if (btnModeOrbit) {
                            btnModeOrbit.disabled = false;
                            btnModeOrbit.title = '3D 自由俯瞰視角';
                        }
                        if (btnResetCam) {
                            btnResetCam.disabled = false;
                            btnResetCam.title = '重設視角至標準角度';
                        }
                    }
                } else {
                    btnStartDrive.disabled = false;
                    btnStartDrive.classList.remove('driving-active');
                    btnStopDrive.disabled = true;

                    driveStatusBadge.className = 'drive-status-tag';
                    driveStatusText.textContent = '按試跑後可用鍵盤操控';
                    document.getElementById('simulatorPanel').classList.remove('is-driving');
                    document.body.classList.remove('ranked-live');

                    // 比賽開始前或停止遙控後：解除視角鎖定，允許自由切換俯瞰/車載視角
                    if (btnModeOrbit) {
                        btnModeOrbit.disabled = false;
                        btnModeOrbit.title = '3D 自由俯瞰視角';
                    }
                    if (btnResetCam) {
                        btnResetCam.disabled = false;
                        btnResetCam.title = '重設視角至標準角度';
                    }

                    if (timerRunning) {
                        pauseTimer();
                    }
                }
            }

            // 2D 編輯器實例 (預先宣告供 3D 即時回報同步)
            // 快取經常用到的 HUD DOM 節點，避免每幀重複檢索
            const posCmEl = document.getElementById('posCm');
            const rankedMinimap = document.getElementById('rankedMinimap');
            const posCellEl = document.getElementById('posCell');

            // 1. 初始化 3D 模擬場景
            const maze3D = new Maze3D(canvasContainer, {
                onGoalReached: () => {
                    pauseTimer();
                    maze3D.stopDriving();

                    if (currentGameMode === 'ranked') {
                        // 排位賽成績結算
                        const totalSec = (timerElapsedMs / 1000).toFixed(2);
                        const timeUsedMs = Math.round(timerElapsedMs);
                        const timeRemainMs = Math.max(0, Math.round(countdownLimitMs - timerElapsedMs));
                        const remainSec = (timeRemainMs / 1000).toFixed(2);

                        const rankedModal = document.getElementById('rankedVictoryModal');
                        const timeValEl = document.getElementById('rankedVictoryTimeValue');
                        const timeSubEl = document.getElementById('rankedVictoryTimeSub');
                        const rankNumEl = document.getElementById('rankedVictoryRankNum');
                        const victoryMsgEl = document.getElementById('rankedVictoryMsg');

                        // 評級：剩餘時間 ≥ 50% 為 S，≥ 25% 為 A，其餘為 B
                        const remainRatio = timeRemainMs / countdownLimitMs;
                        const grade = remainRatio >= 0.5 ? 'S' : remainRatio >= 0.25 ? 'A' : 'B';
                        const tier = RANKED_TIERS[currentRankedSize];
                        const recordStamp = document.getElementById('rankedRecordStamp');

                        document.getElementById('resultCrestUse').setAttribute('href', `assets/icons.svg#crest-${tier.level}`);
                        document.getElementById('rankedResultTier').textContent = `${tier.en}・${currentRankedSize.replace('x', ' × ')}・${currentRankedMapId}`;
                        document.getElementById('rankedGradeLetter').textContent = grade;
                        recordStamp.hidden = true;
                        if (timeValEl) timeValEl.textContent = formatTimeDisplay(timerElapsedMs);
                        if (timeSubEl) timeSubEl.textContent = `耗時 ${totalSec} 秒・剩餘 ${remainSec} 秒`;
                        if (rankNumEl) rankNumEl.textContent = '…';
                        if (victoryMsgEl) victoryMsgEl.textContent = '正在登錄成績…';

                        if (rankedModal) rankedModal.style.display = 'block';
                        document.body.classList.add('ranked-live'); // 結算維持全螢幕，背景是 3D 場景
                        RankedFx.play('finish');
                        RankedFx.celebrate(document.querySelector('.sim-stage'));

                        fetch('api/ranked.php?action=submit_score', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                size: currentRankedSize,
                                map_id: currentRankedMapId,
                                time_used_ms: timeUsedMs,
                                time_remain_ms: timeRemainMs
                            })
                        })
                        .then(res => res.json())
                        .then(res => {
                            if (res.success) {
                                refreshLobbyScore(currentRankedSize);
                                RankedFx.countRank(rankNumEl, res.rank || 1);
                                if (res.isBest) {
                                    recordStamp.hidden = false;
                                    RankedFx.play('record');
                                }
                                if (victoryMsgEl) {
                                    if (res.isBest) {
                                        victoryMsgEl.textContent = '刷新個人最佳紀錄';
                                        showToast(`刷新個人最佳，全服第 ${res.rank} 名`);
                                    } else {
                                        const bestSec = res.bestTimeMs ? (res.bestTimeMs / 1000).toFixed(2) : '-';
                                        victoryMsgEl.textContent = `你的最佳仍是 ${bestSec} 秒，排行榜保留最佳成績`;
                                    }
                                }
                            } else {
                                if (rankNumEl) rankNumEl.textContent = '-';
                                if (victoryMsgEl) victoryMsgEl.textContent = res.message || '結算完成';
                            }
                        })
                        .catch(err => {
                            console.error('排位成績提交失敗:', err);
                            if (rankNumEl) rankNumEl.textContent = '-';
                            if (victoryMsgEl) victoryMsgEl.textContent = '無法連接伺服器登錄成績';
                        });

                        return;
                    }

                    // 練習賽結算
                    const modal = document.getElementById('victoryModal');
                    const timeLabel = document.getElementById('victoryTimeLabel');
                    const timeValue = document.getElementById('victoryTimeValue');
                    const timeSub = document.getElementById('victoryTimeSub');
                    const victoryMsg = document.getElementById('victoryMsg');

                    const totalSec = (timerElapsedMs / 1000).toFixed(1);
                    const formatted = formatTimeDisplay(timerElapsedMs);

                    const cols = (editor && editor.cols) || 10;
                    const rows = (editor && editor.rows) || 10;

                    if (currentTimerMode === 'up') {
                        timeLabel.textContent = '完賽成績';
                        timeValue.textContent = formatted;
                        timeSub.textContent = `走出 ${cols} × ${rows} 迷宮，共 ${totalSec} 秒`;
                        victoryMsg.textContent = '';
                    } else {
                        const remainSec = Math.max(0, (countdownLimitMs - timerElapsedMs) / 1000).toFixed(1);
                        timeLabel.textContent = `${countdownLabel}成功`;
                        timeValue.textContent = formatted;
                        timeSub.textContent = `耗時 ${totalSec} 秒・剩餘 ${remainSec} 秒`;
                        victoryMsg.textContent = `在 ${countdownDesc} 內走出 ${cols} × ${rows} 迷宮`;
                    }

                    modal.style.display = 'block';
                },
                onPositionUpdate: (pos) => {
                    if (posCmEl) posCmEl.textContent = `X: ${pos.xCm} cm, Y: ${pos.zCm} cm`;
                    if (posCellEl) posCellEl.textContent = `格 (${pos.cellX}, ${pos.cellY})`;
                    if (editor) {
                        editor.updateCarPosition(pos);
                    }
                    // 排位賽小地圖：只看得到車子周圍幾格（範圍依段位）
                    if (document.body.classList.contains('ranked-live')) {
                        RankedFx.drawMinimap(
                            rankedMinimap,
                            { ...maze3D.mazeData, cols: maze3D.cols, rows: maze3D.rows },
                            (pos.rawX + maze3D.widthSize / 2) / maze3D.cellSize,
                            (pos.rawZ + maze3D.heightSize / 2) / maze3D.cellSize,
                            pos.yaw,
                            RANKED_TIERS[currentRankedSize].view
                        );
                    }
                },
                onDrivingChange: (isDriving) => {
                    updateDrivingUI(isDriving);
                }
            });

            // 2. 初始化 2D 編輯器 (設計時預設為較大尺寸 560px)
            editor = new MazeEditor(svgElement, {
                baseSize: 560,
                onUpdate: (data) => {
                    // 同步到 3D
                    maze3D.buildMaze3D(data);

                    if (timerRunning) {
                        maze3D.stopDriving();
                        resetTimer();
                    }

                    const cols = data.gridSize ? data.gridSize.cols : 10;
                    const rows = data.gridSize ? data.gridSize.rows : 10;

                    // 更新規格 Tags 與輸入框
                    const tagGrid = document.getElementById('headerTagGrid');
                    const tagTotal = document.getElementById('headerTagTotal');
                    const specDim = document.getElementById('specDimensionsCm');
                    if (tagGrid) tagGrid.textContent = `規格：${cols}×${rows} 格`;
                    document.getElementById('specMenuLabel').textContent = `${cols} × ${rows}`;
                    if (tagTotal) tagTotal.textContent = `總長寬：${cols * 30}×${rows * 30} cm`;
                    if (specDim) specDim.textContent = `${cols * 30} × ${rows * 30} cm`;

                    const inputCols = document.getElementById('inputCols');
                    const inputRows = document.getElementById('inputRows');
                    if (inputCols) inputCols.value = cols;
                    if (inputRows) inputRows.value = rows;

                    // 更新預設按鈕的高亮
                    document.querySelectorAll('.spec-preset-btn').forEach(btn => {
                        const bc = parseInt(btn.getAttribute('data-cols'), 10);
                        const br = parseInt(btn.getAttribute('data-rows'), 10);
                        if (bc === cols && br === rows) {
                            btn.classList.add('active');
                        } else {
                            btn.classList.remove('active');
                        }
                    });

                    // 更新 UI 狀態
                    document.getElementById('statStart').textContent = `(${data.start.x}, ${data.start.y})`;
                    document.getElementById('statGoal').textContent = `(${data.goal.x}, ${data.goal.y})`;

                    // 計算牆壁數量
                    let hCount = 0;
                    data.hWalls.forEach(row => row.forEach(val => { if (val) hCount++; }));
                    let vCount = 0;
                    data.vWalls.forEach(row => row.forEach(val => { if (val) vCount++; }));
                    document.getElementById('statWallCount').textContent = (hCount + vCount);
                }
            });

            // 2-0. 初始化 2D 地圖縮放 (Zoom) 與拖曳平移 (Pan) 系統
            const mapViewport = document.getElementById('mapViewport');
            if (mapViewport && editor.initZoomAndPan) {
                editor.initZoomAndPan(mapViewport);
            }

            // 綁定地圖縮放控制列按鈕
            const btnZoomIn = document.getElementById('btnZoomIn');
            const btnZoomOut = document.getElementById('btnZoomOut');
            const btnZoomReset = document.getElementById('btnZoomReset');
            const btnZoomFit = document.getElementById('btnZoomFit');
            const zoomPercentDisplay = document.getElementById('zoomPercentDisplay');

            if (btnZoomIn) btnZoomIn.addEventListener('click', () => editor.zoomIn());
            if (btnZoomOut) btnZoomOut.addEventListener('click', () => editor.zoomOut());
            if (btnZoomReset) btnZoomReset.addEventListener('click', () => editor.resetZoom());
            if (btnZoomFit) btnZoomFit.addEventListener('click', () => editor.fitZoom());
            if (zoomPercentDisplay) zoomPercentDisplay.addEventListener('click', () => editor.resetZoom());

            // 2-0-1. 2D 地圖與版面切換控制 (設計時用一半版面 50%，遙控時恢復正常大小 480px)
            const editorPanel = document.querySelector('.editor-panel');
            const btnToggleMapSize = document.getElementById('btnToggleMapSize');
            let currentMapMode = 'large'; // 'large' (設計時 50% 一半版面) 或 'compact' (遙控時恢復正常大小)

            function getOptimalDesignCanvasSize() {
                // 設計時 50% 版面下的最佳畫布像素尺寸 (兼顧寬度與高度)
                const viewport = document.getElementById('mapViewport');
                const maxW = viewport ? viewport.clientWidth - 32 : 560;
                const maxH = viewport ? viewport.clientHeight - 32 : 560;
                return Math.max(320, Math.min(720, maxW, maxH));
            }

            function set2DMapMode(mode, showNotification = false) {
                if (!editor) return;
                currentMapMode = mode;
                if (mode === 'compact') {
                    // 遙控時：恢復正常大小 (420px)，左側收納至 480px，右側 3D 享有寬敞視野
                    editorPanel.classList.add('mode-compact');
                    editor.setCanvasBaseSize(400);
                    if (btnToggleMapSize) {
                        btnToggleMapSize.querySelector('use').setAttribute('href', 'assets/icons.svg#arrows-minimize');
                        btnToggleMapSize.title = '恢復並排';
                        btnToggleMapSize.setAttribute('aria-label', '恢復並排');
                    }
                } else {
                    // 設計時：使用一半版面 (50%)，畫布自適應大圖，方便精準規劃與點選牆壁
                    editorPanel.classList.remove('mode-compact');
                    const designSize = getOptimalDesignCanvasSize();
                    editor.setCanvasBaseSize(designSize);
                    if (btnToggleMapSize) {
                        btnToggleMapSize.querySelector('use').setAttribute('href', 'assets/icons.svg#arrows-maximize');
                        btnToggleMapSize.title = '放大 3D';
                        btnToggleMapSize.setAttribute('aria-label', '放大 3D');
                    }
                }
                editor.resetZoom(true);

                // 配合 CSS 0.35s 寬度過渡，更新 3D 視角
                if (window.maze3D) {
                    maze3D.onWindowResize();
                    setTimeout(() => maze3D.onWindowResize(), 150);
                    setTimeout(() => maze3D.onWindowResize(), 360);
                }
            }

            // 手動點選切換按鈕
            if (btnToggleMapSize) {
                btnToggleMapSize.addEventListener('click', () => {
                    set2DMapMode(currentMapMode === 'large' ? 'compact' : 'large', true);
                });
            }

            // 3D 設定選單
            setupMenu(document.getElementById('btnSimSettings'), document.getElementById('simSettingsMenu'));

            // 觸控方向鍵：按住等同按下對應的鍵盤按鍵
            document.querySelectorAll('.pad-btn[data-key]').forEach(btn => {
                const key = btn.dataset.key;
                const press = (down) => (e) => {
                    e.preventDefault();
                    if (maze3D) maze3D.keys[key] = down;
                };
                btn.addEventListener('pointerdown', press(true));
                ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => btn.addEventListener(t, press(false)));
            });

            // 監聽 3D 畫布容器大小改變，確保平滑過渡
            if (window.ResizeObserver && canvasContainer) {
                const ro = new ResizeObserver(() => {
                    if (maze3D) maze3D.onWindowResize();
                });
                ro.observe(canvasContainer);
            }

            // 視窗縮放時自適應設計大圖
            window.addEventListener('resize', () => {
                if (currentMapMode === 'large' && editor) {
                    editor.setCanvasBaseSize(getOptimalDesignCanvasSize());
                }
            });

            // 2-1. 規格調整與登入權限檢查 (未登入僅限使用 10×10 含以下地圖)
            function applyGridSizeDirect(c, r) {
                if (timerRunning) {
                    maze3D.stopDriving();
                    resetTimer();
                }
                if (currentMapMode === 'compact') {
                    set2DMapMode('large', false);
                }
                editor.setGridSize(c, r);
                maze3D.resetOrbitCamera();
                showToast(`已成功切換規格為 ${c}×${r} 格！`);
            }

            function requestApplyGridSize(c, r) {
                if (isNaN(c) || c < 2 || c > 30 || isNaN(r) || r < 2 || r > 30) {
                    showToast('規格數值請輸入 2 ~ 30 之間的整數！', true);
                    return false;
                }

                // 檢查未登入限制：沒有登入只能使用 10*10 含以下地圖
                if (!currentUser && (c > 10 || r > 10)) {
                    pendingTargetGrid = { cols: c, rows: r };
                    showToast(`訪客限制：未登入僅限使用 10×10 (含) 以下地圖！您欲使用 ${c}×${r} 格，請先登入！`, true);
                    openAuthModal(
                        `規格權限提示：\n您選擇了 ${c}×${r} 格大型地圖。\n未登入訪客僅限使用 10×10 (含) 以下規格！\n\n請先登入或註冊帳號，完成後將自動為您解鎖套用！`,
                        'login'
                    );
                    return false;
                }

                applyGridSizeDirect(c, r);
                return true;
            }

            const btnApplyGridSize = document.getElementById('btnApplyGridSize');
            if (btnApplyGridSize) {
                btnApplyGridSize.addEventListener('click', () => {
                    const c = parseInt(document.getElementById('inputCols').value, 10);
                    const r = parseInt(document.getElementById('inputRows').value, 10);
                    requestApplyGridSize(c, r);
                });
            }

            document.querySelectorAll('.spec-preset-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const c = parseInt(btn.getAttribute('data-cols'), 10);
                    const r = parseInt(btn.getAttribute('data-rows'), 10);
                    if (c && r) {
                        requestApplyGridSize(c, r);
                    }
                });
            });

            // 3. 工具切換 (設置牆壁 / 設定起點 / 設定終點 / 拖曳平移)
            const toolButtons = [
                { id: 'toolWall', tool: 'wall', tip: '點格線新增或移除牆壁' },
                { id: 'toolStart', tool: 'start', tip: '點任一格設為起點' },
                { id: 'toolGoal', tool: 'goal', tip: '點任一格設為終點' },
                { id: 'toolPan', tool: 'pan', tip: '按住拖曳平移地圖' }
            ];

            toolButtons.forEach(btnObj => {
                const el = document.getElementById(btnObj.id);
                el.addEventListener('click', () => {
                    toolButtons.forEach(b => document.getElementById(b.id).classList.remove('active'));
                    el.classList.add('active');
                    editor.setTool(btnObj.tool);
                    document.getElementById('toolTip').textContent = btnObj.tip;
                    if (currentMapMode === 'compact') {
                        set2DMapMode('large', false);
                    }
                });
            });

            // 4. 輔助操作與匯出入按鈕
            document.getElementById('btnOuterWalls').addEventListener('click', () => {
                if (currentMapMode === 'compact') set2DMapMode('large', false);
                const state = editor.toggleOuterWalls();
                showToast(state ? '已開啟四周圍牆' : '已關閉四周圍牆');
            });
            document.getElementById('btnClearInner').addEventListener('click', () => {
                if (currentMapMode === 'compact') set2DMapMode('large', false);
                editor.clearInnerWalls();
                showToast('已清空內部牆壁 (保留四周圍牆)');
            });
            document.getElementById('btnClearAll').addEventListener('click', () => {
                if (currentMapMode === 'compact') set2DMapMode('large', false);
                editor.clearAllWalls();
                showToast('已清空所有牆壁 (包含四周圍牆)');
            });
            document.getElementById('btnRandom').addEventListener('click', () => {
                if (currentMapMode === 'compact') set2DMapMode('large', false);
                editor.generateRandomMaze();
                showToast('已隨機生成迷宮！');
            });

            // 匯出 2D 地圖 (高解析 PNG 圖片)
            document.getElementById('btnExportPNG').addEventListener('click', () => {
                editor.exportPNG(
                    () => showToast('2D 迷宮圖片已成功匯出下載！'),
                    (errMsg) => showToast(errMsg, true)
                );
            });

            // 匯出 JSON 資料
            document.getElementById('btnExportJSON').addEventListener('click', () => {
                editor.exportJSON(() => showToast('迷宮設定 JSON 已成功匯出！'));
            });

            // 匯入 JSON 資料
            const fileInputJSON = document.getElementById('fileInputJSON');
            document.getElementById('btnImportJSON').addEventListener('click', () => {
                fileInputJSON.value = '';
                fileInputJSON.click();
            });

            fileInputJSON.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    editor.importJSON(
                        file,
                        () => showToast('已成功載入迷宮設定！'),
                        (errMsg) => showToast(errMsg, true)
                    );
                }
            });

            // 5. 3D 視角切換 (俯瞰 / 車子視角)
            btnModeOrbit.addEventListener('click', () => {
                if (currentGameMode === 'ranked' && maze3D.isDriving) {
                    showToast('排位賽進行中只能使用車子視角！', true);
                    return;
                }
                btnModeOrbit.classList.add('active');
                btnModeDriver.classList.remove('active');
                maze3D.setMode('orbit');
            });

            btnModeDriver.addEventListener('click', () => {
                btnModeDriver.classList.add('active');
                btnModeOrbit.classList.remove('active');
                maze3D.setMode('driver');
            });

            // 6. 開始 / 停止 / 回起點 操作
            btnStartDrive.addEventListener('click', () => {
                document.getElementById('victoryModal').style.display = 'none';
                document.getElementById('timeoutModal').style.display = 'none';
                document.getElementById('rankedVictoryModal').style.display = 'none';
                document.getElementById('rankedTimeoutModal').style.display = 'none';
                btnStartDrive.classList.remove('pulse-prompt');
                if (editor) editor.clearCarTrail();
                maze3D.startDriving(true);
                startTimer(true);
                // 遙控時：若是練習賽自動切換為正常大小，方便在 2D 與 3D 觀察小車位置
                if (currentGameMode === 'practice') {
                    set2DMapMode('compact', true);
                }
                showToast(currentTimerMode === 'up' ? '已自動定位起點，完賽計時開始！' : `已自動定位起點，${countdownLabel}開始！`);
            });

            btnStopDrive.addEventListener('click', () => {
                maze3D.stopDriving();
                pauseTimer();
                btnStartDrive.classList.remove('pulse-prompt');
                // 停止遙控後：若是練習賽自動恢復為大圖設計模式
                if (currentGameMode === 'practice') {
                    set2DMapMode('large', true);
                }
            });

            btnResetCar.addEventListener('click', () => {
                document.getElementById('rankedVictoryModal').style.display = 'none';
                document.getElementById('rankedTimeoutModal').style.display = 'none';
                maze3D.stopDriving();
                maze3D.placePlayerAtStart();
                resetTimer();
                if (editor) editor.clearCarTrail();
                btnStartDrive.classList.add('pulse-prompt');
                // 回起點後：若是練習賽恢復為大圖設計模式
                if (currentGameMode === 'practice') {
                    set2DMapMode('large', false);
                }
                showToast('自走車已回到起點，請點擊【▶ 開始遙控】開始計時！');
            });

            btnResetCam.addEventListener('click', () => {
                if (currentGameMode === 'ranked' && maze3D.isDriving) {
                    showToast('排位賽進行中視角已鎖定於自走車！', true);
                    return;
                }
                if (maze3D.currentMode === 'orbit') {
                    maze3D.resetOrbitCamera();
                } else {
                    maze3D.placePlayerAtStart();
                }
            });

            // 6-1. 牆壁材質切換
            ['Wood', 'White', 'Cyber'].forEach(theme => {
                const btn = document.getElementById('btnTheme' + theme);
                btn.addEventListener('click', () => {
                    ['Wood', 'White', 'Cyber'].forEach(t => document.getElementById('btnTheme' + t).classList.remove('active'));
                    btn.classList.add('active');
                    maze3D.setTheme(theme.toLowerCase());
                });
            });

            // 7. 過關與超時視窗重設 (重設回起點並重設計時，需點擊「開始遙控」才開始計時)
            document.getElementById('btnVictoryRestart').addEventListener('click', () => {
                document.getElementById('victoryModal').style.display = 'none';
                maze3D.stopDriving();
                maze3D.placePlayerAtStart();
                resetTimer();
                if (editor) editor.clearCarTrail();
                btnStartDrive.classList.add('pulse-prompt');
                set2DMapMode('large', false);
                showToast('自走車已重設回起點，請點擊【▶ 開始遙控】開始計時！');
            });

            document.getElementById('btnTimeoutRestart').addEventListener('click', () => {
                document.getElementById('timeoutModal').style.display = 'none';
                maze3D.stopDriving();
                maze3D.placePlayerAtStart();
                resetTimer();
                if (editor) editor.clearCarTrail();
                btnStartDrive.classList.add('pulse-prompt');
                set2DMapMode('large', false);
                showToast('自走車已重設回起點，請點擊【▶ 開始遙控】開始計時！');
            });

            // ============================================
            // 8. 帳號認證與權限管理系統 (Auth & Permission System)
            // ============================================
            let currentUser = null; // null: 訪客 (限 10x10), { id, username }: 已登入會員 (解鎖至 30x30)
            let pendingTargetGrid = null; // 暫存使用者嘗試套用但受限的規格 { cols, rows }

            const authBadge = document.getElementById('authBadge');
            const btnOpenAuthModal = document.getElementById('btnOpenAuthModal');
            const btnLogout = document.getElementById('btnLogout');
            const btnAccountMenu = document.getElementById('btnAccountMenu');
            const accountMenu = document.getElementById('accountMenu');

            // 下拉選單：點按鈕開關，點外面或按 Esc 關閉
            function closeMenu(menu) {
                if (!menu || menu.hidden) return;
                menu.hidden = true;
                document.querySelector(`[aria-controls="${menu.id}"]`)?.setAttribute('aria-expanded', 'false');
            }
            function setupMenu(trigger, menu, onOpen) {
                trigger.setAttribute('aria-controls', menu.id);
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const willOpen = menu.hidden;
                    document.querySelectorAll('.menu').forEach(closeMenu);
                    if (willOpen) {
                        menu.hidden = false;
                        trigger.setAttribute('aria-expanded', 'true');
                        if (onOpen) onOpen();
                    }
                });
                menu.addEventListener('click', (e) => {
                    if (!menu.classList.contains('keep-open') && e.target.closest('button')) closeMenu(menu);
                });
            }
            document.addEventListener('click', (e) => {
                document.querySelectorAll('.menu').forEach(m => { if (!m.contains(e.target)) closeMenu(m); });
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') document.querySelectorAll('.menu').forEach(closeMenu);
            });

            setupMenu(btnAccountMenu, accountMenu, () => {
                const el = document.getElementById('myRankedMapCount');
                fetch('api/ranked.php?action=leaderboard&size=10x10')
                    .then(res => res.json())
                    .then(res => { if (res.myMapCount) el.textContent = `共 ${res.myMapCount.total} 張`; })
                    .catch(() => {});
            });
            const authModalBackdrop = document.getElementById('authModalBackdrop');
            const btnCloseAuthModal = document.getElementById('btnCloseAuthModal');
            const tabBtnLogin = document.getElementById('tabBtnLogin');
            const tabBtnRegister = document.getElementById('tabBtnRegister');
            const formLogin = document.getElementById('formLogin');
            const formRegister = document.getElementById('formRegister');
            const authAlert = document.getElementById('authAlert');
            const linkToRegister = document.getElementById('linkToRegister');
            const linkToLogin = document.getElementById('linkToLogin');

            function showAuthAlert(msg, type = 'error') {
                if (!authAlert) return;
                authAlert.textContent = msg;
                authAlert.className = `auth-alert ${type}`;
                authAlert.style.display = 'block';
            }

            function clearAuthAlert() {
                if (!authAlert) return;
                authAlert.textContent = '';
                authAlert.className = 'auth-alert';
                authAlert.style.display = 'none';
            }

            function escapeHtml(str) {
                if (!str) return '';
                return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            }

            // 開啟 / 關閉帳號視窗
            function openAuthModal(customMsg = '', defaultTab = 'login') {
                if (!authModalBackdrop) return;
                switchAuthTab(defaultTab);
                if (customMsg) {
                    showAuthAlert(customMsg, 'warning');
                } else {
                    clearAuthAlert();
                }
                authModalBackdrop.classList.add('show');
                setTimeout(() => {
                    if (defaultTab === 'login') {
                        document.getElementById('loginUsername')?.focus();
                    } else {
                        document.getElementById('regUsername')?.focus();
                    }
                }, 100);
            }

            function closeAuthModal() {
                if (!authModalBackdrop) return;
                authModalBackdrop.classList.remove('show');
                clearAuthAlert();
                const lp = document.getElementById('loginPassword');
                const rp = document.getElementById('regPassword');
                const rcp = document.getElementById('regConfirmPassword');
                if (lp) lp.value = '';
                if (rp) rp.value = '';
                if (rcp) rcp.value = '';
            }

            // 切換 登入 / 註冊 頁籤
            function switchAuthTab(tab) {
                clearAuthAlert();
                if (tab === 'register') {
                    tabBtnRegister.classList.add('active');
                    tabBtnLogin.classList.remove('active');
                    formRegister.style.display = 'flex';
                    formLogin.style.display = 'none';
                } else {
                    tabBtnLogin.classList.add('active');
                    tabBtnRegister.classList.remove('active');
                    formLogin.style.display = 'flex';
                    formRegister.style.display = 'none';
                }
            }

            tabBtnLogin?.addEventListener('click', () => switchAuthTab('login'));
            tabBtnRegister?.addEventListener('click', () => switchAuthTab('register'));
            linkToRegister?.addEventListener('click', () => switchAuthTab('register'));
            linkToLogin?.addEventListener('click', () => switchAuthTab('login'));
            btnCloseAuthModal?.addEventListener('click', closeAuthModal);
            authModalBackdrop?.addEventListener('click', (e) => {
                if (e.target === authModalBackdrop) closeAuthModal();
            });

            // 重新整理 Header 上的個人地圖庫數量徽章
            function refreshMapLibraryBadge() {
                const headerMapCountBadge = document.getElementById('headerMapCountBadge');
                if (!headerMapCountBadge) return;
                if (!currentUser) {
                    headerMapCountBadge.textContent = '需登入';
                    return;
                }
                fetch('api/maps.php?action=list')
                    .then(res => res.json())
                    .then(res => {
                        if (res.success) {
                            headerMapCountBadge.textContent = `${res.count || 0} / ${res.max || 5}`;
                        }
                    })
                    .catch(() => {});
            }

            // 重新整理管理員待審核地圖數量徽章
            function refreshAdminPendingCount() {
                const badge = document.getElementById('adminPendingCountBadge');
                if (!badge || !currentUser || currentUser.role !== 'senior') return;
                fetch('api/admin.php?action=pending_count')
                    .then(res => res.json())
                    .then(res => {
                        if (res.success && typeof res.count === 'number') {
                            badge.textContent = res.count;
                        }
                    })
                    .catch(() => {});
            }

            // 更新使用者狀態與規格鎖定 UI
            function updateAuthUI(user) {
                currentUser = user;
                const presetButtons = document.querySelectorAll('.spec-preset-btn');
                const btnSave = document.getElementById('btnSave');
                const btnMapLibrary = document.getElementById('btnMapLibrary');
                const headerMapCountBadge = document.getElementById('headerMapCountBadge');
                const btnPublishToRanked = document.getElementById('btnPublishToRanked');
                const btnAdminUsers = document.getElementById('btnAdminUsers');
                const btnAdminReview = document.getElementById('btnAdminReview');
                const adminMenuSep = document.getElementById('adminMenuSep');
                const btnOpenCreateShare = document.getElementById('btnOpenCreateShare');
                const btnOpenRedeemShare = document.getElementById('btnOpenRedeemShare');
                
                if (user) {
                    // 已登入
                    const role = user.role || 'junior';
                    const roleTitle = user.roleTitle || (role === 'senior' ? '高級使用者' : (role === 'intermediate' ? '中級使用者' : '初級使用者'));
                    authBadge.innerHTML = `<span class="role-badge ${role}">${roleTitle}</span>・可用 2～30 格`;
                    btnOpenAuthModal.style.display = 'none';
                    btnLogout.style.display = 'flex';
                    btnAccountMenu.style.display = 'inline-flex';
                    const initial = user.username.charAt(0).toUpperCase();
                    document.getElementById('accountAvatar').textContent = initial;
                    document.getElementById('accountAvatarLg').textContent = initial;
                    document.getElementById('accountName').innerHTML = `${escapeHtml(user.username)} <span class="role-badge ${role}" style="font-size:11px;padding:1px 6px;">${roleTitle}</span>`;
                    document.getElementById('accountNameLg').textContent = user.username;

                    // 高級使用者專屬管理功能
                    if (btnAdminUsers) btnAdminUsers.style.display = (role === 'senior') ? 'flex' : 'none';
                    if (btnAdminReview) btnAdminReview.style.display = (role === 'senior') ? 'flex' : 'none';
                    if (adminMenuSep) adminMenuSep.style.display = (role === 'senior') ? 'block' : 'none';

                    // 分享碼權限控管
                    if (btnOpenRedeemShare) btnOpenRedeemShare.classList.remove('guest-locked');
                    if (btnOpenCreateShare) {
                        if (role === 'junior') {
                            btnOpenCreateShare.classList.add('guest-locked');
                            btnOpenCreateShare.innerHTML = '<svg class="icon"><use href="assets/icons.svg#lock"></use></svg>產生分享碼<span class="menu-end">中／高級</span>';
                            btnOpenCreateShare.title = '初級使用者不能產生分享碼，只能使用別人的分享碼載入地圖';
                        } else {
                            btnOpenCreateShare.classList.remove('guest-locked');
                            btnOpenCreateShare.innerHTML = '<svg class="icon"><use href="assets/icons.svg#share"></use></svg>產生分享碼<span class="menu-end">限時 1 分</span>';
                            btnOpenCreateShare.title = '產生限時 1 分鐘、最多 3 人的迷宮分享碼';
                        }
                    }

                    // 解除所有預設按鈕鎖定
                    presetButtons.forEach(btn => {
                        const cols = parseInt(btn.getAttribute('data-cols'), 10);
                        const rows = parseInt(btn.getAttribute('data-rows'), 10);
                        btn.classList.remove('locked');
                        btn.textContent = `${cols}×${rows}`;
                        btn.title = `套用 ${cols}×${rows} 規格`;
                    });

                    const inputCols = document.getElementById('inputCols');
                    const inputRows = document.getElementById('inputRows');
                    if (inputCols) inputCols.title = '會員特權：已解鎖支援 2 ~ 30 格';
                    if (inputRows) inputRows.title = '會員特權：已解鎖支援 2 ~ 30 格';

                    // 會員解鎖儲存與個人地圖庫
                    if (btnSave) {
                        btnSave.classList.remove('guest-locked');
                        btnSave.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#device-floppy"></use></svg>儲存';
                        btnSave.title = '將目前迷宮儲存至您的個人雲端資料庫 (最多 5 張)';
                    }
                    if (btnMapLibrary) {
                        btnMapLibrary.classList.remove('guest-locked');
                        btnMapLibrary.title = '開啟我的迷宮圖庫 (管理與載入已存地圖，最多 5 張)';
                    }

                    // 排位賽地圖發布權限控管 (初級使用者不能上傳排位賽地圖)
                    if (btnPublishToRanked) {
                        if (role === 'junior') {
                            btnPublishToRanked.classList.add('guest-locked');
                            btnPublishToRanked.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#lock"></use></svg>發布到排位賽（中級以上）';
                            btnPublishToRanked.title = '初級使用者不能上傳排位賽地圖，需由高級使用者提升為中級或高級使用者！';
                        } else {
                            btnPublishToRanked.classList.remove('guest-locked');
                            btnPublishToRanked.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#upload"></use></svg>發布到排位賽';
                            btnPublishToRanked.title = (role === 'intermediate')
                                ? '中級使用者：每一類限 3 張，需由高級使用者審核通過後加入題庫'
                                : '高級使用者：擁有發布與審核所有排位賽地圖權限';
                        }
                    }
                    refreshMapLibraryBadge();
                    if (role === 'senior') refreshAdminPendingCount();
                } else {
                    // 訪客 (未登入)
                    authBadge.textContent = '訪客・最多 10 × 10';
                    btnOpenAuthModal.style.display = 'inline-flex';
                    btnLogout.style.display = 'none';
                    btnAccountMenu.style.display = 'none';
                    closeMenu(accountMenu);

                    if (btnAdminUsers) btnAdminUsers.style.display = 'none';
                    if (btnAdminReview) btnAdminReview.style.display = 'none';
                    if (adminMenuSep) adminMenuSep.style.display = 'none';
                    if (btnOpenCreateShare) btnOpenCreateShare.classList.add('guest-locked');
                    if (btnOpenRedeemShare) btnOpenRedeemShare.classList.add('guest-locked');

                    // 鎖定大於 10x10 的預設按鈕
                    presetButtons.forEach(btn => {
                        const cols = parseInt(btn.getAttribute('data-cols'), 10);
                        const rows = parseInt(btn.getAttribute('data-rows'), 10);
                        if (cols > 10 || rows > 10) {
                            btn.classList.add('locked');
                            btn.innerHTML = `<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#lock"></use></svg>${cols}×${rows}`;
                            btn.title = `登入後可使用 ${cols}×${rows}`;
                        } else {
                            btn.classList.remove('locked');
                            btn.textContent = `${cols}×${rows}`;
                            btn.title = `套用 ${cols}×${rows} 規格`;
                        }
                    });

                    const inputCols = document.getElementById('inputCols');
                    const inputRows = document.getElementById('inputRows');
                    if (inputCols) inputCols.title = '訪客限制：最高 10 格 (登入可解鎖至 30 格)';
                    if (inputRows) inputRows.title = '訪客限制：最高 10 格 (登入可解鎖至 30 格)';

                    // 訪客限制：儲存、個人地圖庫與發布按鈕顯示鎖定狀態
                    if (btnSave) {
                        btnSave.classList.add('guest-locked');
                        btnSave.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#lock"></use></svg>儲存（需登入）';
                        btnSave.title = '登入後才能存到雲端';
                    }
                    if (btnMapLibrary) {
                        btnMapLibrary.classList.add('guest-locked');
                        btnMapLibrary.title = '登入後才能使用地圖庫';
                    }
                    if (headerMapCountBadge) {
                        headerMapCountBadge.textContent = '需登入';
                    }
                    if (btnPublishToRanked) {
                        btnPublishToRanked.classList.add('guest-locked');
                        btnPublishToRanked.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#lock"></use></svg>發布到排位賽（需登入）';
                        btnPublishToRanked.title = '登入後才能發布到排位賽';
                    }
                }
            }

            // 檢查伺服器 Session 狀態
            function checkAuthStatus() {
                return fetch('api/auth.php?action=status')
                    .then(res => res.json())
                    .then(res => {
                        if (res.success && res.loggedIn && res.user) {
                            updateAuthUI(res.user);
                        } else {
                            updateAuthUI(null);
                        }
                    })
                    .catch(err => {
                        console.warn('檢查登入狀態失敗:', err);
                        updateAuthUI(null);
                    });
            }

            // 登入送出
            document.getElementById('btnSubmitLogin')?.addEventListener('click', () => {
                const username = document.getElementById('loginUsername').value.trim();
                const password = document.getElementById('loginPassword').value;

                if (!username || !password) {
                    showAuthAlert('請輸入帳號與密碼！', 'error');
                    return;
                }

                showAuthAlert('⏳ 驗證登入中，請稍候...', 'warning');

                fetch('api/auth.php?action=login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                })
                .then(res => res.json())
                .then(res => {
                    if (res.success) {
                        updateAuthUI(res.user);
                        closeAuthModal();
                        showToast(res.message);

                        // 登入後載入該使用者的個人迷宮存檔
                        loadMazeConfig();

                        // 若之前有嘗試套用受限規格，登入後自動執行！
                        if (pendingTargetGrid) {
                            const { cols, rows } = pendingTargetGrid;
                            pendingTargetGrid = null;
                            setTimeout(() => {
                                applyGridSizeDirect(cols, rows);
                                showToast(`歡迎登入！已自動為您解鎖並套用 ${cols}×${rows} 大型迷宮！`);
                            }, 300);
                        }
                    } else {
                        showAuthAlert(res.message || '登入失敗，請確認帳號密碼！', 'error');
                    }
                })
                .catch(err => {
                    showAuthAlert('無法連接認證伺服器，請確認 XAMPP Apache 與 MySQL 服務已啟動。', 'error');
                });
            });

            // 註冊送出
            document.getElementById('btnSubmitRegister')?.addEventListener('click', () => {
                const username = document.getElementById('regUsername').value.trim();
                const password = document.getElementById('regPassword').value;
                const confirmPassword = document.getElementById('regConfirmPassword').value;

                if (!username || !password || !confirmPassword) {
                    showAuthAlert('請填寫完整註冊資訊！', 'error');
                    return;
                }
                if (username.length < 3) {
                    showAuthAlert('帳號名稱長度至少需 3 個字元！', 'error');
                    return;
                }
                if (password.length < 4) {
                    showAuthAlert('密碼長度至少需 4 個字元！', 'error');
                    return;
                }
                if (password !== confirmPassword) {
                    showAuthAlert('兩次輸入的密碼不一致！', 'error');
                    return;
                }

                showAuthAlert('⏳ 帳號建立中，請稍候...', 'warning');

                fetch('api/auth.php?action=register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username,
                        password,
                        confirm_password: confirmPassword
                    })
                })
                .then(res => res.json())
                .then(res => {
                    if (res.success) {
                        updateAuthUI(res.user);
                        closeAuthModal();
                        showToast(res.message);

                        // 註冊成功後重新載入
                        loadMazeConfig();

                        if (pendingTargetGrid) {
                            const { cols, rows } = pendingTargetGrid;
                            pendingTargetGrid = null;
                            setTimeout(() => {
                                applyGridSizeDirect(cols, rows);
                                showToast(`恭喜註冊！已自動為您解鎖並套用 ${cols}×${rows} 大型迷宮！`);
                            }, 300);
                        }
                    } else {
                        showAuthAlert(res.message || '註冊失敗！', 'error');
                    }
                })
                .catch(err => {
                    showAuthAlert('無法連接認證伺服器，請確認 XAMPP Apache 與 MySQL 服務已啟動。', 'error');
                });
            });

            // 登出
            btnLogout?.addEventListener('click', () => {
                fetch('api/auth.php?action=logout', { method: 'POST' })
                    .then(res => res.json())
                    .then(res => {
                        updateAuthUI(null);
                        showToast(res.message || '您已成功登出！');

                        if (currentGameMode === 'ranked') {
                            switchGameMode('practice');
                        } else if (editor.cols > 10 || editor.rows > 10) {
                            applyGridSizeDirect(10, 10);
                            showToast('已切換回訪客模式，迷宮規格已自動重設為 10×10！');
                        }
                    })
                    .catch(err => {
                        showToast('登出失敗，請稍後再試', true);
                    });
            });

            btnOpenAuthModal?.addEventListener('click', () => {
                openAuthModal('', 'login');
            });

            // ============================================
            // 9. 儲存與讀取 (PHP + MySQL API - 支援每位使用者儲存最多 5 張迷宮)
            // ============================================

            const loadMazeConfig = () => {
                fetch('api/maps.php')
                    .then(res => res.json())
                    .then(res => {
                        if (res.success && res.data) {
                            // 若未登入且取到的資料大於 10x10，自動限制
                            if (!currentUser && (
                                (res.data.gridSize?.rows > 10) ||
                                (res.data.gridSize?.cols > 10)
                            )) {
                                showToast('訪客模式：已自動限縮為 10×10 迷宮地圖', true);
                                editor.setGridSize(10, 10);
                                return;
                            }
                            editor.loadData(res.data);
                            if (res.count !== undefined && res.max) {
                                const headerMapCountBadge = document.getElementById('headerMapCountBadge');
                                if (headerMapCountBadge && currentUser) {
                                    headerMapCountBadge.textContent = `${res.count} / ${res.max}`;
                                }
                            }
                        }
                    })
                    .catch(err => {
                        console.error('載入失敗:', err);
                        // 若無伺服器連線仍可正常使用預設配置
                        editor.notifyUpdate();
                    });
            };

            // 儲存迷宮彈窗相關 DOM 節點
            const saveMapModalBackdrop = document.getElementById('saveMapModalBackdrop');
            const btnCloseSaveMapModal = document.getElementById('btnCloseSaveMapModal');
            const btnCancelSaveMap = document.getElementById('btnCancelSaveMap');
            const btnConfirmSaveMap = document.getElementById('btnConfirmSaveMap');
            const saveQuotaCount = document.getElementById('saveQuotaCount');
            const saveQuotaProgressFill = document.getElementById('saveQuotaProgressFill');
            const saveCurrentSpec = document.getElementById('saveCurrentSpec');
            const saveCurrentWalls = document.getElementById('saveCurrentWalls');
            const saveMapNameInput = document.getElementById('saveMapNameInput');
            const slotOptionNewWrapper = document.getElementById('slotOptionNewWrapper');
            const radioSaveNew = document.getElementById('radioSaveNew');
            const slotNewDesc = document.getElementById('slotNewDesc');
            const mapFullWarning = document.getElementById('mapFullWarning');
            const saveExistingMapsList = document.getElementById('saveExistingMapsList');
            const saveOverwriteGroup = document.getElementById('saveOverwriteGroup');

            let userSavedMapsCache = [];

            function openSaveMapModal() {
                if (!currentUser) {
                    openAuthModal('訪客限制：【儲存迷宮設定至雲端資料庫】僅限會員使用！請先登入或免費註冊帳號。', 'login');
                    return;
                }
                if (currentGameMode === 'ranked') {
                    showToast('排位賽官方地圖禁止儲存至個人資料庫！請切換至【練習賽】進行迷宮儲存。', true);
                    return;
                }

                // 填入目前地圖資訊
                const cols = editor.cols;
                const rows = editor.rows;
                if (saveCurrentSpec) saveCurrentSpec.textContent = `${cols} × ${rows}・${cols * 30} × ${rows * 30} cm`;

                let wallCount = 0;
                const currentData = editor.getData();
                if (currentData.hWalls) {
                    currentData.hWalls.forEach(r => r.forEach(v => { if (v) wallCount++; }));
                }
                if (currentData.vWalls) {
                    currentData.vWalls.forEach(r => r.forEach(v => { if (v) wallCount++; }));
                }
                if (saveCurrentWalls) saveCurrentWalls.textContent = `${wallCount} 段`;

                if (saveMapNameInput) {
                    saveMapNameInput.value = `我的迷宮 (${cols}×${rows})`;
                }

                saveMapModalBackdrop?.classList.add('show');

                // 讀取當前地圖庫狀態
                fetch('api/maps.php?action=list')
                    .then(res => res.json())
                    .then(res => {
                        if (!res.success) {
                            showToast(res.message || '讀取地圖庫失敗', true);
                            return;
                        }

                        userSavedMapsCache = res.list || [];
                        const count = res.count || 0;
                        const max = res.max || 5;
                        const remaining = res.remaining !== undefined ? res.remaining : Math.max(0, max - count);

                        // 更新配額進度條
                        if (saveQuotaCount) {
                            saveQuotaCount.textContent = `${count} / ${max}`;
                        }
                        if (saveQuotaProgressFill) {
                            const pct = Math.min(100, (count / max) * 100);
                            saveQuotaProgressFill.style.width = `${pct}%`;
                            saveQuotaProgressFill.className = 'quota-progress-fill' + (count >= max ? ' danger' : (count >= 4 ? ' warn' : ''));
                        }

                        const headerMapCountBadge = document.getElementById('headerMapCountBadge');
                        if (headerMapCountBadge) headerMapCountBadge.textContent = `${count} / ${max}`;

                        // 判斷是否已滿 5 張
                        if (count >= max) {
                            // 滿額：禁用存為全新地圖
                            if (slotOptionNewWrapper) {
                                slotOptionNewWrapper.style.opacity = '0.4';
                                slotOptionNewWrapper.style.pointerEvents = 'none';
                                slotOptionNewWrapper.classList.remove('active');
                            }
                            if (radioSaveNew) radioSaveNew.checked = false;
                            if (mapFullWarning) mapFullWarning.style.display = 'block';
                        } else {
                            if (slotOptionNewWrapper) {
                                slotOptionNewWrapper.style.opacity = '1';
                                slotOptionNewWrapper.style.pointerEvents = 'auto';
                                slotOptionNewWrapper.classList.add('active');
                            }
                            if (radioSaveNew) radioSaveNew.checked = true;
                            if (slotNewDesc) slotNewDesc.textContent = `還有 ${remaining} 格`;
                            if (mapFullWarning) mapFullWarning.style.display = 'none';
                        }

                        // 渲染現有地圖列表供覆蓋
                        if (userSavedMapsCache.length === 0) {
                            if (saveOverwriteGroup) saveOverwriteGroup.style.display = 'none';
                            if (saveExistingMapsList) saveExistingMapsList.innerHTML = '';
                        } else {
                            if (saveOverwriteGroup) saveOverwriteGroup.style.display = 'flex';
                            let html = '';
                            userSavedMapsCache.forEach((m, idx) => {
                                const isChecked = (count >= max && idx === 0) ? 'checked' : '';
                                html += `
                                    <label class="existing-map-slot-label ${isChecked ? 'selected' : ''}">
                                        <input type="radio" name="saveTargetMode" value="${m.id}" ${isChecked}>
                                        <span class="slot-option-label">覆蓋「${escapeHtml(m.name)}」</span>
                                        <span class="slot-option-desc">${m.spec}</span>
                                    </label>
                                `;
                            });
                            if (saveExistingMapsList) saveExistingMapsList.innerHTML = html;

                            // 綁定點選反白狀態
                            saveExistingMapsList.querySelectorAll('input[type="radio"]').forEach(radio => {
                                radio.addEventListener('change', () => {
                                    if (radio.checked) {
                                        slotOptionNewWrapper?.classList.remove('active');
                                        saveExistingMapsList.querySelectorAll('.existing-map-slot-label').forEach(lbl => lbl.classList.remove('selected'));
                                        radio.closest('.existing-map-slot-label')?.classList.add('selected');

                                        // 自動將選中的地圖名稱帶入輸入框
                                        const selectedMap = userSavedMapsCache.find(x => x.id === parseInt(radio.value, 10));
                                        if (selectedMap && saveMapNameInput) {
                                            saveMapNameInput.value = selectedMap.name;
                                        }
                                    }
                                });
                            });
                        }
                    })
                    .catch(err => {
                        console.error('查詢地圖庫錯誤:', err);
                    });
            }

            function closeSaveMapModal() {
                saveMapModalBackdrop?.classList.remove('show');
            }

            btnCloseSaveMapModal?.addEventListener('click', closeSaveMapModal);
            btnCancelSaveMap?.addEventListener('click', closeSaveMapModal);
            saveMapModalBackdrop?.addEventListener('click', (e) => {
                if (e.target === saveMapModalBackdrop) closeSaveMapModal();
            });

            radioSaveNew?.addEventListener('change', () => {
                if (radioSaveNew.checked) {
                    slotOptionNewWrapper?.classList.add('active');
                    saveExistingMapsList?.querySelectorAll('.existing-map-slot-label').forEach(lbl => lbl.classList.remove('selected'));
                    const cols = editor.cols;
                    const rows = editor.rows;
                    if (saveMapNameInput) saveMapNameInput.value = `我的迷宮 (${cols}×${rows})`;
                }
            });

            slotOptionNewWrapper?.addEventListener('click', () => {
                if (radioSaveNew && !radioSaveNew.disabled && radioSaveNew.offsetParent !== null) {
                    radioSaveNew.checked = true;
                    radioSaveNew.dispatchEvent(new Event('change'));
                }
            });

            btnConfirmSaveMap?.addEventListener('click', () => {
                if (!currentUser) {
                    closeSaveMapModal();
                    openAuthModal('請先登入會員帳號！', 'login');
                    return;
                }

                const selectedRadio = document.querySelector('input[name="saveTargetMode"]:checked');
                if (!selectedRadio) {
                    showToast('請選擇儲存槽位 (新增或覆蓋現有地圖)！', true);
                    return;
                }

                let targetMapId = 0;
                if (selectedRadio.value !== 'new') {
                    targetMapId = parseInt(selectedRadio.value, 10) || 0;
                }

                const customName = saveMapNameInput ? saveMapNameInput.value.trim() : '';
                const currentData = editor.getData();
                currentData.isRanked = false;
                currentData.name = customName;
                currentData.targetMapId = targetMapId;

                btnConfirmSaveMap.disabled = true;
                btnConfirmSaveMap.textContent = '儲存中…';

                fetch('api/maps.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(currentData)
                })
                .then(res => res.json())
                .then(res => {
                    btnConfirmSaveMap.disabled = false;
                    btnConfirmSaveMap.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#device-floppy"></use></svg>儲存';

                    if (res.success) {
                        closeSaveMapModal();
                        showToast(res.message || '已儲存');
                        refreshMapLibraryBadge();
                    } else {
                        showToast(res.message || '儲存失敗', true);
                        if (res.requireLogin) {
                            closeSaveMapModal();
                            openAuthModal(res.message, 'login');
                        }
                    }
                })
                .catch(err => {
                    btnConfirmSaveMap.disabled = false;
                    btnConfirmSaveMap.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#device-floppy"></use></svg>儲存';
                    showToast('無法連接伺服器進行儲存', true);
                });
            });

            // 儲存按鈕點擊
            document.getElementById('btnSave').addEventListener('click', () => {
                if (currentGameMode === 'ranked') {
                    showToast('排位賽官方地圖禁止儲存至個人資料庫！請切換至【練習賽】進行迷宮儲存。', true);
                    return;
                }
                if (!currentUser) {
                    openAuthModal('訪客限制：【儲存迷宮設定至雲端資料庫】僅限會員使用！請先登入或免費註冊帳號。', 'login');
                    return;
                }
                openSaveMapModal();
            });

            // 地圖庫彈窗相關 DOM 節點
            const mapLibraryModalBackdrop = document.getElementById('mapLibraryModalBackdrop');
            const btnCloseMapLibraryModal = document.getElementById('btnCloseMapLibraryModal');
            const btnRefreshMapLibrary = document.getElementById('btnRefreshMapLibrary');
            const libraryQuotaCount = document.getElementById('libraryQuotaCount');
            const libraryQuotaProgressFill = document.getElementById('libraryQuotaProgressFill');
            const mapLibraryList = document.getElementById('mapLibraryList');

            function openMapLibraryModal() {
                if (!currentUser) {
                    openAuthModal('訪客限制：【我的個人地圖庫】僅限會員使用！請先登入或免費註冊帳號。', 'login');
                    return;
                }
                if (currentGameMode === 'ranked') {
                    showToast('排位賽中不能開啟地圖庫，請先切回練習', true);
                    return;
                }

                mapLibraryModalBackdrop?.classList.add('show');
                loadMapLibraryList();
            }

            function closeMapLibraryModal() {
                mapLibraryModalBackdrop?.classList.remove('show');
            }

            btnCloseMapLibraryModal?.addEventListener('click', closeMapLibraryModal);
            mapLibraryModalBackdrop?.addEventListener('click', (e) => {
                if (e.target === mapLibraryModalBackdrop) closeMapLibraryModal();
            });
            btnRefreshMapLibrary?.addEventListener('click', loadMapLibraryList);

            function loadMapLibraryList() {
                if (!mapLibraryList) return;
                mapLibraryList.innerHTML = '<div class="list-note">載入中…</div>';

                fetch('api/maps.php?action=list')
                    .then(res => res.json())
                    .then(res => {
                        if (!res.success) {
                            mapLibraryList.innerHTML = `<div class="list-note error">無法載入地圖庫：${escapeHtml(res.message || '未知錯誤')}</div>`;
                            return;
                        }

                        const list = res.list || [];
                        const count = res.count || 0;
                        const max = res.max || 5;
                        const remaining = res.remaining !== undefined ? res.remaining : Math.max(0, max - count);

                        // 更新容量進度條
                        if (libraryQuotaCount) {
                            libraryQuotaCount.textContent = `${count} / ${max}`;
                        }
                        if (libraryQuotaProgressFill) {
                            const pct = Math.min(100, (count / max) * 100);
                            libraryQuotaProgressFill.style.width = `${pct}%`;
                            libraryQuotaProgressFill.className = 'quota-progress-fill' + (count >= max ? ' danger' : (count >= 4 ? ' warn' : ''));
                        }

                        const headerMapCountBadge = document.getElementById('headerMapCountBadge');
                        if (headerMapCountBadge) headerMapCountBadge.textContent = `${count} / ${max}`;

                        if (list.length === 0) {
                            mapLibraryList.innerHTML = `
                                <div class="list-note">還沒有存任何地圖。每個帳號最多可以存 5 張。</div>
                            `;
                            return;
                        }

                        let html = '';
                        list.forEach((m, idx) => {
                            html += `
                                <div class="map-library-item">
                                    <div class="library-item-main">
                                        <div class="library-item-title">${escapeHtml(m.name)}</div>
                                        <div class="library-item-meta">${m.spec}・更新於 ${(m.updatedAt || m.createdAt || '-').substring(5, 16)}</div>
                                    </div>
                                    <button type="button" class="tool-btn btn-sm btn-map-load" data-id="${m.id}" data-name="${escapeHtml(m.name)}">載入</button>
                                    <button type="button" class="tool-btn btn-sm btn-ghost btn-map-delete" data-id="${m.id}" data-name="${escapeHtml(m.name)}" aria-label="刪除${escapeHtml(m.name)}"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#trash"></use></svg></button>
                                </div>
                            `;
                        });
                        mapLibraryList.innerHTML = html;

                        // 綁定載入按鈕
                        mapLibraryList.querySelectorAll('.btn-map-load').forEach(btn => {
                            btn.addEventListener('click', () => {
                                const id = btn.getAttribute('data-id');
                                const name = btn.getAttribute('data-name');
                                loadUserMapById(id, name);
                            });
                        });

                        // 綁定刪除按鈕
                        mapLibraryList.querySelectorAll('.btn-map-delete').forEach(btn => {
                            btn.addEventListener('click', () => {
                                const id = btn.getAttribute('data-id');
                                const name = btn.getAttribute('data-name');
                                deleteUserMapById(id, name);
                            });
                        });
                    })
                    .catch(err => {
                        mapLibraryList.innerHTML = '<div class="list-note error">無法連線到伺服器，請稍後再試</div>';
                    });
            }

            function loadUserMapById(id, name) {
                fetch(`api/maps.php?action=load&id=${id}`)
                    .then(res => res.json())
                    .then(res => {
                        if (res.success && res.data) {
                            editor.loadData(res.data);
                            maze3D.resetOrbitCamera();
                            closeMapLibraryModal();
                            showToast(`已成功載入個人迷宮【${name || res.name}】！`);
                        } else {
                            showToast(res.message || '載入迷宮失敗', true);
                        }
                    })
                    .catch(err => {
                        showToast('無法連接伺服器載入地圖', true);
                    });
            }

            function deleteUserMapById(id, name) {
                if (!confirm(`確定要刪除迷宮【${name}】嗎？\n刪除後將釋放 1 個雲端儲存槽位，此動作無法復原！`)) {
                    return;
                }

                fetch(`api/maps.php?action=delete&id=${id}`, { method: 'POST' })
                    .then(res => res.json())
                    .then(res => {
                        if (res.success) {
                            showToast(res.message || '地圖已刪除');
                            loadMapLibraryList();
                            refreshMapLibraryBadge();
                        } else {
                            showToast(res.message || '刪除失敗', true);
                        }
                    })
                    .catch(err => {
                        showToast('無法連接伺服器刪除地圖', true);
                    });
            }

            // 我的地圖庫按鈕點擊
            document.getElementById('btnFileMapLibrary').addEventListener('click', () => document.getElementById('btnMapLibrary').click());
            setupMenu(document.getElementById('btnSpecMenu'), document.getElementById('specMenu'));
            setupMenu(document.getElementById('btnMapMenu'), document.getElementById('mapMenu'));
            setupMenu(document.getElementById('btnFileMenu'), document.getElementById('fileMenu'));
            setupMenu(document.getElementById('btnShareMenu'), document.getElementById('shareMenu'));
            setupMenu(document.getElementById('btnShortcuts'), document.getElementById('shortcutsMenu'));

            document.getElementById('btnMapLibrary')?.addEventListener('click', () => {
                if (currentGameMode === 'ranked') {
                    showToast('排位賽官方盲測模式禁止存取個人圖庫！請切換至【練習賽】進行管理。', true);
                    return;
                }
                if (!currentUser) {
                    openAuthModal('訪客限制：【我的個人地圖庫】功能僅限會員使用！請先登入或免費註冊帳號。', 'login');
                    return;
                }
                openMapLibraryModal();
            });

            // ============================================
            // 10. 排位賽與天梯排行榜系統 (Ranked Match & Leaderboard)
            // ============================================
            const btnModeRanked = document.getElementById('btnModeRanked');
            const btnOpenLeaderboard = document.getElementById('btnOpenLeaderboard');
            const practiceSpecBar = document.getElementById('practiceSpecBar');
            const practiceToolsToolbar = document.getElementById('practiceToolsToolbar');
            const practiceZoomBar = document.getElementById('practiceZoomBar');
            const gridWrapper = document.getElementById('gridWrapper');
            const leaderboardModalBackdrop = document.getElementById('leaderboardModalBackdrop');
            const btnCloseLeaderboardModal = document.getElementById('btnCloseLeaderboardModal');
            const btnRefreshLeaderboard = document.getElementById('btnRefreshLeaderboard');
            const leaderboardTableBody = document.getElementById('leaderboardTableBody');
            const userBestBanner = document.getElementById('userBestBanner');

            let currentLeaderboardTab = '10x10';

            function switchGameMode(mode) {
                if (mode === 'ranked') {
                    if (!currentUser) {
                        openAuthModal('排位賽天梯功能需登入帳號以記錄全服排行榜積分！請先登入或註冊帳號。', 'login');
                        return;
                    }
                    currentGameMode = 'ranked';

                    practiceSpecBar.style.display = 'none';
                    document.body.classList.add('is-ranked');
                    practiceToolsToolbar.style.display = 'none';
                    document.getElementById('practiceToolRail').style.display = 'none';
                    practiceZoomBar.style.display = 'none';

                    // 排位賽時完全隱藏儲存與我的地圖庫按鈕，並顯示禁止儲存提示標籤
                    const btnSaveEl = document.getElementById('btnSave');
                    const btnMapLibraryEl = document.getElementById('btnMapLibrary');
                    if (btnSaveEl) btnSaveEl.style.display = 'none';
                    if (btnMapLibraryEl) btnMapLibraryEl.style.display = 'none';

                    if (btnToggleMapSize) btnToggleMapSize.style.display = 'none';
                    set2DMapMode('compact', false);


                    // 排位賽：比賽開始前可以自由調整視角，確保視角切換功能啟用
                    if (btnModeOrbit) {
                        btnModeOrbit.disabled = false;
                        btnModeOrbit.title = '3D 自由俯瞰視角';
                    }
                    if (btnResetCam) {
                        btnResetCam.disabled = false;
                        btnResetCam.title = '重設視角至標準角度';
                    }

                    // 關閉一般賽事彈窗
                    document.getElementById('victoryModal').style.display = 'none';
                    document.getElementById('timeoutModal').style.display = 'none';

                    loadRankedMatch(currentRankedSize);
                } else {
                    currentGameMode = 'practice';
                    RankedFx.cancelIntro();

                    practiceSpecBar.style.display = '';
                    document.body.classList.remove('is-ranked', 'ranked-live');
                    practiceToolsToolbar.style.display = 'flex';
                    document.getElementById('practiceToolRail').style.display = 'flex';
                    practiceZoomBar.style.display = 'flex';

                    // 練習賽恢復顯示儲存與我的地圖庫按鈕
                    const btnSaveEl = document.getElementById('btnSave');
                    const btnMapLibraryEl = document.getElementById('btnMapLibrary');
                    if (btnSaveEl) btnSaveEl.style.display = 'inline-flex';
                    if (btnMapLibraryEl) btnMapLibraryEl.style.display = 'flex';
                    updateAuthUI(currentUser);

                    if (btnModeOrbit) {
                        btnModeOrbit.disabled = false;
                        btnModeOrbit.title = '3D 自由俯瞰視角';
                    }
                    if (btnResetCam) {
                        btnResetCam.disabled = false;
                        btnResetCam.title = '重設視角至標準角度';
                    }

                    if (btnToggleMapSize) btnToggleMapSize.style.display = 'inline-flex';

                    // 關閉排位賽彈窗
                    document.getElementById('rankedVictoryModal').style.display = 'none';
                    document.getElementById('rankedTimeoutModal').style.display = 'none';

                    maze3D.stopDriving();
                    resetTimer();
                    maze3D.arenaColor = null;

                    // 重新載入練習賽迷宮
                    loadMazeConfig();
                    showToast('已切換為【練習賽】模式！');
                }
            }

            btnModeRanked?.addEventListener('click', () => switchGameMode('ranked'));

            // 段位資料：徽章等級、名稱與限時（顏色寫在 CSS 的 [data-tier]）
            const RANKED_TIERS = {
                '10x10': { level: 1, name: '菁英級', en: 'ELITE', limit: '1 分鐘', clock: '01:00', view: 3 },
                '15x15': { level: 2, name: '戰將級', en: 'WARLORD', limit: '3 分鐘', clock: '03:00', view: 3.5 },
                '20x20': { level: 3, name: '大師級', en: 'MASTER', limit: '20 分鐘', clock: '20:00', view: 4 },
                '25x25': { level: 4, name: '宗師級', en: 'GRANDMASTER', limit: '30 分鐘', clock: '30:00', view: 4.5 },
                '30x30': { level: 5, name: '傳奇級', en: 'LEGEND', limit: '40 分鐘', clock: '40:00', view: 5 }
            };

            // 切換段位主題：主色、大廳徽章與段位名、按鈕選取狀態
            function applyTierTheme(size) {
                const t = RANKED_TIERS[size];
                document.body.dataset.tier = size;
                document.getElementById('lobbyCrestUse').setAttribute('href', `assets/icons.svg#crest-${t.level}`);
                document.getElementById('lobbyTierEn').textContent = `${t.en}・TIER ${t.level}`;
                document.getElementById('lobbyTierName').textContent = t.name;
                document.getElementById('liveCrestUse').setAttribute('href', `assets/icons.svg#crest-${t.level}`);
                document.getElementById('liveTierName').textContent = t.name;
                document.getElementById('lobbyLimitClock').textContent = t.clock;
                document.getElementById('lobbyTierSub').textContent = `${size.replace('x', ' × ')} 迷宮・限時 ${t.limit}`;
                document.querySelectorAll('.ranked-tier-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.getAttribute('data-size') === size);
                });
            }

            function loadRankedMatch(size = '10x10') {
                if (!RANKED_TIERS[size]) {
                    size = '10x10';
                }
                currentRankedSize = size;
                applyTierTheme(size);
                RankedFx.cancelIntro();
                document.body.classList.remove('ranked-live');

                maze3D.stopDriving();
                resetTimer();
                if (editor) editor.clearCarTrail();

                document.getElementById('rankedVictoryModal').style.display = 'none';
                document.getElementById('rankedTimeoutModal').style.display = 'none';

                fetch('api/ranked.php?action=get_map&size=' + encodeURIComponent(size))
                    .then(res => res.json())
                    .then(res => {
                        if (res.success && res.mapData) {
                            currentRankedSize = res.size;
                            currentRankedMapId = res.mapId;
                            countdownLimitMs = res.timeLimitMs;
                            countdownDesc = res.timeLimitDesc;
                            countdownLabel = `${res.size}排位賽`;

                            // 設定倒數計時模式
                            currentTimerMode = 'down';
                            btnTimerCountDown.classList.add('active');
                            btnTimerCountUp.classList.remove('active');
                            if (countdownBtnLabel) countdownBtnLabel.textContent = `${countdownDesc}倒數`;

                            // 載入地圖至 3D（排位賽場景帶段位色：牆頂發光、終點光柱）
                            maze3D.arenaColor = getComputedStyle(document.body).getPropertyValue('--tier').trim();
                            maze3D.buildMaze3D(res.mapData);
                            maze3D.placePlayerAtStart();
                            if (maze3D.currentMode === 'orbit') {
                                maze3D.resetOrbitCamera();
                            }
                            resetTimer();

                            // 排位賽開始前：允許自由切換調整視角
                            if (btnModeOrbit) {
                                btnModeOrbit.disabled = false;
                                btnModeOrbit.title = '3D 自由俯瞰視角';
                            }
                            if (btnResetCam) {
                                btnResetCam.disabled = false;
                                btnResetCam.title = '重設視角至標準角度';
                            }

                            // 更新排位賽提示資訊
                            const tierTitle = `${size.replace('x', '×')} ${RANKED_TIERS[size].name}`;
                            const mapNameEl = document.getElementById('rankedMapName');
                            const limitTextEl = document.getElementById('rankedLimitText');

                            document.getElementById('rankedMapId').textContent = res.mapId;
                            if (mapNameEl) mapNameEl.textContent = `${res.mapData.author || '官方'}出題・${size.replace('x', ' × ')}`;
                            if (limitTextEl) limitTextEl.textContent = res.timeLimitDesc;
                            document.getElementById('liveMapId').textContent = res.mapId;
                            refreshLobbyScore(size);

                            // 更新 header 標籤
                            const tagGrid = document.getElementById('headerTagGrid');
                            const tagTotal = document.getElementById('headerTagTotal');
                            const dim = res.mapData.gridSize?.cols || parseInt(size, 10);
                            if (tagGrid) tagGrid.textContent = `排位規格：${size}`;
                            if (tagTotal) tagTotal.textContent = `總長寬：${dim * 30}×${dim * 30} cm`;

                            btnStartDrive.classList.add('pulse-prompt');
                            showToast(`已換成 ${tierTitle} 的 ${res.mapId}`);
                        } else {
                            if (res.requireLogin) {
                                openAuthModal(res.message, 'login');
                            } else {
                                showToast(res.message || '載入排位賽地圖失敗', true);
                            }
                        }
                    })
                    .catch(err => {
                        console.error('載入排位賽失敗:', err);
                        showToast('無法連接排位伺服器', true);
                    });
            }

            // 大廳：我的成績、開始比賽、看排行榜
            function refreshLobbyScore(size) {
                fetch('api/ranked.php?action=leaderboard&size=' + encodeURIComponent(size))
                    .then(res => res.json())
                    .then(res => {
                        const best = res.userBest;
                        const top = res.list && res.list[0];
                        document.getElementById('lobbyBest').textContent = best ? formatTimeDisplay(best.bestMs) : '—';
                        document.getElementById('lobbyRank').textContent = best ? `全服第 ${best.rank} 名` : '還沒有成績';
                        document.getElementById('lobbyTop').textContent = top ? formatTimeDisplay(top.timeUsedMs) : '—';
                        document.getElementById('lobbyTopName').textContent = top ? top.username : '還沒有人完賽';
                    })
                    .catch(() => {});
            }
            // 開始挑戰：先播開賽儀式（段位橫幅 → 3、2、1），GO! 時才真正開始比賽
            document.getElementById('btnLobbyStart').addEventListener('click', () => {
                if (!currentRankedMapId || maze3D.isDriving) return;
                const tier = RANKED_TIERS[currentRankedSize];
                document.body.classList.add('ranked-live');
                RankedFx.intro(
                    document.querySelector('.sim-stage'),
                    tier,
                    `${currentRankedSize.replace('x', ' × ')}・${currentRankedMapId}・限時 ${tier.limit}`,
                    () => {
                        maze3D.placePlayerAtStart();
                        maze3D.setMode('driver');
                    },
                    () => btnStartDrive.click()
                );
            });
            document.getElementById('btnLobbyLeaderboard').addEventListener('click', () => openLeaderboardModal(currentRankedSize));
            document.getElementById('btnLobbyBackPractice').addEventListener('click', () => switchGameMode('practice'));

            // 排位賽級別選擇按鈕事件
            document.querySelectorAll('.ranked-tier-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const size = btn.getAttribute('data-size');
                    if (size) {
                        loadRankedMatch(size);
                    }
                });
            });

            // 隨機換圖按鈕
            document.getElementById('btnRepickMap')?.addEventListener('click', () => {
                loadRankedMatch(currentRankedSize);
            });

            // 排位賽通關彈窗按鈕事件
            document.getElementById('btnRankedNextMatch')?.addEventListener('click', () => {
                document.getElementById('rankedVictoryModal').style.display = 'none';
                loadRankedMatch(currentRankedSize);
            });

            document.getElementById('btnRankedViewLeaderboard')?.addEventListener('click', () => {
                document.getElementById('rankedVictoryModal').style.display = 'none';
                document.body.classList.remove('ranked-live');
                openLeaderboardModal(currentRankedSize);
            });

            document.getElementById('btnRankedBackToPractice')?.addEventListener('click', () => {
                document.getElementById('rankedVictoryModal').style.display = 'none';
                switchGameMode('practice');
            });

            // 排位賽超時彈窗按鈕事件
            document.getElementById('btnRankedTimeoutRetry')?.addEventListener('click', () => {
                document.getElementById('rankedTimeoutModal').style.display = 'none';
                document.body.classList.remove('ranked-live');
                maze3D.stopDriving();
                maze3D.placePlayerAtStart();
                resetTimer();
                if (editor) editor.clearCarTrail();
                btnStartDrive.classList.add('pulse-prompt');
                showToast('已回到起點，按「開始挑戰」重新挑戰！');
            });

            document.getElementById('btnRankedTimeoutNewMap')?.addEventListener('click', () => {
                document.getElementById('rankedTimeoutModal').style.display = 'none';
                loadRankedMatch(currentRankedSize);
            });

            document.getElementById('btnRankedTimeoutLeaderboard')?.addEventListener('click', () => {
                document.getElementById('rankedTimeoutModal').style.display = 'none';
                document.body.classList.remove('ranked-live');
                openLeaderboardModal(currentRankedSize);
            });

            document.getElementById('btnRankedTimeoutBackPractice')?.addEventListener('click', () => {
                document.getElementById('rankedTimeoutModal').style.display = 'none';
                switchGameMode('practice');
            });

            // 排行榜 Modal 操作
            function openLeaderboardModal(size = '10x10') {
                if (!leaderboardModalBackdrop) return;
                currentLeaderboardTab = size;
                leaderboardModalBackdrop.classList.add('show');

                // 切換頁籤 active
                document.querySelectorAll('.leaderboard-tab-btn').forEach(btn => {
                    if (btn.getAttribute('data-size') === size) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });

                loadLeaderboardData(size);
            }

            function closeLeaderboardModal() {
                if (!leaderboardModalBackdrop) return;
                leaderboardModalBackdrop.classList.remove('show');
            }

            function loadLeaderboardData(size) {
                if (!leaderboardTableBody) return;
                // 彈窗主色、徽章跟著目前段位頁籤
                const tier = RANKED_TIERS[size];
                leaderboardModalBackdrop.dataset.tier = size;
                document.getElementById('boardCrestUse').setAttribute('href', `assets/icons.svg#crest-${tier.level}`);
                document.getElementById('boardKicker').textContent = `LEADERBOARD・${tier.en}`;
                leaderboardTableBody.innerHTML = '<tr><td colspan="6" class="table-note">載入中…</td></tr>';

                fetch('api/ranked.php?action=leaderboard&size=' + encodeURIComponent(size))
                    .then(res => res.json())
                    .then(res => {
                        if (res.success) {
                            renderLeaderboard(res);
                        } else {
                            leaderboardTableBody.innerHTML = `<tr><td colspan="6" class="table-note error">無法載入排行榜：${escapeHtml(res.message || '未知錯誤')}</td></tr>`;
                        }
                    })
                    .catch(err => {
                        leaderboardTableBody.innerHTML = '<tr><td colspan="6" class="table-note error">無法連線到伺服器，請稍後再試</td></tr>';
                    });
            }

            function renderLeaderboard(data) {
                const list = data.list || [];
                const userBest = data.userBest;

                // 更新個人最佳資訊
                if (userBestBanner) {
                    if (userBest) {
                        const bestSec = (userBest.bestMs / 1000).toFixed(2);
                        userBestBanner.innerHTML = `
                            <div class="stat"><span class="stat-label">我的最佳</span><span class="stat-value best">${bestSec} 秒</span></div>
                            <div class="stat"><span class="stat-label">全服排名</span><span class="stat-value">第 ${userBest.rank} 名</span></div>
                        `;
                    } else {
                        userBestBanner.innerHTML = `
                            <div class="stat"><span class="stat-label">我的最佳</span><span class="stat-value">—</span></div>
                            <div class="stat"><span class="stat-label">${currentUser ? '完成這個級別一場就會上榜' : '登入後才能上榜'}</span></div>
                        `;
                    }
                    if (data.myMapCount) {
                        userBestBanner.innerHTML += `<div class="stat end"><span class="stat-label">我建立的排位地圖</span><span>本級別 ${data.myMapCount.size} 張・共 ${data.myMapCount.total} 張</span></div>`;
                    }
                }

                if (list.length === 0) {
                    leaderboardTableBody.innerHTML = '<tr><td colspan="6" class="table-note">這個級別還沒有人完賽，你可以拿下第一名</td></tr>';
                    return;
                }

                let html = '';
                list.forEach(row => {
                    const isMe = currentUser && (currentUser.id === row.userId || currentUser.username === row.username);
                    const rankBadge = row.rank <= 3 ? `<span class="medal medal-${row.rank}">${row.rank}</span>` : `<span class="rank-num">${row.rank}</span>`;

                    const usedSec = (row.timeUsedMs / 1000).toFixed(2) + ' 秒';
                    const remainSec = (row.timeRemainMs / 1000).toFixed(2) + ' 秒';
                    const mapBadge = escapeHtml(row.mapId);
                    const dateStr = row.createdAt ? row.createdAt.substring(0, 16) : '-';

                    html += `
                        <tr class="${isMe ? 'is-me' : ''}${row.rank <= 3 ? ` top-${row.rank}` : ''}">
                            <td>${rankBadge}</td>
                            <td>${escapeHtml(row.username)}${isMe ? ' <span class="me-tag">（你）</span>' : ''}</td>
                            <td class="num strong">${usedSec}</td>
                            <td class="num muted">${remainSec}</td>
                            <td class="num muted">${mapBadge}</td>
                            <td class="muted">${dateStr}</td>
                        </tr>
                    `;
                });

                leaderboardTableBody.innerHTML = html;
            }

            btnOpenLeaderboard?.addEventListener('click', () => {
                openLeaderboardModal(currentRankedSize);
            });

            btnCloseLeaderboardModal?.addEventListener('click', closeLeaderboardModal);
            leaderboardModalBackdrop?.addEventListener('click', (e) => {
                if (e.target === leaderboardModalBackdrop) closeLeaderboardModal();
            });

            document.querySelectorAll('.leaderboard-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const size = btn.getAttribute('data-size');
                    if (size) {
                        currentLeaderboardTab = size;
                        document.querySelectorAll('.leaderboard-tab-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        loadLeaderboardData(size);
                    }
                });
            });

            btnRefreshLeaderboard?.addEventListener('click', () => {
                loadLeaderboardData(currentLeaderboardTab);
            });

            // 排位賽地圖總覽 Modal
            const rankedGalleryBackdrop = document.getElementById('rankedGalleryBackdrop');
            const rankedGalleryList = document.getElementById('rankedGalleryList');

            // 用 SVG 畫出迷宮簡易預覽 (座標一律轉成數字，避免地圖檔內容被當成 HTML)
            function mazePreviewSvg(m) {
                const rows = Number(m.gridSize?.rows) || 10;
                const cols = Number(m.gridSize?.cols) || 10;
                let d = '';
                (m.hWalls || []).forEach((row, r) => row.forEach((w, c) => { if (w) d += `M${c} ${r}h1`; }));
                (m.vWalls || []).forEach((row, r) => row.forEach((w, c) => { if (w) d += `M${c} ${r}v1`; }));
                const cell = (p, color) => p ? `<rect x="${Number(p.x) + 0.15}" y="${Number(p.y) + 0.15}" width="0.7" height="0.7" fill="${color}"/>` : '';
                return `<svg viewBox="-0.2 -0.2 ${cols + 0.4} ${rows + 0.4}">${cell(m.start, '#22c55e')}${cell(m.goal, '#ef4444')}<path d="${d}" stroke="#e2e8f0" stroke-width="0.12" stroke-linecap="square" fill="none"/></svg>`;
            }

            function openRankedGallery() {
                if (maze3D.isDriving) {
                    showToast('排位賽進行中無法查看地圖總覽', true);
                    return;
                }
                rankedGalleryBackdrop.classList.add('show');
                rankedGalleryList.innerHTML = '<div class="list-note">載入中…</div>';

                fetch('api/ranked.php?action=list_maps')
                    .then(res => res.json())
                    .then(res => {
                        if (!res.success) {
                            rankedGalleryList.innerHTML = `<div class="list-note error">無法載入地圖總覽：${escapeHtml(res.message || '未知錯誤')}</div>`;
                            return;
                        }
                        let html = '';
                        Object.entries(res.maps).forEach(([size, maps]) => {
                            html += `<h4 class="ranked-gallery-tier">${size.replace('x', '×')}（${maps.length} 張）</h4><div class="ranked-gallery-grid">`;
                            maps.forEach(m => {
                                const isCurrent = size === currentRankedSize && m.mapId === currentRankedMapId;
                                html += `
                                    <div class="ranked-gallery-item${isCurrent ? ' is-current' : ''}" title="${escapeHtml(String(m.name || m.mapId))}">
                                        ${mazePreviewSvg(m)}
                                        <div class="ranked-gallery-name">${escapeHtml(String(m.mapId))}${isCurrent ? '（本場）' : ''}</div>
                                        <div class="ranked-gallery-author">${escapeHtml(String(m.author || '官方'))}</div>
                                    </div>
                                `;
                            });
                            html += '</div>';
                        });
                        rankedGalleryList.innerHTML = html;
                    })
                    .catch(() => {
                        rankedGalleryList.innerHTML = '<div class="list-note error">無法連線到伺服器，請稍後再試</div>';
                    });
            }

            document.getElementById('btnOpenRankedGallery')?.addEventListener('click', openRankedGallery);
            document.getElementById('btnCloseRankedGallery')?.addEventListener('click', () => rankedGalleryBackdrop.classList.remove('show'));
            rankedGalleryBackdrop?.addEventListener('click', (e) => {
                if (e.target === rankedGalleryBackdrop) rankedGalleryBackdrop.classList.remove('show');
            });

            // ============================================
            // 10-1. 分享碼系統 (限時 1 分鐘，限 3 人使用)
            // ============================================
            const createShareModalBackdrop = document.getElementById('createShareModalBackdrop');
            const btnCloseCreateShareModal = document.getElementById('btnCloseCreateShareModal');
            const btnCancelCreateShare = document.getElementById('btnCancelCreateShare');
            const btnDoGenerateShare = document.getElementById('btnDoGenerateShare');
            const btnCopyShareCode = document.getElementById('btnCopyShareCode');
            const shareGeneratedArea = document.getElementById('shareGeneratedArea');
            const shareInitialArea = document.getElementById('shareInitialArea');
            const shareCodeDisplay = document.getElementById('shareCodeDisplay');
            const shareCountdownSeconds = document.getElementById('shareCountdownSeconds');
            const shareProgressFill = document.getElementById('shareProgressFill');
            const shareUsedCount = document.getElementById('shareUsedCount');
            const shareTimerBadge = document.getElementById('shareTimerBadge');
            const shareStatusNote = document.getElementById('shareStatusNote');
            const shareAlert = document.getElementById('shareAlert');

            let shareTimerInterval = null;
            let shareStatusPollInterval = null;
            let currentShareCode = null;
            let shareExpiresTimestamp = 0;

            function clearShareTimers() {
                if (shareTimerInterval) { clearInterval(shareTimerInterval); shareTimerInterval = null; }
                if (shareStatusPollInterval) { clearInterval(shareStatusPollInterval); shareStatusPollInterval = null; }
            }

            function openCreateShareModal() {
                if (!currentUser) {
                    openAuthModal('請先登入帳號以使用分享碼功能！', 'login');
                    return;
                }
                if (currentUser.role === 'junior') {
                    showToast('🔒 權限限制：初級使用者不能產生分享碼，只能使用別人的分享碼載入地圖！', true);
                    return;
                }

                clearShareTimers();
                currentShareCode = null;
                if (shareAlert) { shareAlert.style.display = 'none'; shareAlert.textContent = ''; }
                if (shareInitialArea) shareInitialArea.style.display = 'block';
                if (shareGeneratedArea) shareGeneratedArea.style.display = 'none';
                if (btnDoGenerateShare) {
                    btnDoGenerateShare.style.display = 'inline-flex';
                    btnDoGenerateShare.disabled = false;
                    btnDoGenerateShare.innerHTML = '<svg class="icon"><use href="assets/icons.svg#share"></use></svg>產生分享碼';
                }
                if (btnCopyShareCode) btnCopyShareCode.style.display = 'none';

                const cols = editor.cols;
                const rows = editor.rows;
                const modalSpec = document.getElementById('shareModalSpec');
                const modalName = document.getElementById('shareModalName');
                if (modalSpec) modalSpec.textContent = `${cols} × ${rows}`;
                if (modalName) modalName.textContent = `我的迷宮 (${cols}×${rows})`;

                createShareModalBackdrop?.classList.add('show');
            }

            function closeCreateShareModal() {
                clearShareTimers();
                createShareModalBackdrop?.classList.remove('show');
            }

            function updateShareCountdownUI() {
                const remainMs = shareExpiresTimestamp - Date.now();
                const remainSec = Math.max(0, Math.ceil(remainMs / 1000));
                if (shareCountdownSeconds) shareCountdownSeconds.textContent = remainSec;

                const percent = Math.max(0, (remainSec / 60) * 100);
                if (shareProgressFill) shareProgressFill.style.width = `${percent}%`;

                if (remainSec <= 10) {
                    shareTimerBadge?.classList.add('danger');
                    shareProgressFill?.classList.add('danger');
                } else {
                    shareTimerBadge?.classList.remove('danger');
                    shareProgressFill?.classList.remove('danger');
                }

                if (remainSec <= 0) {
                    clearShareTimers();
                    if (shareStatusNote) {
                        shareStatusNote.textContent = '⏰ 分享碼已逾期失效（有效期限 1 分鐘）。如需分享請重新產生。';
                        shareStatusNote.className = 'dlg-note danger';
                    }
                    if (btnCopyShareCode) btnCopyShareCode.style.display = 'none';
                }
            }

            function pollShareStatus() {
                if (!currentShareCode) return;
                fetch(`api/share.php?action=status&code=${encodeURIComponent(currentShareCode)}`)
                    .then(res => res.json())
                    .then(res => {
                        if (res.success) {
                            if (shareUsedCount) shareUsedCount.textContent = res.usedCount;
                            if (res.isFull) {
                                clearShareTimers();
                                if (shareStatusNote) {
                                    shareStatusNote.textContent = '🎉 此分享碼已達 3 人使用上限！';
                                    shareStatusNote.className = 'dlg-note text-go';
                                }
                                if (btnCopyShareCode) btnCopyShareCode.style.display = 'none';
                            }
                        }
                    })
                    .catch(() => {});
            }

            btnDoGenerateShare?.addEventListener('click', () => {
                btnDoGenerateShare.disabled = true;
                btnDoGenerateShare.textContent = '產生中…';

                const mapData = editor.getData();
                const mapName = `我的迷宮 (${editor.cols}×${editor.rows})`;

                fetch('api/share.php?action=create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mapData, name: mapName })
                })
                .then(res => res.json())
                .then(res => {
                    if (!res.success) {
                        btnDoGenerateShare.disabled = false;
                        btnDoGenerateShare.innerHTML = '<svg class="icon"><use href="assets/icons.svg#share"></use></svg>產生分享碼';
                        if (shareAlert) {
                            shareAlert.className = 'auth-alert error';
                            shareAlert.textContent = res.message || '產生分享碼失敗';
                            shareAlert.style.display = 'block';
                        }
                        return;
                    }

                    currentShareCode = res.code;
                    shareExpiresTimestamp = Date.now() + (res.durationSec || 60) * 1000;

                    if (shareInitialArea) shareInitialArea.style.display = 'none';
                    if (shareGeneratedArea) shareGeneratedArea.style.display = 'block';
                    if (btnDoGenerateShare) btnDoGenerateShare.style.display = 'none';
                    if (btnCopyShareCode) {
                        btnCopyShareCode.style.display = 'inline-flex';
                        btnCopyShareCode.innerHTML = '<svg class="icon"><use href="assets/icons.svg#copy"></use></svg>複製分享碼';
                    }

                    if (shareCodeDisplay) shareCodeDisplay.textContent = res.code;
                    if (shareUsedCount) shareUsedCount.textContent = '0';
                    if (shareStatusNote) {
                        shareStatusNote.textContent = '分享碼已儲存於資料庫，複製後請盡快傳送給朋友！';
                        shareStatusNote.className = 'dlg-note';
                    }

                    updateShareCountdownUI();
                    shareTimerInterval = setInterval(updateShareCountdownUI, 1000);
                    shareStatusPollInterval = setInterval(pollShareStatus, 2000);
                })
                .catch(() => {
                    btnDoGenerateShare.disabled = false;
                    btnDoGenerateShare.innerHTML = '<svg class="icon"><use href="assets/icons.svg#share"></use></svg>產生分享碼';
                    if (shareAlert) {
                        shareAlert.className = 'auth-alert error';
                        shareAlert.textContent = '無法連線到伺服器產生分享碼';
                        shareAlert.style.display = 'block';
                    }
                });
            });

            btnCopyShareCode?.addEventListener('click', () => {
                if (!currentShareCode) return;
                navigator.clipboard.writeText(currentShareCode).then(() => {
                    btnCopyShareCode.innerHTML = '<svg class="icon"><use href="assets/icons.svg#check"></use></svg>已複製！';
                    showToast(`分享碼【${currentShareCode}】已複製到剪貼簿！`);
                    setTimeout(() => {
                        if (btnCopyShareCode) btnCopyShareCode.innerHTML = '<svg class="icon"><use href="assets/icons.svg#copy"></use></svg>複製分享碼';
                    }, 2000);
                }).catch(() => {
                    showToast(`分享碼為：${currentShareCode}`);
                });
            });

            btnCloseCreateShareModal?.addEventListener('click', closeCreateShareModal);
            btnCancelCreateShare?.addEventListener('click', closeCreateShareModal);
            createShareModalBackdrop?.addEventListener('click', (e) => {
                if (e.target === createShareModalBackdrop) closeCreateShareModal();
            });

            // 兌換載入分享碼
            const redeemShareModalBackdrop = document.getElementById('redeemShareModalBackdrop');
            const btnCloseRedeemShareModal = document.getElementById('btnCloseRedeemShareModal');
            const btnCancelRedeemShare = document.getElementById('btnCancelRedeemShare');
            const btnConfirmRedeemShare = document.getElementById('btnConfirmRedeemShare');
            const inputRedeemCode = document.getElementById('inputRedeemCode');
            const redeemAlert = document.getElementById('redeemAlert');

            function openRedeemShareModal() {
                if (!currentUser) {
                    openAuthModal('請先登入帳號以載入他人分享的地圖！', 'login');
                    return;
                }
                if (redeemAlert) { redeemAlert.style.display = 'none'; redeemAlert.textContent = ''; }
                if (inputRedeemCode) { inputRedeemCode.value = ''; }
                redeemShareModalBackdrop?.classList.add('show');
                setTimeout(() => inputRedeemCode?.focus(), 100);
            }

            function closeRedeemShareModal() {
                redeemShareModalBackdrop?.classList.remove('show');
                if (redeemAlert) redeemAlert.style.display = 'none';
            }

            btnConfirmRedeemShare?.addEventListener('click', () => {
                const code = inputRedeemCode ? inputRedeemCode.value.trim().toUpperCase() : '';
                if (!code) {
                    if (redeemAlert) {
                        redeemAlert.className = 'auth-alert error';
                        redeemAlert.textContent = '請輸入 6 碼分享代碼！';
                        redeemAlert.style.display = 'block';
                    }
                    return;
                }

                btnConfirmRedeemShare.disabled = true;
                btnConfirmRedeemShare.textContent = '驗證載入中…';

                fetch('api/share.php?action=redeem', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                })
                .then(res => res.json())
                .then(res => {
                    btnConfirmRedeemShare.disabled = false;
                    btnConfirmRedeemShare.innerHTML = '<svg class="icon"><use href="assets/icons.svg#file-import"></use></svg>載入迷宮';

                    if (!res.success) {
                        if (redeemAlert) {
                            redeemAlert.className = 'auth-alert error';
                            redeemAlert.textContent = res.message || '兌換失敗';
                            redeemAlert.style.display = 'block';
                        }
                        return;
                    }

                    closeRedeemShareModal();
                    if (res.data) {
                        editor.loadData(res.data);
                        maze3D.resetOrbitCamera();
                    }
                    showToast(res.message);
                })
                .catch(() => {
                    btnConfirmRedeemShare.disabled = false;
                    btnConfirmRedeemShare.innerHTML = '<svg class="icon"><use href="assets/icons.svg#file-import"></use></svg>載入迷宮';
                    if (redeemAlert) {
                        redeemAlert.className = 'auth-alert error';
                        redeemAlert.textContent = '伺服器連線失敗，請稍後再試';
                        redeemAlert.style.display = 'block';
                    }
                });
            });

            btnCloseRedeemShareModal?.addEventListener('click', closeRedeemShareModal);
            btnCancelRedeemShare?.addEventListener('click', closeRedeemShareModal);
            redeemShareModalBackdrop?.addEventListener('click', (e) => {
                if (e.target === redeemShareModalBackdrop) closeRedeemShareModal();
            });

            document.getElementById('btnOpenCreateShare')?.addEventListener('click', openCreateShareModal);
            document.getElementById('btnOpenRedeemShare')?.addEventListener('click', openRedeemShareModal);

            // ============================================
            // 11. 練習賽一鍵發布至官方排位賽圖庫
            // ============================================
            function isMazeSolvable(data) {
                if (!data) return false;
                const cols = data.gridSize?.cols || (data.hWalls ? data.hWalls[0].length : 10);
                const rows = data.gridSize?.rows || (data.hWalls ? data.hWalls.length - 1 : 10);
                const start = data.start || { x: 0, y: rows - 1 };
                const goal = data.goal || { x: cols - 1, y: 0 };
                const hWalls = data.hWalls;
                const vWalls = data.vWalls;

                if (!hWalls || !vWalls) return false;
                if (start.x === goal.x && start.y === goal.y) return true;

                const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
                const queue = [{ x: intval(start.x), y: intval(start.y) }];
                visited[start.y][start.x] = true;

                function intval(v) { return parseInt(v, 10) || 0; }

                while (queue.length > 0) {
                    const curr = queue.shift();
                    if (curr.x === intval(goal.x) && curr.y === intval(goal.y)) return true;

                    const cx = curr.x;
                    const cy = curr.y;

                    // 上 (y - 1)
                    if (cy > 0 && !visited[cy - 1][cx] && !hWalls[cy][cx]) {
                        visited[cy - 1][cx] = true;
                        queue.push({ x: cx, y: cy - 1 });
                    }
                    // 下 (y + 1)
                    if (cy < rows - 1 && !visited[cy + 1][cx] && !hWalls[cy + 1][cx]) {
                        visited[cy + 1][cx] = true;
                        queue.push({ x: cx, y: cy + 1 });
                    }
                    // 左 (x - 1)
                    if (cx > 0 && !visited[cy][cx - 1] && !vWalls[cy][cx]) {
                        visited[cy][cx - 1] = true;
                        queue.push({ x: cx - 1, y: cy });
                    }
                    // 右 (x + 1)
                    if (cx < cols - 1 && !visited[cy][cx + 1] && !vWalls[cy][cx + 1]) {
                        visited[cy][cx + 1] = true;
                        queue.push({ x: cx + 1, y: cy });
                    }
                }
                return false;
            }

            const btnPublishToRanked = document.getElementById('btnPublishToRanked');
            const publishModalBackdrop = document.getElementById('publishModalBackdrop');
            const btnClosePublishModal = document.getElementById('btnClosePublishModal');
            const btnCancelPublish = document.getElementById('btnCancelPublish');
            const btnConfirmPublish = document.getElementById('btnConfirmPublish');
            const publishModalSpec = document.getElementById('publishModalSpec');
            const publishModalPathCheck = document.getElementById('publishModalPathCheck');
            const publishModalStats = document.getElementById('publishModalStats');
            const publishModalAuthor = document.getElementById('publishModalAuthor');
            const publishCustomName = document.getElementById('publishCustomName');

            let pendingPublishData = null;

            function openPublishModal() {
                if (!currentUser) {
                    openAuthModal('訪客限制：【發布至官方排位賽圖庫】需要登入會員帳號！請先登入或免費註冊。', 'login');
                    return;
                }
                if (currentUser.role === 'junior') {
                    showToast('🔒 權限限制：初級使用者不能上傳排位賽地圖！需由高級使用者提升為中級或高級使用者。', true);
                    return;
                }

                const currentData = editor.getData();
                const cols = editor.cols;
                const rows = editor.rows;
                const size = `${cols}x${rows}`;
                const allowed = ['10x10', '15x15', '20x20', '25x25', '30x30'];

                if (!allowed.includes(size)) {
                    showToast(`規格不符：排位賽僅支援 10×10、15×15、20×20、25×25、30×30！目前為 ${cols}×${rows}。`, true);
                    return;
                }

                // 檢查連通性
                const solvable = isMazeSolvable(currentData);
                if (!solvable) {
                    showToast('發布失敗：經路徑運算驗證，此迷宮無法從起點到達終點！請修改內部牆壁確保有通行路徑。', true);
                    return;
                }

                pendingPublishData = currentData;

                const tierLabels = {
                    '10x10': '10×10 菁英級',
                    '15x15': '15×15 戰將級',
                    '20x20': '20×20 大師級',
                    '25x25': '25×25 宗師級',
                    '30x30': '30×30 傳奇級'
                };

                if (publishModalSpec) publishModalSpec.textContent = tierLabels[size] || size;
                if (publishModalPathCheck) publishModalPathCheck.innerHTML = '走得通<svg class="icon" style="color:var(--go)" aria-hidden="true"><use href="assets/icons.svg#check"></use></svg>';

                // 計算牆壁數量
                let hCount = 0;
                currentData.hWalls.forEach(r => r.forEach(v => { if (v) hCount++; }));
                let vCount = 0;
                currentData.vWalls.forEach(r => r.forEach(v => { if (v) vCount++; }));
                const wallTotal = hCount + vCount;

                if (publishModalStats) publishModalStats.textContent = `${wallTotal} 段・${cols * 30} × ${rows * 30} cm`;
                if (publishModalAuthor) publishModalAuthor.textContent = currentUser ? currentUser.username : '訪客';
                if (publishCustomName) publishCustomName.value = '';

                publishModalBackdrop.classList.add('show');
            }

            function closePublishModal() {
                publishModalBackdrop.classList.remove('show');
                pendingPublishData = null;
            }

            btnPublishToRanked?.addEventListener('click', openPublishModal);
            btnClosePublishModal?.addEventListener('click', closePublishModal);
            btnCancelPublish?.addEventListener('click', closePublishModal);
            publishModalBackdrop?.addEventListener('click', (e) => {
                if (e.target === publishModalBackdrop) closePublishModal();
            });

            btnConfirmPublish?.addEventListener('click', () => {
                if (!pendingPublishData) return;
                const customName = publishCustomName ? publishCustomName.value.trim() : '';

                btnConfirmPublish.disabled = true;
                btnConfirmPublish.textContent = '發布中…';

                fetch('api/ranked.php?action=publish_map', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mapData: pendingPublishData,
                        name: customName
                    })
                })
                .then(res => res.json())
                .then(res => {
                    btnConfirmPublish.disabled = false;
                    btnConfirmPublish.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#upload"></use></svg>確認發布';

                    if (res.success) {
                        closePublishModal();
                        showToast(res.message);
                    } else {
                        showToast(res.message || '發布失敗', true);
                    }
                })
                .catch(err => {
                    btnConfirmPublish.disabled = false;
                    btnConfirmPublish.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#upload"></use></svg>確認發布';
                    showToast('無法連接排位賽伺服器進行發布', true);
                });
            });

            // ============================================
            // 12. 高級管理者功能：帳號管理、地圖審核與 2D 預覽、地圖刪除
            // ============================================
            const adminUsersModalBackdrop = document.getElementById('adminUsersModalBackdrop');
            const btnCloseAdminUsersModal = document.getElementById('btnCloseAdminUsersModal');
            const btnRefreshAdminUsers = document.getElementById('btnRefreshAdminUsers');
            const adminUsersTableBody = document.getElementById('adminUsersTableBody');

            function openAdminUsersModal() {
                if (!currentUser || currentUser.role !== 'senior') {
                    showToast('🔒 權限不足：僅高級使用者可管理帳號！', true);
                    return;
                }
                adminUsersModalBackdrop?.classList.add('show');
                loadAdminUsersList();
            }

            function closeAdminUsersModal() {
                adminUsersModalBackdrop?.classList.remove('show');
            }

            function loadAdminUsersList() {
                if (!adminUsersTableBody) return;
                adminUsersTableBody.innerHTML = '<tr><td colspan="5" class="table-note">載入初級與中級帳號清單中…</td></tr>';

                fetch('api/admin.php?action=list_users')
                    .then(res => res.json())
                    .then(res => {
                        if (!res.success) {
                            adminUsersTableBody.innerHTML = `<tr><td colspan="5" class="table-note error">${escapeHtml(res.message || '載入失敗')}</td></tr>`;
                            return;
                        }
                        const users = res.users || [];
                        if (users.length === 0) {
                            adminUsersTableBody.innerHTML = '<tr><td colspan="5" class="table-note">目前沒有初級或中級使用者帳號</td></tr>';
                            return;
                        }

                        let html = '';
                        users.forEach(u => {
                            const isJunior = u.role === 'junior';
                            html += `
                                <tr>
                                    <td><strong>${escapeHtml(u.username)}</strong></td>
                                    <td><span class="role-badge ${escapeHtml(u.role)}">${escapeHtml(u.roleTitle)}</span></td>
                                    <td>${escapeHtml(u.createdAt || '-')}</td>
                                    <td>${escapeHtml(u.lastLogin || '尚未登入')}</td>
                                    <td>
                                        <select class="admin-role-select" data-user-id="${u.id}" data-username="${escapeHtml(u.username)}">
                                            <option value="junior" ${isJunior ? 'selected' : ''}>初級使用者</option>
                                            <option value="intermediate" ${!isJunior ? 'selected' : ''}>中級使用者</option>
                                        </select>
                                    </td>
                                </tr>
                            `;
                        });
                        adminUsersTableBody.innerHTML = html;

                        // 監聽身分變更事件
                        adminUsersTableBody.querySelectorAll('.admin-role-select').forEach(sel => {
                            sel.addEventListener('change', (e) => {
                                const targetUserId = parseInt(e.target.getAttribute('data-user-id'), 10);
                                const targetUsername = e.target.getAttribute('data-username');
                                const newRole = e.target.value;
                                e.target.disabled = true;

                                fetch('api/admin.php?action=update_user_role', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ userId: targetUserId, role: newRole })
                                })
                                .then(r => r.json())
                                .then(r => {
                                    e.target.disabled = false;
                                    if (r.success) {
                                        showToast(r.message || `已將【${targetUsername}】身分變更！`);
                                        loadAdminUsersList();
                                    } else {
                                        showToast(r.message || '變更失敗', true);
                                        loadAdminUsersList();
                                    }
                                })
                                .catch(() => {
                                    e.target.disabled = false;
                                    showToast('連線失敗，無法更新權限', true);
                                    loadAdminUsersList();
                                });
                            });
                        });
                    })
                    .catch(() => {
                        adminUsersTableBody.innerHTML = '<tr><td colspan="5" class="table-note error">無法連線至管理員伺服器</td></tr>';
                    });
            }

            btnCloseAdminUsersModal?.addEventListener('click', closeAdminUsersModal);
            btnRefreshAdminUsers?.addEventListener('click', loadAdminUsersList);
            adminUsersModalBackdrop?.addEventListener('click', (e) => {
                if (e.target === adminUsersModalBackdrop) closeAdminUsersModal();
            });
            document.getElementById('btnAdminUsers')?.addEventListener('click', openAdminUsersModal);

            // ============================================
            // 12-1. 排位賽地圖審核、官方題庫管理與刪除
            // ============================================
            const adminReviewModalBackdrop = document.getElementById('adminReviewModalBackdrop');
            const btnCloseAdminReviewModal = document.getElementById('btnCloseAdminReviewModal');
            const btnRefreshAdminReview = document.getElementById('btnRefreshAdminReview');
            const tabAdminPending = document.getElementById('tabAdminPending');
            const tabAdminOfficial = document.getElementById('tabAdminOfficial');
            const panelAdminPending = document.getElementById('panelAdminPending');
            const panelAdminOfficial = document.getElementById('panelAdminOfficial');
            const adminSubmissionsTableBody = document.getElementById('adminSubmissionsTableBody');
            const adminOfficialMapsTableBody = document.getElementById('adminOfficialMapsTableBody');
            const tabPendingCount = document.getElementById('tabPendingCount');

            let currentAdminReviewTab = 'pending'; // 'pending' | 'official'

            function openAdminReviewModal() {
                if (!currentUser || currentUser.role !== 'senior') {
                    showToast('🔒 權限不足：僅高級使用者可審核地圖！', true);
                    return;
                }
                adminReviewModalBackdrop?.classList.add('show');
                switchAdminReviewTab(currentAdminReviewTab);
            }

            function closeAdminReviewModal() {
                adminReviewModalBackdrop?.classList.remove('show');
            }

            function switchAdminReviewTab(tab) {
                currentAdminReviewTab = tab;
                if (tab === 'pending') {
                    tabAdminPending?.classList.add('active');
                    tabAdminOfficial?.classList.remove('active');
                    if (panelAdminPending) panelAdminPending.style.display = 'block';
                    if (panelAdminOfficial) panelAdminOfficial.style.display = 'none';
                    loadAdminSubmissionsList();
                } else {
                    tabAdminPending?.classList.remove('active');
                    tabAdminOfficial?.classList.add('active');
                    if (panelAdminPending) panelAdminPending.style.display = 'none';
                    if (panelAdminOfficial) panelAdminOfficial.style.display = 'block';
                    loadAdminOfficialMapsList();
                }
            }

            tabAdminPending?.addEventListener('click', () => switchAdminReviewTab('pending'));
            tabAdminOfficial?.addEventListener('click', () => switchAdminReviewTab('official'));
            btnCloseAdminReviewModal?.addEventListener('click', closeAdminReviewModal);
            btnRefreshAdminReview?.addEventListener('click', () => {
                if (currentAdminReviewTab === 'pending') loadAdminSubmissionsList();
                else loadAdminOfficialMapsList();
            });
            adminReviewModalBackdrop?.addEventListener('click', (e) => {
                if (e.target === adminReviewModalBackdrop) closeAdminReviewModal();
            });
            document.getElementById('btnAdminReview')?.addEventListener('click', openAdminReviewModal);

            // 載入待審核清單
            function loadAdminSubmissionsList() {
                if (!adminSubmissionsTableBody) return;
                adminSubmissionsTableBody.innerHTML = '<tr><td colspan="5" class="table-note">載入待審核地圖清單中…</td></tr>';

                fetch('api/admin.php?action=list_submissions&status=pending')
                    .then(res => res.json())
                    .then(res => {
                        if (!res.success) {
                            adminSubmissionsTableBody.innerHTML = `<tr><td colspan="5" class="table-note error">${escapeHtml(res.message || '載入失敗')}</td></tr>`;
                            return;
                        }
                        const subs = res.submissions || [];
                        if (tabPendingCount) tabPendingCount.textContent = subs.length;
                        refreshAdminPendingCount();

                        if (subs.length === 0) {
                            adminSubmissionsTableBody.innerHTML = '<tr><td colspan="5" class="table-note">目前沒有待審核的排位賽地圖</td></tr>';
                            return;
                        }

                        let html = '';
                        subs.forEach(s => {
                            html += `
                                <tr>
                                    <td><span class="role-badge intermediate">${escapeHtml(s.size)}</span></td>
                                    <td><strong>${escapeHtml(s.name)}</strong></td>
                                    <td>${escapeHtml(s.authorName)}</td>
                                    <td>${escapeHtml(s.createdAt)}</td>
                                    <td class="actions">
                                        <button type="button" class="tool-btn btn-ghost btn-sm btn-preview-2d" data-json='${escapeHtml(JSON.stringify(s.mazeData))}' data-title="${escapeHtml(s.name)}" data-meta="${escapeHtml(s.authorName + ' ・ ' + s.createdAt)}"><svg class="icon"><use href="assets/icons.svg#focus-centered"></use></svg>2D 地圖</button>
                                        <button type="button" class="tool-btn btn-save btn-sm btn-approve-sub" data-sub-id="${s.id}"><svg class="icon"><use href="assets/icons.svg#check"></use></svg>核准</button>
                                        <button type="button" class="tool-btn btn-ghost btn-sm text-danger btn-reject-sub" data-sub-id="${s.id}"><svg class="icon"><use href="assets/icons.svg#x"></use></svg>退回</button>
                                    </td>
                                </tr>
                            `;
                        });
                        adminSubmissionsTableBody.innerHTML = html;

                        // 綁定 2D 預覽、核准、退回按鈕
                        adminSubmissionsTableBody.querySelectorAll('.btn-preview-2d').forEach(btn => {
                            btn.addEventListener('click', () => {
                                const rawJson = btn.getAttribute('data-json');
                                const title = btn.getAttribute('data-title');
                                const meta = btn.getAttribute('data-meta');
                                try {
                                    const mazeData = JSON.parse(rawJson);
                                    openPreview2DModal(mazeData, title, meta);
                                } catch (e) {
                                    showToast('解析地圖資料失敗', true);
                                }
                            });
                        });

                        adminSubmissionsTableBody.querySelectorAll('.btn-approve-sub').forEach(btn => {
                            btn.addEventListener('click', () => {
                                const subId = parseInt(btn.getAttribute('data-sub-id'), 10);
                                if (!confirm('確定核准通過此地圖？核准後將正式加入官方排位賽題庫！')) return;
                                btn.disabled = true;

                                fetch('api/admin.php?action=review_submission', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ submissionId: subId, decision: 'approve' })
                                })
                                .then(r => r.json())
                                .then(r => {
                                    if (r.success) {
                                        showToast(r.message);
                                        loadAdminSubmissionsList();
                                    } else {
                                        btn.disabled = false;
                                        showToast(r.message || '審核失敗', true);
                                    }
                                })
                                .catch(() => {
                                    btn.disabled = false;
                                    showToast('伺服器連線失敗', true);
                                });
                            });
                        });

                        adminSubmissionsTableBody.querySelectorAll('.btn-reject-sub').forEach(btn => {
                            btn.addEventListener('click', () => {
                                const subId = parseInt(btn.getAttribute('data-sub-id'), 10);
                                if (!confirm('確定退回此地圖投稿？')) return;
                                btn.disabled = true;

                                fetch('api/admin.php?action=review_submission', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ submissionId: subId, decision: 'reject' })
                                })
                                .then(r => r.json())
                                .then(r => {
                                    if (r.success) {
                                        showToast(r.message);
                                        loadAdminSubmissionsList();
                                    } else {
                                        btn.disabled = false;
                                        showToast(r.message || '退回失敗', true);
                                    }
                                })
                                .catch(() => {
                                    btn.disabled = false;
                                    showToast('伺服器連線失敗', true);
                                });
                            });
                        });
                    })
                    .catch(() => {
                        adminSubmissionsTableBody.innerHTML = '<tr><td colspan="5" class="table-note error">無法連線到伺服器</td></tr>';
                    });
            }

            // 載入官方地圖清單（支援檢視 2D 與刪除）
            function loadAdminOfficialMapsList() {
                if (!adminOfficialMapsTableBody) return;
                adminOfficialMapsTableBody.innerHTML = '<tr><td colspan="6" class="table-note">載入官方排位題庫中…</td></tr>';

                fetch('api/ranked.php?action=list_maps')
                    .then(res => res.json())
                    .then(res => {
                        if (!res.success) {
                            adminOfficialMapsTableBody.innerHTML = `<tr><td colspan="6" class="table-note error">載入失敗</td></tr>`;
                            return;
                        }
                        const mapsBySize = res.maps || {};
                        let html = '';
                        let count = 0;

                        Object.keys(mapsBySize).forEach(size => {
                            const list = mapsBySize[size] || [];
                            list.forEach(m => {
                                count++;
                                html += `
                                    <tr>
                                        <td><span class="role-badge senior">${escapeHtml(size)}</span></td>
                                        <td><code>${escapeHtml(m.mapId || '-')}</code></td>
                                        <td><strong>${escapeHtml(m.name || '-')}</strong></td>
                                        <td>${escapeHtml(m.author || '官方')}</td>
                                        <td>${escapeHtml(m.createdAt || '-')}</td>
                                        <td class="actions">
                                            <button type="button" class="tool-btn btn-ghost btn-sm btn-preview-official" data-json='${escapeHtml(JSON.stringify(m))}' data-title="${escapeHtml(m.name)}" data-meta="${escapeHtml((m.author || '官方') + ' ・ ' + (m.createdAt || ''))}"><svg class="icon"><use href="assets/icons.svg#focus-centered"></use></svg>2D 地圖</button>
                                            <button type="button" class="tool-btn btn-ghost btn-sm text-danger btn-delete-official" data-size="${escapeHtml(size)}" data-map-id="${escapeHtml(m.mapId)}"><svg class="icon"><use href="assets/icons.svg#trash"></use></svg>刪除</button>
                                        </td>
                                    </tr>
                                `;
                            });
                        });

                        if (count === 0) {
                            adminOfficialMapsTableBody.innerHTML = '<tr><td colspan="6" class="table-note">目前官方題庫為空</td></tr>';
                            return;
                        }

                        adminOfficialMapsTableBody.innerHTML = html;

                        // 綁定 2D 檢視
                        adminOfficialMapsTableBody.querySelectorAll('.btn-preview-official').forEach(btn => {
                            btn.addEventListener('click', () => {
                                const rawJson = btn.getAttribute('data-json');
                                const title = btn.getAttribute('data-title');
                                const meta = btn.getAttribute('data-meta');
                                try {
                                    openPreview2DModal(JSON.parse(rawJson), title, meta);
                                } catch (e) {
                                    showToast('解析地圖失敗', true);
                                }
                            });
                        });

                        // 綁定刪除排位賽地圖
                        adminOfficialMapsTableBody.querySelectorAll('.btn-delete-official').forEach(btn => {
                            btn.addEventListener('click', () => {
                                const size = btn.getAttribute('data-size');
                                const mapId = btn.getAttribute('data-map-id');
                                if (!confirm(`⚠️ 確定要刪除官方排位賽地圖【${size}/${mapId}】嗎？\n刪除後此地圖將不再出現在排位賽題庫中！`)) return;

                                btn.disabled = true;
                                fetch('api/admin.php?action=delete_ranked_map', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ size, mapId })
                                })
                                .then(r => r.json())
                                .then(r => {
                                    if (r.success) {
                                        showToast(r.message);
                                        loadAdminOfficialMapsList();
                                    } else {
                                        btn.disabled = false;
                                        showToast(r.message || '刪除失敗', true);
                                    }
                                })
                                .catch(() => {
                                    btn.disabled = false;
                                    showToast('連線失敗，無法刪除地圖', true);
                                });
                            });
                        });
                    })
                    .catch(() => {
                        adminOfficialMapsTableBody.innerHTML = '<tr><td colspan="6" class="table-note error">無法連線到官方地圖庫</td></tr>';
                    });
            }

            // ============================================
            // 12-2. 2D 地圖畫布繪製與預覽
            // ============================================
            const preview2DModalBackdrop = document.getElementById('preview2DModalBackdrop');
            const btnClosePreview2DModal = document.getElementById('btnClosePreview2DModal');
            const btnDismissPreview2D = document.getElementById('btnDismissPreview2D');
            const preview2DTitle = document.getElementById('preview2DTitle');
            const preview2DSub = document.getElementById('preview2DSub');
            const preview2DMeta = document.getElementById('preview2DMeta');
            const preview2DCanvas = document.getElementById('preview2DCanvas');

            function openPreview2DModal(mazeData, title = '2D 地圖預覽', meta = '') {
                if (!preview2DModalBackdrop || !preview2DCanvas || !mazeData) return;
                if (preview2DTitle) preview2DTitle.textContent = title;
                const rows = mazeData.gridSize?.rows || (mazeData.hWalls ? mazeData.hWalls.length - 1 : 10);
                const cols = mazeData.gridSize?.cols || (mazeData.hWalls ? mazeData.hWalls[0].length : 10);
                if (preview2DSub) preview2DSub.textContent = `迷宮規格：${cols} × ${rows} 格（${cols * 30} × ${rows * 30} cm）`;
                if (preview2DMeta) preview2DMeta.textContent = meta || '-';

                render2DMapToCanvas(preview2DCanvas, mazeData);
                preview2DModalBackdrop.classList.add('show');
            }

            function closePreview2DModal() {
                preview2DModalBackdrop?.classList.remove('show');
            }

            btnClosePreview2DModal?.addEventListener('click', closePreview2DModal);
            btnDismissPreview2D?.addEventListener('click', closePreview2DModal);
            preview2DModalBackdrop?.addEventListener('click', (e) => {
                if (e.target === preview2DModalBackdrop) closePreview2DModal();
            });

            // 繪製 2D 迷宮至 Canvas (清晰呈現起終點、水平垂直隔板牆壁與外框)
            function render2DMapToCanvas(canvas, data) {
                const ctx = canvas.getContext('2d');
                const width = canvas.width;
                const height = canvas.height;
                ctx.clearRect(0, 0, width, height);

                const rows = data.gridSize?.rows || (data.hWalls ? data.hWalls.length - 1 : 10);
                const cols = data.gridSize?.cols || (data.hWalls ? data.hWalls[0].length : 10);
                const hWalls = data.hWalls || [];
                const vWalls = data.vWalls || [];
                const start = data.start || { x: 0, y: rows - 1 };
                const goal = data.goal || { x: cols - 1, y: 0 };

                const padding = 20;
                const drawW = width - padding * 2;
                const drawH = height - padding * 2;
                const cellSize = Math.floor(Math.min(drawW / cols, drawH / rows));
                const totalW = cols * cellSize;
                const totalH = rows * cellSize;
                const offsetX = padding + Math.floor((drawW - totalW) / 2);
                const offsetY = padding + Math.floor((drawH - totalH) / 2);

                // 繪製背景底色與格線
                ctx.fillStyle = '#0E1424';
                ctx.fillRect(offsetX, offsetY, totalW, totalH);

                ctx.strokeStyle = '#1D263B';
                ctx.lineWidth = 1;
                for (let r = 0; r <= rows; r++) {
                    ctx.beginPath();
                    ctx.moveTo(offsetX, offsetY + r * cellSize);
                    ctx.lineTo(offsetX + totalW, offsetY + r * cellSize);
                    ctx.stroke();
                }
                for (let c = 0; c <= cols; c++) {
                    ctx.beginPath();
                    ctx.moveTo(offsetX + c * cellSize, offsetY);
                    ctx.lineTo(offsetX + c * cellSize, offsetY + totalH);
                    ctx.stroke();
                }

                // 標示起點 (綠色底塊 + S)
                const sx = offsetX + start.x * cellSize;
                const sy = offsetY + start.y * cellSize;
                ctx.fillStyle = 'rgba(74, 222, 128, 0.28)';
                ctx.fillRect(sx + 2, sy + 2, cellSize - 4, cellSize - 4);
                ctx.fillStyle = '#4ADE80';
                ctx.font = `bold ${Math.max(12, Math.floor(cellSize * 0.55))}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('S', sx + cellSize / 2, sy + cellSize / 2);

                // 標示終點 (紅色底塊 + G)
                const gx = offsetX + goal.x * cellSize;
                const gy = offsetY + goal.y * cellSize;
                ctx.fillStyle = 'rgba(248, 113, 113, 0.28)';
                ctx.fillRect(gx + 2, gy + 2, cellSize - 4, cellSize - 4);
                ctx.fillStyle = '#F87171';
                ctx.font = `bold ${Math.max(12, Math.floor(cellSize * 0.55))}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('G', gx + cellSize / 2, gy + cellSize / 2);

                // 繪製牆壁 (水平牆與垂直牆)
                ctx.strokeStyle = '#38BDF8';
                ctx.lineWidth = Math.max(2.5, Math.floor(cellSize * 0.12));
                ctx.lineCap = 'round';

                // 水平牆
                for (let r = 0; r <= rows; r++) {
                    if (!hWalls[r]) continue;
                    for (let c = 0; c < cols; c++) {
                        if (hWalls[r][c]) {
                            ctx.beginPath();
                            ctx.moveTo(offsetX + c * cellSize, offsetY + r * cellSize);
                            ctx.lineTo(offsetX + (c + 1) * cellSize, offsetY + r * cellSize);
                            ctx.stroke();
                        }
                    }
                }

                // 垂直牆
                for (let r = 0; r < rows; r++) {
                    if (!vWalls[r]) continue;
                    for (let c = 0; c <= cols; c++) {
                        if (vWalls[r][c]) {
                            ctx.beginPath();
                            ctx.moveTo(offsetX + c * cellSize, offsetY + r * cellSize);
                            ctx.lineTo(offsetX + c * cellSize, offsetY + (r + 1) * cellSize);
                            ctx.stroke();
                        }
                    }
                }

                // 迷宮外框加強
                ctx.strokeStyle = '#FBBF24';
                ctx.lineWidth = Math.max(3, Math.floor(cellSize * 0.15));
                ctx.strokeRect(offsetX, offsetY, totalW, totalH);
            }

            // 頁面初次載入：預設訪客模式，先檢查登入狀態與權限，再載入迷宮配置
            updateAuthUI(null);
            checkAuthStatus().then(() => {
                loadMazeConfig();
            });
        });
    </script>
</body>
</html>
