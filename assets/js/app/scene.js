/**
 * 建立 3D 模擬場景與 2D 編輯器
 * 與 assets/js/app/ 其他檔案共用同一個全域範圍，載入順序見 index.php。
 */
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

            document.getElementById('resultCrestUse').setAttribute('href', `#crest-${tier.level}`);
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
    onNotice: (msg) => showToast(msg, true),
    onHistoryChange: (ed) => {
        document.getElementById('btnUndo').disabled = !ed.canUndo();
        document.getElementById('btnRedo').disabled = !ed.canRedo();
        document.getElementById('btnSave').classList.toggle('has-unsaved', ed.isDirty());
    },
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
