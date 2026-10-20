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

    document.addEventListener('click', (e) => {
        if (e.target.closest('.sfx-toggle')) toggleMute();
    });
    document.addEventListener('DOMContentLoaded', syncButtons);

    return { play, intro, cancelIntro, isMuted: () => muted };
})();
