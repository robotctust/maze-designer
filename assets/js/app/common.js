/**
 * Toast 訊息提示、共用的按鈕與狀態元素、目前賽事模式
 * 與 assets/js/app/ 其他檔案共用同一個全域範圍，載入順序見 index.php。
 */
const svgElement = document.getElementById('mazeSvg');
const canvasContainer = document.getElementById('canvasContainer');

// Toast 訊息提示
function showToast(msg, isError = false) {
    const toast = document.getElementById('toastMsg');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
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
