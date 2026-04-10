// Clean TTRPG Hub - Refactored for maintainability with unified explore mode
class TTRPGHub {
  constructor() {
    this.currentWorld = null;
    this.currentMode = 'explore'; // Always explore mode
    this.currentSelectedPanel = 'encyclopedia';
    this.worlds = [];
    this._sheetCache = {};        // Demand-loaded sheet data, keyed by sheet name
    
    this.activeBackgroundWorld = 'neutral';
    this.backgroundVideos = {};

    this._panelIdMap = {
      nations:    'nationsContent',
      species:    'speciesContent',
      deities:    'deitiesContent',
      history:    'historyContent',
      literature: 'literatureContent',
      society:    'societyContent',
      characters: 'charactersContent',
      factions:   'factionsContent',
      bestiary:   'bestiaryContent',
      items:      'itemsContent',
      alchemy:    'alchemyContent',
      locations:  'locationsContent',
      calendar:   'calendarContent'
    };

    this.init();
  }

  async init() {
    await this.loadWorlds();
    this.renderWorlds();
    this._revealWorldCard();
    this._warmCache(['Journal', 'Recaps', 'Calendar']);

    Config.log('TTRPG Hub initialized');
  }

  // ========== Data Loading ==========
  async loadWorlds() {
    this.useFallbackWorlds();
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

  useFallbackWorlds() {
    // Single world - The Breach
    this.worlds = [
      {
        id: 'breach',
        name: 'Beyond the Vale',
        description: 'Saving the world is no easy feat. Saving yourself might be a good place to start.',
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

      if (worldNameEl) worldNameEl.textContent = world.name;
    }
    
    this.setupCardListeners();
    this.setupWorldBackgrounds();

    Config.log(`Rendered ${this.worlds.length} worlds`);
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
    // Reset hub back to selection grid for clean re-entry
    this._resetHubToSelection();
  }

  _resetHubToSelection() {
    this.currentSelectedPanel = null;
    const titleText   = document.getElementById('hubTitleText');
    const panelNav    = document.getElementById('hubPanelNav');
    const selection   = document.getElementById('hubSelection');
    const contentArea = document.getElementById('hubContentArea');
    if (titleText)   { titleText.style.display = ''; titleText.style.opacity = '1'; }
    if (panelNav)    panelNav.style.display = 'none';
    if (selection)   { selection.style.display = ''; selection.style.opacity = '1'; }
    if (contentArea) contentArea.style.display = 'none';
  }

  showWorldHub() {
    this.setPageVisibility('hub');

    // Fade-in animation
    const worldHub = document.getElementById('worldHub');
    if (worldHub) {
      worldHub.classList.remove('entering');
      void worldHub.offsetWidth;
      worldHub.classList.add('entering');
    }

    this.currentMode = 'explore';
    this.currentSelectedPanel = null; // Always start at selection grid
    this.initModalHandlers();
    this.initializePanels();
    this.activateWorldBackground(this.currentWorld?.id ?? 'breach');
  }

  // ========== Global Modal Handlers ==========
  initModalHandlers() {
    // Article modal
    const closeBtn = document.getElementById('closeModalBtn');
    const overlay  = document.getElementById('modalOverlay');
    const modal    = document.getElementById('articleModal');
    if (closeBtn && !closeBtn._hubClose) {
      closeBtn.addEventListener('click', () => this.closeModal());
      closeBtn._hubClose = true;
    }
    if (overlay && !overlay._hubOverlay) {
      overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeModal(); });
      overlay._hubOverlay = true;
    }
    if (modal && !modal._hubModal) {
      modal.addEventListener('click', (e) => e.stopPropagation());
      modal._hubModal = true;
    }

    // Journal modal
    const closeJournalBtn     = document.getElementById('closeJournalBtn');
    const journalOverlay      = document.getElementById('journalModalOverlay');
    const journalModal        = document.getElementById('journalModal');
    if (closeJournalBtn && !closeJournalBtn._hubClose) {
      closeJournalBtn.addEventListener('click', () => this.closeJournalModal());
      closeJournalBtn._hubClose = true;
    }
    if (journalOverlay && !journalOverlay._hubOverlay) {
      journalOverlay.addEventListener('click', (e) => { if (e.target === journalOverlay) this.closeJournalModal(); });
      journalOverlay._hubOverlay = true;
    }
    if (journalModal && !journalModal._hubModal) {
      journalModal.addEventListener('click', (e) => e.stopPropagation());
      journalModal._hubModal = true;
    }

    // Calendar modal
    const closeCalendarBtn    = document.getElementById('closeCalendarBtn');
    const calendarOverlay     = document.getElementById('calendarModalOverlay');
    const calendarModal       = document.getElementById('calendarModal');
    if (closeCalendarBtn && !closeCalendarBtn._hubClose) {
      closeCalendarBtn.addEventListener('click', () => this.closeCalendarModal());
      closeCalendarBtn._hubClose = true;
    }
    if (calendarOverlay && !calendarOverlay._hubOverlay) {
      calendarOverlay.addEventListener('click', (e) => { if (e.target === calendarOverlay) this.closeCalendarModal(); });
      calendarOverlay._hubOverlay = true;
    }
    if (calendarModal && !calendarModal._hubModal) {
      calendarModal.addEventListener('click', (e) => e.stopPropagation());
      calendarModal._hubModal = true;
    }

    // Recaps modal
    const closeRecapsBtn  = document.getElementById('closeRecapsBtn');
    const recapsOverlay   = document.getElementById('recapsModalOverlay');
    const recapsModal     = document.getElementById('recapsModal');
    if (closeRecapsBtn && !closeRecapsBtn._hubClose) {
      closeRecapsBtn.addEventListener('click', () => this.closeRecapsModal());
      closeRecapsBtn._hubClose = true;
    }
    if (recapsOverlay && !recapsOverlay._hubOverlay) {
      recapsOverlay.addEventListener('click', (e) => { if (e.target === recapsOverlay) this.closeRecapsModal(); });
      recapsOverlay._hubOverlay = true;
    }
    if (recapsModal && !recapsModal._hubModal) {
      recapsModal.addEventListener('click', (e) => e.stopPropagation());
      recapsModal._hubModal = true;
    }

    // Inventory modal
    const closeInventoryBtn  = document.getElementById('closeInventoryBtn');
    const inventoryOverlay   = document.getElementById('inventoryModalOverlay');
    const inventoryModal     = document.getElementById('inventoryModal');
    if (closeInventoryBtn && !closeInventoryBtn._hubClose) {
      closeInventoryBtn.addEventListener('click', () => this.closeInventoryModal());
      closeInventoryBtn._hubClose = true;
    }
    if (inventoryOverlay && !inventoryOverlay._hubOverlay) {
      inventoryOverlay.addEventListener('click', (e) => { if (e.target === inventoryOverlay) this.closeInventoryModal(); });
      inventoryOverlay._hubOverlay = true;
    }
    if (inventoryModal && !inventoryModal._hubModal) {
      inventoryModal.addEventListener('click', (e) => e.stopPropagation());
      inventoryModal._hubModal = true;
    }

    // Escape key closes whichever modal is open
    if (!this._hubEscBound) {
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (document.body.classList.contains('modal-active')) {
          if (this._activeArticleViewer?._articleStack?.length > 0) {
            this._activeArticleViewer.closeTopLayer();
          } else {
            this.closeModal();
          }
          return;
        }
        if (document.body.classList.contains('journal-modal-active')) { this.closeJournalModal(); return; }
        if (document.body.classList.contains('calendar-modal-active')) { this.closeCalendarModal(); return; }
        if (document.body.classList.contains('recaps-modal-active')) { this.closeRecapsModal(); return; }
        if (document.body.classList.contains('inventory-modal-active')) this.closeInventoryModal();
      });
      this._hubEscBound = true;
    }
  }

  closeModal() {
    while (this._activeArticleViewer?._articleStack?.length > 0) {
      this._activeArticleViewer.closeTopLayer();
    }
    const modal   = document.getElementById('articleModal');
    const overlay = document.getElementById('modalOverlay');
    if (modal)   modal.classList.remove('show');
    if (modal)   modal.classList.remove('article-mode');
    if (overlay) overlay.classList.remove('show');
    document.body.classList.remove('modal-active');
    if (this._activeArticleViewer?._arrowKeyHandler) {
      document.removeEventListener('keydown', this._activeArticleViewer._arrowKeyHandler);
      this._activeArticleViewer._arrowKeyHandler = null;
    }
    if (this.atlasViewer) this.atlasViewer._lightboxOpen = false;
  }

  // ── Journal modal ──────────────────────────────────────────────
  async openJournalModal() {
    const overlay = document.getElementById('journalModalOverlay');
    const modal   = document.getElementById('journalModal');
    const body    = document.getElementById('journalModalBody');
    if (!overlay || !modal || !body) return;

    if (!body.dataset.loaded) {
      if (!this.questViewer) {
        this.questViewer = new QuestViewer(this);
        window.questViewer = this.questViewer;
      }
      body.innerHTML = '<div style="padding:20px;color:#c9b5e6;">Loading...</div>';
      overlay.classList.add('show');
      modal.classList.add('show');
      document.body.classList.add('journal-modal-active');

      const content = await this.questViewer.renderQuestMode(this.currentWorld?.id);
      body.innerHTML = content;
      // Only mark loaded when we actually got data — prevents caching an empty
      // state that would then stick permanently across re-opens.
      if (this.questViewer.currentQuests.length > 0) {
        body.dataset.loaded = 'true';
      }
      this.questViewer.setupEventListeners();
      return;
    }

    overlay.classList.add('show');
    modal.classList.add('show');
    document.body.classList.add('journal-modal-active');
  }

  closeJournalModal() {
    document.getElementById('journalModalOverlay')?.classList.remove('show');
    document.getElementById('journalModal')?.classList.remove('show');
    document.body.classList.remove('journal-modal-active');
  }

  // ── Calendar modal ─────────────────────────────────────────────
  async openCalendarModal() {
    const overlay = document.getElementById('calendarModalOverlay');
    const modal   = document.getElementById('calendarModal');
    const body    = document.getElementById('calendarModalBody');
    if (!overlay || !modal) return;

    // Default to current in-world date on first open
    if (this._calCurrentMonth === undefined) {
      this._calCurrentMonth = Config.CURRENT_DATE.monthIndex;
      this._calCurrentYear  = Config.CURRENT_DATE.year;
    }

    // Load events once; reuse cache on subsequent opens
    if (!this._calEvents) {
      try {
        this._calEvents = await this.loadSheets([Config.SHEETS.CALENDAR]);
      } catch (e) {
        Config.warn('Calendar sheet not available:', e);
        this._calEvents = [];
      }
    }

    if (body) {
      body.innerHTML = this.renderCalendarWidget(this._calEvents, this._calCurrentMonth, this._calCurrentYear);
      this.setupCalendarNavigation(this._calEvents);
    }

    overlay.classList.add('show');
    modal.classList.add('show');
    document.body.classList.add('calendar-modal-active');
  }

  closeCalendarModal() {
    document.getElementById('calendarModalOverlay')?.classList.remove('show');
    document.getElementById('calendarModal')?.classList.remove('show');
    document.body.classList.remove('calendar-modal-active');
  }

  // ── Recaps / Campaign Log modal ────────────────────────────────
  async openRecapsModal() {
    const overlay = document.getElementById('recapsModalOverlay');
    const modal   = document.getElementById('recapsModal');
    const body    = document.getElementById('recapsModalBody');
    if (!overlay || !modal || !body) return;

    overlay.classList.add('show');
    modal.classList.add('show');
    document.body.classList.add('recaps-modal-active');

    if (body.dataset.loaded) return;

    body.innerHTML = '<div class="recaps-loading">Loading…</div>';
    try {
      const entries = await this.loadSheets([Config.SHEETS.RECAPS]);
      body.innerHTML = this.renderRecapsList(entries);
      body.dataset.loaded = 'true';
      this._setupRecapsInteractions(body);
    } catch (e) {
      body.innerHTML = '<div class="recaps-loading">Could not load campaign log.</div>';
      Config.warn('Recaps load error:', e);
    }
  }

  closeRecapsModal() {
    document.getElementById('recapsModalOverlay')?.classList.remove('show');
    document.getElementById('recapsModal')?.classList.remove('show');
    document.body.classList.remove('recaps-modal-active');
  }

  // ── Inventory modal ────────────────────────────────────────────
  async openInventoryModal() {
    const overlay = document.getElementById('inventoryModalOverlay');
    const modal   = document.getElementById('inventoryModal');
    if (!overlay || !modal) return;

    overlay.classList.add('show');
    modal.classList.add('show');
    document.body.classList.add('inventory-modal-active');

    // If we already have cached data, render immediately then refresh in background
    if (this._inventoryItems) {
      this._renderInventory();
      this._setupInventoryInteractions();
      this._loadInventoryData().then(() => this._renderInventory());
    } else {
      await this._loadInventoryData();
      this._renderInventory();
      this._setupInventoryInteractions();
    }
  }

  closeInventoryModal() {
    document.getElementById('inventoryModalOverlay')?.classList.remove('show');
    document.getElementById('inventoryModal')?.classList.remove('show');
    document.body.classList.remove('inventory-modal-active');
    // Reset form state
    this._hideInventoryForm();
    this._invEditingId = null;
  }

  async _loadInventoryData() {
    const loadMsg = document.getElementById('inventoryLoadingMsg');
    const table   = document.getElementById('inventoryTable');
    if (!this._inventoryItems) {
      if (loadMsg) loadMsg.style.display = '';
      if (table)   table.style.display = 'none';
    }

    try {
      // Fetch both sheets in a single request
      const url = new URL(Config.APPS_SCRIPT_URL);
      url.searchParams.set('sheets', `${Config.SHEETS.INVENTORY},${Config.SHEETS.PARTY_FUND}`);
      url.searchParams.set('filter_visible', 'false');
      const data = await this.jsonp(url.toString());
      const rows = data.success ? data.data : [];
      this._inventoryItems = rows.filter(r => r._category === Config.SHEETS.INVENTORY);
      this._partyFund = rows.find(r => r._category === Config.SHEETS.PARTY_FUND) || { drakons: '0', scales: '0' };
    } catch (e) {
      Config.warn('Inventory load error:', e);
      this._inventoryItems = this._inventoryItems || [];
      this._partyFund = this._partyFund || { drakons: '0', scales: '0' };
    }
  }

  _renderInventory() {
    const loadMsg  = document.getElementById('inventoryLoadingMsg');
    const table    = document.getElementById('inventoryTable');
    const emptyMsg = document.getElementById('inventoryEmptyMsg');
    const tbody    = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    // Update fund display
    this._updateFundDisplay();

    // Determine active filter states
    const activeTab  = document.querySelector('.inv-tab.active')?.dataset.category || 'all';
    const activeChar = this._invCharFilter || 'all';

    let items = this._inventoryItems || [];
    if (activeTab !== 'all') items = items.filter(it => (it.category || '') === activeTab);
    if (activeChar !== 'all') items = items.filter(it => (it.character || '') === activeChar);

    // Rebuild character filter chips
    this._renderCharFilter();

    if (loadMsg) loadMsg.style.display = 'none';

    if (items.length === 0) {
      if (table)   table.style.display = 'none';
      if (emptyMsg) emptyMsg.style.display = '';
      return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';
    if (table)   table.style.display = '';

    // Group by character, then render rows
    const grouped = {};
    items.forEach(it => {
      const char = (it.character || 'Unassigned').trim();
      if (!grouped[char]) grouped[char] = [];
      grouped[char].push(it);
    });

    tbody.innerHTML = Object.keys(grouped).map(char => {
      const rows = grouped[char].map(it => {
        const id       = this._esc(String(it.id || ''));
        const name     = this._esc(String(it.name || ''));
        const category = this._esc(String(it.category || ''));
        const qty      = this._esc(String(it.quantity || '1'));
        const notes    = this._esc(String(it.notes || ''));
        return `<tr class="inv-row" data-id="${id}">
          <td class="inv-col-char inv-char-cell"></td>
          <td class="inv-col-name">${name}</td>
          <td class="inv-col-cat"><span class="inv-category-badge inv-cat-${category.toLowerCase().replace(/\s+/g, '-')}">${category}</span></td>
          <td class="inv-col-qty">${qty}</td>
          <td class="inv-col-notes inv-notes-cell">${notes}</td>
          <td class="inv-col-actions">
            <button class="inv-action-btn inv-edit-btn" data-id="${id}" title="Edit">&#9998;</button>
            <button class="inv-action-btn inv-delete-btn" data-id="${id}" title="Delete">&times;</button>
          </td>
        </tr>`;
      }).join('');

      return `<tr class="inv-char-header-row"><td colspan="6" class="inv-char-header">${this._esc(char)}</td></tr>${rows}`;
    }).join('');
  }

  _renderCharFilter() {
    const container = document.getElementById('inventoryCharFilter');
    if (!container) return;

    // Get unique characters from all items (unfiltered by tab)
    const chars = [...new Set((this._inventoryItems || []).map(it => (it.character || 'Unassigned').trim()))].sort();
    const active = this._invCharFilter || 'all';
    const chips = [
      `<button class="inv-char-chip ${active === 'all' ? 'active' : ''}" data-char="all">All</button>`,
      ...chars.map(c => `<button class="inv-char-chip ${active === c ? 'active' : ''}" data-char="${this._esc(c)}">${this._esc(c)}</button>`)
    ].join('');

    container.innerHTML = chips.length > 28 ? chips : chips; // always show
    // Rebuild character datalist in add form
    this._rebuildCharDatalist();
  }

  _rebuildCharDatalist() {
    const list = document.getElementById('invCharacterList');
    if (!list) return;
    const chars = [...new Set((this._inventoryItems || []).map(it => (it.character || '').trim()))].filter(Boolean).sort();
    list.innerHTML = chars.map(c => `<option value="${this._esc(c)}"></option>`).join('');
  }

  _updateFundDisplay() {
    const fund = this._partyFund || {};
    const drakons = parseInt(fund.drakons, 10) || 0;
    const scales  = parseInt(fund.scales,  10) || 0;
    const dAmt = document.getElementById('fundDrakonsAmt');
    const sAmt = document.getElementById('fundScalesAmt');
    if (dAmt) dAmt.textContent = drakons.toLocaleString();
    if (sAmt) sAmt.textContent = scales.toLocaleString();
  }

  _setupInventoryInteractions() {
    if (this._invInteractionsSet) return;
    this._invInteractionsSet = true;

    // Category tab clicks
    const tabs = document.getElementById('inventoryTabs');
    if (tabs) {
      tabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.inv-tab');
        if (!tab) return;
        tabs.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._renderInventory();
      });
    }

    // Character filter chips
    const charFilter = document.getElementById('inventoryCharFilter');
    if (charFilter) {
      charFilter.addEventListener('click', (e) => {
        const chip = e.target.closest('.inv-char-chip');
        if (!chip) return;
        this._invCharFilter = chip.dataset.char;
        this._renderInventory();
      });
    }

    // Add item button
    const addBtn = document.getElementById('inventoryAddBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this._invEditingId = null;
        this._showInventoryForm();
      });
    }

    // Form save/cancel
    const saveBtn   = document.getElementById('invFormSaveBtn');
    const cancelBtn = document.getElementById('invFormCancelBtn');
    if (saveBtn)   saveBtn.addEventListener('click',   () => this._submitInventoryItem());
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      this._hideInventoryForm();
      this._invEditingId = null;
    });

    // Table row actions (edit/delete) — delegated
    const tbody = document.getElementById('inventoryTableBody');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const editBtn   = e.target.closest('.inv-edit-btn');
        const deleteBtn = e.target.closest('.inv-delete-btn');
        if (editBtn)   this._startEditInventoryItem(editBtn.dataset.id);
        if (deleteBtn) this._deleteInventoryItem(deleteBtn.dataset.id);
      });
    }

    // Fund edit button
    const fundEditBtn   = document.getElementById('fundEditBtn');
    const fundSaveBtn   = document.getElementById('fundSaveBtn');
    const fundCancelBtn = document.getElementById('fundCancelBtn');
    if (fundEditBtn) {
      fundEditBtn.addEventListener('click', () => this._openFundEditor());
    }
    if (fundSaveBtn)   fundSaveBtn.addEventListener('click',   () => this._saveFund());
    if (fundCancelBtn) fundCancelBtn.addEventListener('click', () => this._closeFundEditor());
  }

  _showInventoryForm(prefill = null) {
    const formRow = document.getElementById('inventoryFormRow');
    if (!formRow) return;

    this._rebuildCharDatalist();

    if (prefill) {
      const charEl = document.getElementById('invFormCharacter');
      if (charEl) charEl.value = prefill.character || '';
      const nameEl = document.getElementById('invFormName');
      const catEl  = document.getElementById('invFormCategory');
      const qtyEl  = document.getElementById('invFormQty');
      const notesEl = document.getElementById('invFormNotes');
      if (nameEl)  nameEl.value  = prefill.name     || '';
      if (catEl)   catEl.value   = prefill.category || 'General';
      if (qtyEl)   qtyEl.value   = prefill.quantity || 1;
      if (notesEl) notesEl.value = prefill.notes    || '';
    } else {
      // Reset form
      const charEl  = document.getElementById('invFormCharacter');
      const nameEl  = document.getElementById('invFormName');
      const qtyEl   = document.getElementById('invFormQty');
      const notesEl = document.getElementById('invFormNotes');
      if (charEl)  charEl.value  = '';
      if (nameEl)  nameEl.value  = '';
      if (qtyEl)   qtyEl.value   = 1;
      if (notesEl) notesEl.value = '';
      const catEl = document.getElementById('invFormCategory');
      if (catEl) catEl.value = 'General';
    }

    const status = document.getElementById('invFormStatus');
    if (status) status.textContent = '';

    formRow.style.display = '';
    document.getElementById('invFormName')?.focus();
  }

  _hideInventoryForm() {
    const formRow = document.getElementById('inventoryFormRow');
    if (formRow) formRow.style.display = 'none';
  }

  _startEditInventoryItem(id) {
    const item = (this._inventoryItems || []).find(it => String(it.id) === String(id));
    if (!item) return;
    this._invEditingId = id;
    this._showInventoryForm(item);
  }

  async _submitInventoryItem() {
    const charSel = document.getElementById('invFormCharacter');
    const nameEl  = document.getElementById('invFormName');
    const catEl   = document.getElementById('invFormCategory');
    const qtyEl   = document.getElementById('invFormQty');
    const notesEl = document.getElementById('invFormNotes');
    const status  = document.getElementById('invFormStatus');
    const saveBtn = document.getElementById('invFormSaveBtn');

    const character = (charSel?.value || '').trim();
    const name      = (nameEl?.value  || '').trim();
    const category  = catEl?.value  || 'General';
    const quantity  = qtyEl?.value  || '1';
    const notes     = notesEl?.value || '';

    if (!name) {
      if (status) { status.textContent = 'Item name is required.'; status.className = 'inv-form-status inv-status-error'; }
      return;
    }
    if (!character) {
      if (status) { status.textContent = 'Character is required.'; status.className = 'inv-form-status inv-status-error'; }
      return;
    }

    if (saveBtn) saveBtn.disabled = true;
    if (status) { status.textContent = 'Saving…'; status.className = 'inv-form-status inv-status-info'; }

    const isEdit = !!this._invEditingId;
    const rowId  = isEdit ? this._invEditingId : String(Date.now());

    const rowData = { id: rowId, character, name, category, quantity, notes };
    const url = new URL(Config.APPS_SCRIPT_URL);

    try {
      if (isEdit) {
        url.searchParams.set('action', 'edit');
        url.searchParams.set('payload', JSON.stringify({ sheet: Config.SHEETS.INVENTORY, row: rowData, rowId }));
      } else {
        url.searchParams.set('action', 'write');
        url.searchParams.set('payload', JSON.stringify({ sheet: Config.SHEETS.INVENTORY, row: rowData }));
      }
      Config.log('Inventory write payload:', JSON.parse(url.searchParams.get('payload')));
      const result = await this.jsonp(url.toString());
      Config.log('Inventory write result:', result);
      if (!result.success) throw new Error(result.error || 'Apps Script returned failure');

      if (status) { status.textContent = 'Saved!'; status.className = 'inv-form-status inv-status-success'; }
      if (saveBtn) saveBtn.disabled = false;

      // Update local cache
      if (isEdit) {
        const idx = (this._inventoryItems || []).findIndex(it => String(it.id) === String(rowId));
        if (idx !== -1) this._inventoryItems[idx] = { ...rowData, _category: Config.SHEETS.INVENTORY };
      } else {
        if (!this._inventoryItems) this._inventoryItems = [];
        this._inventoryItems.push({ ...rowData, _category: Config.SHEETS.INVENTORY });
      }

      this._invEditingId = null;
      setTimeout(() => {
        this._hideInventoryForm();
        this._renderInventory();
      }, 500);

    } catch (err) {
      Config.error('Inventory save error:', err);
      if (status) { status.textContent = 'Network error — check console.'; status.className = 'inv-form-status inv-status-error'; }
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  async _deleteInventoryItem(id) {
    if (!confirm('Remove this item from the inventory?')) return;
    const url = new URL(Config.APPS_SCRIPT_URL);
    url.searchParams.set('action', 'delete');
    url.searchParams.set('payload', JSON.stringify({ sheet: Config.SHEETS.INVENTORY, id }));
    try {
      const result = await this.jsonp(url.toString());
      if (!result.success) throw new Error(result.error || 'Delete failed');
      this._inventoryItems = (this._inventoryItems || []).filter(it => String(it.id) !== String(id));
      this._renderInventory();
    } catch (err) {
      Config.error('Inventory delete error:', err);
      alert('Could not delete item. Check console for details.');
    }
  }

  _openFundEditor() {
    const editor  = document.getElementById('fundEditor');
    const dInput  = document.getElementById('fundDrakonsInput');
    const sInput  = document.getElementById('fundScalesInput');
    const fund    = this._partyFund || {};
    if (dInput) dInput.value = parseInt(fund.drakons, 10) || 0;
    if (sInput) sInput.value = parseInt(fund.scales,  10) || 0;
    const status = document.getElementById('fundSaveStatus');
    if (status) status.textContent = '';
    if (editor) editor.style.display = '';
  }

  _closeFundEditor() {
    const editor = document.getElementById('fundEditor');
    if (editor) editor.style.display = 'none';
  }

  async _saveFund() {
    const dInput  = document.getElementById('fundDrakonsInput');
    const sInput  = document.getElementById('fundScalesInput');
    const status  = document.getElementById('fundSaveStatus');
    const saveBtn = document.getElementById('fundSaveBtn');

    const drakons = String(parseInt(dInput?.value || '0', 10) || 0);
    const scales  = String(parseInt(sInput?.value  || '0', 10) || 0);

    if (saveBtn) saveBtn.disabled = true;
    if (status) { status.textContent = 'Saving…'; status.style.color = '#c9b5e6'; }

    const url = new URL(Config.APPS_SCRIPT_URL);
    const fundExists = this._partyFund && (this._partyFund.drakons !== undefined);

    try {
      if (fundExists && this._partyFund.name) {
        // Edit existing fund row (matched by name='fund')
        url.searchParams.set('action', 'edit');
        url.searchParams.set('payload', JSON.stringify({
          sheet: Config.SHEETS.PARTY_FUND,
          row: { name: 'fund', drakons, scales },
          originalName: 'fund'
        }));
      } else {
        // Write first-time row
        url.searchParams.set('action', 'write');
        url.searchParams.set('payload', JSON.stringify({
          sheet: Config.SHEETS.PARTY_FUND,
          row: { name: 'fund', drakons, scales }
        }));
      }
      const result = await this.jsonp(url.toString());
      if (!result.success) throw new Error(result.error || 'Fund save failed');

      this._partyFund = { name: 'fund', drakons, scales };
      this._updateFundDisplay();
      if (status) { status.textContent = 'Saved!'; status.style.color = '#6fcf97'; }
      setTimeout(() => this._closeFundEditor(), 800);
    } catch (err) {
      Config.error('Fund save error:', err);
      if (status) { status.textContent = 'Error saving. Check console.'; status.style.color = '#eb5757'; }
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  _esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  renderRecapsList(entries) {
    const WORD_LIMIT = 60;
    if (!entries || entries.length === 0) {
      return '<div class="recaps-empty">No entries found in the Campaign Log.</div>';
    }
    // Sheet order is oldest-first; reverse so newest appears at the top
    const sorted = [...entries].reverse();
    const items = sorted.map((entry, i) => {
      const tag     = (entry.tag     || '').trim();
      const title   = (entry.title   || '').trim();
      const content = (entry.content || '').trim();
      const words   = content.split(/\s+/).filter(Boolean);
      const isTruncated = words.length > WORD_LIMIT;
      const preview     = isTruncated ? words.slice(0, WORD_LIMIT).join(' ') + '\u2026' : content;
      return `
        <article class="recap-entry" data-index="${i}">
          <div class="recap-entry-header" role="button" tabindex="0" aria-expanded="true">
            ${tag ? `<span class="recap-tag">${tag}</span>` : ''}
            <h2 class="recap-title">${title}</h2>
            <span class="recap-collapse-icon" aria-hidden="true"></span>
          </div>
          <div class="recap-body">
            <p class="recap-preview">${preview}</p>
            ${isTruncated ? `<p class="recap-full" hidden>${content}</p>` : ''}
            ${isTruncated ? `<button class="recap-read-more">Read More</button>` : ''}
          </div>
        </article>
        <hr class="recap-divider" />`;
    }).join('');
    return `<div class="recaps-list">${items}</div>`;
  }

  _setupRecapsInteractions(body) {
    body.addEventListener('click', (e) => {
      const readMoreBtn = e.target.closest('.recap-read-more');
      if (readMoreBtn) {
        const entry   = readMoreBtn.closest('.recap-entry');
        const preview = entry.querySelector('.recap-preview');
        const full    = entry.querySelector('.recap-full');
        if (full && preview) {
          preview.hidden = true;
          full.hidden    = false;
          readMoreBtn.hidden = true;
        }
        return;
      }
      const header = e.target.closest('.recap-entry-header');
      if (header) {
        const entry    = header.closest('.recap-entry');
        const bodyEl   = entry.querySelector('.recap-body');
        const expanded = header.getAttribute('aria-expanded') !== 'false';
        header.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        bodyEl.classList.toggle('recap-body--collapsed', expanded);
      }
    });
    body.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const header = e.target.closest('.recap-entry-header');
      if (header) { e.preventDefault(); header.click(); }
    });
  }

  renderCalendarWidget(events = [], monthIndex = 1, year = 1344) {
    const MONTHS = [
      { name: 'Thawmarch',   desc: 'The heavy snow retreats grudgingly, inch by inch, leaving behind mud, dead grass, and the things that didn\'t survive.' },
      { name: 'Mossdew',     desc: 'Color returns in wet, cautious increments, and the air carries the relief of people who weren\'t sure it ever would.' },
      { name: 'Springcrest', desc: 'The Breach tips into warmth and stays there, long days spilling over into longer evenings that nobody wants to end.' },
      { name: 'Eventide',    desc: 'The sun is at its fullest and the days burn long and generous before the slow turn begins.' },
      { name: 'Sunwake',     desc: 'The light starts pulling back as green wilts away, and the air tells tales of the cold to come.' },
      { name: 'Duskbreak',   desc: 'The warmth slumbers in stages: first the evenings, then the mornings. All prepare for the following stillness.' },
      { name: 'Stillwatch',  desc: 'Winter arrives without bargain, settling over everything like a judgment. The world goes still, dead, and cold.' },
    ];

    const DAYS_PER_WEEK   = 10;
    const WEEKS_PER_MONTH = 5;
    const TODAY_MONTH = Config.CURRENT_DATE.monthIndex;
    const TODAY_DAY   = Config.CURRENT_DATE.day;
    const TODAY_YEAR  = Config.CURRENT_DATE.year;

    const month = MONTHS[monthIndex];

    // Build event lookup keyed by day number for this month/year
    const eventMap = {};
    events.forEach(ev => {
      const evDay = parseInt(ev.day, 10);
      if (isNaN(evDay)) return;
      const evMonthRaw = (ev.month || '').trim();
      const matchName  = evMonthRaw.toLowerCase() === month.name.toLowerCase();
      const matchIdx   = parseInt(evMonthRaw, 10) === (monthIndex + 1);
      if (!matchName && !matchIdx) return;
      if (ev.year && parseInt(ev.year, 10) !== year) return;
      if (!eventMap[evDay]) eventMap[evDay] = [];
      eventMap[evDay].push({ title: ev.name || '', summary: ev.summary || '', article: ev.article || (String(ev.content || '').trim() ? ev.name || '' : '') });
    });

    const colHeaders = Array.from({ length: DAYS_PER_WEEK }, (_, i) =>
      `<th>${i + 1}</th>`
    ).join('');

    let rows = '';
    for (let week = 0; week < WEEKS_PER_MONTH; week++) {
      let cells = '';
      for (let col = 0; col < DAYS_PER_WEEK; col++) {
        const day = week * DAYS_PER_WEEK + col + 1;
        const isToday  = monthIndex === TODAY_MONTH && day === TODAY_DAY && year === TODAY_YEAR;
        const dayEvents = eventMap[day] || [];

        let dotsHtml = '';
        if (dayEvents.length) {
          dotsHtml = dayEvents.map(() => `<span class="cal-event-dot"></span>`).join('');
        }
        const evData = dayEvents.length ? ` data-cal-events='${JSON.stringify(dayEvents).replace(/'/g, '&#39;')}'` : '';

        cells += `<td class="cal-day${isToday ? ' cal-today' : ''}${dayEvents.length ? ' has-events' : ''}"${evData}><span class="cal-day-num">${day}</span>${dotsHtml}</td>`;
      }
      rows += `<tr>${cells}</tr>`;
    }

    const tabs = MONTHS.map((m, i) => `
      <button class="cal-month-tab${i === monthIndex ? ' active' : ''}" data-month="${i}" data-year="${year}">${m.name}</button>
    `).join('');

    return `
      <div class="calendar-widget">
        <div class="cal-month-meta">
          <span class="cal-year-label">${year}</span>
        </div>
        <div class="cal-tabs-row">${tabs}</div>
        <div class="cal-month-meta cal-month-desc-row">
          <p class="cal-month-desc">${month.desc}</p>
        </div>
        <div class="cal-grid-panel" id="_calGridPanel">
          <table class="calendar-table">
            <thead><tr>${colHeaders}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  setupCalendarNavigation(events) {
    const body = document.getElementById('calendarModalBody');
    if (!body) return;

    // Shared fixed tooltip element — created once on the document body
    let tip = document.getElementById('_calFloatTooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = '_calFloatTooltip';
      document.body.appendChild(tip);
      // Keep tooltip open while mouse moves into it
      tip.addEventListener('mouseenter', () => clearTimeout(tip._hideTimer));
      tip.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
      // Read more click
      tip.addEventListener('click', (e) => {
        const btn = e.target.closest('.cal-tooltip-readmore');
        if (btn) {
          tip.style.display = 'none';
          this.openCalendarLinkedArticle(btn.dataset.article);
        }
      });
    }

    const showTip = (cell) => {
      let evList;
      try { evList = JSON.parse(cell.dataset.calEvents || '[]'); } catch { return; }
      if (!evList.length) return;
      tip.innerHTML = evList.map(ev => `
        <div class="cal-tooltip-entry">
          <strong>${ev.title}</strong>
          ${ev.summary ? `<span>${ev.summary}</span>` : ''}
          ${ev.article ? `<button class="cal-tooltip-readmore" data-article="${ev.article}">Read more →</button>` : ''}
        </div>`).join('');
      // Show offscreen first to measure
      tip.style.visibility = 'hidden';
      tip.style.display    = 'block';
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      const rect = cell.getBoundingClientRect();
      // Prefer above; fall back to below if not enough room
      let top = rect.top - th - 8;
      if (top < 8) top = rect.bottom + 8;
      // Horizontally center over cell, clamped to viewport
      let left = rect.left + rect.width / 2 - tw / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
      tip.style.top        = top + 'px';
      tip.style.left       = left + 'px';
      tip.style.visibility = 'visible';
    };

    const scheduleHideTip = () => {
      tip._hideTimer = setTimeout(() => { tip.style.display = 'none'; }, 120);
    };

    // Delegated hover on the body — re-applied each render so stale cells don't accumulate handlers
    if (body._calTipEnter) body.removeEventListener('mouseenter', body._calTipEnter, true);
    if (body._calTipLeave) body.removeEventListener('mouseleave', body._calTipLeave, true);
    body._calTipEnter = (e) => {
      const cell = e.target.closest('td.has-events');
      if (cell) { clearTimeout(tip._hideTimer); showTip(cell); }
    };
    body._calTipLeave = (e) => { if (e.target.closest('td.has-events')) scheduleHideTip(); };
    body.addEventListener('mouseenter', body._calTipEnter, true);
    body.addEventListener('mouseleave', body._calTipLeave, true);

    // Hide tooltip when modal closes
    const overlay = document.getElementById('calendarModalOverlay');
    if (overlay && !overlay._calTipHide) {
      overlay._calTipHide = true;
      overlay.addEventListener('click', () => { tip.style.display = 'none'; });
    }
    const closeBtn = document.getElementById('closeCalendarBtn');
    if (closeBtn && !closeBtn._calTipHide) {
      closeBtn._calTipHide = true;
      closeBtn.addEventListener('click', () => { tip.style.display = 'none'; });
    }

    body.querySelectorAll('.cal-month-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const month = parseInt(tab.dataset.month, 10);
        const year  = parseInt(tab.dataset.year, 10);
        if (month === this._calCurrentMonth && year === this._calCurrentYear) return;

        const panel   = document.getElementById('_calGridPanel');
        const descRow = body.querySelector('.cal-month-desc-row');

        // Update active tab immediately
        body.querySelectorAll('.cal-month-tab').forEach(t => t.classList.toggle('active', t === tab));

        const fadeOut = panel ? panel : null;
        if (fadeOut)  fadeOut.classList.add('fading');
        if (descRow)  descRow.classList.add('fading');

        setTimeout(() => {
          this._calCurrentMonth = month;
          this._calCurrentYear  = year;
          // Re-render only the inner content, keeping the tabs intact
          const MONTHS = [
            { name: 'Thawmarch', desc: 'The heavy snow retreats grudgingly, inch by inch, leaving behind mud, dead grass, and the things that didn\'t survive.' },
            { name: 'Mossdew', desc: 'Color returns in wet, cautious increments, and the air carries the relief of people who weren\'t sure it ever would.' },
            { name: 'Springcrest', desc: 'The Breach tips into warmth and stays there, long days spilling over into longer evenings that nobody wants to end.' },
            { name: 'Eventide', desc: 'The sun is at its fullest and the days burn long and generous before the slow turn begins.' },
            { name: 'Sunwake', desc: 'The light starts pulling back as green wilts away, and the air tells tales of the cold to come.' },
            { name: 'Duskbreak', desc: 'The warmth slumbers in stages: first the evenings, then the mornings. All prepare for the following stillness.' },
            { name: 'Stillwatch', desc: 'Winter arrives without bargain, settling over everything like a judgment. The world goes still, dead, and cold.' },
          ];
          const m = MONTHS[month];
          const TODAY_MONTH = Config.CURRENT_DATE.monthIndex;
          const TODAY_DAY   = Config.CURRENT_DATE.day;
          const TODAY_YEAR  = Config.CURRENT_DATE.year;

          const eventMap = {};
          events.forEach(ev => {
            const evDay = parseInt(ev.day, 10);
            if (isNaN(evDay)) return;
            const evMonthRaw = (ev.month || '').trim();
            if (evMonthRaw.toLowerCase() !== m.name.toLowerCase() && parseInt(evMonthRaw, 10) !== (month + 1)) return;
            if (ev.year && parseInt(ev.year, 10) !== year) return;
            if (!eventMap[evDay]) eventMap[evDay] = [];
            eventMap[evDay].push({ title: ev.name || '', summary: ev.summary || '', article: ev.article || (String(ev.content || '').trim() ? ev.name || '' : '') });
          });

          const colHeaders = Array.from({ length: 10 }, (_, i) => `<th>${i + 1}</th>`).join('');
          let rows = '';
          for (let week = 0; week < 5; week++) {
            let cells = '';
            for (let col = 0; col < 10; col++) {
              const day = week * 10 + col + 1;
              const isToday  = month === TODAY_MONTH && day === TODAY_DAY && year === TODAY_YEAR;
              const dayEvents = eventMap[day] || [];
              let dotsHtml = dayEvents.map(() => `<span class="cal-event-dot"></span>`).join('');
              const evData = dayEvents.length ? ` data-cal-events='${JSON.stringify(dayEvents).replace(/'/g, '&#39;')}'` : '';
              cells += `<td class="cal-day${isToday ? ' cal-today' : ''}${dayEvents.length ? ' has-events' : ''}"${evData}><span class="cal-day-num">${day}</span>${dotsHtml}</td>`;
            }
            rows += `<tr>${cells}</tr>`;
          }

          if (descRow) {
            descRow.innerHTML = `<p class="cal-month-desc">${m.desc}</p>`;
            descRow.classList.remove('fading');
          }
          const newPanel = document.getElementById('_calGridPanel');
          if (newPanel) {
            newPanel.innerHTML = `<table class="calendar-table"><thead><tr>${colHeaders}</tr></thead><tbody>${rows}</tbody></table>`;
            newPanel.classList.remove('fading');
          }
        }, 180);
      });
    });
  }

  async openCalendarLinkedArticle(articleName) {
    // Reuse the Calendar panel viewer if it's already loaded — same sheet, same cache.
    // Fall back to a dedicated single-sheet viewer if the panel hasn't been opened yet.
    // Restricting to Calendar only ensures we always hit the prefetch cache and never
    // trigger a slow cross-sheet JSONP request.
    let viewer = this._viewer_calendar;
    if (!viewer || viewer.currentArticles.length === 0) {
      if (!this._viewer_calArticles) {
        this._viewer_calArticles = new ArticleViewer(this, [Config.SHEETS.CALENDAR], Config.SHEETS.CALENDAR);
      }
      viewer = this._viewer_calArticles;
      if (viewer.currentArticles.length === 0) {
        await viewer.loadArticleData();
      }
    }
    const nameLower = articleName.toLowerCase();
    const article = viewer.currentArticles.find(
      a => (a.name || '').toLowerCase() === nameLower
    );
    if (article) {
      viewer.openArticle(article._uid, article._category);
    } else {
      Config.warn('Calendar: linked article not found:', articleName);
    }
  }

  setPageVisibility(activePage) {
    const landing = document.querySelector('.landing-screen');
    const hub     = document.getElementById('worldHub');
    if (landing) landing.style.display = activePage === 'landing' ? 'block' : 'none';
    // world-hub uses flex layout — must not use 'block'
    if (hub) hub.style.display = activePage === 'hub' ? 'flex' : 'none';
  }

  // ========== Panel Management ==========
  async initializePanels() {
    // Tile click listeners
    document.querySelectorAll('.hub-tile').forEach(tile => {
      if (tile._tileClick) return; // prevent duplicate bindings on re-entry
      tile.addEventListener('click', () => this.selectPanel(tile.dataset.panel));
      tile._tileClick = true;
    });

    // Back-to-hub button
    const backBtn = document.getElementById('hubBackBtn');
    if (backBtn && !backBtn._backClick) {
      backBtn.addEventListener('click', () => this.showHubSelection());
      backBtn._backClick = true;
    }

    // Journal / Calendar header buttons
    const journalBtn  = document.getElementById('journalBtn');
    const calendarBtn = document.getElementById('calendarBtn');
    if (journalBtn && !journalBtn._jClick) {
      journalBtn.addEventListener('click', () => this.openJournalModal());
      journalBtn._jClick = true;
    }
    if (calendarBtn && !calendarBtn._cClick) {
      calendarBtn.addEventListener('click', () => this.openCalendarModal());
      calendarBtn._cClick = true;
    }
    const recapsBtn = document.getElementById('recapsBtn');
    if (recapsBtn && !recapsBtn._rClick) {
      recapsBtn.addEventListener('click', () => this.openRecapsModal());
      recapsBtn._rClick = true;
    }
    const inventoryBtn = document.getElementById('inventoryBtn');
    if (inventoryBtn && !inventoryBtn._iClick) {
      inventoryBtn.addEventListener('click', () => this.openInventoryModal());
      inventoryBtn._iClick = true;
    }

    this.currentSelectedPanel = null;
  }

  showHubSelection() {
    this.currentSelectedPanel = null;
    const titleText   = document.getElementById('hubTitleText');
    const panelNav    = document.getElementById('hubPanelNav');
    const selection   = document.getElementById('hubSelection');
    const contentArea = document.getElementById('hubContentArea');
    const mainArea    = document.getElementById('hubMainArea');

    // Fade out content area
    if (contentArea && contentArea.style.display !== 'none') {
      contentArea.style.transition = 'opacity 0.2s ease';
      contentArea.style.opacity = '0';
      setTimeout(() => {
        contentArea.style.display = 'none';
        contentArea.style.opacity = '1';
        // Fade selection back in
        if (selection) {
          selection.style.display = '';
          selection.style.opacity = '0';
          requestAnimationFrame(() => {
            selection.style.transition = 'opacity 0.3s ease';
            selection.style.opacity = '1';
          });
        }
      }, 220);
    } else if (selection) {
      selection.style.display = '';
      selection.style.opacity = '1';
    }

    if (titleText) { titleText.style.display = ''; }
    if (panelNav)  { panelNav.style.display = 'none'; }
    if (mainArea)  { mainArea.scrollTop = 0; }
  }

  async selectPanel(panelName) {
    this.currentSelectedPanel = panelName;

    // Update header nav
    const titleText        = document.getElementById('hubTitleText');
    const panelNav         = document.getElementById('hubPanelNav');
    const activePanelTitle = document.getElementById('hubActivePanelTitle');
    if (titleText)        titleText.style.display = 'none';
    if (panelNav)         panelNav.style.display = 'flex';
    if (activePanelTitle) activePanelTitle.textContent =
      panelName.charAt(0).toUpperCase() + panelName.slice(1);

    const selection   = document.getElementById('hubSelection');
    const contentArea = document.getElementById('hubContentArea');
    const mainArea    = document.getElementById('hubMainArea');

    // Fade out selection grid
    if (selection && selection.style.display !== 'none') {
      selection.style.transition = 'opacity 0.2s ease';
      selection.style.opacity = '0';
      await new Promise(r => setTimeout(r, 220));
      selection.style.display = 'none';
      selection.style.opacity = '1';
    }

    // Show content area, hide all panel slots, then reveal the right one
    if (contentArea) {
      contentArea.style.display = 'block';
      contentArea.querySelectorAll('.panel-content').forEach(el => {
        el.style.display = 'none';
      });
    }

    const idMap = {
      nations:    'nationsContent',
      species:    'speciesContent',
      deities:    'deitiesContent',
      history:    'historyContent',
      literature: 'literatureContent',
      society:    'societyContent',
      characters: 'charactersContent',
      factions:   'factionsContent',
      bestiary:   'bestiaryContent',
      items:      'itemsContent',
      alchemy:    'alchemyContent',
      locations:  'locationsContent',
      calendar:   'calendarContent'
    };
    const contentEl = document.getElementById(idMap[panelName]);
    if (contentEl) {
      contentEl.style.display = 'block';
      contentEl.style.opacity = '0';
      if (mainArea) mainArea.scrollTop = 0;
      // Show skeleton immediately so there's feedback during async load
      if (contentEl.dataset.loaded !== 'true') {
        contentEl.innerHTML = `
          <div class="article-viewer">
            <div class="article-filters">
              <div class="filter-group">
                <input type="text" id="articleSearch" placeholder="Search articles..." value="" disabled>
              </div>
              <div class="filter-group">
                <select id="tagFilter" disabled><option value="">All Tags</option></select>
              </div>
              <button id="clearFilters" class="clear-btn" disabled>Clear All</button>
            </div>
            <div id="articlesGridContainer">
              <div class="panel-skeleton">
                ${Array.from({length: 12}).map(() => '<div class="skeleton-card"></div>').join('')}
              </div>
            </div>
          </div>`;
      }
      requestAnimationFrame(() => {
        contentEl.style.transition = 'opacity 0.4s ease';
        contentEl.style.opacity = '1';
      });
    }

    await this.loadPanelContent(panelName);
  }

  // Fade out current content, swap HTML, fade back in.
  // Pass markLoaded=false to skip the permanent cache flag (e.g. empty state).
  async _fadeInContent(contentEl, html, markLoaded = true) {
    const existingGrid = contentEl.querySelector('#articlesGridContainer');
    if (existingGrid) {
      // Skeleton is showing — fade only the grid, leave the filter bar untouched
      existingGrid.style.transition = 'opacity 0.2s ease';
      existingGrid.style.opacity    = '0';
      await new Promise(r => setTimeout(r, 220));
      contentEl.innerHTML = html;
      if (markLoaded) contentEl.dataset.loaded = 'true';
      const newGrid = contentEl.querySelector('#articlesGridContainer');
      if (newGrid) {
        newGrid.style.opacity = '0';
        requestAnimationFrame(() => {
          newGrid.style.transition = 'opacity 0.4s ease';
          newGrid.style.opacity    = '1';
        });
      }
    } else {
      // No skeleton yet — fade the whole panel (initial entry)
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
  }

  async loadPanelContent(panelName) {
    const contentEl = document.getElementById(this._panelIdMap[panelName]);
    if (!contentEl || contentEl.dataset.loaded === 'true') return;

    // Sheet name matches panel name with capital first letter (Nations, Species, etc.)
    const sheetName = panelName.charAt(0).toUpperCase() + panelName.slice(1);
    const sheetNames = panelName === 'society' ? ['Society', 'Technology'] : [sheetName];
    const viewerKey = `_viewer_${panelName}`;

    try {
      if (!this[viewerKey]) {
        this[viewerKey] = new ArticleViewer(this, sheetNames, sheetName);
        if (panelName === 'locations') {
          this[viewerKey].tagGrouped = true;
        }
        Config.log(`Created ArticleViewer for ${panelName}`);
      }
      const viewer  = this[viewerKey];
      const content = await viewer.renderReadMode(this.currentWorld?.id);
      await this._fadeInContent(contentEl, content, viewer.currentArticles.length > 0);
      viewer._container = contentEl;
      viewer.setupEventListeners();
    } catch (error) {
      await this._fadeInContent(contentEl, `<div class="error">Error loading ${panelName}: ${error.message}</div>`);
      Config.error(`Error loading ${panelName}:`, error);
    }
  }

  // ========== Data Loading ==========

  // Background-warm the demand cache for specific sheets without blocking the UI.
  _warmCache(sheetNames) {
    this.loadSheets(sheetNames).catch(e => Config.warn('Cache warm failed:', e.message));
  }

  // Remove the loading state from the world card and animate it in.
  _revealWorldCard() {
    const loadingCard = document.querySelector('.world-card.loading');
    if (!loadingCard) return; // Already revealed or not present
    // Write real description just before revealing so it's in place when the overlay fades in
    const world = this.worlds[0];
    if (world) {
      const descriptionEl = loadingCard.querySelector('.world-description');
      if (descriptionEl) descriptionEl.textContent = world.description;
    }
    loadingCard.removeAttribute('data-loading');
    loadingCard.classList.remove('loading');
  }

  // Fetches one or more sheet names, serving from per-sheet demand cache on revisit.
  // Returns the flat array of row objects, each with a ._category field.
  async loadSheets(sheetNames) {
    try {
      // Serve any already-cached sheets and only fetch the rest.
      const uncached = sheetNames.filter(name => !(name in this._sheetCache));

      if (uncached.length > 0) {
        const url  = Config.getSheetUrl(uncached);
        const data = await this.jsonp(url);
        if (!data.success) {
          Config.error('loadSheets failed:', data.error);
          return [];
        }
        // Populate the demand cache for each fetched sheet.
        uncached.forEach(name => { this._sheetCache[name] = []; });
        (data.data || []).forEach(row => {
          const cat = row._category;
          if (cat && cat in this._sheetCache) this._sheetCache[cat].push(row);
        });
        Config.log('loadSheets fetched and cached:', uncached);
      }

      const rows = sheetNames.flatMap(name => this._sheetCache[name] || []);
      Config.log(`loadSheets served ${rows.length} rows for:`, sheetNames);
      return rows;
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