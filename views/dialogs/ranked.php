<!-- 排行榜 -->
<div class="auth-modal-backdrop ranked-board" id="leaderboardModalBackdrop" data-tier="10x10">
    <div class="auth-modal-card dlg-lg" role="dialog" aria-modal="true" aria-labelledby="leaderboardTitle">
        <div class="dlg-head">
            <svg class="board-crest" aria-hidden="true"><use id="boardCrestUse" href="assets/icons.svg#crest-1"></use></svg>
            <div class="dlg-titles">
                <p class="board-kicker" id="boardKicker">LEADERBOARD・ELITE</p>
                <h2 class="dlg-title" id="leaderboardTitle">排行榜</h2>
                <p class="dlg-sub">每位選手在每個段位只保留最佳成績</p>
            </div>
            <button type="button" class="dlg-close auth-modal-close" id="btnCloseLeaderboardModal" aria-label="關閉"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#x"></use></svg></button>
        </div>
        <div class="dlg-body">
            <div class="board-tabs" id="leaderboardTabs" role="tablist">
                <button type="button" class="leaderboard-tab-btn active" data-size="10x10" role="tab"><svg class="board-tab-crest" aria-hidden="true"><use href="assets/icons.svg#crest-1"></use></svg><span>菁英級<small>10 × 10</small></span></button>
                <button type="button" class="leaderboard-tab-btn" data-size="15x15" role="tab"><svg class="board-tab-crest" aria-hidden="true"><use href="assets/icons.svg#crest-2"></use></svg><span>戰將級<small>15 × 15</small></span></button>
                <button type="button" class="leaderboard-tab-btn" data-size="20x20" role="tab"><svg class="board-tab-crest" aria-hidden="true"><use href="assets/icons.svg#crest-3"></use></svg><span>大師級<small>20 × 20</small></span></button>
                <button type="button" class="leaderboard-tab-btn" data-size="25x25" role="tab"><svg class="board-tab-crest" aria-hidden="true"><use href="assets/icons.svg#crest-4"></use></svg><span>宗師級<small>25 × 25</small></span></button>
                <button type="button" class="leaderboard-tab-btn" data-size="30x30" role="tab"><svg class="board-tab-crest" aria-hidden="true"><use href="assets/icons.svg#crest-5"></use></svg><span>傳奇級<small>30 × 30</small></span></button>
                <button type="button" class="leaderboard-tab-btn" data-size="apex" role="tab"><svg class="board-tab-crest" aria-hidden="true"><use href="assets/icons.svg#crest-7"></use></svg><span>巔峰賽<small>35 ~ 50</small></span></button>
                <button type="button" class="leaderboard-tab-btn" data-size="special" role="tab"><svg class="board-tab-crest" aria-hidden="true"><use href="assets/icons.svg#crest-6"></use></svg><span>特殊賽<small>長方形</small></span></button>
            </div>
            <div class="user-best-banner" id="userBestBanner"></div>
            <div class="leaderboard-table-wrap">
                <table class="leaderboard-table">
                    <thead>
                        <tr><th style="width: 64px;">名次</th><th>選手</th><th>耗時</th><th>剩餘</th><th>地圖</th><th>完賽時間</th></tr>
                    </thead>
                    <tbody id="leaderboardTableBody">
                        <tr><td colspan="6" class="table-note">載入中…</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="dlg-foot">
            <span class="dlg-note">依完賽耗時排序，顯示前 50 名</span>
            <button type="button" class="tool-btn btn-ghost btn-sm" id="btnRefreshLeaderboard"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#refresh"></use></svg>重新整理</button>
        </div>
    </div>
</div>

<!-- 排位賽地圖總覽 -->
<div class="auth-modal-backdrop" id="rankedGalleryBackdrop">
    <div class="auth-modal-card dlg-lg" role="dialog" aria-modal="true" aria-labelledby="galleryTitle">
        <div class="dlg-head">
            <div class="dlg-titles">
                <h2 class="dlg-title" id="galleryTitle">地圖總覽</h2>
                <p class="dlg-sub">官方排位圖庫的所有地圖，橘框為本場地圖</p>
            </div>
            <button type="button" class="dlg-close auth-modal-close" id="btnCloseRankedGallery" aria-label="關閉"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#x"></use></svg></button>
        </div>
        <div class="dlg-body">
            <div class="ranked-gallery" id="rankedGalleryList"></div>
        </div>
    </div>
</div>

<!-- 發布到排位賽 -->
<div class="auth-modal-backdrop" id="publishModalBackdrop">
    <div class="auth-modal-card dlg-sm" role="dialog" aria-modal="true" aria-labelledby="publishTitle">
        <div class="dlg-head">
            <div class="dlg-titles">
                <h2 class="dlg-title" id="publishTitle">發布到排位賽</h2>
                <p class="dlg-sub">發布後會加入官方圖庫，所有選手都可能抽到這張</p>
            </div>
            <button type="button" class="dlg-close auth-modal-close" id="btnClosePublishModal" aria-label="關閉"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#x"></use></svg></button>
        </div>
        <div class="dlg-body">
            <div class="check-list">
                <div class="check-row"><span class="check-key">級別</span><span id="publishModalSpec">10 × 10 菁英級</span></div>
                <div class="check-row"><span class="check-key">起點到終點</span><span id="publishModalPathCheck">走得通</span></div>
                <div class="check-row"><span class="check-key">牆壁</span><span id="publishModalStats">0 段・300 × 300 cm</span></div>
                <div class="check-row"><span class="check-key">發布者</span><span class="text-ranked" id="publishModalAuthor">-</span></div>
            </div>
            <p class="dlg-note">只接受 10、15、20、25 格的正方形地圖</p>
            <div class="field">
                <label for="publishCustomName">地圖別名（選填）</label>
                <input class="dlg-input" type="text" id="publishCustomName" placeholder="雙龍出海" maxlength="30">
            </div>
        </div>
        <div class="dlg-foot">
            <button type="button" class="tool-btn btn-ghost" id="btnCancelPublish">取消</button>
            <button type="button" class="tool-btn btn-ranked" id="btnConfirmPublish"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#upload"></use></svg>確認發布</button>
        </div>
    </div>
</div>
