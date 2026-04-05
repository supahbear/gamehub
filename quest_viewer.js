// quest_viewer.js - Quest log viewer with expandable location-based navigation
class QuestViewer {
  constructor(hub) {
    this.hub = hub;
    this.currentQuests = [];
    this.currentFilters = {
      tag: '', // Location/tag filter
      search: ''
    };
    this.selectedQuestId = null;
    this.expandedTags = new Set(); // Track which location tabs are expanded
  }

  async loadQuestData() {
    try {
      const rows = await this.hub.loadSheets(['Journal']);
      // Assign a stable positional ID so selection/lookup always works.
      // _rowIndex is never injected by the backend, so we assign it here.
      rows.forEach((row, i) => { row._rowIndex = String(i); });
      this.currentQuests = rows;
      Config.log(`QuestViewer loaded ${rows.length} journal entries`);
      return { quests: this.currentQuests };
    } catch (error) {
      Config.error('Failed to load quest data:', error);
      this.currentQuests = [];
      return { quests: [] };
    }
  }

  async renderQuestMode(worldId) {
    await this.loadQuestData();

    if (this.currentQuests.length === 0) {
      return this.renderEmptyState();
    }

    // Auto-select first quest and auto-expand its location group if none selected
    if (!this.selectedQuestId && this.currentQuests.length > 0) {
      this.selectedQuestId = String(this.currentQuests[0]._rowIndex);
      // Also expand the group the first quest belongs to so the sidebar isn't blank
      const firstTags = (this.currentQuests[0].tags || '').split(',').map(t => t.trim()).filter(t => t);
      const firstLocation = firstTags[0] || 'Miscellaneous';
      this.expandedTags.add(firstLocation);
    }

    return `
      <div class="quest-viewer">
        ${this.renderQuestLayout()}
      </div>
    `;
  }

  renderEmptyState() {
    return `
      <div class="empty-state">
        <div class="empty-icon">📜</div>
        <h3>No Quests Available</h3>
        <p>This world doesn't have any quests set up yet.</p>
      </div>
    `;
  }

  renderQuestLayout() {
    return `
      <div class="quest-layout">
        <div class="quest-sidebar">
          ${this.renderLocationTabs()}
        </div>
        <div class="quest-content">
          ${this.renderQuestDetail()}
        </div>
      </div>
    `;
  }

  renderLocationTabs() {
    // Group quests by location (primary tag)
    const questsByLocation = this.groupQuestsByLocation();
    
    return `
      <div class="quest-locations">
        <div class="quest-search-bar">
          <input type="text" 
                 id="questSearch" 
                 placeholder="Search quests..." 
                 value="${this.currentFilters.search}">
        </div>
        <div class="quest-locations-container">
          ${Object.entries(questsByLocation).map(([location, quests]) => 
            this.renderLocationTab(location, quests)
          ).join('')}
        </div>
      </div>
    `;
  }

  groupQuestsByLocation() {
    const grouped = {};
    
    this.currentQuests.forEach(quest => {
      // Filter by search if active
      if (this.currentFilters.search) {
        const searchTerm = this.currentFilters.search.toLowerCase();
        const searchableText = `${quest.name} ${quest.summary || ''} ${quest.content || ''}`.toLowerCase();
        if (!searchableText.includes(searchTerm)) return;
      }
      
      const tags = (quest.tags || '').split(',').map(t => t.trim()).filter(t => t);
      const location = tags[0] || 'Miscellaneous';
      
      if (!grouped[location]) {
        grouped[location] = [];
      }
      grouped[location].push(quest);
    });
    
    // Sort locations alphabetically, but always put "Completed" last
    const sortedGrouped = {};
    const locations = Object.keys(grouped).sort((a, b) => {
      // Force "Completed" to the bottom
      if (a.toLowerCase() === 'completed') return 1;
      if (b.toLowerCase() === 'completed') return -1;
      // Normal alphabetical sort for everything else
      return a.localeCompare(b);
    });
    
    locations.forEach(key => {
      sortedGrouped[key] = grouped[key].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });
    
    return sortedGrouped;
  }

  renderLocationTab(location, quests) {
    const isExpanded = this.expandedTags.has(location);
    const hasSelectedQuest = quests.some(q => String(q._rowIndex) === this.selectedQuestId);
    
    return `
      <div class="location-tab ${hasSelectedQuest ? 'has-active' : ''}">
        <button class="location-header ${isExpanded ? 'expanded' : ''}" data-location="${location}">
          <span class="location-icon">${isExpanded ? '▼' : '▶'}</span>
          <span class="location-name">${location}</span>
          <span class="location-count">${quests.length}</span>
        </button>
        <div class="location-content ${isExpanded ? 'expanded' : ''}">
          ${quests.map(quest => this.renderQuestListItem(quest)).join('')}
        </div>
      </div>
    `;
  }

  renderQuestListItem(quest) {
    const isSelected = String(quest._rowIndex) === this.selectedQuestId;
    
    return `
      <button class="quest-list-item ${isSelected ? 'selected' : ''}" data-quest-id="${quest._rowIndex}">
        ${quest.name}
      </button>
    `;
  }

  renderQuestDetail() {
    const quest = this.currentQuests.find(q => String(q._rowIndex) === String(this.selectedQuestId));
    
    if (!quest) {
      return `
        <div class="quest-detail-empty">
          <p>Select a quest to view details</p>
        </div>
      `;
    }

    const htmlContent = this.markdownToHtml(quest.content || 'No content available');
    
    // Format summary with "Questgiver:" prefix if it exists
    const formattedSummary = quest.summary ? 
      `<div class="quest-detail-summary"><strong>Questgiver:</strong> <em>${quest.summary}</em></div>` : 
      '';
    
    return `
      <div class="quest-detail">
        <div class="quest-detail-header">
          <h2 class="quest-detail-title">${quest.name}</h2>
        </div>
        ${quest.image_url ? `
          <div class="quest-detail-image">
            <img src="${quest.image_url}" alt="${quest.name}" loading="lazy">
          </div>
        ` : ''}
        ${formattedSummary}
        <div class="quest-detail-body">
          ${htmlContent}
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Setup sidebar listeners (location tabs, quest items, search)
    this.setupSidebarListeners();
  }

  setupSidebarListeners() {
    // Location headers and quest items
    this.setupLocationListeners();

    // Search input - DON'T refresh entire sidebar, just the list
    const searchInput = document.getElementById('questSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.currentFilters.search = e.target.value;
        clearTimeout(this._searchTimeout);
        this._searchTimeout = setTimeout(() => {
          this.refreshQuestList(); // Only refresh the quest list
        }, 300);
      });
    }
  }

  setupLocationListeners() {
    // Location headers
    document.querySelectorAll('.location-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const location = e.currentTarget.dataset.location;
        this.toggleLocationTab(location);
      });
    });

    // Quest list items
    document.querySelectorAll('.quest-list-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const questId = e.currentTarget.dataset.questId;
        this.selectQuest(questId);
      });
    });
  }

  toggleLocationTab(location) {
    if (this.expandedTags.has(location)) {
      this.expandedTags.delete(location);
    } else {
      this.expandedTags.add(location);
    }
    // Still need to refresh list for expand/collapse animation
    this.refreshQuestList();
  }

  selectQuest(questId) {
    this.selectedQuestId = questId;
    
    // Only update selection states, don't rebuild the list
    this.updateSelectionStates();
    
    // Refresh content area
    this.refreshQuestContent();
  }

  // Update CSS classes without rebuilding DOM
  updateSelectionStates() {
    // Update quest item selection states
    document.querySelectorAll('.quest-list-item').forEach(item => {
      const isSelected = item.dataset.questId === this.selectedQuestId;
      item.classList.toggle('selected', isSelected);
    });
    
    // Update location tab active states
    document.querySelectorAll('.location-tab').forEach(tab => {
      const questItems = tab.querySelectorAll('.quest-list-item');
      const hasSelected = Array.from(questItems).some(item => 
        item.dataset.questId === this.selectedQuestId
      );
      tab.classList.toggle('has-active', hasSelected);
    });
  }

  // Refresh only the quest list portion, preserving search input
  refreshQuestList() {
    const listContainer = document.querySelector('.quest-locations-container');
    if (listContainer) {
      const questsByLocation = this.groupQuestsByLocation();
      listContainer.innerHTML = Object.entries(questsByLocation)
        .map(([location, quests]) => this.renderLocationTab(location, quests))
        .join('');
      
      // Re-setup listeners for location tabs and quest items only
      this.setupLocationListeners();
    }
  }

  // Refresh only the content (right column) with fade effect
  refreshQuestContent() {
    const content = document.querySelector('.quest-content');
    if (content) {
      // Add fade-out class
      content.style.opacity = '0';
      content.style.transform = 'translateY(10px)';
      
      // Wait for fade-out, then update content
      setTimeout(() => {
        content.innerHTML = this.renderQuestDetail();
        // Trigger reflow to ensure animation restarts
        void content.offsetWidth;
        // Fade back in
        content.style.opacity = '';
        content.style.transform = '';
      }, 150);
    }
  }

  markdownToHtml(markdown) {
    if (!markdown) return 'No content available';
    
    // Split into lines for processing
    let lines = markdown.split('\n');
    let html = '';
    let inList = false;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Check for bullet points (*, -, or •)
      if (line.trim().match(/^[*\-•]\s+(.+)$/)) {
        const content = line.trim().replace(/^[*\-•]\s+/, '');
        
        // Start list if not in one
        if (!inList) {
          html += '<ul>';
          inList = true;
        }
        
        html += `<li>${content}</li>`;
        
        // Check if next line is also a list item
        const nextLine = lines[i + 1];
        if (!nextLine || !nextLine.trim().match(/^[*\-•]\s+/)) {
          html += '</ul>';
          inList = false;
        }
      } else {
        // Close list if we were in one
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        
        // Process other markdown
        line = line
          .replace(/^### (.*$)/gim, '<h3>$1</h3>')
          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
          .replace(/^# (.*$)/gim, '<h1>$1</h1>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        if (line.trim()) {
          if (!line.match(/<h[123]>/)) {
            html += `<p>${line}</p>`;
          } else {
            html += line;
          }
        }
      }
    }
    
    // Close list if still open
    if (inList) {
      html += '</ul>';
    }
    
    return html;
  }
}

// Export for use in main hub
window.QuestViewer = QuestViewer;
