class TTRPGHub {
    constructor() {
        this.currentWorld = null;
        this.currentMode = null;
        this.worlds = [];

        this.init();
    }

    init() {
        this.loadWorlds();
        this.setupEventListeners();
        this.addDebugControls();
    }

    addDebugControls() {
        // Add a debug button to test Apps Script manually
        const debugButton = document.createElement('button');
        debugButton.textContent = '🔧 Test Apps Script';
        debugButton.style.position = 'fixed';
        debugButton.style.top = '10px';
        debugButton.style.right = '10px';
        debugButton.style.zIndex = '1000';
        debugButton.style.padding = '10px';
        debugButton.style.backgroundColor = '#ff6b35';
        debugButton.style.color = 'white';
        debugButton.style.border = 'none';
        debugButton.style.borderRadius = '5px';
        debugButton.style.cursor = 'pointer';
        
        debugButton.addEventListener('click', async () => {
            console.log('🔧 Manual Apps Script Test Started');
            try {
                await this.testAppsScript();
            } catch (error) {
                console.error('🔧 Manual test failed:', error);
            }
        });
        
        document.body.appendChild(debugButton);
    }

    async testAppsScript() {
        const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyY0R8Tss3q6dajTzO3UjqFoW6R5o8vMHSxg6S5eRINyjhnA-TB5fTklCms393pYhbk/exec';
        
        console.log('🧪 Testing direct URL access...');
        
        // Test 1: Basic connectivity
        try {
            const testResponse = await fetch(APPS_SCRIPT_URL, { method: 'GET' });
            console.log('🧪 Basic connectivity test - Status:', testResponse.status);
            console.log('🧪 Response headers:', Object.fromEntries(testResponse.headers.entries()));
            
            const testText = await testResponse.text();
            console.log('🧪 Response text (first 500 chars):', testText.substring(0, 500));
        } catch (error) {
            console.error('🧪 Basic connectivity failed:', error);
        }

        // Test 2: Test with worlds parameter
        try {
            console.log('🧪 Testing with ?path=worlds parameter...');
            const worldsResponse = await fetch(`${APPS_SCRIPT_URL}?path=worlds`);
            console.log('🧪 Worlds test - Status:', worldsResponse.status);
            
            const worldsText = await worldsResponse.text();
            console.log('🧪 Worlds response text:', worldsText);
            
            try {
                const worldsData = JSON.parse(worldsText);
                console.log('🧪 Worlds parsed JSON:', worldsData);
            } catch (parseError) {
                console.error('🧪 Worlds JSON parse error:', parseError);
            }
        } catch (error) {
            console.error('🧪 Worlds test failed:', error);
        }

        // Test 3: Alternative approach with no parameters
        try {
            console.log('🧪 Testing with no parameters...');
            const noParamsResponse = await fetch(APPS_SCRIPT_URL);
            const noParamsText = await noParamsResponse.text();
            console.log('🧪 No params response:', noParamsText);
        } catch (error) {
            console.error('🧪 No params test failed:', error);
        }
    }

    setupEventListeners() {
        // Back buttons
        document.getElementById('backBtn').addEventListener('click', () => {
            this.showWorldSelection();
        });

        document.getElementById('hubBackBtn').addEventListener('click', () => {
            this.showModeSelection();
        });

        // Mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.selectMode(mode);
            });
        });
    }

    async loadWorlds() {
        try {
            // Load worlds from Google Apps Script Web App
            await this.loadWorldsFromAppsScript();
        } catch (error) {
            // Fallback to mock data if Apps Script fails
            console.error('Failed to load worlds:', error);

            const mockWorlds = [
                {
                    id: 'forgotten-realms',
                    name: 'Forgotten Realms',
                    description: 'Classic D&D fantasy setting with rich lore and diverse regions.',
                    system: 'D&D 5e'
                },
                {
                    id: 'shadowrun',
                    name: 'Shadowrun 2070',
                    description: 'Cyberpunk meets fantasy in this dystopian future.',
                    system: 'Shadowrun 6e'
                },
                {
                    id: 'call-of-cthulhu',
                    name: 'Miskatonic University',
                    description: 'Investigate cosmic horrors in 1920s New England.',
                    system: 'Call of Cthulhu'
                }
            ];

            this.worlds = mockWorlds;
            this.renderWorlds();
        }
    }

    renderWorlds() {
        const worldsGrid = document.getElementById('worldsGrid');

        if (this.worlds.length === 0) {
            worldsGrid.innerHTML = '<div class="world-card loading">No worlds available</div>';
            return;
        }

        worldsGrid.innerHTML = this.worlds.map(world => `
            <div class="world-card" data-world-id="${world.id}">
                <div class="world-name">${world.name}</div>
                <div class="world-description">${world.description}</div>
                <small style="color: #ffd700; margin-top: 10px; display: block;">System: ${world.system}</small>
            </div>
        `).join('');

        // Add click listeners to world cards
        document.querySelectorAll('.world-card').forEach(card => {
            if (!card.classList.contains('loading')) {
                card.addEventListener('click', (e) => {
                    const worldId = e.currentTarget.dataset.worldId;
                    this.selectWorld(worldId);
                });
            }
        });
    }

    selectWorld(worldId) {
        this.currentWorld = this.worlds.find(w => w.id === worldId);
        if (this.currentWorld) {
            this.showModeSelection();
        }
    }

    selectMode(mode) {
        this.currentMode = mode;
        this.showWorldHub();
    }

    showWorldSelection() {
        document.querySelector('.landing-screen').style.display = 'block';
        document.getElementById('modeSelection').style.display = 'none';
        document.getElementById('worldHub').style.display = 'none';
        this.currentWorld = null;
        this.currentMode = null;
    }

    showModeSelection() {
        document.querySelector('.landing-screen').style.display = 'none';
        document.getElementById('modeSelection').style.display = 'block';
        document.getElementById('worldHub').style.display = 'none';
    }

    showWorldHub() {
        document.querySelector('.landing-screen').style.display = 'none';
        document.getElementById('modeSelection').style.display = 'none';
        document.getElementById('worldHub').style.display = 'block';

        // Update hub header
        document.getElementById('currentWorldName').textContent = this.currentWorld.name;
        document.getElementById('currentMode').textContent = `Mode: ${this.currentMode.charAt(0).toUpperCase() + this.currentMode.slice(1)}`;

        // Load appropriate content for the mode
        this.loadHubContent();
    }

    loadHubContent() {
        const hubContent = document.getElementById('hubContent');

        switch (this.currentMode) {
            case 'play':
                hubContent.innerHTML = this.getPlayModeContent();
                break;
            case 'read':
                hubContent.innerHTML = this.getReadModeContent();
                break;
            case 'build':
                hubContent.innerHTML = this.getBuildModeContent();
                break;
            default:
                hubContent.innerHTML = '<p>Unknown mode selected.</p>';
        }
    }

    getPlayModeContent() {
        return `
            <h3>🎲 Play Mode - ${this.currentWorld.name}</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px;">
                <div class="tool-card">
                    <h4>Character Sheets</h4>
                    <p>Manage your characters</p>
                    <button onclick="alert('Character sheets coming soon!')">Open</button>
                </div>
                <div class="tool-card">
                    <h4>Dice Roller</h4>
                    <p>Roll dice for actions</p>
                    <button onclick="alert('Dice roller coming soon!')">Roll</button>
                </div>
                <div class="tool-card">
                    <h4>Session Notes</h4>
                    <p>Track your adventure</p>
                    <button onclick="alert('Session notes coming soon!')">View</button>
                </div>
                <div class="tool-card">
                    <h4>Maps & Tokens</h4>
                    <p>Visual battle maps</p>
                    <button onclick="alert('Maps coming soon!')">Load</button>
                </div>
            </div>
            <style>
                .tool-card {
                    background: rgba(76, 175, 80, 0.1);
                    border: 1px solid rgba(76, 175, 80, 0.3);
                    border-radius: 8px;
                    padding: 15px;
                    text-align: center;
                }
                .tool-card button {
                    background: #4CAF50;
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

    getReadModeContent() {
        return `
            <h3>📖 Read Mode - ${this.currentWorld.name}</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px;">
                <div class="tool-card">
                    <h4>World Lore</h4>
                    <p>History and background</p>
                    <button onclick="alert('World lore coming soon!')">Browse</button>
                </div>
                <div class="tool-card">
                    <h4>NPCs & Factions</h4>
                    <p>Important characters</p>
                    <button onclick="alert('NPCs coming soon!')">View</button>
                </div>
                <div class="tool-card">
                    <h4>Rules Reference</h4>
                    <p>System mechanics</p>
                    <button onclick="alert('Rules coming soon!')">Read</button>
                </div>
                <div class="tool-card">
                    <h4>Campaign Journal</h4>
                    <p>Story so far</p>
                    <button onclick="alert('Journal coming soon!')">Read</button>
                </div>
            </div>
            <style>
                .tool-card {
                    background: rgba(33, 150, 243, 0.1);
                    border: 1px solid rgba(33, 150, 243, 0.3);
                    border-radius: 8px;
                    padding: 15px;
                    text-align: center;
                }
                .tool-card button {
                    background: #2196F3;
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

    getBuildModeContent() {
        return `
            <h3>🔨 Build Mode - ${this.currentWorld.name}</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px;">
                <div class="tool-card">
                    <h4>World Editor</h4>
                    <p>Modify world details</p>
                    <button onclick="alert('World editor coming soon!')">Edit</button>
                </div>
                <div class="tool-card">
                    <h4>NPC Creator</h4>
                    <p>Design characters</p>
                    <button onclick="alert('NPC creator coming soon!')">Create</button>
                </div>
                <div class="tool-card">
                    <h4>Location Builder</h4>
                    <p>Create places</p>
                    <button onclick="alert('Location builder coming soon!')">Build</button>
                </div>
                <div class="tool-card">
                    <h4>Content Manager</h4>
                    <p>Organize all content</p>
                    <button onclick="alert('Content manager coming soon!')">Manage</button>
                </div>
            </div>
            <style>
                .tool-card {
                    background: rgba(255, 152, 0, 0.1);
                    border: 1px solid rgba(255, 152, 0, 0.3);
                    border-radius: 8px;
                    padding: 15px;
                    text-align: center;
                }
                .tool-card button {
                    background: #FF9800;
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

    showError(message) {
        const worldsGrid = document.getElementById('worldsGrid');
        worldsGrid.innerHTML = `<div class="world-card loading" style="color: #ff6b6b;">${message}</div>`;
    }

    // Apps Script Web App Integration Methods
    async loadWorldsFromAppsScript() {
        try {
            const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyY0R8Tss3q6dajTzO3UjqFoW6R5o8vMHSxg6S5eRINyjhnA-TB5fTklCms393pYhbk/exec';
            const testUrl = `${APPS_SCRIPT_URL}?path=worlds`;
            
            console.log('🔄 Loading worlds from Apps Script:', testUrl);

            const response = await fetch(testUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });

            console.log('📊 Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ HTTP Error Response:', errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const responseText = await response.text();
            console.log('📄 Raw response:', responseText.substring(0, 500));

            let data;
            try {
                data = JSON.parse(responseText);
                console.log('✅ Parsed response:', data);
            } catch (parseError) {
                console.error('❌ JSON parse error:', parseError);
                throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
            }

            if (data.success && Array.isArray(data.data)) {
                // Map the Google Sheets data to our world format
                this.worlds = data.data.map((world, index) => ({
                    id: world.id || world.key || `world-${index}`,
                    name: world.name || world.world_name || 'Unnamed World',
                    description: world.description || world.world_description || 'No description available',
                    system: world.system || world.dice_set || world.game_system || 'Unknown System'
                }));
                
                console.log('✅ Successfully loaded worlds:', this.worlds);
                this.renderWorlds();
                return;
            } else if (data.error) {
                throw new Error(`Apps Script Error: ${data.error} - ${data.message || 'No additional details'}`);
            } else {
                console.warn('⚠️ Unexpected response format:', data);
                throw new Error(`Unexpected response format. Expected {success: true, data: [...]} but got: ${JSON.stringify(data).substring(0, 200)}`);
            }

        } catch (error) {
            console.error('❌ Apps Script connection failed:', error);
            
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                console.error('❌ Network connectivity issue - Apps Script URL may be wrong or inaccessible');
                this.showError('Cannot connect to Google Apps Script. Please check the URL and deployment settings.');
            } else {
                console.error('❌ Apps Script error:', error.message);
                this.showError(`Apps Script Error: ${error.message}`);
            }
            
            throw error;
        }
    }

    async saveToAppsScript(worldData) {
        try {
            const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyY0R8Tss3q6dajTzO3UjqFoW6R5o8vMHSxg6S5eRINyjhnA-TB5fTklCms393pYhbk/exec';

            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    path: 'worlds',
                    action: 'save',
                    data: worldData
                })
            });

            const result = await response.json();

            if (result.success) {
                alert('Data saved successfully!');
                // Reload worlds to reflect changes
                await this.loadWorldsFromAppsScript();
            } else {
                throw new Error(result.error || 'Failed to save');
            }
        } catch (error) {
            console.error('Failed to save to Apps Script:', error);
            alert('Failed to save data: ' + error.message);
        }
    }

    // Additional methods for different data types
    async loadArticles(worldId) {
        try {
            const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyY0R8Tss3q6dajTzO3UjqFoW6R5o8vMHSxg6S5eRINyjhnA-TB5fTklCms393pYhbk/exec';

            console.log('Loading articles for world:', worldId);
            const response = await fetch(`${APPS_SCRIPT_URL}?path=articles&world_id=${worldId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Articles response:', data);

            return data.success ? data.data : [];
        } catch (error) {
            console.error('Failed to load articles:', error);
            return [];
        }
    }

    async loadCategories(worldId) {
        try {
            const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyY0R8Tss3q6dajTzO3UjqFoW6R5o8vMHSxg6S5eRINyjhnA-TB5fTklCms393pYhbk/exec';

            console.log('Loading categories for world:', worldId);
            const response = await fetch(`${APPS_SCRIPT_URL}?path=categories&world_id=${worldId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Categories response:', data);

            return data.success ? data.data : [];
        } catch (error) {
            console.error('Failed to load categories:', error);
            return [];
        }
    }
}

// Initialize the hub when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new TTRPGHub();
});