// Site chrome shared by every page: light/dark theme and the phone menu.
// Loaded in <head> without defer so the theme is set before the first paint.
// Theme: a saved choice wins, otherwise follow the system.
(function () {
  var root = document.documentElement;
  var system = matchMedia('(prefers-color-scheme: dark)');

  function saved() {
    try { return localStorage.getItem('theme'); } catch (e) { return null; }
  }

  function current() {
    return saved() || (system.matches ? 'dark' : 'light');
  }

  function apply(theme) {
    var dark = theme === 'dark';
    root.dataset.theme = theme;
    // <picture> sources can't read data-theme, so switch their media query directly.
    document.querySelectorAll('source[data-dark]').forEach(function (s) { s.media = dark ? 'all' : 'not all'; });
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.content = dark ? '#0a0a0c' : '#f6f6f8'; });
    document.querySelectorAll('.theme-toggle').forEach(function (b) { b.setAttribute('aria-pressed', String(dark)); });
  }

  apply(current());
  document.addEventListener('DOMContentLoaded', function () { apply(current()); });
  system.addEventListener('change', function () { if (!saved()) apply(current()); });

  // Phone menu: the nav links fold into a panel behind the menu button.
  function setMenu(open) {
    var nav = document.querySelector('.site-nav');
    var button = document.querySelector('.menu-toggle');
    if (!nav || !button) return;
    nav.classList.toggle('menu-open', open);
    button.setAttribute('aria-expanded', String(open));
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  document.addEventListener('click', function (e) {
    if (e.target.closest('.menu-toggle')) {
      setMenu(!document.querySelector('.site-nav').classList.contains('menu-open'));
      return;
    }
    // Following a link or tapping outside the bar closes the menu.
    if (e.target.closest('.navlinks a') || !e.target.closest('.site-nav')) setMenu(false);
    if (!e.target.closest('.theme-toggle')) return;
    var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch (err) {}
    // Swap every colour at once instead of letting some elements fade and others snap.
    root.classList.add('theme-switching');
    apply(next);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { root.classList.remove('theme-switching'); });
    });
  });
})();
