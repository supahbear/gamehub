// Clean TTRPG Hub - Refactored for maintainability
class TTRPGHub {
  constructor() {
    this.currentWorld = null;
    this.currentMode = null;
    this.worlds = [];
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.addDebugControls();
    this.loadWorlds();
  }

  // ========== Event Listeners ==========
  setupEventListeners() {
    // Back buttons
    const backBtn = document.getElementById('backBtn');
    const hubBackBtn = document.getElementById('hubBackBtn');
    
    if (backBtn) {
      backBtn.addEventListener('click', () => this.showWorldSelection());
    }
    if (hubBackBtn) {
      hubBackBtn.addEventListener('click', () => this.showModeSelection());
    }

    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        this.selectMode(mode);
      });
    });
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
          video_url: world.video_url || null // New field for video
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
        video_url: 'assets/videos/breach-loop.mp4'
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
      worldsGrid.innerHTML = '<div class="world-card loading">No worlds available</div>';
      return;
    }

    worldsGrid.innerHTML = this.worlds.map(world => this.renderWorldCard(world)).join('');

    // Add click listeners to world cards
    worldsGrid.querySelectorAll('.world-card').forEach(card => {
      if (!card.classList.contains('loading')) {
        card.addEventListener('click', (e) => {
          const worldId = e.currentTarget.dataset.worldId;
          this.selectWorld(worldId);
        });
      }
    });

    // Setup hover-to-play for video cards
    this.setupVideoHoverEvents();

    Config.log(`Rendered ${this.worlds.length} worlds`);
  }

  setupVideoHoverEvents() {
    const worldCards = document.querySelectorAll('.world-card');
    
    worldCards.forEach(card => {
      const video = card.querySelector('.world-video');
      if (!video) return;
      
      // Pause video initially and show first frame
      video.addEventListener('loadeddata', () => {
        video.currentTime = 0;
        video.pause();
      });
      
      // Play on hover
      card.addEventListener('mouseenter', () => {
        video.play().catch(e => Config.log('Video play failed:', e));
      });
      
      // Pause on leave and reset to first frame
      card.addEventListener('mouseleave', () => {
        video.pause();
        video.currentTime = 0;
      });
    });
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
        <div class="world-overlay">
          <div class="world-name">${world.name}</div>
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
      // Apply world theme when entering a world
      this.applyWorldTheme(worldId);
      this.showModeSelection();
    }
  }

  selectMode(mode) {
    this.currentMode = mode;
    Config.log('Selected mode:', mode);
    this.showWorldHub();
  }

  showWorldSelection() {
    this.setPageVisibility('landing');
    this.currentWorld = null;
    this.currentMode = null;
    // Clear world theme when returning to hub
    this.clearWorldTheme();
  }

  showModeSelection() {
    this.setPageVisibility('mode');
  }

  showWorldHub() {
    this.setPageVisibility('hub');
    this.updateHubHeader();
    this.loadHubContent();
  }

  setPageVisibility(activePage) {
    const pages = {
      landing: document.querySelector('.landing-screen'),
      mode: document.getElementById('modeSelection'),
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

    if (worldNameEl && this.currentWorld) {
      worldNameEl.textContent = this.currentWorld.name;
    }
    if (modeEl && this.currentMode) {
      modeEl.textContent = `Mode: ${this.currentMode.charAt(0).toUpperCase() + this.currentMode.slice(1)}`;
    }
  }

  // ========== Hub Content ==========
  async loadHubContent() {
    const hubContent = document.getElementById('hubContent');
    if (!hubContent) return;

    const contentMap = {
      play: () => this.getPlayModeContent(),
      read: () => this.getReadModeContent(), 
      build: () => this.getBuildModeContent()
    };

    const contentFunction = contentMap[this.currentMode];
    if (contentFunction) {
      try {
        hubContent.innerHTML = '<div class="loading">Loading...</div>';
        const content = await contentFunction();
        hubContent.innerHTML = content;
        
        if (this.currentMode === 'read' && this.articleViewer) {
          this.articleViewer.setupEventListeners();
        }
      } catch (error) {
        hubContent.innerHTML = `<div class="error">Error loading ${this.currentMode} mode: ${error.message}</div>`;
        Config.error('Error loading hub content:', error);
      }
    } else {
      hubContent.innerHTML = '<p>Unknown mode selected.</p>';
    }
  }

  getPlayModeContent() {
    return this.createModeContent('🎲 Play Mode', [
      { title: 'Character Sheets', desc: 'Manage your characters', action: 'Character sheets coming soon!' },
      { title: 'Dice Roller', desc: 'Roll dice for actions', action: 'Dice roller coming soon!' },
      { title: 'Session Notes', desc: 'Track your adventure', action: 'Session notes coming soon!' },
      { title: 'Maps & Tokens', desc: 'Visual battle maps', action: 'Maps coming soon!' }
    ], '#4CAF50');
  }

  async getReadModeContent() {
    if (!this.articleViewer) {
      this.articleViewer = new ArticleViewer(this);
      window.articleViewer = this.articleViewer;
    }
    
    return await this.articleViewer.renderReadMode(this.currentWorld.id);
  }

  getBuildModeContent() {
    return this.createModeContent('🔨 Build Mode', [
      { title: 'World Editor', desc: 'Modify world details', action: 'World editor coming soon!' },
      { title: 'NPC Creator', desc: 'Design characters', action: 'NPC creator coming soon!' },
      { title: 'Location Builder', desc: 'Create places', action: 'Location builder coming soon!' },
      { title: 'Content Manager', desc: 'Organize all content', action: 'Content manager coming soon!' }
    ], '#FF9800');
  }

  createModeContent(title, tools, color) {
    const worldName = this.currentWorld?.name || 'World';
    const toolCards = tools.map(tool => `
      <div class="tool-card">
        <h4>${tool.title}</h4>
        <p>${tool.desc}</p>
        <button onclick="alert('${tool.action}')" style="background: ${color};">
          ${tool.title.includes('Roll') ? 'Roll' : tool.title.includes('Open') ? 'Open' : 
            tool.title.includes('View') ? 'View' : tool.title.includes('Load') ? 'Load' :
            tool.title.includes('Browse') ? 'Browse' : tool.title.includes('Read') ? 'Read' :
            tool.title.includes('Edit') ? 'Edit' : tool.title.includes('Create') ? 'Create' :
            tool.title.includes('Build') ? 'Build' : 'Manage'}
        </button>
      </div>
    `).join('');

    return `
      <h3>${title} - ${worldName}</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px;">
        ${toolCards}
      </div>
      <style>
        .tool-card {
          background: ${color}1A;
          border: 1px solid ${color}4D;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
        }
        .tool-card button {
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
        }
      </style>
    `;
  }

  // ========== Debug Tools ==========
  addDebugControls() {
    if (!Config.DEBUG_MODE) return;

    const debugButton = document.createElement('button');
    debugButton.textContent = '🔧 Test Apps Script';
    debugButton.style.cssText = `
      position: fixed; top: 10px; right: 10px; z-index: 1000;
      padding: 10px; background: #ff6b35; color: white;
      border: none; border-radius: 5px; cursor: pointer;
    `;
    
    debugButton.addEventListener('click', () => this.testAppsScript());
    document.body.appendChild(debugButton);
  }

  async testAppsScript() {
    Config.log('=== Apps Script Connection Test ===');
    
    // Test basic connectivity
    try {
      const response = await fetch(Config.APPS_SCRIPT_URL);
      Config.log('Basic connectivity - Status:', response.status);
      
      const text = await response.text();
      Config.log('Response preview:', text.substring(0, 300));
    } catch (error) {
      Config.error('Basic connectivity failed:', error);
    }

    // Test worlds endpoint
    try {
      const worldsUrl = Config.getUrl(Config.ENDPOINTS.WORLDS);
      Config.log('Testing worlds endpoint:', worldsUrl);
      
      const response = await fetch(worldsUrl);
      const text = await response.text();
      
      Config.log('Worlds response status:', response.status);
      Config.log('Worlds response:', text);
      
      try {
        const data = JSON.parse(text);
        Config.log('Parsed worlds data:', data);
      } catch (parseError) {
        Config.error('JSON parse error:', parseError);
      }
    } catch (error) {
      Config.error('Worlds endpoint test failed:', error);
    }
  }

  // ========== Additional API Methods ==========
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new TTRPGHub();
});