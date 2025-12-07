// article-viewer.js - Redesigned for overlay card system with unified explore mode safety
class ArticleViewer {
  constructor(hub) {
    this.hub = hub;
    this.currentArticles = [];
    this.currentCategories = [];
    this.currentFilters = {
      category: '',
      tag: '',
      search: ''
    };
    // Prevent duplicate bindings on re-render
    this._filtersBound = false;
    this._modalBound = false;
  }

  async loadArticleData(worldId) {
    try {
      const [articles, categories] = await Promise.all([
        this.hub.loadArticles(worldId),
        this.hub.loadCategories(worldId)
      ]);
      
      this.currentArticles = articles;
      this.currentCategories = categories;

      // Default to 'Characters' category when no category filter is set
      if (!this.currentFilters.category && Array.isArray(categories)) {
        const defaultCat = categories.find(cat => {
          const name = String(cat.name || '').trim().toLowerCase();
          const slug = String(cat.slug || '').trim().toLowerCase();
          return name === 'characters' || slug === 'characters';
        });
        if (defaultCat && defaultCat.id !== undefined && defaultCat.id !== null && defaultCat.id !== '') {
          this.currentFilters.category = String(defaultCat.id);
        }
      }
      
      Config.log(`Loaded ${articles.length} articles, ${categories.length} categories`);
      return { articles, categories };
    } catch (error) {
      Config.error('Failed to load article data:', error);
      return { articles: [], categories: [] };
    }
  }

  async renderReadMode(worldId) {
    await this.loadArticleData(worldId);

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
    const categoryOptions = this.currentCategories
      .map(cat => `<option value="${cat.id}" ${String(this.currentFilters.category) == String(cat.id) ? 'selected' : ''}>${cat.name}</option>`)
      .join('');

    const allTags = [...new Set(
      this.currentArticles
        .flatMap(article => (article.tags_csv || '').split(','))
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
    )].sort();

    const tagOptions = allTags
      .map(tag => `<option value="${tag}">${tag}</option>`)
      .join('');

    return `
      <div class="article-filters">
        <div class="filter-group">
          <input type="text" 
                 id="articleSearch" 
                 placeholder="Search articles..." 
                 value="${this.currentFilters.search}">
        </div>
        <div class="filter-group">
          <select id="categoryFilter">
            <option value="">All Categories</option>
            ${categoryOptions}
          </select>
        </div>
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
    const category = this.currentCategories.find(cat => cat.id == article.category_id);
    const tags = (article.tags_csv || '').split(',').map(t => t.trim()).filter(t => t);
    const primaryTag = tags[0] || 'default';
    const cssTag = primaryTag.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hasImage = article.image_url && article.image_url.trim();
    const backgroundImage = hasImage ? 
      `<img src="${article.image_url}" class="card-background" alt="${article.title}" loading="lazy">` :
      `<div class="card-background-placeholder"></div>`;

    // Top-right stacked badges
    const topBar = `
      <div class="card-top-bar">
        ${category ? `<div class="card-category-badge">${category.name}</div>` : ''}
        <span class="card-tag">${primaryTag}</span>
      </div>
    `;
    return `
      <div class="article-card tag-${cssTag}" data-article-id="${article.id}">
        ${backgroundImage}
        ${topBar}
        <div class="card-overlay">
          <h4 class="card-title">${article.title}</h4>
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
    // If no category filter (showing all), group by category then alphabetical
    if (!this.currentFilters.category) {
      return articles.sort((a, b) => {
        // Get category data for sort_order
        const catA = this.currentCategories.find(c => c.id === a.category_id) || { sort_order: 999, name: 'Unknown' };
        const catB = this.currentCategories.find(c => c.id === b.category_id) || { sort_order: 999, name: 'Unknown' };
        
        // First sort by category sort_order
        if (catA.sort_order !== catB.sort_order) {
          return catA.sort_order - catB.sort_order;
        }
        
        // If sort_order is the same, sort by category name
        if (catA.name !== catB.name) {
          return catA.name.localeCompare(catB.name);
        }
        
        // Finally, alphabetical by article title within category
        return a.title.localeCompare(b.title);
      });
    } else {
      // Single category selected - just alphabetical by title
      return articles.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  filterArticles() {
    return this.currentArticles.filter(article => {
      // Category filter is exclusive - if set, only show that category
      if (this.currentFilters.category) {
        // Handle both single and comma-separated category IDs
        const articleCategories = (article.category_id || '').split(',').map(c => c.trim());
        if (!articleCategories.includes(this.currentFilters.category)) {
          return false;
        }
      }

      // Search filter (applies within current category view)
      if (this.currentFilters.search) {
        const searchTerm = this.currentFilters.search.toLowerCase();
        const searchableText = `${article.title} ${article.summary} ${article.content_md}`.toLowerCase();
        if (!searchableText.includes(searchTerm)) return false;
      }

      // Tag filter (applies within current category view)
      if (this.currentFilters.tag) {
        const articleTags = (article.tags_csv || '').split(',').map(t => t.trim().toLowerCase());
        if (!articleTags.includes(this.currentFilters.tag.toLowerCase())) {
          return false;
        }
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
          this.openArticle(articleId);
        }
      });
      card._boundClick = true;
    });
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
    this.currentFilters = { category: '', tag: '', search: '' };
    
    // Reset form elements
    const searchInput = document.getElementById('articleSearch');
    const categoryFilter = document.getElementById('categoryFilter');
    const tagFilter = document.getElementById('tagFilter');
    
    if (searchInput) searchInput.value = '';
    if (categoryFilter) categoryFilter.value = '';
    if (tagFilter) tagFilter.value = '';
    
    this.refreshArticleGrid();
  }

  openArticle(articleId) {
    const article = this.currentArticles.find(a => a.id == articleId);
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

    if (title) title.textContent = article.title;
    if (content) {
      // Convert markdown to HTML
      const htmlContent = this.markdownToHtml(article.content_md || 'No content available');
      
      // Two-column layout: image left, text right
      if (article.image_url) {
        content.innerHTML = `
          <div class="article-modal-columns">
            <div class="article-modal-image-col">
              <img src="${article.image_url}" class="article-image" alt="${article.title}" loading="lazy">
            </div>
            <div class="article-modal-text-col">
              ${htmlContent}
            </div>
          </div>
        `;
      } else {
        content.innerHTML = `
          <div class="article-modal-columns">
            <div class="article-modal-image-col"></div>
            <div class="article-modal-text-col">
              ${htmlContent}
            </div>
          </div>
        `;
      }
    }

    // Show modal using the HTML structure
    overlay.classList.add('show');
    modal.classList.add('show');
    document.body.classList.add('modal-active');
    document.body.style.overflow = 'hidden';

    Config.log('Article modal opened:', article.title);
  }

  closeModal() {
    const modal = document.getElementById('articleModal');
    const overlay = document.getElementById('modalOverlay');
    
    if (modal && overlay) {
      overlay.classList.remove('show');
      modal.classList.remove('show');
      document.body.classList.remove('modal-active');
      document.body.style.overflow = 'auto';
      
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