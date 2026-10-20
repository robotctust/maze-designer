/**
 * 排位賽特效：音效（Web Audio 即時合成，不需要音效檔）與開賽儀式。
 * 靜音設定記在 localStorage，所有 .sfx-toggle 按鈕會同步顯示。
 */
const RankedFx = (() => {
    const MUTE_KEY = 'maze.sfxMuted';
    let ac = null;
    let muted = false;
    let introTimer = null;
    let introEl = null;
    try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}

    function audio() {
        if (!ac) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ac = new AC();
        }
        if (ac.state === 'suspended') ac.resume();
        return ac;
    }

    // 單一音：頻率、延遲秒數、長度、波形、音量、（可選）滑音終點頻率
    function tone(freq, at, dur, type, vol, slideTo) {
        const t = ac.currentTime + at;
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        g.connect(ac.destination);
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    const SOUNDS = {
        banner: () => tone(160, 0, 0.45, 'sawtooth', 0.05, 720),
        tick: () => tone(660, 0, 0.14, 'square', 0.06),
        go: () => { tone(990, 0, 0.5, 'square', 0.06); tone(1320, 0, 0.5, 'triangle', 0.05); },
        warn: () => { tone(880, 0, 0.12, 'square', 0.06); tone(880, 0.18, 0.12, 'square', 0.06); },
        finish: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.35, 'triangle', 0.08)),
        stamp: () => tone(110, 0, 0.25, 'square', 0.06),
        rank: () => tone(1175, 0, 0.3, 'triangle', 0.07),
        record: () => { tone(1568, 0, 0.4, 'triangle', 0.06); tone(2093, 0.12, 0.5, 'triangle', 0.05); },
        timeout: () => tone(330, 0, 0.7, 'sawtooth', 0.05, 110)
    };

    function play(name) {
        if (muted || !SOUNDS[name] || !audio()) return;
        SOUNDS[name]();
    }

    function syncButtons() {
        document.querySelectorAll('.sfx-toggle').forEach(btn => {
            btn.setAttribute('aria-pressed', String(!muted));
            btn.title = muted ? '音效：關（點一下開啟）' : '音效：開（點一下關閉）';
            btn.setAttribute('aria-label', btn.title);
            btn.querySelector('use')?.setAttribute('href', `assets/icons.svg#${muted ? 'volume-off' : 'volume'}`);
        });
    }

    function toggleMute() {
        muted = !muted;
        try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
        syncButtons();
        if (!muted) play('tick');
    }

    function cancelIntro() {
        clearTimeout(introTimer);
        introEl?.remove();
        introEl = null;
    }

    /**
     * 開賽儀式：段位橫幅 → 3、2、1、GO!
     * host：疊在上面的容器；tier：{ level, name, en }；sub：橫幅副標；
     * onCountdown：開始倒數時呼叫；onGo：GO! 出現時呼叫（此時開始比賽）
     */
    function intro(host, tier, sub, onCountdown, onGo) {
        cancelIntro();
        const el = document.createElement('div');
        el.className = 'ranked-intro';
        el.innerHTML = `
            <div class="intro-band">
                <div class="intro-stripes"></div>
                <div class="intro-main">
                    <svg class="intro-crest" aria-hidden="true"><use href="assets/icons.svg#crest-${tier.level}"></use></svg>
                    <div>
                        <p class="intro-en">${tier.en} ARENA</p>
                        <p class="intro-name">${tier.name}</p>
                        <p class="intro-sub"></p>
                    </div>
                </div>
                <div class="intro-stripes"></div>
            </div>`;
        el.querySelector('.intro-sub').textContent = sub;
        host.appendChild(el);
        introEl = el;
        play('banner');

        const steps = ['3', '2', '1', 'GO!'];
        let i = -1;
        const next = () => {
            i++;
            if (i === 0) onCountdown();
            const isGo = i === steps.length - 1;
            el.innerHTML = `${isGo ? '<span class="intro-flash"></span>' : ''}<div class="intro-count${isGo ? ' go' : ''}"><span class="intro-ring"></span><span class="intro-num">${steps[i]}</span></div>`;
            if (isGo) {
                play('go');
                onGo();
                introTimer = setTimeout(cancelIntro, 700);
            } else {
                play('tick');
                introTimer = setTimeout(next, 1000);
            }
        };
        introTimer = setTimeout(next, 1800);
    }

    /**
     * 比賽小地圖：只畫車子周圍 radius 格內的牆，北方朝上，邊緣霧化交給 CSS 遮罩。
     * px、pz：車子位置（以格為單位）；yaw：車頭朝向（弧度，0 = 朝北）
     */
    function drawMinimap(canvas, maze, px, pz, yaw, radius) {
        const size = canvas.clientWidth;
        if (!size || !maze) return;
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== size * dpr) {
            canvas.width = size * dpr;
            canvas.height = size * dpr;
        }
        const ctx = canvas.getContext('2d');
        const k = size / 2 / radius; // 每格幾像素
        const css = getComputedStyle(canvas);
        const tier = css.getPropertyValue('--tier').trim() || '#FBBF24';

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = 'rgba(8, 12, 26, 0.85)';
        ctx.fillRect(0, 0, size, size);

        // 以車子為中心：格座標 (x, z) → 畫布座標
        ctx.translate(size / 2 - px * k, size / 2 - pz * k);
        const c0 = Math.max(0, Math.floor(px - radius - 1));
        const c1 = Math.min(maze.cols, Math.ceil(px + radius + 1));
        const r0 = Math.max(0, Math.floor(pz - radius - 1));
        const r1 = Math.min(maze.rows, Math.ceil(pz + radius + 1));

        // 格線
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let c = c0; c <= c1; c++) { ctx.moveTo(c * k, r0 * k); ctx.lineTo(c * k, r1 * k); }
        for (let r = r0; r <= r1; r++) { ctx.moveTo(c0 * k, r * k); ctx.lineTo(c1 * k, r * k); }
        ctx.stroke();

        // 終點（在範圍內才看得到）
        if (maze.goal) {
            ctx.fillStyle = '#F87171';
            ctx.beginPath();
            ctx.arc((maze.goal.x + 0.5) * k, (maze.goal.y + 0.5) * k, k * 0.28, 0, Math.PI * 2);
            ctx.fill();
        }

        // 牆
        ctx.strokeStyle = '#E6EAF2';
        ctx.lineWidth = Math.max(2, k * 0.08);
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c < c1; c++) {
                if (maze.hWalls?.[r]?.[c]) { ctx.moveTo(c * k, r * k); ctx.lineTo((c + 1) * k, r * k); }
            }
        }
        for (let r = r0; r < r1; r++) {
            for (let c = c0; c <= c1; c++) {
                if (maze.vWalls?.[r]?.[c]) { ctx.moveTo(c * k, r * k); ctx.lineTo(c * k, (r + 1) * k); }
            }
        }
        ctx.stroke();

        // 車子：段位色箭頭，指向車頭方向
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.translate(size / 2, size / 2);
        ctx.rotate(-yaw);
        ctx.fillStyle = tier;
        ctx.shadowColor = tier;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(7, 7);
        ctx.lineTo(0, 3);
        ctx.lineTo(-7, 7);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 完賽慶祝：評級蓋章音效＋彩帶（減少動態效果時不撒彩帶）
    function celebrate(host) {
        setTimeout(() => play('stamp'), 450);
        if (reducedMotion()) return;
        const box = document.createElement('div');
        box.className = 'confetti';
        const colors = ['var(--tier)', '#FBBF24', '#FFFFFF', '#38BDF8'];
        for (let i = 0; i < 36; i++) {
            const p = document.createElement('span');
            p.style.left = `${(i * 37) % 100}%`;
            p.style.background = colors[i % colors.length];
            p.style.animationDuration = `${2.6 + (i % 5) * 0.4}s`;
            p.style.animationDelay = `${0.3 + (i % 9) * 0.18}s`;
            box.appendChild(p);
        }
        host.appendChild(box);
        setTimeout(() => box.remove(), 6000);
    }

    // 名次往下滾到最終名次，停下時響一聲
    function countRank(el, rank) {
        if (!el) return;
        if (reducedMotion()) {
            el.textContent = rank;
            play('rank');
            return;
        }
        let n = rank + 30;
        el.textContent = n;
        const id = setInterval(() => {
            n--;
            el.textContent = n;
            if (n <= rank) {
                clearInterval(id);
                play('rank');
            }
        }, 28);
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('.sfx-toggle')) toggleMute();
    });
    document.addEventListener('DOMContentLoaded', syncButtons);

    return { play, intro, cancelIntro, celebrate, countRank, drawMinimap, isMuted: () => muted };
})();
