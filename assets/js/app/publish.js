/**
 * 練習地圖發布到排位賽圖庫
 * 與 assets/js/app/ 其他檔案共用同一個全域範圍，載入順序見 index.php。
 */
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
        openAuthModal('訪客限制：「發布到排位賽」需要登入會員帳號！請先登入或免費註冊。', 'login');
        return;
    }
    if (currentUser.role === 'junior') {
        showToast('權限限制：初級使用者不能上傳排位賽地圖！需由高級使用者提升為中級或高級使用者。', true);
        return;
    }

    const currentData = editor.getData();
    const cols = editor.cols;
    const rows = editor.rows;
    const size = `${cols}x${rows}`;
    const squareAllowed = ['10x10', '15x15', '20x20', '25x25', '30x30'];
    let targetTier = size;

    if (cols !== rows) {
        // 長方形地圖：歸類於「特殊排位賽」
        if (Math.max(cols, rows) > 30) {
            showToast(`特殊排位賽規格限制：長方形地圖最大邊不能超過 30 格！目前為 ${cols}×${rows}。`, true);
            return;
        }
        if (Math.min(cols, rows) < 2) {
            showToast(`地圖尺寸過小，最小邊至少需 2 格！目前為 ${cols}×${rows}。`, true);
            return;
        }
        targetTier = 'special';
    } else {
        if (cols > 30) {
            if ([35, 40, 45, 50].includes(cols)) {
                targetTier = 'apex';
            } else {
                showToast(`巔峰排位賽規格限制：正方形超大地圖僅支援 35×35、40×40、45×45、50×50 四種規格！目前為 ${cols}×${rows}。`, true);
                return;
            }
        } else {
            if (!squareAllowed.includes(size)) {
                showToast(`標準正方形排位賽僅支援 10×10、15×15、20×20、25×25、30×30 五種規格！目前為 ${cols}×${rows}。`, true);
                return;
            }
        }
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
        '30x30': '30×30 傳奇級',
        'special': `特殊排位賽（長方形 ${cols}×${rows}）`,
        'apex': `巔峰排位賽（超大型 ${cols}×${rows}）`
    };

    if (publishModalSpec) publishModalSpec.textContent = tierLabels[targetTier] || size;
    if (publishModalPathCheck) publishModalPathCheck.innerHTML = '走得通<svg class="icon" style="color:var(--go)" aria-hidden="true"><use href="assets/icons.svg#check"></use></svg>';

    // 計算牆壁數量
    let hCount = 0;
    currentData.hWalls.forEach(r => r.forEach(v => { if (v) hCount++; }));
    let vCount = 0;
    currentData.vWalls.forEach(r => r.forEach(v => { if (v) vCount++; }));
    const wallTotal = hCount + vCount;

    if (publishModalStats) publishModalStats.textContent = `${wallTotal} 段・${cols * 30} × ${rows * 30} cm`;
    if (publishModalAuthor) publishModalAuthor.textContent = currentUser ? currentUser.username : '訪客';
    if (publishCustomName) {
        const curName = document.getElementById('saveMapNameInput')?.value.trim() || '';
        publishCustomName.value = curName;
    }

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
            // 刷新頂部選單發布統計
            fetch('api/ranked.php?action=leaderboard&size=10x10')
                .then(r => r.json())
                .then(data => {
                    const el = document.getElementById('myRankedMapCount');
                    if (el && data.myMapCount) {
                        el.textContent = `共 ${data.myMapCount.total} 張`;
                        if (data.myMapCount.pending > 0) {
                            el.textContent += ` (${data.myMapCount.pending} 待審)`;
                        }
                    }
                })
                .catch(() => {});
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
