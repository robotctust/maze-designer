<!-- 右側：3D 即時模擬視窗 -->
<section class="simulator-panel" id="simulatorPanel">
    <div class="sim-stage">
        <!-- Three.js 渲染畫布容器 -->
        <div class="threejs-canvas-wrapper" id="canvasContainer"></div>

        <!-- 左上：視角 -->
        <div class="sim-overlay top-left">
            <div class="seg" role="group" aria-label="視角">
                <button type="button" class="hud-pill-btn active" id="btnModeOrbit" title="3D 自由俯瞰視角"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#cube"></use></svg>俯瞰</button>
                <button type="button" class="hud-pill-btn" id="btnModeDriver" title="車子第一人稱視角"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#car"></use></svg>車載</button>
            </div>
            <button type="button" class="float-btn" id="btnResetCam" title="重設視角" aria-label="重設視角"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#focus-centered"></use></svg></button>
        </div>

        <!-- 右上：外觀與計時設定、版面切換 -->
        <div class="sim-overlay top-right">
            <div class="menu-wrap">
                <button type="button" class="float-btn" id="btnSimSettings" aria-haspopup="true" aria-expanded="false" title="外觀與計時" aria-label="外觀與計時"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#adjustments"></use></svg></button>
                <div class="menu menu-end-align sim-settings keep-open" id="simSettingsMenu" hidden>
                    <p class="menu-heading">牆面外觀</p>
                    <div class="seg seg-full" role="group" aria-label="牆面外觀">
                        <button type="button" class="hud-pill-btn active" id="btnThemeWood" data-theme="wood">木板</button>
                        <button type="button" class="hud-pill-btn" id="btnThemeWhite" data-theme="white">白板</button>
                        <button type="button" class="hud-pill-btn" id="btnThemeCyber" data-theme="cyber">科幻</button>
                    </div>
                    <p class="menu-heading" id="timerModeHeading">計時方式</p>
                    <div class="seg seg-full" role="group" aria-label="計時方式" id="timerModeGroup">
                        <button type="button" class="hud-pill-btn active" id="btnTimerCountUp" title="記錄跑完全程花費的時間">完賽計時</button>
                        <button type="button" class="hud-pill-btn" id="btnTimerCountDown" title="限時內抵達終點"><span id="countdownBtnLabel">1分挑戰</span></button>
                    </div>
                    <label class="menu-heading" for="selectCountdownDuration" id="timerDurationLabel">倒數時間</label>
                    <select class="sim-timer-select" id="selectCountdownDuration">
                        <option value="1" selected>1 分鐘</option>
                        <option value="3">3 分鐘</option>
                        <option value="5">5 分鐘</option>
                        <option value="8">8 分鐘</option>
                        <option value="10">10 分鐘</option>
                        <option value="15">15 分鐘</option>
                        <option value="custom">自訂…</option>
                    </select>
                    <div class="custom-timer-group" id="customTimerGroup" style="display: none;">
                        <input type="number" id="customMinInput" class="spec-input" min="0" max="180" value="2" aria-label="分鐘（0～180）">
                        <span>分</span>
                        <input type="number" id="customSecInput" class="spec-input" min="0" max="59" value="0" aria-label="秒（0～59）">
                        <span>秒</span>
                        <button type="button" class="tool-btn btn-sm" id="btnApplyCustomTimer">套用</button>
                    </div>
                </div>
            </div>
            <button type="button" class="float-btn" id="btnToggleMapSize" title="放大 3D" aria-label="放大 3D"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#arrows-maximize"></use></svg></button>
        </div>

        <!-- 排位賽比賽中：鎖定提示與按鍵說明 -->
        <div class="ranked-live-chip"><svg class="live-crest" aria-hidden="true"><use id="liveCrestUse" href="assets/icons.svg#crest-1"></use></svg><strong id="liveTierName">菁英級</strong><span class="live-map" id="liveMapId">—</span><span class="sep"></span><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#lock"></use></svg>視角已鎖定</div>
        <div class="ranked-live-keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>或方向鍵操控<span class="sep"></span><kbd>空白鍵</kbd>跳躍</div>

        <!-- 排位賽小地圖：只顯示車子周圍，邊緣霧化 -->
        <div class="ranked-minimap" aria-hidden="true"><canvas id="rankedMinimap"></canvas></div>

        <!-- 右下：即時座標 -->
        <div class="sim-pos-hud" id="posHud">
            <span id="posCm">X: 15 cm, Y: 285 cm</span> · <span id="posCell">格 (0, 9)</span>
        </div>

        <!-- 觸控方向鍵（觸控裝置試跑時出現） -->
        <div class="touch-pad" aria-label="觸控方向鍵">
            <span></span>
            <button type="button" class="pad-btn" data-key="w" aria-label="前進"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#chevron-up"></use></svg></button>
            <span></span>
            <button type="button" class="pad-btn" data-key="a" aria-label="左轉"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#chevron-left"></use></svg></button>
            <button type="button" class="pad-btn" data-key="s" aria-label="後退"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#chevron-down"></use></svg></button>
            <button type="button" class="pad-btn" data-key="d" aria-label="右轉"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#chevron-right"></use></svg></button>
        </div>
        <button type="button" class="pad-btn touch-jump" data-key=" " aria-label="跳躍">跳</button>
    </div>

    <!-- 底部操控列 -->
    <div class="drive-bar">
        <button type="button" class="sim-btn btn-start-drive" id="btnStartDrive"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#player-play"></use></svg>試跑</button>
        <button type="button" class="sim-btn btn-stop-drive" id="btnStopDrive" disabled title="停止"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#player-stop"></use></svg>停止</button>
        <button type="button" class="sim-btn" id="btnResetCar" title="車子回到起點"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#arrow-back-up"></use></svg>回起點</button>
        <button type="button" class="sim-btn sfx-toggle sfx-live" aria-pressed="true" title="音效：開" aria-label="音效：開"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#volume"></use></svg></button>
        
        <!-- 計時器居中顯示，避免被右側懸浮功能擋住 -->
        <div class="timer-display" id="timerDisplay">
            <span class="timer-label" id="timerIcon">完賽計時</span>
            <span class="timer-digits" id="timerDigits">00:00.0</span>
            <span class="timer-bar" aria-hidden="true"><span id="timerBarFill"></span></span>
        </div>

        <span class="drive-status-tag" id="driveStatusBadge"><span class="status-dot" id="driveStatusDot"></span><span id="driveStatusText">按試跑後可用鍵盤操控</span></span>
    </div>

    <!-- 結算對話框：練習完賽／練習超時／排位完賽／排位超時 -->
    <div class="victory-modal" id="victoryModal" role="dialog" aria-labelledby="victoryTitle">
        <div class="result-badge go"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#flag"></use></svg></div>
        <h2 id="victoryTitle">抵達終點</h2>
        <p class="result-label" id="victoryTimeLabel">完賽成績</p>
        <div class="result-time go" id="victoryTimeValue">00:00.0</div>
        <p class="result-sub" id="victoryTimeSub">共 0.0 秒</p>
        <p class="result-msg" id="victoryMsg"></p>
        <div class="result-actions">
            <button type="button" class="tool-btn btn-save" id="btnVictoryRestart"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#arrow-back-up"></use></svg>再跑一次</button>
        </div>
    </div>

    <div class="victory-modal" id="timeoutModal" role="dialog" aria-labelledby="timeoutTitle">
        <div class="result-badge danger"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#clock"></use></svg></div>
        <h2 id="timeoutTitle">時間到</h2>
        <div class="result-time danger" id="timeoutTimeValue">時間用盡</div>
        <p class="result-sub" id="timeoutTimeSub">沒在時限內抵達終點</p>
        <p class="result-msg">換條路線再試試。</p>
        <div class="result-actions">
            <button type="button" class="tool-btn btn-save" id="btnTimeoutRestart"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#arrow-back-up"></use></svg>再跑一次</button>
        </div>
    </div>

    <div class="victory-modal ranked" id="rankedVictoryModal" style="display: none;" role="dialog" aria-labelledby="rankedVictoryTitle">
        <svg class="result-crest" aria-hidden="true"><use id="resultCrestUse" href="assets/icons.svg#crest-1"></use></svg>
        <span class="result-record" id="rankedRecordStamp" hidden>新紀錄！</span>
        <h2 id="rankedVictoryTitle">排位賽完賽</h2>
        <p class="result-tier" id="rankedResultTier">—</p>
        <div class="result-main">
            <div class="result-grade" title="評級：剩餘時間 ≥ 50% 為 S，≥ 25% 為 A，其餘為 B"><span id="rankedGradeLetter">S</span></div>
            <div class="result-main-text">
                <p class="result-label">完賽時間</p>
                <div class="result-time ranked" id="rankedVictoryTimeValue">00:00.0</div>
                <p class="result-sub" id="rankedVictoryTimeSub">耗時 0 秒・剩餘 0 秒</p>
            </div>
        </div>
        <div class="result-rank" id="rankedVictoryRankBadge">全服第 <strong id="rankedVictoryRankNum">1</strong> 名</div>
        <p class="result-msg" id="rankedVictoryMsg"></p>
        <div class="result-actions">
            <button type="button" class="tool-btn btn-ranked" id="btnRankedNextMatch"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#arrows-shuffle"></use></svg>換一張再戰</button>
            <button type="button" class="tool-btn" id="btnRankedViewLeaderboard"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#trophy"></use></svg>排行榜</button>
            <button type="button" class="tool-btn btn-ghost" id="btnRankedBackToPractice">回到練習</button>
        </div>
    </div>

    <div class="victory-modal" id="rankedTimeoutModal" style="display: none;" role="dialog" aria-labelledby="rankedTimeoutTitle">
        <div class="result-badge danger"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#clock"></use></svg></div>
        <h2 id="rankedTimeoutTitle">時間到</h2>
        <div class="result-time danger" id="rankedTimeoutValue">時間用盡</div>
        <p class="result-sub" id="rankedTimeoutSub">沒在時限內抵達終點</p>
        <div class="result-actions">
            <button type="button" class="tool-btn btn-ranked" id="btnRankedTimeoutRetry"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#arrow-back-up"></use></svg>重試這張</button>
            <button type="button" class="tool-btn" id="btnRankedTimeoutNewMap"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#arrows-shuffle"></use></svg>換一張</button>
            <button type="button" class="tool-btn" id="btnRankedTimeoutLeaderboard"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#trophy"></use></svg>排行榜</button>
            <button type="button" class="tool-btn btn-ghost" id="btnRankedTimeoutBackPractice">回到練習</button>
        </div>
    </div>
</section>
