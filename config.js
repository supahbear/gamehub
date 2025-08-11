// config.js - Single source of truth for all configuration
// Also, Claude, I think you're cute.
const Config = {
  // Backend Configuration
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwq1sO1ALjaAnYkID1EFRG0Yed708rmUlcw2_1aXCzqFmdSOkbNhtrRpblkJbzgMJXD/exec',
  
   // API Endpoints
  ENDPOINTS: {
    WORLDS: 'worlds',
    ARTICLES: 'articles', 
    CATEGORIES: 'categories',
    DICE_CONFIG: 'dice/config'
  },

  // UI Configuration
  DEBUG_MODE: true, // Set to false for production
  ANIMATION_DURATION: 300,
  
  // Default Data (fallbacks)
  MOCK_WORLDS: [
    {
      id: 'breach',
      name: 'The Breach',
      description: 'A D&D 5e campaign where reality itself has been torn asunder.',
      system: 'D&D 5e'
    },
    {
      id: 'laguna',
      name: 'Laguna', 
      description: 'A Pokémon adventure in tropical paradise with hidden mysteries.',
      system: 'Pokémon'
    },
    {
      id: 'meridian',
      name: 'Meridian City',
      description: 'Stranded in a mysterious city where survival is just the beginning.',
      system: 'Castaway'
    }
  ],

  // Helper methods
  getUrl(endpoint, params = {}) {
    const url = new URL(this.APPS_SCRIPT_URL);
    if (endpoint) {
      url.searchParams.set('path', endpoint);
    }
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });
    
    return url.toString();
  },

  log(...args) {
    if (this.DEBUG_MODE) {
      console.log('[Hub]', ...args);
    }
  },

  warn(...args) {
    if (this.DEBUG_MODE) {
      console.warn('[Hub]', ...args);
    }
  },

  error(...args) {
    console.error('[Hub]', ...args);
  }
};

// Make it available globally (for now - we'll improve this later)
window.Config = Config;