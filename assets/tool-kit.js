// Small helpers shared by the tool pages. Everything runs locally; nothing is uploaded.
(function () {
  // Copy text to the clipboard and confirm on the button that asked for it.
  async function copy(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      flash(button, 'Copied');
    } catch {
      flash(button, 'Select and copy');
    }
  }

  function flash(button, label) {
    if (!button) return;
    const original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    button.textContent = label;
    clearTimeout(button._flash);
    button._flash = setTimeout(() => (button.textContent = original), 1600);
  }

  // Save a Blob, data URL or string as a file.
  function download(data, filename, type = 'text/plain') {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = typeof data === 'string' && data.startsWith('data:') ? data : URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    if (url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Read an image File into an <img> element.
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('That file could not be read as an image.'));
      img.src = url;
    });
  }

  function canvasToBlob(canvas, type = 'image/png', quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  // Wire a .drop zone (containing an <input type="file">) to a callback.
  function dropZone(zone, onFiles) {
    const input = zone.querySelector('input[type="file"]');
    zone.addEventListener('click', (e) => { if (e.target !== input) input.click(); });
    input.addEventListener('change', () => input.files.length && onFiles([...input.files]));
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('over');
      if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]);
    });
  }

  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function debounce(fn, ms = 150) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }
  const fmt = (n, digits = 0) => Number(n).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  // Any button with data-copy-from="#id" copies that element's value or text.
  document.addEventListener('click', (e) => {
    const button = e.target.closest('[data-copy-from]');
    if (!button) return;
    const el = document.querySelector(button.dataset.copyFrom);
    if (el) copy('value' in el ? el.value : el.innerText, button);
  });

  window.XTool = { copy, flash, download, loadImage, canvasToBlob, dropZone, pick, shuffle, debounce, fmt, escapeHtml };
})();
