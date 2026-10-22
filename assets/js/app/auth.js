/**
 * 帳號登入註冊與權限控制
 * 與 assets/js/app/ 其他檔案共用同一個全域範圍，載入順序見 index.php。
 */
// ============================================
// 8. 帳號認證與權限管理系統 (Auth & Permission System)
// ============================================
let currentUser = null; // null: 訪客 (限 10x10), { id, username }: 已登入會員 (解鎖至 50x50)
let pendingTargetGrid = null; // 暫存使用者嘗試套用但受限的規格 { cols, rows }

const authBadge = document.getElementById('authBadge');
const btnOpenAuthModal = document.getElementById('btnOpenAuthModal');
const btnLogout = document.getElementById('btnLogout');
const btnAccountMenu = document.getElementById('btnAccountMenu');
const accountMenu = document.getElementById('accountMenu');


setupMenu(btnAccountMenu, accountMenu, () => {
    const el = document.getElementById('myRankedMapCount');
    fetch('api/ranked.php?action=leaderboard&size=10x10')
        .then(res => res.json())
        .then(res => {
            if (res.myMapCount && el) {
                el.textContent = `共 ${res.myMapCount.total} 張`;
                if (res.myMapCount.pending > 0) {
                    el.textContent += ` (${res.myMapCount.pending} 待審)`;
                }
            }
        })
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
        authBadge.innerHTML = `<span class="role-badge ${role}">${roleTitle}</span>・可用 2～50 格`;
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
                btnOpenCreateShare.innerHTML = '<svg class="icon"><use href="#lock"></use></svg>產生分享碼<span class="menu-end">中／高級</span>';
                btnOpenCreateShare.title = '初級使用者不能產生分享碼，只能使用別人的分享碼載入地圖';
            } else {
                btnOpenCreateShare.classList.remove('guest-locked');
                btnOpenCreateShare.innerHTML = '<svg class="icon"><use href="#share"></use></svg>產生分享碼<span class="menu-end">限時 1 分</span>';
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
        if (inputCols) inputCols.title = '會員特權：已解鎖支援 2 ~ 50 格';
        if (inputRows) inputRows.title = '會員特權：已解鎖支援 2 ~ 50 格';

        // 會員解鎖儲存與個人地圖庫
        if (btnSave) {
            btnSave.classList.remove('guest-locked');
            btnSave.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#device-floppy"></use></svg>儲存';
            btnSave.title = '將目前迷宮儲存至您的個人雲端資料庫 (最多 8 張)';
        }
        if (btnMapLibrary) {
            btnMapLibrary.classList.remove('guest-locked');
            btnMapLibrary.title = '開啟我的迷宮圖庫 (管理與載入已存地圖，最多 8 張)';
        }

        // 排位賽地圖發布權限控管 (初級使用者不能上傳排位賽地圖)
        if (btnPublishToRanked) {
            if (role === 'junior') {
                btnPublishToRanked.classList.add('guest-locked');
                btnPublishToRanked.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#lock"></use></svg>發布到排位賽（中級以上）';
                btnPublishToRanked.title = '初級使用者不能上傳排位賽地圖，需由高級使用者提升為中級或高級使用者！';
            } else {
                btnPublishToRanked.classList.remove('guest-locked');
                btnPublishToRanked.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#upload"></use></svg>發布到排位賽';
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
                btn.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#lock"></use></svg>${cols}×${rows}`;
                btn.title = `登入後可使用 ${cols}×${rows}`;
            } else {
                btn.classList.remove('locked');
                btn.textContent = `${cols}×${rows}`;
                btn.title = `套用 ${cols}×${rows} 規格`;
            }
        });

        const inputCols = document.getElementById('inputCols');
        const inputRows = document.getElementById('inputRows');
        if (inputCols) inputCols.title = '訪客限制：最高 10 格 (登入可解鎖至 50 格)';
        if (inputRows) inputRows.title = '訪客限制：最高 10 格 (登入可解鎖至 50 格)';

        // 訪客限制：儲存、個人地圖庫與發布按鈕顯示鎖定狀態
        if (btnSave) {
            btnSave.classList.add('guest-locked');
            btnSave.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#lock"></use></svg>儲存（需登入）';
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
            btnPublishToRanked.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#lock"></use></svg>發布到排位賽（需登入）';
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

    showAuthAlert('驗證登入中，請稍候…', 'warning');

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
            loadMapAfterSignIn(res.message);

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

    showAuthAlert('帳號建立中，請稍候…', 'warning');

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
            loadMapAfterSignIn(res.message);

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

// 登入或註冊後：有未存的修改就保留目前的地圖，否則載入該使用者雲端最後儲存的地圖
function loadMapAfterSignIn(message) {
    if (editor.isDirty()) {
        refreshMapLibraryBadge();
        showToast(`${message}　已保留你正在編輯的地圖，記得按「儲存」`);
        return;
    }
    showToast(message);
    loadMazeConfig();
}

// 登出
btnLogout?.addEventListener('click', async () => {
    if (editor.isDirty()) {
        const ok = await showConfirm({
            title: '還有沒儲存的修改',
            message: '登出後就不能把這張地圖存到雲端了。確定要登出嗎？',
            confirmLabel: '仍要登出',
            danger: true
        });
        if (!ok) return;
    }
    fetch('api/auth.php?action=logout', { method: 'POST' })
        .then(res => res.json())
        .then(res => {
            updateAuthUI(null);
            if (typeof setActiveMapInfo === 'function') {
                setActiveMapInfo(0, '');
            }
            showToast(res.message || '您已成功登出！');

            if (currentGameMode === 'ranked') {
                switchGameMode('practice');
            }
            if (editor.cols > 10 || editor.rows > 10) {
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
