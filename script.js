// Clean TTRPG Hub - Refactored for maintainability with unified explore mode
class TTRPGHub {
  constructor() {
    this.currentWorld = null;
    this.currentMode = 'explore'; // Always explore mode
    this.currentExploreSubmode = 'tours';
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
    // Enhanced fallback data with video URLs
    this.worlds = [
      {
        id: 'breach',
        name: 'The Breach',
        description: 'A D&D 5e campaign where reality itself has been torn asunder.',
        system: 'D&D 5e',
        video_url: 'assets/videos/breach-loopv2.mp4' // Updated to v2
      },
      {
        id: 'laguna',
        name: 'Laguna', 
        description: 'A Pokémon adventure in tropical paradise with hidden mysteries.',
        system: 'Pokémon',
        video_url: 'assets/videos/laguna-loop.mp4'
      },
      {
        id: 'meridian',
        name: 'Meridian City',
        description: 'Stranded in a mysterious city where survival is just the beginning.',
        system: 'Castaway',
        video_url: 'assets/videos/meridian-loop.mp4'
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

    // Simple fade out of loading text, then render cards
    const loadingCard = worldsGrid.querySelector('.world-card.loading');
    if (loadingCard) {
      loadingCard.style.transition = 'opacity 0.3s ease-out';
      loadingCard.style.opacity = '0';
      
      // Wait for fade-out to complete (350ms > 300ms transition) before replacing DOM
      setTimeout(() => {
        worldsGrid.innerHTML = this.worlds.map(world => this.renderWorldCard(world)).join('');
        this.setupCardListeners();
        // ADD: Setup background videos AFTER cards exist
        this.setupWorldBackgrounds();
      }, 350); // Give extra 50ms buffer after transition completes
    } else {
      worldsGrid.innerHTML = this.worlds.map(world => this.renderWorldCard(world)).join('');
      this.setupCardListeners();
      // ADD: Setup background videos AFTER cards exist
      this.setupWorldBackgrounds();
    }

    Config.log(`Rendered ${this.worlds.length} worlds`);
  }

  renderWorldCard(world) {
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
      
      // Start quick content fade
      const container = document.querySelector('.container');
      container.classList.add('transitioning');
      
      // Wait for content fade out, then apply theme and switch content
      setTimeout(() => {
        // Apply theme after content is hidden
        this.applyWorldTheme(worldId);
        this.showWorldHub();
        
        // Small delay before content fade back in
        setTimeout(() => {
          container.classList.remove('transitioning');
        }, 100);
      }, 500);
    }
  }

  showWorldSelection() {
    this.setPageVisibility('landing');
    this.currentWorld = null;
    this.currentMode = 'explore';
    this.currentExploreSubmode = 'tours';
    // Clear world theme when returning to hub
    this.clearWorldTheme();
  }

  showWorldHub() {
    this.setPageVisibility('hub');
    
    // Always explore mode
    this.currentMode = 'explore';
    this.currentExploreSubmode = this.currentExploreSubmode || 'tours';
    
    this.updateHubHeader();
    this.loadHubContent();
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

  updateHubHeader() {
    const worldNameEl = document.getElementById('currentWorldName');
    const modeEl = document.getElementById('currentMode');
    const worldHub = document.getElementById('worldHub');

    // Set data-mode attribute for CSS targeting
    if (worldHub) {
      worldHub.setAttribute('data-mode', 'explore');
    }

    // Show two large, separate buttons (no container box)
    const hubHeader = document.querySelector('.hub-header');
    if (hubHeader) {
      hubHeader.innerHTML = `
        <div class="explore-toggle-row">
          <button class="explore-primary-btn ${this.currentExploreSubmode === 'tours' ? 'active' : ''}" data-submode="tours">
            <span>Tours</span>
          </button>
          <button class="explore-primary-btn ${this.currentExploreSubmode === 'database' ? 'active' : ''}" data-submode="database">
            <span>Articles</span>
          </button>
        </div>
      `;
    }

    // Hide the mode indicator for explore mode
    if (modeEl) {
      modeEl.style.display = 'none';
    }
  }

  // ========== Hub Content ==========
  async loadHubContent() {
    const hubContent = document.getElementById('hubContent');
    if (!hubContent) return;

    // Simplified - only explore mode exists
    try {
      hubContent.innerHTML = '<div class="loading">Loading...</div>';
      const content = await this.getExploreModeContent();
      hubContent.innerHTML = content;
      
      this.setupExploreToggleListeners();
      await this.loadExploreSubmode(this.currentExploreSubmode);
    } catch (error) {
      hubContent.innerHTML = `<div class="error">Error loading content: ${error.message}</div>`;
      Config.error('Error loading hub content:', error);
    }
  }

  async getExploreModeContent() {
    // Return the container that will hold both submodes
    return `
      <div class="explore-content">
        <div class="explore-submode-content" id="exploreModeContent">
          <div class="loading">Loading...</div>
        </div>
      </div>
    `;
  }

  // ========== Explore Submode Management ==========
  setupExploreToggleListeners() {
    // Target the new large buttons
    document.querySelectorAll('.explore-primary-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const submode = e.currentTarget.dataset.submode;
        this.switchExploreSubmode(submode);
      });
    });
  }

  switchExploreSubmode(submode) {
    this.currentExploreSubmode = submode;

    // Update active state on new buttons
    document.querySelectorAll('.explore-primary-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.submode === submode);
    });

    // Load new content
    this.loadExploreSubmode(submode);
  }

  async loadExploreSubmode(submode) {
    const contentEl = document.getElementById('exploreModeContent');
    if (!contentEl) return;
    
    try {
      contentEl.innerHTML = '<div class="loading">Loading...</div>';
      
      if (submode === 'tours') {
        if (!this.tourViewer) {
          this.tourViewer = new TourViewer(this);
          window.tourViewer = this.tourViewer;
        }
        const content = await this.tourViewer.renderTourContentOnly(this.currentWorld.id);
        contentEl.innerHTML = content;
        this.tourViewer.setupTourCardListeners();
      } else if (submode === 'database') {
        // FIXED: Create once and reuse - don't recreate on every switch
        if (!this.articleViewer) {
          this.articleViewer = new ArticleViewer(this);
          window.articleViewer = this.articleViewer;
          Config.log('Created new ArticleViewer instance');
        } else {
          Config.log('Reusing existing ArticleViewer instance');
        }
        const content = await this.articleViewer.renderReadMode(this.currentWorld.id);
        contentEl.innerHTML = content;
        this.articleViewer.setupEventListeners();
      }
    } catch (error) {
      contentEl.innerHTML = `<div class="error">Error loading ${submode}: ${error.message}</div>`;
      Config.error('Error loading explore submode:', error);
    }
  }

  // ========== Tour Data Loading ==========
  async loadTours(worldId) {
    try {
      const url = Config.getUrl(Config.ENDPOINTS.TOURS, { world_id: worldId });
      const data = await this.jsonp(url);
      return data.success ? data.data : [];
    } catch (error) {
      Config.error('Failed to load tours:', error);
      return [];
    }
  }

  async loadTourSlides(tourId) {
    try {
      const url = Config.getUrl(Config.ENDPOINTS.TOUR_SLIDES, { tour_id: tourId });
      const data = await this.jsonp(url);
      return data.success ? data.data : [];
    } catch (error) {
      Config.error('Failed to load tour slides:', error);
      return [];
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
    // Cache background video elements - now includes neutral
    this.backgroundVideos = {
      neutral: document.getElementById('bgVideo-neutral'),
      breach: document.getElementById('bgVideo-breach'),
      meridian: document.getElementById('bgVideo-meridian'),
      laguna: document.getElementById('bgVideo-laguna')
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
      
      // REMOVED: mouseleave logic - background now stays on last hovered world
      // No more automatic return when leaving cards
    });
  }

  // NEW: Activate a world's background video
  activateWorldBackground(worldId) {
    Config.log(`Activating background for: ${worldId}`);
    
    if (this.activeBackgroundWorld === worldId) {
      Config.log(`${worldId} already active, skipping`);
      return;
    }
    
    // Deactivate current - IMPORTANT: pause the video too
    if (this.backgroundVideos[this.activeBackgroundWorld]) {
      Config.log(`Deactivating ${this.activeBackgroundWorld}`);
      const currentVideo = this.backgroundVideos[this.activeBackgroundWorld];
      currentVideo.classList.remove('active');
      currentVideo.pause(); // ADD: Stop the current video
    }
    
    // Activate new
    if (this.backgroundVideos[worldId]) {
      Config.log(`Activating ${worldId}, adding .active class`);
      const newVideo = this.backgroundVideos[worldId];
      newVideo.classList.add('active');
      newVideo.currentTime = 0; // ADD: Reset to start
      newVideo.play()
        .then(() => Config.log(`${worldId} video playing`))
        .catch(e => Config.error(`${worldId} video play blocked:`, e));
    } else {
      Config.error(`No background video found for ${worldId}`);
    }
    
    this.activeBackgroundWorld = worldId;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.hub = new TTRPGHub();
});