// Small localStorage wrapper that never throws (private mode, blocked storage, etc.)
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem('cm:' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem('cm:' + key, JSON.stringify(value)); } catch {}
  },
};

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const pointLabel = (i) => `${POINTS[i]} ${i * 45}°`;
