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

  // Mock tour data for development
  MOCK_TOURS: [
    {
      id: 'meridian-districts',
      world_id: 'meridian',
      title: 'District Overview',
      description: 'Explore the major districts of Meridian City',
      category: 'District Tours',
      estimated_duration: '8 min',
      slide_count: 6,
      preview_image: 'assets/images/district-tour-preview.jpg'
    },
    {
      id: 'meridian-nightlife', 
      world_id: 'meridian',
      title: 'Meridian After Dark',
      description: 'The city transforms when the sun goes down',
      category: 'Thematic Tours',
      estimated_duration: '5 min',
      slide_count: 4,
      preview_image: 'assets/images/nightlife-tour-preview.jpg'
    }
  ],

  MOCK_TOUR_SLIDES: [
    {
      id: 1,
      tour_id: 'meridian-districts',
      slide_order: 1,
      slide_type: 'intro',
      title: 'Welcome to Meridian City',
      content: '# Welcome to Meridian City\n\nA sprawling metropolis where the impossible becomes routine. Each district has its own character, dangers, and opportunities.',
      media_url: 'assets/images/meridian-overview.jpg'
    },
    {
      id: 2,
      tour_id: 'meridian-districts',
      slide_order: 2,
      slide_type: 'location',
      title: 'Cloudpier District',
      content: '## Cloudpier District\n\nThe literal upper class. Home to diplomatic families and vertical luxury. All glass, silk, and airlock.',
      media_url: 'assets/images/cloudpier.jpg'
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