// article-viewer.js - Fixed modal display issues
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

    return `
      <div class="article-viewer">
        ${this.renderFilters()}
        ${this.renderArticleGrid()}
        ${this.renderArticleModal()}
      </div>
      <style>
        ${this.getArticleViewerStyles()}
      </style>
    `;
  }

  renderEmptyState() {
    return `
      <div class="empty-state">
        <h3>📚 No Articles Yet</h3>
        <p>This world doesn't have any published articles yet.</p>
        <p>Switch to Build mode to start creating content!</p>
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

  getLayoutType(categoryId) {
    const category = this.currentCategories.find(cat => cat.id == categoryId);
    const categoryKey = (category?.key || category?.name || '').toLowerCase();
    
    // Define layout rules based on your category keys
    if (categoryKey.includes('merchar') || categoryKey.includes('char') || categoryKey.includes('npc')) {
      return 'character'; // Side-by-side layout for characters
    }
    if (categoryKey.includes('merloc') || categoryKey.includes('location') || categoryKey.includes('place')) {
      return 'location'; // Header image layout for locations
    }
    if (categoryKey.includes('mertech') || categoryKey.includes('tech') || categoryKey.includes('gear')) {
      return 'tech'; // Side-by-side layout for tech
    }
    if (categoryKey.includes('mergear') || categoryKey.includes('item') || categoryKey.includes('equipment')) {
      return 'gear'; // Side-by-side layout for gear
    }
    if (categoryKey.includes('merlore') || categoryKey.includes('lore') || categoryKey.includes('history')) {
      return 'lore'; // Text-focused layout
    }
    
    return 'default'; // Fallback layout
  }

  renderArticleCard(article) {
    const category = this.currentCategories.find(cat => cat.id == article.category_id);
    const tags = (article.tags_csv || '').split(',').map(t => t.trim()).filter(t => t);
    const layoutType = this.getLayoutType(article.category_id);
    
    // Common elements
    const categoryBadge = category ? `<span class="category-badge">${category.name}</span>` : '';
    const tagsHtml = tags.length > 0 ? `
      <div class="article-tags">
        ${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
      </div>
    ` : '';
    const metaHtml = `
      <div class="article-meta">
        <small>Updated: ${this.formatDate(article.updated_at)}</small>
      </div>
    `;

    switch (layoutType) {
      case 'character':
        return `
          <div class="article-card layout-character" data-article-id="${article.id}">
            <div class="character-layout">
              ${article.image_url ? `
                <div class="character-image">
                  <img src="${article.image_url}" alt="${article.title}" loading="lazy">
                </div>
              ` : '<div class="character-image-placeholder">👤</div>'}
              <div class="character-content">
                <div class="article-header">
                  <h4>${article.title}</h4>
                  ${categoryBadge}
                </div>
                <p class="article-summary">${article.summary || 'No summary available'}</p>
                ${tagsHtml}
                ${metaHtml}
              </div>
            </div>
          </div>
        `;

      case 'location':
        return `
          <div class="article-card layout-location" data-article-id="${article.id}">
            ${article.image_url ? `<img src="${article.image_url}" class="location-header-image" alt="${article.title}" loading="lazy">` : ''}
            <div class="location-content">
              <div class="article-header">
                <h4>${article.title}</h4>
                ${categoryBadge}
              </div>
              <p class="article-summary">${article.summary || 'No summary available'}</p>
              ${tagsHtml}
              ${metaHtml}
            </div>
          </div>
        `;

      case 'tech':
        return `
          <div class="article-card layout-tech" data-article-id="${article.id}">
            <div class="tech-layout">
              ${article.image_url ? `
                <div class="tech-image">
                  <img src="${article.image_url}" alt="${article.title}" loading="lazy">
                </div>
              ` : '<div class="tech-image-placeholder">⚙️</div>'}
              <div class="tech-content">
                <div class="article-header">
                  <h4>${article.title}</h4>
                  ${categoryBadge}
                </div>
                <p class="article-summary">${article.summary || 'No summary available'}</p>
                ${tagsHtml}
                ${metaHtml}
              </div>
            </div>
          </div>
        `;

      case 'gear':
        return `
          <div class="article-card layout-gear" data-article-id="${article.id}">
            <div class="gear-layout">
              ${article.image_url ? `
                <div class="gear-image">
                  <img src="${article.image_url}" alt="${article.title}" loading="lazy">
                </div>
              ` : '<div class="gear-image-placeholder">🛡️</div>'}
              <div class="gear-content">
                <div class="article-header">
                  <h4>${article.title}</h4>
                  ${categoryBadge}
                </div>
                <p class="article-summary">${article.summary || 'No summary available'}</p>
                ${tagsHtml}
                ${metaHtml}
              </div>
            </div>
          </div>
        `;

      case 'lore':
        return `
          <div class="article-card layout-text" data-article-id="${article.id}">
            <div class="article-header">
              <h4>${article.title}</h4>
              ${categoryBadge}
            </div>
            <p class="article-summary">${article.summary || 'No summary available'}</p>
            ${tagsHtml}
            ${metaHtml}
            ${article.image_url ? `
              <div class="text-layout-image">
                <img src="${article.image_url}" alt="${article.title}" loading="lazy">
              </div>
            ` : ''}
          </div>
        `;

      default:
        return `
          <div class="article-card layout-default" data-article-id="${article.id}">
            ${article.image_url ? `<img src="${article.image_url}" class="article-thumbnail" alt="${article.title}" loading="lazy">` : ''}
            <div class="article-content">
              <div class="article-header">
                <h4>${article.title}</h4>
                ${categoryBadge}
              </div>
              <p class="article-summary">${article.summary || 'No summary available'}</p>
              ${tagsHtml}
              ${metaHtml}
            </div>
          </div>
        `;
    }
  }

  renderArticleGrid() {
    const filteredArticles = this.filterArticles();
    
    if (filteredArticles.length === 0) {
      return `
        <div class="no-results">
          <p>No articles match your current filters.</p>
          <button onclick="window.articleViewer.clearFilters()">Clear Filters</button>
        </div>
      `;
    }

    const articleCards = filteredArticles.map(article => this.renderArticleCard(article)).join('');

    return `
      <div class="articles-grid">
        ${articleCards}
      </div>
    `;
  }

  renderArticleModal() {
    return `
      <div id="articleModal" class="article-modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h2 id="modalTitle">Article Title</h2>
            <button class="close-btn" onclick="window.articleViewer.closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div id="modalContent">Loading...</div>
          </div>
        </div>
      </div>
    `;
  }

  filterArticles() {
    return this.currentArticles.filter(article => {
      // Search filter
      if (this.currentFilters.search) {
        const searchTerm = this.currentFilters.search.toLowerCase();
        const searchableText = `${article.title} ${article.summary} ${article.content_md}`.toLowerCase();
        if (!searchableText.includes(searchTerm)) return false;
      }

      // Category filter
      if (this.currentFilters.category && article.category_id != this.currentFilters.category) {
        return false;
      }

      // Tag filter
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

    // Article cards
    document.querySelectorAll('.article-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const articleId = e.currentTarget.dataset.articleId;
        this.openArticle(articleId);
      });
    });

    // Modal close on background click
    const modal = document.getElementById('articleModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal();
      });
    }
  }

  refreshArticleGrid() {
    const gridContainer = document.querySelector('.articles-grid');
    if (gridContainer) {
      gridContainer.outerHTML = this.renderArticleGrid();
      this.setupEventListeners();
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

    const modal = document.getElementById('articleModal');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalContent');

    if (title) title.textContent = article.title;
    if (content) {
      // Simple markdown-to-HTML conversion (basic)
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

    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }
  }

  closeModal() {
    const modal = document.getElementById('articleModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
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

  getArticleViewerStyles() {
    return `
      .article-viewer {
        max-width: 1200px;
        margin: 0 auto;
      }

      .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: #a0a0a0;
      }

      .article-filters {
        display: flex;
        gap: 15px;
        margin-bottom: 30px;
        flex-wrap: wrap;
        align-items: center;
        padding: 20px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 10px;
      }

      .filter-group {
        flex: 1;
        min-width: 150px;
      }

      .filter-group input, .filter-group select {
        width: 100%;
        padding: 10px;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 5px;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        font-size: 14px;
      }

      .filter-group input::placeholder {
        color: #a0a0a0;
      }

      .clear-btn {
        padding: 10px 20px;
        background: #ff6b35;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
      }

      .clear-btn:hover {
        background: #ff5722;
      }

      .articles-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 20px;
      }

      /* Base Article Card */
      .article-card {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.3s ease;
        overflow: hidden;
      }

      .article-card:hover {
        transform: translateY(-3px);
        border-color: #2196F3;
        box-shadow: 0 5px 20px rgba(33, 150, 243, 0.3);
      }

      /* Character Layout - Side by side */
      .layout-character .character-layout {
        display: flex;
        padding: 20px;
        gap: 15px;
      }

      .character-image {
        width: 120px;
        height: 120px;
        flex-shrink: 0;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid rgba(255, 215, 0, 0.3);
      }

      .character-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .character-image-placeholder {
        width: 120px;
        height: 120px;
        flex-shrink: 0;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 3rem;
        border: 2px solid rgba(255, 215, 0, 0.3);
      }

      .character-content {
        flex: 1;
        min-width: 0;
      }

      /* Location Layout - Header image */
      .layout-location {
        overflow: hidden;
      }

      .location-header-image {
        width: 100%;
        height: 180px;
        object-fit: cover;
      }

      .location-content {
        padding: 20px;
      }

      /* Tech Layout - Side by side like character */
      .layout-tech .tech-layout {
        display: flex;
        padding: 20px;
        gap: 15px;
      }

      .tech-image {
        width: 120px;
        height: 120px;
        flex-shrink: 0;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid rgba(33, 150, 243, 0.3);
      }

      .tech-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .tech-image-placeholder {
        width: 120px;
        height: 120px;
        flex-shrink: 0;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 3rem;
        border: 2px solid rgba(33, 150, 243, 0.3);
      }

      .tech-content {
        flex: 1;
        min-width: 0;
      }

      /* Gear Layout - Side by side like character */
      .layout-gear .gear-layout {
        display: flex;
        padding: 20px;
        gap: 15px;
      }

      .gear-image {
        width: 120px;
        height: 120px;
        flex-shrink: 0;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid rgba(76, 175, 80, 0.3);
      }

      .gear-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .gear-image-placeholder {
        width: 120px;
        height: 120px;
        flex-shrink: 0;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 3rem;
        border: 2px solid rgba(76, 175, 80, 0.3);
      }

      .gear-content {
        flex: 1;
        min-width: 0;
      }

      /* Text Layout - Minimal image */
      .layout-text {
        padding: 20px;
      }

      .text-layout-image {
        margin-top: 15px;
      }

      .text-layout-image img {
        width: 100%;
        max-height: 120px;
        object-fit: cover;
        border-radius: 5px;
        opacity: 0.8;
      }

      /* Default Layout - Current style */
      .layout-default .article-thumbnail {
        width: 100%;
        height: 180px;
        object-fit: cover;
      }

      .layout-default .article-content {
        padding: 20px;
      }

      /* Common Elements */
      .article-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 10px;
        gap: 10px;
      }

      .article-header h4 {
        margin: 0;
        color: #ffd700;
        font-size: 1.2rem;
        line-height: 1.3;
      }

      .category-badge {
        background: #2196F3;
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .article-summary {
        color: #c0c0c0;
        font-size: 14px;
        margin-bottom: 15px;
        line-height: 1.4;
      }

      .article-tags {
        margin-bottom: 10px;
      }

      .tag {
        display: inline-block;
        background: rgba(255, 215, 0, 0.2);
        color: #ffd700;
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 12px;
        margin-right: 5px;
        margin-bottom: 5px;
      }

      .article-meta {
        color: #888;
        font-size: 12px;
      }

      .no-results {
        text-align: center;
        padding: 40px;
        color: #a0a0a0;
      }

      /* Modal Styles - Fixed */
      .article-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 1000;
        display: none;
        align-items: center;
        justify-content: center;
      }

      .modal-content {
        background: #1a1a2e;
        border-radius: 10px;
        max-width: 800px;
        max-height: 90vh;
        width: 90%;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .modal-header h2 {
        margin: 0;
        color: #ffd700;
      }

      .close-btn {
        background: none;
        border: none;
        color: #fff;
        font-size: 24px;
        cursor: pointer;
        padding: 5px;
        border-radius: 3px;
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .modal-body {
        padding: 20px;
        max-height: 70vh;
        overflow-y: auto;
        line-height: 1.6;
      }

      .article-image {
        width: 100%;
        max-height: 300px;
        object-fit: cover;
        border-radius: 5px;
        margin-bottom: 20px;
        display: block;
      }

      .modal-body h1, .modal-body h2, .modal-body h3 {
        color: #ffd700;
        margin-top: 20px;
        margin-bottom: 10px;
      }

      .modal-body p {
        margin-bottom: 15px;
        color: #c0c0c0;
      }

      @media (max-width: 768px) {
        .article-filters {
          flex-direction: column;
        }

        .filter-group {
          width: 100%;
        }

        .modal-content {
          width: 95%;
          max-height: 95vh;
        }

        .articles-grid {
          grid-template-columns: 1fr;
        }

        /* Responsive adjustments */
        .layout-character .character-layout,
        .layout-tech .tech-layout,
        .layout-gear .gear-layout {
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .character-image, .character-image-placeholder,
        .tech-image, .tech-image-placeholder,
        .gear-image, .gear-image-placeholder {
          width: 100px;
          height: 100px;
        }
      }
    `;
  }
}

// Export for use in main hub
window.ArticleViewer = ArticleViewer;