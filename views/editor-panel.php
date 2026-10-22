<!-- 左側：2D 迷宮規劃編輯器 -->
<section class="editor-panel">
    <div class="editor-body">
        <!-- 2D 畫布底圖容器 -->
        <div class="map-canvas-container">
        <div class="map-viewport" id="mapViewport">
            <div class="grid-wrapper" id="gridWrapper">
                <!-- SVG 覆蓋層：負責處理格線熱區、牆壁繪製與起終點顯示 -->
                <svg id="mazeSvg" class="grid-svg" viewBox="0 0 560 560"></svg>
            </div>

        </div>
            <!-- 左上：編輯工具（懸浮在畫布上，和 3D 視窗一致） -->
            <div class="sim-overlay top-left editor-overlay" id="practiceToolRail" role="toolbar" aria-label="編輯工具">
                <div class="seg" role="group" aria-label="工具">
                    <button type="button" class="hud-pill-btn active" id="toolWall" data-tool="wall" title="牆壁：點格線新增或移除" aria-label="牆壁"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#wall"></use></svg><span class="tool-label">牆壁</span></button>
                    <button type="button" class="hud-pill-btn" id="toolStart" data-tool="start" title="起點：點格子設定" aria-label="起點"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#map-pin"></use></svg><span class="tool-label">起點</span></button>
                    <button type="button" class="hud-pill-btn" id="toolGoal" data-tool="goal" title="終點：點格子設定" aria-label="終點"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#flag"></use></svg><span class="tool-label">終點</span></button>
                    <button type="button" class="hud-pill-btn" id="toolPan" data-tool="pan" title="平移（也可按住空白鍵或右鍵拖曳）" aria-label="平移"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#arrows-move"></use></svg><span class="tool-label">平移</span></button>
                </div>
                <button type="button" class="float-btn" id="btnUndo" title="復原（Ctrl／⌘ + Z）" aria-label="復原" disabled><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#arrow-back-up"></use></svg></button>
                <button type="button" class="float-btn" id="btnRedo" title="重做（Ctrl／⌘ + Shift + Z）" aria-label="重做" disabled><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#arrow-forward-up"></use></svg></button>
            </div>

            <!-- 右上：底板外觀與快捷鍵說明 -->
            <div class="sim-overlay top-right editor-overlay">
                <button type="button" class="float-btn" id="btnToggle2dTheme" title="切換為淺色地圖底板" aria-label="切換地圖底板顏色"><svg class="icon" aria-hidden="true"><use id="icon2dTheme" href="#sun"></use></svg></button>
                <div class="menu-wrap">
                    <button type="button" class="float-btn" id="btnShortcuts" aria-haspopup="true" aria-expanded="false" title="快捷鍵說明" aria-label="快捷鍵說明"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#keyboard"></use></svg></button>
                    <div class="menu menu-end-align shortcuts-menu" id="shortcutsMenu" hidden>
                        <p class="menu-heading">2D 編輯</p>
                        <div class="kbd-row"><kbd>Ctrl／⌘</kbd><kbd>S</kbd><span>快速儲存</span></div>
                        <div class="kbd-row"><kbd>Ctrl／⌘</kbd><kbd>Z</kbd><span>復原</span></div>
                        <div class="kbd-row"><kbd>Ctrl／⌘</kbd><kbd>Shift</kbd><kbd>Z</kbd><span>重做</span></div>
                        <div class="kbd-row"><kbd>滾輪</kbd><span>縮放</span></div>
                        <div class="kbd-row"><kbd>Ctrl</kbd><kbd>+</kbd><kbd>−</kbd><span>放大／縮小</span></div>
                        <div class="kbd-row"><kbd>Ctrl</kbd><kbd>0</kbd><span>重設為 100%</span></div>
                        <div class="kbd-row"><kbd>空白鍵</kbd>或<kbd>右鍵</kbd>拖曳<span>平移</span></div>
                        <div class="menu-sep"></div>
                        <p class="menu-heading">試跑</p>
                        <div class="kbd-row"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>或方向鍵<span>操控</span></div>
                        <div class="kbd-row"><kbd>空白鍵</kbd><span>跳躍</span></div>
                        <div class="kbd-row"><kbd>拖曳</kbd><kbd>滾輪</kbd><span>旋轉／縮放 3D</span></div>
                    </div>
                </div>
            </div>

            <div class="zoom-float" id="practiceZoomBar">
                <button type="button" class="zoom-btn" id="btnZoomOut" title="縮小（滾輪或 Ctrl −）" aria-label="縮小"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#minus"></use></svg></button>
                <button type="button" class="zoom-btn zoom-value" id="zoomPercentDisplay" title="目前縮放比例">100%</button>
                <button type="button" class="zoom-btn" id="btnZoomIn" title="放大（滾輪或 Ctrl +）" aria-label="放大"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#plus"></use></svg></button>
                <button type="button" class="zoom-btn" id="btnZoomReset" title="重設為 100%" aria-label="重設為 100%"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#focus-centered"></use></svg></button>
                <button type="button" class="zoom-btn" id="btnZoomFit" title="適配全圖" aria-label="適配全圖"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#maximize"></use></svg></button>
            </div>
        </div>
    </div>

    <!-- 狀態列 -->
    <div class="editor-status-bar">
        <span id="toolTip">點格線新增或移除牆壁</span>
        <span class="status-spacer"></span>
        <span>起點 <strong id="statStart">(0, 9)</strong> → 終點 <strong id="statGoal">(9, 0)</strong></span>
        <span>牆 <strong id="statWallCount">0</strong> 段</span>
        <span id="headerTagGrid" hidden></span>
        <span id="headerTagTotal">總長寬：300×300 cm</span>
    </div>
</section>
