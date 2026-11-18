/**
 * DEADLOCK DOSSIER — INTERACTIVE ARCHIVE ENGINE
 * Implements drawer mechanics, staggered folder tabs, hover elevation,
 * full confidential dossiers, search, and synthesized sound effects.
 */

// Sound Engine using Web Audio API (100% procedural, no external audio files required)
class ArchiveSoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    // Gentle paper rustle when hovering over a folder
    playPaperRustle() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const bufferSize = this.ctx.sampleRate * 0.12;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1800 + Math.random() * 600;
            filter.Q.value = 2.5;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noise.start();
        } catch (e) {
            // Audio error handling
        }
    }

    // Heavy wooden/metal drawer slide sound
    playDrawerSlide() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            
            // Sub thud
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(110, now);
            osc.frequency.exponentialRampToValueAtTime(45, now + 0.22);
            oscGain.gain.setValueAtTime(0.12, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc.connect(oscGain);
            oscGain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.22);

            // Friction scrape
            const bufferSize = this.ctx.sampleRate * 0.25;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * 0.5;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);
            filter.linearRampToValueAtTime ? filter.frequency.linearRampToValueAtTime(300, now + 0.25) : (filter.frequency.value = 300);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            noise.start(now);
        } catch (e) {
            // Audio fallback
        }
    }

    // Dossier stamp sound when opening document
    playDossierOpen() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.18);

            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.18);
        } catch (e) {
            // Audio fallback
        }
    }
}

// Global App State
const state = {
    activeDrawer: 'L-P', // Defaults to L - P (middle drawer)
    currentHeroIndex: 0,
    isModalOpen: false,
    searchQuery: '',
    sound: new ArchiveSoundEngine()
};

// DOM Elements holder
let elements = {};

function initElements() {
    elements = {
        drawerCols: {
            'A-K': document.getElementById('drawerCol-A-K'),
            'L-P': document.getElementById('drawerCol-L-P'),
            'Q-Z': document.getElementById('drawerCol-Q-Z')
        },
        stacks: {
            'A-K': document.getElementById('stack-A-K'),
            'L-P': document.getElementById('stack-L-P'),
            'Q-Z': document.getElementById('stack-Q-Z')
        },
        navButtons: document.querySelectorAll('.nav-drawer-btn'),
        activeCountLabel: document.getElementById('activeCountLabel'),
        searchInput: document.getElementById('searchInput'),
        clearSearchBtn: document.getElementById('clearSearch'),
        soundToggleBtn: document.getElementById('soundToggle'),
        modal: document.getElementById('dossierModal'),
        modalBackdrop: document.getElementById('modalBackdrop'),
        modalCloseBtn: document.getElementById('modalCloseBtn'),
        dossierPaper: document.getElementById('dossierPaper'),
        prevHeroBtn: document.getElementById('prevHeroBtn'),
        nextHeroBtn: document.getElementById('nextHeroBtn'),
        dossierCounter: document.getElementById('dossierCounter')
    };
}

// Render Folders into each drawer
function renderAllDrawers() {
    if (!window.HEROES_DATA || !Array.isArray(window.HEROES_DATA)) return;

    ['A-K', 'L-P', 'Q-Z'].forEach(drawerKey => {
        const stackEl = elements.stacks[drawerKey];
        if (!stackEl) return;
        
        stackEl.innerHTML = '';
        const heroesInDrawer = window.HEROES_DATA.filter(h => h.drawer === drawerKey);

        heroesInDrawer.forEach(hero => {
            const folderEl = createFolderElement(hero);
            stackEl.appendChild(folderEl);
        });
    });
}

// Create Folder Element with Staggered Tab
function createFolderElement(hero) {
    const item = document.createElement('div');
    item.className = 'dossier-folder-item';
    item.dataset.heroId = hero.id;

    // Manila Tab with staggered position (tab-slot-0 to tab-slot-4)
    const tabSlotClass = `tab-slot-${hero.tabSlot}`;
    
    item.innerHTML = `
        <div class="folder-tab ${tabSlotClass}">
            <img src="${hero.image}" alt="${hero.name}" class="tab-hero-avatar">
            <span class="tab-hero-name">${hero.name.toUpperCase()}</span>
            <span class="tab-badge">${hero.nameRu}</span>
        </div>
        <div class="folder-body">
            <div class="folder-body-line"></div>
        </div>
    `;

    // Folder interactions:
    // Hover: rises up + rustle sound
    item.addEventListener('mouseenter', () => {
        state.sound.playPaperRustle();
    });

    // Click: open dossier
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        openDossierById(hero.id);
    });

    return item;
}

// Switch Active Open Drawer
function updateActiveDrawer(targetDrawer, playAudio = true) {
    state.activeDrawer = targetDrawer;

    // Update drawer column classes
    Object.keys(elements.drawerCols).forEach(key => {
        const col = elements.drawerCols[key];
        if (!col) return;
        if (key === targetDrawer) {
            col.classList.add('active-open');
        } else {
            col.classList.remove('active-open');
        }
    });

    // Update nav button active states
    if (elements.navButtons) {
        elements.navButtons.forEach(btn => {
            if (btn.dataset.drawer === targetDrawer) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Update status counter
    if (window.HEROES_DATA) {
        const activeHeroes = window.HEROES_DATA.filter(h => h.drawer === targetDrawer);
        if (elements.activeCountLabel) {
            elements.activeCountLabel.textContent = `Секция [ ${targetDrawer} ] • Дел в ящике: ${activeHeroes.length}`;
        }
    }

    if (playAudio) {
        state.sound.playDrawerSlide();
    }
}

// Open Confidential Dossier Document by Hero ID
function openDossierById(heroId) {
    if (!window.HEROES_DATA) return;
    const index = window.HEROES_DATA.findIndex(h => h.id === heroId);
    if (index === -1) return;
    openDossierByIndex(index);
}

// Open Confidential Dossier Document by Index
function openDossierByIndex(index) {
    if (!window.HEROES_DATA) return;
    if (index < 0) index = window.HEROES_DATA.length - 1;
    if (index >= window.HEROES_DATA.length) index = 0;

    state.currentHeroIndex = index;
    const hero = window.HEROES_DATA[index];

    // Ensure parent drawer is active
    if (hero.drawer !== state.activeDrawer) {
        updateActiveDrawer(hero.drawer, false);
    }

    renderDossierContent(hero);

    // Update counter
    if (elements.dossierCounter) {
        elements.dossierCounter.textContent = `ДЕЛО ${index + 1} ИЗ ${window.HEROES_DATA.length} [ ${hero.drawer} ]`;
    }

    // Show modal
    if (elements.modal) {
        elements.modal.classList.add('active');
        elements.modal.setAttribute('aria-hidden', 'false');
    }
    state.isModalOpen = true;

    state.sound.playDossierOpen();
}

// Close Dossier Document
function closeDossier() {
    if (elements.modal) {
        elements.modal.classList.remove('active');
        elements.modal.setAttribute('aria-hidden', 'true');
    }
    state.isModalOpen = false;
    state.sound.playPaperRustle();
}

// Render full dossier paper inside the modal
function renderDossierContent(hero) {
    if (!elements.dossierPaper) return;

    // Difficulty stars
    const stars = '★'.repeat(hero.difficulty) + '☆'.repeat(3 - hero.difficulty);

    // Render abilities HTML
    const abilitiesHtml = hero.abilities.map((ab, idx) => {
        const isUlt = idx === 3;
        return `
            <div class="ability-card ${isUlt ? 'ult-card' : ''}">
                <div class="ability-header">
                    <span class="ability-key-badge">${ab.key}</span>
                    <span class="ability-name">${ab.name}</span>
                    <span class="ability-type">${ab.type}</span>
                </div>
                <div class="ability-desc">${ab.desc}</div>
            </div>
        `;
    }).join('');

    elements.dossierPaper.innerHTML = `
        <div class="doc-header">
            <div>
                <div class="doc-agency-info">НЬЮ-ЙОРКСКИЙ ДЕПАРТАМЕНТ НАДЗОРА ЗА АНОМАЛИЯМИ // ОТДЕЛ ДОСЬЕ</div>
                <h2 class="doc-file-number">${hero.dossierNo}: ${hero.name.toUpperCase()} (${hero.nameRu.toUpperCase()})</h2>
                <div class="doc-agency-info">СТАТУС: ПОД НАДЗОРОМ • СЕКЦИЯ КАРТОТЕКИ [ ${hero.drawer} ]</div>
            </div>
            <div>
                <div class="doc-classification-stamp">${hero.classification}</div>
            </div>
        </div>

        <div class="doc-grid">
            <!-- Left Column: Mugshot, Identity, Stats -->
            <div class="doc-left-column">
                <div class="mugshot-frame">
                    <img src="${hero.image}" alt="${hero.name}" class="hero-mugshot-img">
                    <div class="mugshot-caption">ФОТОСНИМОК СУБЪЕКТА № ${hero.dossierNo}</div>
                </div>

                <div class="identity-card">
                    <div class="id-field">
                        <span class="id-label">Кодовое имя:</span>
                        <span class="id-val">${hero.name}</span>
                    </div>
                    <div class="id-field">
                        <span class="id-label">Имя (рус.):</span>
                        <span class="id-val">${hero.nameRu}</span>
                    </div>
                    <div class="id-field">
                        <span class="id-label">Класс / Роль:</span>
                        <span class="id-val">${hero.role}</span>
                    </div>
                    <div class="id-field">
                        <span class="id-label">Сложность:</span>
                        <span class="id-val" style="color:#b87d18;">${stars}</span>
                    </div>
                    <div class="id-field">
                        <span class="id-label">Табельное оружие:</span>
                        <span class="id-val">${hero.weapon}</span>
                    </div>
                </div>

                <div class="stats-card">
                    <div class="stat-title">БОЕВЫЕ ПОКАЗАТЕЛИ СУБЪЕКТА</div>
                    
                    <div class="stat-row">
                        <div class="stat-header">
                            <span>Живучесть (Здоровье)</span>
                            <span>${hero.stats.health}%</span>
                        </div>
                        <div class="stat-meter-track">
                            <div class="stat-meter-fill" style="width: ${hero.stats.health}%"></div>
                        </div>
                    </div>

                    <div class="stat-row">
                        <div class="stat-header">
                            <span>Огневая мощь (Оружие)</span>
                            <span>${hero.stats.weapon}%</span>
                        </div>
                        <div class="stat-meter-track">
                            <div class="stat-meter-fill" style="width: ${hero.stats.weapon}%"></div>
                        </div>
                    </div>

                    <div class="stat-row">
                        <div class="stat-header">
                            <span>Спиритизм (Магия)</span>
                            <span>${hero.stats.spirit}%</span>
                        </div>
                        <div class="stat-meter-track">
                            <div class="stat-meter-fill" style="width: ${hero.stats.spirit}%"></div>
                        </div>
                    </div>

                    <div class="stat-row">
                        <div class="stat-header">
                            <span>Мобильность</span>
                            <span>${hero.stats.mobility}%</span>
                        </div>
                        <div class="stat-meter-track">
                            <div class="stat-meter-fill" style="width: ${hero.stats.mobility}%"></div>
                        </div>
                    </div>
                </div>

                <div class="quote-block">
                    ${hero.quote}
                </div>
            </div>

            <!-- Right Column: Lore, Abilities, Tactics -->
            <div class="doc-right-column">
                <div>
                    <div class="section-label">СВОДКА И БИОГРАФИЧЕСКИЕ ДАННЫЕ</div>
                    <p class="bio-text">${hero.bio}</p>
                </div>

                <div>
                    <div class="section-label">РЕГИСТР АНОМАЛЬНЫХ СПОСОБНОСТЕЙ</div>
                    <div class="abilities-container">
                        ${abilitiesHtml}
                    </div>
                </div>

                <div>
                    <div class="section-label">ТАКТИЧЕСКИЕ РЕКОМЕНДАЦИИ АГЕНТАМ</div>
                    <div class="tactics-box">
                        <strong>ОПЕРАТИВНАЯ ОЦЕНКА:</strong> ${hero.tactics}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Search and Filter Logic
function handleSearch(query) {
    if (!window.HEROES_DATA) return;
    state.searchQuery = query.trim().toLowerCase();
    
    if (elements.clearSearchBtn) {
        if (state.searchQuery) {
            elements.clearSearchBtn.style.display = 'block';
        } else {
            elements.clearSearchBtn.style.display = 'none';
        }
    }

    // Filter folder items in all drawers
    let matchesCount = 0;
    let firstMatchingDrawer = null;

    window.HEROES_DATA.forEach(hero => {
        const match = !state.searchQuery || 
            hero.name.toLowerCase().includes(state.searchQuery) ||
            hero.nameRu.toLowerCase().includes(state.searchQuery) ||
            hero.role.toLowerCase().includes(state.searchQuery);

        const el = document.querySelector(`.dossier-folder-item[data-hero-id="${hero.id}"]`);
        if (el) {
            el.style.display = match ? 'block' : 'none';
        }

        if (match) {
            matchesCount++;
            if (!firstMatchingDrawer) firstMatchingDrawer = hero.drawer;
        }
    });

    if (elements.activeCountLabel) {
        if (state.searchQuery) {
            elements.activeCountLabel.textContent = `Найдено совпадений: ${matchesCount}`;
            // Automatically switch to the drawer that contains the first match
            if (firstMatchingDrawer && firstMatchingDrawer !== state.activeDrawer) {
                updateActiveDrawer(firstMatchingDrawer, false);
            }
        } else {
            const activeHeroes = window.HEROES_DATA.filter(h => h.drawer === state.activeDrawer);
            elements.activeCountLabel.textContent = `Секция [ ${state.activeDrawer} ] • Дел в ящике: ${activeHeroes.length}`;
        }
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Clicking on closed drawer face opens that drawer
    Object.keys(elements.drawerCols).forEach(key => {
        const col = elements.drawerCols[key];
        if (!col) return;
        const face = col.querySelector('.drawer-face.closed-state');
        if (face) {
            face.addEventListener('click', () => {
                updateActiveDrawer(key);
            });
        }
    });

    // Navigation buttons in header
    if (elements.navButtons) {
        elements.navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const drawer = btn.dataset.drawer;
                if (drawer) {
                    updateActiveDrawer(drawer);
                }
            });
        });
    }

    // Sound toggle
    if (elements.soundToggleBtn) {
        elements.soundToggleBtn.addEventListener('click', () => {
            const isSoundOn = state.sound.toggle();
            const textSpan = elements.soundToggleBtn.querySelector('.sound-text');
            const iconSpan = elements.soundToggleBtn.querySelector('.sound-icon');
            if (isSoundOn) {
                if (textSpan) textSpan.textContent = 'Звук: ВКЛ';
                if (iconSpan) iconSpan.textContent = '🔊';
                elements.soundToggleBtn.style.borderColor = 'var(--brass-bright)';
                state.sound.playPaperRustle();
            } else {
                if (textSpan) textSpan.textContent = 'Звук: ВЫКЛ';
                if (iconSpan) iconSpan.textContent = '🔇';
                elements.soundToggleBtn.style.borderColor = 'var(--brass-dark)';
            }
        });
    }

    // Search input
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', (e) => {
            handleSearch(e.target.value);
        });
    }

    // Clear search
    if (elements.clearSearchBtn) {
        elements.clearSearchBtn.addEventListener('click', () => {
            elements.searchInput.value = '';
            handleSearch('');
            elements.searchInput.focus();
        });
    }

    // Modal navigation
    if (elements.prevHeroBtn) {
        elements.prevHeroBtn.addEventListener('click', () => {
            openDossierByIndex(state.currentHeroIndex - 1);
        });
    }

    if (elements.nextHeroBtn) {
        elements.nextHeroBtn.addEventListener('click', () => {
            openDossierByIndex(state.currentHeroIndex + 1);
        });
    }

    // Close modal handlers
    if (elements.modalCloseBtn) {
        elements.modalCloseBtn.addEventListener('click', closeDossier);
    }
    if (elements.modalBackdrop) {
        elements.modalBackdrop.addEventListener('click', closeDossier);
    }

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.isModalOpen) {
            closeDossier();
        } else if (state.isModalOpen && e.key === 'ArrowLeft') {
            openDossierByIndex(state.currentHeroIndex - 1);
        } else if (state.isModalOpen && e.key === 'ArrowRight') {
            openDossierByIndex(state.currentHeroIndex + 1);
        }
    });
}

// Initialize Application
function init() {
    initElements();
    renderAllDrawers();
    setupEventListeners();
    updateActiveDrawer(state.activeDrawer, false);

    // Deep-linking support via URL hash (e.g. #infernus or #abrams)
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash) {
        const found = window.HEROES_DATA.find(h => h.id.toLowerCase() === hash || h.name.toLowerCase() === hash);
        if (found) {
            openDossierById(found.id);
        }
    }
}

// Start application when DOM is ready or immediately if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
