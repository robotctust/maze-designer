<!-- 左側：2D 迷宮規劃編輯器 -->
<section class="editor-panel">
    <div class="editor-body">
        <nav class="tool-rail" id="practiceToolRail" aria-label="編輯工具">
            <button type="button" class="tool active" id="toolWall" data-tool="wall" title="牆壁：點格線新增或移除"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#wall"></use></svg>牆壁</button>
            <button type="button" class="tool" id="toolStart" data-tool="start" title="起點：點格子設定"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#map-pin"></use></svg>起點</button>
            <button type="button" class="tool" id="toolGoal" data-tool="goal" title="終點：點格子設定"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#flag"></use></svg>終點</button>
            <button type="button" class="tool" id="toolPan" data-tool="pan" title="平移（也可按住空白鍵或右鍵拖曳）"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#arrows-move"></use></svg>平移</button>
            <div class="tool-rail-sep"></div>
            <button type="button" class="tool" id="btnUndo" title="復原（Ctrl／⌘ + Z）" disabled><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#arrow-back-up"></use></svg>復原</button>
            <button type="button" class="tool" id="btnRedo" title="重做（Ctrl／⌘ + Shift + Z）" disabled><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#arrow-forward-up"></use></svg>重做</button>
            <div class="tool-rail-spacer"></div>
            <div class="menu-wrap">
                <button type="button" class="tool" id="btnShortcuts" aria-haspopup="true" aria-expanded="false" title="快捷鍵說明"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#keyboard"></use></svg>快捷鍵</button>
                <div class="menu menu-side" id="shortcutsMenu" hidden>
                    <p class="menu-heading">2D 編輯</p>
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
        </nav>
        <!-- 2D 畫布底圖容器 -->
        <div class="map-canvas-container">
        <div class="map-viewport" id="mapViewport">
            <div class="grid-wrapper" id="gridWrapper" style="background-image: url('assets/img/map_10x10.jpg?v=<?= filemtime(dirname(__DIR__) . "/assets/img/map_10x10.jpg") ?>');">
                <!-- SVG 覆蓋層：負責處理格線熱區、牆壁繪製與起終點顯示 -->
                <svg id="mazeSvg" class="grid-svg" viewBox="0 0 560 560"></svg>
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
