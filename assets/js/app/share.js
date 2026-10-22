/**
 * 分享碼產生與兌換
 * 與 assets/js/app/ 其他檔案共用同一個全域範圍，載入順序見 index.php。
 */
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
        showToast('權限限制：初級使用者不能產生分享碼，只能使用別人的分享碼載入地圖！', true);
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
                        shareStatusNote.textContent = '此分享碼已達 3 人使用上限';
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
            btnDoGenerateShare.innerHTML = '<svg class="icon"><use href="#share"></use></svg>產生分享碼';
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
            btnCopyShareCode.innerHTML = '<svg class="icon"><use href="#copy"></use></svg>複製分享碼';
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
document.getElementById('btnOpenRedeemShare')?.addEventListener('click', openRedeemShareModal);
