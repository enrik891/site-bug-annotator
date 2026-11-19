let tabId = null;
let context = null;
let filter = 'all';
let annotateMode = false;
let annotationsVisible = true;
let pendingAnnotationId = null;
let devicePresetId = 'off';
let deviceFilter = 'desktop';

const list = document.getElementById('list');
const empty = document.getElementById('empty');
const emptyTitle = document.getElementById('emptyTitle');
const emptyText = document.getElementById('emptyText');
const siteName = document.getElementById('siteName');
const toggleMode = document.getElementById('toggleMode');
const toggleModeLabel = document.getElementById('toggleModeLabel');
const toggleVisibility = document.getElementById('toggleVisibility');
const visibilityLabel = document.getElementById('visibilityLabel');
const modeHint = document.getElementById('modeHint');
const devicePreset = document.getElementById('devicePreset');
const deviceStatus = document.getElementById('deviceStatus');
document.getElementById('appVersion').textContent = `v${chrome.runtime.getManifest().version}`;

/* ---------- Icone (stile line, 24×24) ---------- */
const svg = (body, cls = 'icon icon-sm') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  success: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>',
  error: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  desktop: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  tablet: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/>',
  mobile: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>'
};

/* ---------- Flag (notifiche in stile Atlassian) ---------- */
function flag({ type = 'info', title, text = '', action = null, timeout = 4500 }) {
  const container = document.getElementById('flags');
  const node = document.createElement('div');
  node.className = `flag flag-${type}`;
  node.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const iconName = type === 'success' ? 'success' : type === 'error' ? 'error' : 'info';
  node.innerHTML = `${svg(ICONS[iconName], 'icon')}<div class="flagBody"><div class="flagTitle">${escapeHtml(title)}</div>${text ? `<div class="flagText">${escapeHtml(text)}</div>` : ''}</div>`;
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'flagAction';
    button.textContent = action.label;
    button.addEventListener('click', () => { action.onClick(); dismiss(); });
    node.querySelector('.flagBody').appendChild(button);
  }
  container.appendChild(node);
  let timer = setTimeout(dismiss, timeout);
  node.addEventListener('mouseenter', () => clearTimeout(timer));
  node.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 1500); });
  function dismiss() {
    if (!node.isConnected) return;
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 200);
  }
}

/* ---------- Modale di conferma ---------- */
const confirmDialog = document.getElementById('confirmDialog');
function confirmAction({ title, text, okLabel = 'Conferma' }) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmText').textContent = text;
  document.getElementById('confirmOk').textContent = okLabel;
  return new Promise((resolve) => {
    confirmDialog.addEventListener('close', () => resolve(confirmDialog.returnValue === 'ok'), { once: true });
    confirmDialog.returnValue = '';
    confirmDialog.showModal();
  });
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function send(message) {
  if (!tabId) return null;
  try { return await chrome.tabs.sendMessage(tabId, message); }
  catch { return null; }
}

const DEVICE_LABELS = {
  off: 'La pagina usa la larghezza reale della finestra',
  desktop1440: 'Desktop 1440 × 900 · la finestra si adatta alla larghezza',
  tablet768: 'Tablet 768 × 1024 · la finestra si adatta alla larghezza',
  mobile390: 'Mobile 390 × 844 · la finestra si adatta alla larghezza'
};

function categoryFromWidth(width) {
  const value = Number(width || 0);
  if (value <= 767) return 'mobile';
  if (value <= 1024) return 'tablet';
  return 'desktop';
}

function categoryFromPreset(presetId) {
  if (presetId === 'mobile390') return 'mobile';
  if (presetId === 'tablet768') return 'tablet';
  if (presetId === 'desktop1440') return 'desktop';
  return null;
}

function annotationDevice(annotation) {
  return annotation.device || categoryFromWidth(annotation.viewport?.width || 1440);
}

function updateDeviceFilterUi() {
  document.querySelectorAll('[data-device-filter]').forEach((button) => {
    const active = button.dataset.deviceFilter === deviceFilter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

async function setDeviceFilter(nextFilter) {
  deviceFilter = nextFilter || 'all';
  await chrome.storage.local.set({ sbaDeviceFilter: deviceFilter });
  updateDeviceFilterUi();
  await send({ type: 'SBA_SET_DEVICE_FILTER', filter: deviceFilter });
  render();
}

function updateDeviceUi() {
  devicePreset.value = devicePresetId;
  deviceStatus.textContent = DEVICE_LABELS[devicePresetId] || DEVICE_LABELS.off;
  deviceStatus.classList.toggle('is-active', devicePresetId !== 'off');
}

async function loadDevicePreset() {
  const response = await chrome.runtime.sendMessage({ type: 'SBA_GET_DEVICE_PRESET' });
  devicePresetId = response?.presetId || 'off';
  updateDeviceUi();
}

async function applyDevicePreset(presetId) {
  if (!tabId) return false;
  devicePreset.disabled = true;
  deviceStatus.textContent = presetId === 'off' ? 'Ripristino vista…' : 'Applicazione vista…';
  const screenInfo = { availLeft: screen.availLeft, availTop: screen.availTop, availWidth: screen.availWidth, availHeight: screen.availHeight };
  const response = await chrome.runtime.sendMessage({ type: 'SBA_APPLY_DEVICE_PRESET', tabId, presetId, screen: screenInfo });
  devicePreset.disabled = false;
  if (!response?.ok) {
    flag({ type: 'error', title: 'Impossibile applicare la vista', text: response?.error || 'Errore sconosciuto.' });
    updateDeviceUi();
    return false;
  }
  devicePresetId = response.presetId;
  updateDeviceUi();
  await send({ type: 'SBA_SET_DEVICE_PRESET', presetId: devicePresetId, preset: response.preset || null });
  const matchingFilter = categoryFromPreset(devicePresetId);
  if (matchingFilter) await setDeviceFilter(matchingFilter);
  setTimeout(refresh, 250);
  return true;
}

async function refresh() {
  const tab = await activeTab();
  tabId = tab?.id;
  if (!devicePreset.dataset.loaded) {
    await loadDevicePreset();
    const stored = await chrome.storage.local.get('sbaDeviceFilter');
    deviceFilter = stored.sbaDeviceFilter || categoryFromPreset(devicePresetId) || 'desktop';
    updateDeviceFilterUi();
    devicePreset.dataset.loaded = 'true';
  }
  context = await send({ type: 'SBA_GET_CONTEXT' });
  if (!context) {
    siteName.textContent = 'Pagina non supportata';
    toggleMode.disabled = true;
    list.innerHTML = '';
    updateCounts([]);
    showEmpty('Pagina non supportata', 'Apri un sito web. Se l\'estensione è appena stata installata, ricarica la scheda.');
    return;
  }
  toggleMode.disabled = false;
  siteName.textContent = context.projectKey;
  annotateMode = Boolean(context.annotateMode);
  annotationsVisible = context.annotationsVisible !== false;
  updateModeUi();
  render();
}

function deviceScopedAnnotations() {
  return (context?.annotations || []).filter((a) => deviceFilter === 'all' || annotationDevice(a) === deviceFilter);
}

function visibleAnnotations() {
  return deviceScopedAnnotations()
    .filter((a) => filter === 'all' || a.status === filter)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function pageKeyFromUrl(value) {
  try {
    const url = new URL(value);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    return `${url.origin}${pathname}`;
  } catch { return value || ''; }
}

function annotationPageKey(annotation) {
  return annotation.pageKey || pageKeyFromUrl(annotation.url);
}

function annotationNumbers() {
  const groups = new Map();
  for (const annotation of deviceScopedAnnotations()) {
    const key = annotationPageKey(annotation);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(annotation);
  }
  const numbers = new Map();
  for (const annotations of groups.values()) {
    annotations
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .forEach((annotation, index) => numbers.set(annotation.id, index + 1));
  }
  return numbers;
}

function updateModeUi() {
  toggleModeLabel.textContent = annotateMode ? 'Termina' : 'Segnala';
  toggleMode.querySelector('svg').innerHTML = annotateMode ? ICONS.close : ICONS.plus;
  toggleMode.classList.toggle('is-active', annotateMode);
  toggleMode.setAttribute('aria-pressed', String(annotateMode));
  toggleVisibility.checked = annotationsVisible;
  visibilityLabel.textContent = annotationsVisible ? 'Pin visibili' : 'Pin nascosti';
  modeHint.textContent = annotateMode ? 'Inserimento' : (annotationsVisible ? 'Consultazione' : 'Navigazione pulita');
  modeHint.classList.toggle('is-insert', annotateMode);
  modeHint.classList.toggle('is-hidden', !annotateMode && !annotationsVisible);
}

const DEVICE_NAMES = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' };

function updateCounts(scoped) {
  const counts = {
    all: scoped.length,
    todo: scoped.filter((a) => a.status !== 'done').length,
    done: scoped.filter((a) => a.status === 'done').length
  };
  document.querySelectorAll('[data-count]').forEach((node) => { node.textContent = counts[node.dataset.count]; });
}

function showEmpty(title, html) {
  emptyTitle.textContent = title;
  emptyText.innerHTML = html;
  empty.hidden = false;
}

function render() {
  const scoped = deviceScopedAnnotations();
  updateCounts(scoped);
  const items = visibleAnnotations();
  const numbers = annotationNumbers();

  if (!items.length) {
    if (!scoped.length) showEmpty('Nessuna segnalazione', 'Premi <strong>Segnala</strong> e clicca un elemento della pagina per aggiungere la prima nota.');
    else if (filter === 'done') showEmpty('Niente di completato', 'Le segnalazioni segnate come fatte compariranno qui.');
    else showEmpty('Tutto risolto', 'Non ci sono segnalazioni aperte con questi filtri. Ottimo lavoro!');
  } else {
    empty.hidden = true;
  }

  list.innerHTML = items.map((a) => {
    const done = a.status === 'done';
    const device = annotationDevice(a);
    const tag = a.element?.tag ? `<span class="metaItem">${svg(ICONS.code)}<code>${escapeHtml(a.element.tag)}</code></span>` : '';
    return `
    <article class="card ${done ? 'done' : ''}" data-id="${escapeHtml(a.id)}">
      <div class="cardTop">
        <div class="commentWrap">
          <span class="annotationNumber">${numbers.get(a.id) || '?'}</span>
          <div class="comment">${escapeHtml(a.comment)}</div>
        </div>
        <span class="lozenge ${done ? 'lozenge-success' : 'lozenge-danger'}">${done ? 'Fatto' : 'Da fare'}</span>
      </div>
      <div class="meta">
        <span class="metaItem" title="${escapeHtml(a.url)}">${svg(ICONS.file)}<span>${escapeHtml(a.path || a.url)}</span></span>
        ${tag}
        <span class="metaItem">${svg(ICONS[device] || ICONS.desktop)}<span>${DEVICE_NAMES[device] || 'Desktop'}</span></span>
      </div>
      <div class="actions">
        <button class="btn btn-subtle btn-compact" data-action="open" type="button" title="Mostra l'elemento nella pagina">${svg(ICONS.target)}Mostra</button>
        <button class="btn btn-subtle btn-compact" data-action="toggle" type="button">${done ? `${svg(ICONS.undo)}Riapri` : `${svg(ICONS.check)}Fatto`}</button>
        <span class="spacer"></span>
        <button class="btn btn-subtle btn-compact btn-icon btn-dangerHover" data-action="delete" type="button" title="Elimina" aria-label="Elimina segnalazione">${svg(ICONS.trash)}</button>
      </div>
    </article>`;
  }).join('');
}

async function saveAnnotations(items) {
  await chrome.storage.local.set({ [`annotations:${context.projectKey}`]: items });
  context.annotations = items;
  await send({ type: 'SBA_REFRESH' });
  render();
}

list.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  const card = event.target.closest('.card');
  if (!button || !card) return;
  const annotation = context.annotations.find((a) => a.id === card.dataset.id);
  if (!annotation) return;

  if (button.dataset.action === 'open') {
    pendingAnnotationId = annotation.id;
    const annotationPreset = annotation.viewport?.presetId;
    if (annotationPreset && annotationPreset !== devicePresetId) await applyDevicePreset(annotationPreset);
    const currentPageKey = pageKeyFromUrl(context.url);
    const targetPageKey = annotationPageKey(annotation);

    if (targetPageKey !== currentPageKey) {
      await chrome.tabs.update(tabId, { url: annotation.url });
    } else {
      const found = await focusPendingAnnotation();
      if (!found) flag({ type: 'info', title: 'Elemento non trovato', text: 'La pagina potrebbe essere cambiata dopo la segnalazione.' });
    }
  }

  if (button.dataset.action === 'toggle') {
    annotation.status = annotation.status === 'done' ? 'todo' : 'done';
    annotation.updatedAt = new Date().toISOString();
    await saveAnnotations(context.annotations);
  }

  if (button.dataset.action === 'delete') {
    const ok = await confirmAction({
      title: 'Eliminare la segnalazione?',
      text: 'La segnalazione e il suo pin verranno rimossi definitivamente da questo browser.',
      okLabel: 'Elimina'
    });
    if (ok) {
      await saveAnnotations(context.annotations.filter((a) => a.id !== annotation.id));
      flag({ type: 'success', title: 'Segnalazione eliminata', timeout: 2500 });
    }
  }

});

async function focusPendingAnnotation() {
  if (!pendingAnnotationId) return false;

  // Le pagine dinamiche possono costruire il DOM dopo l'evento "complete".
  // Ritenta per alcuni secondi prima di considerare l'elemento non disponibile.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await send({ type: 'SBA_SCROLL_TO', id: pendingAnnotationId });
    if (response?.ok) {
      highlightCard(pendingAnnotationId);
      pendingAnnotationId = null;
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  pendingAnnotationId = null;
  return false;
}

function highlightCard(id) {
  const card = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('is-focused');
  setTimeout(() => card.classList.remove('is-focused'), 1800);
}

toggleMode.addEventListener('click', async () => {
  annotateMode = !annotateMode;
  // Durante l'inserimento i pin restano visibili per evitare segnalazioni duplicate.
  if (annotateMode && !annotationsVisible) {
    annotationsVisible = true;
    await send({ type: 'SBA_SET_VISIBILITY', visible: true });
  }
  await send({ type: 'SBA_SET_MODE', enabled: annotateMode });
  updateModeUi();
});

toggleVisibility.addEventListener('change', async () => {
  annotationsVisible = toggleVisibility.checked;
  // Nascondere i pin interrompe anche la modalità di inserimento.
  if (!annotationsVisible && annotateMode) {
    annotateMode = false;
    await send({ type: 'SBA_SET_MODE', enabled: false });
  }
  await send({ type: 'SBA_SET_VISIBILITY', visible: annotationsVisible });
  updateModeUi();
});

devicePreset.addEventListener('change', async () => {
  const previous = devicePresetId;
  const next = devicePreset.value;
  const ok = await applyDevicePreset(next);
  if (!ok) { devicePresetId = previous; updateDeviceUi(); }
});

document.querySelector('.statusFilters').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-filter]');
  if (!button) return;
  filter = button.dataset.filter;
  document.querySelectorAll('.statusFilters button').forEach((b) => {
    b.classList.toggle('active', b === button);
    b.setAttribute('aria-selected', String(b === button));
  });
  render();
});

document.getElementById('deviceFilters').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-device-filter]');
  if (!button) return;
  await setDeviceFilter(button.dataset.deviceFilter);
});

document.getElementById('exportBtn').addEventListener('click', () => {
  if (!context) return;
  const payload = { schemaVersion: 1, projectKey: context.projectKey, exportedAt: new Date().toISOString(), annotations: context.annotations };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${context.projectKey}-bug-annotations.json`; a.click();
  URL.revokeObjectURL(url);
  flag({ type: 'success', title: 'Esportazione completata', text: `${context.annotations.length} segnalazioni salvate in JSON.`, timeout: 3000 });
});

document.getElementById('importInput').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file || !context) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.annotations)) throw new Error('Formato non valido');
    const map = new Map(context.annotations.map((a) => [a.id, a]));
    data.annotations.forEach((a) => map.set(a.id, a));
    await saveAnnotations([...map.values()]);
    flag({ type: 'success', title: 'Importazione completata', text: `Importate ${data.annotations.length} segnalazioni.` });
  } catch (error) {
    flag({ type: 'error', title: 'Importazione fallita', text: error.message });
  }
  event.target.value = '';
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SBA_DATA_CHANGED' || message.type === 'SBA_PAGE_CHANGED') refresh();
  if (message.type === 'SBA_FOCUS_ANNOTATION') highlightCard(message.id);
  if (message.type === 'SBA_DEVICE_RESET') {
    devicePresetId = 'off';
    updateDeviceUi();
    send({ type: 'SBA_SET_DEVICE_PRESET', presetId: 'off', preset: null });
  }
});

chrome.tabs.onActivated.addListener(refresh);
chrome.tabs.onUpdated.addListener((id, info) => {
  if (id !== tabId || info.status !== 'complete') return;
  setTimeout(async () => {
    await refresh();
    await focusPendingAnnotation();
  }, 250);
});
refresh();
