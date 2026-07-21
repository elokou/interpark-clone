const KEY = 'smartTicketAssistant';
const NOTIFICATION_ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="28" fill="#9c6cff"/><path d="M64 22l8 27 27 8-27 8-8 27-8-27-27-8 27-8z" fill="white"/></svg>')}`;
const DEFAULTS = { enabled: false, autoClick: false, testMode: true, debugMode: false, waitTime: 800, eventName: '', priorityAreas: ['VIP'], fallbackAreas: ['R석', 'A석'], quantity: 1, strategy: 'center', rowStart: 5, rowEnd: 15, logs: [], history: [] };

async function settings() {
  const stored = await chrome.storage.local.get(KEY);
  return { ...DEFAULTS, ...(stored[KEY] || {}) };
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(KEY);
  if (!current[KEY]) await chrome.storage.local.set({ [KEY]: { ...DEFAULTS } });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'STA_TARGET_FOUND') return;
  chrome.notifications.create({
    type: 'basic',
    iconUrl: NOTIFICATION_ICON,
    title: 'Smart Ticket Assistant',
    message: `发现可选择位置：${message.area || '目标区域'}`,
    priority: 2
  }).catch(() => {});
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[KEY]) chrome.runtime.sendMessage({ type: 'STA_SETTINGS_UPDATED' }).catch(() => {});
});
