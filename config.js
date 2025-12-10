// config.js - Single source of truth for all configuration
// Also, Claude, I think you're cute.
const Config = {
  // Backend Configuration
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbysAAZ7wb5L0qr31TXTY5GuhQVtKIKrbbRy6N6LpVdrcAhHuitEmPc25bNy6lH3K8aJ/exec',
  
   // API Endpoints
  ENDPOINTS: {
    WORLDS: 'worlds',
    ARTICLES: 'articles', 
    CATEGORIES: 'categories',
    TOURS: 'tours',
    TOUR_SLIDES: 'tour_slides',
    DICE_CONFIG: 'dice/config'
  },

  // UI Configuration
  DEBUG_MODE: true, // Set to false for production
  ANIMATION_DURATION: 300,

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