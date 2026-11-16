const $ = (selector) => document.querySelector(selector);
const root = document.documentElement;
const profileBase = 'https://raw.githubusercontent.com/Robin-G0/Robin-G0/main/assets/';
const defaultTheme = 'construction';
const colorList = ['#5bb7c8', '#b59bdb', '#dcb368', '#9dbd82', '#dd8e8e', '#7d9ed0'];
const icons = {'C++':'cplusplus', C:'c', Python:'python', JavaScript:'javascript', TypeScript:'typescript', CMake:'cmake', CSS:'css3', HTML:'html5', PowerShell:'powershell', Luau:'lua', Shell:'bash', 'C#':'csharp', Java:'java', Dockerfile:'docker', GLSL:'opengl', GDScript:'godot'};
const objects = {y2k:'y2k-chrome-orbit-v1.png', aqua:'aqua-glass-compass-v1.png', aero:'aero-globe.png', glass:'glass-space-earth-v1.png'};
let catalog = [], daily = null, active = null, explicit = false, lastRefresh = 0;
let appearance;
try { appearance = localStorage.getItem('appearance'); } catch { /* Storage is optional. */ }
if (!['light', 'dark'].includes(appearance)) appearance = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

function validStats(data) {
  return data?.schema === 4 && data.scope === 'owned_public' && data.status === 'ready'
    && data.user === 'Robin-G0' && /^\d{4}-\d{2}-\d{2}$/.test(data.updated)
    && ['repositories','commits','lines_changed'].every(key => Number.isSafeInteger(data[key]) && data[key] >= 0)
    && data.languages && !Array.isArray(data.languages)
    && Object.values(data.languages).every(value => Number.isFinite(value) && value >= 0);
}

function applyTheme(id, manual = false, updateURL = true) {
  const theme = catalog.find(item => item.id === id);
  if (!theme) return;
  active = theme; explicit = manual;
  root.dataset.theme = id; root.dataset.mode = appearance;
  if (id==='glass') document.querySelectorAll('.scene-backdrop img[data-src]').forEach(image=> { image.src=image.dataset.src; delete image.dataset.src; });
  Object.entries(theme[appearance]).forEach(([name,value]) => root.style.setProperty(`--${name}`, value));
  $('meta[name="theme-color"]').content = theme[appearance].bg;
  $('#theme-name').textContent = theme.name;
  $('#theme-era').textContent = theme.era;
  $('#theme-mode').textContent = manual ? 'Visual identity' : 'Default theme';
  $('#daily-shortcut').hidden = !manual;
  const date = daily?.selected;
  if (date) {
    $('#theme-date').dateTime = date;
    $('#theme-date').textContent = new Intl.DateTimeFormat('en', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
  }
  const image = $('#journey-object');
  if (objects[id]) { image.src = `./assets/art/${objects[id]}`; image.hidden = false; }
  else { image.hidden = true; image.removeAttribute('src'); }
  root.dataset.object = String(Boolean(objects[id]));
  document.querySelectorAll('[data-theme-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === id));
    button.querySelector('img').src = `./assets/previews/${button.dataset.themeChoice}-${appearance}.svg`;
  });
  $('#toggle-mode').textContent = appearance === 'light' ? 'Dark appearance' : 'Light appearance';
  $('#toggle-mode').setAttribute('aria-pressed', String(appearance === 'dark'));
  if (updateURL) {
    const url = new URL(location.href);
    if (manual) url.searchParams.set('theme', id); else url.searchParams.delete('theme');
    history.replaceState(null, '', url);
  }
}

function renderStats(stats) {
  if (!validStats(stats)) return;
  const format = new Intl.NumberFormat('en');
  $('#stat-repos').textContent = format.format(stats.repositories);
  $('#stat-commits').textContent = format.format(stats.commits);
  $('#stat-lines').textContent = format.format(stats.lines_changed);
  const rows = Object.entries(stats.languages).filter(([,bytes]) => bytes > 0).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
  const total = rows.reduce((sum,[,bytes]) => sum + bytes,0);
  const fragment = document.createDocumentFragment();
  rows.forEach(([name,bytes], i) => {
    const percent = total ? bytes / total * 100 : 0;
    const label = percent >= .1 ? `${percent.toFixed(1)}%` : '<0.1%';
    const row = document.createElement('li'); row.className = 'language-row';
    row.style.setProperty('--language',colorList[i % colorList.length]);
    row.style.setProperty('--phase',`${-i*.43}s`);
    const nameEl = document.createElement('span'); nameEl.className = 'language-name';
    if (icons[name]) {
      const icon = document.createElement('img'); icon.src = `./assets/icons/${icons[name]}.svg`; icon.alt = ''; icon.width = 20; icon.height = 20; icon.loading = 'lazy'; nameEl.append(icon);
    }
    nameEl.append(document.createTextNode(name));
    const share = document.createElement('span'); share.className = 'language-share'; share.textContent = label;
    const track = document.createElement('span'); track.className = 'language-track'; track.setAttribute('role','img'); track.setAttribute('aria-label', `${name}: ${label} of public code`);
    const fill = document.createElement('span'); fill.className = 'language-fill'; fill.style.width = `${percent}%`;
    track.append(fill); row.append(nameEl,share,track); fragment.append(row);
  });
  if (!rows.length) { const empty=document.createElement('li'); empty.textContent='No detected languages.'; fragment.append(empty); }
  $('#language-list').replaceChildren(fragment);
}

function buildPicker() {
  catalog.forEach(theme => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.themeChoice = theme.id; button.setAttribute('aria-label', `${theme.name}, ${theme.era}`); button.setAttribute('aria-pressed','false');
    const image = document.createElement('img'); image.src = `./assets/previews/${theme.id}-${appearance}.svg`; image.alt = theme.name; image.width = 900; image.height = theme.id === 'aero' ? 144 : 130; image.loading = 'lazy';
    button.append(image); button.addEventListener('click',() => { applyTheme(theme.id,true); picker.close(); });
    $('#theme-options').append(button);
  });
  const rain = document.createDocumentFragment();
  for (let i=0; i<28; i++) {
    const column=document.createElement('span'); column.textContent=Array.from({length:24},(_,j) => (i*7+j*3)%10).join('\n'); column.style.setProperty('--delay',`${-i*.61}s`); column.style.setProperty('--duration',`${9+i%5}s`); rain.append(column);
  }
  $('#digital-rain').append(rain);
  for (const [selector,file] of [['.hero','glass-space-sky-v1.jpg'],['.project-feature','glass-abyss-depths-v1.jpg'],['.activity','glass-lunar-horizon-v1.jpg']]) {
    const backdrop=document.createElement('div'); backdrop.className='scene-backdrop'; backdrop.setAttribute('aria-hidden','true');
    const track=document.createElement('div'); track.className='parallax-track';
    for (let i=0;i<3;i++) { const image=document.createElement('img'); image.dataset.src=`./assets/art/${file}`; image.alt=''; image.width=1100; image.height=550; track.append(image); }
    backdrop.append(track); $(selector).append(backdrop);
  }
}

const picker = $('#theme-picker');
$('#open-themes').addEventListener('click',() => { picker.showModal(); $('#open-themes').setAttribute('aria-expanded','true'); });
$('#close-themes').addEventListener('click',() => picker.close());
picker.addEventListener('close',() => { $('#open-themes').setAttribute('aria-expanded','false'); $('#open-themes').focus({preventScroll:true}); });
picker.addEventListener('click',event => { if (event.target === picker) { const r=picker.getBoundingClientRect(); if (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) picker.close(); } });
function selectDefault() { applyTheme(defaultTheme,false); picker.close(); }
$('#choose-daily').addEventListener('click',selectDefault);
$('#daily-shortcut').addEventListener('click',selectDefault);
$('#choose-random').addEventListener('click',() => {
  const options=catalog.filter(theme => theme.id!==active?.id); if (!options.length) return;
  const random = new Uint32Array(1); crypto.getRandomValues(random);
  applyTheme(options[random[0] % options.length].id,true); picker.close();
});
$('#toggle-mode').addEventListener('click',() => {
  appearance=appearance === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('appearance',appearance); } catch { /* Keep working without persistence. */ }
  if (active) applyTheme(active.id,explicit,false);
});
window.addEventListener('popstate',() => {
  const id=new URL(location.href).searchParams.get('theme');
  applyTheme(catalog.some(t=>t.id===id) ? id : defaultTheme, Boolean(id && catalog.some(t=>t.id===id)),false);
});

const pattern=[0,3,4,5], cells=[...document.querySelectorAll('[data-cell]')];
let progress=[], dragging=false;
function resetPattern() {
  progress=[]; $('.gesture-grid').classList.remove('matched');
  cells.forEach((cell,i) => { cell.classList.remove('visited'); cell.setAttribute('aria-pressed','false'); cell.tabIndex=i===0 ? 0 : -1; });
  $('#gesture-status').textContent='01 → 02 → 03 → 04';
}
function visit(index) {
  if (progress.at(-1) === index) return;
  if (index === 0 || progress.length === pattern.length) resetPattern();
  if (pattern[progress.length] !== index) { $('#gesture-status').textContent=progress.length ? `Next: ${String(progress.length+1).padStart(2,'0')}` : 'Start at 01.'; return; }
  progress.push(index); cells[index].classList.add('visited'); cells[index].setAttribute('aria-pressed','true');
  if (progress.length === pattern.length) { $('.gesture-grid').classList.add('matched'); $('#gesture-status').textContent='Pattern matched ✓'; }
  else $('#gesture-status').textContent=`${progress.length} of 4 / Next: ${String(progress.length+1).padStart(2,'0')}`;
}
cells.forEach((cell,index) => {
  cell.addEventListener('click',() => visit(index));
  cell.addEventListener('pointerdown',event => { if (event.button !== 0) return; dragging=true; visit(index); $('.gesture-grid').setPointerCapture(event.pointerId); });
  cell.addEventListener('keydown',event => {
    const row=Math.floor(index/3), col=index%3;
    const targets={ArrowDown:Math.min(2,row+1)*3+col,ArrowUp:Math.max(0,row-1)*3+col,ArrowRight:row*3+Math.min(2,col+1),ArrowLeft:row*3+Math.max(0,col-1)};
    if (event.key in targets) {
      event.preventDefault(); if (!progress.length && index===0) visit(0);
      const next=targets[event.key]; cells.forEach((c,i)=>c.tabIndex=i===next?0:-1); cells[next].focus(); visit(next);
    }
  });
});
$('.gesture-grid').addEventListener('pointermove',event => {
  // A mouse can lose capture while its primary button remains down.
  if (!dragging && event.buttons !== 1) return;
  const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-cell]');
  if (cell && $('.gesture-grid').contains(cell)) visit(Number(cell.dataset.cell));
});
for (const name of ['pointerup','pointercancel','lostpointercapture']) $('.gesture-grid').addEventListener(name,() => dragging=false);
$('#reset-grid').addEventListener('click',() => { resetPattern(); cells[0].focus(); });

async function getJSON(url) {
  const response=await fetch(url,{cache:'no-cache',signal:AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error('Profile data unavailable');
  return response.json();
}
async function refreshPublicProfile() {
  lastRefresh=Date.now();
  try {
    const day=new Date().toISOString().slice(0,10);
    const stats=await getJSON(`${profileBase}stats.json?day=${day}`);
    if (!validStats(stats)) return;
    daily={selected:stats.updated}; renderStats(stats);
    applyTheme(explicit ? active.id : defaultTheme,explicit,false);
  } catch { /* The bundled public snapshot remains usable offline. */ }
}
try {
  const snapshot=await getJSON('./assets/profile.json');
  catalog=snapshot.themes;
  daily=snapshot.theme;
  buildPicker(); renderStats(snapshot.stats);
  const requested=new URL(location.href).searchParams.get('theme');
  applyTheme(catalog.some(t=>t.id===requested) ? requested : defaultTheme,catalog.some(t=>t.id===requested));
  root.dataset.ready='true';
  refreshPublicProfile();
} catch {
  $('#theme-mode').textContent='Visual identity';
  $('#theme-options').textContent='The theme collection could not load. Please reload the page.';
}
let currentDay=new Date().toISOString().slice(0,10);
setInterval(() => {
  const today=new Date().toISOString().slice(0,10);
  if (!document.hidden && (today!==currentDay || Date.now()-lastRefresh>15*60*1000)) { currentDay=today; refreshPublicProfile(); }
},60000);
document.addEventListener('visibilitychange',() => { if (!document.hidden && Date.now()-lastRefresh>60000) refreshPublicProfile(); });
