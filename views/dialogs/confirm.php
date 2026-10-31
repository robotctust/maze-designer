<!-- 共用確認框：取代瀏覽器內建的 confirm()，由 showConfirm() 開啟；放在最後，確保疊在其他對話框上面 -->
<div class="auth-modal-backdrop" id="confirmModalBackdrop">
    <div class="auth-modal-card dlg-sm" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmMessage">
        <div class="dlg-head">
            <div class="dlg-titles">
                <h2 class="dlg-title" id="confirmTitle">確定嗎？</h2>
            </div>
        </div>
        <div class="dlg-body">
            <p class="confirm-message" id="confirmMessage"></p>
            <input type="text" class="dlg-input" id="confirmInput" maxlength="30" hidden>
        </div>
        <div class="dlg-foot">
            <button type="button" class="tool-btn btn-ghost" id="btnConfirmCancel">取消</button>
            <button type="button" class="tool-btn btn-save" id="btnConfirmOk">確定</button>
        </div>
    </div>
</div>
