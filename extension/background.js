const DEVICE_PRESETS = {
  off: null,
  desktop1440: { id: 'desktop1440', label: 'Desktop 1440 × 900', width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, touch: false },
  tablet768: { id: 'tablet768', label: 'Tablet 768 × 1024', width: 768, height: 1024, deviceScaleFactor: 2, mobile: true, touch: true },
  mobile390: { id: 'mobile390', label: 'Mobile 390 × 844', width: 390, height: 844, deviceScaleFactor: 3, mobile: true, touch: true }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const boundsKey = (windowId) => `sbaWindowBounds:${windowId}`;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'SBA_APPLY_DEVICE_PRESET') {
    applyDevicePreset(message.tabId, message.presetId, message.screen)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'SBA_GET_DEVICE_PRESET') {
    chrome.storage.local.get('sbaDevicePreset').then(({ sbaDevicePreset = 'off' }) => {
      sendResponse({ ok: true, presetId: sbaDevicePreset, preset: DEVICE_PRESETS[sbaDevicePreset] || null });
    });
    return true;
  }
});

async function isAttached(tabId) {
  const targets = await chrome.debugger.getTargets();
  return targets.some((target) => target.tabId === tabId && target.attached);
}

async function attach(tabId) {
  if (!(await isAttached(tabId))) await chrome.debugger.attach({ tabId }, '1.3');
}

async function detach(tabId) {
  if (await isAttached(tabId)) await chrome.debugger.detach({ tabId });
}

/* ---------- Finestra: adatta la larghezza al dispositivo e ripristina dopo ---------- */

async function saveOriginalBounds(win) {
  const key = boundsKey(win.id);
  const stored = await chrome.storage.session.get(key);
  if (stored[key]) return stored[key];
  const bounds = { left: win.left, top: win.top, width: win.width, height: win.height, state: win.state };
  await chrome.storage.session.set({ [key]: bounds });
  return bounds;
}

async function restoreWindow(windowId) {
  const key = boundsKey(windowId);
  const { [key]: bounds } = await chrome.storage.session.get(key);
  if (!bounds) return;
  await chrome.storage.session.remove(key);
  try {
    if (bounds.state === 'maximized') {
      await chrome.windows.update(windowId, { state: 'maximized' });
    } else {
      await chrome.windows.update(windowId, { state: 'normal', left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height });
    }
  } catch { /* La finestra può essere stata chiusa. */ }
}

// Rende l'area della pagina larga quanto il dispositivo, così il sito non resta
// schiacciato a sinistra con uno spazio vuoto a destra. La finestra viene centrata
// sulla posizione originale e non supera lo schermo disponibile.
async function fitWindowToPreset(tab, preset, screenInfo) {
  const win = await chrome.windows.get(tab.windowId);
  if (win.state === 'fullscreen' || !tab.width) return;
  const original = await saveOriginalBounds(win);

  const chromeWidth = Math.max(0, win.width - tab.width); // pannello laterale, bordi, ecc.
  const availLeft = Number.isFinite(screenInfo?.availLeft) ? screenInfo.availLeft : original.left;
  const availWidth = screenInfo?.availWidth || Math.max(original.width, preset.width + chromeWidth);
  const width = Math.min(preset.width + chromeWidth, availWidth);
  const centered = Math.round(original.left + (original.width - width) / 2);
  const left = Math.min(Math.max(availLeft, centered), availLeft + availWidth - width);

  if (win.state !== 'normal') await chrome.windows.update(win.id, { state: 'normal' });
  await chrome.windows.update(win.id, { left, width });
  await wait(220);
}

/* ---------- Emulazione tramite Chrome DevTools Protocol ---------- */

async function applyMetrics(tabId, preset) {
  const tab = await chrome.tabs.get(tabId);
  const viewWidth = tab.width || preset.width;
  const viewHeight = tab.height || preset.height;
  // Se lo schermo è troppo stretto (es. Desktop 1440 su un portatile), riduce in scala invece di tagliare.
  const scale = viewWidth < preset.width ? viewWidth / preset.width : 1;
  const params = {
    width: preset.width,
    height: Math.round(viewHeight / scale),
    deviceScaleFactor: preset.deviceScaleFactor,
    mobile: preset.mobile,
    screenWidth: preset.width,
    screenHeight: preset.height,
    positionX: 0,
    positionY: 0,
    dontSetVisibleSize: false
  };
  if (scale < 1) params.scale = scale;

  await attach(tabId);
  await chrome.debugger.sendCommand({ tabId }, 'Emulation.setDeviceMetricsOverride', params);
  await chrome.debugger.sendCommand({ tabId }, 'Emulation.setTouchEmulationEnabled', {
    enabled: preset.touch,
    maxTouchPoints: preset.touch ? 5 : 1
  });
}

async function clearEmulation(tabId) {
  try {
    if (await isAttached(tabId)) {
      await chrome.debugger.sendCommand({ tabId }, 'Emulation.clearDeviceMetricsOverride');
      await chrome.debugger.sendCommand({ tabId }, 'Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  } finally {
    await detach(tabId).catch(() => {});
  }
}

async function applyDevicePreset(tabId, presetId, screenInfo) {
  if (!Number.isInteger(tabId)) throw new Error('Scheda non disponibile.');
  const preset = DEVICE_PRESETS[presetId] || null;
  const tab = await chrome.tabs.get(tabId);

  if (!preset) {
    try {
      await clearEmulation(tabId);
      await restoreWindow(tab.windowId);
    } finally {
      await chrome.storage.local.set({ sbaDevicePreset: 'off' });
    }
    return { presetId: 'off', preset: null };
  }

  // Prima toglie le metriche emulate per leggere la dimensione reale della scheda
  // (senza scollegare il debugger, per non far comparire e sparire la barra di Chrome).
  if (await isAttached(tabId)) {
    await chrome.debugger.sendCommand({ tabId }, 'Emulation.clearDeviceMetricsOverride').catch(() => {});
    await wait(60);
  }
  await fitWindowToPreset(await chrome.tabs.get(tabId), preset, screenInfo).catch(() => {});
  await applyMetrics(tabId, preset);
  await chrome.storage.local.set({ sbaDevicePreset: presetId });
  return { presetId, preset };
}

async function reapplyIfActive(tabId) {
  const { sbaDevicePreset = 'off' } = await chrome.storage.local.get('sbaDevicePreset');
  const preset = DEVICE_PRESETS[sbaDevicePreset];
  if (!preset || !(await isAttached(tabId))) return;
  await applyMetrics(tabId, preset).catch(() => {});
}

// Dopo una navigazione riapplica le metriche, se il debugger è ancora collegato.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') reapplyIfActive(tabId);
});

// Se l'utente ridimensiona la finestra, adatta l'altezza dell'area emulata.
chrome.windows.onBoundsChanged.addListener(async (win) => {
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  if (tab?.id) reapplyIfActive(tab.id);
});

// Se l'utente chiude la barra "debug in corso" di Chrome, torna alla vista normale.
chrome.debugger.onDetach.addListener(async (source, reason) => {
  if (reason !== 'canceled_by_user' || !source.tabId) return;
  await chrome.storage.local.set({ sbaDevicePreset: 'off' });
  const tab = await chrome.tabs.get(source.tabId).catch(() => null);
  if (tab) await restoreWindow(tab.windowId);
  chrome.runtime.sendMessage({ type: 'SBA_DEVICE_RESET' }).catch(() => {});
});
