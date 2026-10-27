<!-- 儲存迷宮（新地圖或覆蓋舊地圖，最多 8 張） -->
<div class="auth-modal-backdrop" id="saveMapModalBackdrop">
    <div class="auth-modal-card dlg-sm" role="dialog" aria-modal="true" aria-labelledby="saveTitle">
        <div class="dlg-head">
            <div class="dlg-titles">
                <h2 class="dlg-title" id="saveTitle">儲存迷宮</h2>
                <p class="dlg-sub"><span id="saveCurrentSpec">10×10 格</span>・牆 <span id="saveCurrentWalls">0 段</span></p>
            </div>
            <button type="button" class="dlg-close auth-modal-close" id="btnCloseSaveMapModal" aria-label="關閉"><svg class="icon" aria-hidden="true"><use href="#x"></use></svg></button>
        </div>
        <div class="dlg-body">
            <div class="quota">
                <div class="quota-info"><span>雲端空間</span><span class="quota-count" id="saveQuotaCount">0 / 8</span></div>
                <div class="quota-progress-bar"><div class="quota-progress-fill" id="saveQuotaProgressFill" style="width: 0%;"></div></div>
            </div>
            <div class="field">
                <label for="saveMapNameInput">名稱</label>
                <input class="dlg-input" type="text" id="saveMapNameInput" placeholder="迴旋迷宮A" maxlength="30">
            </div>
            <div class="field">
                <span class="field-label">存到</span>
                <label class="save-slot-option" id="slotOptionNewWrapper">
                    <input type="radio" name="saveTargetMode" id="radioSaveNew" value="new" checked>
                    <span class="slot-option-label">存成新地圖</span>
                    <span class="slot-option-desc" id="slotNewDesc">使用新的儲存格</span>
                </label>
                <div class="map-full-warning" id="mapFullWarning" style="display: none;">已經存滿 8 張。請選一張覆蓋，或到「我的地圖庫」刪掉不要的。</div>
                <div class="save-overwrite-group" id="saveOverwriteGroup">
                    <div class="save-existing-list" id="saveExistingMapsList"></div>
                </div>
            </div>
        </div>
        <div class="dlg-foot">
            <button type="button" class="tool-btn btn-ghost" id="btnCancelSaveMap">取消</button>
            <button type="button" class="tool-btn btn-save" id="btnConfirmSaveMap"><svg class="icon" aria-hidden="true"><use href="#device-floppy"></use></svg>儲存</button>
        </div>
    </div>
</div>

<!-- 我的地圖庫 -->
<div class="auth-modal-backdrop" id="mapLibraryModalBackdrop">
    <div class="auth-modal-card dlg-md" role="dialog" aria-modal="true" aria-labelledby="libraryTitle">
        <div class="dlg-head">
            <div class="dlg-titles">
                <h2 class="dlg-title" id="libraryTitle">我的地圖庫</h2>
                <p class="dlg-sub">開啟後按「儲存」會直接存回這張地圖</p>
            </div>
            <button type="button" class="dlg-close auth-modal-close" id="btnCloseMapLibraryModal" aria-label="關閉"><svg class="icon" aria-hidden="true"><use href="#x"></use></svg></button>
        </div>
        <div class="dlg-body">
            <div class="quota">
                <div class="quota-info"><span>雲端空間</span><span class="quota-count" id="libraryQuotaCount">0 / 8</span></div>
                <div class="quota-progress-bar"><div class="quota-progress-fill" id="libraryQuotaProgressFill" style="width: 0%;"></div></div>
            </div>
            <div class="map-library-list" id="mapLibraryList"></div>
            <p class="dlg-note">每個帳號最多可存 8 張。可以複製一張來改，或在「檔案」選單新增空白地圖。</p>
        </div>
        <div class="dlg-foot">
            <button type="button" class="tool-btn btn-ghost btn-sm" id="btnRefreshMapLibrary"><svg class="icon" aria-hidden="true"><use href="#refresh"></use></svg>重新整理</button>
        </div>
    </div>
</div>

<!-- 產生分享碼 (限時 1 分鐘，限 3 人使用) -->
<div class="auth-modal-backdrop" id="createShareModalBackdrop">
    <div class="auth-modal-card dlg-sm" role="dialog" aria-modal="true" aria-labelledby="createShareTitle">
        <div class="dlg-head">
            <div class="dlg-titles">
                <h2 class="dlg-title" id="createShareTitle">產生分享碼</h2>
                <p class="dlg-sub">限時 1 分鐘・最多供 3 人載入此迷宮</p>
            </div>
            <button type="button" class="dlg-close auth-modal-close" id="btnCloseCreateShareModal" aria-label="關閉"><svg class="icon" aria-hidden="true"><use href="#x"></use></svg></button>
        </div>
        <div class="dlg-body">
            <div class="check-list">
                <div class="check-row"><span class="check-key">迷宮規格</span><span id="shareModalSpec">10 × 10</span></div>
                <div class="check-row"><span class="check-key">迷宮名稱</span><span id="shareModalName">我的迷宮</span></div>
            </div>

            <div id="shareInitialArea">
                <p class="dlg-note" style="margin-top: 12px;">點擊「產生分享碼」後將產生一組 6 位代碼並存入資料庫。限時 1 分鐘有效，最多可讓 3 個人載入。</p>
            </div>

            <div id="shareGeneratedArea" style="display: none;">
                <div class="share-code-box">
                    <span class="share-code-val" id="shareCodeDisplay">------</span>
                    <div class="share-meta-row">
                        <span id="shareUsageInfo">已使用：<strong id="shareUsedCount">0</strong> / 3 人</span>
                        <span class="share-timer-badge" id="shareTimerBadge"><svg class="icon" aria-hidden="true"><use href="#clock"></use></svg><span id="shareCountdownSeconds">60</span>s</span>
                    </div>
                    <div class="share-progress-bar">
                        <div class="share-progress-fill" id="shareProgressFill" style="width: 100%;"></div>
                    </div>
                </div>
                <p class="dlg-note" id="shareStatusNote">分享碼已儲存於資料庫，複製後請盡快傳送給朋友！</p>
            </div>

            <div class="auth-alert" id="shareAlert" role="alert" style="display: none;"></div>
        </div>
        <div class="dlg-foot">
            <button type="button" class="tool-btn btn-ghost" id="btnCancelCreateShare">關閉</button>
            <button type="button" class="tool-btn btn-save" id="btnDoGenerateShare"><svg class="icon" aria-hidden="true"><use href="#share"></use></svg>產生分享碼</button>
            <button type="button" class="tool-btn btn-save" id="btnCopyShareCode" style="display: none;"><svg class="icon" aria-hidden="true"><use href="#copy"></use></svg>複製分享碼</button>
        </div>
    </div>
</div>

<!-- 輸入分享碼載入地圖 -->
<div class="auth-modal-backdrop" id="redeemShareModalBackdrop">
    <div class="auth-modal-card dlg-sm" role="dialog" aria-modal="true" aria-labelledby="redeemShareTitle">
        <div class="dlg-head">
            <div class="dlg-titles">
                <h2 class="dlg-title" id="redeemShareTitle">載入分享地圖</h2>
                <p class="dlg-sub">輸入他人分享的 6 碼代碼，即刻載入迷宮</p>
            </div>
            <button type="button" class="dlg-close auth-modal-close" id="btnCloseRedeemShareModal" aria-label="關閉"><svg class="icon" aria-hidden="true"><use href="#x"></use></svg></button>
        </div>
        <div class="dlg-body">
            <div class="auth-alert" id="redeemAlert" role="alert" style="display: none;"></div>
            <div class="field">
                <label for="inputRedeemCode">分享代碼 (6 碼英數字)</label>
                <input class="dlg-input" type="text" id="inputRedeemCode" placeholder="例如：8K2P9N" maxlength="10" autocomplete="off" style="font-family: var(--font-mono, monospace); font-size: 20px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase;">
            </div>
            <p class="dlg-note">分享碼限時 1 分鐘且最多僅供 3 人使用，載入後會直接載入並呈現於 2D 與 3D 視圖中。</p>
        </div>
        <div class="dlg-foot">
            <button type="button" class="tool-btn btn-ghost" id="btnCancelRedeemShare">取消</button>
            <button type="button" class="tool-btn btn-save" id="btnConfirmRedeemShare"><svg class="icon" aria-hidden="true"><use href="#file-import"></use></svg>載入迷宮</button>
        </div>
    </div>
</div>
