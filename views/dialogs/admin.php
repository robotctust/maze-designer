<!-- 高級使用者專屬：帳號管理 (初級、中級帳號，高級不顯示) -->
<div class="auth-modal-backdrop" id="adminUsersModalBackdrop">
    <div class="auth-modal-card dlg-lg" role="dialog" aria-modal="true" aria-labelledby="adminUsersTitle">
        <div class="dlg-head">
            <div class="dlg-titles">
                <h2 class="dlg-title" id="adminUsersTitle">帳號管理</h2>
                <p class="dlg-sub">調整初級與中級使用者身分（高級使用者帳號已隱藏）</p>
            </div>
            <button type="button" class="dlg-close auth-modal-close" id="btnCloseAdminUsersModal" aria-label="關閉"><svg class="icon" aria-hidden="true"><use href="#x"></use></svg></button>
        </div>
        <div class="dlg-body">
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>帳號名稱</th>
                            <th>目前身分</th>
                            <th>註冊時間</th>
                            <th>最近登入</th>
                            <th>身分調整</th>
                        </tr>
                    </thead>
                    <tbody id="adminUsersTableBody">
                        <tr><td colspan="5" class="table-note">載入帳號清單中…</td></tr>
                    </tbody>
                </table>
            </div>
            <p class="dlg-note">註冊新帳號皆預設為「初級使用者」，可在此將其升等為「中級使用者」以解鎖排位賽投稿與發布功能。</p>
        </div>
        <div class="dlg-foot">
            <button type="button" class="tool-btn btn-ghost btn-sm" id="btnRefreshAdminUsers"><svg class="icon" aria-hidden="true"><use href="#refresh"></use></svg>重新整理</button>
        </div>
    </div>
</div>

<!-- 高級使用者專屬：排位賽地圖審核與管理 -->
<div class="auth-modal-backdrop" id="adminReviewModalBackdrop">
    <div class="auth-modal-card dlg-xl" role="dialog" aria-modal="true" aria-labelledby="adminReviewTitle">
        <div class="dlg-head">
            <div class="dlg-titles">
                <h2 class="dlg-title" id="adminReviewTitle">排位賽地圖審核與管理</h2>
                <p class="dlg-sub">審核中級使用者投稿之迷宮、檢視 2D 地圖與刪除官方地圖</p>
            </div>
            <button type="button" class="dlg-close auth-modal-close" id="btnCloseAdminReviewModal" aria-label="關閉"><svg class="icon" aria-hidden="true"><use href="#x"></use></svg></button>
        </div>
        <div class="dlg-body">
            <div class="seg seg-full dlg-tabs" role="tablist">
                <button type="button" class="auth-tab-btn active" id="tabAdminPending" role="tab">待審核投稿 <span class="badge" id="tabPendingCount">0</span></button>
                <button type="button" class="auth-tab-btn" id="tabAdminOfficial" role="tab">官方題庫管理（刪除地圖）</button>
            </div>

            <!-- 分頁 1：待審核投稿列表 -->
            <div id="panelAdminPending">
                <div class="admin-table-wrap" style="margin-top: 12px;">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>規格</th>
                                <th>地圖名稱</th>
                                <th>投稿者</th>
                                <th>提交時間</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="adminSubmissionsTableBody">
                            <tr><td colspan="5" class="table-note">載入中…</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 分頁 2：官方題庫管理列表 (含刪除功能) -->
            <div id="panelAdminOfficial" style="display: none; margin-top: 12px;">
                <div class="admin-table-wrap">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>級別</th>
                                <th>編號</th>
                                <th>名稱</th>
                                <th>作者</th>
                                <th>建立時間</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="adminOfficialMapsTableBody">
                            <tr><td colspan="6" class="table-note">載入中…</td></tr>
                        </tbody>
                    </table>
                </div>
                <p class="dlg-note">刪除地圖後將無法復原。每個級別至少會保留 1 張地圖以維持排位賽正常運作。</p>
            </div>
        </div>
        <div class="dlg-foot">
            <button type="button" class="tool-btn btn-ghost btn-sm" id="btnRefreshAdminReview"><svg class="icon" aria-hidden="true"><use href="#refresh"></use></svg>重新整理</button>
        </div>
    </div>
</div>

<!-- 2D 地圖檢視預覽彈窗 -->
<div class="auth-modal-backdrop" id="preview2DModalBackdrop">
    <div class="auth-modal-card dlg-md" role="dialog" aria-modal="true" aria-labelledby="preview2DTitle">
        <div class="dlg-head">
            <div class="dlg-titles">
                <h2 class="dlg-title" id="preview2DTitle">2D 地圖預覽</h2>
                <p class="dlg-sub" id="preview2DSub">規格與路徑驗證</p>
            </div>
            <button type="button" class="dlg-close auth-modal-close" id="btnClosePreview2DModal" aria-label="關閉"><svg class="icon" aria-hidden="true"><use href="#x"></use></svg></button>
        </div>
        <div class="dlg-body" style="text-align: center;">
            <div class="preview-2d-canvas-wrap">
                <canvas id="preview2DCanvas" width="400" height="400" class="preview-2d-canvas"></canvas>
            </div>
            <div class="check-list" style="margin-top: 10px; text-align: left;">
                <div class="check-row"><span class="check-key">起終點</span><span>起點 <strong style="color:var(--go);">(S) 綠標</strong> → 終點 <strong style="color:var(--danger);">(G) 紅標</strong></span></div>
                <div class="check-row"><span class="check-key">作者與時間</span><span id="preview2DMeta">-</span></div>
            </div>
        </div>
        <div class="dlg-foot">
            <button type="button" class="tool-btn btn-ghost" id="btnDismissPreview2D">關閉</button>
        </div>
    </div>
</div>
