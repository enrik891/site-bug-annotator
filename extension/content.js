(() => {
  if (window.__SBA_LOADED__) return;
  window.__SBA_LOADED__ = true;

  let annotateMode = false;
  let annotationsVisible = true;
  let activeDevicePreset = { presetId: 'off', preset: null };
  let deviceFilter = 'desktop';
  let annotations = [];
  let projectKey = location.hostname;
  let hoveredElement = null;

  const outline = document.createElement('div');
  outline.id = 'sba-hover-outline';
  document.documentElement.appendChild(outline);

  const normalizeUrl = (value = location.href) => {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  };

  // Identifica la pagina indipendentemente da hash, query string e slash finale.
  // In questo modo /contatti, /contatti/ e /contatti?preview=1 condividono le stesse annotazioni.
  const pageKeyFromUrl = (value = location.href) => {
    const url = new URL(value);
    let pathname = url.pathname.replace(/\/+$/, '') || '/';
    return `${url.origin}${pathname}`;
  };

  const annotationPageKey = (annotation) => annotation.pageKey || pageKeyFromUrl(annotation.url);
  const categoryFromWidth = (width) => {
    const value = Number(width || 0);
    if (value <= 767) return 'mobile';
    if (value <= 1024) return 'tablet';
    return 'desktop';
  };

  const annotationDevice = (annotation) => annotation.device || categoryFromWidth(annotation.viewport?.width || 1440);


  function pageAnnotations() {
    const currentPageKey = pageKeyFromUrl();
    return annotations
      .filter((annotation) => annotationPageKey(annotation) === currentPageKey)
      .filter((annotation) => deviceFilter === 'all' || annotationDevice(annotation) === deviceFilter)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  const cssEscape = (value) => window.CSS?.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');

  function buildSelector(element) {
    if (!(element instanceof Element)) return '';
    if (element.id) return `#${cssEscape(element.id)}`;

    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      let part = current.tagName.toLowerCase();
      const stableClasses = [...current.classList].filter((c) => !/^(active|selected|hover|focus|open|show|is-)/i.test(c)).slice(0, 2);
      if (stableClasses.length) part += stableClasses.map((c) => `.${cssEscape(c)}`).join('');

      const parent = current.parentElement;
      if (parent) {
        const sameTag = [...parent.children].filter((child) => child.tagName === current.tagName);
        if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
      }
      parts.unshift(part);
      if (document.querySelectorAll(parts.join(' > ')).length === 1) break;
      current = parent;
    }
    return parts.join(' > ');
  }

  function elementFingerprint(element) {
    return {
      selector: buildSelector(element),
      tag: element.tagName.toLowerCase(),
      text: (element.innerText || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160),
      id: element.id || '',
      classes: [...element.classList].slice(0, 8),
      href: element.getAttribute('href') || '',
      src: element.getAttribute('src') || '',
      ariaLabel: element.getAttribute('aria-label') || ''
    };
  }

  function findElement(annotation) {
    const fp = annotation.element || {};
    if (fp.selector) {
      try {
        const exact = document.querySelector(fp.selector);
        if (exact) return exact;
      } catch {}
    }
    if (fp.id) {
      const byId = document.getElementById(fp.id);
      if (byId) return byId;
    }
    const candidates = [...document.querySelectorAll(fp.tag || '*')].slice(0, 2500);
    let best = null;
    let bestScore = 0;
    for (const candidate of candidates) {
      let score = 0;
      const text = (candidate.innerText || candidate.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160);
      if (fp.text && text === fp.text) score += 5;
      else if (fp.text && text.includes(fp.text.slice(0, 40))) score += 2;
      if (fp.href && candidate.getAttribute('href') === fp.href) score += 3;
      if (fp.src && candidate.getAttribute('src') === fp.src) score += 3;
      if (fp.ariaLabel && candidate.getAttribute('aria-label') === fp.ariaLabel) score += 2;
      score += (fp.classes || []).filter((c) => candidate.classList.contains(c)).length * 0.5;
      if (score > bestScore) { best = candidate; bestScore = score; }
    }
    return bestScore >= 2 ? best : null;
  }

  function clearPins() {
    document.querySelectorAll('.sba-pin').forEach((pin) => pin.remove());
  }

  function renderPins() {
    clearPins();
    if (!annotationsVisible) return;
    pageAnnotations().forEach((annotation, index) => {
      const element = findElement(annotation);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const pin = document.createElement('button');
      pin.className = 'sba-pin';
      pin.type = 'button';
      pin.dataset.id = annotation.id;
      pin.dataset.status = annotation.status;
      pin.textContent = String(index + 1);
      pin.title = annotation.comment;
      pin.style.left = `${window.scrollX + rect.right - 13}px`;
      pin.style.top = `${window.scrollY + rect.top - 13}px`;
      pin.addEventListener('click', (event) => {
        event.preventDefault(); event.stopPropagation();
        chrome.runtime.sendMessage({ type: 'SBA_FOCUS_ANNOTATION', id: annotation.id });
      });
      document.documentElement.appendChild(pin);
    });
  }

  function showToast(text) {
    document.getElementById('sba-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'sba-toast';
    toast.textContent = text;
    document.documentElement.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  const isOwnNode = (element) => !element
    || element.closest?.('.sba-pin')
    || element.id === 'sba-hover-outline'
    || element.id === COMPOSER_HOST_ID;

  function elementLabel(element) {
    let label = element.tagName.toLowerCase();
    if (element.id) label += `#${element.id}`;
    else if (element.classList.length) label += `.${[...element.classList].slice(0, 2).join('.')}`;
    return label.length > 48 ? `${label.slice(0, 47)}…` : label;
  }

  function updateOutline(element) {
    if (isOwnNode(element)) {
      outline.style.display = 'none'; return;
    }
    const rect = element.getBoundingClientRect();
    outline.dataset.label = elementLabel(element);
    Object.assign(outline.style, {
      display: 'block', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`
    });
  }

  function setAnnotateMode(enabled) {
    annotateMode = Boolean(enabled);
    document.documentElement.classList.toggle('sba-annotating', annotateMode);
    outline.style.display = 'none';
    if (!annotateMode) closeComposer(null);
  }

  /* ---------- Composer: finestra di commento in stile Atlassian (Shadow DOM) ---------- */
  const COMPOSER_HOST_ID = 'sba-composer-host';
  let composer = null;

  function closeComposer(value) {
    if (!composer) return;
    const { host, resolve } = composer;
    composer = null;
    host.remove();
    outline.style.display = 'none';
    resolve(value);
  }

  function openComposer(element) {
    closeComposer(null);
    return new Promise((resolve) => {
      const host = document.createElement('div');
      host.id = COMPOSER_HOST_ID;
      host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; left: 0; top: 0;';
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>
          :host { all: initial; }
          * { box-sizing: border-box; }
          .box {
            position: fixed; width: 320px; padding: 16px; border-radius: 12px;
            background: #FFFFFF; color: #172B4D;
            font: 400 14px/20px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Ubuntu, sans-serif;
            box-shadow: 0 8px 12px rgba(9,30,66,.15), 0 0 1px rgba(9,30,66,.31);
            animation: in .18s cubic-bezier(.15,1,.3,1);
            cursor: default;
          }
          @keyframes in { from { opacity: 0; transform: translateY(6px); } }
          .head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
          .dot { width: 24px; height: 24px; flex: 0 0 24px; border-radius: 50% 50% 50% 4px; background: #C9372C; color: #FFF; display: flex; align-items: center; justify-content: center; font: 700 11px/1 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          .title { font-weight: 600; font-size: 14px; }
          .target { margin: 0 0 12px 32px; color: #626F86; font: 400 12px/16px ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          textarea {
            display: block; width: 100%; min-height: 84px; max-height: 240px; resize: vertical; padding: 8px;
            border: 1px solid #8590A2; border-radius: 6px; outline: none; background: #FFFFFF; color: #172B4D;
            font: 400 14px/20px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; cursor: text;
          }
          textarea:hover { background: #F7F8F9; }
          textarea:focus { border-color: #388BFF; box-shadow: inset 0 0 0 1px #388BFF; background: #FFFFFF; }
          textarea::placeholder { color: #626F86; }
          .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; }
          .hint { color: #626F86; font-size: 11px; line-height: 16px; white-space: nowrap; }
          kbd { font: inherit; padding: 0 4px; border-radius: 3px; background: #091E420F; }
          .btns { display: flex; gap: 8px; }
          button {
            height: 32px; padding: 0 12px; border: 0; border-radius: 4px; cursor: pointer;
            font: 500 14px/20px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #44546F; background: transparent;
          }
          button:hover { background: #091E420F; }
          button:focus-visible { outline: 2px solid #388BFF; outline-offset: 2px; }
          button.primary { color: #FFFFFF; background: #0C66E4; }
          button.primary:hover { background: #0055CC; }
          button.primary:disabled { color: #091E424F; background: #091E420F; cursor: not-allowed; }
          @media (prefers-color-scheme: dark) {
            .box { background: #282E33; color: #B6C2CF; box-shadow: 0 0 0 1px #BCD6F00A, 0 8px 12px #0304045C, 0 0 1px #03040480; }
            .target, .hint, textarea::placeholder { color: #8C9BAB; }
            textarea { background: #22272B; color: #B6C2CF; border-color: #738496; }
            textarea:hover { background: #282E33; }
            textarea:focus { background: #22272B; border-color: #85B8FF; box-shadow: inset 0 0 0 1px #85B8FF; }
            kbd { background: #A1BDD914; }
            button { color: #9FADBC; }
            button:hover { background: #A1BDD914; }
            button.primary { color: #1D2125; background: #579DFF; }
            button.primary:hover { background: #85B8FF; }
            button.primary:disabled { color: #BFDBF847; background: #A1BDD914; }
          }
        </style>
        <div class="box" role="dialog" aria-label="Nuova segnalazione">
          <div class="head"><span class="dot">${pageAnnotations().length + 1}</span><span class="title">Nuova segnalazione</span></div>
          <div class="target"></div>
          <textarea placeholder="Descrivi la modifica da fare…" aria-label="Descrizione"></textarea>
          <div class="foot">
            <span class="hint"><kbd>${/Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl'}</kbd> <kbd>Invio</kbd></span>
            <div class="btns"><button type="button" class="cancel">Annulla</button><button type="button" class="primary save" disabled>Aggiungi</button></div>
          </div>
        </div>`;

      const box = root.querySelector('.box');
      const textarea = root.querySelector('textarea');
      const save = root.querySelector('.save');
      root.querySelector('.target').textContent = elementLabel(element);

      const submit = () => { const value = textarea.value.trim(); if (value) closeComposer(value); };
      textarea.addEventListener('input', () => { save.disabled = !textarea.value.trim(); });
      save.addEventListener('click', submit);
      root.querySelector('.cancel').addEventListener('click', () => closeComposer(null));
      textarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit(); }
        if (event.key === 'Escape') { event.preventDefault(); closeComposer(null); }
      });
      // Evita che le scorciatoie da tastiera del sito intercettino ciò che si digita.
      ['keydown', 'keyup', 'keypress', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click', 'focusin', 'wheel']
        .forEach((type) => host.addEventListener(type, (event) => event.stopPropagation()));

      document.documentElement.appendChild(host);
      composer = { host, resolve, element };

      // Posiziona la finestra sotto l'elemento, oppure sopra se non c'è spazio.
      const rect = element.getBoundingClientRect();
      const width = 320;
      const height = box.offsetHeight || 220;
      const margin = 12;
      let left = Math.min(Math.max(margin, rect.left), innerWidth - width - margin);
      let top = rect.bottom + 10;
      if (top + height > innerHeight - margin) top = rect.top - height - 10;
      if (top < margin) top = Math.min(Math.max(margin, innerHeight / 2 - height / 2), innerHeight - height - margin);
      box.style.left = `${Math.max(margin, left)}px`;
      box.style.top = `${Math.max(margin, top)}px`;
      updateOutline(element);
      setTimeout(() => textarea.focus(), 0);
    });
  }

  document.addEventListener('mousemove', (event) => {
    if (!annotateMode || composer) return;
    hoveredElement = event.target;
    updateOutline(hoveredElement);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (!annotateMode || composer || event.key !== 'Escape') return;
    setAnnotateMode(false);
    showToast('Modalità annotazione disattivata');
    chrome.runtime.sendMessage({ type: 'SBA_DATA_CHANGED' });
  }, true);

  document.addEventListener('click', async (event) => {
    if (!annotateMode) return;
    const element = event.target;
    if (!(element instanceof Element) || element.closest('.sba-pin') || element.id === COMPOSER_HOST_ID) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();

    const comment = await openComposer(element);
    if (!comment?.trim()) return;

    const rect = element.getBoundingClientRect();
    const annotation = {
      id: crypto.randomUUID(),
      projectKey,
      url: normalizeUrl(),
      pageKey: pageKeyFromUrl(),
      path: location.pathname,
      title: document.title,
      comment: comment.trim(),
      status: 'todo',
      priority: 'normal',
      element: elementFingerprint(element),
      device: categoryFromWidth(innerWidth),
      viewport: { width: innerWidth, height: innerHeight, presetId: activeDevicePreset.presetId, preset: activeDevicePreset.preset },
      position: {
        x: (rect.left + rect.width / 2) / Math.max(1, innerWidth),
        y: (rect.top + rect.height / 2) / Math.max(1, innerHeight)
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    annotations.push(annotation);
    await saveAnnotations();
    renderPins();
    chrome.runtime.sendMessage({ type: 'SBA_DATA_CHANGED' });
    showToast('Segnalazione aggiunta');
  }, true);

  window.addEventListener('scroll', () => requestAnimationFrame(renderPins), { passive: true });
  window.addEventListener('resize', () => requestAnimationFrame(renderPins));

  async function saveAnnotations() {
    await chrome.storage.local.set({ [`annotations:${projectKey}`]: annotations });
  }

  async function load() {
    const stored = await chrome.storage.local.get([`annotations:${projectKey}`, 'sbaAnnotationsVisible', 'sbaDevicePreset', 'sbaDeviceFilter']);
    annotations = stored[`annotations:${projectKey}`] || [];
    annotationsVisible = stored.sbaAnnotationsVisible !== false;
    activeDevicePreset = { presetId: stored.sbaDevicePreset || 'off', preset: null };
    deviceFilter = stored.sbaDeviceFilter || 'desktop';
    renderPins();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      if (message.type === 'SBA_GET_CONTEXT') {
        sendResponse({ projectKey, url: normalizeUrl(), pageKey: pageKeyFromUrl(), title: document.title, annotations, annotateMode, annotationsVisible, deviceFilter });
      }
      if (message.type === 'SBA_SET_MODE') {
        setAnnotateMode(message.enabled);
        showToast(annotateMode ? 'Clicca un elemento da segnalare · Esc per uscire' : 'Modalità annotazione disattivata');
        sendResponse({ ok: true });
      }
      if (message.type === 'SBA_SET_VISIBILITY') {
        annotationsVisible = Boolean(message.visible);
        await chrome.storage.local.set({ sbaAnnotationsVisible: annotationsVisible });
        if (!annotationsVisible) setAnnotateMode(false);
        renderPins();
        showToast(annotationsVisible ? 'Annotazioni visibili' : 'Annotazioni nascoste');
        sendResponse({ ok: true });
      }
      if (message.type === 'SBA_SET_DEVICE_PRESET') {
        activeDevicePreset = { presetId: message.presetId || 'off', preset: message.preset || null };
        renderPins();
        sendResponse({ ok: true });
      }
      if (message.type === 'SBA_SET_DEVICE_FILTER') {
        deviceFilter = message.filter || 'all';
        await chrome.storage.local.set({ sbaDeviceFilter: deviceFilter });
        renderPins();
        sendResponse({ ok: true });
      }
      if (message.type === 'SBA_REFRESH') {
        await load();
        sendResponse({ ok: true });
      }
      if (message.type === 'SBA_SCROLL_TO') {
        // Ricarica i dati e ridisegna i pin prima di cercare la segnalazione.
        // È necessario quando il comando arriva subito dopo un cambio pagina.
        await load();
        const annotation = annotations.find((a) => a.id === message.id);
        const element = annotation && findElement(annotation);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          renderPins();

          const pin = document.querySelector(`.sba-pin[data-id="${message.id}"]`);
          const oldOutline = element.style.outline;
          const oldOffset = element.style.outlineOffset;
          element.style.outline = '3px solid #388BFF';
          element.style.outlineOffset = '3px';

          if (pin) {
            pin.animate([
              { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(12, 102, 228, .55)' },
              { transform: 'scale(1.35)', boxShadow: '0 0 0 12px rgba(12, 102, 228, 0)' },
              { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(12, 102, 228, 0)' }
            ], { duration: 1200, iterations: 2 });
          }

          setTimeout(() => {
            element.style.outline = oldOutline;
            element.style.outlineOffset = oldOffset;
          }, 2400);
        }
        sendResponse({ ok: Boolean(element) });
      }
    })();
    return true;
  });

  // Rileva anche la navigazione delle single-page app, dove Chrome non ricarica il content script.
  let lastPageKey = pageKeyFromUrl();
  const checkPageChange = () => {
    const nextPageKey = pageKeyFromUrl();
    if (nextPageKey === lastPageKey) return;
    lastPageKey = nextPageKey;
    outline.style.display = 'none';
    closeComposer(null);
    renderPins();
    chrome.runtime.sendMessage({ type: 'SBA_PAGE_CHANGED' });
  };

  window.addEventListener('popstate', () => setTimeout(checkPageChange, 0));
  window.addEventListener('hashchange', () => setTimeout(checkPageChange, 0));
  setInterval(checkPageChange, 500);

  load();
})();
