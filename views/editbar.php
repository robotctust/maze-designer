<!-- 練習模式編輯列：地圖名稱、地圖與檔案選單、儲存 -->
<div class="editbar" id="practiceToolsToolbar">
    <!-- 平板直向：一次只顯示一個大畫面，用這組分頁切換（寬螢幕時隱藏） -->
    <div class="seg view-switch" role="tablist" aria-label="畫面">
        <button type="button" class="hud-pill-btn active" id="btnViewDesign" role="tab" aria-selected="true">設計</button>
        <button type="button" class="hud-pill-btn" id="btnViewDrive" role="tab" aria-selected="false">試跑</button>
    </div>
    <span class="map-file-name" id="activeMapName" title="目前開啟的地圖">未命名地圖</span>
    <div class="menu-wrap">
        <button type="button" class="tool-btn btn-ghost" id="btnMapMenu" aria-haspopup="menu" aria-expanded="false">地圖<svg class="icon" style="width:16px;height:16px" aria-hidden="true"><use href="#chevron-down"></use></svg></button>
        <div class="menu" id="mapMenu" role="menu" hidden>
            <button type="button" class="menu-item" id="btnResizeMap" role="menuitem"><svg class="icon" aria-hidden="true"><use href="#ruler"></use></svg>調整地圖大小…</button>
            <div class="menu-sep"></div>
            <button type="button" class="menu-item" id="btnRandom" role="menuitem"><svg class="icon" aria-hidden="true"><use href="#arrows-shuffle"></use></svg>隨機產生迷宮</button>
            <button type="button" class="menu-item" id="btnOuterWalls" role="menuitem"><svg class="icon" aria-hidden="true"><use href="#square"></use></svg>四周圍牆開／關</button>
            <button type="button" class="menu-item" id="btnClearInner" role="menuitem"><svg class="icon" aria-hidden="true"><use href="#eraser"></use></svg>清空內牆<span class="menu-end">保留圍牆</span></button>
            <button type="button" class="menu-item" id="btnMenuToggle2dTheme" role="menuitem"><svg class="icon" aria-hidden="true"><use href="#sun"></use></svg>切換底板顏色<span class="menu-end" id="menu2dThemeStatus">深色</span></button>
            <div class="menu-sep"></div>
            <button type="button" class="menu-item danger" id="btnClearAll" role="menuitem"><svg class="icon" aria-hidden="true"><use href="#trash"></use></svg>全部清空</button>
        </div>
    </div>
    <div class="menu-wrap">
        <button type="button" class="tool-btn btn-ghost" id="btnFileMenu" aria-haspopup="menu" aria-expanded="false">檔案<svg class="icon" style="width:16px;height:16px" aria-hidden="true"><use href="#chevron-down"></use></svg></button>
        <div class="menu" id="fileMenu" role="menu" hidden>
            <button type="button" class="menu-item" id="btnNewMap" role="menuitem"><svg class="icon" aria-hidden="true"><use href="#plus"></use></svg>新增空白地圖…</button>
            <button type="button" class="menu-item" id="btnFileMapLibrary" role="menuitem"><svg class="icon" aria-hidden="true"><use href="#folder"></use></svg>開啟…</button>
            <div class="menu-sep"></div>
            <button type="button" class="menu-item" id="btnFileSave" role="menuitem"><svg class="icon" aria-hidden="true"><use href="#device-floppy"></use></svg>儲存<span class="menu-end">Ctrl+S</span></button>
            <button type="button" class="menu-item" id="btnSaveAs" role="menuitem"><svg class="icon" aria-hidden="true"><use href="#copy"></use></svg>另存新檔…</button>
            <button type="button" class="menu-item" id="btnRenameMap" role="menuitem"><svg class="icon" aria-hidden="true"><use href="#pencil"></use></svg>重新命名…</button>
            <div class="menu-sep"></div>
            <button type="button" class="menu-item" id="btnImportJSON" role="menuitem"><svg class="icon" aria-hidden="true"><use href="#file-import"></use></svg>匯入 JSON</button>
            <button type="button" class="menu-item" id="btnExportJSON" role="menuitem"><svg class="icon" aria-hidden="true"><use href="#file-code"></use></svg>匯出 JSON</button>
            <button type="button" class="menu-item" id="btnExportPNG" role="menuitem"><svg class="icon" aria-hidden="true"><use href="#photo"></use></svg>匯出 PNG 圖片</button>
        </div>
        <input type="file" id="fileInputJSON" accept=".json" style="display: none;">
    </div>
    <div class="menu-wrap">
        <button type="button" class="tool-btn btn-ghost" id="btnShareMenu" aria-haspopup="menu" aria-expanded="false"><svg class="icon" aria-hidden="true"><use href="#share"></use></svg>分享碼<svg class="icon" style="width:16px;height:16px" aria-hidden="true"><use href="#chevron-down"></use></svg></button>
        <div class="menu" id="shareMenu" role="menu" hidden>
            <button type="button" class="menu-item" id="btnOpenCreateShare" role="menuitem"><svg class="icon" aria-hidden="true"><use href="#share"></use></svg>產生分享碼<span class="menu-end" id="shareCreateRoleTag">限時 1 分</span></button>
            <button type="button" class="menu-item" id="btnOpenRedeemShare" role="menuitem"><svg class="icon" aria-hidden="true"><use href="#file-import"></use></svg>使用分享碼載入</button>
        </div>
    </div>
    <div class="editbar-spacer"></div>
    <button type="button" class="tool-btn btn-ghost" id="btnOpenSteps" title="另開頁面，查看每一格離終點幾步"><svg class="icon" aria-hidden="true"><use href="#ruler"></use></svg>計算步數</button>
    <button type="button" class="tool-btn" id="btnPublishToRanked" title="把這張迷宮發布到官方排位賽圖庫"><svg class="icon" aria-hidden="true"><use href="#upload"></use></svg>發布到排位賽</button>
    <button type="button" class="tool-btn btn-save" id="btnSave" title="存到你的雲端地圖庫（Ctrl+S）"><svg class="icon" aria-hidden="true"><use href="#device-floppy"></use></svg>儲存</button>
</div>
