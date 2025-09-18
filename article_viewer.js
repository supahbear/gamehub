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
  }

  async loadArticleData(worldId) {
    try {
      const [articles, categories] = await Promise.all([
        this.hub.loadArticles(worldId),
        this.hub.loadCategories(worldId)
      ]);
      
      this.currentArticles = articles;
      this.currentCategories = categories;
      
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
      return this.renderEmptyState();
    }

    // Check if HTML modals exist - no need to inject if already there
    if (!this.checkModalExists()) {
      Config.warn('Article modal not found in HTML - functionality may be limited');
    }

    return `
      <div class="article-viewer">
        ${this.renderFilters()}
        ${this.renderArticleGrid()}
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
      .map(cat => `<option value="${cat.id}">${cat.name}</option>`)
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
    
    // Clean tag for CSS class (remove spaces, special chars)
    const cssTag = primaryTag.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Fallback image for cards without images
    const hasImage = article.image_url && article.image_url.trim();
    const backgroundImage = hasImage ? 
      `<img src="${article.image_url}" class="card-background" alt="${article.title}" loading="lazy">` :
      `<div class="card-background-placeholder"></div>`;

    return `
      <div class="article-card tag-${cssTag}" data-article-id="${article.id}">
        ${backgroundImage}
        ${category ? `<div class="card-category-badge">${category.name}</div>` : ''}
        <div class="card-overlay">
          <h4 class="card-title">${article.title}</h4>
          <div class="card-tag">${primaryTag}</div>
          <p class="card-summary">${article.summary || 'No summary available'}</p>
        </div>
      </div>
    `;
  }

  renderArticleGrid() {
    const filteredArticles = this.filterArticles();
    
    if (filteredArticles.length === 0) {
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

    // Article cards - bind click events
    document.querySelectorAll('.article-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Only open if body doesn't have modal-active class
        if (!document.body.classList.contains('modal-active')) {
          const articleId = e.currentTarget.dataset.articleId;
          this.openArticle(articleId);
        }
      });
    });

    // Modal close handlers - use existing HTML modals
    this.setupModalEventListeners();
  }

  setupModalEventListeners() {
    // X button - look for the close button in article modal
    const closeBtn = document.getElementById('closeModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }

    // Modal background click handling
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.closeModal());
    }

    // Prevent closing when clicking modal content
    const modal = document.getElementById('articleModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('modal-active')) {
        this.closeModal();
      }
    });
  }

  refreshArticleGrid() {
    const gridContainer = document.querySelector('.articles-grid');
    if (gridContainer) {
      gridContainer.outerHTML = this.renderArticleGrid();
      this.setupEventListeners();
    } else {
      Config.error('articles-grid container not found for refresh');
      // Try to find the parent and inject the grid
      const articleViewer = document.querySelector('.article-viewer');
      if (articleViewer) {
        const filterDiv = articleViewer.querySelector('.article-filters');
        if (filterDiv) {
          filterDiv.insertAdjacentHTML('afterend', this.renderArticleGrid());
          this.setupEventListeners();
        }
      }
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
      
      // Add image to modal if it exists
      if (article.image_url) {
        content.innerHTML = `
          <img src="${article.image_url}" class="article-image" alt="${article.title}" loading="lazy">
          ${htmlContent}
        `;
      } else {
        content.innerHTML = htmlContent;
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