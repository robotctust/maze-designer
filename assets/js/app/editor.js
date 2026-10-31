/**
 * 2D 編輯器操作：縮放平移、規格切換、工具列、輔助按鈕
 * 與 assets/js/app/ 其他檔案共用同一個全域範圍，載入順序見 index.php。
 */
// 2-0. 初始化 2D 地圖縮放 (Zoom) 與拖曳平移 (Pan) 系統
const mapViewport = document.getElementById('mapViewport');
if (mapViewport && editor.initZoomAndPan) {
    editor.initZoomAndPan(mapViewport);
}

// 綁定地圖縮放控制列按鈕
const btnZoomIn = document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('btnZoomOut');
const btnZoomReset = document.getElementById('btnZoomReset');
const btnZoomFit = document.getElementById('btnZoomFit');
const zoomPercentDisplay = document.getElementById('zoomPercentDisplay');

if (btnZoomIn) btnZoomIn.addEventListener('click', () => editor.zoomIn());
if (btnZoomOut) btnZoomOut.addEventListener('click', () => editor.zoomOut());
if (btnZoomReset) btnZoomReset.addEventListener('click', () => editor.resetZoom());
if (btnZoomFit) btnZoomFit.addEventListener('click', () => editor.fitZoom());
if (zoomPercentDisplay) zoomPercentDisplay.addEventListener('click', () => editor.resetZoom());

// 2-0-1. 2D 地圖與版面切換控制 (設計時用一半版面 50%，遙控時恢復正常大小 480px)
const editorPanel = document.querySelector('.editor-panel');
const btnToggleMapSize = document.getElementById('btnToggleMapSize');
let currentMapMode = 'large'; // 'large' (設計時 50% 一半版面) 或 'compact' (遙控時恢復正常大小)

// 上方懸浮工具列佔用的高度（上下各留一份，地圖置中時不會被工具列蓋住）
const MAP_OVERLAY_INSET = 56;

function getOptimalDesignCanvasSize() {
    // 設計時 50% 版面下的最佳畫布像素尺寸 (兼顧寬度與高度)
    const viewport = document.getElementById('mapViewport');
    const maxW = viewport ? viewport.clientWidth - 32 : 560;
    const maxH = viewport ? viewport.clientHeight - MAP_OVERLAY_INSET * 2 : 560;
    return Math.max(320, Math.min(720, maxW, maxH));
}

function set2DMapMode(mode, showNotification = false) {
    if (!editor) return;
    currentMapMode = mode;
    if (mode === 'compact') {
        // 遙控時：恢復正常大小 (420px)，左側收納至 480px，右側 3D 享有寬敞視野
        editorPanel.classList.add('mode-compact');
        editor.setCanvasBaseSize(400);
        if (btnToggleMapSize) {
            btnToggleMapSize.querySelector('use').setAttribute('href', '#arrows-minimize');
            btnToggleMapSize.title = '恢復並排';
            btnToggleMapSize.setAttribute('aria-label', '恢復並排');
        }
    } else {
        // 設計時：使用一半版面 (50%)，畫布自適應大圖，方便精準規劃與點選牆壁
        editorPanel.classList.remove('mode-compact');
        const designSize = getOptimalDesignCanvasSize();
        editor.setCanvasBaseSize(designSize);
        if (btnToggleMapSize) {
            btnToggleMapSize.querySelector('use').setAttribute('href', '#arrows-maximize');
            btnToggleMapSize.title = '放大 3D';
            btnToggleMapSize.setAttribute('aria-label', '放大 3D');
        }
    }
    editor.resetZoom(true);

    // 配合 CSS 0.35s 寬度過渡，更新 3D 視角
    if (window.maze3D) {
        maze3D.onWindowResize();
        setTimeout(() => maze3D.onWindowResize(), 150);
        setTimeout(() => maze3D.onWindowResize(), 360);
    }
}

// 手動點選切換按鈕
if (btnToggleMapSize) {
    btnToggleMapSize.addEventListener('click', () => {
        set2DMapMode(currentMapMode === 'large' ? 'compact' : 'large', true);
    });
}

// 3D 設定選單
setupMenu(document.getElementById('btnSimSettings'), document.getElementById('simSettingsMenu'));

// 觸控方向鍵：按住等同按下對應的鍵盤按鍵
document.querySelectorAll('.pad-btn[data-key]').forEach(btn => {
    const key = btn.dataset.key;
    const press = (down) => (e) => {
        e.preventDefault();
        if (maze3D) maze3D.keys[key] = down;
    };
    btn.addEventListener('pointerdown', press(true));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => btn.addEventListener(t, press(false)));
});

// 監聽 3D 畫布容器大小改變，確保平滑過渡
if (window.ResizeObserver && canvasContainer) {
    const ro = new ResizeObserver(() => {
        if (maze3D) maze3D.onWindowResize();
    });
    ro.observe(canvasContainer);
}

// 2D 編輯區大小改變時（含首次載入、平板轉向）自適應設計大圖
const mapViewportEl = document.getElementById('mapViewport');
if (window.ResizeObserver && mapViewportEl) {
    new ResizeObserver(() => {
        // 平板直向切到「試跑」分頁時 2D 被隱藏（寬度 0），不必重算
        if (currentMapMode === 'large' && editor && mapViewportEl.clientWidth) {
            editor.setCanvasBaseSize(getOptimalDesignCanvasSize());
        }
    }).observe(mapViewportEl);
}

// 平板直向的「設計／試跑」分頁：一次只顯示 2D 或 3D
const appContainer = document.querySelector('.app-container');
const btnViewDesign = document.getElementById('btnViewDesign');
const btnViewDrive = document.getElementById('btnViewDrive');

function setPortraitView(view) {
    const drive = view === 'drive';
    // 回到設計時先停下試跑，避免看不到 3D 時車子還在跑、計時還在走
    if (!drive && maze3D.isDriving) btnStopDrive.click();
    appContainer.classList.toggle('view-drive', drive);
    btnViewDesign.classList.toggle('active', !drive);
    btnViewDrive.classList.toggle('active', drive);
    btnViewDesign.setAttribute('aria-selected', String(!drive));
    btnViewDrive.setAttribute('aria-selected', String(drive));
    if (!drive && currentMapMode === 'compact') set2DMapMode('large', false);
}

btnViewDesign.addEventListener('click', () => setPortraitView('design'));
btnViewDrive.addEventListener('click', () => setPortraitView('drive'));

// 2-1. 地圖大小對話框：「新增空白地圖…」與「調整地圖大小…」共用（未登入僅限 10×10 含以下）
const mapSizeModalBackdrop = document.getElementById('mapSizeModalBackdrop');
const inputCols = document.getElementById('inputCols');
const inputRows = document.getElementById('inputRows');
let mapSizeMode = 'new'; // 'new' 新增空白地圖、'resize' 調整目前地圖

function showMapSizeValues(c, r) {
    inputCols.value = c;
    inputRows.value = r;
    updateMapSizePreview();
}

function updateMapSizePreview() {
    const c = parseInt(inputCols.value, 10) || 0;
    const r = parseInt(inputRows.value, 10) || 0;
    document.getElementById('specDimensionsCm').textContent = `${mazeTotalCm(c)} × ${mazeTotalCm(r)} cm`;
    document.querySelectorAll('.spec-preset-btn').forEach(btn => {
        btn.classList.toggle('active', +btn.dataset.cols === c && +btn.dataset.rows === r);
    });
}

function openMapSizeModal(mode) {
    if (currentGameMode === 'ranked') return;
    mapSizeMode = mode;
    const isNew = mode === 'new';
    document.getElementById('mapSizeTitle').textContent = isNew ? '新增空白地圖' : '調整地圖大小';
    document.getElementById('mapSizeSub').textContent = isNew ? '選擇地圖大小' : `目前 ${editor.cols} × ${editor.rows} 格`;
    document.getElementById('mapSizeNote').textContent = isNew
        ? '可設定 2～50 格，訪客最多 10 × 10'
        : '範圍內的牆會保留，超出新範圍的牆會移除；起點和終點會移到範圍內。';
    document.getElementById('btnConfirmMapSize').textContent = isNew ? '建立' : '套用';
    showMapSizeValues(editor.cols, editor.rows);
    mapSizeModalBackdrop.classList.add('show');
    inputCols.focus();
}

function closeMapSizeModal() {
    mapSizeModalBackdrop.classList.remove('show');
}

// 套用大小：新增時建立空白地圖，調整時保留範圍內的牆
function applyMapSize(mode, c, r) {
    if (timerRunning) {
        maze3D.stopDriving();
        resetTimer();
    }
    if (currentMapMode === 'compact') {
        set2DMapMode('large', false);
    }
    if (mode === 'new') {
        createBlankMap(c, r);
        return;
    }
    editor.setGridSize(c, r, true);
    maze3D.resetOrbitCamera();
    showToast(`已調整為 ${c}×${r} 格`, false, UNDO_TOAST_ACTION);
}

document.getElementById('btnConfirmMapSize').addEventListener('click', () => {
    const c = parseInt(inputCols.value, 10);
    const r = parseInt(inputRows.value, 10);
    if (isNaN(c) || c < 2 || c > 50 || isNaN(r) || r < 2 || r > 50) {
        showToast('格數請輸入 2～50 之間的整數', true);
        return;
    }
    closeMapSizeModal();

    // 未登入只能使用 10×10 含以下，登入後自動套用（見 auth.js）
    if (!currentUser && (c > 10 || r > 10)) {
        pendingTargetGrid = { cols: c, rows: r, mode: mapSizeMode };
        openAuthModal(`未登入只能使用 10×10 以下的地圖。登入後會自動套用 ${c}×${r} 格。`, 'login');
        return;
    }
    if (mapSizeMode === 'resize' && c === editor.cols && r === editor.rows) return;
    applyMapSize(mapSizeMode, c, r);
});

document.querySelectorAll('.spec-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => showMapSizeValues(+btn.dataset.cols, +btn.dataset.rows));
});
[inputCols, inputRows].forEach(el => {
    el.addEventListener('input', updateMapSizePreview);
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('btnConfirmMapSize').click();
    });
});
document.getElementById('btnCancelMapSize').addEventListener('click', closeMapSizeModal);
document.getElementById('btnCloseMapSizeModal').addEventListener('click', closeMapSizeModal);
mapSizeModalBackdrop.addEventListener('click', (e) => {
    if (e.target === mapSizeModalBackdrop) closeMapSizeModal();
});
document.getElementById('btnResizeMap').addEventListener('click', () => openMapSizeModal('resize'));

// 3. 工具切換 (設置牆壁 / 設定起點 / 設定終點 / 拖曳平移)
const toolButtons = [
    { id: 'toolWall', tool: 'wall', tip: '點格線新增或移除牆壁' },
    { id: 'toolStart', tool: 'start', tip: '點任一格設為起點' },
    { id: 'toolGoal', tool: 'goal', tip: '點任一格設為終點' },
    { id: 'toolPan', tool: 'pan', tip: '按住拖曳平移地圖' }
];

toolButtons.forEach(btnObj => {
    const el = document.getElementById(btnObj.id);
    el.addEventListener('click', () => {
        toolButtons.forEach(b => document.getElementById(b.id).classList.remove('active'));
        el.classList.add('active');
        editor.setTool(btnObj.tool);
        document.getElementById('toolTip').textContent = btnObj.tip;
        if (currentMapMode === 'compact') {
            set2DMapMode('large', false);
        }
    });
});

// 3-1. 復原／重做（排位賽時編輯器隱藏，不作用）
function undoMapEdit() {
    if (currentGameMode === 'practice') editor.undo();
}
function redoMapEdit() {
    if (currentGameMode === 'practice') editor.redo();
}
const UNDO_TOAST_ACTION = { label: '復原', onClick: undoMapEdit };

document.getElementById('btnUndo').addEventListener('click', undoMapEdit);
document.getElementById('btnRedo').addEventListener('click', redoMapEdit);

window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    // 輸入框保留瀏覽器原本的復原；有彈窗開著時不動到背後的地圖
    const el = document.activeElement;
    if (el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)) return;
    if (document.querySelector('.auth-modal-backdrop.show')) return;
    e.preventDefault();
    if (key === 'y' || e.shiftKey) redoMapEdit();
    else undoMapEdit();
});

// 4. 輔助操作與匯出入按鈕
document.getElementById('btnOuterWalls').addEventListener('click', () => {
    if (currentMapMode === 'compact') set2DMapMode('large', false);
    const state = editor.toggleOuterWalls();
    showToast(state ? '已開啟四周圍牆' : '已關閉四周圍牆');
});
document.getElementById('btnClearInner').addEventListener('click', () => {
    if (currentMapMode === 'compact') set2DMapMode('large', false);
    editor.clearInnerWalls();
    showToast('已清空內部牆壁 (保留四周圍牆)', false, UNDO_TOAST_ACTION);
});
document.getElementById('btnClearAll').addEventListener('click', () => {
    if (currentMapMode === 'compact') set2DMapMode('large', false);
    editor.clearAllWalls();
    showToast('已清空所有牆壁 (包含四周圍牆)', false, UNDO_TOAST_ACTION);
});
document.getElementById('btnRandom').addEventListener('click', () => {
    if (currentMapMode === 'compact') set2DMapMode('large', false);
    editor.generateRandomMaze();
    showToast('已隨機生成迷宮！', false, UNDO_TOAST_ACTION);
});

// 匯出 2D 地圖 (高解析 PNG 圖片)
document.getElementById('btnExportPNG').addEventListener('click', () => {
    editor.exportPNG(
        () => showToast('2D 迷宮圖片已成功匯出下載！'),
        (errMsg) => showToast(errMsg, true)
    );
});

// 匯出 JSON 資料
document.getElementById('btnExportJSON').addEventListener('click', () => {
    editor.exportJSON(() => showToast('迷宮設定 JSON 已成功匯出！'));
});

// 匯入 JSON 資料
const fileInputJSON = document.getElementById('fileInputJSON');
document.getElementById('btnImportJSON').addEventListener('click', () => {
    fileInputJSON.value = '';
    fileInputJSON.click();
});

fileInputJSON.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        editor.importJSON(
            file,
            () => {
                setActiveMapInfo(0, '');
                showToast('已成功載入迷宮設定！');
            },
            (errMsg) => showToast(errMsg, true)
        );
    }
});

// ============================================
// 5. 2D 地圖底板深淺色切換
// ============================================
const btnToggle2dTheme = document.getElementById('btnToggle2dTheme');
const btnMenuToggle2dTheme = document.getElementById('btnMenuToggle2dTheme');
const icon2dTheme = document.getElementById('icon2dTheme');
const menu2dThemeStatus = document.getElementById('menu2dThemeStatus');

const MAP_2D_THEME_KEY = 'maze_2d_theme';

function set2DMapTheme(theme, showFeedback = true) {
    const isLight = theme === 'light';
    if (!mapViewport) return;

    if (isLight) {
        mapViewport.classList.add('theme-light');
    } else {
        mapViewport.classList.remove('theme-light');
    }

    if (icon2dTheme) {
        icon2dTheme.setAttribute('href', isLight ? '#moon' : '#sun');
    }
    if (btnToggle2dTheme) {
        btnToggle2dTheme.setAttribute('title', isLight ? '切換為深色地圖底板' : '切換為淺色地圖底板');
        btnToggle2dTheme.setAttribute('aria-label', isLight ? '切換為深色地圖底板' : '切換為淺色地圖底板');
    }
    if (menu2dThemeStatus) {
        menu2dThemeStatus.textContent = isLight ? '淺色' : '深色';
    }
    const menuThemeIcon = btnMenuToggle2dTheme?.querySelector('use');
    if (menuThemeIcon) {
        menuThemeIcon.setAttribute('href', isLight ? '#moon' : '#sun');
    }

    try {
        localStorage.setItem(MAP_2D_THEME_KEY, isLight ? 'light' : 'dark');
    } catch (e) {}

    if (showFeedback) {
        showToast(isLight ? '已切換為淺色地圖底板' : '已切換為深色地圖底板');
    }
}

function toggle2DMapTheme() {
    const isCurrentlyLight = mapViewport?.classList.contains('theme-light');
    set2DMapTheme(isCurrentlyLight ? 'dark' : 'light', true);
}

btnToggle2dTheme?.addEventListener('click', toggle2DMapTheme);
btnMenuToggle2dTheme?.addEventListener('click', toggle2DMapTheme);

// 初始化載入偏好的底板顏色
try {
    const savedTheme = localStorage.getItem(MAP_2D_THEME_KEY);
    if (savedTheme === 'light') {
        set2DMapTheme('light', false);
    } else {
        set2DMapTheme('dark', false);
    }
} catch (e) {}
