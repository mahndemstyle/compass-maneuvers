// Reef Run: queue helm orders, then sail them across a reef to the treasure.
const Reef = (() => {
  const N = 9;
  const MAX_AHEAD = 4;
  const MAX_ORDERS = 24;
  const STEP_MS = 230;
  // Heading index 0..7 = N, NE, E, SE, S, SW, W, NW. y grows downward.
  const DX = [0, 1, 1, 1, 0, -1, -1, -1];
  const DY = [-1, -1, 0, 1, 1, 1, 0, -1];

  const $ = (id) => document.getElementById(id);
  const els = {};
  let level = 1;
  let map = null;
  let orders = [];
  let sailing = false;
  let shipRot = 0;
  let shipEl = null;

  // ---------- level generation ----------
  function mulberry32(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

  // Fewest orders from start to goal, or -1 if unreachable.
  function solve(rocks, start, goal) {
    const key = (x, y, h) => (y * N + x) * 8 + h;
    const seen = new Set([key(start.x, start.y, start.h)]);
    let frontier = [start];
    for (let depth = 1; frontier.length && depth <= 30; depth++) {
      const nextFrontier = [];
      for (const s of frontier) {
        const push = (x, y, h) => {
          const k = key(x, y, h);
          if (!seen.has(k)) { seen.add(k); nextFrontier.push({ x, y, h }); }
        };
        for (const d of [-2, -1, 1, 2]) push(s.x, s.y, (s.h + d + 8) % 8);
        let x = s.x, y = s.y;
        for (let n = 1; n <= MAX_AHEAD; n++) {
          x += DX[s.h]; y += DY[s.h];
          if (!inside(x, y) || rocks.has(y * N + x)) break;
          if (x === goal.x && y === goal.y) return depth;
          push(x, y, s.h);
        }
      }
      frontier = nextFrontier;
    }
    return -1;
  }

  function generate(lvl) {
    const rnd = mulberry32(lvl * 9973 + 17);
    const ri = (n) => Math.floor(rnd() * n);
    const density = Math.min(0.12 + lvl * 0.012, 0.3);
    const minPar = Math.min(3 + Math.floor(lvl / 3), 8);

    let best = null;
    for (let attempt = 0; attempt < 400; attempt++) {
      const start = { x: ri(N), y: N - 1 - ri(2), h: [0, 2, 6][ri(3)] };
      const goal = { x: ri(N), y: ri(3) };
      if (Math.abs(start.x - goal.x) + Math.abs(start.y - goal.y) < 6) continue;

      const rocks = new Set();
      for (let i = 0; i < N * N; i++) if (rnd() < density) rocks.add(i);
      rocks.delete(start.y * N + start.x);
      rocks.delete(goal.y * N + goal.x);

      const par = solve(rocks, start, goal);
      if (par < 0) continue;
      const candidate = { rocks, start, goal, par };
      if (par >= minPar) return candidate;
      if (!best || par > best.par) best = candidate;
    }
    return best;
  }

  // ---------- rendering ----------
  const pct = (v) => `${(v * 100) / N}%`;

  function place(node, x, y) {
    node.style.left = pct(x);
    node.style.top = pct(y);
    node.style.width = pct(1);
    node.style.height = pct(1);
  }

  const SHIP_SVG = `<svg viewBox="0 0 40 40" aria-hidden="true">
    <path d="M20 3 C27 12 28 24 26 36 H14 C12 24 13 12 20 3Z" fill="#f3e9d2" stroke="#071423" stroke-width="1.5"/>
    <path d="M20 9 V30" stroke="#8a5a2b" stroke-width="2"/>
    <path d="M20 11 C27 15 27 24 20 27Z" fill="#d4a44a"/>
    <circle cx="20" cy="6" r="1.8" fill="#e05a47"/></svg>`;
  const GOAL_SVG = `<svg viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="17" fill="#e8d3a0" opacity=".85"/>
    <path d="M12 12 28 28M28 12 12 28" stroke="#e05a47" stroke-width="5" stroke-linecap="round"/></svg>`;

  function renderBoard() {
    const b = els.board;
    b.innerHTML = '';
    b.style.setProperty('--n', N);
    for (const i of map.rocks) {
      const c = document.createElement('div');
      c.className = 'cell rock';
      place(c, i % N, Math.floor(i / N));
      b.appendChild(c);
    }
    const s = document.createElement('div');
    s.className = 'cell start';
    place(s, map.start.x, map.start.y);
    b.appendChild(s);

    const g = document.createElement('div');
    g.className = 'cell goal';
    g.innerHTML = GOAL_SVG;
    place(g, map.goal.x, map.goal.y);
    b.appendChild(g);

    shipEl = document.createElement('div');
    shipEl.className = 'ship';
    shipEl.innerHTML = SHIP_SVG;
    b.appendChild(shipEl);
    resetShip();
  }

  function resetShip() {
    shipEl.classList.remove('sunk', 'won');
    shipEl.style.transition = 'none';
    place(shipEl, map.start.x, map.start.y);
    shipRot = map.start.h * 45;
    setRot();
    void shipEl.offsetWidth; // flush so the snap back isn't animated
    shipEl.style.transition = '';
    els.board.querySelectorAll('.trail').forEach((t) => t.remove());
  }

  function setRot() {
    shipEl.querySelector('svg').style.transform = `rotate(${shipRot}deg)`;
  }

  function dropTrail(x, y) {
    const t = document.createElement('div');
    t.className = 'trail';
    t.style.left = `${((x + 0.5) * 100) / N}%`;
    t.style.top = `${((y + 0.5) * 100) / N}%`;
    t.style.width = t.style.height = pct(0.18);
    els.board.appendChild(t);
  }

  function orderText(o) {
    if (o.t === 'A') return `Ahead ${o.n}`;
    const deg = Math.abs(o.d) * 45;
    return o.d < 0 ? `⟲ ${deg}°` : `${deg}° ⟳`;
  }

  function finalHeading() {
    return orders.reduce((h, o) => (o.t === 'T' ? (h + o.d + 8) % 8 : h), map.start.h);
  }

  function renderOrders() {
    els.queue.innerHTML = '';
    orders.forEach((o, i) => {
      const li = document.createElement('li');
      li.textContent = orderText(o);
      li.title = 'Remove this order';
      li.addEventListener('click', () => {
        if (sailing) return;
        orders.splice(i, 1);
        renderOrders();
      });
      els.queue.appendChild(li);
    });
    els.count.textContent = orders.length;
    els.heading.textContent = pointLabel(finalHeading());
    setHelmEnabled(!sailing);
  }

  function renderLevelInfo() {
    const stars = store.get('reefStars', {});
    const total = Object.values(stars).reduce((a, b) => a + b, 0);
    els.level.textContent = level;
    els.par.textContent = map.par;
    els.stars.textContent = total;
    const got = stars[level] || 0;
    els.levelstars.textContent = '★'.repeat(got) + '☆'.repeat(3 - got);
    els.prev.disabled = level <= 1 || sailing;
    els.next.disabled = !(stars[level] > 0) || sailing;
  }

  function setHelmEnabled(on) {
    document.querySelectorAll('.helm-btns .btn').forEach((b) => (b.disabled = !on || orders.length >= MAX_ORDERS));
    els.undo.disabled = !on || !orders.length;
    els.clear.disabled = !on || !orders.length;
    els.sail.disabled = !on || !orders.length;
  }

  function msg(text, cls) {
    els.msg.textContent = text;
    els.msg.className = 'feedback ' + (cls || '');
  }

  // ---------- input ----------
  function addOrder(code) {
    if (sailing) return;
    if (code === 'A') {
      const last = orders[orders.length - 1];
      if (last && last.t === 'A' && last.n < MAX_AHEAD) last.n++;
      else if (orders.length < MAX_ORDERS) orders.push({ t: 'A', n: 1 });
    } else if (orders.length < MAX_ORDERS) {
      const d = (code[0] === 'L' ? -1 : 1) * Number(code[1]);
      orders.push({ t: 'T', d });
    }
    msg('');
    renderOrders();
  }

  // ---------- sailing ----------
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function sail() {
    if (sailing || !orders.length) return;
    sailing = true;
    resetShip();
    renderOrders();
    renderLevelInfo();
    msg('Under way…');

    const chips = [...els.queue.children];
    let x = map.start.x, y = map.start.y, h = map.start.h;
    let result = 'short';

    outer: for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      chips[i].classList.add('running');
      if (o.t === 'T') {
        h = (h + o.d + 8) % 8;
        shipRot += o.d * 45;
        setRot();
        await wait(STEP_MS + 60);
      } else {
        for (let n = 0; n < o.n; n++) {
          const nx = x + DX[h], ny = y + DY[h];
          if (!inside(nx, ny)) { result = 'off'; break outer; }
          if (map.rocks.has(ny * N + nx)) {
            // Lurch halfway into the rock so the hit reads visually.
            place(shipEl, x + DX[h] * 0.4, y + DY[h] * 0.4);
            await wait(STEP_MS);
            result = 'rock';
            break outer;
          }
          dropTrail(x, y);
          x = nx; y = ny;
          place(shipEl, x, y);
          await wait(STEP_MS);
          if (x === map.goal.x && y === map.goal.y) { result = 'win'; break outer; }
        }
      }
      chips[i].classList.remove('running');
      chips[i].classList.add('done');
    }

    if (result === 'win') {
      shipEl.classList.add('won');
      const used = orders.length;
      const got = used <= map.par ? 3 : used <= map.par + 2 ? 2 : 1;
      const stars = store.get('reefStars', {});
      if (!(stars[level] >= got)) { stars[level] = got; store.set('reefStars', stars); }
      const parNote = used <= map.par ? 'You matched par!' : `Par is ${map.par}. Can you do it in fewer?`;
      msg(`Treasure found in ${used} orders. ${'★'.repeat(got)} ${parNote}`, 'good');
      sailing = false;
    } else {
      const why = { rock: 'Ran aground on the reef!', off: 'Sailed off the chart!', short: 'Orders ran out before reaching the ✕.' }[result];
      if (result !== 'short') shipEl.classList.add('sunk');
      msg(`${why} Change your orders and try again.`, 'bad');
      await wait(1200);
      sailing = false;
      resetShip();
    }
    renderOrders();
    renderLevelInfo();
  }

  function loadLevel(lvl) {
    level = Math.max(1, lvl);
    store.set('reefLevel', level);
    map = generate(level);
    orders = [];
    sailing = false;
    msg('');
    renderBoard();
    renderOrders();
    renderLevelInfo();
  }

  function init() {
    Object.assign(els, {
      board: $('r-board'), queue: $('r-queue'), msg: $('r-msg'), heading: $('r-heading'),
      level: $('r-level'), par: $('r-par'), count: $('r-count'), stars: $('r-stars'),
      levelstars: $('r-levelstars'), prev: $('r-prev'), next: $('r-next'),
      undo: $('r-undo'), clear: $('r-clear'), sail: $('r-sail'),
    });
    document.querySelectorAll('.helm-btns .btn').forEach((b) =>
      b.addEventListener('click', () => addOrder(b.dataset.cmd)));
    els.undo.addEventListener('click', () => {
      if (sailing) return;
      const last = orders[orders.length - 1];
      if (last && last.t === 'A' && last.n > 1) last.n--;
      else orders.pop();
      renderOrders();
    });
    els.clear.addEventListener('click', () => { if (!sailing) { orders = []; msg(''); renderOrders(); } });
    els.sail.addEventListener('click', sail);
    els.prev.addEventListener('click', () => loadLevel(level - 1));
    els.next.addEventListener('click', () => loadLevel(level + 1));
    document.addEventListener('keydown', (e) => {
      if (location.hash !== '#reef' || e.target.closest('input, textarea')) return;
      const keys = { ArrowUp: 'A', ArrowLeft: 'L1', ArrowRight: 'R1', q: 'L2', e: 'R2' };
      if (keys[e.key]) { e.preventDefault(); addOrder(keys[e.key]); }
      else if (e.key === 'Enter') { e.preventDefault(); sail(); }
      else if (e.key === 'Backspace') { e.preventDefault(); els.undo.click(); }
    });
    loadLevel(store.get('reefLevel', 1));
  }

  return { init, totalStars: () => Object.values(store.get('reefStars', {})).reduce((a, b) => a + b, 0) };
})();
