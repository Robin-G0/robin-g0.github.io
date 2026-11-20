// The games gallery: every engine of every era, each preview painted in its own era's palette.
import { games } from './catalog.js';
import { engines } from './registry.js';
import { seededRandom } from './core/random.js';
import { Painter } from './core/painter.js';
import { LEVEL_LABELS } from './mig/precision.js';

// Canvas fonts per era, mirroring the --arcade-font/--arcade-display room variables.
const FONTS = {
    phosphor: ["'Lucida Console', Consolas, monospace", "'VT323', Consolas, monospace"],
    desktop95: ["W95FA, 'MS Sans Serif', sans-serif"],
    construction: ["'Trebuchet MS', Arial, sans-serif", "Georgia, 'Times New Roman', serif"],
    matrix: ["'Share Tech Mono', Consolas, monospace"],
    y2k: ['Arial, Helvetica, sans-serif', "'Orbitron', 'Arial Black', sans-serif"],
    aqua: ["'Lucida Grande', Tahoma, sans-serif"],
    aero: ["'Segoe UI', 'Open Sans', Tahoma, sans-serif"],
    metro: ["'Segoe UI', 'Open Sans', Arial, sans-serif"],
    material: ["'Segoe UI', 'Open Sans', Arial, sans-serif"],
    glass: ["'Segoe UI', 'Open Sans', Arial, sans-serif"],
    'field-notes': ["Georgia, 'Times New Roman', serif", "'Caveat', 'Segoe Print', cursive"]
};

export function eraPalette(theme, appearance) {
    const [font, display = font] = FONTS[theme.id] ?? ['sans-serif'];
    return { ...theme[appearance], font, displayFont: display, theme: theme.id };
}

function paintPreview(canvas, description, palette, images) {
    const context = canvas.getContext('2d');
    context.setTransform(.5, 0, 0, .5, 0, 0);
    const painter = new Painter(context, palette, images);
    try {
        const sample = engines[description.engine]({ random: seededRandom(123), pace: .8, message() {}, finish() {} });
        painter.background(); sample.render(painter); sample.dispose();
    } catch { painter.background(); /* A preview must never break the gallery. */ }
}

function card(description, theme, appearance, onPlay) {
    const article = document.createElement('article');
    article.className = 'game-tile'; article.dataset.era = theme.id;
    for (const [name, value] of Object.entries(theme[appearance])) article.style.setProperty(`--era-${name}`, value);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'game-tile-play';
    button.setAttribute('aria-label', `Play ${description.title}, ${theme.name}`);
    const canvas = document.createElement('canvas'); canvas.width = 360; canvas.height = 210; canvas.setAttribute('aria-hidden', 'true');
    const play = document.createElement('span'); play.className = 'game-tile-cta'; play.textContent = 'Play';
    button.append(canvas, play);
    const title = document.createElement('h3'); title.textContent = description.title;
    const goal = document.createElement('p'); goal.textContent = description.goal;
    const tags = document.createElement('p'); tags.className = 'game-tile-tags';
    const moves = document.createElement('span');
    moves.textContent = description.inputScheme === 'wrist-directions' ? 'Raises & sweeps' : 'Two raises';
    const level = description.precision ?? 'low';
    const tracking = document.createElement('span'); tracking.dataset.level = level;
    tracking.textContent = `${LEVEL_LABELS[level]} tracking`;
    tags.append(moves, tracking);
    button.addEventListener('click', () => onPlay(description, button));
    article.append(button, title, goal, tags);
    return { article, canvas, description, theme };
}

export class GamesGallery {
    constructor(root, { themes, appearance, onPlay, loadImages }) {
        Object.assign(this, { root, themes, appearance, onPlay, loadImages });
        this.filter = 'all';
        this.filters = root.querySelector('#gallery-filters');
        this.eras = root.querySelector('#gallery-eras');
        this.revision = 0;
    }

    render(appearance = this.appearance) {
        this.appearance = appearance;
        const revision = ++this.revision;
        const chips = [['all', 'All eras', `${games.length}`], ...this.themes.map(theme => [theme.id, theme.name, theme.era])];
        this.filters.replaceChildren(...chips.map(([id, label, detail]) => {
            const chip = document.createElement('button'); chip.type = 'button'; chip.dataset.filter = id;
            chip.setAttribute('aria-pressed', String(this.filter === id));
            const name = document.createElement('span'); name.textContent = label;
            const small = document.createElement('small'); small.textContent = detail;
            chip.append(name, small);
            chip.addEventListener('click', () => { this.filter = id; this.applyFilter(); });
            return chip;
        }));
        const tiles = [];
        this.eras.replaceChildren(...this.themes.map(theme => {
            const section = document.createElement('section'); section.className = 'gallery-era'; section.dataset.era = theme.id;
            section.setAttribute('aria-labelledby', `era-${theme.id}`);
            const heading = document.createElement('header');
            const title = document.createElement('h2'); title.id = `era-${theme.id}`; title.textContent = theme.name;
            const era = document.createElement('span'); era.textContent = theme.era;
            heading.append(title, era);
            const grid = document.createElement('div'); grid.className = 'gallery-grid';
            for (const description of games.filter(game => game.theme === theme.id)) {
                const tile = card(description, theme, appearance, this.onPlay);
                tiles.push(tile); grid.append(tile.article);
            }
            section.append(heading, grid);
            return section;
        }));
        this.applyFilter();
        this.paint(tiles, revision);
    }

    applyFilter() {
        for (const chip of this.filters.querySelectorAll('[data-filter]')) chip.setAttribute('aria-pressed', String(chip.dataset.filter === this.filter));
        for (const section of this.eras.querySelectorAll('.gallery-era')) section.hidden = this.filter !== 'all' && section.dataset.era !== this.filter;
    }

    async paint(tiles, revision) {
        for (const tile of tiles) paintPreview(tile.canvas, tile.description, eraPalette(tile.theme, this.appearance));
        // Era artwork arrives later; repaint once per era with it, never blocking the first paint.
        for (const theme of this.themes) {
            const images = await this.loadImages(theme.id).catch(() => new Map());
            if (revision !== this.revision) return;
            for (const tile of tiles.filter(item => item.theme.id === theme.id)) {
                paintPreview(tile.canvas, tile.description, eraPalette(tile.theme, this.appearance), images);
            }
        }
    }
}
