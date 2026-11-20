import { games, gamesForTheme } from './catalog.js?v=eras-2';
import { engines } from './registry.js?v=eras-2';
import { seededRandom } from './core/random.js?v=eras-2';
import { Painter, readPalette, loadArtwork, loadTypography } from './core/painter.js?v=eras-2';
import { localBindings } from './mig/bindings.js?v=eras-2';
import { GameRoom } from './room.js?v=eras-2';

import {ChallengeStore, readChallenge} from './core/challenges.js?v=eras-2';
import { GamesGallery } from './gallery.js?v=eras-2';

const challenges = new ChallengeStore(games);
const root = document.documentElement;
const list = document.querySelector('#arcade-games');
const dialog = document.querySelector('#arcade-player');
let room = null;
let revision = 0;

function openGame(description, opener) {
    room?.dispose();
    const target = challenges.target?.game === description.id ? challenges.target : null;
    const selected = target ? challenges.description() : description;
    room = new GameRoom(dialog, selected, opener, {challenge:target});
}

function preview(canvas, description, palette, images) {
    const context = canvas.getContext('2d');
    const painter = new Painter(context, palette, images);
    context.setTransform(.5, 0, 0, .5, 0, 0);
    const sample = engines[description.engine]({ random: seededRandom(123), pace: .8,
        message() {}, finish() {} });
    // Play the first moments so opening animations (CRT warm-up, entrances) have settled.
        for (let i = 0; i < 40; i++) sample.update(1 / 30);
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

let gallery = null;
async function showGallery() {
    if (root.dataset.view !== 'games') return;
    if (!gallery) {
        const response = await fetch('./assets/profile.json');
        const { themes } = await response.json();
        gallery ??= new GamesGallery(document.querySelector('#games'), { themes, appearance: root.dataset.mode || 'light',
            loadImages: loadArtwork,
            onPlay(description, opener) {
                // The room takes its era's styling from the document theme, as challenge links do.
                window.dispatchEvent(new CustomEvent('arcade:theme', { detail: description.theme }));
                queueMicrotask(() => openGame(description, opener));
            } });
        gallery.render();
    } else if (gallery.appearance !== root.dataset.mode) gallery.render(root.dataset.mode);
}

let identity = `${root.dataset.theme}/${root.dataset.mode}`;
const observer = new MutationObserver(() => {
    showGallery();
    const next = `${root.dataset.theme}/${root.dataset.mode}`;
    if (next === identity) return;
    identity = next; renderCollection();
});
observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-mode', 'data-view'] });
showGallery();
window.addEventListener('pagehide', () => { room?.dispose(); observer.disconnect(); });
window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-mode', 'data-view'] });
    renderCollection();
});
renderCollection();

function showChallenge() {
    const description = challenges.description();
    document.querySelector('#arcade-challenge-invite').hidden = !description;
    document.querySelector('#arcade-challenge-summary').textContent = description ?
        `${challenges.target.name} challenges you: ${challenges.target.score} in ${description.title}` : '';
}
function receiveChallenge() {
    if (!new URLSearchParams(location.hash.split('?')[1]).has('challenge')) return;
    challenges.set(readChallenge(location.href,games));
    const description = challenges.description();
    document.querySelector('#arcade-challenge-note').hidden = Boolean(description);
    if (description) {
        root.dataset.theme = description.theme;
        document.querySelector('#arcade').scrollIntoView({block:'start'});
    }
    showChallenge();
}
document.querySelector('#arcade-play-challenge').addEventListener('click',event=>{
    const description = challenges.description();
    if (!description) return;
    root.dataset.theme = description.theme;
    // The theme observer rebuilds the collection before opening the dialog.
    const opener = event.currentTarget;
    queueMicrotask(()=>openGame(description,opener));
});
document.querySelector('#arcade-dismiss-challenge').addEventListener('click',()=>{
    challenges.set(null);showChallenge();
    document.querySelector('#arcade-challenge-note').hidden = true;
    if (new URLSearchParams(location.hash.split('?')[1]).has('challenge')) history.replaceState(null,'',`${location.pathname}${location.search}#arcade`);
});
window.addEventListener('hashchange',receiveChallenge);
receiveChallenge();showChallenge();
