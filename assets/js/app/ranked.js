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

        // 回到排位賽前正在編輯的練習地圖（排位賽只改 3D 場景，不會動到編輯器，未存的修改也會保留）
        set2DMapMode('large', false);
        editor.loadData(editor.getData());
        showToast('已回到練習模式');
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

                const customName = res.customName || (res.mapData && res.mapData.customName) || '';
                const mapLabel = customName ? `${customName} (${res.mapId})` : res.mapId;
                const authorName = res.mapData.author || '官方';

                const rankedMapIdEl = document.getElementById('rankedMapId');
                if (rankedMapIdEl) {
                    if (customName) {
                        rankedMapIdEl.innerHTML = `<span class="ranked-custom-name">${escapeHtml(customName)}</span> <span class="ranked-map-subid">(${escapeHtml(res.mapId)})</span>`;
                        rankedMapIdEl.title = `地圖：${customName} (${res.mapId})・出題：${authorName}`;
                    } else {
                        rankedMapIdEl.textContent = res.mapId;
                        rankedMapIdEl.title = `地圖：${res.mapId}・出題：${authorName}`;
                    }
                }
                if (mapNameEl) mapNameEl.textContent = (size === 'special')
                    ? `${res.mapData.author || '官方'}出題・長方形 ${mapCols} × ${mapRows}`
                    : ((size === 'apex') ? `${res.mapData.author || '官方'}出題・超大型 ${mapCols} × ${mapRows}` : `${res.mapData.author || '官方'}出題・${size.replace('x', ' × ')}`);
                if (limitTextEl) limitTextEl.textContent = res.timeLimitDesc;
                const liveMapIdEl = document.getElementById('liveMapId');
                if (liveMapIdEl) {
                    liveMapIdEl.textContent = customName ? `${customName} (${res.mapId})` : res.mapId;
                    liveMapIdEl.title = `地圖：${mapLabel} (出題：${authorName})`;
                }
                refreshLobbyScore(size);

                // 更新 header 標籤
                const tagGrid = document.getElementById('headerTagGrid');
                const tagTotal = document.getElementById('headerTagTotal');
                if (tagGrid) tagGrid.textContent = (size === 'special') ? `排位規格：特殊賽 (${mapCols}×${mapRows})` : ((size === 'apex') ? `排位規格：巔峰賽 (${mapCols}×${mapRows})` : `排位規格：${size}`);
                if (tagTotal) tagTotal.textContent = `總長寬：${mapCols * 30}×${mapRows * 30} cm`;

                btnStartDrive.classList.add('pulse-prompt');
                showToast(`已換成 ${tierTitle} 的 ${mapLabel}`);
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
                        <div class="ranked-gallery-item${isCurrent ? ' is-current' : ''}" title="${escapeHtml(String(m.customName ? `${m.customName} (${m.mapId})` : (m.name || m.mapId)))}">
                            ${mazePreviewSvg(m)}
                            <div class="ranked-gallery-name">${escapeHtml(String(m.customName || m.mapId))}${isCurrent ? '（本場）' : ''}</div>
                            <div class="ranked-gallery-author">${m.customName ? `<span class="gallery-sub-id">${escapeHtml(m.mapId)}</span>・` : ''}${escapeHtml(String(m.author || '官方'))}</div>
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
// 我發布的排位賽地圖 Modal
// ============================================
const myRankedMapsModalBackdrop = document.getElementById('myRankedMapsModalBackdrop');
const btnCloseMyRankedMapsModal = document.getElementById('btnCloseMyRankedMapsModal');
const btnRefreshMyRankedMaps = document.getElementById('btnRefreshMyRankedMaps');
const myRankedMapsList = document.getElementById('myRankedMapsList');
const myRankedMapsStats = document.getElementById('myRankedMapsStats');

let myPublishedMapsCache = [];

function openMyRankedMapsModal() {
    if (!currentUser) {
        openAuthModal('訪客限制：【我發布的排位地圖】需要登入會員帳號方可查看！請先登入。', 'login');
        return;
    }
    // 關閉可能開啟中的帳號選單
    const accMenu = document.getElementById('accountMenu');
    if (accMenu) accMenu.hidden = true;

    myRankedMapsModalBackdrop?.classList.add('show');
    loadMyRankedMapsData();
}

function closeMyRankedMapsModal() {
    myRankedMapsModalBackdrop?.classList.remove('show');
}

function loadMyRankedMapsData() {
    if (!myRankedMapsList) return;
    myRankedMapsList.innerHTML = '<div class="list-note">載入中…</div>';
    if (myRankedMapsStats) myRankedMapsStats.innerHTML = '';

    fetch('api/ranked.php?action=my_published_maps')
        .then(res => res.json())
        .then(res => {
            if (!res.success) {
                myRankedMapsList.innerHTML = `<div class="list-note error">無法載入發布地圖：${escapeHtml(res.message || '未知錯誤')}</div>`;
                return;
            }
            const maps = res.maps || [];
            myPublishedMapsCache = maps;

            // 更新頂部帳號選單的數量顯示
            const countEl = document.getElementById('myRankedMapCount');
            if (countEl) countEl.textContent = `共 ${maps.length} 張`;

            if (maps.length === 0) {
                if (myRankedMapsStats) myRankedMapsStats.style.display = 'none';
                myRankedMapsList.innerHTML = `
                    <div class="list-note">
                        您目前尚未發布任何排位賽地圖。<br>
                        可在練習模式完成迷宮設計後，點擊工具列的「發布到排位賽」投稿您的專屬地圖！
                    </div>
                `;
                return;
            }

            // 計算統計
            let approvedCount = 0;
            let pendingCount = 0;
            let rejectedCount = 0;
            maps.forEach(m => {
                if (m.status === 'approved') approvedCount++;
                else if (m.status === 'pending') pendingCount++;
                else if (m.status === 'rejected') rejectedCount++;
            });

            if (myRankedMapsStats) {
                myRankedMapsStats.style.display = 'flex';
                myRankedMapsStats.innerHTML = `
                    <div class="stat-item"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#upload"></use></svg>發布總數：<strong>${maps.length} 張</strong></div>
                    <div class="stat-item" style="color: #4ade80;"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#check"></use></svg>官方收錄：<strong>${approvedCount} 張</strong></div>
                    ${pendingCount > 0 ? `<div class="stat-item" style="color: #fbbf24;"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#clock"></use></svg>審核中：<strong>${pendingCount} 張</strong></div>` : ''}
                    ${rejectedCount > 0 ? `<div class="stat-item" style="color: #f87171;"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#x"></use></svg>已退回：<strong>${rejectedCount} 張</strong></div>` : ''}
                `;
            }

            let html = '';
            maps.forEach((m, idx) => {
                const statusMap = {
                    'approved': { text: '已收錄官方題庫（全服可抽）', cls: 'status-approved', icon: 'check' },
                    'pending': { text: '待高級使用者審核中', cls: 'status-pending', icon: 'clock' },
                    'rejected': { text: '審核未通過／已退回', cls: 'status-rejected', icon: 'x' }
                };
                const st = statusMap[m.status] || { text: m.status, cls: '', icon: 'help' };
                const timeStr = m.createdAt ? m.createdAt.substring(0, 16) : '-';

                html += `
                    <div class="my-ranked-map-card">
                        <div class="my-ranked-map-preview">
                            ${mazePreviewSvg(m)}
                            <span class="preview-badge">${escapeHtml(m.tierName)}</span>
                        </div>
                        <div class="my-ranked-map-info">
                            <div class="my-ranked-map-header">
                                <h3 class="my-ranked-map-title">
                                    <span>${escapeHtml(m.displayName || m.name)}</span>
                                    ${m.mapId ? `<span class="map-id-tag">${escapeHtml(m.mapId)}</span>` : ''}
                                </h3>
                                <span class="status-badge ${st.cls}">
                                    <svg class="icon" aria-hidden="true"><use href="assets/icons.svg#${st.icon}"></use></svg>
                                    ${st.text}
                                </span>
                            </div>
                            <div class="my-ranked-map-specs">
                                <div class="spec-chip">
                                    <svg class="icon" aria-hidden="true"><use href="assets/icons.svg#layout-grid"></use></svg>
                                    <span>規格：<strong>${m.gridSize.cols} × ${m.gridSize.rows} 格</strong></span>
                                </div>
                                <div class="spec-chip">
                                    <svg class="icon" aria-hidden="true"><use href="assets/icons.svg#ruler"></use></svg>
                                    <span>尺寸：<strong>${m.totalWidthCm} × ${m.totalHeightCm} cm</strong></span>
                                </div>
                                <div class="spec-chip">
                                    <svg class="icon" aria-hidden="true"><use href="assets/icons.svg#wall"></use></svg>
                                    <span>隔板：<strong>${m.wallCount} 段</strong></span>
                                </div>
                                <div class="spec-chip">
                                    <span class="dot-start" title="起點"></span> 起點 (${m.start.x}, ${m.start.y})
                                    <span class="sep"></span>
                                    <span class="dot-goal" title="終點"></span> 終點 (${m.goal.x}, ${m.goal.y})
                                </div>
                            </div>
                            <div class="my-ranked-map-footer">
                                <span><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#calendar"></use></svg> 投稿於 ${timeStr}</span>
                                <div class="map-actions">
                                    <button type="button" class="tool-btn btn-sm btn-ghost btn-load-ranked-map" data-index="${idx}" title="載入至練習賽編輯器">
                                        <svg class="icon" aria-hidden="true"><use href="assets/icons.svg#pencil"></use></svg>載入至編輯器
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            myRankedMapsList.innerHTML = html;

            // 綁定「載入至編輯器」按鈕
            myRankedMapsList.querySelectorAll('.btn-load-ranked-map').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.getAttribute('data-index'), 10);
                    const mapData = myPublishedMapsCache[idx];
                    if (mapData) {
                        loadRankedMapToEditor(mapData);
                    }
                });
            });
        })
        .catch(err => {
            console.error('載入發布地圖失敗:', err);
            myRankedMapsList.innerHTML = '<div class="list-note error">無法連線到伺服器，請稍後再試</div>';
        });
}

function loadRankedMapToEditor(m) {
    if (currentGameMode === 'ranked') {
        showToast('排位賽進行中禁止載入外部地圖！請先回到練習模式再載入。', true);
        return;
    }
    closeMyRankedMapsModal();
    if (typeof switchGameMode === 'function' && currentGameMode !== 'practice') {
        switchGameMode('practice');
    }
    if (typeof editor !== 'undefined') {
        editor.loadData({
            gridSize: m.gridSize,
            cellSizeCm: 30,
            wallHeightCm: 15,
            start: m.start,
            goal: m.goal,
            hWalls: m.hWalls,
            vWalls: m.vWalls
        });
        if (typeof maze3D !== 'undefined' && maze3D.resetOrbitCamera) {
            maze3D.resetOrbitCamera();
        }
        const saveNameInput = document.getElementById('saveMapNameInput');
        if (saveNameInput) saveNameInput.value = m.displayName || m.name || '';
        showToast(`已載入地圖【${m.displayName || m.name}】至練習賽編輯器`);
    }
}

// 註冊「我發布的排位地圖」按鈕事件
document.getElementById('btnOpenMyRankedMaps')?.addEventListener('click', openMyRankedMapsModal);
document.getElementById('btnLobbyMyRankedMaps')?.addEventListener('click', openMyRankedMapsModal);
btnCloseMyRankedMapsModal?.addEventListener('click', closeMyRankedMapsModal);
btnRefreshMyRankedMaps?.addEventListener('click', loadMyRankedMapsData);
myRankedMapsModalBackdrop?.addEventListener('click', (e) => {
    if (e.target === myRankedMapsModalBackdrop) closeMyRankedMapsModal();
});
window.openMyRankedMapsModal = openMyRankedMapsModal;
