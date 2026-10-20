/**
 * 3D 迷宮模擬器 (高效能流暢版)
 * 1:1 公分精準建模：
 * - 格子尺寸：30cm x 30cm
 * - 牆壁高度：15cm
 * - 牆壁厚度：1.2cm
 * 
 * 流暢性優化：
 * 1. 空間網格分割 (Spatial Grid Partitioning)：碰撞檢測由 O(N) 降至 O(1)，25x25 規格 1300 道牆毫不掉幀
 * 2. 高精度時鐘與動態步長 (THREE.Clock)：徹底解除 60Hz 限制，適配 120Hz/144Hz 螢幕，絲滑順暢
 * 3. 仿真遙控車物理 (平滑加減速、轉向內插、滑動碰撞)：行駛滑順自然，不再有僵硬急停感
 * 4. 車輪滾動與前輪轉向即時動態模擬
 * 5. 共享幾何體與記憶體回收 (Shared Geometry & Dispose)：記憶體消耗大幅降低，杜絕 GC 卡頓
 */
class Maze3D {
    constructor(canvasContainer, options = {}) {
        this.container = canvasContainer;
        this.onGoalReached = options.onGoalReached || function() {};
        this.onPositionUpdate = options.onPositionUpdate || function() {};
        this.onDrivingChange = options.onDrivingChange || function() {};

        this.isDriving = false; // 鍵盤操控狀態

        this.rows = 10;
        this.cols = 10;
        this.cellSize = 30; // 30cm
        this.wallHeight = 15; // 15cm
        this.wallThick = 1.2; // 1.2cm
        this.widthSize = this.cols * this.cellSize;
        this.heightSize = this.rows * this.cellSize;
        this.totalSize = 300;

        this.currentMode = 'orbit'; // 'orbit' or 'driver'
        this.currentTheme = 'wood'; // 'wood', 'white', 'cyber'

        // 玩家/車輛狀態
        this.player = {
            x: 0,
            y: 8, // 眼睛/車輛高度 (8cm，置身於 15cm 牆內)
            z: 0,
            yaw: 0, // 朝向角度 (弧度)
            radius: 7 // 碰撞半徑 (7cm)
        };

        // 平滑運動物理參數
        this.speed = 0; // 目前即時速度 (cm/s)
        this.targetSpeed = 0; // 目標速度
        this.maxForwardSpeed = 58; // 前進極速 58 cm/s (靈活順暢)
        this.maxReverseSpeed = 34; // 後退極速 34 cm/s
        this.accelRate = 220; // 加速度 (cm/s²)
        this.decelRate = 320; // 煞車/阻尼 (cm/s²)
        this.turnRate = 2.8; // 轉向角速度 (rad/s)
        this.steerAngle = 0; // 前輪視覺轉向角 (rad)
        this.wheelRoll = 0; // 輪子滾動弧度

        this.clock = new THREE.Clock();
        this.keys = {};
        this.mazeData = null;
        this.wallMeshes = [];
        this.arenaColor = null; // 排位賽段位色（例如 '#FF6B57'）；null 為一般外觀
        this.goalBeamMat = null;
        this.sharedHGeo = null;
        this.sharedVGeo = null;

        // 空間網格碰撞分割系統 (Spatial Grid)
        this.spatialGrid = new Map();
        this.wheels = null;

        this.initThree();
        this.setupEventListeners();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    initThree() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        // 場景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0f1d);
        this.scene.fog = new THREE.FogExp2(0x0a0f1d, 0.002);

        // 相機
        this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 2500);
        this.resetOrbitCamera();

        // 渲染器 (開啟高能效與抗鋸齒)
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
            precision: "highp"
        });
        this.renderer.setSize(width, height);
        // 效能：高解析螢幕最多 1.5 倍像素，一般陰影即可
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // 軌道控制器 (俯瞰模式)
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.orbitControls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.orbitControls.enableDamping = true;
            this.orbitControls.dampingFactor = 0.08;
            this.orbitControls.maxPolarAngle = Math.PI / 2 - 0.02; // 不低於地面
            this.orbitControls.minDistance = 40;
            this.orbitControls.maxDistance = 1600;
        }

        // 光源
        this.setupLights();

        // 地面 (底圖)
        this.createFloor();

        // 視窗縮放處理
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupLights() {
        // 環境光
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(this.ambientLight);

        // 主平行日照光
        this.sunLight = new THREE.DirectionalLight(0xffffff, 0.75);
        this.sunLight.position.set(140, 260, 160);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 1024;
        this.sunLight.shadow.mapSize.height = 1024;
        this.sunLight.shadow.bias = -0.0004;
        this.sunLight.shadow.camera.near = 10;
        this.sunLight.shadow.camera.far = 1000;
        const d = 200;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.scene.add(this.sunLight);

        // 車輛探照燈 (第一人稱用)
        this.headlight = new THREE.SpotLight(0xfffaed, 0, 160, Math.PI / 3.2, 0.35, 1);
        this.headlight.position.set(0, 8, 0);
        this.scene.add(this.headlight);
        this.headlightTarget = new THREE.Object3D();
        this.scene.add(this.headlightTarget);
        this.headlight.target = this.headlightTarget;
    }

    createFloor() {
        // 載入底圖作為地面貼圖
        const textureLoader = new THREE.TextureLoader();
        this.mapTexture10x10 = textureLoader.load('map_10x10.jpg?v=' + Date.now(), (tex) => {
            tex.generateMipmaps = true;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            this.renderer.render(this.scene, this.camera);
        });

        // 地板
        const floorGeo = new THREE.PlaneGeometry(this.widthSize, this.heightSize);
        const floorMat = new THREE.MeshStandardMaterial({
            map: this.mapTexture10x10,
            roughness: 0.8,
            metalness: 0.08
        });

        this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
        this.floorMesh.rotation.x = -Math.PI / 2;
        this.floorMesh.receiveShadow = true;
        this.scene.add(this.floorMesh);

        // 地面外圈保護台
        const baseGeo = new THREE.BoxGeometry(this.widthSize + 8, 2, this.heightSize + 8);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
        this.baseMesh = new THREE.Mesh(baseGeo, baseMat);
        this.baseMesh.position.y = -1.5; // 頂面低於地板 0.5，避免與地板重疊閃爍
        this.baseMesh.receiveShadow = true;
        this.scene.add(this.baseMesh);
    }

    updateFloor(wSize, hSize, cols, rows) {
        if (!this.floorMesh || !this.baseMesh) return;

        if (this.floorMesh.geometry) this.floorMesh.geometry.dispose();
        this.floorMesh.geometry = new THREE.PlaneGeometry(wSize, hSize);

        if (cols === 10 && rows === 10 && this.mapTexture10x10) {
            this.floorMesh.material.map = this.mapTexture10x10;
        } else {
            this.floorMesh.material.map = this.createDynamicFloorTexture(cols, rows);
        }
        this.floorMesh.material.needsUpdate = true;

        if (this.baseMesh.geometry) this.baseMesh.geometry.dispose();
        this.baseMesh.geometry = new THREE.BoxGeometry(wSize + 8, 2, hSize + 8);

        // 調整主光源陰影範圍以完全覆蓋新尺寸
        const maxDim = Math.max(wSize, hSize);
        const d = maxDim / 2 + 40;
        if (this.sunLight && this.sunLight.shadow) {
            this.sunLight.shadow.camera.left = -d;
            this.sunLight.shadow.camera.right = d;
            this.sunLight.shadow.camera.top = d;
            this.sunLight.shadow.camera.bottom = -d;
            this.sunLight.shadow.camera.updateProjectionMatrix();
        }
    }

    createDynamicFloorTexture(cols, rows) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1024, 1024);

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3;

        const stepX = 1024 / cols;
        const stepY = 1024 / rows;

        for (let r = 0; r <= rows; r++) {
            ctx.beginPath();
            ctx.moveTo(0, r * stepY);
            ctx.lineTo(1024, r * stepY);
            ctx.stroke();
        }
        for (let c = 0; c <= cols; c++) {
            ctx.beginPath();
            ctx.moveTo(c * stepX, 0);
            ctx.lineTo(c * stepX, 1024);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        return texture;
    }

    getWallMaterial() {
        if (this.currentTheme === 'white') {
            return new THREE.MeshStandardMaterial({
                color: 0xf1f5f9,
                roughness: 0.4,
                metalness: 0.1
            });
        } else if (this.currentTheme === 'cyber') {
            return new THREE.MeshStandardMaterial({
                color: 0x1e293b,
                emissive: 0x0284c7,
                emissiveIntensity: 0.25,
                roughness: 0.2,
                metalness: 0.8
            });
        } else {
            // wood (預設賽事隔板)
            return new THREE.MeshStandardMaterial({
                color: 0xd99b5a,
                roughness: 0.7,
                metalness: 0.05
            });
        }
    }

    setTheme(theme) {
        this.currentTheme = theme;
        if (this.mazeData) {
            this.buildMaze3D(this.mazeData);
        }
    }

    resetOrbitCamera() {
        const maxDim = Math.max(this.widthSize || 300, this.heightSize || 300);
        const camDist = maxDim * 0.82;
        if (this.orbitControls) {
            this.orbitControls.maxDistance = Math.max(1600, maxDim * 2);
        }
        this.camera.position.set(0, camDist, camDist);
        this.camera.lookAt(0, 0, 0);
        if (this.orbitControls) {
            this.orbitControls.target.set(0, 0, 0);
            this.orbitControls.update();
        }
    }

    startDriving(autoResetToStart = true) {
        if (autoResetToStart) {
            this.placePlayerAtStart();
        }
        this.isDriving = true;
        this.speed = 0;
        this.steerAngle = 0;
        this.wheelRoll = 0;
        this.keys = {};
        this.clock.start();
        this.onDrivingChange(true);
    }

    stopDriving() {
        this.isDriving = false;
        this.speed = 0;
        this.steerAngle = 0;
        this.keys = {};
        this.onDrivingChange(false);
    }

    toggleDriving() {
        if (this.isDriving) {
            this.stopDriving();
        } else {
            this.startDriving();
        }
    }

    setMode(mode) {
        this.currentMode = mode;
        // 車載視角用較廣的視野，看得到兩側牆面；俯瞰維持 45 度
        this.camera.fov = mode === 'driver' ? 65 : 45;
        this.camera.updateProjectionMatrix();
        if (mode === 'driver') {
            if (this.orbitControls) this.orbitControls.enabled = false;
            this.updateDriverCamera();
            this.headlight.intensity = 1.3;
        } else {
            if (this.orbitControls) this.orbitControls.enabled = true;
            this.resetOrbitCamera();
            this.headlight.intensity = 0;
        }
    }

    placePlayerAtStart() {
        if (!this.mazeData) return;
        const sx = this.mazeData.start.x;
        const sy = this.mazeData.start.y;
        const halfW = (this.cols * this.cellSize) / 2;
        const halfH = (this.rows * this.cellSize) / 2;
        this.player.x = -halfW + (sx + 0.5) * this.cellSize;
        this.player.z = -halfH + (sy + 0.5) * this.cellSize;
        this.player.yaw = 0;
        this.speed = 0;
        this.steerAngle = 0;
        this.wheelRoll = 0;

        if (this.robotModel) {
            this.robotModel.position.set(this.player.x, 0, this.player.z);
            this.robotModel.rotation.y = this.player.yaw;
            if (this.wheels) {
                if (this.wheels.flPivot) this.wheels.flPivot.rotation.y = 0;
                if (this.wheels.frPivot) this.wheels.frPivot.rotation.y = 0;
                if (this.wheels.w1) this.wheels.w1.rotation.x = 0;
                if (this.wheels.w2) this.wheels.w2.rotation.x = 0;
                if (this.wheels.w3) this.wheels.w3.rotation.x = 0;
                if (this.wheels.w4) this.wheels.w4.rotation.x = 0;
            }
        }

        if (this.currentMode === 'driver') {
            this.updateDriverCamera();
        }

        this.onPositionUpdate({
            xCm: Math.round(this.player.x + halfW),
            zCm: Math.round(this.player.z + halfH),
            cellX: sx,
            cellY: sy,
            rawX: this.player.x,
            rawZ: this.player.z,
            yaw: this.player.yaw,
            isReset: true
        });
    }

    getSpatialKey(c, r) {
        return (r * this.cols) + c;
    }

    addBoxToSpatialGrid(box) {
        const halfW = this.widthSize / 2;
        const halfH = this.heightSize / 2;
        const minC = Math.max(0, Math.min(this.cols - 1, Math.floor((box.minX + halfW) / this.cellSize)));
        const maxC = Math.max(0, Math.min(this.cols - 1, Math.floor((box.maxX + halfW) / this.cellSize)));
        const minR = Math.max(0, Math.min(this.rows - 1, Math.floor((box.minZ + halfH) / this.cellSize)));
        const maxR = Math.max(0, Math.min(this.rows - 1, Math.floor((box.maxZ + halfH) / this.cellSize)));

        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                const key = this.getSpatialKey(c, r);
                let list = this.spatialGrid.get(key);
                if (!list) {
                    list = [];
                    this.spatialGrid.set(key, list);
                }
                list.push(box);
            }
        }
    }

    // 將資料同步為 3D 實體牆壁與標記 (高效率共享幾何體版)
    buildMaze3D(mazeData) {
        this.mazeData = mazeData;

        // 更新規格 (格數與公分總長寬)
        if (mazeData.gridSize) {
            this.cols = mazeData.gridSize.cols || this.cols;
            this.rows = mazeData.gridSize.rows || this.rows;
        } else if (mazeData.hWalls) {
            this.rows = mazeData.hWalls.length - 1;
            this.cols = mazeData.hWalls[0].length;
        }

        this.widthSize = this.cols * this.cellSize;
        this.heightSize = this.rows * this.cellSize;
        const halfW = this.widthSize / 2;
        const halfH = this.heightSize / 2;

        this.updateFloor(this.widthSize, this.heightSize, this.cols, this.rows);

        // 徹底清除舊牆壁並釋放記憶體
        this.wallMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.material.dispose();
            if (mesh.userData.ownGeo) mesh.geometry.dispose();
        });
        this.wallMeshes = [];
        this.spatialGrid.clear();

        if (this.sharedHGeo) this.sharedHGeo.dispose();
        if (this.sharedVGeo) this.sharedVGeo.dispose();

        // 清除舊起終點標記
        if (this.startMarker) this.scene.remove(this.startMarker);
        if (this.goalMarker) this.scene.remove(this.goalMarker);
        if (this.robotModel) this.scene.remove(this.robotModel);

        this.applyArenaLighting();

        const wallMat = this.getWallMaterial();
        if (this.arenaColor) {
            wallMat.emissive = new THREE.Color(this.arenaColor);
            wallMat.emissiveIntensity = 0.08;
        }
        const h = this.wallHeight; // 15cm
        const t = this.wallThick; // 1.2cm
        const cSize = this.cellSize; // 30cm

        // 共享幾何體：避免為 1300 道牆重複創建 1300 個 Geometry 物件
        this.sharedHGeo = new THREE.BoxGeometry(cSize + t, h, t);
        this.sharedVGeo = new THREE.BoxGeometry(t, h, cSize + t);

        // 牆面座標先收集，最後用 InstancedMesh 一次畫完（上千道牆只需 2 次繪製）
        const hPos = [];
        const vPos = [];

        // 1. 水平牆面
        for (let r = 0; r <= this.rows; r++) {
            const zPos = -halfH + r * cSize;
            for (let c = 0; c < this.cols; c++) {
                if (mazeData.hWalls && mazeData.hWalls[r] && mazeData.hWalls[r][c]) {
                    const xPos = -halfW + (c + 0.5) * cSize;
                    hPos.push(xPos, zPos);

                    // 記錄碰撞箱並加入空間分割網格
                    const box = {
                        minX: xPos - (cSize + t) / 2,
                        maxX: xPos + (cSize + t) / 2,
                        minZ: zPos - t / 2,
                        maxZ: zPos + t / 2
                    };
                    this.addBoxToSpatialGrid(box);
                }
            }
        }

        // 2. 垂直牆面
        for (let r = 0; r < this.rows; r++) {
            const zPos = -halfH + (r + 0.5) * cSize;
            for (let c = 0; c <= this.cols; c++) {
                if (mazeData.vWalls && mazeData.vWalls[r] && mazeData.vWalls[r][c]) {
                    const xPos = -halfW + c * cSize;
                    vPos.push(xPos, zPos);

                    const box = {
                        minX: xPos - t / 2,
                        maxX: xPos + t / 2,
                        minZ: zPos - (cSize + t) / 2,
                        maxZ: zPos + (cSize + t) / 2
                    };
                    this.addBoxToSpatialGrid(box);
                }
            }
        }

        [[this.sharedHGeo, hPos], [this.sharedVGeo, vPos]].forEach(([geo, pos]) => {
            const count = pos.length / 2;
            if (count === 0) return;
            const mesh = new THREE.InstancedMesh(geo, wallMat.clone(), count);
            const m = new THREE.Matrix4();
            for (let i = 0; i < count; i++) {
                m.makeTranslation(pos[i * 2], h / 2, pos[i * 2 + 1]);
                mesh.setMatrixAt(i, m);
            }
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            this.wallMeshes.push(mesh);

            if (this.arenaColor) {
                // 排位賽：牆頂加一道段位色發光邊線
                const capGeo = geo === this.sharedHGeo
                    ? new THREE.BoxGeometry(cSize + t, 1.2, t + 0.6)
                    : new THREE.BoxGeometry(t + 0.6, 1.2, cSize + t);
                const cap = new THREE.InstancedMesh(capGeo, new THREE.MeshBasicMaterial({ color: this.arenaColor }), count);
                for (let i = 0; i < count; i++) {
                    m.makeTranslation(pos[i * 2], h + 0.6, pos[i * 2 + 1]);
                    cap.setMatrixAt(i, m);
                }
                cap.userData.ownGeo = true;
                this.scene.add(cap);
                this.wallMeshes.push(cap);
            }
        });
        wallMat.dispose();

        // 3. 起點標記與自走車模型
        this.createStartMarker(mazeData.start);

        // 4. 終點標記 (紅色高光立柱與旗號)
        this.createGoalMarker(mazeData.goal);

        // 重設玩家位置至起點
        if (!this.isDriving) {
            this.placePlayerAtStart();
        }
    }

    // 排位賽：環境光與背景帶一點段位色；一般模式恢復原色
    applyArenaLighting() {
        const base = new THREE.Color(0x0a0f1d);
        const ambient = new THREE.Color(0xffffff);
        if (this.arenaColor) {
            base.lerp(new THREE.Color(this.arenaColor), 0.12);
            ambient.lerp(new THREE.Color(this.arenaColor), 0.25);
        }
        this.scene.background = base;
        this.scene.fog.color.copy(base);
        this.ambientLight.color.copy(ambient);
    }

    createStartMarker(pt) {
        const halfW = (this.cols * this.cellSize) / 2;
        const halfH = (this.rows * this.cellSize) / 2;
        const xPos = -halfW + (pt.x + 0.5) * this.cellSize;
        const zPos = -halfH + (pt.y + 0.5) * this.cellSize;

        // 綠色起點固定底盤
        const padGroup = new THREE.Group();
        padGroup.position.set(xPos, 0, zPos);
        const padGeo = new THREE.CylinderGeometry(10, 10, 0.6, 24);
        const padMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.35 });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.y = 0.3;
        pad.receiveShadow = true;
        padGroup.add(pad);
        this.startMarker = padGroup;
        this.scene.add(padGroup);

        // 自走車造型 (獨立移動模型)
        const carGroup = new THREE.Group();
        carGroup.position.set(this.player.x, 0, this.player.z);
        carGroup.rotation.y = this.player.yaw;

        const bodyGeo = new THREE.BoxGeometry(10, 4, 14);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.4, roughness: 0.3 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 3.5;
        body.castShadow = true;
        carGroup.add(body);

        // 車頂感測器 (LiDAR 圓柱)
        const lidarGeo = new THREE.CylinderGeometry(2, 2, 2.5, 16);
        const lidarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
        const lidar = new THREE.Mesh(lidarGeo, lidarMat);
        lidar.position.y = 6.75;
        carGroup.add(lidar);

        // 輪子幾何體
        const wheelGeo = new THREE.CylinderGeometry(2, 2, 1.2, 16);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });

        // 前左輪 (具備轉向 Pivot + 滾動)
        const flPivot = new THREE.Group();
        flPivot.position.set(-5.6, 2, 4);
        const w1 = new THREE.Mesh(wheelGeo, wheelMat);
        w1.rotation.z = Math.PI / 2;
        flPivot.add(w1);
        carGroup.add(flPivot);

        // 前右輪 (具備轉向 Pivot + 滾動)
        const frPivot = new THREE.Group();
        frPivot.position.set(5.6, 2, 4);
        const w2 = new THREE.Mesh(wheelGeo, wheelMat);
        w2.rotation.z = Math.PI / 2;
        frPivot.add(w2);
        carGroup.add(frPivot);

        // 後左輪
        const w3 = new THREE.Mesh(wheelGeo, wheelMat);
        w3.rotation.z = Math.PI / 2;
        w3.position.set(-5.6, 2, -4);
        carGroup.add(w3);

        // 後右輪
        const w4 = new THREE.Mesh(wheelGeo, wheelMat);
        w4.rotation.z = Math.PI / 2;
        w4.position.set(5.6, 2, -4);
        carGroup.add(w4);

        this.wheels = { flPivot, frPivot, w1, w2, w3, w4 };
        this.robotModel = carGroup;
        this.scene.add(carGroup);
    }

    createGoalMarker(pt) {
        const halfW = (this.cols * this.cellSize) / 2;
        const halfH = (this.rows * this.cellSize) / 2;
        const xPos = -halfW + (pt.x + 0.5) * this.cellSize;
        const zPos = -halfH + (pt.y + 0.5) * this.cellSize;

        const group = new THREE.Group();
        group.position.set(xPos, 0, zPos);

        // 紅色終點基座
        const padGeo = new THREE.CylinderGeometry(10, 10, 0.6, 24);
        const padMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.y = 0.3;
        pad.receiveShadow = true;
        group.add(pad);

        // 發光立柱 (高 25cm，略高於 15cm 牆壁以便遠處看見)
        const poleGeo = new THREE.CylinderGeometry(0.8, 0.8, 24, 16);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 12;
        pole.castShadow = true;
        group.add(pole);

        // 紅色終點旗幟
        const flagGeo = new THREE.BoxGeometry(0.2, 7, 10);
        const flagMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.4 });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(0, 20.5, 5);
        flag.castShadow = true;
        group.add(flag);

        this.goalBeamMat = null;
        if (this.arenaColor) {
            // 排位賽：終點上方一道段位色光柱，車子視角遠遠就看得到
            const beamOpts = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide };
            this.goalBeamMat = new THREE.MeshBasicMaterial({ ...beamOpts, color: this.arenaColor, opacity: 0.28 });
            const beam = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 260, 24, 1, true), this.goalBeamMat);
            beam.position.y = 130;
            group.add(beam);

            const core = new THREE.Mesh(
                new THREE.CylinderGeometry(1.2, 1.2, 260, 12, 1, true),
                new THREE.MeshBasicMaterial({ ...beamOpts, color: 0xffffff, opacity: 0.5 })
            );
            core.position.y = 130;
            group.add(core);

            const glow = new THREE.PointLight(this.arenaColor, 1.6, 120);
            glow.position.y = 20;
            group.add(glow);
        }

        this.goalMarker = group;
        this.scene.add(group);
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (this.isDriving) {
                if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
                    e.preventDefault();
                }
            }
            this.keys[k] = true;
        }, { passive: false });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        }, { passive: true });
    }

    // 高效空間網格碰撞檢查 O(1)：僅檢查自走車當前格與鄰近格牆面
    checkCollision(x, z) {
        const r = this.player.radius;
        const halfW = this.widthSize / 2;
        const halfH = this.heightSize / 2;

        // 地圖不可穿越之硬性外圍邊界
        if (x - r < -halfW || x + r > halfW || z - r < -halfH || z + r > halfH) {
            return true;
        }

        const curC = Math.floor((x + halfW) / this.cellSize);
        const curR = Math.floor((z + halfH) / this.cellSize);

        const minC = Math.max(0, curC - 1);
        const maxC = Math.min(this.cols - 1, curC + 1);
        const minR = Math.max(0, curR - 1);
        const maxR = Math.min(this.rows - 1, curR + 1);

        const checkedBoxes = new Set();
        const rSq = r * r;

        for (let row = minR; row <= maxR; row++) {
            for (let col = minC; col <= maxC; col++) {
                const list = this.spatialGrid.get(this.getSpatialKey(col, row));
                if (!list) continue;

                for (let i = 0; i < list.length; i++) {
                    const b = list[i];
                    if (checkedBoxes.has(b)) continue;
                    checkedBoxes.add(b);

                    const closestX = Math.max(b.minX, Math.min(x, b.maxX));
                    const closestZ = Math.max(b.minZ, Math.min(z, b.maxZ));
                    const dx = x - closestX;
                    const dz = z - closestZ;

                    if (dx * dx + dz * dz < rSq) {
                        return true; // 發生碰撞
                    }
                }
            }
        }

        return false;
    }

    updatePlayerMovement(dt) {
        if (!this.isDriving) return;

        // 1. 旋轉轉向 (A/D or 左右箭頭)
        let steerDir = 0;
        if (this.keys['a'] || this.keys['arrowleft']) steerDir += 1;
        if (this.keys['d'] || this.keys['arrowright']) steerDir -= 1;

        // 轉向角度累加
        this.player.yaw += steerDir * this.turnRate * dt;

        // 前輪視覺轉向內插 (-24deg ~ +24deg)
        const targetSteerAngle = steerDir * 0.42;
        this.steerAngle += (targetSteerAngle - this.steerAngle) * Math.min(1, 15 * dt);

        // 2. 加速與煞車物理 (W/S or 上下箭頭)
        let throttle = 0;
        if (this.keys['w'] || this.keys['arrowup']) throttle += 1;
        if (this.keys['s'] || this.keys['arrowdown']) throttle -= 1;

        let targetSpeed = 0;
        if (throttle > 0) {
            targetSpeed = this.maxForwardSpeed;
        } else if (throttle < 0) {
            targetSpeed = -this.maxReverseSpeed;
        }

        const rate = throttle !== 0 ? this.accelRate : this.decelRate;
        if (this.speed < targetSpeed) {
            this.speed = Math.min(targetSpeed, this.speed + rate * dt);
        } else if (this.speed > targetSpeed) {
            this.speed = Math.max(targetSpeed, this.speed - rate * dt);
        }

        // 3. 位移與牆壁平滑滑動計算
        if (Math.abs(this.speed) > 0.1) {
            const step = this.speed * dt;
            const dx = -Math.sin(this.player.yaw) * step;
            const dz = -Math.cos(this.player.yaw) * step;

            // 輪子轉動動畫 (輪徑 2cm)
            this.wheelRoll += step / 2;

            const halfW = this.widthSize / 2;
            const halfH = this.heightSize / 2;
            const r = this.player.radius;

            const minBoundX = -halfW + r;
            const maxBoundX = halfW - r;
            const minBoundZ = -halfH + r;
            const maxBoundZ = halfH - r;

            const nextX = Math.max(minBoundX, Math.min(maxBoundX, this.player.x + dx));
            const nextZ = Math.max(minBoundZ, Math.min(maxBoundZ, this.player.z + dz));

            // 先嘗試完整斜向移動
            if (!this.checkCollision(nextX, nextZ)) {
                this.player.x = nextX;
                this.player.z = nextZ;
            } else {
                // 碰撞時平滑滑動：分拆 X 軸與 Z 軸
                let moved = false;
                if (!this.checkCollision(nextX, this.player.z)) {
                    this.player.x = nextX;
                    moved = true;
                } else if (!this.checkCollision(this.player.x, nextZ)) {
                    this.player.z = nextZ;
                    moved = true;
                }

                if (!moved) {
                    // 正面撞牆，平緩減速
                    this.speed *= 0.4;
                }
            }

            // 邊界嚴密限制
            this.player.x = Math.max(minBoundX, Math.min(maxBoundX, this.player.x));
            this.player.z = Math.max(minBoundZ, Math.min(maxBoundZ, this.player.z));
        }

        // 4. 同步移動自走車 3D 模型與車輪動畫
        if (this.robotModel) {
            this.robotModel.position.set(this.player.x, 0, this.player.z);
            this.robotModel.rotation.y = this.player.yaw;

            if (this.wheels) {
                // 前輪轉向與滾動
                if (this.wheels.flPivot) this.wheels.flPivot.rotation.y = this.steerAngle;
                if (this.wheels.frPivot) this.wheels.frPivot.rotation.y = this.steerAngle;
                if (this.wheels.w1) this.wheels.w1.rotation.x = this.wheelRoll;
                if (this.wheels.w2) this.wheels.w2.rotation.x = this.wheelRoll;
                // 後輪滾動
                if (this.wheels.w3) this.wheels.w3.rotation.x = this.wheelRoll;
                if (this.wheels.w4) this.wheels.w4.rotation.x = this.wheelRoll;
            }
        }

        // 5. 更新第一人稱車載相機
        if (this.currentMode === 'driver') {
            this.updateDriverCamera();
        }

        const halfW = this.widthSize / 2;
        const halfH = this.heightSize / 2;

        // 6. 即時回報座標
        this.onPositionUpdate({
            xCm: Math.round(this.player.x + halfW),
            zCm: Math.round(this.player.z + halfH),
            cellX: Math.max(0, Math.min(this.cols - 1, Math.floor((this.player.x + halfW) / this.cellSize))),
            cellY: Math.max(0, Math.min(this.rows - 1, Math.floor((this.player.z + halfH) / this.cellSize))),
            rawX: this.player.x,
            rawZ: this.player.z,
            yaw: this.player.yaw,
            isReset: false
        });

        // 7. 終點抵達偵測
        if (this.mazeData && this.mazeData.goal) {
            const gx = -halfW + (this.mazeData.goal.x + 0.5) * this.cellSize;
            const gz = -halfH + (this.mazeData.goal.y + 0.5) * this.cellSize;
            const dist = Math.hypot(this.player.x - gx, this.player.z - gz);
            if (dist < 12) {
                this.onGoalReached();
            }
        }
    }

    updateDriverCamera() {
        // 相機設在玩家視線高 (8cm)，並往車頭前移 5.5cm：廣角時不會拍到自己的車身，
        // 又留在 7cm 碰撞半徑內，貼牆時不會穿進牆裡
        const fx = -Math.sin(this.player.yaw);
        const fz = -Math.cos(this.player.yaw);
        const camX = this.player.x + fx * 5.5;
        const camZ = this.player.z + fz * 5.5;
        this.camera.position.set(camX, this.player.y, camZ);

        // 朝向
        const lookX = this.player.x + fx * 60;
        const lookZ = this.player.z + fz * 60;
        this.camera.lookAt(lookX, this.player.y, lookZ);

        // 車燈跟隨
        this.headlight.position.set(this.player.x, this.player.y, this.player.z);
        this.headlightTarget.position.set(lookX, this.player.y - 4, lookZ);
    }

    onWindowResize() {
        if (!this.container) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (width === 0 || height === 0) return;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(this.animate);

        // 使用高精度 Clock Delta Time (上限 50ms 防止切分頁失焦後暴衝)
        const dt = Math.min(this.clock.getDelta(), 0.05);

        if (this.isDriving) {
            this.updatePlayerMovement(dt);
        }

        if (this.currentMode === 'orbit' && this.orbitControls) {
            this.orbitControls.update();
        }

        if (this.goalBeamMat) {
            this.goalBeamMat.opacity = 0.22 + 0.08 * Math.sin(performance.now() / 400);
        }

        this.renderer.render(this.scene, this.camera);
    }
}
