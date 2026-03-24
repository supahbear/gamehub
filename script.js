// Clean TTRPG Hub - Refactored for maintainability with unified explore mode
class TTRPGHub {
  constructor() {
    this.currentWorld = null;
    this.currentMode = 'explore'; // Always explore mode
    this.currentSelectedPanel = 'encyclopedia';
    this.worlds = [];
    this._sheetCache = null;     // Prefetched sheet data, keyed by sheet name
    this._sheetPrefetch = null; // In-flight prefetch promise
    
    this.activeBackgroundWorld = 'neutral'; // Changed from 'breach' to 'neutral'
    this.backgroundVideos = {};

    this.init();
  }

  async init() {
    this.setupEventListeners();
    
    await this.loadWorlds();
    this.renderWorlds();
    
    Config.log('TTRPG Hub initialized');
  }

  // ========== Event Listeners ==========
  setupEventListeners() {
    // Logo click handler reloads the page via onclick in HTML
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
    // World list is not served by the sheet-based backend — always use fallback
    throw new Error('World list not available from sheet backend');
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
    const alreadyLoaded = this.currentWorld && this.currentWorld.id === worldId;
    this.currentWorld = this.worlds.find(w => w.id === worldId);
    if (this.currentWorld) {
      Config.log('Selected world:', this.currentWorld.name);
      this.applyWorldTheme(worldId);
      // Skip full re-init if returning to an already-loaded world
      if (alreadyLoaded) {
        this.setPageVisibility('hub');
      } else {
        this.showWorldHub();
      }
    }
  }

  showWorldSelection() {
    this.setPageVisibility('landing');
    // Keep currentWorld so the card re-entry skips re-init
    this.currentMode = 'explore';
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
    this.currentSelectedPanel = this.currentSelectedPanel || 'encyclopedia';
    this.initModalHandlers();
    this.initializePanels();
    // Prefetch all sheets in the background so panels open instantly
    this._prefetchAllSheets();
    Config.log('showWorldHub: About to activate breach background');
    this.activateWorldBackground('breach');
  }

  // ========== Global Modal Handlers ==========
  initModalHandlers() {
    const closeBtn = document.getElementById('closeModalBtn');
    const overlay  = document.getElementById('modalOverlay');
    const modal    = document.getElementById('articleModal');

    if (closeBtn && !closeBtn._hubClose) {
      closeBtn.addEventListener('click', () => this.closeModal());
      closeBtn._hubClose = true;
    }
    if (overlay && !overlay._hubOverlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeModal();
      });
      overlay._hubOverlay = true;
    }
    if (modal && !modal._hubModal) {
      modal.addEventListener('click', (e) => e.stopPropagation());
      modal._hubModal = true;
    }
    if (!this._hubEscBound) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('modal-active')) {
          this.closeModal();
        }
      });
      this._hubEscBound = true;
    }
  }

  closeModal() {
    const modal   = document.getElementById('articleModal');
    const overlay = document.getElementById('modalOverlay');
    if (modal)   modal.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
    document.body.classList.remove('modal-active');
    // Clean up per-open listeners from viewers
    if (this.articleViewer?._arrowKeyHandler) {
      document.removeEventListener('keydown', this.articleViewer._arrowKeyHandler);
      this.articleViewer._arrowKeyHandler = null;
    }
    if (this.atlasViewer) this.atlasViewer._lightboxOpen = false;
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
      // Sync pill glow with panel hover
      panel.addEventListener('mouseenter', () => {
        const pill = document.querySelector(`.panel-pill[data-panel="${panel.dataset.panel}"]`);
        if (pill) pill.classList.add('panel-hovered');
      });
      panel.addEventListener('mouseleave', () => {
        const pill = document.querySelector(`.panel-pill[data-panel="${panel.dataset.panel}"]`);
        if (pill) pill.classList.remove('panel-hovered');
      });
    });

    // Setup panel pill button listeners
    document.querySelectorAll('.panel-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectPanel(e.currentTarget.dataset.panel);
      });
      // Sync panel glow with pill hover
      btn.addEventListener('mouseenter', () => {
        const panel = document.querySelector(`.hub-panel[data-panel="${btn.dataset.panel}"]`);
        if (panel) panel.classList.add('pill-hovered');
      });
      btn.addEventListener('mouseleave', () => {
        const panel = document.querySelector(`.hub-panel[data-panel="${btn.dataset.panel}"]`);
        if (panel) panel.classList.remove('pill-hovered');
      });
    });

    // Panels start collapse to show selectors
    this.currentSelectedPanel = null;
  }

  async selectPanel(panelName) {
    // Toggle off if already active — reinstate 3-split view
    if (this.currentSelectedPanel === panelName) {
      this.currentSelectedPanel = null;
      const container = document.getElementById('hubPanelsContainer');
      const collapsedHeader = document.getElementById('hubCollapsedHeader');
      container.removeAttribute('data-expanded');
      document.querySelectorAll('.hub-panel').forEach(p => {
        p.classList.remove('expanded');
        // Hide content, restore selector so panels look correct in 3-split
        const content = p.querySelector('.panel-content');
        const selector = p.querySelector('.panel-selector');
        if (content) content.style.display = 'none';
        if (selector) selector.style.display = '';
        // Restore bg video
        const video = p.querySelector('.panel-bg-video');
        if (video) { video.style.transition = 'opacity 0.3s ease'; video.style.opacity = '1'; }
      });
      document.querySelectorAll('.panel-pill').forEach(btn => btn.classList.remove('active'));
      collapsedHeader.style.display = 'flex';
      return;
    }

    this.currentSelectedPanel = panelName;
    
    const container = document.getElementById('hubPanelsContainer');
    const collapsedHeader = document.getElementById('hubCollapsedHeader');
    const panels = document.querySelectorAll('.hub-panel');
    
    // Update pill button active state
    document.querySelectorAll('.panel-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.panel === panelName);
    });

    // Step 1: instantly kill the expanding panel's video — no transition,
    // so there is nothing visible to stretch when the wipe starts.
    panels.forEach(panel => {
      const video = panel.querySelector('.panel-bg-video');
      if (!video) return;
      if (panel.dataset.panel === panelName) {
        video.style.transition = 'none';
        video.style.opacity = '0';
      }
    });

    // Step 2: defer the actual wipe until the browser has committed the
    // opacity change to the compositor (two rAF = paint + composite).
    requestAnimationFrame(() => requestAnimationFrame(() => {

      // Drive the directional wipe via data attribute on container
      if (panelName) {
        container.setAttribute('data-expanded', panelName);
      } else {
        container.removeAttribute('data-expanded');
      }

      // Mark expanded class for content/video logic; show/hide content vs selector
      panels.forEach(panel => {
        const isExpanded = panel.dataset.panel === panelName;
        panel.classList.toggle('expanded', isExpanded);
        const content = panel.querySelector('.panel-content');
        const selector = panel.querySelector('.panel-selector');
        if (isExpanded) {
          if (content) content.style.display = '';
          if (selector) selector.style.display = 'none';
        }
      });

      // Show/hide collapsed header based on whether any panel is selected
      if (panelName) {
        collapsedHeader.style.display = 'flex';
      }

    })); // end requestAnimationFrame

    // Load content for the selected panel if not already loaded
    await this.loadPanelContent(panelName);
  }

  // Fade out current content, swap HTML, fade back in.
  // Pass markLoaded=false to skip the permanent cache flag (e.g. empty state).
  async _fadeInContent(contentEl, html, markLoaded = true) {
    contentEl.style.transition = 'opacity 0.2s ease';
    contentEl.style.opacity    = '0';
    await new Promise(r => setTimeout(r, 220));
    contentEl.innerHTML        = html;
    if (markLoaded) contentEl.dataset.loaded = 'true';
    requestAnimationFrame(() => {
      contentEl.style.transition = 'opacity 0.4s ease';
      contentEl.style.opacity    = '1';
    });
  }

  async loadPanelContent(panelName) {
    const idMap = {
      encyclopedia: 'encyclopediaContent',
      journal:      'journalContent',
      atlas:        'atlasContent',
      bestiary:     'bestiaryContent',
      alchemy:      'alchemyContent',
      literature:   'literatureContent'
    };
    const contentEl = document.getElementById(idMap[panelName]);
    if (!contentEl) return;

    // Already loaded — selectPanel already faded it in, nothing more to do
    if (contentEl.dataset.loaded === 'true') return;

    try {
      // contentEl is already showing the loading text (set by selectPanel)

      if (panelName === 'encyclopedia') {
        if (!this.articleViewer) {
          this.articleViewer = new ArticleViewer(this, ['Characters', 'Factions', 'Religion', 'Items'], 'Characters');
          window.articleViewer = this.articleViewer;
          Config.log('Created ArticleViewer for encyclopedia');
        }
        const content = await this.articleViewer.renderReadMode(this.currentWorld.id);
        await this._fadeInContent(contentEl, content, this.articleViewer.currentArticles.length > 0);
        this.articleViewer.setupEventListeners();

      } else if (panelName === 'journal') {
        if (!this.questViewer) {
          this.questViewer = new QuestViewer(this);
          window.questViewer = this.questViewer;
          Config.log('Created QuestViewer for journal');
        }
        const content = await this.questViewer.renderQuestMode(this.currentWorld.id);
        await this._fadeInContent(contentEl, content);
        this.questViewer.setupEventListeners();

      } else if (panelName === 'atlas') {
        if (!this.atlasViewer) {
          this.atlasViewer = new AtlasViewer(this);
          window.atlasViewer = this.atlasViewer;
          Config.log('Created AtlasViewer for atlas');
        }
        const content = await this.atlasViewer.renderAtlasMode(this.currentWorld.id);
        await this._fadeInContent(contentEl, content);
        this.atlasViewer.setupEventListeners();

      } else if (panelName === 'bestiary') {
        if (!this.bestiaryViewer) {
          this.bestiaryViewer = new ArticleViewer(this, ['Bestiary'], 'Bestiary');
          window.bestiaryViewer = this.bestiaryViewer;
          Config.log('Created ArticleViewer for bestiary');
        }
        const content = await this.bestiaryViewer.renderReadMode(this.currentWorld.id);
        await this._fadeInContent(contentEl, content, this.bestiaryViewer.currentArticles.length > 0);
        this.bestiaryViewer.setupEventListeners();

      } else if (panelName === 'alchemy') {
        if (!this.alchemyViewer) {
          this.alchemyViewer = new ArticleViewer(this, ['Alchemy'], 'Alchemy');
          window.alchemyViewer = this.alchemyViewer;
          Config.log('Created ArticleViewer for alchemy');
        }
        const content = await this.alchemyViewer.renderReadMode(this.currentWorld.id);
        await this._fadeInContent(contentEl, content, this.alchemyViewer.currentArticles.length > 0);
        this.alchemyViewer.setupEventListeners();

      } else if (panelName === 'literature') {
        if (!this.literatureViewer) {
          this.literatureViewer = new ArticleViewer(this, ['Literature'], 'Literature');
          window.literatureViewer = this.literatureViewer;
          Config.log('Created ArticleViewer for literature');
        }
        const content = await this.literatureViewer.renderReadMode(this.currentWorld.id);
        await this._fadeInContent(contentEl, content, this.literatureViewer.currentArticles.length > 0);
        this.literatureViewer.setupEventListeners();
      }
    } catch (error) {
      await this._fadeInContent(contentEl, `<div class="error">Error loading ${panelName}: ${error.message}</div>`);
      Config.error(`Error loading ${panelName}:`, error);
    }
  }

  // ========== Data Loading ==========
  // Fetch all sheets in one JSONP call and cache by sheet name.
  // Subsequent loadSheets() calls are served instantly from cache.
  async _prefetchAllSheets() {
    if (this._sheetCache || this._sheetPrefetch) return; // Already done or in flight
    const allSheets = Object.values(Config.SHEETS);
    this._sheetPrefetch = this.jsonp(Config.getSheetUrl(allSheets));
    try {
      const data = await this._sheetPrefetch;
      if (data.success) {
        // Index rows by _category for fast lookup
        const cache = {};
        (data.data || []).forEach(row => {
          const cat = row._category;
          if (cat) {
            if (!cache[cat]) cache[cat] = [];
            cache[cat].push(row);
          }
        });
        this._sheetCache = cache;
        Config.log('Sheet prefetch complete. Cached categories:', Object.keys(cache));
      } else {
        Config.warn('Sheet prefetch failed:', data.error);
      }
    } catch (e) {
      Config.warn('Sheet prefetch error:', e.message);
    } finally {
      this._sheetPrefetch = null;
    }
  }

  // Fetches one or more sheet names in a single JSONP request.
  // Returns the flat array of row objects, each with a ._category field.
  async loadSheets(sheetNames) {
    try {
      // Serve from prefetch cache when available
      if (this._sheetCache) {
        const rows = sheetNames.flatMap(name => this._sheetCache[name] || []);
        Config.log(`loadSheets served ${rows.length} rows from cache for:`, sheetNames);
        return rows;
      }
      // Cache not ready — wait for in-flight prefetch if one exists.
      // Isolate in its own try/catch so a prefetch failure still falls through
      // to the direct request below instead of returning [] immediately.
      if (this._sheetPrefetch) {
        Config.log('loadSheets waiting for prefetch to complete...');
        try { await this._sheetPrefetch; } catch (e) { Config.warn('Prefetch rejected, falling back to direct request:', e.message); }
        if (this._sheetCache) {
          const rows = sheetNames.flatMap(name => this._sheetCache[name] || []);
          Config.log(`loadSheets served ${rows.length} rows from cache (after wait) for:`, sheetNames);
          return rows;
        }
      }
      // Fall back to direct request
      const url = Config.getSheetUrl(sheetNames);
      const data = await this.jsonp(url);
      if (!data.success) {
        Config.error('loadSheets failed:', data.error);
        return [];
      }
      return data.data || [];
    } catch (error) {
      Config.error('loadSheets error:', error);
      return [];
    }
  }

  // ========== Utility Methods ==========
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

  setupWorldBackgrounds() {
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