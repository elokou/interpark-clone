const KEY = 'smartTicketAssistant';
const NOTIFICATION_ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="28" fill="#9c6cff"/><path d="M64 22l8 27 27 8-27 8-8 27-8-27-27-8 27-8z" fill="white"/></svg>')}`;
const DEFAULTS = { enabled: false, autoClick: false, autoRotate: false, autoSelectSeats: false, maxCycles: 20, testMode: true, debugMode: false, waitTime: 800, scanInterval: 3000, scanProfile: 'balanced', eventName: '', priorityAreas: ['VIP Seat', 'R Seat', 'S Seat'], fallbackAreas: ['F1', 'E1'], excludedAreas: [], ticketGrades: [], seatAreas: '', seatFloors: [], requireContiguous: false, quantity: 1, strategy: 'center', rowStart: 5, rowEnd: 15, templates: [], activeTemplateId: '', logs: [], history: [], scanStats: { count: 0, pageChanges: 0, lastAt: null, currentInterval: 3000 } };
const frameDiagnostics = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(KEY);
  if (!current[KEY]) await chrome.storage.local.set({ [KEY]: { ...DEFAULTS } });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'STA_TARGET_FOUND') {
    chrome.notifications.create({ type: 'basic', iconUrl: NOTIFICATION_ICON, title: 'Smart Ticket Assistant', message: `发现可选择位置：${message.area || '目标区域'}`, priority: 2 }).catch(() => {});
    return;
  }
  if (message.type === 'STA_FRAME_DIAGNOSTIC' && sender.tab) {
    const byFrame = frameDiagnostics.get(sender.tab.id) || new Map();
    byFrame.set(sender.frameId, { ...message.payload, frameId: sender.frameId, capturedAt: Date.now() });
    frameDiagnostics.set(sender.tab.id, byFrame);
    return;
  }
  if (message.type === 'STA_GET_FRAME_DIAGNOSTICS') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      const frames = tab ? [...(frameDiagnostics.get(tab.id)?.values() || [])].sort((a, b) => a.frameId - b.frameId) : [];
      sendResponse({ frames });
    });
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => frameDiagnostics.delete(tabId));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[KEY]) chrome.runtime.sendMessage({ type: 'STA_SETTINGS_UPDATED' }).catch(() => {});
});
