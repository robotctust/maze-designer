/**
 * 計時系統（完賽計時／倒數挑戰）與試跑中的介面狀態
 * 與 assets/js/app/ 其他檔案共用同一個全域範圍，載入順序見 index.php。
 */
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
                practiceDriveState = 'idle';
                if (typeof updatePracticeControlsUI === 'function') updatePracticeControlsUI();
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
        showToast(`已設定為「${countdownLabel}」模式`);
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
    showToast(`已套用自訂挑戰時間：${countdownDesc}`);
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

function updatePracticeControlsUI() {
    if (currentGameMode === 'ranked') return;

    if (practiceDriveState === 'running') {
        if (btnStartDrive) {
            btnStartDrive.disabled = true;
            btnStartDrive.classList.remove('pulse-prompt', 'driving-active');
        }
        if (btnPauseDrive) {
            btnPauseDrive.disabled = false;
        }
        if (btnResumeDrive) {
            btnResumeDrive.disabled = true;
            btnResumeDrive.classList.remove('pulse-prompt');
        }
        if (btnResetCar) {
            btnResetCar.disabled = false;
        }
        if (driveStatusBadge) driveStatusBadge.className = 'drive-status-tag active';
        if (driveStatusText) driveStatusText.textContent = '操控中';
        document.getElementById('simulatorPanel')?.classList.add('is-driving');
    } else if (practiceDriveState === 'paused') {
        if (btnStartDrive) {
            btnStartDrive.disabled = true;
            btnStartDrive.classList.remove('pulse-prompt', 'driving-active');
        }
        if (btnPauseDrive) {
            btnPauseDrive.disabled = true;
        }
        if (btnResumeDrive) {
            btnResumeDrive.disabled = false;
            btnResumeDrive.classList.add('pulse-prompt');
        }
        if (btnResetCar) {
            btnResetCar.disabled = false;
        }
        if (driveStatusBadge) driveStatusBadge.className = 'drive-status-tag paused';
        if (driveStatusText) driveStatusText.textContent = '已暫停（按「繼續」繼續跑）';
        document.getElementById('simulatorPanel')?.classList.remove('is-driving');
    } else {
        practiceDriveState = 'idle';
        if (btnStartDrive) {
            btnStartDrive.disabled = false;
            btnStartDrive.classList.remove('driving-active');
            btnStartDrive.classList.add('pulse-prompt');
        }
        if (btnPauseDrive) {
            btnPauseDrive.disabled = true;
        }
        if (btnResumeDrive) {
            btnResumeDrive.disabled = true;
            btnResumeDrive.classList.remove('pulse-prompt');
        }
        if (btnResetCar) {
            btnResetCar.disabled = false;
        }
        if (driveStatusBadge) driveStatusBadge.className = 'drive-status-tag';
        if (driveStatusText) driveStatusText.textContent = '按「開始」後可用鍵盤操控';
        document.getElementById('simulatorPanel')?.classList.remove('is-driving');
    }
}

function updateDrivingUI(isDriving) {
    if (currentGameMode === 'ranked') {
        if (isDriving) {
            if (btnStartDrive) btnStartDrive.disabled = true;
            if (btnStopDrive) btnStopDrive.disabled = false;

            if (driveStatusBadge) driveStatusBadge.className = 'drive-status-tag active';
            if (driveStatusText) driveStatusText.textContent = '操控中';
            document.getElementById('simulatorPanel')?.classList.add('is-driving');
            document.body.classList.add('ranked-live');

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
            if (btnStartDrive) btnStartDrive.disabled = false;
            if (btnStopDrive) btnStopDrive.disabled = true;

            if (driveStatusBadge) driveStatusBadge.className = 'drive-status-tag';
            if (driveStatusText) driveStatusText.textContent = '排位賽已停止';
            document.getElementById('simulatorPanel')?.classList.remove('is-driving');
            document.body.classList.remove('ranked-live');

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
        return;
    }

    // 練習賽模式
    if (isDriving) {
        practiceDriveState = 'running';
        updatePracticeControlsUI();
    } else {
        if (practiceDriveState !== 'paused') {
            practiceDriveState = 'idle';
        }
        updatePracticeControlsUI();
        if (timerRunning) {
            pauseTimer();
        }
    }

    if (btnModeOrbit) {
        btnModeOrbit.disabled = false;
        btnModeOrbit.title = '3D 自由俯瞰視角';
    }
    if (btnResetCam) {
        btnResetCam.disabled = false;
        btnResetCam.title = '重設視角至標準角度';
    }
}

// 初始化練習賽按鈕狀態
updatePracticeControlsUI();
