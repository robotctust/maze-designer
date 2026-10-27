/**
 * 計算步數頁面：用設計中的地圖，標出每一格離終點幾步
 * 與 assets/js/app/ 其他檔案共用同一個全域範圍，載入順序見 index.php。
 */
const stepsPage = document.getElementById('stepsPage');
const designWorkspace = document.querySelector('.workspace:not(.steps-page)');
const stepsViewport = document.getElementById('stepsViewport');

const stepsMap = new MazeEditor(document.getElementById('stepsSvg'), {
    baseSize: 560,
    showSteps: true,
    zoomDisplay: document.getElementById('stepsZoomDisplay'),
    onCellClick: (x, y) => {
        stepsMap.selectedCell = { x, y };
        stepsMap.render();
        const n = stepsMap.computeSteps()[y][x];
        document.getElementById('stepsCellPos').textContent = `(${x}, ${y})`;
        document.getElementById('stepsCellValue').innerHTML = n === null ? '走不到終點' : `<strong>${n}</strong> 步`;
    }
});
stepsMap.setTool('inspect');
stepsMap.initZoomAndPan(stepsViewport);

function openStepsPage() {
    stepsViewport.classList.toggle('theme-light', mapViewport.classList.contains('theme-light'));
    stepsMap.selectedCell = null;
    stepsMap.loadData(editor.getData());
    const n = stepsMap.computeSteps()[stepsMap.start.y][stepsMap.start.x];
    document.getElementById('stepsStartValue').textContent = n === null ? '走不到' : n;
    document.getElementById('stepsCellPos').textContent = '';
    document.getElementById('stepsCellValue').textContent = '點地圖上的格子';

    designWorkspace.hidden = true;
    stepsPage.hidden = false;
    stepsMap.fitZoom();
}

function closeStepsPage() {
    stepsPage.hidden = true;
    designWorkspace.hidden = false;
    maze3D.onWindowResize(); // 隱藏期間視窗大小可能變過
}

document.getElementById('btnOpenSteps').addEventListener('click', openStepsPage);
document.getElementById('btnCloseSteps').addEventListener('click', closeStepsPage);
document.getElementById('btnStepsZoomIn').addEventListener('click', () => stepsMap.zoomIn());
document.getElementById('btnStepsZoomOut').addEventListener('click', () => stepsMap.zoomOut());
document.getElementById('btnStepsZoomFit').addEventListener('click', () => stepsMap.fitZoom());
