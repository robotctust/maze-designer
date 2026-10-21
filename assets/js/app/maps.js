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
                // 若未登入且取到的資料大於 10x10，自動限制
                if (!currentUser && (
                    (res.data.gridSize?.rows > 10) ||
                    (res.data.gridSize?.cols > 10)
                )) {
                    showToast('訪客模式：已自動限縮為 10×10 迷宮地圖', true);
                    editor.setGridSize(10, 10);
                    editor.clearHistory();
                    return;
                }
                editor.loadData(res.data);
                editor.clearHistory();
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
        });
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

function openSaveMapModal() {
    if (!currentUser) {
        openAuthModal('訪客限制：【儲存迷宮設定至雲端資料庫】僅限會員使用！請先登入或免費註冊帳號。', 'login');
        return;
    }
    if (currentGameMode === 'ranked') {
        showToast('排位賽官方地圖禁止儲存至個人資料庫！請切換至【練習賽】進行迷宮儲存。', true);
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
        saveMapNameInput.value = `我的迷宮 (${cols}×${rows})`;
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

            // 判斷是否已滿 5 張
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
                    slotOptionNewWrapper.classList.add('active');
                }
                if (radioSaveNew) radioSaveNew.checked = true;
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
                    const isChecked = (count >= max && idx === 0) ? 'checked' : '';
                    html += `
                        <label class="existing-map-slot-label ${isChecked ? 'selected' : ''}">
                            <input type="radio" name="saveTargetMode" value="${m.id}" ${isChecked}>
                            <span class="slot-option-label">覆蓋「${escapeHtml(m.name)}」</span>
                            <span class="slot-option-desc">${m.spec}</span>
                        </label>
                    `;
                });
                if (saveExistingMapsList) saveExistingMapsList.innerHTML = html;

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

// 儲存按鈕點擊
document.getElementById('btnSave').addEventListener('click', () => {
    if (currentGameMode === 'ranked') {
        showToast('排位賽官方地圖禁止儲存至個人資料庫！請切換至【練習賽】進行迷宮儲存。', true);
        return;
    }
    if (!currentUser) {
        openAuthModal('訪客限制：【儲存迷宮設定至雲端資料庫】僅限會員使用！請先登入或免費註冊帳號。', 'login');
        return;
    }
    openSaveMapModal();
});

// 地圖庫彈窗相關 DOM 節點
const mapLibraryModalBackdrop = document.getElementById('mapLibraryModalBackdrop');
const btnCloseMapLibraryModal = document.getElementById('btnCloseMapLibraryModal');
const btnRefreshMapLibrary = document.getElementById('btnRefreshMapLibrary');
const libraryQuotaCount = document.getElementById('libraryQuotaCount');
const libraryQuotaProgressFill = document.getElementById('libraryQuotaProgressFill');
const mapLibraryList = document.getElementById('mapLibraryList');

function openMapLibraryModal() {
    if (!currentUser) {
        openAuthModal('訪客限制：【我的個人地圖庫】僅限會員使用！請先登入或免費註冊帳號。', 'login');
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
                editor.loadData(res.data);
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

function deleteUserMapById(id, name) {
    if (!confirm(`確定要刪除迷宮【${name}】嗎？\n刪除後將釋放 1 個雲端儲存槽位，此動作無法復原！`)) {
        return;
    }

    fetch(`api/maps.php?action=delete&id=${id}`, { method: 'POST' })
        .then(res => res.json())
        .then(res => {
            if (res.success) {
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
        showToast('排位賽官方盲測模式禁止存取個人圖庫！請切換至【練習賽】進行管理。', true);
        return;
    }
    if (!currentUser) {
        openAuthModal('訪客限制：【我的個人地圖庫】功能僅限會員使用！請先登入或免費註冊帳號。', 'login');
        return;
    }
    openMapLibraryModal();
});
