// Clean TTRPG Hub - Refactored for maintainability with unified explore mode
class TTRPGHub {
  constructor() {
    this.currentWorld = null;
    this.currentMode = 'explore'; // Always explore mode
    this.currentSelectedPanel = 'lorebook';
    this.worlds = [];
    
    this.activeBackgroundWorld = 'neutral'; // Changed from 'breach' to 'neutral'
    this.backgroundVideos = {};

    this.init();
  }

  async init() {
    this.setupEventListeners();
    
    await this.loadWorlds();
    this.renderWorlds();
    
    // REMOVE: Don't call setupWorldBackgrounds here - cards don't exist yet
    
    Config.log('TTRPG Hub initialized');
  }

  // ========== Event Listeners ==========
  setupEventListeners() {
    // REMOVED: back button listener - button no longer exists
    // Logo click handler already reloads the page via onclick in HTML
  }

  // ========== Data Loading ==========
  async loadWorlds() {
    try {
      await this.loadWorldsFromAppsScript();
    } catch (error) {
      Config.warn('Apps Script connection failed, using fallback data:', error.message);
      this.useFallbackWorlds();
    }
  }

  // ========== JSONP Helper ==========
  jsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      // Create global callback function FIRST
      window[callbackName] = (data) => {
        // Cleanup
        try {
          document.head.removeChild(script);
        } catch (e) {
          // Script might already be removed
        }
        delete window[callbackName];
        resolve(data);
      };
      
      const script = document.createElement('script');
      
      // Handle script loading errors
      script.onerror = () => {
        try {
          document.head.removeChild(script);
        } catch (e) {
          // Script might already be removed
        }
        delete window[callbackName];
        reject(new Error('JSONP request failed - script load error'));
      };
      
      // Handle timeout
      const timeout = setTimeout(() => {
        try {
          document.head.removeChild(script);
        } catch (e) {
          // Script might already be removed
        }
        delete window[callbackName];
        reject(new Error('JSONP request timed out'));
      }, 10000); // 10 second timeout
      
      // Clear timeout when callback succeeds
      const originalCallback = window[callbackName];
      window[callbackName] = (data) => {
        clearTimeout(timeout);
        originalCallback(data);
      };
      
      // Add callback parameter to URL
      const separator = url.includes('?') ? '&' : '?';
      script.src = url + separator + 'callback=' + callbackName;
      
      Config.log('JSONP request:', script.src);
      document.head.appendChild(script);
    });
  }

  async loadWorldsFromAppsScript() {
    const url = Config.getUrl(Config.ENDPOINTS.WORLDS);
    Config.log('Loading worlds from:', url);

    try {
      const data = await this.jsonp(url);
      
      if (data.success && Array.isArray(data.data)) {
        this.worlds = data.data.map((world, index) => ({
          id: world.id || world.key || `world-${index}`,
          name: world.name || world.world_name || 'Unnamed World',
          description: world.description || world.world_description || 'No description available',
          system: world.system || world.dice_set || world.game_system || 'Unknown System',
          video_url: world.video_url || null
        }));
        
        Config.log('Successfully loaded worlds from Apps Script:', this.worlds);
        this.renderWorlds();
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (error) {
      throw new Error(`JSONP request failed: ${error.message}`);
    }
  }

  useFallbackWorlds() {
    // Single world - The Breach
    this.worlds = [
      {
        id: 'breach',
        name: 'Beyond the Vale',
        description: 'Becoming a hero is no easy feat. Saving the world might be a good place to start.',
        system: 'D&D 5e',
        video_url: 'assets/videos/breach-loopv2.mp4'
      }
    ];
    Config.log('Using fallback worlds:', this.worlds);
    this.renderWorlds();
  }

  // ========== UI Rendering ==========
  renderWorlds() {
    const worldsGrid = document.getElementById('worldsGrid');
    if (!worldsGrid) {
      Config.error('worldsGrid element not found');
      return;
    }

    if (this.worlds.length === 0) {
      worldsGrid.innerHTML = `<div class="world-card loading">Loading worlds...</div>`;
      return;
    }

    // Update the loading card's content instead of replacing it
    const loadingCard = worldsGrid.querySelector('.world-card.loading');
    if (loadingCard && this.worlds.length > 0) {
      const world = this.worlds[0]; // Get first (only) world for Breach
      
      // Update text content of the card
      const worldNameEl = loadingCard.querySelector('.world-name');
      const descriptionEl = loadingCard.querySelector('.world-description');
      const systemEl = loadingCard.querySelector('.world-system');
      const overlayEl = loadingCard.querySelector('.world-overlay');
      
      if (worldNameEl) {
        worldNameEl.textContent = world.name;
        // Restart animation by removing and re-adding it
        worldNameEl.style.animation = 'none';
        // Force reflow to restart animation
        void worldNameEl.offsetWidth;
        worldNameEl.style.animation = '';
      }
      if (descriptionEl) descriptionEl.textContent = world.description;
      if (systemEl) systemEl.textContent = `System: ${world.system}`;
      
      // Restart overlay animation
      if (overlayEl) {
        overlayEl.style.animation = 'none';
        void overlayEl.offsetWidth;
        overlayEl.style.animation = '';
      }
      
      // Remove loading indicators
      loadingCard.removeAttribute('data-loading');
      loadingCard.classList.remove('loading');
    }
    
    this.setupCardListeners();
    // ADD: Setup background videos AFTER cards exist
    this.setupWorldBackgrounds();

    Config.log(`Rendered ${this.worlds.length} worlds`);
  }

  renderWorldCard(world) {
    // This method is kept for compatibility but is no longer used in renderWorlds()
    // The loading card is updated in place instead of being replaced
    const hasVideo = world.video_url && world.video_url.trim();
    const videoElement = hasVideo ? 
      `<video class="world-video" muted loop playsinline>
         <source src="${world.video_url}" type="video/mp4">
         <div class="world-video-placeholder"></div>
       </video>` :
      `<div class="world-video-placeholder"></div>`;

    return `
      <div class="world-card" data-world-id="${world.id}">
        ${videoElement}
        <div class="world-name">${world.name}</div>
        <div class="world-overlay">
          <div class="world-description">${world.description}</div>
          <div class="world-system">System: ${world.system}</div>
        </div>
      </div>
    `;
  }

  renderLoadingCard() {
    return `
      <div class="world-card loading" data-loading="true">
        <div class="world-video-placeholder"></div>
        <div class="world-name">Loading</div>
        <div class="world-overlay">
          <div class="world-description">Preparing to enter The Breach...</div>
          <div class="world-system">System: D&D 5e</div>
        </div>
      </div>
    `;
  }

  showError(message) {
    const worldsGrid = document.getElementById('worldsGrid');
    if (worldsGrid) {
      worldsGrid.innerHTML = `<div class="world-card loading" style="color: #ff6b6b;">${message}</div>`;
    }
    Config.error(message);
  }

  // ========== World Theme Management ==========
  applyWorldTheme(worldId) {
    // Remove any existing world theme classes
    document.body.className = document.body.className.replace(/world-\w+/g, '').trim();
    
    // Add the new world theme class
    if (worldId) {
      const themeClass = `world-${worldId}`;
      document.body.classList.add(themeClass);
      Config.log('Applied world theme:', themeClass);
    }
  }

  clearWorldTheme() {
    document.body.className = document.body.className.replace(/world-\w+/g, '').trim();
    Config.log('Cleared world theme');
  }

  // ========== Navigation ==========
  selectWorld(worldId) {
    this.currentWorld = this.worlds.find(w => w.id === worldId);
    if (this.currentWorld) {
      Config.log('Selected world:', this.currentWorld.name);
      
      // Apply theme and switch to hub
      this.applyWorldTheme(worldId);
      this.showWorldHub();
    }
  }

  showWorldSelection() {
    this.setPageVisibility('landing');
    this.currentWorld = null;
    this.currentMode = 'explore';
    // Clear world theme when returning to hub
    this.clearWorldTheme();
  }

  showWorldHub() {
    this.setPageVisibility('hub');
    
    // Trigger fade-in animation for world hub and its children
    const worldHub = document.getElementById('worldHub');
    if (worldHub) {
      worldHub.classList.remove('entering');
      // Force reflow to restart animation
      void worldHub.offsetWidth;
      worldHub.classList.add('entering');
    }
    
    this.currentMode = 'explore';
    this.currentSelectedPanel = this.currentSelectedPanel || 'lorebook';
    this.initializePanels();
    Config.log('showWorldHub: About to activate breach background');
    this.activateWorldBackground('breach');
  }

  setPageVisibility(activePage) {
    const pages = {
      landing: document.querySelector('.landing-screen'),
      hub: document.getElementById('worldHub')
    };

    Object.entries(pages).forEach(([page, element]) => {
      if (element) {
        element.style.display = page === activePage ? 'block' : 'none';
      }
    });
  }

  // ========== Panel Management ==========
  async initializePanels() {
    // Setup panel selector click listeners
    document.querySelectorAll('.hub-panel').forEach(panel => {
      const enterBtn = panel.querySelector('.enter-btn');
      if (enterBtn) {
        enterBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.selectPanel(panel.dataset.panel);
        });
      }
      // Also allow clicking anywhere on the panel to enter
      panel.addEventListener('click', (e) => {
        if (e.target === panel || e.target.closest('.panel-selector')) {
          this.selectPanel(panel.dataset.panel);
        }
      });
    });

    // Setup panel pill button listeners
    document.querySelectorAll('.panel-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectPanel(e.currentTarget.dataset.panel);
      });
    });

    // Panels start collapse to show selectors
    this.currentSelectedPanel = null;
  }

  async selectPanel(panelName) {
    this.currentSelectedPanel = panelName;
    
    const container = document.getElementById('hubPanelsContainer');
    const collapsedHeader = document.getElementById('hubCollapsedHeader');
    const panels = document.querySelectorAll('.hub-panel');
    
    // Update pill button active state
    document.querySelectorAll('.panel-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.panel === panelName);
    });
    
    // Show selected panel, collapse others
    panels.forEach(panel => {
      const isSelected = panel.dataset.panel === panelName;
      panel.classList.toggle('expanded', isSelected);
      panel.classList.toggle('collapsed', !isSelected);
    });
    
    // Show/hide collapsed header based on whether any panel is selected
    if (panelName) {
      collapsedHeader.style.display = 'flex';
    }

    // Load content for the selected panel if not already loaded
    await this.loadPanelContent(panelName);
  }

  async loadPanelContent(panelName) {
    let contentEl;
    
    if (panelName === 'lorebook') {
      contentEl = document.getElementById('loreBookContent');
    } else if (panelName === 'journal') {
      contentEl = document.getElementById('journalContent');
    } else if (panelName === 'maps') {
      contentEl = document.getElementById('mapsContent');
    }
    
    if (!contentEl) return;
    
    // Check if already loaded
    if (contentEl.textContent.trim() && contentEl.style.display !== 'none') {
      return;
    }
    
    try {
      contentEl.innerHTML = '<div class="loading">Loading...</div>';
      contentEl.style.display = 'block';
      
      // Hide the selector when content loads
      const panel = contentEl.closest('.hub-panel');
      if (panel) {
        const selector = panel.querySelector('.panel-selector');
        if (selector) selector.style.display = 'none';
      }
      
      if (panelName === 'lorebook') {
        if (!this.articleViewer) {
          this.articleViewer = new ArticleViewer(this);
          window.articleViewer = this.articleViewer;
          Config.log('Created new ArticleViewer instance');
        }
        const content = await this.articleViewer.renderReadMode(this.currentWorld.id);
        contentEl.innerHTML = content;
        this.articleViewer.setupEventListeners();
      } else if (panelName === 'journal') {
        if (!this.questViewer) {
          this.questViewer = new QuestViewer(this);
          window.questViewer = this.questViewer;
          Config.log('Created new QuestViewer instance');
        }
        const content = await this.questViewer.renderQuestMode(this.currentWorld.id);
        contentEl.innerHTML = content;
        this.questViewer.setupEventListeners();
      } else if (panelName === 'maps') {
        // TODO: Implement maps gallery
        contentEl.innerHTML = '<div class="maps-placeholder">Maps coming soon...</div>';
      }
    } catch (error) {
      contentEl.innerHTML = `<div class="error">Error loading ${panelName}: ${error.message}</div>`;
      Config.error(`Error loading ${panelName}:`, error);
    }
  }

  // ========== Article Data Loading ==========
  async loadArticles(worldId) {
    try {
      const url = Config.getUrl(Config.ENDPOINTS.ARTICLES, { world_id: worldId });
      const data = await this.jsonp(url);
      return data.success ? data.data : [];
    } catch (error) {
      Config.error('Failed to load articles:', error);
      return [];
    }
  }

  async loadCategories(worldId) {
    try {
      const url = Config.getUrl(Config.ENDPOINTS.CATEGORIES, { world_id: worldId });
      const data = await this.jsonp(url);
      return data.success ? data.data : [];
    } catch (error) {
      Config.error('Failed to load categories:', error);
      return [];
    }
  }

  // ========== Debug Tools ==========
  addDebugControls() {
    // Remove debug button creation and insertion
  }

  // ========== Utility Methods ==========
  // REMOVE: Duplicate - ArticleViewer has its own

  // ADD THIS: Missing method that handles world card interactions
  setupCardListeners() {
    const worldCards = document.querySelectorAll('.world-card');
    Config.log(`Setting up listeners for ${worldCards.length} world cards`);
    
    worldCards.forEach(card => {
      const worldId = card.dataset.worldId;
      
      // Handle click to select world
      card.addEventListener('click', () => {
        Config.log(`World card clicked: ${worldId}`);
        this.selectWorld(worldId);
      });

      // Play card's embedded video on hover
      const video = card.querySelector('.world-video');
      if (video) {
        card.addEventListener('mouseenter', () => {
          video.play().catch(e => Config.log('Card video play prevented:', e));
        });
        card.addEventListener('mouseleave', () => {
          video.pause();
          video.currentTime = 0;
        });
      }
    });
  }

  // NEW: Setup background video system
  setupWorldBackgrounds() {
    // Cache background video elements - Breach only
    this.backgroundVideos = {
      neutral: document.getElementById('bgVideo-neutral'),
      breach: document.getElementById('bgVideo-breach')
    };

    Config.log('Background videos cached:', this.backgroundVideos);

    // Neutral is already marked active in HTML and autoplays
    if (this.backgroundVideos.neutral) {
      Config.log('Attempting to play neutral background video...');
      this.backgroundVideos.neutral.play()
        .then(() => Config.log('Neutral background video playing'))
        .catch(e => Config.error('Neutral bg autoplay blocked:', e));
    } else {
      Config.error('Neutral background video element not found');
    }

    // Attach hover listeners to world cards - NOW they exist
    const worldCards = document.querySelectorAll('.world-card');
    Config.log(`Found ${worldCards.length} world cards for background hover`);
    
    worldCards.forEach(card => {
      const worldId = card.dataset.worldId;
      Config.log(`Attaching background hover listeners to card: ${worldId}`);
      
      card.addEventListener('mouseenter', () => {
        Config.log(`Mouse entered ${worldId} card - switching background`);
        this.activateWorldBackground(worldId);
      });
      
      card.addEventListener('mouseleave', () => {
        // Only revert to neutral if no world is currently selected
        if (!this.currentWorld) {
          Config.log(`Mouse left ${worldId} card - returning to neutral background`);
          this.activateWorldBackground('neutral');
        } else {
          Config.log(`Mouse left ${worldId} card, but world is selected - keeping ${worldId} background`);
        }
      });
    });
  }

  // NEW: Activate a world's background video
  activateWorldBackground(worldId) {
    Config.log(`Activating background for: ${worldId}`);
    Config.log(`Current activeBackgroundWorld: ${this.activeBackgroundWorld}`);
    Config.log(`backgroundVideos keys:`, Object.keys(this.backgroundVideos));
    
    if (this.activeBackgroundWorld === worldId) {
      Config.log(`${worldId} already active, skipping`);
      return;
    }
    
    // Deactivate current - IMPORTANT: pause the video too
    if (this.backgroundVideos[this.activeBackgroundWorld]) {
      Config.log(`Deactivating ${this.activeBackgroundWorld}`);
      const currentVideo = this.backgroundVideos[this.activeBackgroundWorld];
      currentVideo.classList.remove('active');
      currentVideo.style.opacity = '0'; // Force opacity immediately
      currentVideo.pause();
      Config.log(`Deactivated, opacity set to 0`);
    }
    
    // Activate new
    if (this.backgroundVideos[worldId]) {
      Config.log(`Activating ${worldId}, adding .active class and setting opacity`);
      const newVideo = this.backgroundVideos[worldId];
      newVideo.classList.add('active');
      newVideo.style.opacity = '1'; // Force opacity immediately
      newVideo.currentTime = 0;
      newVideo.play()
        .then(() => Config.log(`${worldId} video playing, opacity at 1`))
        .catch(e => Config.error(`${worldId} video play blocked:`, e));
    } else {
      Config.error(`No background video found for ${worldId}`);
      Config.error(`Available videos:`, this.backgroundVideos);
    }
    
    this.activeBackgroundWorld = worldId;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.hub = new TTRPGHub();
});