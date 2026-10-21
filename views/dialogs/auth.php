<!-- 登入／註冊 -->
<div class="auth-modal-backdrop" id="authModalBackdrop">
    <div class="auth-modal-card dlg-sm" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <div class="dlg-head">
            <div class="dlg-titles">
                <h2 class="dlg-title" id="authTitle">登入</h2>
                <p class="dlg-sub">登入後可用到 50 × 50、存地圖、參加排位賽</p>
            </div>
            <button type="button" class="dlg-close auth-modal-close" id="btnCloseAuthModal" aria-label="關閉"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#x"></use></svg></button>
        </div>
        <div class="dlg-body">
            <div class="seg seg-full dlg-tabs" role="tablist">
                <button type="button" class="auth-tab-btn active" id="tabBtnLogin" data-target="formLogin" role="tab">登入</button>
                <button type="button" class="auth-tab-btn" id="tabBtnRegister" data-target="formRegister" role="tab">註冊</button>
            </div>

            <div class="auth-alert" id="authAlert" role="alert" style="display: none;"></div>

            <form id="formLogin" class="auth-form" onsubmit="return false;">
                <div class="field">
                    <label for="loginUsername">帳號</label>
                    <input class="dlg-input" type="text" id="loginUsername" placeholder="" required autocomplete="username">
                </div>
                <div class="field">
                    <label for="loginPassword">密碼</label>
                    <input class="dlg-input" type="password" id="loginPassword" required autocomplete="current-password">
                </div>
                <button type="submit" class="tool-btn btn-save auth-submit-btn" id="btnSubmitLogin">登入</button>
                <p class="auth-form-footer">還沒有帳號？<a href="javascript:void(0)" id="linkToRegister">註冊</a></p>
            </form>

            <form id="formRegister" class="auth-form" style="display: none;" onsubmit="return false;">
                <div class="field">
                    <label for="regUsername">帳號</label>
                    <input class="dlg-input" type="text" id="regUsername" placeholder="3～30 字，中英數字或底線" required autocomplete="username">
                </div>
                <div class="field">
                    <label for="regPassword">密碼</label>
                    <input class="dlg-input" type="password" id="regPassword" placeholder="至少 4 個字" required autocomplete="new-password">
                </div>
                <div class="field">
                    <label for="regConfirmPassword">確認密碼</label>
                    <input class="dlg-input" type="password" id="regConfirmPassword" required autocomplete="new-password">
                </div>
                <button type="submit" class="tool-btn btn-save auth-submit-btn" id="btnSubmitRegister">註冊並登入</button>
                <p class="auth-form-footer">已經有帳號？<a href="javascript:void(0)" id="linkToLogin">登入</a></p>
            </form>

            <dl class="auth-rule-box">
                <dt>訪客</dt><dd>最多 10 × 10，不能存檔</dd>
                <dt class="member">會員</dt><dd>2～50 格、雲端存 8 張、參加排位賽</dd>
            </dl>
        </div>
    </div>
</div>
