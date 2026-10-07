// Hash router: #home, #drill, #harbor
(() => {
  const views = ['home', 'drill', 'harbor'];

  function route() {
    const name = views.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
    if (name !== 'drill') Drill.stop();
    if (name !== 'harbor') Harbor.closePlayer();
    views.forEach((v) => (document.getElementById(v).hidden = v !== name));
    document.querySelectorAll('.topbar nav a').forEach((a) =>
      a.classList.toggle('active', a.getAttribute('href') === '#' + name));
    if (name === 'home') { renderBests(); Harbor.resetEast(); }
    window.scrollTo(0, 0);
  }

  function renderBests() {
    const drill = store.get('drillBest', 0);
    document.querySelector('[data-best="drill"]').textContent = drill ? `Best score: ${drill}` : '';
  }

  Drill.init();
  Harbor.init();
  window.addEventListener('hashchange', route);
  route();
})();
