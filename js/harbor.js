// "Go east" compass on the home page (two taps opens the harbor),
// and the Eastern Harbor: load .html game files and play them in a sandboxed frame.
const Harbor = (() => {
  const $ = (id) => document.getElementById(id);
  const els = {};
  let eastTaps = 0;
  let games = []; // { id, name, html, added }
  let playingId = null;

  // ---------- IndexedDB (HTML files can be bigger than localStorage allows) ----------
  let dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('compass-maneuvers', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('games', { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }).catch(() => null);
    }
    return dbPromise;
  }

  async function tx(mode, fn) {
    const d = await db();
    if (!d) return null;
    return new Promise((resolve) => {
      try {
        const t = d.transaction('games', mode);
        const result = fn(t.objectStore('games'));
        t.oncomplete = () => resolve(result && 'result' in result ? result.result : true);
        t.onerror = t.onabort = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  const loadAll = async () => (await tx('readonly', (s) => s.getAll())) || [];
  const save = (g) => tx('readwrite', (s) => s.put(g));
  const remove = (id) => tx('readwrite', (s) => s.delete(id));

  // ---------- go east ----------
  function resetEast() {
    eastTaps = 0;
    els.needle.style.transform = 'rotate(-25deg)';
    els.eastTitle.textContent = 'Go east, sailor.';
    els.eastHint.textContent = 'Tap the compass to set your heading.';
  }

  function tapEast() {
    eastTaps++;
    if (eastTaps === 1) {
      els.needle.style.transform = 'rotate(90deg)';
      els.eastTitle.textContent = 'Heading 090° — due east.';
      els.eastHint.textContent = 'Tap again to set sail.';
    } else {
      els.needle.style.transform = 'rotate(450deg)';
      setTimeout(() => (location.hash = '#harbor'), 350);
    }
  }

  // ---------- harbor ----------
  function msg(text, cls) {
    els.msg.textContent = text;
    els.msg.className = 'feedback ' + (cls || '');
  }

  const prettyName = (file) => file.name.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ');

  async function addFiles(files) {
    const html = [...files].filter((f) => /\.html?$/i.test(f.name) || f.type === 'text/html');
    if (!html.length) { msg('Only .html files can be played here.', 'bad'); return; }
    const entries = await Promise.all(html.map(async (f) => ({ name: prettyName(f), html: await f.text() })));
    const added = await addGames(entries);
    if (added.length === 1) play(added[0].id);
  }

  // Adds {name, html} entries, skipping exact duplicates of games already in the list.
  async function addGames(entries) {
    const added = [];
    let stored = 0;
    for (const e of entries) {
      if (games.some((g) => g.html === e.html)) continue;
      const g = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: e.name, html: e.html, added: Date.now() };
      games.push(g);
      added.push(g);
      if (await save(g)) stored++;
    }
    renderList();
    const skipped = entries.length - added.length;
    const skipNote = skipped ? ` (${skipped} already here)` : '';
    if (!added.length) msg(`No new games${skipNote}.`);
    else if (stored < added.length) msg('Added for this visit, but this browser would not save them for next time.', 'bad');
    else msg(`Added ${added.length} game${added.length > 1 ? 's' : ''}${skipNote}.`, 'good');
    return added;
  }

  // Word codes load game packs hosted with the site (keys are lowercase).
  const PACKS = {
    bedwars: [
      ['Chat Bot', 'chat-bot.html'],
      ['Emulator.JS', 'emulator-js.html'],
      ['Geodash', 'geodash.html'],
      ['Minecraft', 'minecraft.html'],
      ['Moto X3M', 'motox3m.html'],
      ['Run 3', 'run-3.html'],
      ['Slope', 'slope.html'],
      ['HTML Editor', 'html-editor.html'],
    ].map(([name, file]) => ({ name, url: `games/bedwars/${file}` })),
  };

  async function loadPack(pack) {
    els.load.disabled = true;
    const entries = [];
    let failed = 0;
    try {
      for (let i = 0; i < pack.length; i++) {
        msg(`Loading ${pack[i].name} (${i + 1} of ${pack.length})…`);
        try {
          const res = await fetch(pack[i].url);
          if (!res.ok) throw new Error(res.status);
          entries.push({ name: pack[i].name, html: await res.text() });
        } catch {
          failed++;
        }
      }
      if (entries.length) await addGames(entries);
      if (failed) msg(`${failed} game${failed > 1 ? 's' : ''} could not be downloaded. Check your connection and try the code again.`, 'bad');
    } finally {
      els.load.disabled = false;
    }
    els.code.value = '';
  }

  async function loadCode() {
    const code = els.code.value.trim();
    if (!code) { msg('Paste a share code first.', 'bad'); return; }
    const pack = PACKS[code.toLowerCase()];
    if (pack) { await loadPack(pack); return; }
    let entries;
    try {
      entries = await ShareCode.read(code);
    } catch {
      msg('That code did not work. Make sure you copied the whole thing.', 'bad');
      return;
    }
    if (!entries.length) { msg('That code has no games in it.', 'bad'); return; }
    await addGames(entries);
    els.code.value = '';
  }

  function renderList() {
    els.list.innerHTML = '';
    for (const g of games) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = g.name;
      const size = document.createElement('small');
      size.textContent = g.html.length < 1048576 ? `${Math.max(1, Math.round(g.html.length / 1024))} KB` : `${(g.html.length / 1048576).toFixed(1)} MB`;
      const playBtn = document.createElement('button');
      playBtn.className = 'btn primary';
      playBtn.textContent = 'Play';
      playBtn.addEventListener('click', () => play(g.id));
      const del = document.createElement('button');
      del.className = 'btn ghost';
      del.textContent = 'Remove';
      del.setAttribute('aria-label', `Remove ${g.name}`);
      del.addEventListener('click', async () => {
        games = games.filter((x) => x.id !== g.id);
        await remove(g.id);
        if (playingId === g.id) closePlayer();
        renderList();
      });
      li.append(name, size, playBtn, del);
      els.list.appendChild(li);
    }
  }

  function play(id) {
    const g = games.find((x) => x.id === id);
    if (!g) return;
    playingId = id;
    els.title.textContent = g.name;
    // Sandboxed without allow-same-origin, so a game can't read this site's storage.
    els.frame.srcdoc = g.html;
    els.player.hidden = false;
    els.player.scrollIntoView({ behavior: 'smooth', block: 'start' });
    els.frame.focus();
  }

  function closePlayer() {
    playingId = null;
    els.frame.srcdoc = '';
    els.player.hidden = true;
  }

  function init() {
    Object.assign(els, {
      east: $('go-east'), needle: $('east-needle'), eastTitle: $('east-title'), eastHint: $('east-hint'),
      drop: $('h-drop'), file: $('h-file'), msg: $('h-msg'), list: $('h-list'),
      player: $('h-player'), title: $('h-title'), frame: $('h-frame'), full: $('h-full'), close: $('h-close'),
      code: $('h-code'), load: $('h-load'),
    });
    els.load.addEventListener('click', loadCode);
    els.east.addEventListener('click', tapEast);
    resetEast();

    els.file.addEventListener('change', () => { addFiles(els.file.files); els.file.value = ''; });
    els.drop.addEventListener('dragover', (e) => { e.preventDefault(); els.drop.classList.add('over'); });
    els.drop.addEventListener('dragleave', () => els.drop.classList.remove('over'));
    els.drop.addEventListener('drop', (e) => {
      e.preventDefault();
      els.drop.classList.remove('over');
      addFiles(e.dataTransfer.files);
    });
    els.close.addEventListener('click', closePlayer);
    els.full.addEventListener('click', () => els.frame.requestFullscreen?.());

    loadAll().then((saved) => {
      games = saved.sort((a, b) => a.added - b.added);
      renderList();
    });
  }

  return { init, resetEast, closePlayer };
})();
