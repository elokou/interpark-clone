const KEY = 'smartTicketAssistant';
const $ = (id) => document.getElementById(id);
let state;

const lines = (value) => value.split('\n').map((item) => item.trim()).filter(Boolean);
const inputIds = ['eventName', 'priorityAreas', 'fallbackAreas', 'excludedAreas', 'quantity', 'rowStart', 'rowEnd', 'waitTime', 'scanInterval', 'autoClick', 'autoRotate', 'autoSelectSeats', 'maxCycles', 'testMode', 'debugMode'];

async function load() {
  const stored = await chrome.storage.local.get(KEY);
  state = { ...globalThis.STA_DEFAULTS, ...(stored[KEY] || {}) };
  $('eventName').value = state.eventName;
  $('priorityAreas').value = state.priorityAreas.join('\n');
  $('fallbackAreas').value = state.fallbackAreas.join('\n');
  $('excludedAreas').value = state.excludedAreas.join('\n');
  $('quantity').value = state.quantity;
  $('rowStart').value = state.rowStart;
  $('rowEnd').value = state.rowEnd;
  $('waitTime').value = String(state.waitTime);
  $('scanInterval').value = String(state.scanInterval);
  $('scanIntervalValue').textContent = `${state.scanInterval} ms`;
  document.querySelector(`input[name=scanProfile][value=${state.scanProfile}]`).checked = true;
  $('autoClick').checked = state.autoClick;
  $('autoSelectSeats').checked = state.autoSelectSeats;
  $('autoRotate').checked = state.autoRotate;
  $('maxCycles').value = state.maxCycles;
  $('testMode').checked = state.testMode;
  $('debugMode').checked = state.debugMode;
  document.querySelector(`input[name=strategy][value=${state.strategy}]`).checked = true;
  renderLogs();
  renderTemplates();
  showTemplate(state.templates.find((template) => template.id === state.activeTemplateId));
  requestStatus();
}
async function save() {
  state = {
    ...state,
    eventName: $('eventName').value.trim(),
    priorityAreas: lines($('priorityAreas').value),
    fallbackAreas: lines($('fallbackAreas').value),
    excludedAreas: lines($('excludedAreas').value),
    quantity: Number($('quantity').value),
    rowStart: Number($('rowStart').value),
    rowEnd: Number($('rowEnd').value),
    waitTime: Number($('waitTime').value),
    scanInterval: Number($('scanInterval').value),
    scanProfile: document.querySelector('input[name=scanProfile]:checked').value,
    autoClick: $('autoClick').checked,
    autoSelectSeats: $('autoSelectSeats').checked,
    autoRotate: $('autoRotate').checked,
    maxCycles: Number($('maxCycles').value),
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
async function getFrameDiagnostics() { return chrome.runtime.sendMessage({ type: 'STA_GET_FRAME_DIAGNOSTICS' }); }
async function requestStatus() {
  const tab = await activeTab();
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'STA_STATUS_REQUEST' }, (result) => {
    if (!chrome.runtime.lastError) updateStatus(result);
  });
}
function updateStatus(status = {}) {
  const stats = status.scanStats || state?.scanStats || {};
  $('currentProfile').textContent = { stable: '稳定模式', balanced: '平衡模式', fast: '快速模式' }[stats.profile || state?.scanProfile] || '平衡模式';
  $('currentInterval').textContent = stats.currentInterval ? `${stats.currentInterval} ms` : '—';
  $('lastScanAt').textContent = stats.lastAt ? new Date(stats.lastAt).toLocaleTimeString() : '—';
  $('scanCount').textContent = stats.count || 0;
  $('pageChangeCount').textContent = stats.pageChanges || 0;
  $('pageStatus').textContent = status.status || '非票务页面';
  $('elapsed').textContent = status.elapsed || '—';
  $('availability').textContent = status.available ? '已发现' : '未发现';
  $('connection').classList.toggle('online', Boolean(status.status));
}

inputIds.forEach((id) => $(id).addEventListener('change', save));
$('scanInterval').addEventListener('input', () => { $('scanIntervalValue').textContent = `${$('scanInterval').value} ms`; });
document.querySelectorAll('input[name=scanProfile]').forEach((input) => input.addEventListener('change', () => { const preset = { stable: 5000, balanced: 3000, fast: 2000 }[input.value]; $('scanInterval').value = String(preset); $('scanIntervalValue').textContent = `${preset} ms`; save(); }));
document.querySelectorAll('input[name=strategy]').forEach((input) => input.addEventListener('change', save));
$('start').addEventListener('click', async () => { await save(); state.enabled = true; await chrome.storage.local.set({ [KEY]: state }); requestStatus(); });
$('pause').addEventListener('click', async () => { state.enabled = false; await chrome.storage.local.set({ [KEY]: state }); });
$('logs').addEventListener('click', () => { $('logPanel').hidden = !$('logPanel').hidden; });
$('scanMap').addEventListener('click', async () => {
  try { const result = await sendToPage('STA_SCAN_SEAT_MAP'); const frames = await getFrameDiagnostics(); updateStatus(result?.status); $('analysisNotice').textContent = `座位图扫描完成：${frames.frames.length} 个注入帧（仅分析，未点击）。`; }
  catch (error) { $('analysisNotice').textContent = error.message; }
});
$('exportAnalysis').addEventListener('click', async () => {
  try {
    const report = await sendToPage('STA_EXPORT_ANALYSIS');
    report.injectedFrames = (await getFrameDiagnostics()).frames;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    await chrome.downloads.download({ url, filename: `smart-ticket-analysis-${Date.now()}.json`, saveAs: true });
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    $('analysisNotice').textContent = '分析结果 JSON 已准备下载。';
  } catch (error) { $('analysisNotice').textContent = error.message; }
});
chrome.runtime.onMessage.addListener((message) => { if (message.type === 'STA_PAGE_STATUS') updateStatus(message.payload); });
load();

const templateFields = { floor: 'templateFloor', first: 'templateFirst', second: 'templateSecond', third: 'templateThird' };
function renderTemplates() {
  const select = $('templateSelect');
  select.replaceChildren(new Option('新建模板', ''));
  state.templates.forEach((template) => select.add(new Option(template.name, template.id)));
  select.value = state.activeTemplateId || '';
}
function showTemplate(template) {
  $('templateName').value = template?.name || '';
  Object.entries(templateFields).forEach(([group, field]) => { $(field).value = (template?.mappings?.[group] || []).join('\n'); });
}
function selectedTemplate() { return state.templates.find((template) => template.id === $('templateSelect').value); }
function templateFromForm(id = crypto.randomUUID()) {
  return { id, name: $('templateName').value.trim(), mappings: Object.fromEntries(Object.entries(templateFields).map(([group, field]) => [group, lines($(field).value)])) };
}
async function saveTemplates(notice) { await chrome.storage.local.set({ [KEY]: state }); $('templateNotice').textContent = notice; }
$('templateSelect').addEventListener('change', () => { state.activeTemplateId = $('templateSelect').value; showTemplate(selectedTemplate()); saveTemplates('已切换模板。'); });
$('saveTemplate').addEventListener('click', async () => {
  const current = selectedTemplate(); const template = templateFromForm(current?.id);
  if (!template.name) { $('templateNotice').textContent = '请先输入模板名称。'; return; }
  state.templates = current ? state.templates.map((item) => item.id === current.id ? template : item) : [...state.templates, template];
  state.activeTemplateId = template.id; renderTemplates(); $('templateSelect').value = template.id; await saveTemplates('模板已保存并应用到当前分析。');
});
$('deleteTemplate').addEventListener('click', async () => {
  const current = selectedTemplate(); if (!current) return;
  state.templates = state.templates.filter((template) => template.id !== current.id); state.activeTemplateId = ''; renderTemplates(); showTemplate(null); await saveTemplates('模板已删除。');
});
$('exportTemplates').addEventListener('click', async () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, templates: state.templates }, null, 2)], { type: 'application/json' }));
  await chrome.downloads.download({ url, filename: 'smart-ticket-area-templates.json', saveAs: true }); setTimeout(() => URL.revokeObjectURL(url), 60000);
  $('templateNotice').textContent = '模板 JSON 已准备下载。';
});
$('importTemplates').addEventListener('change', async (event) => {
  try {
    const parsed = JSON.parse(await event.target.files[0].text());
    if (!Array.isArray(parsed.templates)) throw new Error('模板文件格式无效');
    const valid = parsed.templates.filter((template) => template.id && template.name && template.mappings);
    state.templates = [...state.templates.filter((old) => !valid.some((item) => item.id === old.id)), ...valid];
    renderTemplates(); await saveTemplates(`已导入 ${valid.length} 个模板。`);
  } catch (error) { $('templateNotice').textContent = error.message || '无法导入模板。'; }
  event.target.value = '';
});
