import { games, gamesForTheme } from './catalog.js?v=arcade-28';
import { engines } from './registry.js?v=arcade-28';
import { seededRandom } from './core/random.js';
import { Painter, readPalette, loadArtwork, loadTypography } from './core/painter.js?v=arcade-28';
import { localBindings } from './mig/bindings.js?v=bindings-29';
import { GameRoom } from './room.js?v=bindings-29';

const root = document.documentElement;
const list = document.querySelector('#arcade-games');
const dialog = document.querySelector('#arcade-player');
let room = null;
let revision = 0;

function openGame(description, opener) {
    room?.dispose();
    room = new GameRoom(dialog, description, opener);
}

function preview(canvas, description, palette, images) {
    const context = canvas.getContext('2d');
    const painter = new Painter(context, palette, images);
    context.setTransform(.5, 0, 0, .5, 0, 0);
    const sample = engines[description.engine]({ random: seededRandom(123), pace: .8,
        message() {}, finish() {} });
    painter.background(); sample.render(painter); sample.dispose();
}

async function renderCollection() {
    const currentRevision = ++revision;
    const theme = root.dataset.theme;
    const palette = readPalette();
    room?.dispose(); room = null;
    const descriptions = gamesForTheme(theme);
    const cards = descriptions.map(description => {
        const card = document.createElement('article'); card.className = 'arcade-card';
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'arcade-play'; button.dataset.game = description.id;
        button.setAttribute('aria-label', `Play ${description.title}`);
        const canvas = document.createElement('canvas');
        canvas.width = 360; canvas.height = 210; canvas.setAttribute('aria-hidden', 'true');
        const play = document.createElement('span'); play.className = 'arcade-play-label'; play.textContent = 'Play ↗';
        button.append(canvas, play);
        const title = document.createElement('h3'); title.textContent = description.title;
        const goal = document.createElement('p'); goal.textContent = description.goal;
        card.append(button, title, goal);
        button.addEventListener('click', () => openGame(description, button));
        preview(canvas, description, palette);
        return { card, canvas, description };
    });
    list.replaceChildren(...cards.map(item => item.card));
    const [images] = await Promise.all([loadArtwork(theme), loadTypography(palette)]);
    if (revision !== currentRevision) return;
    for (const item of cards) preview(item.canvas, item.description, palette, images);
}

document.querySelector('#arcade-import-button').addEventListener('click', () => {
    document.querySelector('#arcade-import-file').click();
});
document.querySelector('#arcade-import-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    const status = document.querySelector('#arcade-import-status');
    try {
        await localBindings.importFile(file);
        status.textContent = `${localBindings.name}: ${localBindings.profile.inputs.length} bindings loaded. Open a game and choose Bindings.`;
        document.querySelector('#arcade-clear-bindings').hidden = false;
    } catch (error) {
        status.textContent = error.message || 'The binding configuration could not be opened.';
    } finally { event.target.value = ''; }
});
function showBindingProfile() {
    document.querySelector('#arcade-clear-bindings').hidden = !localBindings.profile;
    document.querySelector('#arcade-import-status').textContent = localBindings.profile ?
        `${localBindings.name}: ${localBindings.profile.inputs.length} bindings loaded. Open a game and choose Bindings.` : '';
}
localBindings.addEventListener('change',showBindingProfile);
showBindingProfile();
document.querySelector('#arcade-clear-bindings').addEventListener('click', () => {
    localBindings.clear();document.querySelector('#arcade-clear-bindings').hidden=true;
    document.querySelector('#arcade-import-status').textContent='Game defaults restored.';
});

let identity = `${root.dataset.theme}/${root.dataset.mode}`;
const observer = new MutationObserver(() => {
    const next = `${root.dataset.theme}/${root.dataset.mode}`;
    if (next === identity) return;
    identity = next; renderCollection();
});
observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
window.addEventListener('pagehide', () => { room?.dispose(); observer.disconnect(); });
window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
    renderCollection();
});
renderCollection();
