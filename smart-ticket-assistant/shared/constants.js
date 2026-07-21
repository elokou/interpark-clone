/** Shared, local-only configuration defaults for the ticket-page assistant. */
globalThis.STA_DEFAULTS = Object.freeze({
  enabled: false,
  autoClick: false,
  testMode: true,
  debugMode: false,
  waitTime: 800,
  eventName: '',
  priorityAreas: ['VIP'],
  fallbackAreas: ['R석', 'A석'],
  quantity: 1,
  strategy: 'center',
  rowStart: 5,
  rowEnd: 15,
  logs: [],
  history: []
});
