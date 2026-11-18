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
    activeDrawer: 'A-H', // Defaults to A - H (first drawer)
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
            'A-H': document.getElementById('drawerCol-A-H'),
            'I-R': document.getElementById('drawerCol-I-R'),
            'S-Z': document.getElementById('drawerCol-S-Z')
        },
        stacks: {
            'A-H': document.getElementById('stack-A-H'),
            'I-R': document.getElementById('stack-I-R'),
            'S-Z': document.getElementById('stack-S-Z')
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

// Render Folders into each drawer and calculate adaptive dimensions
function renderAllDrawers() {
    if (!window.HEROES_DATA || !Array.isArray(window.HEROES_DATA)) return;

    ['A-H', 'I-R', 'S-Z'].forEach(drawerKey => {
        const stackEl = elements.stacks[drawerKey];
        const colEl = elements.drawerCols[drawerKey];
        if (!stackEl || !colEl) return;
        
        stackEl.innerHTML = '';
        const heroesInDrawer = window.HEROES_DATA.filter(h => h.drawer === drawerKey);
        const count = heroesInDrawer.length;

        // Dynamic Adaptive Calculation based on folder count:
        // Each folder takes a fixed comfortable step of 26px so tabs are never squashed.
        // The last folder body takes full height (118px) + clearance.
        const STEP = 26;
        const FOLDER_BODY_HEIGHT = 118;
        const TOP_PADDING = 14;
        const stackHeight = Math.max(340, (count - 1) * STEP + FOLDER_BODY_HEIGHT + 14);
        const bayHeight = stackHeight + TOP_PADDING + 8;
        const slideDownDist = bayHeight;
        const colTotalHeight = slideDownDist + 520;

        // Set custom properties for adaptive CSS
        colEl.style.setProperty('--stack-height', `${stackHeight}px`);
        colEl.style.setProperty('--bay-height', `${bayHeight}px`);
        colEl.style.setProperty('--slide-down-dist', `${slideDownDist}px`);
        colEl.style.setProperty('--col-total-height', `${colTotalHeight}px`);

        stackEl.style.height = `${stackHeight}px`;

        heroesInDrawer.forEach((hero, index) => {
            const folderEl = createFolderElement(hero);
            folderEl.style.zIndex = index + 1;
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
        </div>
        <div class="folder-body">
            <div class="folder-paper-peek"></div>
            <div class="folder-crease"></div>
            <div class="folder-crease-secondary"></div>
            <div class="folder-metal-clip" title="Архивная скрепка"></div>
            <div class="folder-cover-content">
                <span class="folder-stamp">CONFIDENTIAL // SEC-84</span>
                <span class="folder-case-number">CASE № ${hero.dossierNo}</span>
            </div>
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

// Switch or Toggle Active Open Drawer
function updateActiveDrawer(targetDrawer, playAudio = true) {
    // If clicking the already open drawer: toggle close it!
    if (state.activeDrawer === targetDrawer && playAudio) {
        state.activeDrawer = null;
    } else {
        state.activeDrawer = targetDrawer;
    }

    // Update drawer column classes
    Object.keys(elements.drawerCols).forEach(key => {
        const col = elements.drawerCols[key];
        if (!col) return;
        if (key === state.activeDrawer) {
            col.classList.add('active-open');
        } else {
            col.classList.remove('active-open');
        }
    });

    // Update nav button active states
    if (elements.navButtons) {
        elements.navButtons.forEach(btn => {
            if (btn.dataset.drawer === state.activeDrawer) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Update status counter
    if (window.HEROES_DATA && elements.activeCountLabel) {
        if (state.activeDrawer) {
            const activeHeroes = window.HEROES_DATA.filter(h => h.drawer === state.activeDrawer);
            elements.activeCountLabel.textContent = `Секция [ ${state.activeDrawer} ] • Дел в ящике: ${activeHeroes.length}`;
        } else {
            elements.activeCountLabel.textContent = `Все ящики задвинуты • Выберите секцию`;
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

    // Render abilities HTML (Only official in-game abilities)
    const abilitiesHtml = hero.abilities.map((ab, idx) => {
        const isUlt = idx === 3 || ab.type === 'Ультимейт';
        const keyLabel = isUlt ? '4 ★ ULT' : ab.key;
        return `
            <div class="ability-card ${isUlt ? 'ult-card' : ''}">
                <div class="ability-header">
                    <span class="ability-key-badge">${keyLabel}</span>
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
                <div class="doc-agency-info">НЬЮ-ЙОРКСКИЙ ДЕПАРТАМЕНТ НАДЗОРА ЗА АНОМАЛИЯМИ // АРХИВ ДОСЬЕ</div>
                <h2 class="doc-file-number">${hero.dossierNo}: ${hero.name.toUpperCase()}</h2>
                <div class="doc-agency-info">СТАТУС: АКТИВНЫЙ УЧАСТНИК РИТУАЛА • СЕКЦИЯ КАРТОТЕКИ [ ${hero.drawer} ]</div>
            </div>
            <div>
                <div class="doc-classification-stamp">OFFICIAL DOSSIER</div>
            </div>
        </div>

        <div class="doc-grid">
            <!-- Left Column: Mugshot, Weapon Specs, Attribute Growth -->
            <div class="doc-left-column">
                <div class="mugshot-frame">
                    <img src="${hero.image}" alt="${hero.name}" class="hero-mugshot-img">
                    <div class="mugshot-caption">ФОТОСНИМОК СУБЪЕКТА: ${hero.name.toUpperCase()}</div>
                </div>

                <!-- Weapon Specs from in-game data -->
                <div class="specs-card weapon-specs-card">
                    <div class="specs-card-header">
                        <span class="specs-header-title">ТАБЕЛЬНОЕ ОРУЖИЕ</span>
                    </div>
                    <div class="specs-weapon-name">${hero.weapon.name}</div>
                    <table class="specs-table">
                        <tbody>
                            <tr>
                                <td class="spec-label">Урон от пули:</td>
                                <td class="spec-val">${hero.weapon.bulletDamage}</td>
                            </tr>
                            <tr>
                                <td class="spec-label">Урон в секунду (DPS):</td>
                                <td class="spec-val">${hero.weapon.dps}</td>
                            </tr>
                            <tr>
                                <td class="spec-label">Скорострельность:</td>
                                <td class="spec-val">${hero.weapon.fireRate}</td>
                            </tr>
                            <tr>
                                <td class="spec-label">Боезапас (обойма):</td>
                                <td class="spec-val">${hero.weapon.ammo}</td>
                            </tr>
                            <tr>
                                <td class="spec-label">Время перезарядки:</td>
                                <td class="spec-val">${hero.weapon.reloadTime}</td>
                            </tr>
                            <tr>
                                <td class="spec-label">Скорость пули:</td>
                                <td class="spec-val">${hero.weapon.bulletVelocity}</td>
                            </tr>
                            <tr>
                                <td class="spec-label">Спад урона по дальности:</td>
                                <td class="spec-val">${hero.weapon.falloff}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Attribute Level Gains from in-game data -->
                <div class="specs-card growth-specs-card">
                    <div class="specs-card-header">
                        <span class="specs-header-title">ПРИРОСТЫ ЗА УРОВЕНЬ (LEVEL GAINS)</span>
                    </div>
                    <div class="growth-grid">
                        <div class="growth-item">
                            <span class="growth-bullet">▸</span>
                            <div class="growth-info">
                                <span class="growth-label">Урон от оружия:</span>
                                <span class="growth-val">${hero.growth.weaponDamage}</span>
                            </div>
                        </div>
                        <div class="growth-item">
                            <span class="growth-bullet">▸</span>
                            <div class="growth-info">
                                <span class="growth-label">Урон кулака:</span>
                                <span class="growth-val">${hero.growth.meleeDamage}</span>
                            </div>
                        </div>
                        <div class="growth-item">
                            <span class="growth-bullet">▸</span>
                            <div class="growth-info">
                                <span class="growth-label">Спиритизм:</span>
                                <span class="growth-val">${hero.growth.spiritPower}</span>
                            </div>
                        </div>
                        <div class="growth-item">
                            <span class="growth-bullet">▸</span>
                            <div class="growth-info">
                                <span class="growth-label">Запас здоровья:</span>
                                <span class="growth-val">${hero.growth.health}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: A Fate's Tale (Lore), Abilities -->
            <div class="doc-right-column">
                <div class="dossier-section">
                    <div class="section-label">ИСТОРИЯ СУДЬБЫ (A FATE'S TALE)</div>
                    <p class="bio-text">${hero.lore}</p>
                </div>

                <div class="dossier-section">
                    <div class="section-label">СПОСОБНОСТИ СУБЪЕКТА (IN-GAME ABILITIES)</div>
                    <div class="abilities-container">
                        ${abilitiesHtml}
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
            hero.dossierNo.toLowerCase().includes(state.searchQuery) ||
            (hero.weapon && hero.weapon.name && hero.weapon.name.toLowerCase().includes(state.searchQuery)) ||
            (hero.abilities && hero.abilities.some(ab => ab.name.toLowerCase().includes(state.searchQuery)));

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
    // Clicking on drawer face (closed or open) opens / toggles that drawer
    Object.keys(elements.drawerCols).forEach(key => {
        const col = elements.drawerCols[key];
        if (!col) return;
        const face = col.querySelector('.drawer-face');
        if (face) {
            face.addEventListener('click', (e) => {
                e.stopPropagation();
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

    // Check deep-linking URL parameter BEFORE initial drawer activation
    const urlParams = new URLSearchParams(window.location.search);
    const targetDrawer = urlParams.get('drawer');
    if (targetDrawer && ['A-H', 'I-R', 'S-Z'].includes(targetDrawer.toUpperCase())) {
        state.activeDrawer = targetDrawer.toUpperCase();
    }

    renderAllDrawers();
    setupEventListeners();
    updateActiveDrawer(state.activeDrawer, false);

    // Enable smooth physics animations after initial layout is established
    requestAnimationFrame(() => {
        setTimeout(() => {
            document.body.classList.add('cabinet-ready');
        }, 60);
    });

    const targetHero = (urlParams.get('hero') || window.location.hash.replace('#', '')).toLowerCase();
    if (targetHero) {
        const found = window.HEROES_DATA.find(h => h.id.toLowerCase() === targetHero || h.name.toLowerCase() === targetHero);
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
