/**
 * 3D 試跑操作：視角切換、開始／停止／回起點、牆壁材質、過關與超時視窗
 * 與 assets/js/app/ 其他檔案共用同一個全域範圍，載入順序見 index.php。
 */
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

// 6. 開始 / 暫停 / 繼續 / 重新開始 操作
if (btnStartDrive) {
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
            practiceDriveState = 'running';
            updatePracticeControlsUI();
            set2DMapMode('compact', true);
            showToast(currentTimerMode === 'up' ? '已自動定位起點，完賽計時開始！' : `已自動定位起點，${countdownLabel}開始！`);
        }
    });
}

if (btnPauseDrive) {
    btnPauseDrive.addEventListener('click', () => {
        if (currentGameMode === 'practice') {
            maze3D.stopDriving();
            pauseTimer();
            practiceDriveState = 'paused';
            updatePracticeControlsUI();
            showToast('已暫停，按「繼續」可接續試跑');
        }
    });
}

if (btnResumeDrive) {
    btnResumeDrive.addEventListener('click', () => {
        if (currentGameMode === 'practice') {
            maze3D.startDriving(false);
            startTimer(false);
            practiceDriveState = 'running';
            updatePracticeControlsUI();
            set2DMapMode('compact', true);
            showToast('已繼續試跑！');
        }
    });
}

if (btnResetCar) {
    btnResetCar.addEventListener('click', () => {
        document.getElementById('rankedVictoryModal').style.display = 'none';
        document.getElementById('rankedTimeoutModal').style.display = 'none';
        maze3D.stopDriving();
        maze3D.placePlayerAtStart();
        resetTimer();
        if (editor) editor.clearCarTrail();
        // 回起點後：若是練習賽恢復為大圖設計模式
        if (currentGameMode === 'practice') {
            practiceDriveState = 'idle';
            updatePracticeControlsUI();
            set2DMapMode('large', false);
            showToast('自走車已回到起點，按「開始」開始計時');
        } else {
            btnStartDrive.classList.add('pulse-prompt');
            showToast('已回到起點，按「開始挑戰」重新挑戰！');
        }
    });
}

if (btnStopDrive) {
    btnStopDrive.addEventListener('click', () => {
        maze3D.stopDriving();
        pauseTimer();
        btnStartDrive.classList.remove('pulse-prompt');
        // 停止遙控後：若是練習賽自動恢復為大圖設計模式
        if (currentGameMode === 'practice') {
            practiceDriveState = 'idle';
            updatePracticeControlsUI();
            set2DMapMode('large', true);
        }
    });
}

btnResetCam.addEventListener('click', () => {
    if (currentGameMode === 'ranked' && maze3D.isDriving) {
        showToast('排位賽進行中視角已鎖定於自走車！', true);
        return;
    }
    if (maze3D.currentMode === 'orbit') {
        maze3D.resetOrbitCamera();
    } else {
        if (maze3D.isDriving || practiceDriveState === 'paused') {
            maze3D.updateDriverCamera();
        } else {
            maze3D.placePlayerAtStart();
        }
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

// 7. 過關與超時視窗重設 (重設回起點並重設計時，需點擊「開始」才開始計時)
document.getElementById('btnVictoryRestart').addEventListener('click', () => {
    document.getElementById('victoryModal').style.display = 'none';
    maze3D.stopDriving();
    maze3D.placePlayerAtStart();
    resetTimer();
    if (editor) editor.clearCarTrail();
    if (currentGameMode === 'practice') {
        practiceDriveState = 'idle';
        updatePracticeControlsUI();
        set2DMapMode('large', false);
        showToast('自走車已回到起點，按「開始」開始計時');
    } else {
        btnStartDrive.classList.add('pulse-prompt');
        showToast('已回到起點，按「開始挑戰」重新挑戰！');
    }
});

document.getElementById('btnTimeoutRestart').addEventListener('click', () => {
    document.getElementById('timeoutModal').style.display = 'none';
    maze3D.stopDriving();
    maze3D.placePlayerAtStart();
    resetTimer();
    if (editor) editor.clearCarTrail();
    if (currentGameMode === 'practice') {
        practiceDriveState = 'idle';
        updatePracticeControlsUI();
        set2DMapMode('large', false);
        showToast('自走車已回到起點，按「開始」開始計時');
    } else {
        btnStartDrive.classList.add('pulse-prompt');
        showToast('已回到起點，按「開始挑戰」重新挑戰！');
    }
});
