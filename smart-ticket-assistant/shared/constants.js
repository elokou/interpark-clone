/** Shared, local-only configuration defaults for the ticket-page assistant. */
globalThis.STA_DEFAULTS = Object.freeze({
  enabled: false,
  autoClick: false, autoRotate: false, autoSelectSeats: false, maxCycles: 20,
  testMode: true,
  debugMode: false,
  waitTime: 800, scanInterval: 3000, scanProfile: 'balanced',
  eventName: '',
  priorityAreas: ['VIP Seat', 'R Seat', 'S Seat'],
  fallbackAreas: ['F1', 'E1'], excludedAreas: [],
  ticketGrades: [], seatAreas: '', seatFloors: [], requireContiguous: false, quantity: 1,
  priceMin: null, priceMax: null, targetX: null, targetY: null,
  strategy: 'center',
  rowStart: 5,
  rowEnd: 15,
  logs: [],
  history: [], scanStats: { count: 0, pageChanges: 0, lastAt: null, currentInterval: 3000, profile: 'balanced', level: 0 }
});
