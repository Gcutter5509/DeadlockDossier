/**
 * DEADLOCK DOSSIER — INTERACTIVE ARCHIVE ENGINE
 * Стальной шкаф с ячейками: распашные дверцы, папки внутри ячеек,
 * поиск, полноэкранное досье и процедурные звуки.
 */

// ---------------------------------------------------------------------------
// Звук: записи ящика + процедурный шелест и штамп (Web Audio API)
// ---------------------------------------------------------------------------
class ArchiveSoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        // Браузеры запрещают звук до первого действия пользователя:
        // до этого момента AudioContext не создаём вообще.
        this.unlocked = false;

        this.drawerOpen = new Audio('assets/sounds/drawer_open.mp3');
        this.drawerClose = new Audio('assets/sounds/drawer_close.mp3');
        [this.drawerOpen, this.drawerClose].forEach(a => {
            a.preload = 'auto';
            a.volume = 0.8;
        });
    }

    unlock() {
        this.unlocked = true;
        this.ensureContext();
    }

    ensureContext() {
        if (!this.unlocked) return false;
        if (!this.ctx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return false;
            this.ctx = new Ctx();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return true;
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    noiseBuffer(seconds, shape) {
        const size = Math.floor(this.ctx.sampleRate * seconds);
        const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * shape(i, size);
        return buffer;
    }

    // Шелест бумаги при наведении на папку
    playPaperRustle() {
        if (!this.enabled || !this.ensureContext()) return;
        try {
            const now = this.ctx.currentTime;
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer(0.12, (i, n) => Math.exp(-i / (n * 0.4)));

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1800 + Math.random() * 600;
            filter.Q.value = 2.5;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            noise.connect(filter).connect(gain).connect(this.ctx.destination);
            noise.start(now);
        } catch (e) { /* звук не критичен */ }
    }

    // Записанный звук стального ящика картотеки (assets/sounds, CC BY 4.0 — Gravity Sound).
    // HTMLAudioElement, а не fetch + decodeAudioData: так звук работает и при открытии
    // index.html напрямую с диска (file://), где fetch заблокирован.
    playDrawer(opening) {
        if (!this.enabled || !this.unlocked) return;
        const next = opening ? this.drawerOpen : this.drawerClose;
        const other = opening ? this.drawerClose : this.drawerOpen;
        // Если ящик развернули на полпути — обрываем предыдущий звук
        other.pause();
        next.currentTime = 0;
        next.play().catch(() => {});
    }

    // Глухой «штамп» при открытии досье
    playDossierOpen() {
        if (!this.enabled || !this.ensureContext()) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.18);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.connect(gain).connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.18);
        } catch (e) { /* звук не критичен */ }
    }
}

// ---------------------------------------------------------------------------
// Конфигурация секций шкафа
// ---------------------------------------------------------------------------
const SECTIONS = [
    { key: 'A-H', no: '01', from: 'A', to: 'H' },
    { key: 'I-R', no: '02', from: 'I', to: 'R' },
    { key: 'S-Z', no: '03', from: 'S', to: 'Z' }
];

// Геометрия стопки папок (px) — должна совпадать со style.css
const FOLDER_STEP = 26;        // шаг между ярлычками соседних папок
const FOLDER_FULL_HEIGHT = 132; // ярлык (14) + тело папки (118)
const DRAWER_BOX_PADDING = 34;  // задняя стенка короба сверху + зазор у фасада снизу

const heroes = Array.isArray(window.HEROES_DATA) ? window.HEROES_DATA : [];

const state = {
    openCells: new Set(['A-H']),
    currentHeroIndex: 0,
    isModalOpen: false,
    searchQuery: '',
    sound: new ArchiveSoundEngine()
};

let elements = {};
const cells = {}; // key -> { root, door, stack }

function letterRange(from, to) {
    const out = [];
    for (let c = from.charCodeAt(0); c <= to.charCodeAt(0); c++) out.push(String.fromCharCode(c));
    return out;
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

// Пропуски (▇▇▇) — значения, утерянные при выгрузке данных из игры.
// Показываем их как вымаранный текст, а не придумываем.
function renderRedactions(text) {
    return escapeHtml(text).replace(/▇+/g,
        '<span class="redacted" title="Значение отсутствует в исходных данных">▇▇▇</span>');
}

// ---------------------------------------------------------------------------
// Построение шкафа
// ---------------------------------------------------------------------------
function buildCabinet() {
    const container = elements.cabinetCells;
    container.innerHTML = '';
    let maxPull = 0;

    SECTIONS.forEach(section => {
        const sectionHeroes = heroes.filter(h => h.drawer === section.key);
        const letters = letterRange(section.from, section.to);
        const alpha = `${section.from} — ${section.to}`;

        const cell = document.createElement('section');
        cell.className = 'cell';
        cell.dataset.cell = section.key;
        cell.innerHTML = `
            <div class="cell-label-plate" aria-hidden="true">
                <span>SEC. ${section.no}</span><b>${alpha}</b>
            </div>
            <!-- Пустая ниша шкафа (видна, когда ящик выдвинут) -->
            <div class="cell-opening" aria-hidden="true">
                <div class="cell-wall wall-back"></div>
                <div class="cell-wall wall-top"></div>
                <div class="cell-wall wall-left"></div>
                <div class="cell-wall wall-right"></div>
                <div class="cell-wall wall-floor"></div>
                <div class="cell-inner-shadow"></div>
            </div>

            <!-- Ящик: короб с папками + фасад. Всё, что выше проёма, обрезается -->
            <div class="drawer-clip">
                <div class="drawer">
                    <div class="drawer-box">
                        <div class="drawer-rail left"></div>
                        <div class="drawer-rail right"></div>
                        <div class="drawer-side left" aria-hidden="true"></div>
                        <div class="drawer-side right" aria-hidden="true"></div>
                        <div class="drawer-back-wall" aria-hidden="true"></div>
                        <div class="folders-stack" id="stack-${section.key}" aria-label="Досье секции ${alpha}"></div>
                        <div class="cell-empty-note" hidden>Нет совпадений в секции</div>
                        <div class="drawer-box-shade" aria-hidden="true"></div>
                    </div>

                    <div class="drawer-front" role="button" tabindex="0" aria-expanded="false"
                         aria-label="Ящик ${alpha}" title="Выдвинуть / задвинуть ящик ${alpha}">
                        <div class="door-rivet r-tl"></div><div class="door-rivet r-tr"></div>
                        <div class="door-rivet r-bl"></div><div class="door-rivet r-br"></div>

                        <div class="door-panel">
                            <div class="door-stencil">REG. N.Y.C. // SEC. ${section.no}</div>

                            <div class="door-lock" title="Замок ящика № ${section.no}">
                                <div class="lock-cylinder"><div class="lock-slot"></div></div>
                                <span class="lock-code">KEY ${section.no}</span>
                            </div>

                            <div class="card-holder">
                                <div class="index-card">
                                    <span class="card-tag">SECTION ${section.no}</span>
                                    <span class="card-alpha">${alpha}</span>
                                    <span class="card-letters">${letters.join(' ')}</span>
                                    <span class="card-count">${sectionHeroes.length} DOSSIERS</span>
                                </div>
                            </div>

                            <div class="drawer-handle">
                                <span class="handle-bracket"></span>
                                <span class="handle-bar"></span>
                                <span class="handle-bracket"></span>
                            </div>

                            <div class="door-louvers">${'<span></span>'.repeat(5)}</div>

                            <div class="door-sub-stamp">ANOMALY OVERSIGHT // HEAVY SLIDE</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(cell);

        const stack = cell.querySelector('.folders-stack');
        const count = sectionHeroes.length;
        const stackHeight = Math.max(0, count - 1) * FOLDER_STEP + FOLDER_FULL_HEIGHT;
        stack.style.height = `${stackHeight}px`;
        // Ящик выдвигается ровно на длину стопки папок + стенки короба
        const pull = stackHeight + DRAWER_BOX_PADDING;
        cell.style.setProperty('--pull', `${pull}px`);
        maxPull = Math.max(maxPull, pull);

        sectionHeroes.forEach((hero, index) => {
            const folder = createFolderElement(hero);
            const depth = count > 1 ? index / (count - 1) : 1; // 0 — дальняя папка, 1 — ближняя
            folder.style.zIndex = index + 1;
            folder.style.setProperty('--depth', depth.toFixed(3));
            stack.appendChild(folder);
        });

        cells[section.key] = {
            root: cell,
            door: cell.querySelector('.drawer-front'),
            stack,
            emptyNote: cell.querySelector('.cell-empty-note')
        };
    });

    document.getElementById('cabinet').style.setProperty('--pull-max', `${maxPull}px`);
}

function createFolderElement(hero) {
    const item = document.createElement('div');
    item.className = 'dossier-folder-item';
    item.dataset.heroId = hero.id;
    item.tabIndex = -1;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `Досье ${hero.name}`);

    item.innerHTML = `
        <div class="folder-tab tab-slot-${hero.tabSlot}">
            <img src="${hero.image}" alt="" class="tab-hero-avatar" loading="lazy" decoding="async">
            <span class="tab-hero-name">${escapeHtml(hero.name.toUpperCase())}</span>
        </div>
        <div class="folder-body">
            <div class="folder-paper-peek"></div>
            <div class="folder-crease"></div>
            <div class="folder-crease-secondary"></div>
            <div class="folder-metal-clip"></div>
            <div class="folder-cover-content">
                <span class="folder-stamp">CONFIDENTIAL</span>
                <span class="folder-case-number">CASE № ${hero.dossierNo}</span>
            </div>
        </div>
    `;

    item.addEventListener('mouseenter', () => state.sound.playPaperRustle());
    item.addEventListener('click', e => {
        e.stopPropagation();
        openDossierById(hero.id);
    });
    item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDossierById(hero.id);
        }
    });
    return item;
}

// ---------------------------------------------------------------------------
// Дверцы
// ---------------------------------------------------------------------------
function setCellOpen(key, open, playAudio = true) {
    const cell = cells[key];
    if (!cell) return;
    const wasOpen = state.openCells.has(key);
    if (open) state.openCells.add(key); else state.openCells.delete(key);

    cell.root.classList.toggle('is-open', open);
    cell.door.setAttribute('aria-expanded', String(open));
    // Папки в задвинутом ящике недоступны с клавиатуры
    cell.stack.querySelectorAll('.dossier-folder-item').forEach(f => { f.tabIndex = open ? 0 : -1; });

    if (playAudio && wasOpen !== open) state.sound.playDrawer(open);
}

function toggleCell(key) {
    setCellOpen(key, !state.openCells.has(key));
}

// ---------------------------------------------------------------------------
// Досье
// ---------------------------------------------------------------------------
function openDossierById(heroId) {
    const index = heroes.findIndex(h => h.id === heroId);
    if (index !== -1) openDossierByIndex(index);
}

function openDossierByIndex(index) {
    if (!heroes.length) return;
    index = (index + heroes.length) % heroes.length;

    state.currentHeroIndex = index;
    const hero = heroes[index];

    // Ячейка героя должна быть открыта, чтобы после закрытия досье было видно, откуда оно
    setCellOpen(hero.drawer, true, false);

    renderDossierContent(hero);
    elements.dossierCounter.textContent = `ДЕЛО ${index + 1} ИЗ ${heroes.length} [ ${hero.drawer} ]`;

    if (!state.isModalOpen) {
        elements.modal.classList.add('active');
        elements.modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        state.isModalOpen = true;
        elements.modalCloseBtn.focus({ preventScroll: true });
    }
    elements.dossierPaper.scrollTop = 0;
    state.sound.playDossierOpen();
}

function closeDossier() {
    if (!state.isModalOpen) return;
    elements.modal.classList.remove('active');
    elements.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    state.isModalOpen = false;
    state.sound.playPaperRustle();

    const folder = document.querySelector(`.dossier-folder-item[data-hero-id="${heroes[state.currentHeroIndex].id}"]`);
    if (folder) folder.focus({ preventScroll: true });
}

function renderDossierContent(hero) {
    const abilitiesHtml = hero.abilities.map((ab, idx) => {
        const isUlt = idx === 3 || ab.type === 'Ультимейт';
        const keyLabel = isUlt ? '4 ★ ULT' : ab.key;
        return `
            <div class="ability-card ${isUlt ? 'ult-card' : ''}">
                <div class="ability-header">
                    <span class="ability-key-badge">${keyLabel}</span>
                    <span class="ability-name">${escapeHtml(ab.name)}</span>
                    <span class="ability-type">${escapeHtml(ab.type)}</span>
                </div>
                <div class="ability-desc">${renderRedactions(ab.desc)}</div>
            </div>
        `;
    }).join('');

    const w = hero.weapon;
    const specRows = [
        ['Урон от пули', w.bulletDamage],
        ['Урон в секунду (DPS)', w.dps],
        ['Скорострельность', w.fireRate],
        ['Боезапас (обойма)', w.ammo],
        ['Время перезарядки', w.reloadTime],
        ['Скорость пули', w.bulletVelocity],
        ['Спад урона по дальности', w.falloff]
    ].map(([label, val]) => `
        <tr><td class="spec-label">${label}:</td><td class="spec-val">${escapeHtml(val)}</td></tr>
    `).join('');

    const g = hero.growth;
    const growthItems = [
        ['Урон от оружия', g.weaponDamage],
        ['Урон кулака', g.meleeDamage],
        ["Спиритическая мощь", g.spiritPower],
        ['Запас здоровья', g.health]
    ].map(([label, val]) => `
        <div class="growth-item">
            <span class="growth-label">${label}:</span>
            <span class="growth-val">${escapeHtml(val)}</span>
        </div>
    `).join('');

    const name = escapeHtml(hero.name.toUpperCase());

    elements.dossierPaper.innerHTML = `
        <div class="doc-header">
            <div>
                <div class="doc-agency-info">НЬЮ-ЙОРКСКИЙ ДЕПАРТАМЕНТ НАДЗОРА ЗА АНОМАЛИЯМИ // АРХИВ ДОСЬЕ</div>
                <h2 class="doc-file-number">${hero.dossierNo}: ${name}</h2>
                <div class="doc-agency-info">СЕКЦИЯ КАРТОТЕКИ [ ${hero.drawer} ]</div>
            </div>
            <div class="doc-classification-stamp">OFFICIAL DOSSIER</div>
        </div>

        <div class="doc-grid">
            <div class="doc-left-column">
                <div class="mugshot-frame">
                    <img src="${hero.image}" alt="${escapeHtml(hero.name)}" class="hero-mugshot-img">
                    <div class="mugshot-caption">ФОТОСНИМОК СУБЪЕКТА: ${name}</div>
                </div>

                <div class="specs-card">
                    <div class="specs-card-header"><span class="specs-header-title">ТАБЕЛЬНОЕ ОРУЖИЕ</span></div>
                    <div class="specs-weapon-name">${escapeHtml(w.name)}</div>
                    <table class="specs-table"><tbody>${specRows}</tbody></table>
                </div>

                <div class="specs-card">
                    <div class="specs-card-header"><span class="specs-header-title">ПРИРОСТ ЗА КАЖДЫЙ BOON</span></div>
                    <div class="growth-grid">${growthItems}</div>
                </div>
            </div>

            <div class="doc-right-column">
                <div class="dossier-section">
                    <div class="section-label">ИСТОРИЯ СУДЬБЫ</div>
                    <p class="bio-text">${escapeHtml(hero.lore)}</p>
                </div>

                <div class="dossier-section">
                    <div class="section-label">СПОСОБНОСТИ СУБЪЕКТА</div>
                    <div class="abilities-container">${abilitiesHtml}</div>
                </div>
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Поиск
// ---------------------------------------------------------------------------
function heroMatches(hero, q) {
    if (!q) return true;
    return hero.name.toLowerCase().includes(q) ||
        hero.dossierNo.toLowerCase().includes(q) ||
        (hero.weapon && hero.weapon.name.toLowerCase().includes(q)) ||
        hero.abilities.some(ab => ab.name.toLowerCase().includes(q));
}

function handleSearch(query) {
    state.searchQuery = query.trim().toLowerCase();
    const q = state.searchQuery;
    elements.clearSearchBtn.hidden = !q;

    const perCell = {};
    let total = 0;
    heroes.forEach(hero => {
        const match = heroMatches(hero, q);
        const el = document.querySelector(`.dossier-folder-item[data-hero-id="${hero.id}"]`);
        if (el) el.hidden = !match;
        if (match) {
            total++;
            perCell[hero.drawer] = (perCell[hero.drawer] || 0) + 1;
        }
    });

    Object.entries(cells).forEach(([key, cell]) => {
        cell.emptyNote.hidden = !q || Boolean(perCell[key]);
        // При поиске открываем ячейки с совпадениями и закрываем пустые
        if (q) setCellOpen(key, Boolean(perCell[key]));
    });

    elements.searchCount.textContent = q ? String(total) : '';
    elements.searchBox.classList.toggle('no-results', Boolean(q) && total === 0);
}

// ---------------------------------------------------------------------------
// События
// ---------------------------------------------------------------------------
function setupEventListeners() {
    // Первое действие пользователя разрешает звук
    const unlock = () => state.sound.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    Object.entries(cells).forEach(([key, cell]) => {
        cell.door.addEventListener('click', e => {
            e.stopPropagation();
            toggleCell(key);
        });
        cell.door.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleCell(key);
            }
        });
        cell.root.querySelector('.cell-label-plate').addEventListener('click', () => toggleCell(key));
    });

    elements.soundToggleBtn.addEventListener('click', () => {
        const on = state.sound.toggle();
        elements.soundToggleBtn.querySelector('.sound-text').textContent = on ? 'Звук: ВКЛ' : 'Звук: ВЫКЛ';
        elements.soundToggleBtn.querySelector('.sound-icon').textContent = on ? '🔊' : '🔇';
        elements.soundToggleBtn.classList.toggle('is-muted', !on);
        if (on) state.sound.playPaperRustle();
    });

    elements.searchInput.addEventListener('input', e => handleSearch(e.target.value));
    elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        handleSearch('');
        elements.searchInput.focus();
    });

    elements.prevHeroBtn.addEventListener('click', () => openDossierByIndex(state.currentHeroIndex - 1));
    elements.nextHeroBtn.addEventListener('click', () => openDossierByIndex(state.currentHeroIndex + 1));
    elements.modalCloseBtn.addEventListener('click', closeDossier);
    elements.modalBackdrop.addEventListener('click', closeDossier);

    window.addEventListener('keydown', e => {
        if (!state.isModalOpen) return;
        if (e.key === 'Escape') closeDossier();
        else if (e.key === 'ArrowLeft') openDossierByIndex(state.currentHeroIndex - 1);
        else if (e.key === 'ArrowRight') openDossierByIndex(state.currentHeroIndex + 1);
    });
}

// ---------------------------------------------------------------------------
// Запуск
// ---------------------------------------------------------------------------
function init() {
    elements = {
        cabinetCells: document.getElementById('cabinetCells'),
        searchBox: document.getElementById('searchBox'),
        searchInput: document.getElementById('searchInput'),
        searchCount: document.getElementById('searchCount'),
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

    const params = new URLSearchParams(window.location.search);
    const drawerParam = (params.get('drawer') || '').toUpperCase();
    if (SECTIONS.some(s => s.key === drawerParam)) state.openCells = new Set([drawerParam]);

    buildCabinet();
    SECTIONS.forEach(s => setCellOpen(s.key, state.openCells.has(s.key), false));
    setupEventListeners();

    // Анимации включаем после первой отрисовки, чтобы дверцы не «хлопали» при загрузке
    requestAnimationFrame(() => setTimeout(() => document.body.classList.add('cabinet-ready'), 60));

    const target = (params.get('hero') || decodeURIComponent(window.location.hash.slice(1))).toLowerCase();
    if (target) {
        const found = heroes.find(h => h.id === target || h.name.toLowerCase() === target);
        if (found) openDossierById(found.id);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
