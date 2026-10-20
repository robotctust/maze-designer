/**
 * 10x10 迷宮 2D 編輯器
 * 規格：10x10 格，每格 30x30cm，牆高 15cm
 */
class MazeEditor {
    constructor(svgElement, options = {}) {
        this.svg = svgElement;
        this.rows = 10;
        this.cols = 10;
        this.baseSize = options.baseSize || 560; // 預設設計模式為較大尺寸 560px
        this.step = this.baseSize / Math.max(this.cols, this.rows); // 格子像素大小
        this.sizeW = this.cols * this.step;
        this.sizeH = this.rows * this.step;
        this.size = this.baseSize;

        this.currentTool = 'wall'; // 'wall', 'start', 'goal'
        this.onUpdate = options.onUpdate || function() {};

        // 資料結構
        this.start = { x: 0, y: 9 };
        this.goal = { x: 9, y: 0 };
        this.hWalls = [];
        this.vWalls = [];

        // 自走車即時同步與軌跡
        this.carPos = null;
        this.trailPoints = [];

        // 2D 地圖縮放 (Zoom) 與平移拖曳 (Pan) 狀態
        this.zoomScale = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.justDragged = false;
        this.viewport = null;
        this.wrapper = null;

        this.initData();
        this.render();
    }

    setCanvasBaseSize(newBaseSize) {
        newBaseSize = parseInt(newBaseSize, 10);
        if (!newBaseSize || Math.abs(newBaseSize - this.baseSize) < 2) return;
        const scaleRatio = newBaseSize / this.baseSize;
        this.baseSize = newBaseSize;
        this.step = this.baseSize / Math.max(this.cols, this.rows);
        this.sizeW = this.cols * this.step;
        this.sizeH = this.rows * this.step;
        this.size = this.baseSize;

        // 縮放現有軌跡點
        if (this.trailPoints && this.trailPoints.length > 0) {
            this.trailPoints = this.trailPoints.map(p => ({
                x: p.x * scaleRatio,
                y: p.y * scaleRatio
            }));
        }

        this.resetZoom(false);
        this.render();
    }

    setGridSize(cols, rows) {
        cols = Math.max(2, Math.min(30, parseInt(cols, 10) || 10));
        rows = Math.max(2, Math.min(30, parseInt(rows, 10) || 10));

        this.cols = cols;
        this.rows = rows;
        this.step = this.baseSize / Math.max(this.cols, this.rows);
        this.sizeW = this.cols * this.step;
        this.sizeH = this.rows * this.step;
        this.size = this.baseSize;

        // 起點與終點位置安全限制
        this.start.x = Math.max(0, Math.min(this.cols - 1, this.start.x));
        this.start.y = Math.max(0, Math.min(this.rows - 1, this.start.y));
        this.goal.x = Math.max(0, Math.min(this.cols - 1, this.goal.x));
        this.goal.y = Math.max(0, Math.min(this.rows - 1, this.goal.y));

        // 預設起點在左下角，終點在右上角
        if (this.start.x === this.goal.x && this.start.y === this.goal.y) {
            this.start = { x: 0, y: this.rows - 1 };
            this.goal = { x: this.cols - 1, y: 0 };
        }

        this.initData();
        this.trailPoints = [];
        this.carPos = null;

        this.resetZoom(false);
        this.render();
        this.notifyUpdate();
    }

    initData() {
        this.hWalls = [];
        for (let r = 0; r <= this.rows; r++) {
            this.hWalls[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.hWalls[r][c] = (r === 0 || r === this.rows) ? 1 : 0;
            }
        }

        this.vWalls = [];
        for (let r = 0; r < this.rows; r++) {
            this.vWalls[r] = [];
            for (let c = 0; c <= this.cols; c++) {
                this.vWalls[r][c] = (c === 0 || c === this.cols) ? 1 : 0;
            }
        }
    }

    setTool(tool) {
        this.currentTool = tool;
        if (this.viewport) {
            if (tool === 'pan') {
                this.viewport.classList.add('tool-pan');
            } else {
                this.viewport.classList.remove('tool-pan');
            }
        }
    }

    getData() {
        return {
            gridSize: { rows: this.rows, cols: this.cols },
            cellSizeCm: 30,
            wallHeightCm: 15,
            widthCm: this.cols * 30,
            heightCm: this.rows * 30,
            start: { ...this.start },
            goal: { ...this.goal },
            hWalls: JSON.parse(JSON.stringify(this.hWalls)),
            vWalls: JSON.parse(JSON.stringify(this.vWalls))
        };
    }

    loadData(data) {
        if (!data) return;
        let cols = this.cols;
        let rows = this.rows;
        if (data.gridSize) {
            cols = parseInt(data.gridSize.cols, 10) || cols;
            rows = parseInt(data.gridSize.rows, 10) || rows;
        } else if (data.hWalls && Array.isArray(data.hWalls) && data.hWalls.length > 1 && Array.isArray(data.hWalls[0])) {
            rows = data.hWalls.length - 1;
            cols = data.hWalls[0].length;
        }
        this.cols = Math.max(2, Math.min(30, cols));
        this.rows = Math.max(2, Math.min(30, rows));
        this.step = this.baseSize / Math.max(this.cols, this.rows);
        this.sizeW = this.cols * this.step;
        this.sizeH = this.rows * this.step;
        this.size = this.baseSize;

        // 完整初始化資料結構，保證陣列尺寸正確且外牆完整
        this.initData();

        if (data.start) {
            this.start = {
                x: Math.max(0, Math.min(this.cols - 1, parseInt(data.start.x, 10) || 0)),
                y: Math.max(0, Math.min(this.rows - 1, parseInt(data.start.y, 10) || 0))
            };
        }
        if (data.goal) {
            this.goal = {
                x: Math.max(0, Math.min(this.cols - 1, parseInt(data.goal.x, 10) || (this.cols - 1))),
                y: Math.max(0, Math.min(this.rows - 1, parseInt(data.goal.y, 10) || 0))
            };
        }

        // 安全複製存在的牆壁數值
        if (data.hWalls && Array.isArray(data.hWalls)) {
            for (let r = 0; r <= this.rows && r < data.hWalls.length; r++) {
                if (Array.isArray(data.hWalls[r])) {
                    for (let c = 0; c < this.cols && c < data.hWalls[r].length; c++) {
                        this.hWalls[r][c] = data.hWalls[r][c] ? 1 : 0;
                    }
                }
            }
        }
        if (data.vWalls && Array.isArray(data.vWalls)) {
            for (let r = 0; r < this.rows && r < data.vWalls.length; r++) {
                if (Array.isArray(data.vWalls[r])) {
                    for (let c = 0; c <= this.cols && c < data.vWalls[r].length; c++) {
                        this.vWalls[r][c] = data.vWalls[r][c] ? 1 : 0;
                    }
                }
            }
        }

        this.trailPoints = [];
        this.carPos = null;

        this.render();
        this.notifyUpdate();
    }

    notifyUpdate() {
        this.onUpdate(this.getData());
    }

    toggleHWall(r, c) {
        if (!this.hWalls[r]) this.hWalls[r] = [];
        this.hWalls[r][c] = this.hWalls[r][c] ? 0 : 1;
        this.render();
        this.notifyUpdate();
    }

    toggleVWall(r, c) {
        if (!this.vWalls[r]) this.vWalls[r] = [];
        this.vWalls[r][c] = this.vWalls[r][c] ? 0 : 1;
        this.render();
        this.notifyUpdate();
    }

    setStartCell(x, y) {
        if (x === this.goal.x && y === this.goal.y) {
            alert('起點不能與終點重疊！');
            return;
        }
        this.start = { x, y };
        const halfW = (this.cols * 30) / 2;
        const halfH = (this.rows * 30) / 2;
        this.carPos = {
            rawX: -halfW + (x + 0.5) * 30,
            rawZ: -halfH + (y + 0.5) * 30,
            yaw: 0,
            isReset: true
        };
        this.trailPoints = [];
        this.render();
        this.notifyUpdate();
    }

    setGoalCell(x, y) {
        if (x === this.start.x && y === this.start.y) {
            alert('終點不能與起點重疊！');
            return;
        }
        this.goal = { x, y };
        this.render();
        this.notifyUpdate();
    }

    // 設定四周外牆狀態 (預設為 1: 開啟)
    setOuterWalls(state = 1) {
        const targetState = state ? 1 : 0;
        for (let c = 0; c < this.cols; c++) {
            if (this.hWalls[0]) this.hWalls[0][c] = targetState;
            if (this.hWalls[this.rows]) this.hWalls[this.rows][c] = targetState;
        }
        for (let r = 0; r < this.rows; r++) {
            if (this.vWalls[r]) {
                this.vWalls[r][0] = targetState;
                this.vWalls[r][this.cols] = targetState;
            }
        }
        this.render();
        this.notifyUpdate();
        return targetState;
    }

    // 四周圍牆切換 (若全有則全關，否則全開)
    toggleOuterWalls() {
        let allOn = true;
        for (let c = 0; c < this.cols; c++) {
            if (!this.hWalls[0] || !this.hWalls[0][c] || !this.hWalls[this.rows] || !this.hWalls[this.rows][c]) {
                allOn = false;
                break;
            }
        }
        if (allOn) {
            for (let r = 0; r < this.rows; r++) {
                if (!this.vWalls[r] || !this.vWalls[r][0] || !this.vWalls[r][this.cols]) {
                    allOn = false;
                    break;
                }
            }
        }

        const targetState = allOn ? 0 : 1;
        return this.setOuterWalls(targetState);
    }

    // 清空內牆 (保留並確保四周外牆開啟)
    clearInnerWalls() {
        for (let r = 1; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                this.hWalls[r][c] = 0;
            }
        }
        for (let r = 0; r < this.rows; r++) {
            for (let c = 1; c < this.cols; c++) {
                this.vWalls[r][c] = 0;
            }
        }
        for (let c = 0; c < this.cols; c++) {
            this.hWalls[0][c] = 1;
            this.hWalls[this.rows][c] = 1;
        }
        for (let r = 0; r < this.rows; r++) {
            this.vWalls[r][0] = 1;
            this.vWalls[r][this.cols] = 1;
        }
        this.render();
        this.notifyUpdate();
    }

    // 清除全部 (連外牆也清除)
    clearAllWalls() {
        for (let r = 0; r <= this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                this.hWalls[r][c] = 0;
            }
        }
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c <= this.cols; c++) {
                this.vWalls[r][c] = 0;
            }
        }
        this.render();
        this.notifyUpdate();
    }

    // 隨機迷宮演算法 (DFS 深度優先生成)
    generateRandomMaze() {
        // 先確保規格與維度完整
        this.initData();
        // 先建立滿牆
        for (let r = 0; r <= this.rows; r++) {
            this.hWalls[r] = this.hWalls[r] || [];
            for (let c = 0; c < this.cols; c++) {
                this.hWalls[r][c] = 1;
            }
        }
        for (let r = 0; r < this.rows; r++) {
            this.vWalls[r] = this.vWalls[r] || [];
            for (let c = 0; c <= this.cols; c++) {
                this.vWalls[r][c] = 1;
            }
        }

        const visited = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
        const stack = [];
        const startX = this.start.x;
        const startY = this.start.y;

        visited[startY][startX] = true;
        stack.push({ x: startX, y: startY });

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = [];

            // 上
            if (current.y > 0 && !visited[current.y - 1][current.x]) {
                neighbors.push({ x: current.x, y: current.y - 1, dir: 'up' });
            }
            // 下
            if (current.y < this.rows - 1 && !visited[current.y + 1][current.x]) {
                neighbors.push({ x: current.x, y: current.y + 1, dir: 'down' });
            }
            // 左
            if (current.x > 0 && !visited[current.y][current.x - 1]) {
                neighbors.push({ x: current.x - 1, y: current.y, dir: 'left' });
            }
            // 右
            if (current.x < this.cols - 1 && !visited[current.y][current.x + 1]) {
                neighbors.push({ x: current.x + 1, y: current.y, dir: 'right' });
            }

            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                // 拆牆
                if (next.dir === 'up') {
                    this.hWalls[current.y][current.x] = 0;
                } else if (next.dir === 'down') {
                    this.hWalls[current.y + 1][current.x] = 0;
                } else if (next.dir === 'left') {
                    this.vWalls[current.y][current.x] = 0;
                } else if (next.dir === 'right') {
                    this.vWalls[current.y][current.x + 1] = 0;
                }

                visited[next.y][next.x] = true;
                stack.push({ x: next.x, y: next.y });
            } else {
                stack.pop();
            }
        }

        // 確保四周外牆完整開啟 (預設為 1)
        this.setOuterWalls(1);
    }

    render() {
        this.cachedCarGroup = null;
        this.cachedTrail = null;
        this.lastX = null;
        this.lastY = null;
        this.lastRot = null;
        const svg = this.svg;
        svg.innerHTML = '';
        const step = this.step;
        const widthPx = this.sizeW;
        const heightPx = this.sizeH;

        svg.setAttribute('viewBox', `0 0 ${widthPx} ${heightPx}`);
        svg.setAttribute('width', widthPx);
        svg.setAttribute('height', heightPx);

        const wrapper = svg.closest('.grid-wrapper');
        if (wrapper) {
            this.wrapper = wrapper;
            wrapper.style.width = widthPx + 'px';
            wrapper.style.height = heightPx + 'px';
            if (this.cols === 10 && this.rows === 10) {
                wrapper.style.backgroundImage = 'url("map_10x10.jpg?v=' + Date.now() + '")';
            } else {
                wrapper.style.backgroundImage = 'none';
            }
            this.applyTransform(false);
        }

        // 若非 10x10 底圖模式，繪製 SVG 背景白色底與格線
        if (this.cols !== 10 || this.rows !== 10) {
            const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bgRect.setAttribute('x', 0);
            bgRect.setAttribute('y', 0);
            bgRect.setAttribute('width', widthPx);
            bgRect.setAttribute('height', heightPx);
            bgRect.setAttribute('fill', '#ffffff');
            svg.appendChild(bgRect);

            // 水平底格線
            for (let r = 0; r <= this.rows; r++) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', 0);
                line.setAttribute('y1', r * step);
                line.setAttribute('x2', widthPx);
                line.setAttribute('y2', r * step);
                line.setAttribute('stroke', '#cbd5e1');
                line.setAttribute('stroke-width', '1');
                svg.appendChild(line);
            }
            // 垂直底格線
            for (let c = 0; c <= this.cols; c++) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', c * step);
                line.setAttribute('y1', 0);
                line.setAttribute('x2', c * step);
                line.setAttribute('y2', heightPx);
                line.setAttribute('stroke', '#cbd5e1');
                line.setAttribute('stroke-width', '1');
                svg.appendChild(line);
            }
        }

        // 1. 格子背景與點選層 (處理 Start, Goal 設定)
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', c * step);
                rect.setAttribute('y', r * step);
                rect.setAttribute('width', step);
                rect.setAttribute('height', step);

                let cls = 'cell-overlay';
                if (c === this.start.x && r === this.start.y) {
                    cls += ' cell-start';
                } else if (c === this.goal.x && r === this.goal.y) {
                    cls += ' cell-goal';
                }
                rect.setAttribute('class', cls);

                rect.addEventListener('click', () => {
                    if (this.justDragged) return;
                    if (this.currentTool === 'start') {
                        this.setStartCell(c, r);
                    } else if (this.currentTool === 'goal') {
                        this.setGoalCell(c, r);
                    }
                });

                svg.appendChild(rect);
            }
        }

        // 2. 起點與終點圖示與文字
        const renderBadge = (pt, type) => {
            const cx = (pt.x + 0.5) * step;
            const cy = (pt.y + 0.5) * step;

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', cx);
            circle.setAttribute('cy', cy);
            circle.setAttribute('r', Math.max(12, Math.min(step * 0.35, 22)));
            circle.setAttribute('fill', type === 'S' ? '#22c55e' : '#ef4444');
            circle.setAttribute('stroke', '#ffffff');
            circle.setAttribute('stroke-width', '2');
            circle.setAttribute('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))');
            circle.style.pointerEvents = 'none';
            svg.appendChild(circle);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', cx);
            text.setAttribute('y', cy + 1);
            text.setAttribute('class', 'marker-text');
            text.setAttribute('fill', '#ffffff');
            text.textContent = type === 'S' ? '起點' : '終點';
            text.setAttribute('font-size', Math.max(10, Math.min(15, step * 0.26)) + 'px');
            svg.appendChild(text);
        };

        renderBadge(this.start, 'S');
        renderBadge(this.goal, 'G');

        // 3. 牆壁可視化繪製
        // 3-1 水平牆壁
        for (let r = 0; r <= this.rows; r++) {
            let y = r * step;
            if (r === 0) y = 3;
            else if (r === this.rows) y = heightPx - 3;

            for (let c = 0; c < this.cols; c++) {
                if (this.hWalls[r] && this.hWalls[r][c]) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', c * step);
                    line.setAttribute('y1', y);
                    line.setAttribute('x2', (c + 1) * step);
                    line.setAttribute('y2', y);
                    line.setAttribute('class', `wall-visual ${r === 0 || r === this.rows ? 'outer' : ''}`);
                    svg.appendChild(line);
                }
            }
        }

        // 3-2 垂直牆壁
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c <= this.cols; c++) {
                let x = c * step;
                if (c === 0) x = 3;
                else if (c === this.cols) x = widthPx - 3;

                if (this.vWalls[r] && this.vWalls[r][c]) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', x);
                    line.setAttribute('y1', r * step);
                    line.setAttribute('x2', x);
                    line.setAttribute('y2', (r + 1) * step);
                    line.setAttribute('class', `wall-visual ${c === 0 || c === this.cols ? 'outer' : ''}`);
                    svg.appendChild(line);
                }
            }
        }

        // 4. 點擊偵測熱區 (透明寬線條，方便滑鼠點擊)
        const hitWidth = Math.max(12, Math.min(22, step * 0.4));
        for (let r = 0; r <= this.rows; r++) {
            let yHit = r * step;
            let strokeW = hitWidth;
            if (r === 0) {
                yHit = Math.max(5, strokeW / 2);
            } else if (r === this.rows) {
                yHit = heightPx - Math.max(5, strokeW / 2);
            }

            for (let c = 0; c < this.cols; c++) {
                const hitLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                hitLine.setAttribute('x1', c * step + 2);
                hitLine.setAttribute('y1', yHit);
                hitLine.setAttribute('x2', (c + 1) * step - 2);
                hitLine.setAttribute('y2', yHit);
                hitLine.setAttribute('stroke-width', strokeW);
                hitLine.setAttribute('class', `wall-hit-line ${r === 0 || r === this.rows ? 'outer-hit' : ''}`);

                hitLine.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.justDragged) return;
                    if (this.currentTool === 'wall') {
                        this.toggleHWall(r, c);
                    }
                });

                svg.appendChild(hitLine);
            }
        }

        // 垂直熱區
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c <= this.cols; c++) {
                let xHit = c * step;
                let strokeW = hitWidth;
                if (c === 0) {
                    xHit = Math.max(5, strokeW / 2);
                } else if (c === this.cols) {
                    xHit = widthPx - Math.max(5, strokeW / 2);
                }

                const hitLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                hitLine.setAttribute('x1', xHit);
                hitLine.setAttribute('y1', r * step + 2);
                hitLine.setAttribute('x2', xHit);
                hitLine.setAttribute('y2', (r + 1) * step - 2);
                hitLine.setAttribute('stroke-width', strokeW);
                hitLine.setAttribute('class', `wall-hit-line ${c === 0 || c === this.cols ? 'outer-hit' : ''}`);

                hitLine.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.justDragged) return;
                    if (this.currentTool === 'wall') {
                        this.toggleVWall(r, c);
                    }
                });

                svg.appendChild(hitLine);
            }
        }

        // 5. 渲染 2D 自走車即時位置與軌跡 (置於最頂層)
        this.renderCarMarker();
        const halfW = (this.cols * 30) / 2;
        const halfH = (this.rows * 30) / 2;
        if (this.carPos) {
            this.updateCarPosition(this.carPos);
        } else {
            this.updateCarPosition({
                rawX: -halfW + (this.start.x + 0.5) * 30,
                rawZ: -halfH + (this.start.y + 0.5) * 30,
                yaw: 0,
                isReset: true
            });
        }
    }

    /**
     * 建立/初始化 2D 自走車標記與軌跡線 SVG 元素
     */
    renderCarMarker() {
        const svg = this.svg;

        // 1. 行駛軌跡線 (底層)
        let trail = svg.querySelector('#player2DTrail');
        if (!trail) {
            trail = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            trail.setAttribute('id', 'player2DTrail');
            trail.setAttribute('class', 'car-2d-trail');
            trail.setAttribute('fill', 'none');
            trail.setAttribute('stroke', '#38bdf8');
            trail.setAttribute('stroke-width', '2.5');
            trail.setAttribute('stroke-dasharray', '4, 3');
            trail.setAttribute('stroke-linecap', 'round');
            trail.setAttribute('stroke-linejoin', 'round');
            trail.style.pointerEvents = 'none';
            trail.style.opacity = '0.75';
            svg.appendChild(trail);
        }

        // 2. 自走車本體與朝向指示 (頂層)
        let carGroup = svg.querySelector('#player2DMarker');
        if (!carGroup) {
            carGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            carGroup.setAttribute('id', 'player2DMarker');
            carGroup.setAttribute('class', 'car-2d-marker');
            carGroup.style.pointerEvents = 'none';

            // 車頭照明燈錐光 (半透明光束)
            const beam = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            beam.setAttribute('points', '-7,-12 7,-12 18,-34 -18,-34');
            beam.setAttribute('fill', 'rgba(56, 189, 248, 0.22)');
            carGroup.appendChild(beam);

            // 4 個輪子
            const wheels = [
                { x: -11, y: -10 },
                { x: 8, y: -10 },
                { x: -11, y: 4 },
                { x: 8, y: 4 }
            ];
            wheels.forEach(w => {
                const wheel = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                wheel.setAttribute('x', w.x);
                wheel.setAttribute('y', w.y);
                wheel.setAttribute('width', 3);
                wheel.setAttribute('height', 6);
                wheel.setAttribute('rx', 1);
                wheel.setAttribute('fill', '#1e293b');
                wheel.setAttribute('stroke', '#475569');
                wheel.setAttribute('stroke-width', '0.5');
                carGroup.appendChild(wheel);
            });

            // 車體外殼 (藍色圓角矩形，長 24px，寬 16px)
            const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            body.setAttribute('x', -8);
            body.setAttribute('y', -12);
            body.setAttribute('width', 16);
            body.setAttribute('height', 24);
            body.setAttribute('rx', 4);
            body.setAttribute('fill', '#0284c7');
            body.setAttribute('stroke', '#38bdf8');
            body.setAttribute('stroke-width', '1.5');
            body.style.filter = 'drop-shadow(0 2px 5px rgba(0,0,0,0.5))';
            carGroup.appendChild(body);

            // 前擋風玻璃
            const windshield = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            windshield.setAttribute('x', -5.5);
            windshield.setAttribute('y', -8.5);
            windshield.setAttribute('width', 11);
            windshield.setAttribute('height', 4.5);
            windshield.setAttribute('rx', 1);
            windshield.setAttribute('fill', '#0f172a');
            carGroup.appendChild(windshield);

            // 車頂 LiDAR 感測器
            const lidar = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            lidar.setAttribute('cx', 0);
            lidar.setAttribute('cy', 1);
            lidar.setAttribute('r', 3);
            lidar.setAttribute('fill', '#0f172a');
            lidar.setAttribute('stroke', '#38bdf8');
            lidar.setAttribute('stroke-width', '0.8');
            carGroup.appendChild(lidar);

            const led = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            led.setAttribute('cx', 0);
            led.setAttribute('cy', 1);
            led.setAttribute('r', 1.2);
            led.setAttribute('fill', '#22c55e');
            carGroup.appendChild(led);

            // 車頭雙前燈 (黃色小圓燈)
            const hl1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            hl1.setAttribute('cx', -5);
            hl1.setAttribute('cy', -12);
            hl1.setAttribute('r', 1.5);
            hl1.setAttribute('fill', '#fef08a');
            carGroup.appendChild(hl1);

            const hl2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            hl2.setAttribute('cx', 5);
            hl2.setAttribute('cy', -12);
            hl2.setAttribute('r', 1.5);
            hl2.setAttribute('fill', '#fef08a');
            carGroup.appendChild(hl2);

            // 前方行進方向箭頭標籤
            const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            arrow.setAttribute('points', '0,-17 -3.5,-12.5 3.5,-12.5');
            arrow.setAttribute('fill', '#38bdf8');
            carGroup.appendChild(arrow);

            svg.appendChild(carGroup);
        }
    }

    /**
     * 即時更新 2D 地圖上的自走車座標與朝向 (支援 60FPS 平滑移動)
     */
    updateCarPosition(pos) {
        if (!pos) return;
        this.carPos = pos;

        const halfW = (this.cols * 30) / 2;
        const halfH = (this.rows * 30) / 2;
        const totalW = this.cols * 30;
        const totalH = this.rows * 30;

        let rawX = pos.rawX !== undefined ? pos.rawX : (pos.xCm !== undefined ? pos.xCm - halfW : 0);
        let rawZ = pos.rawZ !== undefined ? pos.rawZ : (pos.zCm !== undefined ? pos.zCm - halfH : 0);
        // 嚴格限制在 2D 地圖邊界內，禁止超出地圖
        rawX = Math.max(-halfW, Math.min(halfW, rawX));
        rawZ = Math.max(-halfH, Math.min(halfH, rawZ));
        const xPx = Math.max(0, Math.min(this.sizeW, ((rawX + halfW) / totalW) * this.sizeW));
        const yPx = Math.max(0, Math.min(this.sizeH, ((rawZ + halfH) / totalH) * this.sizeH));

        const yaw = pos.yaw !== undefined ? pos.yaw : 0;
        const rotDeg = -yaw * (180 / Math.PI);

        // 微小位移過濾 (靜止時不重複操作 DOM，提升 60FPS 流暢度)
        if (!pos.isReset && this.lastX !== null) {
            const distSq = (xPx - this.lastX) ** 2 + (yPx - this.lastY) ** 2;
            const rotDiff = Math.abs(rotDeg - this.lastRot);
            if (distSq < 0.04 && rotDiff < 0.25) {
                return;
            }
        }
        this.lastX = xPx;
        this.lastY = yPx;
        this.lastRot = rotDeg;

        if (!this.cachedCarGroup || !this.cachedTrail) {
            this.cachedCarGroup = this.svg.querySelector('#player2DMarker');
            this.cachedTrail = this.svg.querySelector('#player2DTrail');
            if (!this.cachedCarGroup || !this.cachedTrail) {
                this.renderCarMarker();
                this.cachedCarGroup = this.svg.querySelector('#player2DMarker');
                this.cachedTrail = this.svg.querySelector('#player2DTrail');
            }
        }

        const carGroup = this.cachedCarGroup;
        const trail = this.cachedTrail;

        if (carGroup) {
            carGroup.setAttribute('transform', `translate(${xPx.toFixed(2)}, ${yPx.toFixed(2)}) rotate(${rotDeg.toFixed(2)})`);
        }

        if (pos.isReset) {
            this.trailPoints = [{ x: xPx, y: yPx }];
        } else {
            if (this.trailPoints.length === 0) {
                this.trailPoints.push({ x: xPx, y: yPx });
            } else {
                const last = this.trailPoints[this.trailPoints.length - 1];
                const distSq = (xPx - last.x) ** 2 + (yPx - last.y) ** 2;
                if (distSq > 10) {
                    this.trailPoints.push({ x: xPx, y: yPx });
                    if (this.trailPoints.length > 800) {
                        this.trailPoints.shift();
                    }
                }
            }
        }

        if (trail) {
            if (this.trailPoints.length > 1) {
                trail.setAttribute('points', this.trailPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
            } else {
                trail.setAttribute('points', '');
            }
        }
    }

    /**
     * 清除行駛軌跡
     */
    clearCarTrail() {
        this.trailPoints = [];
        if (this.cachedTrail) {
            this.cachedTrail.setAttribute('points', '');
        } else {
            const trail = this.svg.querySelector('#player2DTrail');
            if (trail) {
                this.cachedTrail = trail;
                trail.setAttribute('points', '');
            }
        }
    }

    /**
     * 匯出 2D 地圖為高解析度 PNG 圖片
     */
    exportPNG(onSuccess, onError) {
        const maxExport = 1024;
        const maxDim = Math.max(this.cols, this.rows);
        const step = Math.round(maxExport / maxDim);
        const exportW = this.cols * step;
        const exportH = this.rows * step;

        const canvas = document.createElement('canvas');
        canvas.width = exportW;
        canvas.height = exportH;
        const ctx = canvas.getContext('2d');

        const drawGridCanvas = () => {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, exportW, exportH);
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 2;
            for (let r = 0; r <= this.rows; r++) {
                ctx.beginPath();
                ctx.moveTo(0, r * step);
                ctx.lineTo(exportW, r * step);
                ctx.stroke();
            }
            for (let c = 0; c <= this.cols; c++) {
                ctx.beginPath();
                ctx.moveTo(c * step, 0);
                ctx.lineTo(c * step, exportH);
                ctx.stroke();
            }
        };

        const drawMazeContent = () => {
            // 繪製水平牆面
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = Math.max(6, Math.min(14, Math.round(step * 0.14)));
            ctx.lineCap = 'round';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 6;

            for (let r = 0; r <= this.rows; r++) {
                let y = r * step;
                if (r === 0) y = 7;
                else if (r === this.rows) y = exportH - 7;

                for (let c = 0; c < this.cols; c++) {
                    if (this.hWalls[r] && this.hWalls[r][c]) {
                        ctx.beginPath();
                        ctx.moveTo(c * step, y);
                        ctx.lineTo((c + 1) * step, y);
                        ctx.stroke();
                    }
                }
            }

            // 繪製垂直牆面
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c <= this.cols; c++) {
                    let x = c * step;
                    if (c === 0) x = 7;
                    else if (c === this.cols) x = exportW - 7;

                    if (this.vWalls[r] && this.vWalls[r][c]) {
                        ctx.beginPath();
                        ctx.moveTo(x, r * step);
                        ctx.lineTo(x, (r + 1) * step);
                        ctx.stroke();
                    }
                }
            }

            // 重設陰影
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;

            // 繪製起點與終點標記
            const drawBadge = (pt, text, color) => {
                const cx = (pt.x + 0.5) * step;
                const cy = (pt.y + 0.5) * step;
                const radius = Math.min(step * 0.35, 40);

                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.max(12, Math.min(24, Math.round(step * 0.25)))}px "Microsoft JhengHei", Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, cx, cy);
            };

            drawBadge(this.start, '起點', '#22c55e');
            drawBadge(this.goal, '終點', '#ef4444');

            // 觸發下載
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            const now = new Date();
            const dateStr = now.getFullYear() +
                String(now.getMonth() + 1).padStart(2, '0') +
                String(now.getDate()).padStart(2, '0') + '_' +
                String(now.getHours()).padStart(2, '0') +
                String(now.getMinutes()).padStart(2, '0');

            link.download = `${this.cols}x${this.rows}迷宮地圖_${dateStr}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (onSuccess) onSuccess();
        };

        if (this.cols === 10 && this.rows === 10) {
            const baseImg = new Image();
            baseImg.crossOrigin = 'anonymous';
            baseImg.onload = () => {
                ctx.drawImage(baseImg, 0, 0, exportW, exportH);
                drawMazeContent();
            };
            baseImg.onerror = () => {
                drawGridCanvas();
                drawMazeContent();
            };
            baseImg.src = 'map_10x10.jpg?v=' + Date.now();
        } else {
            drawGridCanvas();
            drawMazeContent();
        }
    }

    /**
     * 匯出迷宮資料為 JSON 檔案
     */
    exportJSON(onSuccess) {
        const data = this.getData();
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const now = new Date();
        const dateStr = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0');

        link.download = `${this.cols}x${this.rows}_maze_config_${dateStr}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        if (onSuccess) onSuccess();
    }

    /**
     * 從 JSON 檔案匯入迷宮設定
     */
    importJSON(file, onSuccess, onError) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if (!json.hWalls || !json.vWalls) {
                    throw new Error('檔案格式不正確，缺少 hWalls 或 vWalls 數據');
                }
                this.loadData(json);
                if (onSuccess) onSuccess();
            } catch (err) {
                if (onError) onError('匯入失敗：' + err.message);
            }
        };
        reader.onerror = () => {
            if (onError) onError('讀取檔案發生錯誤');
        };
        reader.readAsText(file);
    }

    /**
     * 初始化 2D 地圖縮放 (Zoom) 與平移拖曳 (Pan) 互動系統
     */
    initZoomAndPan(viewportElement) {
        if (!viewportElement) return;
        this.viewport = viewportElement;
        this.wrapper = this.svg ? this.svg.closest('.grid-wrapper') : null;

        let isPointerDown = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let startPanX = 0;
        let startPanY = 0;
        let isSpacePressed = false;

        // 1. 滑鼠滾輪縮放 (以滑鼠游標所在位置為縮放中心)
        this.viewport.addEventListener('wheel', (e) => {
            e.preventDefault(); // 阻止頁面或面板滾動，專注縮放 2D 地圖
            const rect = this.viewport.getBoundingClientRect();
            // 相對於視窗中心之座標
            const mx = e.clientX - (rect.left + rect.width / 2);
            const my = e.clientY - (rect.top + rect.height / 2);

            const zoomFactor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
            const oldScale = this.zoomScale;
            let newScale = Math.max(0.35, Math.min(3.5, oldScale * zoomFactor));
            if (Math.abs(newScale - oldScale) < 0.001) return;

            const scaleRatio = newScale / oldScale;
            this.panX = mx - (mx - this.panX) * scaleRatio;
            this.panY = my - (my - this.panY) * scaleRatio;
            this.zoomScale = newScale;

            this.clampPan();
            this.applyTransform(false);
            this.updateZoomDisplay();
        }, { passive: false });

        // 2. 滑鼠拖曳平移 (按住右鍵、中鍵、空白鍵+左鍵，或當前工具為平移時拖曳)
        const onMouseDown = (e) => {
            // 右鍵 (2), 中鍵 (1), 或左鍵 (0)
            const isPanButton = (e.button === 1 || e.button === 2);
            const isPanMode = (this.currentTool === 'pan' || isSpacePressed);

            if (e.button === 0 || isPanButton) {
                isPointerDown = true;
                this.isPanning = false;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                startPanX = this.panX;
                startPanY = this.panY;

                if (isPanButton || isPanMode) {
                    this.viewport.classList.add('panning');
                }
            }
        };

        const onMouseMove = (e) => {
            if (!isPointerDown) return;
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            const dist = Math.hypot(dx, dy);

            if (dist > 4) {
                if (!this.isPanning) {
                    this.isPanning = true;
                    this.viewport.classList.add('panning');
                }
                this.panX = startPanX + dx;
                this.panY = startPanY + dy;
                this.clampPan();
                this.applyTransform(false);
            }
        };

        const onMouseUp = () => {
            if (!isPointerDown) return;
            isPointerDown = false;
            this.viewport.classList.remove('panning');

            if (this.isPanning) {
                this.justDragged = true;
                this.isPanning = false;
                setTimeout(() => {
                    this.justDragged = false;
                }, 100);
            }
        };

        this.viewport.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        // 阻止視窗上的右鍵選單以支援平穩右鍵拖曳
        this.viewport.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // 3. 鍵盤空白鍵快速切換平移游標
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                isSpacePressed = true;
                this.viewport.classList.add('tool-pan');
            }
            // 鍵盤 Ctrl + / Ctrl - 快捷縮放
            if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                this.zoomIn();
            } else if (e.ctrlKey && (e.key === '-' || e.key === '_')) {
                e.preventDefault();
                this.zoomOut();
            } else if (e.ctrlKey && e.key === '0') {
                e.preventDefault();
                this.resetZoom();
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                isSpacePressed = false;
                if (this.currentTool !== 'pan') {
                    this.viewport.classList.remove('tool-pan');
                }
            }
        });

        // 4. 觸控手勢支援 (單指平移、雙指捏合縮放)
        let initialPinchDist = 0;
        let initialPinchScale = 1.0;
        let pinchMidX = 0;
        let pinchMidY = 0;

        this.viewport.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const t = e.touches[0];
                onMouseDown({ button: 0, clientX: t.clientX, clientY: t.clientY });
            } else if (e.touches.length === 2) {
                isPointerDown = false;
                this.isPanning = false;
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                initialPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                initialPinchScale = this.zoomScale;
                const rect = this.viewport.getBoundingClientRect();
                pinchMidX = (t1.clientX + t2.clientX) / 2 - (rect.left + rect.width / 2);
                pinchMidY = (t1.clientY + t2.clientY) / 2 - (rect.top + rect.height / 2);
                e.preventDefault();
            }
        }, { passive: false });

        this.viewport.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                const t = e.touches[0];
                onMouseMove({ clientX: t.clientX, clientY: t.clientY });
                if (this.isPanning) e.preventDefault();
            } else if (e.touches.length === 2) {
                e.preventDefault();
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                if (initialPinchDist > 10) {
                    const newScale = Math.max(0.35, Math.min(3.5, initialPinchScale * (currentDist / initialPinchDist)));
                    this.setZoom(newScale, pinchMidX, pinchMidY, false);
                }
            }
        }, { passive: false });

        this.viewport.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                onMouseUp();
            }
        });

        this.applyTransform(false);
        this.updateZoomDisplay();
    }

    /**
     * 限制平移邊界，防止地圖完全被拖出視窗外
     */
    clampPan() {
        if (!this.viewport) return;
        const rect = this.viewport.getBoundingClientRect();
        const curW = this.sizeW * this.zoomScale;
        const curH = this.sizeH * this.zoomScale;
        const maxPanX = Math.max(0, (curW + rect.width) / 2 - 50);
        const maxPanY = Math.max(0, (curH + rect.height) / 2 - 50);
        this.panX = Math.max(-maxPanX, Math.min(maxPanX, this.panX));
        this.panY = Math.max(-maxPanY, Math.min(maxPanY, this.panY));
    }

    /**
     * 套用 CSS transform 變換矩陣至畫布包裝容器
     */
    applyTransform(animated = false) {
        if (!this.wrapper) {
            this.wrapper = this.svg ? this.svg.closest('.grid-wrapper') : null;
        }
        if (!this.wrapper) return;

        if (animated) {
            this.wrapper.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0, 1), width 0.35s ease, height 0.35s ease';
        } else {
            this.wrapper.style.transition = 'width 0.35s ease, height 0.35s ease';
        }

        this.wrapper.style.transform = `translate(${this.panX.toFixed(1)}px, ${this.panY.toFixed(1)}px) scale(${this.zoomScale.toFixed(3)})`;
    }

    setZoom(scale, cx = 0, cy = 0, animated = false) {
        scale = Math.max(0.35, Math.min(3.5, scale));
        if (Math.abs(scale - this.zoomScale) < 0.001) return;
        const ratio = scale / this.zoomScale;
        this.panX = cx - (cx - this.panX) * ratio;
        this.panY = cy - (cy - this.panY) * ratio;
        this.zoomScale = scale;
        this.clampPan();
        this.applyTransform(animated);
        this.updateZoomDisplay();
    }

    zoomIn() {
        const next = Math.min(3.5, Math.round((this.zoomScale + 0.2) * 10) / 10);
        this.setZoom(next, 0, 0, true);
    }

    zoomOut() {
        const next = Math.max(0.35, Math.round((this.zoomScale - 0.2) * 10) / 10);
        this.setZoom(next, 0, 0, true);
    }

    resetZoom(animated = true) {
        this.zoomScale = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.applyTransform(animated);
        this.updateZoomDisplay();
    }

    fitZoom() {
        if (!this.viewport) return;
        const rect = this.viewport.getBoundingClientRect();
        const availW = Math.max(160, rect.width - 36);
        const availH = Math.max(160, rect.height - 36);
        const fitScale = Math.min(availW / this.sizeW, availH / this.sizeH, 1.8);
        this.zoomScale = Math.max(0.35, Math.min(3.0, Math.round(fitScale * 100) / 100));
        this.panX = 0;
        this.panY = 0;
        this.applyTransform(true);
        this.updateZoomDisplay();
    }

    updateZoomDisplay() {
        const display = document.getElementById('zoomPercentDisplay');
        if (display) {
            display.textContent = Math.round(this.zoomScale * 100) + '%';
        }
    }
}
