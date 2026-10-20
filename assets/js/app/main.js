/**
 * 頁面啟動：檢查登入狀態後載入迷宮
 * 與 assets/js/app/ 其他檔案共用同一個全域範圍，載入順序見 index.php。
 */
// 頁面初次載入：預設訪客模式，先檢查登入狀態與權限，再載入迷宮配置
updateAuthUI(null);
checkAuthStatus().then(() => {
    loadMazeConfig();
});
