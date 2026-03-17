// config.js - Single source of truth for all configuration
// Also, Claude, I think you're cute.
const Config = {
  // Backend — Google Apps Script web app URL
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbznK1LFE_ZPpkrfS4XURC4WP-OpET2_gVnIIVpvE9-rCrX6JVKGo77hXBd4WoMRtblM5g/exec',

  // Sheet names in the workbook — source of truth for panel routing
  SHEETS: {
    CHARACTERS:  'Characters',
    LOCATIONS:   'Locations',
    FACTIONS:    'Factions',
    BESTIARY:    'Bestiary',
    ITEMS:       'Items',
    ALCHEMY:     'Alchemy',
    RELIGION:    'Religion',
    LITERATURE:  'Literature',
    JOURNAL:     'Journal',
    MAPS:        'Maps'
  },

  // Which sheets each panel fetches (used by viewers to request data)
  PANEL_SHEETS: {
    encyclopedia: ['Characters', 'Factions', 'Religion', 'Items'],
    journal:      ['Journal'],
    atlas:        ['Locations', 'Maps'],
    bestiary:     ['Bestiary'],
    alchemy:      ['Alchemy'],
    literature:   ['Literature']
  },

  // UI Configuration
  DEBUG_MODE: true, // Set to false for production
  ANIMATION_DURATION: 300,

  // Build a JSONP URL for one or more sheet names
  // Pass sheets as a single string or comma-joined list
  getSheetUrl(sheets) {
    const url = new URL(this.APPS_SCRIPT_URL);
    url.searchParams.set('sheets', Array.isArray(sheets) ? sheets.join(',') : sheets);
    return url.toString();
  },

  log(...args) {
    if (this.DEBUG_MODE) console.log('[Hub]', ...args);
  },
  warn(...args) {
    if (this.DEBUG_MODE) console.warn('[Hub]', ...args);
  },
  error(...args) {
    console.error('[Hub]', ...args);
  }
};

window.Config = Config;