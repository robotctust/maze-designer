/**
 * 分享碼產生與兌換
 * 與 assets/js/app/ 其他檔案共用同一個全域範圍，載入順序見 index.php。
 */
// ============================================
// 10-1. 分享碼系統 (可選有效期限與領取人數)
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
let shareDurationSec = 60; // 0 代表不限時

// 剩餘時間顯示成「45 秒」「12 分」「3 小時」「2 天」
function formatShareRemain(sec) {
    if (sec < 60) return `${sec} 秒`;
    if (sec < 3600) return `${Math.ceil(sec / 60)} 分`;
    if (sec < 86400) return `${Math.ceil(sec / 3600)} 小時`;
    return `${Math.ceil(sec / 86400)} 天`;
}

function shareMapName() {
    return currentActiveMapName || `我的迷宮 (${editor.cols}×${editor.rows})`;
}

function clearShareTimers() {
    if (shareTimerInterval) { clearInterval(shareTimerInterval); shareTimerInterval = null; }
    if (shareStatusPollInterval) { clearInterval(shareStatusPollInterval); shareStatusPollInterval = null; }
}

function openCreateShareModal() {
    if (!currentUser) {
        openAuthModal('請先登入帳號以使用分享碼功能！', 'login');
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
        btnDoGenerateShare.innerHTML = '<svg class="icon"><use href="#share"></use></svg>產生分享碼';
    }
    if (btnCopyShareCode) btnCopyShareCode.style.display = 'none';

    const cols = editor.cols;
    const rows = editor.rows;
    const modalSpec = document.getElementById('shareModalSpec');
    const modalName = document.getElementById('shareModalName');
    if (modalSpec) modalSpec.textContent = `${cols} × ${rows}`;
    if (modalName) modalName.textContent = shareMapName();

    createShareModalBackdrop?.classList.add('show');
}

function closeCreateShareModal() {
    clearShareTimers();
    createShareModalBackdrop?.classList.remove('show');
}

function updateShareCountdownUI() {
    const remainMs = shareExpiresTimestamp - Date.now();
    const remainSec = Math.max(0, Math.ceil(remainMs / 1000));
    if (shareCountdownSeconds) shareCountdownSeconds.textContent = formatShareRemain(remainSec);

    const percent = Math.max(0, (remainSec / shareDurationSec) * 100);
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
            shareStatusNote.textContent = '分享碼已過期，如需分享請重新產生。';
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
                        shareStatusNote.textContent = `此分享碼已達 ${res.maxUses} 人領取上限`;
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
    shareDurationSec = parseInt(document.getElementById('shareDurationSelect').value, 10);

    fetch('api/share.php?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mapData,
            name: shareMapName(),
            durationSec: shareDurationSec,
            maxUses: parseInt(document.getElementById('shareMaxUsesSelect').value, 10)
        })
    })
    .then(res => res.json())
    .then(res => {
        if (!res.success) {
            btnDoGenerateShare.disabled = false;
            btnDoGenerateShare.innerHTML = '<svg class="icon"><use href="#share"></use></svg>產生分享碼';
            if (shareAlert) {
                shareAlert.className = 'auth-alert error';
                shareAlert.textContent = res.message || '產生分享碼失敗';
                shareAlert.style.display = 'block';
            }
            return;
        }

        currentShareCode = res.code;
        shareExpiresTimestamp = Date.now() + shareDurationSec * 1000;

        if (shareInitialArea) shareInitialArea.style.display = 'none';
        if (shareGeneratedArea) shareGeneratedArea.style.display = 'block';
        if (btnDoGenerateShare) btnDoGenerateShare.style.display = 'none';
        if (btnCopyShareCode) {
            btnCopyShareCode.style.display = 'inline-flex';
            btnCopyShareCode.innerHTML = '<svg class="icon"><use href="#copy"></use></svg>複製分享碼';
        }

        if (shareCodeDisplay) shareCodeDisplay.textContent = res.code;
        if (shareUsedCount) shareUsedCount.textContent = '0';
        document.getElementById('shareMaxUsesText').textContent = res.noUseLimit ? ' 人・不限人數' : ` / ${res.maxUses} 人`;
        if (shareStatusNote) {
            shareStatusNote.textContent = shareDurationSec ? '複製後傳給朋友，過期前都可以使用。' : '這組分享碼不限時，不需要時可以到「管理我的分享碼」刪除。';
            shareStatusNote.className = 'dlg-note';
        }

        // 不限時：不顯示倒數與進度條
        shareTimerBadge.hidden = !shareDurationSec;
        shareProgressFill.parentElement.hidden = !shareDurationSec;
        if (shareDurationSec) {
            updateShareCountdownUI();
            shareTimerInterval = setInterval(updateShareCountdownUI, 1000);
        }
        shareStatusPollInterval = setInterval(pollShareStatus, 2000);
    })
    .catch(() => {
        btnDoGenerateShare.disabled = false;
        btnDoGenerateShare.innerHTML = '<svg class="icon"><use href="#share"></use></svg>產生分享碼';
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
        btnCopyShareCode.innerHTML = '<svg class="icon"><use href="#check"></use></svg>已複製！';
        showToast(`分享碼【${currentShareCode}】已複製到剪貼簿！`);
        setTimeout(() => {
            if (btnCopyShareCode) btnCopyShareCode.innerHTML = '<svg class="icon"><use href="#copy"></use></svg>複製分享碼';
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
        btnConfirmRedeemShare.innerHTML = '<svg class="icon"><use href="#file-import"></use></svg>載入迷宮';

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
            setActiveMapInfo(0, '');
            maze3D.resetOrbitCamera();
        }
        showToast(res.message);
    })
    .catch(() => {
        btnConfirmRedeemShare.disabled = false;
        btnConfirmRedeemShare.innerHTML = '<svg class="icon"><use href="#file-import"></use></svg>載入迷宮';
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

// 管理我的分享碼：列出自己產生過的分享碼，可以複製或刪除
const manageShareModalBackdrop = document.getElementById('manageShareModalBackdrop');
const shareCodeList = document.getElementById('shareCodeList');

function openManageShareModal() {
    if (!currentUser) {
        openAuthModal('請先登入帳號以管理分享碼！', 'login');
        return;
    }
    manageShareModalBackdrop.classList.add('show');
    loadShareCodeList();
}

function closeManageShareModal() {
    manageShareModalBackdrop.classList.remove('show');
}

function shareCodeStatus(s) {
    if (!s.noUseLimit && s.usedCount >= s.maxUses) return { text: '已達人數上限', active: false };
    if (s.noExpiry) return { text: '不限時', active: true };
    if (s.remainSec <= 0) return { text: '已過期', active: false };
    return { text: `剩 ${formatShareRemain(s.remainSec)}`, active: true };
}

function loadShareCodeList() {
    shareCodeList.innerHTML = '<div class="list-note">載入中…</div>';
    fetch('api/share.php?action=list')
        .then(res => res.json())
        .then(res => {
            if (!res.success) {
                shareCodeList.innerHTML = `<div class="list-note error">${escapeHtml(res.message || '無法載入分享碼')}</div>`;
                return;
            }
            if (!res.list.length) {
                shareCodeList.innerHTML = '<div class="list-note">還沒有產生過分享碼。</div>';
                return;
            }
            shareCodeList.innerHTML = res.list.map(s => {
                const st = shareCodeStatus(s);
                return `
                    <div class="map-library-item${st.active ? '' : ' is-inactive'}">
                        <div class="library-item-main">
                            <div class="share-list-head"><span class="share-list-code">${s.code}</span><span class="share-list-map">${escapeHtml(s.name)}・${s.spec}</span></div>
                            <div class="library-item-meta">已領取 ${s.usedCount}${s.noUseLimit ? ' 人・不限人數' : ` / ${s.maxUses} 人`}・<span class="${st.active ? 'text-go' : ''}">${st.text}</span>・建立於 ${s.createdAt.substring(5, 16)}</div>
                        </div>
                        ${st.active ? `<button type="button" class="tool-btn btn-sm btn-ghost btn-share-copy" data-code="${s.code}" title="複製分享碼" aria-label="複製分享碼 ${s.code}"><svg class="icon" aria-hidden="true"><use href="#copy"></use></svg></button>` : ''}
                        <button type="button" class="tool-btn btn-sm btn-ghost btn-map-delete btn-share-delete" data-code="${s.code}" title="刪除" aria-label="刪除分享碼 ${s.code}"><svg class="icon" aria-hidden="true"><use href="#trash"></use></svg></button>
                    </div>
                `;
            }).join('');

            shareCodeList.querySelectorAll('.btn-share-copy').forEach(btn => {
                btn.addEventListener('click', () => {
                    navigator.clipboard.writeText(btn.dataset.code)
                        .then(() => showToast(`分享碼 ${btn.dataset.code} 已複製`))
                        .catch(() => showToast(`分享碼為：${btn.dataset.code}`));
                });
            });
            shareCodeList.querySelectorAll('.btn-share-delete').forEach(btn => {
                btn.addEventListener('click', () => deleteShareCode(btn.dataset.code));
            });
        })
        .catch(() => {
            shareCodeList.innerHTML = '<div class="list-note error">無法連線到伺服器，請稍後再試</div>';
        });
}

async function deleteShareCode(code) {
    const ok = await showConfirm({
        title: `刪除分享碼 ${code}？`,
        message: '刪除後，別人就不能再用這組代碼載入。已經載入的人不受影響。',
        confirmLabel: '刪除',
        danger: true
    });
    if (!ok) return;
    fetch('api/share.php?action=delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
    })
        .then(res => res.json())
        .then(res => {
            showToast(res.message || '刪除失敗', !res.success);
            loadShareCodeList();
        })
        .catch(() => showToast('無法連線到伺服器刪除分享碼', true));
}

document.getElementById('btnOpenManageShare').addEventListener('click', openManageShareModal);
document.getElementById('btnCloseManageShareModal').addEventListener('click', closeManageShareModal);
document.getElementById('btnRefreshShareCodes').addEventListener('click', loadShareCodeList);
manageShareModalBackdrop.addEventListener('click', (e) => {
    if (e.target === manageShareModalBackdrop) closeManageShareModal();
});
document.getElementById('btnOpenRedeemShare')?.addEventListener('click', openRedeemShareModal);
