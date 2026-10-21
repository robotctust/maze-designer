#!/bin/bash
# macOS 一鍵啟動本地伺服器：可在 Finder 雙擊，或在終端機執行 ./start.command
cd "$(dirname "$0")"

# 啟動 MySQL（已在執行就略過）
mysql.server status >/dev/null 2>&1 || mysql.server start

# 伺服器就緒後自動開啟瀏覽器
(sleep 1 && open "http://localhost:8000/") &

echo "伺服器已啟動：http://localhost:8000/（按 Ctrl+C 停止）"
php -S localhost:8000
