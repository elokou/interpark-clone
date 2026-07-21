const KEY = 'smartTicketAssistant';
const $ = (id) => document.getElementById(id);
let state;

const lines = (value) => value.split('\n').map((item) => item.trim()).filter(Boolean);
const inputIds = ['eventName', 'priorityAreas', 'fallbackAreas', 'quantity', 'rowStart', 'rowEnd', 'waitTime', 'autoClick', 'testMode', 'debugMode'];

async function load() {
  const stored = await chrome.storage.local.get(KEY);
  state = { ...globalThis.STA_DEFAULTS, ...(stored[KEY] || {}) };
  $('eventName').value = state.eventName;
  $('priorityAreas').value = state.priorityAreas.join('\n');
  $('fallbackAreas').value = state.fallbackAreas.join('\n');
  $('quantity').value = state.quantity;
  $('rowStart').value = state.rowStart;
  $('rowEnd').value = state.rowEnd;
  $('waitTime').value = String(state.waitTime);
  $('autoClick').checked = state.autoClick;
  $('testMode').checked = state.testMode;
  $('debugMode').checked = state.debugMode;
  document.querySelector(`input[name=strategy][value=${state.strategy}]`).checked = true;
  renderLogs();
  requestStatus();
}
async function save() {
  state = {
    ...state,
    eventName: $('eventName').value.trim(),
    priorityAreas: lines($('priorityAreas').value),
    fallbackAreas: lines($('fallbackAreas').value),
    quantity: Number($('quantity').value),
    rowStart: Number($('rowStart').value),
    rowEnd: Number($('rowEnd').value),
    waitTime: Number($('waitTime').value),
    autoClick: $('autoClick').checked,
    testMode: $('testMode').checked,
    debugMode: $('debugMode').checked,
    strategy: document.querySelector('input[name=strategy]:checked').value
  };
  await chrome.storage.local.set({ [KEY]: state });
}
function renderLogs() {
  $('logList').replaceChildren(...state.logs.slice(0, 12).map((entry) => {
    const li = document.createElement('li');
    li.textContent = `${new Date(entry.at).toLocaleTimeString()} — ${entry.message}`;
    return li;
  }));
}
async function activeTab() { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); return tab; }
async function sendToPage(type) {
  const tab = await activeTab();
  if (!tab?.id) throw new Error('未找到当前标签页');
  return new Promise((resolve, reject) => chrome.tabs.sendMessage(tab.id, { type }, (result) => {
    if (chrome.runtime.lastError) reject(new Error('当前页面未加载扩展脚本')); else resolve(result);
  }));
}
async function requestStatus() {
  const tab = await activeTab();
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'STA_STATUS_REQUEST' }, (result) => {
    if (!chrome.runtime.lastError) updateStatus(result);
  });
}
function updateStatus(status = {}) {
  $('pageStatus').textContent = status.status || '非票务页面';
  $('elapsed').textContent = status.elapsed || '—';
  $('availability').textContent = status.available ? '已发现' : '未发现';
  $('connection').classList.toggle('online', Boolean(status.status));
}

inputIds.forEach((id) => $(id).addEventListener('change', save));
document.querySelectorAll('input[name=strategy]').forEach((input) => input.addEventListener('change', save));
$('start').addEventListener('click', async () => { await save(); state.enabled = true; await chrome.storage.local.set({ [KEY]: state }); requestStatus(); });
$('pause').addEventListener('click', async () => { state.enabled = false; await chrome.storage.local.set({ [KEY]: state }); });
$('logs').addEventListener('click', () => { $('logPanel').hidden = !$('logPanel').hidden; });
$('scanMap').addEventListener('click', async () => {
  try { const result = await sendToPage('STA_SCAN_SEAT_MAP'); updateStatus(result?.status); $('analysisNotice').textContent = '座位图扫描完成（仅分析，未点击）。'; }
  catch (error) { $('analysisNotice').textContent = error.message; }
});
$('exportAnalysis').addEventListener('click', async () => {
  try {
    const report = await sendToPage('STA_EXPORT_ANALYSIS');
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    await chrome.downloads.download({ url, filename: `smart-ticket-analysis-${Date.now()}.json`, saveAs: true });
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    $('analysisNotice').textContent = '分析结果 JSON 已准备下载。';
  } catch (error) { $('analysisNotice').textContent = error.message; }
});
chrome.runtime.onMessage.addListener((message) => { if (message.type === 'STA_PAGE_STATUS') updateStatus(message.payload); });
load();
