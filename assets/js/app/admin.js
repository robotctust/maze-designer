/**
 * 高級管理者：帳號管理、地圖審核、2D 地圖預覽
 * 與 assets/js/app/ 其他檔案共用同一個全域範圍，載入順序見 index.php。
 */
// ============================================
// 12. 高級管理者功能：帳號管理、地圖審核與 2D 預覽、地圖刪除
// ============================================
const adminUsersModalBackdrop = document.getElementById('adminUsersModalBackdrop');
const btnCloseAdminUsersModal = document.getElementById('btnCloseAdminUsersModal');
const btnRefreshAdminUsers = document.getElementById('btnRefreshAdminUsers');
const adminUsersTableBody = document.getElementById('adminUsersTableBody');

function openAdminUsersModal() {
    if (!currentUser || currentUser.role !== 'senior') {
        showToast('權限不足：僅高級使用者可管理帳號', true);
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
        showToast('權限不足：僅高級使用者可審核地圖', true);
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
                btn.addEventListener('click', async () => {
                    const subId = parseInt(btn.getAttribute('data-sub-id'), 10);
                    const ok = await showConfirm({
                        title: '核准這張地圖？',
                        message: '核准後會正式加入官方排位賽題庫。',
                        confirmLabel: '核准'
                    });
                    if (!ok) return;
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
                btn.addEventListener('click', async () => {
                    const subId = parseInt(btn.getAttribute('data-sub-id'), 10);
                    const ok = await showConfirm({
                        title: '退回這張地圖投稿？',
                        confirmLabel: '退回',
                        danger: true
                    });
                    if (!ok) return;
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
                btn.addEventListener('click', async () => {
                    const size = btn.getAttribute('data-size');
                    const mapId = btn.getAttribute('data-map-id');
                    const ok = await showConfirm({
                        title: `刪除官方排位地圖 ${size}/${mapId}？`,
                        message: '刪除後這張地圖不會再出現在排位賽題庫中，這個動作無法復原。',
                        confirmLabel: '刪除',
                        danger: true
                    });
                    if (!ok) return;

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
