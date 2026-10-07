// Heading Drill: answer compass questions by tapping a sector on an unlabeled ring.
const Drill = (() => {
  const ROUND_MS = 60_000;
  const PENALTY_MS = 2_000;
  const C = 160; // dial center in SVG units
  const NS = 'http://www.w3.org/2000/svg';

  const $ = (id) => document.getElementById(id);
  const els = {};
  let wedges = [];
  let labels = [];
  let needle;

  let running = false;
  let locked = false;
  let endAt = 0;
  let timer = null;
  let score = 0;
  let streak = 0;
  let answer = 0;
  let needleDeg = 0;

  const polar = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return [C + r * Math.sin(a), C - r * Math.cos(a)];
  };

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    parent.appendChild(node);
    return node;
  }

  function buildDial() {
    const svg = els.dial;
    el('circle', { cx: C, cy: C, r: 152, class: 'face' }, svg);

    const rIn = 62, rOut = 140;
    POINTS.forEach((name, i) => {
      const a0 = i * 45 - 22.5, a1 = i * 45 + 22.5;
      const [x0, y0] = polar(a0, rOut), [x1, y1] = polar(a1, rOut);
      const [x2, y2] = polar(a1, rIn), [x3, y3] = polar(a0, rIn);
      const d = `M${x0} ${y0} A${rOut} ${rOut} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${rIn} ${rIn} 0 0 0 ${x3} ${y3}Z`;
      const w = el('path', { d, class: 'wedge', 'data-i': i, role: 'button', 'aria-label': name, tabindex: 0 }, svg);
      w.addEventListener('click', () => pick(i));
      w.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i); } });
      wedges.push(w);

      const [lx, ly] = polar(i * 45, 101);
      const t = el('text', { x: lx, y: ly + 5, class: 'wlabel' }, svg);
      t.textContent = name;
      labels.push(t);
    });

    for (let deg = 0; deg < 360; deg += 15) {
      const [x0, y0] = polar(deg, 144), [x1, y1] = polar(deg, deg % 45 ? 148 : 152);
      el('line', { x1: x0, y1: y0, x2: x1, y2: y1, class: 'tick' }, svg);
    }
    // Only north is marked; everything else is the player's job.
    const n = el('text', { x: C, y: 30, class: 'nlabel' }, svg);
    n.textContent = 'N';

    needle = el('g', { class: 'needle', visibility: 'hidden' }, svg);
    el('path', { d: `M${C} ${C - 52} L${C + 9} ${C} L${C} ${C + 52} L${C - 9} ${C}Z`, class: 'needle-s' }, needle);
    el('path', { d: `M${C} ${C - 52} L${C + 9} ${C} L${C - 9} ${C}Z`, class: 'needle-n' }, needle);
    el('circle', { cx: C, cy: C, r: 6, class: 'hub' }, svg);
  }

  function pointNeedle(i, show = true) {
    // Rotate the shortest way round from wherever the needle is now.
    const target = i * 45;
    const cur = ((needleDeg % 360) + 360) % 360;
    let diff = target - cur;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    needleDeg += diff;
    needle.style.transform = `rotate(${needleDeg}deg)`;
    needle.setAttribute('visibility', show ? 'visible' : 'hidden');
  }

  const rand = (n) => Math.floor(Math.random() * n);
  const mod8 = (n) => ((n % 8) + 8) % 8;

  function makeQuestion() {
    const kinds = ['name', 'degrees', 'back', 'turn', 'turn'];
    const kind = kinds[rand(kinds.length)];
    const i = rand(8);
    switch (kind) {
      case 'name':
        return { text: `Point to <em>${POINTS[i]}</em>`, answer: i };
      case 'degrees':
        return { text: `Point to bearing <em>${String(i * 45).padStart(3, '0')}°</em>`, answer: i };
      case 'back': {
        const useDeg = Math.random() < 0.5;
        const shown = useDeg ? `${String(i * 45).padStart(3, '0')}°` : POINTS[i];
        return { text: `Back bearing of <em>${shown}</em>`, answer: mod8(i + 4) };
      }
      default: {
        const steps = [1, 2, 2, 3, 4][rand(5)];
        const port = Math.random() < 0.5;
        return {
          text: `Facing <em>${POINTS[i]}</em>, turn <em>${steps * 45}° ${port ? 'port' : 'starboard'}</em>`,
          answer: mod8(i + (port ? -steps : steps)),
          needle: i,
        };
      }
    }
  }

  function next() {
    const q = makeQuestion();
    answer = q.answer;
    els.prompt.innerHTML = q.text;
    wedges.forEach((w) => w.classList.remove('right', 'wrong'));
    labels.forEach((l) => l.classList.remove('show'));
    if (q.needle !== undefined) pointNeedle(q.needle);
    else needle.setAttribute('visibility', 'hidden');
    els.dial.classList.remove('locked');
    locked = false;
  }

  function pick(i) {
    if (!running || locked) return;
    locked = true;
    els.dial.classList.add('locked');
    const correct = i === answer;
    wedges[answer].classList.add('right');
    labels[answer].classList.add('show');
    pointNeedle(answer);
    if (correct) {
      streak++;
      const mult = multiplier();
      score += 10 * mult;
      feedback(`+${10 * mult}`, 'good');
    } else {
      wedges[i].classList.add('wrong');
      labels[i].classList.add('show');
      streak = 0;
      endAt -= PENALTY_MS;
      feedback(`It was ${pointLabel(answer)} (−2s)`, 'bad');
    }
    renderStats();
    setTimeout(() => { if (running) next(); }, correct ? 450 : 1100);
  }

  const multiplier = () => Math.min(5, 1 + Math.floor(streak / 3));

  function feedback(text, cls) {
    els.feedback.textContent = text;
    els.feedback.className = 'feedback ' + (cls || '');
  }

  function renderStats() {
    els.score.textContent = score;
    els.streak.textContent = '×' + multiplier();
    els.best.textContent = store.get('drillBest', 0);
  }

  function tick() {
    const left = Math.max(0, endAt - Date.now());
    els.time.textContent = Math.ceil(left / 1000);
    if (left <= 0) finish();
  }

  function start() {
    running = true;
    score = 0;
    streak = 0;
    endAt = Date.now() + ROUND_MS;
    els.start.hidden = true;
    feedback('');
    renderStats();
    next();
    clearInterval(timer);
    timer = setInterval(tick, 100);
    tick();
  }

  function finish() {
    running = false;
    locked = true;
    clearInterval(timer);
    els.dial.classList.add('locked');
    const best = store.get('drillBest', 0);
    if (score > best) {
      store.set('drillBest', score);
      feedback(`New best: ${score}!`, 'good');
    } else {
      feedback(`Time! You scored ${score}. Best: ${best}.`);
    }
    els.prompt.textContent = 'Drill over';
    els.start.textContent = 'Play again';
    els.start.hidden = false;
    renderStats();
  }

  function stop() {
    if (!running) return;
    running = false;
    clearInterval(timer);
    els.start.textContent = 'Start drill';
    els.start.hidden = false;
    els.prompt.textContent = 'Tap the matching direction on the ring.';
    feedback('');
    els.time.textContent = ROUND_MS / 1000;
  }

  function init() {
    Object.assign(els, {
      dial: $('d-dial'), prompt: $('d-prompt'), feedback: $('d-feedback'), start: $('d-start'),
      time: $('d-time'), score: $('d-score'), streak: $('d-streak'), best: $('d-best'),
    });
    buildDial();
    els.dial.classList.add('locked');
    els.start.addEventListener('click', start);
    document.addEventListener('keydown', (e) => {
      // Number keys 1-8 map to N, NE, E ... NW for keyboard players.
      if (!running || location.hash !== '#drill') return;
      const n = Number(e.key);
      if (n >= 1 && n <= 8) pick(n - 1);
    });
    renderStats();
  }

  return { init, stop };
})();
