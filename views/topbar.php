<!-- 頂部列：名稱、模式切換、排行榜、帳號 -->
<header class="topbar">
    <div class="topbar-side">
        <svg class="icon" style="width:24px;height:24px;color:var(--accent)" aria-hidden="true"><use href="assets/icons.svg#compass"></use></svg>
        <span class="brand-name">迷宮設計器</span>
    </div>
    <!-- 排位賽入口：獨立按鈕；進入後由大廳的「回到練習」離開 -->
    <button type="button" class="ranked-entry" id="btnModeRanked" title="官方地圖限時挑戰，成績登上排行榜">
        <svg class="ranked-entry-crest" aria-hidden="true"><use href="assets/icons.svg#crest-3"></use></svg>
        <span class="ranked-entry-text"><span class="ranked-entry-en">RANKED</span><span class="ranked-entry-name">排位賽</span></span>
        <svg class="icon" aria-hidden="true"><use href="assets/icons.svg#chevron-right"></use></svg>
    </button>
    <div class="topbar-side end" id="userAuthBar">
        <button type="button" class="tool-btn btn-ghost" id="btnOpenLeaderboard"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#trophy"></use></svg>排行榜</button>
        <button type="button" class="tool-btn btn-ghost" id="btnOpenAuthModal" title="登入後可用到 50 × 50、存地圖、參加排位賽"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#user"></use></svg>登入</button>
        <div class="menu-wrap">
            <button type="button" class="tool-btn btn-ghost account-trigger" id="btnAccountMenu" aria-haspopup="menu" aria-expanded="false" style="display: none;">
                <span class="avatar" id="accountAvatar"></span><span id="accountName"></span><svg class="icon" style="width:16px;height:16px" aria-hidden="true"><use href="assets/icons.svg#chevron-down"></use></svg>
            </button>
            <div class="menu menu-end-align" id="accountMenu" role="menu" hidden>
                <div class="account-head">
                    <span class="avatar lg" id="accountAvatarLg"></span>
                    <div>
                        <div class="account-name" id="accountNameLg"></div>
                        <div class="auth-status-badge" id="authBadge"></div>
                    </div>
                </div>
                <div class="menu-sep"></div>
                <button type="button" class="menu-item" id="btnMapLibrary" role="menuitem"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#folder"></use></svg>我的地圖庫<span class="menu-end" id="headerMapCountBadge">0 / 8</span></button>
                <button type="button" class="menu-item" id="btnOpenMyRankedMaps" role="menuitem" title="查看我發布的排位賽地圖規格與2D影像"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#upload"></use></svg>我發布的排位地圖<span class="menu-end" id="myRankedMapCount">—</span></button>
                <div class="menu-sep" id="adminMenuSep" style="display: none;"></div>
                <button type="button" class="menu-item" id="btnAdminUsers" role="menuitem" style="display: none;"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#users"></use></svg>帳號管理<span class="menu-end">初／中級</span></button>
                <button type="button" class="menu-item" id="btnAdminReview" role="menuitem" style="display: none;"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#shield-check"></use></svg>排位地圖審核<span class="menu-end" id="adminPendingCountBadge">0</span></button>
                <div class="menu-sep"></div>
                <button type="button" class="menu-item" id="btnLogout" role="menuitem" style="display: none;"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#logout"></use></svg>登出</button>
            </div>
        </div>
    </div>
</header>
