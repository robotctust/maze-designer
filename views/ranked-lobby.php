<!-- 排位賽大廳（全螢幕；比賽開始後換成滿版 3D） -->
<section class="ranked-lobby" id="rankedLobby" aria-label="排位賽大廳">
    <header class="lobby-head">
        <div>
            <p class="lobby-kicker">RANKED ARENA</p>
            <h1 class="lobby-title">排位賽</h1>
        </div>
        <div class="lobby-head-actions">
            <button type="button" class="tool-btn icon-btn sfx-toggle" aria-pressed="true" title="音效：開" aria-label="音效：開"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#volume"></use></svg></button>
            <button type="button" class="tool-btn" id="btnLobbyLeaderboard"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#trophy"></use></svg>排行榜</button>
            <button type="button" class="tool-btn btn-ghost" id="btnLobbyBackPractice"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#arrow-left"></use></svg>回到練習</button>
        </div>
    </header>

    <div class="lobby-body">
        <nav class="tier-grid" aria-label="選擇段位">
            <p class="lobby-label">SELECT TIER</p>
            <button type="button" class="ranked-tier-btn active" data-size="10x10">
                <svg class="tier-crest" aria-hidden="true"><use href="assets/icons.svg#crest-1"></use></svg>
                <span class="tier-text"><span class="tier-name">菁英級</span><span class="tier-en">ELITE</span></span>
                <span class="tier-spec"><span class="tier-size">10 × 10</span><span class="tier-meta">限時 1 分鐘</span></span>
            </button>
            <button type="button" class="ranked-tier-btn" data-size="15x15">
                <svg class="tier-crest" aria-hidden="true"><use href="assets/icons.svg#crest-2"></use></svg>
                <span class="tier-text"><span class="tier-name">戰將級</span><span class="tier-en">WARLORD</span></span>
                <span class="tier-spec"><span class="tier-size">15 × 15</span><span class="tier-meta">限時 3 分鐘</span></span>
            </button>
            <button type="button" class="ranked-tier-btn" data-size="20x20">
                <svg class="tier-crest" aria-hidden="true"><use href="assets/icons.svg#crest-3"></use></svg>
                <span class="tier-text"><span class="tier-name">大師級</span><span class="tier-en">MASTER</span></span>
                <span class="tier-spec"><span class="tier-size">20 × 20</span><span class="tier-meta">限時 20 分鐘</span></span>
            </button>
            <button type="button" class="ranked-tier-btn" data-size="25x25">
                <svg class="tier-crest" aria-hidden="true"><use href="assets/icons.svg#crest-4"></use></svg>
                <span class="tier-text"><span class="tier-name">宗師級</span><span class="tier-en">GRANDMASTER</span></span>
                <span class="tier-spec"><span class="tier-size">25 × 25</span><span class="tier-meta">限時 30 分鐘</span></span>
            </button>
            <button type="button" class="ranked-tier-btn" data-size="30x30">
                <svg class="tier-crest" aria-hidden="true"><use href="assets/icons.svg#crest-5"></use></svg>
                <span class="tier-text"><span class="tier-name">傳奇級</span><span class="tier-en">LEGEND</span></span>
                <span class="tier-spec"><span class="tier-size">30 × 30</span><span class="tier-meta">限時 40 分鐘</span></span>
            </button>
            <button type="button" class="ranked-tier-btn" data-size="apex">
                <svg class="tier-crest" aria-hidden="true"><use href="assets/icons.svg#crest-7"></use></svg>
                <span class="tier-text"><span class="tier-name">巔峰賽</span><span class="tier-en">APEX</span></span>
                <span class="tier-spec"><span class="tier-size">35 ~ 50</span><span class="tier-meta">限時 60 分鐘</span></span>
            </button>
            <button type="button" class="ranked-tier-btn" data-size="special">
                <svg class="tier-crest" aria-hidden="true"><use href="assets/icons.svg#crest-6"></use></svg>
                <span class="tier-text"><span class="tier-name">特殊賽</span><span class="tier-en">SPECIAL</span></span>
                <span class="tier-spec"><span class="tier-size">長方形</span><span class="tier-meta">限時 40 分鐘</span></span>
            </button>
        </nav>

        <section class="lobby-stage" aria-label="段位資訊">
            <div class="lobby-hero">
                <div class="lobby-crest-wrap">
                    <span class="lobby-crest-ring" aria-hidden="true"></span>
                    <svg class="lobby-crest" aria-hidden="true"><use id="lobbyCrestUse" href="assets/icons.svg#crest-1"></use></svg>
                </div>
                <div class="lobby-hero-text">
                    <p class="lobby-tier-en" id="lobbyTierEn">ELITE・TIER 1</p>
                    <p class="lobby-tier-name" id="lobbyTierName">菁英級</p>
                    <p class="lobby-tier-sub" id="lobbyTierSub">10 × 10 迷宮・限時 1 分鐘</p>
                </div>
            </div>

            <div class="lobby-stats">
                <div class="lobby-stat">
                    <p class="lobby-stat-label">限時</p>
                    <p class="lobby-stat-value" id="lobbyLimitClock">01:00</p>
                </div>
                <div class="lobby-stat">
                    <p class="lobby-stat-label" id="lobbyScoreLabel">我的最佳</p>
                    <p class="lobby-stat-value lobby-best" id="lobbyBest">—</p>
                    <p class="lobby-stat-sub" id="lobbyRank">還沒有成績</p>
                </div>
                <div class="lobby-stat">
                    <p class="lobby-stat-label">全服第一</p>
                    <p class="lobby-stat-value tier-color" id="lobbyTop">—</p>
                    <p class="lobby-stat-sub" id="lobbyTopName">還沒有人完賽</p>
                </div>
            </div>

            <div class="lobby-foot">
                <div class="lobby-card">
                    <div class="lobby-card-main">
                        <p class="lobby-stat-label">本場地圖</p>
                        <div class="lobby-map-id" id="rankedMapId">—</div>
                        <div class="lobby-card-sub" id="rankedMapName">載入中…</div>
                    </div>
                    <button type="button" class="tool-btn" id="btnRepickMap" title="同級別換一張官方地圖"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#arrows-shuffle"></use></svg>換一張</button>
                    <button type="button" class="tool-btn icon-btn" id="btnOpenRankedGallery" title="地圖總覽" aria-label="地圖總覽"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#layout-grid"></use></svg></button>
                    <button type="button" class="tool-btn icon-btn" id="btnLobbyMyRankedMaps" title="我發布的排位地圖" aria-label="我發布的排位地圖"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#upload"></use></svg></button>
                </div>
                <div class="lobby-cta">
                    <button type="button" class="lobby-start" id="btnLobbyStart"><svg class="icon" style="width:22px;height:22px" aria-hidden="true"><use href="assets/icons.svg#player-play"></use></svg>開始挑戰</button>
                    <div class="lobby-stripes" aria-hidden="true"></div>
                </div>
            </div>
        </section>
    </div>

    <p class="lobby-hint">開始後鎖定車子視角・排位賽不顯示 2D 地圖・WASD 或方向鍵操控・空白鍵跳躍・每個段位只保留你的最佳成績・限時 <span id="rankedLimitText">1 分鐘</span></p>
</section>
