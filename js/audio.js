/* ECHOES — audio engine. All sounds synthesized with WebAudio: no assets, tiny payload.
   Defaults OFF (autoplay-safe); preference stored in localStorage. */
(function () {
  let ctx = null;
  let master = null;
  let ambient = null;
  let enabled = false;

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
  }

  /* soft paper: filtered noise burst */
  function paper(dur = 0.5, gain = 0.16, hp = 900, lp = 6400) {
    if (!enabled || !ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = hp;
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = lp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(hpf); hpf.connect(lpf); lpf.connect(g); g.connect(master);
    src.start();
  }

  function pageTurn() { paper(0.55, 0.18, 700, 5800); }
  function bookOpen() { paper(1.4, 0.14, 300, 3000); setTimeout(() => paper(0.9, 0.1, 500, 4200), 650); }
  function bookClose() { paper(1.2, 0.12, 200, 2400); setTimeout(() => paper(0.4, 0.1, 800, 5000), 550); }

  /* extremely quiet wind ambience */
  function startAmbient() {
    if (!enabled || !ctx || ambient) return;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.022;
    lfo.connect(lfoG); lfoG.connect(g.gain); lfo.start();
    src.connect(lpf); lpf.connect(g); g.connect(master);
    src.start();
    ambient = { src, g };
  }
  function stopAmbient() {
    if (ambient) { try { ambient.src.stop(); } catch (e) {} ambient = null; }
  }

  function toggle(on) {
    enabled = on;
    if (on) {
      ensure();
      if (ctx.state === 'suspended') ctx.resume();
      startAmbient();
    } else {
      stopAmbient();
    }
    try { localStorage.setItem('echoes.sound', on ? 'on' : 'off'); } catch (e) {}
  }

  window.__echoesAudio = { pageTurn, bookOpen, bookClose, toggle, get enabled() { return enabled; } };
})();
