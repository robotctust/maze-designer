/**
 * Toast 訊息提示、共用的按鈕與狀態元素、目前賽事模式
 * 與 assets/js/app/ 其他檔案共用同一個全域範圍，載入順序見 index.php。
 */
const svgElement = document.getElementById('mazeSvg');
const canvasContainer = document.getElementById('canvasContainer');

// Toast 訊息提示；action = { label, onClick } 時附一個按鈕，顯示時間較長
let toastTimer = null;
function showToast(msg, isError = false, action = null) {
    const toast = document.getElementById('toastMsg');
    if (!toast) return;
    toast.textContent = msg;
    if (action) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'toast-action';
        btn.textContent = action.label;
        btn.addEventListener('click', () => {
            toast.classList.remove('show');
            action.onClick();
        });
        toast.appendChild(btn);
    }
    toast.classList.toggle('error', isError);
    toast.classList.toggle('has-action', !!action);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), action ? 5000 : 2800);
}

// 共用確認框：回傳 Promise，按確定為 true；danger 時確定鈕為紅色。按 Esc、點背景或取消為 false
// 傳入 inputValue 時多一個輸入欄，確定後回傳輸入的文字（取消回傳 false）
function showConfirm({ title, message = '', confirmLabel = '確定', danger = false, inputValue }) {
    const backdrop = document.getElementById('confirmModalBackdrop');
    const input = document.getElementById('confirmInput');
    const hasInput = inputValue !== undefined;
    input.hidden = !hasInput;
    input.value = hasInput ? inputValue : '';
    const okBtn = document.getElementById('btnConfirmOk');
    const cancelBtn = document.getElementById('btnConfirmCancel');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    okBtn.textContent = confirmLabel;
    okBtn.classList.toggle('btn-danger', danger);
    okBtn.classList.toggle('btn-save', !danger);
    backdrop.classList.add('show');
    // 危險操作預設停在「取消」，避免按 Enter 誤刪
    if (hasInput) input.select();
    else (danger ? cancelBtn : okBtn).focus();

    return new Promise(resolve => {
        const finish = (result) => {
            backdrop.classList.remove('show');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            backdrop.removeEventListener('click', onBackdrop);
            document.removeEventListener('keydown', onKey, true);
            resolve(result);
        };
        const onOk = () => finish(hasInput ? input.value.trim() : true);
        const onCancel = () => finish(false);
        const onBackdrop = (e) => { if (e.target === backdrop) finish(false); };
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                finish(false);
            } else if (e.key === 'Enter' && hasInput) {
                e.preventDefault();
                onOk();
            }
        };
        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        backdrop.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKey, true);
    });
}

const btnStartDrive = document.getElementById('btnStartDrive');
const btnStopDrive = document.getElementById('btnStopDrive');
const btnResetCar = document.getElementById('btnResetCar');
const btnModeOrbit = document.getElementById('btnModeOrbit');
const btnModeDriver = document.getElementById('btnModeDriver');
const btnResetCam = document.getElementById('btnResetCam');
const driveStatusBadge = document.getElementById('driveStatusBadge');
const driveStatusText = document.getElementById('driveStatusText');
const driveStatusDot = document.getElementById('driveStatusDot');

// 賽事模式：'practice' (練習賽) | 'ranked' (排位賽)
let currentGameMode = 'practice';
let practiceDriveState = 'idle'; // 'idle' | 'running' | 'paused'
let currentRankedSize = '10x10'; // 10x10, 15x15, 20x20, 25x25, 30x30, apex, special
let currentRankedMapId = 'map_1';
let currentRankedLimitMs = 90 * 1000;

// 下拉選單：點按鈕開關，點外面或按 Esc 關閉
function closeMenu(menu) {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    document.querySelector(`[aria-controls="${menu.id}"]`)?.setAttribute('aria-expanded', 'false');
}
function setupMenu(trigger, menu, onOpen) {
    trigger.setAttribute('aria-controls', menu.id);
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = menu.hidden;
        document.querySelectorAll('.menu').forEach(closeMenu);
        if (willOpen) {
            menu.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            if (onOpen) onOpen();
        }
    });
    menu.addEventListener('click', (e) => {
        if (!menu.classList.contains('keep-open') && e.target.closest('button')) closeMenu(menu);
    });
}
document.addEventListener('click', (e) => {
    document.querySelectorAll('.menu').forEach(m => { if (!m.contains(e.target)) closeMenu(m); });
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.menu').forEach(closeMenu);
});
