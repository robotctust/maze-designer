<!-- 計算步數窗口：沿用設計窗口的版面與 2D 地圖，只看不改，每格標出離終點幾步 -->
<div class="workspace steps-page" id="stepsPage" hidden>
    <div class="editbar">
        <button type="button" class="tool-btn btn-ghost" id="btnCloseSteps"><svg class="icon" aria-hidden="true"><use href="#chevron-left"></use></svg>回到設計</button>
        <span class="steps-title">計算步數</span>
        <div class="editbar-spacer"></div>
    </div>

    <div class="app-container">
        <section class="editor-panel">
            <div class="editor-body">
                <div class="map-canvas-container">
                    <div class="map-viewport" id="stepsViewport">
                        <div class="grid-wrapper">
                            <svg id="stepsSvg" class="grid-svg" viewBox="0 0 560 560"></svg>
                        </div>
                    </div>
                    <div class="zoom-float">
                        <button type="button" class="zoom-btn" id="btnStepsZoomOut" title="縮小" aria-label="縮小"><svg class="icon" aria-hidden="true"><use href="#minus"></use></svg></button>
                        <span class="zoom-btn zoom-value" id="stepsZoomDisplay">100%</span>
                        <button type="button" class="zoom-btn" id="btnStepsZoomIn" title="放大" aria-label="放大"><svg class="icon" aria-hidden="true"><use href="#plus"></use></svg></button>
                        <button type="button" class="zoom-btn" id="btnStepsZoomFit" title="適配全圖" aria-label="適配全圖"><svg class="icon" aria-hidden="true"><use href="#maximize"></use></svg></button>
                    </div>
                </div>
            </div>
        </section>

        <aside class="steps-info">
            <div class="steps-stat">
                <span class="steps-stat-label">起點到終點</span>
                <span class="steps-stat-value"><strong id="stepsStartValue">—</strong> 步</span>
            </div>
            <div class="steps-stat">
                <span class="steps-stat-label">選取的格子 <span id="stepsCellPos"></span></span>
                <span class="steps-stat-value" id="stepsCellValue">點地圖上的格子</span>
            </div>
            <p class="steps-note">步數是沿著通道、不穿牆，走到終點最少要經過的格數。</p>
        </aside>
    </div>
</div>
