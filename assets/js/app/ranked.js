/**
 * 排位賽流程與排行榜
 * 與 assets/js/app/ 其他檔案共用同一個全域範圍，載入順序見 index.php。
 */
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
    '30x30': { level: 5, name: '傳奇級', en: 'LEGEND', limit: '40 分鐘', clock: '40:00', view: 5 },
    'apex': { level: 7, name: '巔峰賽', en: 'APEX', limit: '60 分鐘', clock: '60:00', view: 5 },
    'special': { level: 6, name: '特殊賽', en: 'SPECIAL', limit: '40 分鐘', clock: '40:00', view: 5 }
};

// 切換段位主題：主色、大廳徽章與段位名、按鈕選取狀態
function applyTierTheme(size) {
    const t = RANKED_TIERS[size];
    document.body.dataset.tier = size;
    document.getElementById('lobbyCrestUse').setAttribute('href', `assets/icons.svg#crest-${t.level}`);
    document.getElementById('lobbyTierEn').textContent = (size === 'special') ? 'SPECIAL ARENA' : ((size === 'apex') ? 'APEX ARENA' : `${t.en}・TIER ${t.level}`);
    document.getElementById('lobbyTierName').textContent = t.name;
    document.getElementById('liveCrestUse').setAttribute('href', `assets/icons.svg#crest-${t.level}`);
    document.getElementById('liveTierName').textContent = t.name;
    document.getElementById('lobbyLimitClock').textContent = t.clock;
    document.getElementById('lobbyTierSub').textContent = (size === 'special') ? `長方形特殊迷宮・限時 ${t.limit}` : ((size === 'apex') ? `35×35～50×50 超大迷宮・限時 ${t.limit}` : `${size.replace('x', ' × ')} 迷宮・限時 ${t.limit}`);
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
                const mapCols = res.mapData.gridSize?.cols || (res.mapData.hWalls ? res.mapData.hWalls[0].length : 10);
                const mapRows = res.mapData.gridSize?.rows || (res.mapData.hWalls ? res.mapData.hWalls.length - 1 : 10);
                const tierTitle = (size === 'special') ? `特殊賽 (${mapCols}×${mapRows})` : ((size === 'apex') ? `巔峰賽 (${mapCols}×${mapRows})` : `${size.replace('x', '×')} ${RANKED_TIERS[size].name}`);
                const mapNameEl = document.getElementById('rankedMapName');
                const limitTextEl = document.getElementById('rankedLimitText');

                document.getElementById('rankedMapId').textContent = res.mapId;
                if (mapNameEl) mapNameEl.textContent = (size === 'special')
                    ? `${res.mapData.author || '官方'}出題・長方形 ${mapCols} × ${mapRows}`
                    : ((size === 'apex') ? `${res.mapData.author || '官方'}出題・超大型 ${mapCols} × ${mapRows}` : `${res.mapData.author || '官方'}出題・${size.replace('x', ' × ')}`);
                if (limitTextEl) limitTextEl.textContent = res.timeLimitDesc;
                document.getElementById('liveMapId').textContent = res.mapId;
                refreshLobbyScore(size);

                // 更新 header 標籤
                const tagGrid = document.getElementById('headerTagGrid');
                const tagTotal = document.getElementById('headerTagTotal');
                if (tagGrid) tagGrid.textContent = (size === 'special') ? `排位規格：特殊賽 (${mapCols}×${mapRows})` : ((size === 'apex') ? `排位規格：巔峰賽 (${mapCols}×${mapRows})` : `排位規格：${size}`);
                if (tagTotal) tagTotal.textContent = `總長寬：${mapCols * 30}×${mapRows * 30} cm`;

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
                html += `<h4 class="ranked-gallery-tier">${size === 'special' ? '特殊排位賽（長方形）' : (size === 'apex' ? '巔峰排位賽（35×35～50×50）' : size.replace('x', '×'))}（${maps.length} 張）</h4><div class="ranked-gallery-grid">`;
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
