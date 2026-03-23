// article-viewer.js - Redesigned for overlay card system with unified explore mode safety
class ArticleViewer {
  // allowedSheets: array of sheet names this viewer may display, e.g. ['Characters','Factions','Religion']
  // defaultSheet:  the sheet that is selected by default, e.g. 'Characters'
  constructor(hub, allowedSheets = ['Characters'], defaultSheet = null) {
    this.hub = hub;
    this.allowedSheets = Array.isArray(allowedSheets) ? allowedSheets : [allowedSheets];
    this.defaultSheet = defaultSheet || this.allowedSheets[0];
    this.currentArticles = [];
    this.currentFilters = {
      category: '',
      tag: '',
      search: ''
    };
    // Prevent duplicate bindings on re-render
    this._filtersBound = false;
    this._modalBound = false;
    this._hasInitialized = false;
  }

  async loadArticleData() {
    try {
      const rows = await this.hub.loadSheets(this.allowedSheets);
      // Assign a stable unique ID to every article by position so lookups
      // are never confused by _rowIndex collisions or missing values.
      rows.forEach((row, i) => { row._uid = String(i); });
      this.currentArticles = rows;

      if (!this._hasInitialized) {
        this.currentFilters.category = this.defaultSheet;
        this._hasInitialized = true;
        Config.log(`ArticleViewer default sheet: ${this.defaultSheet}`);
      }

      Config.log(`ArticleViewer loaded ${rows.length} rows from sheets:`, this.allowedSheets);
      return rows;
    } catch (error) {
      Config.error('Failed to load article data:', error);
      return [];
    }
  }

  async renderReadMode(worldId) {
    // RESET: Allow re-initialization each time we render Articles view
    this._hasInitialized = false;
    
    // Load data FIRST, which sets the default category
    await this.loadArticleData();

    if (this.currentArticles.length === 0) {
      // Still render wrapper so refresh logic stays stable
      return `
        <div class="article-viewer">
          ${this.renderFilters()}
          <div id="articlesGridContainer">
            ${this.renderEmptyState()}
          </div>
        </div>
      `;
    }

    // Check if HTML modals exist - no need to inject if already there
    if (!this.checkModalExists()) {
      Config.warn('Article modal not found in HTML - functionality may be limited');
    }

    // NOW render with the correct filter already set
    return `
      <div class="article-viewer">
        ${this.renderFilters()}
        <div id="articlesGridContainer">
          ${this.renderArticleGrid()}
        </div>
      </div>
    `;
  }

  checkModalExists() {
    const overlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('articleModal');
    return !!(overlay && modal);
  }

  renderEmptyState() {
    return `
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <h3>No Articles Yet</h3>
        <p>This world doesn't have any published articles yet.</p>
        <p>Switch to Tours to explore guided content instead.</p>
      </div>
    `;
  }

  renderFilters() {
    const multiSheet = this.allowedSheets.length > 1;

    // Only get tags from articles in the current sheet filter (or all if no filter)
    const articlesInCurrentCategory = this.currentFilters.category
      ? this.currentArticles.filter(article => article._category === this.currentFilters.category)
      : this.currentArticles;

    const allTags = [...new Set(
      articlesInCurrentCategory
        .flatMap(article => (article.tags || '').split(','))
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
    )].sort();

    const tagOptions = allTags
      .map(tag => `<option value="${tag}">${tag}</option>`)
      .join('');

    const categoryOptions = multiSheet
      ? this.allowedSheets
          .map(sheet => `<option value="${sheet}" ${this.currentFilters.category === sheet ? 'selected' : ''}>${sheet}</option>`)
          .join('')
      : '';

    return `
      <div class="article-filters">
        <div class="filter-group">
          <input type="text" 
                 id="articleSearch" 
                 placeholder="Search articles..." 
                 value="${this.currentFilters.search}">
        </div>
        ${multiSheet ? `
        <div class="filter-group">
          <select id="categoryFilter">
            <option value="">All Categories</option>
            ${categoryOptions}
          </select>
        </div>` : ''}
        <div class="filter-group">
          <select id="tagFilter">
            <option value="">All Tags</option>
            ${tagOptions}
          </select>
        </div>
        <button id="clearFilters" class="clear-btn">Clear All</button>
      </div>
    `;
  }

  renderArticleCard(article) {
    const tags = (article.tags || '').split(',').map(t => t.trim()).filter(t => t);
    const primaryTag = tags[0] || 'default';
    const cssTag = primaryTag.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hasImage = article.image_url && article.image_url.trim();
    const backgroundImage = hasImage ?
      `<img src="${article.image_url}" class="card-background" alt="${article.name}" loading="lazy">` :
      `<div class="card-background-placeholder"></div>`;

    return `
      <div class="article-card tag-${cssTag}" data-article-id="${article._uid}" data-article-category="${article._category}">
        ${backgroundImage}
        <span class="card-tag">${primaryTag}</span>
        <div class="card-overlay">
          <h4 class="card-title">${article.name}</h4>
          <p class="card-summary">${article.summary || 'No summary available'}</p>
        </div>
      </div>
    `;
  }

  renderArticleGrid() {
    const filteredArticles = this.filterArticles();
    
    if (filteredArticles.length === 0) {
      // Keep empty-state compact; wrapper remains stable
      return `
        <div class="no-results">
          <p>No articles match your current filters.</p>
          <button onclick="window.articleViewer && window.articleViewer.clearFilters()">Clear Filters</button>
        </div>
      `;
    }

    // Sort articles
    const sortedArticles = this.sortArticles(filteredArticles);
    const articleCards = sortedArticles.map(article => this.renderArticleCard(article)).join('');

    return `
      <div class="articles-grid">
        ${articleCards}
      </div>
    `;
  }

  sortArticles(articles) {
    if (!this.currentFilters.category) {
      // Group by sheet order, then alphabetical within each sheet
      return articles.sort((a, b) => {
        const idxA = this.allowedSheets.indexOf(a._category);
        const idxB = this.allowedSheets.indexOf(b._category);
        if (idxA !== idxB) return idxA - idxB;
        return (a.name || '').localeCompare(b.name || '');
      });
    } else {
      return articles.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
  }

  filterArticles() {
    return this.currentArticles.filter(article => {
      if (this.currentFilters.category && article._category !== this.currentFilters.category) {
        return false;
      }

      if (this.currentFilters.search) {
        const searchTerm = this.currentFilters.search.toLowerCase();
        const searchableText = `${article.name} ${article.summary || ''} ${article.content || ''}`.toLowerCase();
        if (!searchableText.includes(searchTerm)) return false;
      }

      if (this.currentFilters.tag) {
        const articleTags = (article.tags || '').split(',').map(t => t.trim().toLowerCase());
        if (!articleTags.includes(this.currentFilters.tag.toLowerCase())) return false;
      }

      return true;
    });
  }

  setupEventListeners() {
    // Bind filter controls once
    if (!this._filtersBound) {
      // Search input
      const searchInput = document.getElementById('articleSearch');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.currentFilters.search = e.target.value;
          this.refreshArticleGrid();
        });
      }

      // Category filter
      const categoryFilter = document.getElementById('categoryFilter');
      if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
          this.currentFilters.category = e.target.value;
          this.currentFilters.tag = ''; // Clear tag filter when category changes
          this.refreshFilters(); // Refresh filters to update tag dropdown
          this.refreshArticleGrid();
        });
      }

      // Tag filter
      const tagFilter = document.getElementById('tagFilter');
      if (tagFilter) {
        tagFilter.addEventListener('change', (e) => {
          this.currentFilters.tag = e.target.value;
          this.refreshArticleGrid();
        });
      }

      // Clear filters
      const clearFilters = document.getElementById('clearFilters');
      if (clearFilters) {
        clearFilters.addEventListener('click', () => this.clearFilters());
      }

      this._filtersBound = true;
    }

    // Bind article cards each refresh
    this.bindArticleCardClicks();

    // Modal close handlers - bind once
    if (!this._modalBound) {
      this.setupModalEventListeners();
      this._modalBound = true;
    }
  }

  bindArticleCardClicks() {
    document.querySelectorAll('.article-card').forEach(card => {
      // Avoid duplicate handlers
      if (card._boundClick) return;
      card.addEventListener('click', (e) => {
        if (!document.body.classList.contains('modal-active')) {
          const articleId = e.currentTarget.dataset.articleId;
          const articleCategory = e.currentTarget.dataset.articleCategory;
          this.openArticle(articleId, articleCategory);
        }
      });
      card._boundClick = true;
    });
  }

  refreshFilters() {
    // Refresh the entire filter bar (to update tag dropdown based on category)
    const filtersContainer = document.querySelector('.article-filters');
    if (filtersContainer) {
      const parent = filtersContainer.parentElement;
      const newFilters = this.renderFilters();
      filtersContainer.outerHTML = newFilters;
      
      // Re-bind filter listeners since we replaced the DOM
      this._filtersBound = false;
      this.setupEventListeners();
    }
  }

  refreshArticleGrid() {
    const container = document.getElementById('articlesGridContainer');
    if (container) {
      // Replace inner content only (keeps a stable mount point)
      container.innerHTML = this.renderArticleGrid();
      // Rebind only what depends on grid content
      this.bindArticleCardClicks();
    } else {
      Config.error('articlesGridContainer not found for refresh');
    }
  }

  clearFilters() {
    this.currentFilters = {
      category: this.defaultSheet,
      tag: '',
      search: ''
    };
    const searchInput = document.getElementById('articleSearch');
    const categoryFilter = document.getElementById('categoryFilter');
    const tagFilter = document.getElementById('tagFilter');
    if (searchInput) searchInput.value = '';
    if (categoryFilter) categoryFilter.value = this.defaultSheet;
    if (tagFilter) tagFilter.value = '';
    Config.log('Filters cleared, reset to default sheet:', this.defaultSheet);
    this.refreshArticleGrid();
  }

  openArticle(articleId, articleCategory) {
    const article = this.currentArticles.find(a => a._uid === articleId);
    if (!article) return;

    // Use the HTML modal structure
    const modal = document.getElementById('articleModal');
    const overlay = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalBody');

    if (!modal || !overlay) {
      Config.error('Article modal elements not found in HTML');
      return;
    }

    if (title) title.textContent = article.name;
    if (content) {
      const htmlContent = this.markdownToHtml(article.content || 'No content available');
      
      const summaryHtml = article.summary ?
        `<div class="article-modal-summary">${this.markdownToHtml(article.summary)}</div>` :
        '';

      // Case-insensitive lookup so sheet column casing doesn't matter
      const _getField = (obj, key) => {
        const lk = key.toLowerCase();
        const match = Object.keys(obj).find(k => k.toLowerCase() === lk);
        return match ? String(obj[match]).trim() : '';
      };
      const typeField   = _getField(article, 'type');
      const effectField = _getField(article, 'effect');
      const metaHtml = (typeField || effectField) ? `
        <div class="article-modal-meta">
          ${typeField   ? `<div class="article-meta-item"><span class="article-meta-label">Type</span><span class="article-meta-value">${typeField}</span></div>` : ''}
          ${effectField ? `<div class="article-meta-item"><span class="article-meta-label">Effect</span><span class="article-meta-value">${effectField}</span></div>` : ''}
        </div>
        <hr class="article-modal-meta-divider">` : '';
      
      // Split content into pages
      const pages = this.splitContentIntoPages(htmlContent);
      const pageHtml = this.renderArticlePages(pages);
      const navigationHtml = pages.length > 1 ? this.renderArticleNavigation(pages.length) : '';
      
      if (article.image_url) {
        content.innerHTML = `
          <div class="article-modal-columns">
            <div class="article-modal-image-col">
              <img src="${article.image_url}" class="article-image" alt="${article.name}" loading="lazy">
              ${summaryHtml}
            </div>
            <div class="article-modal-text-col">
              ${metaHtml}
              <div class="article-pages-container">
                ${pageHtml}
              </div>
              ${navigationHtml}
            </div>
          </div>
        `;
      } else {
        // No image: summary still on left, content on right
        content.innerHTML = `
          <div class="article-modal-columns">
            <div class="article-modal-image-col">
              ${summaryHtml}
            </div>
            <div class="article-modal-text-col">
              ${metaHtml}
              <div class="article-pages-container">
                ${pageHtml}
              </div>
              ${navigationHtml}
            </div>
          </div>
        `;
      }
      
      // Setup pagination if needed
      if (pages.length > 1) {
        this.setupArticlePagination(pages.length);
      }
    }

    // Show modal using the HTML structure
    overlay.classList.add('show');
    modal.classList.add('show');
    document.body.classList.add('modal-active');

    Config.log('Article modal opened:', article.name);
  }

  // Split HTML content into pages based on fixed container height
  splitContentIntoPages(htmlContent) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const elements = Array.from(tempDiv.children);
    const pages = [];
    let currentPage = [];
    let currentHeight = 0;
    const maxHeight = 630;
    const avgLineHeight = 26;
    const avgCharsPerLine = 90;
    
    elements.forEach(element => {
      const text = element.textContent || '';
      const lines = Math.ceil(text.length / avgCharsPerLine);
      let estimatedHeight = lines * avgLineHeight;
      
      // Add extra height for headers
      if (element.tagName === 'H1') {
        estimatedHeight += 20;
      } else if (element.tagName === 'H2') {
        estimatedHeight += 15;
      } else if (element.tagName === 'H3') {
        estimatedHeight += 10;
      }
      
      // If this element fits on current page, add it
      if (currentHeight + estimatedHeight <= maxHeight) {
        currentPage.push(element.outerHTML);
        currentHeight += estimatedHeight;
      } else {
        // Element doesn't fit - check if it's a paragraph that can be split
        if (element.tagName === 'P' && currentPage.length > 0 && estimatedHeight > maxHeight * 0.3) {
          // This is a long paragraph and we have content on current page
          // Split the paragraph across pages
          const remainingHeight = maxHeight - currentHeight;
          const remainingChars = Math.floor((remainingHeight / avgLineHeight) * avgCharsPerLine);
          
          if (remainingChars > 50) { // Only split if we can fit meaningful content
            const words = text.split(' ');
            let firstPart = '';
            let secondPart = '';
            let charCount = 0;
            
            for (let i = 0; i < words.length; i++) {
              const word = words[i];
              if (charCount + word.length < remainingChars) {
                firstPart += word + ' ';
                charCount += word.length + 1;
              } else {
                secondPart = words.slice(i).join(' ');
                break;
              }
            }
            
            // Add first part to current page
            if (firstPart.trim()) {
              currentPage.push(`<p>${firstPart.trim()}</p>`);
            }
            
            // Save current page and start new one with second part
            pages.push(currentPage.join(''));
            currentPage = secondPart.trim() ? [`<p>${secondPart.trim()}</p>`] : [];
            currentHeight = secondPart.trim() ? Math.ceil(secondPart.length / avgCharsPerLine) * avgLineHeight : 0;
          } else {
            // Not enough room to split meaningfully, start new page
            pages.push(currentPage.join(''));
            currentPage = [element.outerHTML];
            currentHeight = estimatedHeight;
          }
        } else {
          // Not a splittable paragraph, or no content on current page yet
          // Save current page if it has content
          if (currentPage.length > 0) {
            pages.push(currentPage.join(''));
          }
          // Start new page with this element
          currentPage = [element.outerHTML];
          currentHeight = estimatedHeight;
        }
      }
    });
    
    // Add remaining content as last page
    if (currentPage.length > 0) {
      pages.push(currentPage.join(''));
    }
    
    return pages.length > 0 ? pages : [htmlContent];
  }

  // Render pages HTML
  renderArticlePages(pages) {
    return pages.map((pageContent, index) => `
      <div class="article-page ${index === 0 ? 'active' : ''}" data-page="${index}">
        ${pageContent}
      </div>
    `).join('');
  }

  // Render navigation controls
  renderArticleNavigation(totalPages) {
    const dots = Array.from({ length: totalPages }, (_, i) => 
      `<button class="article-dot ${i === 0 ? 'active' : ''}" data-page="${i}"></button>`
    ).join('');
    
    return `
      <div class="article-navigation">
        <button class="article-nav-btn article-prev" disabled>‹</button>
        <div class="article-dots">${dots}</div>
        <button class="article-nav-btn article-next" ${totalPages <= 1 ? 'disabled' : ''}>›</button>
      </div>
    `;
  }

  // Setup pagination event listeners
  setupArticlePagination(totalPages) {
    let currentPage = 0;
    
    const updatePage = (newPage) => {
      if (newPage < 0 || newPage >= totalPages) return;
      
      // Fade out current page
      const pages = document.querySelectorAll('.article-page');
      const dots = document.querySelectorAll('.article-dot');
      
      pages[currentPage]?.classList.remove('active');
      dots[currentPage]?.classList.remove('active');
      
      // Fade in new page
      currentPage = newPage;
      pages[currentPage]?.classList.add('active');
      dots[currentPage]?.classList.add('active');
      
      // Update button states
      const prevBtn = document.querySelector('.article-prev');
      const nextBtn = document.querySelector('.article-next');
      
      if (prevBtn) prevBtn.disabled = currentPage === 0;
      if (nextBtn) nextBtn.disabled = currentPage === totalPages - 1;
    };
    
    // Previous button
    document.querySelector('.article-prev')?.addEventListener('click', () => {
      updatePage(currentPage - 1);
    });
    
    // Next button
    document.querySelector('.article-next')?.addEventListener('click', () => {
      updatePage(currentPage + 1);
    });
    
    // Dot buttons
    document.querySelectorAll('.article-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        const page = parseInt(e.target.dataset.page);
        updatePage(page);
      });
    });
    
    // Arrow key navigation
    const arrowKeyHandler = (e) => {
      // Only handle arrow keys when article modal is open
      if (!document.body.classList.contains('modal-active')) return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        updatePage(currentPage - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        updatePage(currentPage + 1);
      }
    };
    
    // Add arrow key listener
    document.addEventListener('keydown', arrowKeyHandler);
    
    // Store the handler so we can remove it when modal closes
    this._arrowKeyHandler = arrowKeyHandler;
  }

  closeModal() {
    const modal = document.getElementById('articleModal');
    const overlay = document.getElementById('modalOverlay');
    
    if (modal && overlay) {
      overlay.classList.remove('show');
      modal.classList.remove('show');
      document.body.classList.remove('modal-active');
      
      // Remove arrow key listener when modal closes
      if (this._arrowKeyHandler) {
        document.removeEventListener('keydown', this._arrowKeyHandler);
        this._arrowKeyHandler = null;
      }
      
      Config.log('Article modal closed');
    }
  }

  // Add modal listeners (close button, overlay click, ESC)
  setupModalEventListeners() {
    const closeBtn = document.getElementById('closeModalBtn');
    if (closeBtn && !closeBtn._boundArticleClose) {
      closeBtn.addEventListener('click', () => this.closeModal());
      closeBtn._boundArticleClose = true;
    }

    const overlay = document.getElementById('modalOverlay');
    if (overlay && !overlay._boundArticleOverlay) {
      overlay.addEventListener('click', () => this.closeModal());
      overlay._boundArticleOverlay = true;
    }

    const modal = document.getElementById('articleModal');
    if (modal && !modal._boundArticleModal) {
      modal.addEventListener('click', (e) => e.stopPropagation());
      modal._boundArticleModal = true;
    }

    if (!this._escListenerBound) {
      this._escListener = (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('modal-active')) {
          this.closeModal();
        }
      };
      document.addEventListener('keydown', this._escListener);
      this._escListenerBound = true;
    }
  }

  markdownToHtml(markdown) {
    if (!markdown) return 'No content available';
    
    // Basic markdown conversion - you might want a proper library later
    return markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^(.*)/, '<p>$1</p>');
  }

  formatDate(dateString) {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return 'Invalid date';
    }
  }
}

// Export for use in main hub
window.ArticleViewer = ArticleViewer;