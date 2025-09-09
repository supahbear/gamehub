// tour-viewer.js - Vertical slideshow system for guided tours
class TourViewer {
  constructor(hub) {
    this.hub = hub;
    this.currentTours = [];
    this.activeTour = null;
    this.currentSlideIndex = 0;
    this.slides = [];
  }

  async loadTourData(worldId) {
    try {
      const tours = await this.hub.loadTours(worldId);
      this.currentTours = tours;
      
      Config.log(`Loaded ${tours.length} tours for world ${worldId}`);
      return tours;
    } catch (error) {
      Config.error('Failed to load tour data:', error);
      return [];
    }
  }

  // New method for unified explore mode - returns just tour content without header/toggle
  async renderTourContentOnly(worldId) {
    await this.loadTourData(worldId);

    if (this.currentTours.length === 0) {
      return this.renderEmptyState();
    }

    // Group tours by category for better organization
    const toursByCategory = this.groupToursByCategory();

    // Return just the tour categories, no header or toggle
    return this.renderTourCategories(toursByCategory);
  }

  // Legacy method for backward compatibility (kept but not used in unified mode)
  async renderTourSelection(worldId) {
    await this.loadTourData(worldId);

    if (this.currentTours.length === 0) {
      return this.renderEmptyState();
    }

    // Group tours by category for better organization
    const toursByCategory = this.groupToursByCategory();

    return `
      <div class="tour-selection">
        <div class="tour-header">
          <h3>Choose Your Experience</h3>
          <p>Select a guided tour or search the database directly</p>
        </div>
        
        <div class="tour-mode-selector">
          <button class="tour-mode-btn active" data-mode="tours">
            🗺️ Take a Tour
          </button>
          <button class="tour-mode-btn" data-mode="database">
            🔍 Search Database
          </button>
        </div>

        <div class="tour-content" id="tourContent">
          ${this.renderTourCategories(toursByCategory)}
        </div>
      </div>
    `;
  }

  groupToursByCategory() {
    const grouped = {};
    
    this.currentTours.forEach(tour => {
      const category = tour.category || 'General';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(tour);
    });

    return grouped;
  }

  renderTourCategories(toursByCategory) {
    const categories = Object.keys(toursByCategory);
    
    if (categories.length === 0) {
      return '<div class="no-tours">No tours available for this world</div>';
    }

    return `
      <div class="tour-categories">
        ${categories.map(category => {
          const tours = toursByCategory[category];
          const tourCards = tours.map(tour => this.renderTourCard(tour)).join('');
          
          return `
            <div class="tour-category">
              <h4 class="category-title">${category}</h4>
              <div class="tour-cards">
                ${tourCards}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderTourCard(tour) {
    const hasImage = tour.preview_image && tour.preview_image.trim();
    const backgroundImage = hasImage ? 
      `<img src="${tour.preview_image}" class="tour-card-bg" alt="${tour.title}" loading="lazy">` :
      `<div class="tour-card-bg-placeholder"></div>`;

    return `
      <div class="tour-card" data-tour-id="${tour.id}">
        ${backgroundImage}
        <div class="tour-card-overlay">
          <h5 class="tour-title">${tour.title}</h5>
          <p class="tour-description">${tour.description || 'Explore this guided experience'}</p>
          <div class="tour-meta">
            <span class="tour-duration">${tour.estimated_duration || '5 min'}</span>
            <span class="tour-slides">${tour.slide_count || '?'} slides</span>
          </div>
        </div>
      </div>
    `;
  }

  renderEmptyState() {
    return `
      <div class="empty-state">
        <div class="empty-icon">🗺️</div>
        <h3>No Tours Available</h3>
        <p>This world doesn't have any tours set up yet.</p>
        <p>Switch to Database mode to browse articles instead.</p>
      </div>
    `;
  }

  async startTour(tourId) {
    try {
      // Load slides for this specific tour
      this.slides = await this.hub.loadTourSlides(tourId);
      this.activeTour = this.currentTours.find(t => t.id === tourId);
      this.currentSlideIndex = 0;

      if (this.slides.length === 0) {
        throw new Error('No slides found for this tour');
      }

      Config.log(`Starting tour: ${this.activeTour.title} with ${this.slides.length} slides`);
      
      // Switch to tour view
      this.renderTourSlideshow();
      
    } catch (error) {
      Config.error('Failed to start tour:', error);
      alert('Could not load this tour. Please try again.');
    }
  }

  renderTourSlideshow() {
    const hubContent = document.getElementById('hubContent');
    if (!hubContent) return;

    hubContent.innerHTML = `
      <div class="tour-slideshow">
        <div class="tour-header-bar">
          <button class="tour-back-btn" onclick="window.tourViewer.exitTour()">
            ← Back to Tours
          </button>
          <div class="tour-info">
            <span class="tour-title">${this.activeTour.title}</span>
            <span class="tour-progress">${this.currentSlideIndex + 1} / ${this.slides.length}</span>
          </div>
        </div>

        <div class="tour-slides-container" id="tourSlidesContainer">
          ${this.renderAllSlides()}
        </div>

        <div class="tour-navigation">
          <button class="tour-nav-btn" id="prevSlide" ${this.currentSlideIndex === 0 ? 'disabled' : ''}>
            ← Previous
          </button>
          <div class="tour-dots">
            ${this.renderProgressDots()}
          </div>
          <button class="tour-nav-btn" id="nextSlide" ${this.currentSlideIndex === this.slides.length - 1 ? 'disabled' : ''}>
            Next →
          </button>
        </div>
      </div>
    `;

    this.setupTourEventListeners();
    this.scrollToCurrentSlide();
  }

  renderAllSlides() {
    return this.slides.map((slide, index) => 
      this.renderSlide(slide, index)
    ).join('');
  }

  renderSlide(slide, index) {
    const isActive = index === this.currentSlideIndex;
    const slideTypeClass = `slide-type-${slide.slide_type || 'default'}`;
    
    // Handle different slide types with different layouts
    const content = this.renderSlideContent(slide);
    
    return `
      <div class="tour-slide ${slideTypeClass} ${isActive ? 'active' : ''}" 
           data-slide-index="${index}"
           id="slide-${index}">
        ${content}
      </div>
    `;
  }

  renderSlideContent(slide) {
    const hasMedia = slide.media_url && slide.media_url.trim();
    const mediaElement = hasMedia ? this.renderSlideMedia(slide) : '';
    
    return `
      <div class="slide-content">
        ${mediaElement}
        <div class="slide-text">
          <h2 class="slide-title">${slide.title || 'Untitled'}</h2>
          <div class="slide-body">
            ${this.hub.markdownToHtml(slide.content || 'No content available')}
          </div>
        </div>
      </div>
    `;
  }

  renderSlideMedia(slide) {
    const mediaUrl = slide.media_url;
    const isVideo = mediaUrl.match(/\.(mp4|webm|ogg)$/i);
    const isImage = mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    
    if (isVideo) {
      return `
        <div class="slide-media slide-video">
          <video autoplay muted loop playsinline>
            <source src="${mediaUrl}" type="video/mp4">
          </video>
        </div>
      `;
    } else if (isImage || true) { // Default to image
      return `
        <div class="slide-media slide-image">
          <img src="${mediaUrl}" alt="${slide.title}" loading="lazy">
        </div>
      `;
    }
    
    return '';
  }

  renderProgressDots() {
    return this.slides.map((_, index) => 
      `<button class="tour-dot ${index === this.currentSlideIndex ? 'active' : ''}" 
              data-slide="${index}"></button>`
    ).join('');
  }

  renderSlideContent(slide) {
    const hasMedia = slide.media_url && slide.media_url.trim();
    const mediaElement = hasMedia ? this.renderSlideMedia(slide) : '';
    
    return `
      <div class="slide-content">
        ${mediaElement}
        <div class="slide-text">
          <h2 class="slide-title">${slide.title || 'Untitled'}</h2>
          <div class="slide-body">
            ${this.hub.markdownToHtml(slide.content || 'No content available')}
          </div>
        </div>
      </div>
    `;
  }

  renderSlideMedia(slide) {
    const mediaUrl = slide.media_url;
    const isVideo = mediaUrl.match(/\.(mp4|webm|ogg)$/i);
    const isImage = mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    
    if (isVideo) {
      return `
        <div class="slide-media slide-video">
          <video autoplay muted loop playsinline>
            <source src="${mediaUrl}" type="video/mp4">
          </video>
        </div>
      `;
    } else if (isImage || true) { // Default to image
      return `
        <div class="slide-media slide-image">
          <img src="${mediaUrl}" alt="${slide.title}" loading="lazy">
        </div>
      `;
    }
    
    return '';
  }

  setupTourEventListeners() {
    // Navigation buttons
    const prevBtn = document.getElementById('prevSlide');
    const nextBtn = document.getElementById('nextSlide');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.previousSlide());
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextSlide());
    }

    // Progress dots
    document.querySelectorAll('.tour-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        const slideIndex = parseInt(e.target.dataset.slide);
        this.goToSlide(slideIndex);
      });
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (this.activeTour) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          this.previousSlide();
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.nextSlide();
        } else if (e.key === 'Escape') {
          this.exitTour();
        }
      }
    });
  }

  nextSlide() {
    if (this.currentSlideIndex < this.slides.length - 1) {
      this.goToSlide(this.currentSlideIndex + 1);
    }
  }

  previousSlide() {
    if (this.currentSlideIndex > 0) {
      this.goToSlide(this.currentSlideIndex - 1);
    }
  }

  goToSlide(index) {
    if (index >= 0 && index < this.slides.length) {
      this.currentSlideIndex = index;
      this.updateSlideDisplay();
      
      // Scroll to the slide smoothly
      const targetSlide = document.getElementById(`slide-${index}`);
      if (targetSlide) {
        const container = document.getElementById('tourSlidesContainer');
        if (container) {
          // Use smooth scrolling to move to the target slide
          container.scrollTo({
            top: targetSlide.offsetTop,
            behavior: 'smooth'
          });
        }
      }
    }
  }

  updateSlideDisplay() {
    // Update active slide
    document.querySelectorAll('.tour-slide').forEach((slide, index) => {
      slide.classList.toggle('active', index === this.currentSlideIndex);
    });

    // Update progress dots
    document.querySelectorAll('.tour-dot').forEach((dot, index) => {
      dot.classList.toggle('active', index === this.currentSlideIndex);
    });

    // Update navigation buttons
    const prevBtn = document.getElementById('prevSlide');
    const nextBtn = document.getElementById('nextSlide');
    const progress = document.querySelector('.tour-progress');
    
    if (prevBtn) prevBtn.disabled = this.currentSlideIndex === 0;
    if (nextBtn) nextBtn.disabled = this.currentSlideIndex === this.slides.length - 1;
    if (progress) progress.textContent = `${this.currentSlideIndex + 1} / ${this.slides.length}`;
  }

  scrollToCurrentSlide() {
    const currentSlide = document.getElementById(`slide-${this.currentSlideIndex}`);
    if (currentSlide) {
      currentSlide.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }

  setupScrollBasedNavigation() {
    const container = document.getElementById('tourSlidesContainer');
    if (!container) return;

    let scrollTimeout;
    let isWheelScrolling = false;
    
    // Mouse wheel event for discrete slide navigation
    container.addEventListener('wheel', (e) => {
      e.preventDefault(); // Prevent default scroll behavior
      
      if (isWheelScrolling) return; // Prevent rapid wheel events
      
      isWheelScrolling = true;
      
      if (e.deltaY > 0) {
        // Scrolling down - next slide
        this.nextSlide();
      } else {
        // Scrolling up - previous slide
        this.previousSlide();
      }
      
      // Reset wheel scrolling flag after animation
      setTimeout(() => {
        isWheelScrolling = false;
      }, 600); // Slightly longer than smooth scroll duration
    });
    
    // Keep the existing scroll position detection for manual scrollbar use
    container.addEventListener('scroll', (e) => {
      // Only process if not currently wheel scrolling
      if (isWheelScrolling) return;
      
      // Debounce scroll events to avoid excessive processing
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollTop = e.target.scrollTop;
        
        // Calculate which slide should be active based on scroll position
        let newSlideIndex = 0;
        let minDistance = Infinity;
        
        // Find the slide closest to the top of the viewport
        this.slides.forEach((_, index) => {
          const slide = document.getElementById(`slide-${index}`);
          if (slide) {
            const slideTop = slide.offsetTop;
            const distance = Math.abs(scrollTop - slideTop);
            
            if (distance < minDistance) {
              minDistance = distance;
              newSlideIndex = index;
            }
          }
        });
        
        // Only update if we've moved to a different slide
        if (newSlideIndex !== this.currentSlideIndex) {
          this.currentSlideIndex = newSlideIndex;
          this.updateSlideDisplay();
        }
      }, 100); // 100ms debounce
    });

    // Smooth scroll to slide boundaries when user stops scrolling manually
    let isScrolling = false;
    container.addEventListener('scroll', () => {
      if (isWheelScrolling) return; // Don't interfere with wheel navigation
      
      isScrolling = true;
      clearTimeout(scrollTimeout);
      
      scrollTimeout = setTimeout(() => {
        if (isScrolling) {
          isScrolling = false;
          // Snap to the current active slide
          this.scrollToCurrentSlide();
        }
      }, 150);
    });
  }

  exitTour() {
    this.activeTour = null;
    this.slides = [];
    this.currentSlideIndex = 0;
    
    // Re-enable body scroll when exiting tour
    document.body.style.overflow = 'auto';
    
    // Return to explore mode instead of calling showWorldHub directly
    // The hub will handle reloading the correct explore submode
    this.hub.currentMode = 'explore';
    this.hub.currentExploreSubmode = 'tours';
    this.hub.showWorldHub();
  }

  // Only setup tour card listeners now - hub handles mode switching
  setupTourCardListeners() {
    document.querySelectorAll('.tour-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const tourId = e.currentTarget.dataset.tourId;
        this.startTour(tourId);
      });
    });
  }

  // Simplified event listener setup - only handles tour cards
  setupEventListeners() {
    this.setupTourCardListeners();
  }
}

// Export for use in main hub
window.TourViewer = TourViewer;