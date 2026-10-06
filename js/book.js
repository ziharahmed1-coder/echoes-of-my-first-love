/* ECHOES — book.js: data load, landing choreography, and the continuous reader.
   The manuscript is the source of truth; content comes from /data/book.json untouched. */
(function () {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s) => document.querySelector(s);

  window.addEventListener('load', () => document.body.classList.add('loaded'));

  let lastY = 0;
  const header = $('#siteHeader');
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    header.classList.toggle('header-hidden', y > 120 && y > lastY);
    lastY = y;
  }, { passive: true });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) en.target.classList.add('seen'); });
  }, { threshold: 0.18 });
  document.querySelectorAll('.section').forEach((s) => io.observe(s));

  let BOOK = null;
  let readerPages = [];
  let chapterStartIndexes = [];
  let activePageIndex = 0;

  fetch('/data/book.json').then((r) => r.json()).then((data) => {
    BOOK = data;
    buildReaderPages(data);
    buildChapterList(data);
    buildReaderMenu(data);
    renderReaderPages();
    updateProgress();
  });

  function chapterWord(n) {
    return ['One', 'Two', 'Three', 'Four', 'Five', 'Six'][n - 1] || 'One';
  }

  function chapterLabelForIndex(index, total = 0) {
    if (index === 0) return 'Prologue';
    if (index === total - 1) return 'Epilogue';
    return `Chapter ${chapterWord(index)}`;
  }

  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function buildChapterList(data) {
    const list = $('#chapterList');
    if (!list) return;
    data.forEach((ch, index) => {
      const button = document.createElement('button');
      button.className = 'chapter-card';
      const badge = chapterLabelForIndex(index, data.length);
      button.innerHTML = `<b>${badge}</b><i>${escapeHtml(ch.title)}</i>`;
      button.setAttribute('aria-label', `Open ${ch.title}`);
      button.addEventListener('click', () => openReader(index));
      list.appendChild(button);
    });
  }

  const demoLeaf = $('#demoLeaf');
  const demoR = $('#demoR');
  function demoFlip() {
    if (!demoLeaf || REDUCED) return;
    const rect = demoLeaf.getBoundingClientRect();
    if (rect.top > window.innerHeight || rect.bottom < 0) return;
    demoLeaf.classList.add('flipping');
    demoLeaf.style.transform = 'rotateY(-165deg)';
    if (window.__echoesAudio && window.__echoesAudio.enabled) window.__echoesAudio.pageTurn();
    setTimeout(() => {
      demoLeaf.classList.remove('flipping');
      demoLeaf.style.transition = 'none';
      demoLeaf.style.transform = 'rotateY(0deg)';
      demoR.innerHTML = '<h3>Chapter Two · Growing Together</h3><p class="pt">The days slowly became weeks, and before I realized it, Baby Class had become a memory.</p>';
      requestAnimationFrame(() => { demoLeaf.style.transition = ''; });
    }, 1550);
  }
  function demoText() {
    return '<h3>Chapter One · The First Meeting</h3><p class="pt">Then I heard it. A laugh. It wasn’t the loudest laugh in the classroom. It was the one that made everything else fall quiet.</p>';
  }
  if (demoR) {
    demoR.innerHTML = demoText();
    demoLeaf.innerHTML = '<h3 style="margin:0 0 14px;font-family:var(--sans);font-size:9.5px;letter-spacing:.28em;text-transform:uppercase;color:#9a7b3c">Chapter One · The First Meeting</h3><p style="margin:0;font-family:var(--serif);font-size:15px;line-height:1.65;color:#3d3527">A laugh crossed the room and changed the way the world looked.</p>';
    setInterval(demoFlip, 4200);
  }

  function buildReaderPages(data) {
    readerPages = [];
    chapterStartIndexes = [];

    data.forEach((chapter, chapterIndex) => {
      const chapterLabel = chapterLabelForIndex(chapterIndex, data.length);
      const chapterTitle = chapter.title || 'Untitled';
      const openerPage = {
        kind: 'opener',
        chapterIndex,
        chapterLabel,
        chapterTitle,
        prologue: chapter.prologue || ''
      };
      readerPages.push(openerPage);
      chapterStartIndexes.push(readerPages.length - 1);

      const paras = (chapter.body || '')
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (!paras.length) return;

      let buffer = [];
      let wordCount = 0;
      paras.forEach((para) => {
        const count = para.split(/\s+/).filter(Boolean).length;
        buffer.push(para);
        wordCount += count;
        const isLast = para === paras[paras.length - 1];
        if (wordCount >= 160 || isLast) {
          readerPages.push({
            kind: 'text',
            chapterIndex,
            chapterLabel,
            chapterTitle,
            paragraphs: buffer.slice()
          });
          buffer = [];
          wordCount = 0;
        }
      });
    });

    window.__echoesPages = readerPages;
    window.__echoesSpreads = chapterStartIndexes;
  }

  function createPageMarkup(page, pageNumber) {
    if (page.kind === 'opener') {
      const prologueHtml = page.prologue
        ? escapeHtml(page.prologue)
            .split('\n')
            .map((line) => `<p class="reader-epigraph-line">${line || '&nbsp;'}</p>`)
            .join('')
        : '';

      return `
        <article class="reader-page reader-page-opener" data-page-index="${pageNumber - 1}" data-chapter-index="${page.chapterIndex}" data-chapter-label="${escapeHtml(page.chapterLabel)}" data-chapter-title="${escapeHtml(page.chapterTitle)}">
          <div class="reader-page-body">
            <p class="reader-page-kicker">${escapeHtml(page.chapterLabel)}</p>
            <h2 class="reader-page-title">${escapeHtml(page.chapterTitle)}</h2>
            <div class="reader-page-rule"></div>
            ${prologueHtml}
          </div>
          <div class="reader-page-number">Page ${pageNumber}</div>
        </article>
      `;
    }

    const paragraphHtml = (page.paragraphs || []).map((p) => `<p>${escapeHtml(p)}</p>`).join('');

    return `
      <article class="reader-page reader-page-text" data-page-index="${pageNumber - 1}" data-chapter-index="${page.chapterIndex}" data-chapter-label="${escapeHtml(page.chapterLabel)}" data-chapter-title="${escapeHtml(page.chapterTitle)}">
        <div class="reader-page-body">${paragraphHtml}</div>
        <div class="reader-page-number">Page ${pageNumber}</div>
      </article>
    `;
  }

  function renderReaderPages() {
    const scroll = $('#readerScroll');
    if (!scroll) return;
    scroll.innerHTML = readerPages.map((page, index) => createPageMarkup(page, index + 1)).join('');
    scroll.scrollTop = 0;
    activePageIndex = 0;
    const firstPage = scroll.querySelector('[data-page-index="0"]');
    if (firstPage) firstPage.scrollIntoView({ block: 'start' });
    updateProgress();
  }

  const reader = $('#reader');
  const readerScroll = $('#readerScroll');
  const progressLabel = $('#progressLabel');
  const progressPct = $('#progressPct');
  const menu = $('#readerMenu');
  const endingEl = $('#readerEnding');
  const veil = $('#transitionVeil');

  function getActivePageIndex() {
    if (!readerScroll) return 0;
    const pageEls = readerScroll.querySelectorAll('.reader-page');
    if (!pageEls.length) return 0;

    let index = 0;
    let closest = Number.POSITIVE_INFINITY;
    const scrollTop = readerScroll.scrollTop + 120;

    pageEls.forEach((page, i) => {
      const offset = Math.abs(page.offsetTop - scrollTop);
      if (offset < closest) {
        closest = offset;
        index = i;
      }
    });

    return index;
  }

  function updateProgress() {
    if (!readerScroll || !progressLabel || !progressPct) return;
    const pageEls = readerScroll.querySelectorAll('.reader-page');
    if (!pageEls.length) return;

    activePageIndex = getActivePageIndex();
    const currentPage = pageEls[activePageIndex];
    const chapterLabel = currentPage?.dataset.chapterLabel || 'Prologue';
    const chapterTitle = currentPage?.dataset.chapterTitle || 'The First Meeting';
    const totalPages = pageEls.length;
    const percent = Math.min(100, Math.max(0, Math.round(((activePageIndex + 1) / totalPages) * 100)));

    progressLabel.textContent = chapterLabel + ' · ' + chapterTitle;
    progressPct.textContent = percent + '%';
  }

  function checkEndingVisibility() {
    if (!readerScroll || !endingEl || !reader.classList.contains('open')) return;
    const atEnd = readerScroll.scrollTop + readerScroll.clientHeight >= readerScroll.scrollHeight - 12;
    if (atEnd) {
      endingEl.classList.add('on');
    } else {
      endingEl.classList.remove('on');
    }
  }

  function openReader(startChapter = 0) {
    if (!BOOK || !reader || !readerScroll) return;
    if (!reader.classList.contains('open')) {
      veil.classList.add('on');
      reader.hidden = false;
      requestAnimationFrame(() => {
        reader.classList.add('open');
        setTimeout(() => veil.classList.remove('on'), 350);
      });
      document.body.classList.add('reader-open');
    }

    let targetIndex = 0;
    if (startChapter > 0 && chapterStartIndexes.length) {
      const safeIndex = Math.min(startChapter, chapterStartIndexes.length - 1);
      targetIndex = chapterStartIndexes[safeIndex];
    }

    const page = readerScroll.querySelector(`[data-page-index="${targetIndex}"]`);
    if (page) {
      page.scrollIntoView({ block: 'start' });
    } else {
      readerScroll.scrollTop = 0;
    }

    setTimeout(() => {
      updateProgress();
      checkEndingVisibility();
    }, 50);
  }

  function closeReader() {
    if (!reader) return;
    reader.classList.remove('open');
    endingEl.classList.remove('on');
    setTimeout(() => {
      reader.hidden = true;
      document.body.classList.remove('reader-open', 'reader-ui-hidden');
      if (readerScroll) readerScroll.scrollTop = 0;
    }, 420);
  }

  function moveToChapter(delta) {
    if (!readerScroll || !readerPages.length) return;
    const current = getActivePageIndex();
    let targetPage = current;

    if (delta > 0) {
      targetPage = readerPages.findIndex((page, index) => index > current && page.kind === 'opener');
      if (targetPage === -1) targetPage = readerPages.length - 1;
    } else {
      targetPage = [...readerPages.keys()].reverse().find((idx) => idx < current && readerPages[idx].kind === 'opener');
      if (targetPage === undefined) targetPage = 0;
    }

    const page = readerScroll.querySelector(`[data-page-index="${targetPage}"]`);
    if (page) page.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  }

  const readerTop = $('#readerTop'), readerBottom = $('#readerBottom');
  let hideTimer = null;
  function showChrome() {
    document.body.classList.remove('reader-ui-hidden');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (reader.classList.contains('open') && menu && menu.hidden !== false) {
        document.body.classList.add('reader-ui-hidden');
      }
    }, 2800);
  }
  ['pointermove', 'pointerdown', 'keydown'].forEach((ev) =>
    reader.addEventListener(ev, () => { showChrome(); }, { passive: true })
  );

  if (readerScroll) {
    readerScroll.addEventListener('scroll', () => {
      updateProgress();
      checkEndingVisibility();
      try { localStorage.setItem('echoes.position', String(getActivePageIndex())); } catch (e) {}
    }, { passive: true });
  }

  document.querySelectorAll('[data-open-book]').forEach((el) =>
    el.addEventListener('click', () => openReader(0))
  );

  $('#readerBack').addEventListener('click', closeReader);
  $('#readerPrev').addEventListener('click', () => moveToChapter(-1));
  $('#readerNext').addEventListener('click', () => moveToChapter(1));
  $('#endingClose').addEventListener('click', closeReader);

  window.addEventListener('keydown', (e) => {
    if (!reader || reader.hidden) return;
    if (e.key === 'Escape') closeReader();
    else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      readerScroll.scrollTop += window.innerHeight * 0.8;
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      readerScroll.scrollTop -= window.innerHeight * 0.8;
    }
  });

  const menuBtn = document.createElement('button');
  menuBtn.className = 'chrome-btn';
  menuBtn.textContent = 'Contents';
  menuBtn.setAttribute('aria-expanded', 'false');
  const chromeRight = document.querySelector('.chrome-right');
  if (chromeRight) chromeRight.prepend(menuBtn);

  function buildReaderMenu(data) {
    const list = $('#menuList');
    if (!list) return;
    list.innerHTML = '';
    data.forEach((ch, index) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.innerHTML = `<b>${chapterLabelForIndex(index, data.length)}</b><i>${escapeHtml(ch.title)}</i>`;
      button.addEventListener('click', () => {
        menu.hidden = true;
        menuBtn.setAttribute('aria-expanded', 'false');
        openReader(index);
      });
      li.appendChild(button);
      list.appendChild(li);
    });
  }

  menuBtn.addEventListener('click', () => {
    if (!menu) return;
    menu.hidden = !menu.hidden;
    menuBtn.setAttribute('aria-expanded', String(!menu.hidden));
  });

  const soundToggle = $('#soundToggle');
  let soundOn = false;
  try { soundOn = localStorage.getItem('echoes.sound') === 'on'; } catch (e) {}
  function renderSound() {
    if (!soundToggle) return;
    soundToggle.textContent = 'Sound: ' + (soundOn ? 'On' : 'Off');
    soundToggle.setAttribute('aria-pressed', String(soundOn));
  }
  soundToggle.addEventListener('click', () => {
    soundOn = !soundOn;
    window.__echoesAudio && window.__echoesAudio.toggle(soundOn);
    renderSound();
    try { localStorage.setItem('echoes.sound', soundOn ? 'on' : 'off'); } catch (e) {}
  });
  renderSound();
})();





























































































































