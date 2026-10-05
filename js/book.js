/* ECHOES — book.js: data load, landing choreography, and the reader.
   The manuscript is the source of truth; content comes from /data/book.json untouched. */
(function () {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s) => document.querySelector(s);

  /* ================= landing choreography ================= */
  window.addEventListener('load', () => document.body.classList.add('loaded'));

  // header hide on scroll
  let lastY = 0;
  const header = $('#siteHeader');
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    header.classList.toggle('header-hidden', y > 120 && y > lastY);
    lastY = y;
  }, { passive: true });

  // reveal sections
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) en.target.classList.add('seen'); });
  }, { threshold: 0.18 });
  document.querySelectorAll('.section').forEach((s) => io.observe(s));

  /* ================= data ================= */
  let BOOK = null;
  fetch('/data/book.json').then((r) => r.json()).then((data) => {
    BOOK = data;
    buildChapterList(data);
    buildReaderMenu(data);
    paginate(data);
  });

  /* chapter list on landing */
  function buildChapterList(data) {
    const list = $('#chapterList');
    const labels = { 1: 'Prologue', 2: 'Prologue', 3: 'Prologue', 4: 'Prologue', 5: 'Prologue', 6: 'Prologue', 7: 'Epilogue' };
    data.forEach((ch) => {
      const b = document.createElement('button');
      b.className = 'chapter-card';
      b.innerHTML = `<b>${ch.number === 7 ? 'Epilogue' : 'Chapter ' + 'One Two Three Four Five Six'.split(' ')[ch.number - 1]}</b><i>${ch.title}</i>`;
      b.setAttribute('aria-label', `Open ${ch.title}`);
      b.addEventListener('click', () => openReader(ch.number === 7 ? ch.number : ch.number - 1));
      list.appendChild(b);
    });
  }

  function chapterWord(n) { return ['One','Two','Three','Four','Five','Six'][n - 1]; }

  /* ================= demo spread (landing) ================= */
  const demoLeaf = $('#demoLeaf');
  const demoR = $('#demoR');
  function demoFlip() {
    if (!demoLeaf || REDUCED) return;
    const rect = demoLeaf.getBoundingClientRect();
    if (rect.top > window.innerHeight || rect.bottom < 0) return; // offscreen: skip
    demoLeaf.classList.add('flipping');
    demoLeaf.style.transform = 'rotateY(-165deg)';
    if (window.__echoesAudio && window.__echoesAudio.enabled) window.__echoesAudio.pageTurn();
    setTimeout(() => {
      demoLeaf.classList.remove('flipping');
      demoLeaf.style.transition = 'none';
      demoLeaf.style.transform = 'rotateY(0deg)';
      demoR.innerHTML = demoText();
      requestAnimationFrame(() => { demoLeaf.style.transition = ''; });
    }, 1550);
  }
  function demoText() {
    return `<h3>Chapter Two · Growing Together</h3><p class="pt">The days slowly became weeks, and before I realized it, Baby Class had become a memory. The frightened little boy who had once stood at the classroom door was slowly beginning to find his place…</p>`;
  }
  if (demoR) {
    demoR.innerHTML = `<h3>Chapter One · The First Meeting</h3><p class="pt">Then I heard it. A laugh. It wasn’t the loudest laugh in the classroom. It wasn’t the kind that made everyone stop and look. It was warm — the kind of laugh that made you want to know what had made someone so happy…</p>`;
    demoLeaf.innerHTML = `<h3 style="margin:0 0 14px;font-family:var(--sans);font-size:9.5px;letter-spacing:.28em;text-transform:uppercase;color:#9a7b3c">Chapter One · The First Meeting</h3><p class="pt">“My name is Inaya Hassan.” I silently repeated the name inside my heart. Again. And again. As if I were afraid I might forget it. Little did I know, I never would…</p>`;
    setInterval(demoFlip, 4200);
  }

  /* ================= pagination ================= */
  const WORDS_PER_PAGE = 265;
  let pages = [];        // {kind:'opener'|'text', chapter, html, num}
  let spreads = [];      // [[i,j],...]
  let state = { spread: 0, flipping: false, open: false, coverPhase: true };
  let lastChapterIdx = 0;

  function paginate(data) {
    pages = [];
    data.forEach((ch, ci) => {
      pages.push({ kind: 'opener', chapter: ci, chapterObj: ch });
      if (ch.prologue && ch.prologue.trim()) {
        // prologue epigraph gets its own breathing page when long, else rides with body
        if (ch.prologue.split(/\s+/).length > 60) {
          pages.push({ kind: 'text', chapter: ci, chapterObj: ch, html: epigraphHTML(ch.prologue) });
        }
      }
      // split body into paragraph-preserving page chunks
      const paras = ch.body.split('\n').map((s) => s.trim()).filter(Boolean);
      let buf = [];
      let count = 0;
      paras.forEach((p) => {
        const w = p.split(/\s+/).length;
        buf.push(p);
        count += w;
        if (count >= WORDS_PER_PAGE) {
          pages.push({ kind: 'text', chapter: ci, chapterObj: ch, html: flowHTML(buf) });
          buf = []; count = 0;
        }
      });
      if (buf.length) pages.push({ kind: 'text', chapter: ci, chapterObj: ch, html: flowHTML(buf) });
    });
    // pair pages into spreads
    spreads = [];
    for (let i = 0; i < pages.length; i += 2) spreads.push([i, i + 1 < pages.length ? i + 1 : null]);
    window.__echoesPages = pages;
    window.__echoesSpreads = spreads;
  }

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function flowHTML(paras) {
    return paras.map((p) => `<p>${esc(p)}</p>`).join('');
  }
  function epigraphHTML(text) {
    return `<div class="epigraph">${esc(text).split('\n').map((l) => `<p style="text-align:center">${esc(l)}</p>`).join('')}</div>`;
  }

  function pageHTML(page, idx) {
    if (!page) return '';
    const chName = page.chapterObj.number === 7 ? 'Epilogue' : `Chapter ${chapterWord(page.chapterObj.number)}`;
    const num = `<span class="page-num">${idx + 1}</span><span class="page-chapter-mark">${page.kind === 'opener' ? '' : chName}</span>`;
    if (page.kind === 'opener') {
      const ch = page.chapterObj;
      const ep = ch.prologue ? `<p class="oc-epigraph">${esc(ch.prologue).split('\n').slice(0, 8).join('<br>')}</p>` : '';
      return `<div class="page-content opener">
        <span class="oc-num">${chName}</span>
        <h2 class="oc-title">${esc(ch.title)}</h2>
        <span class="oc-rule"></span>
        ${ep}
      </div>${num}`;
    }
    return `<div class="page-content flow">${page.html}</div>${num}`;
  }

  /* ================= reader open sequence ================= */
  const reader = $('#reader');
  const readerBook = $('#readerBook');
  const leftHalf = document.querySelector('.reader-left-half');
  const rightHalf = document.querySelector('.reader-right-half');
  const leaf = $('#readerLeaf');
  const veil = $('#transitionVeil');

  function openReader(startChapter = 0) {
    if (!BOOK || state.open) return;
    state.open = true;
    state.coverPhase = true;
    document.body.classList.remove('cover-open');
    readerBook.classList.add('cover-phase');

    if (window.__echoesOrbit) window.__echoesOrbit.setSlow(0);
    if (window.__echoesAudio) window.__echoesAudio.bookOpen();
    veil.classList.add('on');
    reader.hidden = false;
    requestAnimationFrame(() => {
      reader.classList.add('open');
      if (REDUCED) { finishOpen(startChapter); return; }
      // camera push-in feel
      readerBook.style.transform = 'scale(1.12) translateZ(60px)';
      setTimeout(() => {
        document.body.classList.add('cover-open');
        readerBook.classList.remove('cover-phase');
        setTimeout(() => { veil.classList.remove('on'); }, 350);
        setTimeout(() => {
          readerBook.style.transform = 'scale(1)';
          finishOpen(startChapter);
        }, 900);
      }, 900);
    });
    setTimeout(() => document.body.classList.add('reader-open'), 300);
  }

  function finishOpen(startChapter) {
    state.coverPhase = false;
    if (startChapter === 0) {
      const saved = loadPosition();
      if (saved > 0 && saved < spreads.length) { state.spread = saved; }
    }
    if (startChapter > 0) {
      // jump to spread containing the requested chapter's opener
      let target = 0;
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].kind === 'opener' && pages[i].chapter === startChapter) { target = i; break; }
      }
      state.spread = Math.floor(target / 2);
    }
    renderSpread(true);
    showChrome();
    updateProgress();
  }

  document.querySelectorAll('[data-open-book]').forEach((el) =>
    el.addEventListener('click', () => openReader(0)));
  window.__echoesOpen = openReader;

  /* ================= render + flip ================= */
  const isMobile = () => window.matchMedia('(max-width: 640px)').matches;

  function renderSpread(instant) {
    const [li, ri] = spreads[state.spread];
    leftHalf.innerHTML = pageHTML(pages[li], li);
    rightHalf.innerHTML = pageHTML(pages[ri], ri == null ? li : ri);
    // chapter transition tint
    const ci = pages[ri ?? li].chapter;
    if (ci !== lastChapterIdx) lastChapterIdx = ci;
    checkEndingVisibility();
  }

  function next() {
    if (state.flipping || state.coverPhase) return;
    if (state.spread >= spreads.length - 1) { ending(); return; }
    flipNext();
  }
  function prev() {
    if (state.flipping || state.coverPhase) return;
    if (state.spread <= 0) return;
    flipPrev();
  }

  function flipNext() {
    const [li, ri] = spreads[state.spread];
    const nextSpread = spreads[state.spread + 1];
    if (!nextSpread) { ending(); return; }
    state.flipping = true;
    if (window.__echoesAudio) window.__echoesAudio.pageTurn();

    if (isMobile()) {
      // single page: current page flips away revealing next
      leaf.style.transition = REDUCED ? 'none' : 'transform .8s var(--ease-soft)';
      leaf.innerHTML = `<div class="leaf-face front" style="transform:none;border-radius:10px">${pageHTML(pages[ri ?? li], ri ?? li)}</div>`;
      leaf.style.display = 'block';
      leaf.style.left = '0'; leaf.style.width = '100%';
      state.spread++;
      const [nli] = spreads[state.spread];
      rightHalf.innerHTML = pageHTML(pages[nli], nli);
      requestAnimationFrame(() => {
        leaf.style.transform = 'rotateY(-175deg)';
        setTimeout(() => { leaf.style.display = 'none'; leaf.style.transform = ''; state.flipping = false; afterFlip(); }, REDUCED ? 50 : 820);
      });
      return;
    }

    // desktop: right page turns, its back is the next spread's LEFT page
    const frontHTML = pageHTML(pages[ri ?? li], ri ?? li);
    const backHTML = pageHTML(pages[nextSpread[0]], nextSpread[0]);
    leaf.style.transition = REDUCED ? 'none' : 'transform 1s var(--ease-soft)';
    leaf.innerHTML =
      `<div class="leaf-face front">${frontHTML}<div class="leaf-shade"></div></div>
       <div class="leaf-face back">${backHTML}<div class="leaf-shade" style="transform:scaleX(-1)"></div></div>`;
    leaf.style.display = 'block';
    requestAnimationFrame(() => {
      leaf.style.transform = 'rotateY(-180deg)';
      setTimeout(() => {
        state.spread++;
        renderSpread();
        leaf.style.display = 'none';
        leaf.style.transform = '';
        state.flipping = false;
        afterFlip();
      }, REDUCED ? 50 : 1020);
    });
  }

  function flipPrev() {
    const [li, ri] = spreads[state.spread];
    const prevSpread = spreads[state.spread - 1];
    state.flipping = true;
    if (window.__echoesAudio) window.__echoesAudio.pageTurn();

    if (isMobile()) {
      leaf.style.transition = REDUCED ? 'none' : 'transform .8s var(--ease-soft)';
      leaf.innerHTML = `<div class="leaf-face back" style="transform:rotateY(180deg) translateZ(1px);border-radius:10px">${pageHTML(pages[li], li)}</div>`;
      leaf.style.display = 'block';
      leaf.style.left = '0'; leaf.style.width = '100%';
      state.spread--;
      const [pli] = spreads[state.spread];
      rightHalf.innerHTML = pageHTML(pages[pli], pli);
      requestAnimationFrame(() => {
        leaf.style.transform = 'rotateY(0deg)';
        setTimeout(() => { leaf.style.display = 'none'; leaf.style.transform = ''; state.flipping = false; afterFlip(); }, REDUCED ? 50 : 820);
      });
      return;
    }

    // desktop: left page turns back; its "front" is current left page, its back becomes the prev spread's right page
    const frontHTML = pageHTML(pages[li], li);
    const backHTML = pageHTML(pages[prevSpread[1] ?? prevSpread[0]], prevSpread[1] ?? prevSpread[0]);
    leaf.style.left = '0';
    leaf.style.width = '50%';
    leaf.style.transformOrigin = 'right center';
    leaf.style.transition = REDUCED ? 'none' : 'transform 1s var(--ease-soft)';
    leaf.innerHTML =
      `<div class="leaf-face front" style="border-radius:10px 3px 3px 10px">${frontHTML}</div>
       <div class="leaf-face back" style="border-radius:3px 10px 10px 3px">${backHTML}</div>`;
    leaf.style.display = 'block';
    leaf.style.transform = 'rotateY(180deg)';
    requestAnimationFrame(() => {
      leaf.style.transform = 'rotateY(0deg)';
      setTimeout(() => {
        state.spread--;
        renderSpread();
        leaf.style.display = 'none';
        leaf.style.transform = '';
        leaf.style.transformOrigin = '';
        state.flipping = false;
        afterFlip();
      }, REDUCED ? 50 : 1020);
    });
  }

  function afterFlip() {
    savePosition();
    updateProgress();
    const [li, ri] = spreads[state.spread];
    const chIdx = pages[li].chapter;
    if (chIdx !== lastChapterIdx) {
      lastChapterIdx = chIdx;
      // chapter transition: extremely subtle
      if (window.__echoesAudio && window.__echoesAudio.enabled) window.__echoesAudio.pageTurn();
    }
  }

  /* progress + chrome */
  const progressLabel = $('#progressLabel');
  const progressPct = $('#progressPct');
  function updateProgress() {
    const [li] = spreads[state.spread];
    const ch = pages[li].chapterObj;
    progressLabel.textContent = (ch.number === 7 ? 'Epilogue' : `Chapter ${chapterWord(ch.number)}`) + ' · ' + ch.title;
    const pct = Math.round(((state.spread + 1) / spreads.length) * 100);
    progressPct.textContent = pct + '%';
  }

  const readerTop = $('#readerTop'), readerBottom = $('#readerBottom');
  let hideTimer = null;
  function showChrome() {
    document.body.classList.remove('reader-ui-hidden');
    clearTimeout(hideTimer);
    if (!isMobile() || true) hideTimer = setTimeout(() => {
      if (state.open && !menu.hidden) return;
      document.body.classList.add('reader-ui-hidden');
    }, 2800);
  }
  ['pointermove', 'pointerdown', 'keydown'].forEach((ev) =>
    reader.addEventListener(ev, () => { showChrome(); }, { passive: true }));

  /* ================= ending sequence ================= */
  const endingEl = document.createElement('div');
  endingEl.className = 'reader-ending';
  endingEl.innerHTML = `<div><p>The story ended.<br>The memory remains.</p><span class="end-sub">Echoes of My First Love</span><br><br><button class="btn-glass" id="endingClose" style="margin-top:8px"><span>Return</span></button></div>`;
  reader.appendChild(endingEl);
  let endingShown = false;
  function ending() {
    if (endingShown) return;
    endingShown = true;
    if (window.__echoesAudio) { /* subtle pause */ }
    setTimeout(() => {
      endingEl.classList.add('on');
      setTimeout(() => {
        // book closes softly
        if (window.__echoesAudio) window.__echoesAudio.bookClose();
        document.body.classList.remove('cover-open');
        readerBook.classList.add('cover-phase');
        setTimeout(closeReader, 1400);
      }, 2600);
    }, 700);
  }
  reader.addEventListener('click', (e) => {
    if (e.target.id === 'endingClose') {
      endingShown = false;
      endingEl.classList.remove('on');
    }
  });

  function checkEndingVisibility() {}

  /* ================= close reader ================= */
  function closeReader(opts = {}) {
    if (opts.reset) { try { localStorage.removeItem('echoes.position'); } catch (e) {} }
    reader.classList.remove('open');
    setTimeout(() => {
      reader.hidden = true;
      state.open = false;
      endingEl.classList.remove('on');
      endingShown = false;
      document.body.classList.remove('cover-open', 'reader-open', 'reader-ui-hidden');
      readerBook.classList.remove('cover-phase');
      readerBook.style.transform = '';
      if (window.__echoesOrbit) window.__echoesOrbit.setSlow(1);
      if (!opts.reset) savePosition();
    }, 650);
  }
  $('#readerBack').addEventListener('click', () => closeReader({ reset: endingShown }));
  $('#readerNext').addEventListener('click', next);
  $('#readerPrev').addEventListener('click', prev);
  $('#tapNext').addEventListener('click', next);
  $('#tapPrev').addEventListener('click', prev);

  window.addEventListener('keydown', (e) => {
    if (!state.open) return;
    if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'Escape') closeReader({ reset: endingShown });
  });

  /* ================= contents menu ================= */
  const menu = $('#readerMenu');
  const menuBtn = document.createElement('button');
  menuBtn.className = 'chrome-btn';
  menuBtn.textContent = 'Contents';
  menuBtn.setAttribute('aria-expanded', 'false');
  document.querySelector('.chrome-right').prepend(menuBtn);
  menuBtn.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    menuBtn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  function buildReaderMenu(data) {
    const list = $('#menuList');
    data.forEach((ch, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.innerHTML = `<b>${ch.number === 7 ? 'Epilogue' : 'Chapter ' + chapterWord(ch.number)}</b><i>${ch.title}</i>`;
      b.addEventListener('click', () => {
        menu.hidden = true;
        if (!state.open) { openReader(i); return; }
        let target = 0;
        for (let p = 0; p < pages.length; p++) {
          if (pages[p].kind === 'opener' && pages[p].chapter === i) { target = p; break; }
        }
        state.spread = Math.floor(target / 2);
        renderSpread();
        updateProgress();
        savePosition();
      });
      li.appendChild(b);
      list.appendChild(li);
    });
  }

  /* ================= position memory ================= */
  function savePosition() {
    try { localStorage.setItem('echoes.position', String(state.spread)); } catch (e) {}
  }
  function loadPosition() {
    try { return parseInt(localStorage.getItem('echoes.position') || '0', 10) || 0; } catch (e) { return 0; }
  }
  window.__echoesLoadPosition = loadPosition;

  /* ================= sound toggle ================= */
  const soundToggle = $('#soundToggle');
  let soundOn = false;
  try { soundOn = localStorage.getItem('echoes.sound') === 'on'; } catch (e) {}
  function renderSound() {
    soundToggle.textContent = 'Sound: ' + (soundOn ? 'On' : 'Off');
    soundToggle.setAttribute('aria-pressed', String(soundOn));
  }
  soundToggle.addEventListener('click', () => {
    soundOn = !soundOn;
    window.__echoesAudio.toggle(soundOn);
    renderSound();
  });
  renderSound();

})();
