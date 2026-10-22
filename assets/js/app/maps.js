/**
 * 個人地圖的儲存、讀取、地圖庫
 * 與 assets/js/app/ 其他檔案共用同一個全域範圍，載入順序見 index.php。
 */
// ============================================
// 9. 儲存與讀取 (PHP + MySQL API - 支援每位使用者儲存最多 8 張迷宮)
// ============================================

const loadMazeConfig = () => {
    fetch('api/maps.php')
        .then(res => res.json())
        .then(res => {
            if (res.success && res.data) {
                if (res.source === 'database' && res.id > 0) {
                    setActiveMapInfo(res.id, res.name || '我的迷宮');
                } else {
                    setActiveMapInfo(0, '');
                }
                // 若未登入且取到的資料大於 10x10，自動限制
                if (!currentUser && (
                    (res.data.gridSize?.rows > 10) ||
                    (res.data.gridSize?.cols > 10)
                )) {
                    showToast('訪客模式：已自動限縮為 10×10 迷宮地圖', true);
                    editor.setGridSize(10, 10);
                    return;
                }
                editor.loadData(res.data);
                if (res.count !== undefined && res.max) {
                    const headerMapCountBadge = document.getElementById('headerMapCountBadge');
                    if (headerMapCountBadge && currentUser) {
                        headerMapCountBadge.textContent = `${res.count} / ${res.max}`;
                    }
                }
            }
        })
        .catch(err => {
            console.error('載入失敗:', err);
            // 若無伺服器連線仍可正常使用預設配置
            editor.notifyUpdate();
        })
        // 載入後的地圖作為復原與未存檔判斷的起點
        .finally(() => editor.clearHistory());
};

// 儲存迷宮彈窗相關 DOM 節點
const saveMapModalBackdrop = document.getElementById('saveMapModalBackdrop');
const btnCloseSaveMapModal = document.getElementById('btnCloseSaveMapModal');
const btnCancelSaveMap = document.getElementById('btnCancelSaveMap');
const btnConfirmSaveMap = document.getElementById('btnConfirmSaveMap');
const saveQuotaCount = document.getElementById('saveQuotaCount');
const saveQuotaProgressFill = document.getElementById('saveQuotaProgressFill');
const saveCurrentSpec = document.getElementById('saveCurrentSpec');
const saveCurrentWalls = document.getElementById('saveCurrentWalls');
const saveMapNameInput = document.getElementById('saveMapNameInput');
const slotOptionNewWrapper = document.getElementById('slotOptionNewWrapper');
const radioSaveNew = document.getElementById('radioSaveNew');
const slotNewDesc = document.getElementById('slotNewDesc');
const mapFullWarning = document.getElementById('mapFullWarning');
const saveExistingMapsList = document.getElementById('saveExistingMapsList');
const saveOverwriteGroup = document.getElementById('saveOverwriteGroup');

let userSavedMapsCache = [];

// 當前正在檢視或編輯的個人地圖資訊（用於快速儲存 Ctrl+S 直接覆蓋更新）
let currentActiveMapId = 0;
let currentActiveMapName = '';

function setActiveMapInfo(id, name) {
    currentActiveMapId = parseInt(id, 10) || 0;
    currentActiveMapName = name ? String(name).trim() : '';
}

function openSaveMapModal() {
    if (!currentUser) {
        openAuthModal('訪客限制：「儲存到雲端地圖庫」僅限會員使用！請先登入或免費註冊帳號。', 'login');
        return;
    }
    if (currentGameMode === 'ranked') {
        showToast('排位賽官方地圖禁止儲存至個人資料庫！請先回到練習模式再儲存。', true);
        return;
    }

    // 填入目前地圖資訊
    const cols = editor.cols;
    const rows = editor.rows;
    if (saveCurrentSpec) saveCurrentSpec.textContent = `${cols} × ${rows}・${cols * 30} × ${rows * 30} cm`;

    let wallCount = 0;
    const currentData = editor.getData();
    if (currentData.hWalls) {
        currentData.hWalls.forEach(r => r.forEach(v => { if (v) wallCount++; }));
    }
    if (currentData.vWalls) {
        currentData.vWalls.forEach(r => r.forEach(v => { if (v) wallCount++; }));
    }
    if (saveCurrentWalls) saveCurrentWalls.textContent = `${wallCount} 段`;

    if (saveMapNameInput) {
        saveMapNameInput.value = currentActiveMapName || `我的迷宮 (${cols}×${rows})`;
    }

    saveMapModalBackdrop?.classList.add('show');

    // 讀取當前地圖庫狀態
    fetch('api/maps.php?action=list')
        .then(res => res.json())
        .then(res => {
            if (!res.success) {
                showToast(res.message || '讀取地圖庫失敗', true);
                return;
            }

            userSavedMapsCache = res.list || [];
            const count = res.count || 0;
            const max = res.max || 8;
            const remaining = res.remaining !== undefined ? res.remaining : Math.max(0, max - count);

            // 更新配額進度條
            if (saveQuotaCount) {
                saveQuotaCount.textContent = `${count} / ${max}`;
            }
            if (saveQuotaProgressFill) {
                const pct = Math.min(100, (count / max) * 100);
                saveQuotaProgressFill.style.width = `${pct}%`;
                saveQuotaProgressFill.className = 'quota-progress-fill' + (count >= max ? ' danger' : (count >= Math.max(1, max - 1) ? ' warn' : ''));
            }

            const headerMapCountBadge = document.getElementById('headerMapCountBadge');
            if (headerMapCountBadge) headerMapCountBadge.textContent = `${count} / ${max}`;

            const hasActiveExisting = currentActiveMapId > 0 && userSavedMapsCache.some(x => x.id === currentActiveMapId);

            // 判斷是否已滿額
            if (count >= max) {
                // 滿額：禁用存為全新地圖
                if (slotOptionNewWrapper) {
                    slotOptionNewWrapper.style.opacity = '0.4';
                    slotOptionNewWrapper.style.pointerEvents = 'none';
                    slotOptionNewWrapper.classList.remove('active');
                }
                if (radioSaveNew) radioSaveNew.checked = false;
                if (mapFullWarning) mapFullWarning.style.display = 'block';
            } else {
                if (slotOptionNewWrapper) {
                    slotOptionNewWrapper.style.opacity = '1';
                    slotOptionNewWrapper.style.pointerEvents = 'auto';
                    if (!hasActiveExisting) slotOptionNewWrapper.classList.add('active');
                    else slotOptionNewWrapper.classList.remove('active');
                }
                if (radioSaveNew) radioSaveNew.checked = !hasActiveExisting;
                if (slotNewDesc) slotNewDesc.textContent = `還有 ${remaining} 格`;
                if (mapFullWarning) mapFullWarning.style.display = 'none';
            }

            // 渲染現有地圖列表供覆蓋
            if (userSavedMapsCache.length === 0) {
                if (saveOverwriteGroup) saveOverwriteGroup.style.display = 'none';
                if (saveExistingMapsList) saveExistingMapsList.innerHTML = '';
            } else {
                if (saveOverwriteGroup) saveOverwriteGroup.style.display = 'flex';
                let html = '';
                userSavedMapsCache.forEach((m, idx) => {
                    const isTarget = hasActiveExisting ? (m.id === currentActiveMapId) : (count >= max && idx === 0);
                    const isChecked = isTarget ? 'checked' : '';
                    html += `
                        <label class="existing-map-slot-label ${isChecked ? 'selected' : ''}">
                            <input type="radio" name="saveTargetMode" value="${m.id}" ${isChecked}>
                            <span class="slot-option-label">覆蓋「${escapeHtml(m.name)}」</span>
                            <span class="slot-option-desc">${m.spec}</span>
                        </label>
                    `;
                });
                if (saveExistingMapsList) saveExistingMapsList.innerHTML = html;

                if (hasActiveExisting) {
                    const activeMap = userSavedMapsCache.find(x => x.id === currentActiveMapId);
                    if (activeMap && saveMapNameInput) {
                        saveMapNameInput.value = activeMap.name;
                    }
                }

                // 綁定點選反白狀態
                saveExistingMapsList.querySelectorAll('input[type="radio"]').forEach(radio => {
                    radio.addEventListener('change', () => {
                        if (radio.checked) {
                            slotOptionNewWrapper?.classList.remove('active');
                            saveExistingMapsList.querySelectorAll('.existing-map-slot-label').forEach(lbl => lbl.classList.remove('selected'));
                            radio.closest('.existing-map-slot-label')?.classList.add('selected');

                            // 自動將選中的地圖名稱帶入輸入框
                            const selectedMap = userSavedMapsCache.find(x => x.id === parseInt(radio.value, 10));
                            if (selectedMap && saveMapNameInput) {
                                saveMapNameInput.value = selectedMap.name;
                            }
                        }
                    });
                });
            }
        })
        .catch(err => {
            console.error('查詢地圖庫錯誤:', err);
        });
}

function closeSaveMapModal() {
    saveMapModalBackdrop?.classList.remove('show');
}

btnCloseSaveMapModal?.addEventListener('click', closeSaveMapModal);
btnCancelSaveMap?.addEventListener('click', closeSaveMapModal);
saveMapModalBackdrop?.addEventListener('click', (e) => {
    if (e.target === saveMapModalBackdrop) closeSaveMapModal();
});

radioSaveNew?.addEventListener('change', () => {
    if (radioSaveNew.checked) {
        slotOptionNewWrapper?.classList.add('active');
        saveExistingMapsList?.querySelectorAll('.existing-map-slot-label').forEach(lbl => lbl.classList.remove('selected'));
        const cols = editor.cols;
        const rows = editor.rows;
        if (saveMapNameInput) saveMapNameInput.value = `我的迷宮 (${cols}×${rows})`;
    }
});

slotOptionNewWrapper?.addEventListener('click', () => {
    if (radioSaveNew && !radioSaveNew.disabled && radioSaveNew.offsetParent !== null) {
        radioSaveNew.checked = true;
        radioSaveNew.dispatchEvent(new Event('change'));
    }
});

btnConfirmSaveMap?.addEventListener('click', () => {
    if (!currentUser) {
        closeSaveMapModal();
        openAuthModal('請先登入會員帳號！', 'login');
        return;
    }

    const selectedRadio = document.querySelector('input[name="saveTargetMode"]:checked');
    if (!selectedRadio) {
        showToast('請選擇儲存槽位 (新增或覆蓋現有地圖)！', true);
        return;
    }

    let targetMapId = 0;
    if (selectedRadio.value !== 'new') {
        targetMapId = parseInt(selectedRadio.value, 10) || 0;
    }

    const customName = saveMapNameInput ? saveMapNameInput.value.trim() : '';
    const currentData = editor.getData();
    currentData.isRanked = false;
    currentData.name = customName;
    currentData.targetMapId = targetMapId;

    btnConfirmSaveMap.disabled = true;
    btnConfirmSaveMap.textContent = '儲存中…';

    fetch('api/maps.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentData)
    })
    .then(res => res.json())
    .then(res => {
        btnConfirmSaveMap.disabled = false;
        btnConfirmSaveMap.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#device-floppy"></use></svg>儲存';

        if (res.success) {
            closeSaveMapModal();
            editor.markSaved();
            setActiveMapInfo(res.mapId, res.mapName);
            showToast(res.message || '已儲存');
            refreshMapLibraryBadge();
        } else {
            showToast(res.message || '儲存失敗', true);
            if (res.requireLogin) {
                closeSaveMapModal();
                openAuthModal(res.message, 'login');
            }
        }
    })
    .catch(err => {
        btnConfirmSaveMap.disabled = false;
        btnConfirmSaveMap.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#device-floppy"></use></svg>儲存';
        showToast('無法連接伺服器進行儲存', true);
    });
});

// 有未存的修改時，關閉或重新整理頁面前先提醒（重新開啟會載入雲端最後儲存的版本）
window.addEventListener('beforeunload', (e) => {
    if (editor.isDirty()) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// 儲存按鈕點擊
document.getElementById('btnSave').addEventListener('click', () => {
    if (currentGameMode === 'ranked') {
        showToast('排位賽官方地圖禁止儲存至個人資料庫！請先回到練習模式再儲存。', true);
        return;
    }
    if (!currentUser) {
        openAuthModal('訪客限制：「儲存到雲端地圖庫」僅限會員使用！請先登入或免費註冊帳號。', 'login');
        return;
    }
    openSaveMapModal();
});

// 快速儲存（Ctrl + S / Cmd + S）
let isQuickSaving = false;

function quickSaveMap() {
    if (currentGameMode === 'ranked') {
        showToast('排位賽官方地圖禁止儲存至個人資料庫！請先回到練習模式再儲存。', true);
        return;
    }
    if (!currentUser) {
        openAuthModal('訪客限制：「快速儲存」僅限會員使用！請先登入或免費註冊帳號。', 'login');
        return;
    }
    if (isQuickSaving) return;

    // 若尚未儲存過個人地圖槽位，開啟儲存彈窗進行命名與指定槽位
    if (!currentActiveMapId) {
        openSaveMapModal();
        return;
    }

    isQuickSaving = true;
    const currentData = editor.getData();
    currentData.isRanked = false;
    currentData.name = currentActiveMapName;
    currentData.targetMapId = currentActiveMapId;

    const btnSaveEl = document.getElementById('btnSave');
    if (btnSaveEl) btnSaveEl.classList.add('btn-saving');

    showToast(`⏳ 正在快速儲存【${currentActiveMapName}】…`, false);

    fetch('api/maps.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentData)
    })
    .then(res => res.json())
    .then(res => {
        isQuickSaving = false;
        if (btnSaveEl) btnSaveEl.classList.remove('btn-saving');

        if (res.success) {
            editor.markSaved();
            setActiveMapInfo(res.mapId || currentActiveMapId, res.mapName || currentActiveMapName);
            showToast(`💾 已快速儲存至【${res.mapName || currentActiveMapName}】！`);
            refreshMapLibraryBadge();
        } else {
            if (res.message && res.message.includes('不存在')) {
                setActiveMapInfo(0, '');
                openSaveMapModal();
            } else {
                showToast(res.message || '快速儲存失敗', true);
            }
        }
    })
    .catch(err => {
        isQuickSaving = false;
        if (btnSaveEl) btnSaveEl.classList.remove('btn-saving');
        console.error('快速儲存錯誤:', err);
        showToast('無法連接伺服器進行儲存', true);
    });
}

// 快速儲存快捷鍵 Ctrl + S / Cmd + S
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        // 若儲存彈窗已開啟，直接確認送出
        if (saveMapModalBackdrop?.classList.contains('show')) {
            btnConfirmSaveMap?.click();
            return;
        }
        quickSaveMap();
    }
});

// 檔案選單中的「快速儲存」
document.getElementById('btnQuickSave')?.addEventListener('click', quickSaveMap);

// 地圖庫彈窗相關 DOM 節點
const mapLibraryModalBackdrop = document.getElementById('mapLibraryModalBackdrop');
const btnCloseMapLibraryModal = document.getElementById('btnCloseMapLibraryModal');
const btnRefreshMapLibrary = document.getElementById('btnRefreshMapLibrary');
const libraryQuotaCount = document.getElementById('libraryQuotaCount');
const libraryQuotaProgressFill = document.getElementById('libraryQuotaProgressFill');
const mapLibraryList = document.getElementById('mapLibraryList');

function openMapLibraryModal() {
    if (!currentUser) {
        openAuthModal('訪客限制：「我的地圖庫」僅限會員使用！請先登入或免費註冊帳號。', 'login');
        return;
    }
    if (currentGameMode === 'ranked') {
        showToast('排位賽中不能開啟地圖庫，請先切回練習', true);
        return;
    }

    mapLibraryModalBackdrop?.classList.add('show');
    loadMapLibraryList();
}

function closeMapLibraryModal() {
    mapLibraryModalBackdrop?.classList.remove('show');
}

btnCloseMapLibraryModal?.addEventListener('click', closeMapLibraryModal);
mapLibraryModalBackdrop?.addEventListener('click', (e) => {
    if (e.target === mapLibraryModalBackdrop) closeMapLibraryModal();
});
btnRefreshMapLibrary?.addEventListener('click', loadMapLibraryList);

function loadMapLibraryList() {
    if (!mapLibraryList) return;
    mapLibraryList.innerHTML = '<div class="list-note">載入中…</div>';

    fetch('api/maps.php?action=list')
        .then(res => res.json())
        .then(res => {
            if (!res.success) {
                mapLibraryList.innerHTML = `<div class="list-note error">無法載入地圖庫：${escapeHtml(res.message || '未知錯誤')}</div>`;
                return;
            }

            const list = res.list || [];
            const count = res.count || 0;
            const max = res.max || 8;
            const remaining = res.remaining !== undefined ? res.remaining : Math.max(0, max - count);

            // 更新容量進度條
            if (libraryQuotaCount) {
                libraryQuotaCount.textContent = `${count} / ${max}`;
            }
            if (libraryQuotaProgressFill) {
                const pct = Math.min(100, (count / max) * 100);
                libraryQuotaProgressFill.style.width = `${pct}%`;
                libraryQuotaProgressFill.className = 'quota-progress-fill' + (count >= max ? ' danger' : (count >= Math.max(1, max - 1) ? ' warn' : ''));
            }

            const headerMapCountBadge = document.getElementById('headerMapCountBadge');
            if (headerMapCountBadge) headerMapCountBadge.textContent = `${count} / ${max}`;

            if (list.length === 0) {
                mapLibraryList.innerHTML = `
                    <div class="list-note">還沒有存任何地圖。每個帳號最多可以存 8 張。</div>
                `;
                return;
            }

            let html = '';
            list.forEach((m, idx) => {
                html += `
                    <div class="map-library-item">
                        <div class="library-item-main">
                            <div class="library-item-title">${escapeHtml(m.name)}</div>
                            <div class="library-item-meta">${m.spec}・更新於 ${(m.updatedAt || m.createdAt || '-').substring(5, 16)}</div>
                        </div>
                        <button type="button" class="tool-btn btn-sm btn-map-load" data-id="${m.id}" data-name="${escapeHtml(m.name)}">載入</button>
                        <button type="button" class="tool-btn btn-sm btn-ghost btn-map-delete" data-id="${m.id}" data-name="${escapeHtml(m.name)}" aria-label="刪除${escapeHtml(m.name)}"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#trash"></use></svg></button>
                    </div>
                `;
            });
            mapLibraryList.innerHTML = html;

            // 綁定載入按鈕
            mapLibraryList.querySelectorAll('.btn-map-load').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const name = btn.getAttribute('data-name');
                    loadUserMapById(id, name);
                });
            });

            // 綁定刪除按鈕
            mapLibraryList.querySelectorAll('.btn-map-delete').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const name = btn.getAttribute('data-name');
                    deleteUserMapById(id, name);
                });
            });
        })
        .catch(err => {
            mapLibraryList.innerHTML = '<div class="list-note error">無法連線到伺服器，請稍後再試</div>';
        });
}

function loadUserMapById(id, name) {
    fetch(`api/maps.php?action=load&id=${id}`)
        .then(res => res.json())
        .then(res => {
            if (res.success && res.data) {
                setActiveMapInfo(res.id || id, name || res.name);
                editor.loadData(res.data);
                editor.markSaved();
                maze3D.resetOrbitCamera();
                closeMapLibraryModal();
                showToast(`已成功載入個人迷宮【${name || res.name}】！`);
            } else {
                showToast(res.message || '載入迷宮失敗', true);
            }
        })
        .catch(err => {
            showToast('無法連接伺服器載入地圖', true);
        });
}

async function deleteUserMapById(id, name) {
    const ok = await showConfirm({
        title: `刪除「${name}」？`,
        message: '刪除後會空出 1 個雲端儲存格，這個動作無法復原。',
        confirmLabel: '刪除',
        danger: true
    });
    if (!ok) return;

    fetch(`api/maps.php?action=delete&id=${id}`, { method: 'POST' })
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                if (currentActiveMapId === parseInt(id, 10)) {
                    setActiveMapInfo(0, '');
                }
                showToast(res.message || '地圖已刪除');
                loadMapLibraryList();
                refreshMapLibraryBadge();
            } else {
                showToast(res.message || '刪除失敗', true);
            }
        })
        .catch(err => {
            showToast('無法連接伺服器刪除地圖', true);
        });
}

// 我的地圖庫按鈕點擊
document.getElementById('btnFileMapLibrary').addEventListener('click', () => document.getElementById('btnMapLibrary').click());
setupMenu(document.getElementById('btnSpecMenu'), document.getElementById('specMenu'));
setupMenu(document.getElementById('btnMapMenu'), document.getElementById('mapMenu'));
setupMenu(document.getElementById('btnFileMenu'), document.getElementById('fileMenu'));
setupMenu(document.getElementById('btnShareMenu'), document.getElementById('shareMenu'));
setupMenu(document.getElementById('btnShortcuts'), document.getElementById('shortcutsMenu'));

document.getElementById('btnMapLibrary')?.addEventListener('click', () => {
    if (currentGameMode === 'ranked') {
        showToast('排位賽官方盲測模式禁止存取個人圖庫！請先回到練習模式。', true);
        return;
    }
    if (!currentUser) {
        openAuthModal('訪客限制：「我的地圖庫」功能僅限會員使用！請先登入或免費註冊帳號。', 'login');
        return;
    }
    openMapLibraryModal();
});
