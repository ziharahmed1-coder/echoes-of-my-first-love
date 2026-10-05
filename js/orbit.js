/* ECHOES — orbital memory fragments + hero parallax + book tilt
   Data-driven: fragments are built from the manuscript's real chapter titles & lines. */
(function () {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- pointer state (shared) ---------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, speed: 0 };

  /* ---------- hero parallax ---------- */
  const parallaxEls = document.querySelectorAll('[data-parallax]');
  const book3d = document.getElementById('book3d');
  const hero = document.getElementById('hero');

  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  /* ---------- fragments definition ----------
     Only real material: chapter titles and direct lines from the manuscript. */
  const FRAGMENTS = [
    { type: 'cover',   speed: 0.9,  size: 1.0 },
    { type: 'quote',   text: 'Some people leave your life… but never really leave your story.', src: 'epilogue', speed: 1.15, size: 1.05 },
    { type: 'page',    text: 'It all began with the nervous footsteps of a little boy walking through the gates of C.V.P.S for the very first time…', speed: 0.8, size: .9 },
    { type: 'chapter', num: 'Chapter One', title: 'The First Meeting', speed: 1.0, size: .95 },
    { type: 'photo',   speed: 1.3, size: .85 },
    { type: 'chapter', num: 'Chapter Three', title: 'The Day I Found My Courage', speed: 0.85, size: .9 },
    { type: 'leaf',    speed: 1.45, size: .8 },
    { type: 'quote',   text: 'I silently repeated the name inside my heart. Inaya Hassan. Again and again.', src: 'chapter-one', speed: 1.05, size: 1 },
    { type: 'spread',  speed: 0.75, size: .8 },
  ];

  const orbit = document.getElementById('orbit');

  function buildFragments() {
    FRAGMENTS.forEach((f, i) => {
      const el = document.createElement('div');
      el.className = 'frag';
      const inner = document.createElement('div');
      switch (f.type) {
        case 'cover':
          inner.className = 'frag-inner frag-cover';
          inner.innerHTML = '<img src="/assets/cover.webp" alt="" width="110" height="165">';
          break;
        case 'page':
          inner.className = 'frag-inner frag-page';
          inner.innerHTML = `<p>${f.text}</p>`;
          break;
        case 'quote':
          inner.className = 'frag-inner frag-quote';
          inner.innerHTML = `<p>“${f.text}”</p><span>${f.src || 'from the novel'}</span>`;
          break;
        case 'chapter':
          inner.className = 'frag-inner frag-chapter';
          inner.innerHTML = `<b>${f.num}</b><i>${f.title}</i>`;
          break;
        case 'photo':
          inner.className = 'frag-inner frag-photo';
          inner.innerHTML = '<img src="/assets/memory.jpg" alt="" loading="lazy">';
          break;
        case 'leaf':
          inner.className = 'frag-inner frag-leaf';
          inner.innerHTML = `<svg viewBox="0 0 64 64" fill="none"><path d="M32 56 C18 44 12 30 14 14 C30 16 44 24 50 40 C46 50 40 54 32 56 Z" fill="#4c7243"/><path d="M14 14 C24 26 32 38 46 50" stroke="#2f4d2c" stroke-width="1.6"/></svg>`;
          break;
        case 'spread':
          inner.className = 'frag-inner frag-spread';
          break;
      }
      if (f.size !== 1) inner.style.scale = f.size;
      el.appendChild(inner);
      orbit.appendChild(el);
      Object.assign(el.dataset, { i });
      f.el = el;
      f.inner = inner;
      // orbital parameters: each on its own inclined ellipse,
      // biased to the right of the hero so the copy side stays clean
      f.a = 260 + (i % 3) * 90 + Math.sin(i * 2.4) * 30;       // radius x (px)
      f.b = 150 + ((i * 37) % 110);                            // radius y (px)
      f.tilt = (i % 2 ? 1 : -1) * (8 + (i * 7) % 22);          // orbital plane tilt deg
      f.phase = (i / FRAGMENTS.length) * Math.PI * 2 + i * 0.7;
      f.bias = 1.05;                                           // push orbit right of copy
      f.angVel = (0.055 + (i % 4) * 0.014);                    // rad/s
    });
  }

  /* ---------- render loop ---------- */
  let orbitSlow = 1;       // global speed multiplier (1 normal, →0 during opening)
  let orbitTarget = 1;
  let running = true;

  function frame(t) {
    if (!running) return;
    const dt = Math.min((t - (frame.last || t)) / 1000, 0.05);
    frame.last = t;

    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;
    orbitSlow += (orbitTarget - orbitSlow) * 0.03;

    // parallax layers
    parallaxEls.forEach((el) => {
      const f = parseFloat(el.dataset.parallax);
      el.style.transform = `translate3d(${(-pointer.x * 26 * f).toFixed(2)}px, ${(-pointer.y * 16 * f).toFixed(2)}px, 0)`;
    });

    // book tilt toward pointer
    if (book3d) {
      book3d.style.transform =
        `rotateX(${(-pointer.y * 4).toFixed(2)}deg) rotateY(${(pointer.x * 7).toFixed(2)}deg)`;
    }

    // fragments: inclined 3D ellipse
    if (orbit) {
      FRAGMENTS.forEach((f) => {
        if (!f.el) return;
        const ang = f.phase + t / 1000 * f.angVel * orbitSlow;
        const x = Math.cos(ang) * f.a + f.a * f.bias;
        const z = Math.sin(ang);                       // -1..1 depth
        const leftness = Math.max(0, -x / f.a);        // how far into copy zone
        const y = z * f.b * 0.4 + f.tilt;
        const depth = (z + 1) / 2;                     // 0 far, 1 near
        const scale = 0.62 + depth * 0.55;
        const op = (0.28 + depth * 0.72) * (1 - leftness * 0.9);
        const blur = (1 - depth) * 1.6;
        f.el.style.transform =
          `translate3d(calc(${x.toFixed(1)}px - 50%), ${(-y).toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
        f.el.style.opacity = op.toFixed(3);
        f.el.style.filter = blur > 0.15 ? `blur(${blur.toFixed(1)}px)` : '';
        f.el.style.zIndex = depth > 0.5 ? 34 : 12;
      });
    }
    requestAnimationFrame(frame);
  }

  window.__echoesOrbit = { setSlow(v) { orbitTarget = v; }, stop() { running = false; } };

  buildFragments();
  if (REDUCED) {
    // static, elegant layout without animation
    FRAGMENTS.forEach((f) => { if (f.el) f.el.style.opacity = 0.5; });
  } else {
    requestAnimationFrame(frame);
  }
})();
