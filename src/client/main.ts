// SPDX-License-Identifier: GPL-3.0-or-later
import { townRoads } from '../shared/town';
import { resourceNodes, resourceAmount } from '../shared/resources';
import { roomCount } from '../shared/lodging';
import { shipStats, route, stationPrice, spaceGoods } from '../shared/galaxy';
import { calendar, weatherAt } from '../shared/environment';
import { crops, cropStatus } from '../shared/farming';
import { appearance } from '../shared/appearance';
import { VERSION } from '../shared/version';
import './style.css';
import { GameScene } from './scene';
import {
  items,
  recipes,
  vehicles,
  buildings as definitions,
  skills,
  galaxy,
  weapons,
} from '../shared/catalog';
import { money, carry, distance, productionInterval } from '../shared/simulation';
import { publicPath } from '../shared/public-path';
import type { World, Player, Building, Action } from '../shared/types';
import type { Account } from '../server/universe';
document.documentElement.classList.toggle(
  'performance',
  localStorage.getItem('aclone.quality') === 'low',
);
const app = document.querySelector<HTMLElement>('#app')!;
const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const button = (text: string, action: string, extra = '', className = '') =>
  `<button type="button" data-do="${action}" ${extra} class="${className}">${text}</button>`;
app.innerHTML = `<div id="viewport"></div><div class="grain" aria-hidden="true"></div><header class="brand"><button id="brand-button" aria-label="Open game menu"><span class="brand-icon">a</span><strong>Aclone<span>A SMALL, PERSISTENT UNIVERSE</span></strong></button><span id="connection" role="status">OFFLINE</span></header><div id="world-hud" hidden><div class="location"><span class="eyebrow">YOUR LITTLE CORNER OF THE UNIVERSE</span><b id="location">Puddlewick</b><span id="clock"></span></div><aside class="left-panel"><div class="panel-heading"><span>PARISH MAP</span><kbd>M</kbd></div><canvas id="minimap" width="230" height="170" aria-label="World map"></canvas><div class="map-legend"><i class="dot rust"></i> You <i class="dot cream"></i> Buildings <span>N ↑</span></div><section class="journal"><span class="eyebrow">GETTING ESTABLISHED</span><h2>An honest day's work.</h2><p id="objective">Drive to the Odd Jobs Office and take a shift. The economy won't run itself. Mostly.</p>${button('View parish directory <span>↗</span>', 'directory', '', 'wide')}${button('How things work <kbd>F7</kbd>', 'help', '', 'wide quiet')}</section></aside><aside class="status-panel"><div class="pilot"><span class="dot live"></span><strong id="pilot-name"></strong><span id="age"></span></div><div class="cash"><small>CASH IN HAND</small><b id="cash"></b></div><div id="needs"></div><div class="player-heading">IN THE PARISH <span id="player-count"></span></div><div id="players"></div></aside><div class="bottom-left"><div id="driving"></div><div class="button-row">${button('Engine <kbd>F4</kbd>', 'engine')}${button('Lights', 'lights')}${button('View <kbd>C</kbd>', 'camera')}</div><p class="tourney">◈ A modest ambition: live a long life. Get reasonably rich.</p></div><section class="chat-panel"><div id="target"></div><div id="chat-log" role="log" aria-live="polite"></div><form id="chat-form"><span>›</span><input id="chat-input" name="message" maxlength="300" placeholder="Enter to chat · *help for commands" aria-label="Chat message" autocomplete="off"><button aria-label="Send message">↵</button></form></section><aside class="inventory-panel"><nav>${button('Inventory <kbd>I</kbd>', 'inventory')}${button('Skills', 'skills')}${button('World <kbd>F9</kbd>', 'menu')}</nav><div id="bag"></div></aside><nav class="quickbar" aria-label="Game actions">${button('Parp <kbd>Space</kbd>', 'horn')}${button('Activities', 'activities')}${button('Resources', 'resources')}${button('Build', 'construction')}${button('Editor <kbd>F10</kbd>', 'editor')}</nav><div class="touch-drive" aria-label="Touch driving controls"><button data-key="ArrowUp" aria-label="Accelerate">↑</button><div><button data-key="ArrowLeft" aria-label="Turn left">←</button><button data-key="ArrowDown" aria-label="Reverse">↓</button><button data-key="ArrowRight" aria-label="Turn right">→</button></div></div></div><div id="overlay"></div><div id="modal-host"></div><div id="toast" role="status" aria-live="polite"></div>`;
let scene: GameScene;
try {
  scene = new GameScene(document.querySelector('#viewport')!);
} catch (e) {
  app.innerHTML = `<div class="fatal"><h1>Aclone needs WebGL</h1><p>Enable hardware acceleration in your browser, then reload.</p><p>${esc((e as Error).message)}</p></div>`;
  throw e;
}
let world: World | undefined,
  me: Player | undefined,
  account: Account | undefined,
  ws: WebSocket | undefined;
let registry: {
  id: string;
  name: string;
  template: string;
  system: string;
  players: number;
  owner: string;
  locked: boolean;
}[] = [];
let market: { stock: Record<string, number> } | undefined;
let panel = '',
  selected = '',
  tab = 'Main',
  token = localStorage.getItem('aclone.pilot') ?? '',
  inSpace = true,
  reconnectTimer: ReturnType<typeof setTimeout> | undefined,
  ping = 0,
  request = 0;
let accountStatus:
  | {
      password: boolean;
      email: string;
      verified: boolean;
      recoveryAvailable: boolean;
      deliveryError?: boolean;
    }
  | undefined;
const recovery = new URLSearchParams(location.hash.slice(1));
const recoveryToken = recovery.get('reset') ?? recovery.get('verify');
if (recoveryToken) history.replaceState(null, '', location.pathname + location.search);
let audio: AudioContext | undefined,
  sound = localStorage.getItem('aclone.sound') === 'on',
  weapon = 'plasma';
const keys = new Set<string>();
const $ = (id: string) => document.getElementById(id)!;
declare const __ACLONE_BASE__: string;
const withBase = (path: string) => publicPath(__ACLONE_BASE__, path);
function toast(text: string, error = false) {
  $('toast').textContent = text;
  $('toast').className = error ? 'show error' : 'show';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ($('toast').className = ''), 5000);
}
let toastTimer = 0;
function tone(freq = 180, duration = 0.2) {
  if (!sound) return;
  audio ??= new AudioContext();
  void audio.resume();
  const oscillator = audio.createOscillator(),
    gain = audio.createGain();
  oscillator.type = 'sawtooth';
  oscillator.frequency.value = freq;
  gain.gain.setValueAtTime(0.04, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + duration);
}
function send(action: Action) {
  if (ws?.readyState !== WebSocket.OPEN) {
    toast('Connection unavailable. Reconnect before making changes.', true);
    return;
  }
  ws.send(JSON.stringify({ type: 'action', request: ++request, action }));
}
async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(withBase(path), {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.error ?? 'Request failed');
  return data;
}
async function connect() {
  clearTimeout(reconnectTimer);
  $('connection').textContent = 'CONNECTING';
  ws = new WebSocket(
    `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${withBase('/ws')}`,
  );
  ws.addEventListener('open', () => {
    ws!.send(
      JSON.stringify({
        type: 'hello',
        token,
        protocol: 2,
        world: localStorage.getItem('aclone.world') ?? undefined,
      }),
    );
  });
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'welcome') {
      account = msg.account;
      registry = msg.galaxy.worlds;
      market = msg.market;
      $('connection').textContent = 'CONNECTED';
      if (!world) showGalaxy();
    }
    if (msg.type === 'state') {
      if (msg.partial && world) {
        const players = { ...world.players, ...msg.world.players };
        for (const id of Object.keys(players)) if (!players[id]) delete players[id];
        world = { ...world, ...msg.world, players };
      } else world = msg.world;
      if (msg.self) world!.players[msg.me] = msg.self;
      me = world!.players[msg.me];
      account = msg.account;
      inSpace = false;
      localStorage.setItem('aclone.world', world!.id);
      $('overlay').innerHTML = '';
      $('world-hud').hidden = false;
      scene.setWorld(world!, msg.me);
      updateHud();
    }
    if (msg.type === 'space') {
      account = msg.account;
      registry = msg.galaxy.worlds;
      market = msg.market;
      world = undefined;
      me = undefined;
      localStorage.removeItem('aclone.world');
      const reopen = panel === 'shipyard';
      closePanel();
      void showGalaxy().then(() => {
        if (reopen) openPanel('shipyard');
      });
    }
    if (msg.type === 'result') {
      if (msg.message !== 'Parp.') toast(msg.message, !msg.ok);
      if (msg.ok && panel) setTimeout(() => renderPanel(), 100);
      if (!msg.ok && msg.message.includes('Invalid pilot key')) {
        token = '';
        localStorage.removeItem('aclone.pilot');
        login();
      }
    }
    if (msg.type === 'pong') ping = Math.round(performance.now() - msg.at);
  });
  ws.addEventListener('close', (e) => {
    $('connection').textContent = 'DISCONNECTED';
    keys.clear();
    if (e.code === 4004) {
      token = '';
      localStorage.removeItem('aclone.pilot');
      world = undefined;
      me = undefined;
      closePanel();
      login();
      toast(e.reason, true);
      return;
    }
    if (e.code === 4001 || e.code === 4003) {
      toast(e.reason, true);
      return;
    }
    toast('Disconnected. Reconnecting in a moment…', true);
    reconnectTimer = setTimeout(() => {
      if (token) void connect();
    }, 2500);
  });
}
function login() {
  scene.setSpace();
  $('world-hud').hidden = true;
  $('overlay').innerHTML =
    `<div class="landing"><div class="landing-copy"><div class="eyebrow">INDEPENDENT. OPEN SOURCE. SLIGHTLY AGRICULTURAL.</div><h1>A little world.<br>A lot to get<br><em>on with.</em></h1><p>Build a business. Drive a tractor. Honk a ball into a goal.<br>A persistent universe, made by the people in it.</p><span class="release">ALPHA ${VERSION} <i>✦</i> GPL-3.0-OR-LATER</span></div><section class="login-card"><span class="eyebrow">YOUR FIRST DAY, PRESUMABLY</span><h2>Welcome to Aclone.</h2><p>A pilot name, a modest shuttle, and absolutely no grand destiny.</p><form id="register-form"><label>Pilot name<input name="name" placeholder="e.g. Ada Turnip" minlength="2" maxlength="24" required autocomplete="nickname"></label><button class="primary">Make yourself at home <span>↗</span></button></form><details><summary>Sign in with a password</summary><form id="signin-form"><label>Returning pilot name<input name="name" required autocomplete="username"></label><label>Password<input name="password" type="password" required maxlength="128" autocomplete="current-password"></label><button class="primary">Sign in</button></form></details><details><summary>Forgot your password?</summary><form id="forgot-form"><label>Verified email<input name="email" type="email" required autocomplete="email"></label><button>Send reset link</button></form><small>Email recovery must be enabled by the server operator.</small></details><details><summary>Been here before? Restore your pilot.</summary><form id="restore-form"><label>Pilot key<input name="key" type="password" required placeholder="Paste your saved pilot key" autocomplete="off"></label><button>Restore pilot</button></form></details><small>Your pilot stays in this browser. Add a password and recovery email in Pilot & preferences, or export a private key.</small></section><footer>NO INSTALL. NO SUBSCRIPTION. BRING YOUR OWN AMBITION.<span>Original code, art & sound · Community built</span></footer></div>`;
}
async function showGalaxy() {
  inSpace = true;
  scene.setSpace();
  $('world-hud').hidden = true;
  try {
    registry = (await api('/api/galaxy')).worlds;
  } catch {}
  if (!account) return;
  const system = galaxy.systems.find((s) => s.id === account!.system)!;
  $('overlay').innerHTML =
    `<div class="galaxy-view"><div class="galaxy-heading"><div><span class="eyebrow">GALACTIC DIRECTORY / ${esc(system.name.toUpperCase())} SYSTEM</span><h1>Somewhere to call home.</h1><p>A handful of worlds. A pleasantly unreasonable number of possibilities.</p></div><div class="pilot-card">${esc(account.name)}<b>${account.credits} <small>cr</small></b><span>${esc(galaxy.ships.find((s) => s.id === account!.ship)!.name)}</span></div></div>${account.transit ? `<div class="notice">Jumping to ${esc(galaxy.systems.find((s) => s.id === account!.transit!.destination)?.name)}. <span id="jump-countdown">${Math.max(0, Math.ceil(account.transit.arrives - Date.now() / 1000))}</span>s until arrival. Your flight is saved if you disconnect.</div>` : ''}<div class="star-map"><svg viewBox="0 0 700 260" role="img" aria-label="Galaxy map; bright routes are within your current jump range">${galaxy.systems
      .flatMap((s, i) =>
        galaxy.systems
          .slice(i + 1)
          .filter((t) => Math.hypot(s.x - t.x, s.y - t.y) <= shipStats(account!).range)
          .map(
            (t) =>
              `<line x1="${80 + (s.x + 3) * 28}" y1="${220 - s.y * 23}" x2="${80 + (t.x + 3) * 28}" y2="${220 - t.y * 23}" stroke="#58716a"/>`,
          ),
      )
      .join(
        '',
      )}${galaxy.systems.map((s) => `<circle cx="${80 + (s.x + 3) * 28}" cy="${220 - s.y * 23}" r="${s.id === account!.system ? 8 : 5}" fill="${s.id === account!.system ? '#ffd889' : '#c7dbd8'}"/><text x="${90 + (s.x + 3) * 28}" y="${215 - s.y * 23}" fill="#ece8cc" font-size="13">${esc(s.name)}</text>`).join('')}</svg><p>${esc(shipStats(account).name)} · ${shipStats(account).range} pc jump range. Routes below show intermediate stops and fuel costs.</p></div><div class="world-cards">${registry
      .filter((r) => r.system === account!.system)
      .map(
        (r, i) =>
          `<article class="world-card"><div class="world-art art-${i % 3}"><div class="planet"></div><span class="world-type">${esc(r.template.toUpperCase())}</span><span class="world-online">● ${r.players} ONLINE</span></div><div class="world-detail"><h2>${esc(r.name)}</h2><p>${r.template === 'economy' ? 'An honest living, a village green, and the occasional tractor-related incident.' : r.template === 'combat' ? 'Settle differences with wildly disproportionate farm machinery.' : 'Boats, biplanes, and a conspicuous lack of responsibility.'}</p><div class="world-facts"><span>PERSISTENT WORLD</span><span>${r.owner === account!.id ? 'YOUR WORLD' : 'COMMUNITY PARISH'}</span></div>${button('Land on this world <span>↗</span>', 'land', `data-id="${r.id}" ${account!.transit ? 'disabled' : ''}`, 'primary wide')}</div></article>`,
      )
      .join(
        '',
      )}<article class="create-card"><div class="create-mark">+</div><h2>Make your own parish.</h2><p>Your terrain. Your economy.<br>Your deeply questionable rules.</p>${button('Create a world', 'create', '', 'wide')}</article></div><div class="galaxy-bottom"><div><span class="eyebrow">FURTHER AFIELD</span><div class="button-row">${galaxy.systems
      .filter((s) => s.id !== account!.system)
      .map((s) =>
        button(
          `${s.name} · ${Math.hypot(s.x - system.x, s.y - system.y).toFixed(1)} pc · ${Math.ceil(Math.hypot(s.x - system.x, s.y - system.y))}cr${Math.hypot(s.x - system.x, s.y - system.y) > shipStats(account!).range ? ' · via ' + (route(account!.system, s.id, shipStats(account!).range).slice(1, -1).join(' → ') || 'upgrade required') : ''}`,
          'jump',
          `data-id="${s.id}" ${account!.transit || Math.hypot(s.x - system.x, s.y - system.y) > shipStats(account!).range ? 'disabled' : ''}`,
        ),
      )
      .join(
        '',
      )}</div></div><div class="button-row">${button('Shipyard & space trade', 'shipyard')}${button('Pilot key & options', 'options')}${button('Field guide', 'help')}</div></div></div>`;
}
let previousTargetHtml = '';
function updateHud() {
  if (!world || !me) return;
  $('location').textContent =
    world.name +
    ' · ' +
    (distance(me, { x: 0, z: 0 }) < (world.townLayout === 2 ? 245 : 80)
      ? 'In the parish of Puddlewick'
      : 'Out in the sticks');
  const days = Math.floor(world.time / 600),
    hours = Math.floor(world.settings.time / 3600);
  $('clock').textContent =
    `${String(hours).padStart(2, '0')}:${String(Math.floor(world.settings.time / 60) % 60).padStart(2, '0')} · ${calendar(world).season} · Day ${calendar(world).dayOfYear + 1}, Year ${calendar(world).year} · ${weatherAt(world.id, calendar(world).absoluteDay).precipitation} · ${weatherAt(world.id, calendar(world).absoluteDay).storm ? 'STORM · ' : ''}${(world.climate?.snow ?? 0) > 0.05 ? 'Snow on roads · ' : (world.climate?.wetness ?? 0) > 0.2 ? 'Wet roads · ' : ''}${world.template}`;
  $('pilot-name').textContent = me.name;
  $('age').textContent = 'Age ' + Math.floor(me.age);
  $('cash').textContent = money(me.cash, world.settings.denariiPerSheckle);
  const bars: [string, number, string][] = [
    ['Health', me.health / 60000, 'health'],
    ['Hunger', me.hunger / 50000, 'hunger'],
    ['Thirst', me.thirst / 50000, 'thirst'],
    ['Wellbeing', 1 - (me.hunger + me.thirst) / 100000, 'wellbeing'],
    ['Fuel', me.fuel / 64, 'fuel'],
    ['Energy', me.energy / 65000, 'energy'],
  ];
  $('needs').innerHTML = bars
    .map(
      ([name, value, cls]) =>
        `<div class="need"><label>${name}</label><div class="bar"><i class="${cls}" style="width:${Math.max(0, Math.min(100, value * 100))}%"></i></div><small>${Math.round(value * 100)}%</small></div>`,
    )
    .join('');
  const online = Object.values(world.players).filter((p) => p.online);
  $('player-count').textContent = String(online.length);
  $('players').innerHTML = online
    .slice(0, 8)
    .map(
      (p) =>
        `<div class="player-row"><span>${p.id === me!.id ? '▸' : '·'} ${esc(p.name)}</span><small>${p.kudos} kudos</small></div>`,
    )
    .join('');
  $('driving').innerHTML =
    `<strong>${Math.round(Math.abs(me.speed) * 2.237)}<small> MPH</small></strong><span>${esc(vehicles[me.vehicle].name)}<small>${me.engine ? 'ENGINE ON' : 'ENGINE OFF'} · ${ping} ms</small></span>`;
  const target = scene.nearest();
  let targetHtml = me.task
    ? `<div class="task"><span>${esc(me.task.kind.toUpperCase())}</span><b>${Math.max(0, Math.ceil(me.task.end - world.time))}s</b></div>`
    : me.atHome
      ? button('At home · Go outside', 'outside', '', 'wide')
      : target
        ? button(
            `<kbd>Ctrl / E</kbd> ${esc(target.name)} <span>↗</span>`,
            'building',
            `data-id="${target.id}"`,
            'wide target-button',
          )
        : '<span class="hint">ARROWS / WASD to drive · SHIFT to give it a bit more</span>';
  $('chat-log').innerHTML = world.messages
    .slice(-5)
    .map((m) => `<div class="chat-line ${esc(m.kind)}"><b>${esc(m.name)}</b> ${esc(m.text)}</div>`)
    .join('');
  $('chat-log').scrollTop = $('chat-log').scrollHeight;
  $('bag').innerHTML =
    Object.entries(me.inventory)
      .filter(([, n]) => n > 0)
      .slice(0, 4)
      .map(
        ([id, n]) =>
          `<button data-do="use" data-id="${id}" title="Use ${esc(items[id]?.name)}"><span>${esc(items[id]?.name ?? id)}</span><b>${n}</b></button>`,
      )
      .join('') +
    `<div class="carry">${carry(me)} / ${vehicles[me.vehicle].capacity} carried</div>`;
  $('objective').textContent = me.task
    ? 'A shift in progress. Take in the view.'
    : me.learning
      ? `Learning ${me.learning.skill}. ${Math.ceil((me.learning.end - world.time) / 60)} minutes to go.`
      : me.job
        ? 'Keep working at your employer to earn wages when production runs.'
        : 'Earn cash at the Odd Jobs Office. Learn a skill at the school. Own a business. In roughly that order.';
  if (me.game === 'combat' && world.combat)
    $('objective').textContent =
      `${world.combat.mode} · ${me.team === 0 ? 'Rust' : 'Moss'} team · Rust ${Math.floor(world.combat.scores[0])} : ${Math.floor(world.combat.scores[1])} Moss. ${weapons[weapon].name}: ${world.settings.weaponMode === 'ammo' ? (me.ammo?.[weapon] ?? 'full') + ' rounds' : Math.floor(me.energy / 650) + '% energy'}. Tab fires; 1–6 select.`;
  drawMap();
  if (
    me.game === 'fishing' &&
    me.fishAt !== undefined &&
    world.time >= me.fishAt &&
    world.time <= (me.fishUntil ?? 0)
  )
    targetHtml = button('Fish! Reel in <kbd>F3</kbd>', 'reel', '', 'wide target-button');
  if (me.game === 'hornball')
    $('clock').textContent += ` · RUST ${world.scores[0]} : ${world.scores[1]} MOSS`;
  if (me.race)
    targetHtml = `<div class="task">${world.time < me.race.start ? 'Race starts in ' + Math.ceil(me.race.start - world.time) : 'Checkpoint ' + me.race.next + ' / 4'} <b>${Math.max(0, world.time - me.race.start).toFixed(1)}s</b></div>`;
  // Preserve the button between snapshots so a mouse press/release or keyboard
  // focus is not lost. Compute activity overrides before updating the DOM too.
  if (targetHtml !== previousTargetHtml) {
    $('target').innerHTML = targetHtml;
    previousTargetHtml = targetHtml;
  }
}
function drawMap() {
  if (!world || !me) return;
  const c = $('minimap') as HTMLCanvasElement,
    ctx = c.getContext('2d')!;
  ctx.fillStyle = '#4e6247';
  ctx.fillRect(0, 0, 230, 170);
  const scale = world.townLayout === 2 ? 0.31 : 0.6;
  const sx = (x: number) => 115 + x * scale,
    sz = (z: number) => (world!.townLayout === 2 ? 85 : 65) + z * scale;
  ctx.strokeStyle = '#718160';
  ctx.lineWidth = 1;
  for (let x = 0; x < 230; x += 23) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 170);
    ctx.stroke();
  }
  for (let z = 0; z < 170; z += 17) {
    ctx.beginPath();
    ctx.moveTo(0, z);
    ctx.lineTo(230, z);
    ctx.stroke();
  }
  ctx.fillStyle = '#758e86';
  ctx.fillRect(0, sz(150), 230, 170 - sz(150));
  ctx.strokeStyle = '#b6ac84';
  ctx.lineCap = 'round';
  for (const { a, b, width } of townRoads(world)) {
    ctx.lineWidth = Math.max(1, width * scale);
    ctx.beginPath();
    ctx.moveTo(sx(a.x), sz(a.z));
    ctx.lineTo(sx(b.x), sz(b.z));
    ctx.stroke();
  }
  ctx.fillStyle = '#ddd0a5';
  for (const b of world.buildings) ctx.fillRect(sx(b.x) - 2, sz(b.z) - 2, 4, 4);
  ctx.strokeStyle = '#c8d29e';
  ctx.strokeRect(sx(60), sz(20), 60 * scale, 50 * scale);
  for (const p of Object.values(world.players)) {
    ctx.fillStyle = p.id === me.id ? '#f2ba71' : '#b9d3cc';
    ctx.beginPath();
    ctx.arc(sx(p.x), sz(p.z), p.id === me.id ? 4 : 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = '9px monospace';
  ctx.fillStyle = '#f0e6c4';
  ctx.fillText('PUDDLEWICK', sx(-30), sz(-22));
  ctx.fillText('HORN BALL', sx(63), sz(84));
  ctx.fillText('CIRCUIT', sx(-123), sz(95));
}
function openPanel(name: string) {
  if (name === 'options' && token)
    void api('/api/auth/status')
      .then((r) => {
        accountStatus = r;
        if (panel === 'options') renderPanel();
      })
      .catch((e) => toast(e.message, true));
  scene.paused = true;
  panel = name;
  tab = 'Main';
  keys.clear();
  renderPanel();
}
function closePanel() {
  scene.paused = false;
  panel = '';
  $('modal-host').innerHTML = '';
}
function modal(title: string, content: string, wide = false) {
  const current = $('modal-host').querySelector<HTMLInputElement>(
    'input:focus,textarea:focus,select:focus',
  );
  if (current) return;
  $('modal-host').innerHTML =
    `<div class="modal-backdrop"><section class="window ${wide ? 'large' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><span class="eyebrow">ACLONE / ${esc(world?.name ?? 'UNIVERSE')}</span>${button('×', 'close', 'aria-label="Close dialog"', 'close')}</header><h2>${esc(title)}</h2>${content}</section></div>`;
}
function field(
  label: string,
  name: string,
  value: string | number = '',
  type = 'text',
  extra = '',
) {
  return `<label>${label}<input name="${name}" value="${esc(value)}" type="${type}" ${extra}></label>`;
}
function hidden(name: string, value: string) {
  return `<input type="hidden" name="${name}" value="${esc(value)}">`;
}
function select(name: string, entries: [string, string][], label = '') {
  return `<label>${label}<select name="${name}">${entries.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></label>`;
}
function renderPanel() {
  if (!panel) return;
  if (panel === 'create') {
    modal(
      'A parish of your own.',
      `<p>Start from a template. You become its owner, with live editing and a Lua world script. Friends can find it in the Hearth system.</p><form id="create-form">${field('World name', 'name', '', 'text', 'required maxlength="48" placeholder="e.g. Lesser Wobbleton"')}${select(
        'template',
        [
          ['economy', 'Persistent economy'],
          ['combat', 'Tractor combat'],
          ['playground', 'Vehicle playground'],
        ],
        'Starting template',
      )}<button class="primary">Create world</button></form>`,
    );
    return;
  }
  if (panel === 'help') {
    modal(
      'The field guide.',
      `<p class="lede">Live a long life. Get reasonably rich. Try not to become an ostrich.</p><div class="guide-grid"><section><h3>Your first few minutes</h3><ol><li>Land in Puddlewick. Drive with the arrows or WASD.</li><li>Approach the <b>Odd Jobs Office</b>, north of the green. Press E or Ctrl and work a 15-second shift for 45d.</li><li>Buy bread and water from <b>Harbour stores</b>. Click them in your inventory to consume.</li><li>Learn a profession at the <b>school</b>. The first lesson takes one minute and costs 80d.</li><li>Take a job, work, then buy a business. Fund its investment and inputs; production runs every ten minutes; farms use seasonal plots and harvest shifts.</li><li>Your life and property are protected while disconnected. Businesses and training keep running.</li></ol></section><section><h3>The buttons that matter</h3><dl><dt>Arrows / WASD</dt><dd>Drive & steer</dd><dt>Shift</dt><dd>Boost (uses more fuel)</dd><dt>E / Ctrl</dt><dd>Open nearby building</dd><dt>Space / Tab</dt><dd>Horn; Tab fires in combat. Hold/release Tab for javelins; 1–6 select weapons.</dd><dt>F2 / Enter</dt><dd>Chat · *help for commands</dd><dt>F4 / L</dt><dd>Engine / headlights</dd><dt>F5 / R</dt><dd>Robocrow</dd><dt>C / mouse wheel</dt><dd>Camera / zoom</dd><dt>H</dt><dd>Scenery view · hide or restore the HUD; Escape restores it</dd><dt>Insert / Delete</dt><dd>Climb / descend in flight</dd><dt>F3</dt><dd>Reel when the fish bites</dd><dt>F9 / F10</dt><dd>Menu / owner editor</dd><dt>Esc</dt><dd>Close window</dd></dl></section></div><p class="note">A day takes ten real minutes and the seasonal year about 61 hours. Farms grow six crops over two to ten hours; tend plots and complete 15-second harvest shifts. Choose combat modes in Activities, cottage styling in Build, and paint at the garage. Space journeys, courier contracts and discoveries are saved across disconnects. Cash is sheckles and denarii (normally 100d = 1s). The server keeps your property working while you are away. Keep inputs, stock space and wages funded. At 1% efficiency, unattended businesses still produce slowly. Browser-reserved keys have on-screen alternatives.</p>`,
      true,
    );
    return;
  }
  if (panel === 'options') {
    modal(
      'Pilot & preferences.',
      `<p>Save your pilot key somewhere private. It is the key to your identity and property. Anyone who has it can play as you.</p>${button('Download pilot recovery key', 'exportKey', '', 'primary')}${button(sound ? 'Sound: on' : 'Sound: off', 'sound')}${button('Graphics: ' + scene.qualityLabel, 'quality')}<p class="note">Graphics cycles through adaptive, detailed (fixed shadows), and performance. The server stores progress automatically, including when you disconnect.</p><hr>${account ? `<h3>Secure your pilot</h3><p>${accountStatus?.password ? 'Password enabled.' : 'Add a password to sign in on another device.'} ${accountStatus?.verified ? 'Recovery email verified.' : 'Email must be verified before it can recover this pilot.'}</p><form id="account-form">${accountStatus?.password ? '<label>Current password<input type="password" name="currentPassword" required autocomplete="current-password"></label>' : ''}<label>New password<input type="password" name="password" minlength="12" maxlength="128" required autocomplete="new-password"></label>${accountStatus?.recoveryAvailable ? `<label>Recovery email (optional)<input type="email" name="email" value="${esc(accountStatus?.email)}" autocomplete="email"></label>` : '<p class="note">This server has not configured email delivery. Export your pilot key as a backup.</p>'}<button class="primary">Save account security</button></form>${accountStatus?.email && !accountStatus.verified ? button('Resend verification email', 'resendEmail') : ''}${button('Sign out of all devices', 'logout')}` : ''}<hr><p>Aclone ${VERSION} · GPL-3.0-or-later<br>Original models, AI-generated material textures, and synthesized audio. Reference material is not part of the game distribution.</p>${button('Field guide', 'help')}`,
    );
    return;
  }
  if (panel === 'shipyard') {
    if (!account) return;
    modal(
      'A slightly better spaceship.',
      `<p>${account.credits} galactic credits · ${Object.values(account.cargo).reduce((s, n) => s + n, 0)} cargo items</p><div class="cards">${galaxy.ships.map((s) => `<article><h3>${esc(s.name)}</h3><p>${s.range} pc range · ${s.capacity} cargo · ${s.price} cr</p>${button(s.id === account!.ship ? 'Current ship' : account!.hangar?.includes(s.id) ? 'Fly owned ship' : 'Buy ship', 'ship', `data-id="${s.id}" ${s.id === account!.ship ? 'disabled' : ''}`)}</article>`).join('')}</div><h3>Ship fittings</h3><p>Fleet-wide fittings stay installed when switching ships. Current range ${shipStats(account).range} pc · capacity ${shipStats(account).capacity}.</p>${['drive', 'hold'].map((kind) => button(`${kind === 'drive' ? 'Jump drive +2 pc' : 'Cargo hold +20'} · level ${account!.upgrades?.[kind] ?? 0}/3 · ${((account!.upgrades?.[kind] ?? 0) + 1) * (kind === 'drive' ? 80 : 60)}cr`, 'upgrade', `data-id="${kind}" ${(account!.upgrades?.[kind] ?? 0) >= 3 ? 'disabled' : ''}`)).join('')}<h3>Courier desk</h3>${account.mission ? `<p>Ten sealed packages to ${esc(galaxy.systems.find((s) => s.id === account!.mission!.destination)?.name)} · reward ${account.mission.reward}cr. No expiry while offline.</p>${button('Deliver contract', 'courier', 'data-id="deliver"')}${button('Cancel contract', 'courier', 'data-id="cancel"')}` : `<p>Carry ten sealed packages to a reachable station. Keep jump fuel in reserve.</p>${button('Accept delivery contract', 'courier', 'data-id="accept"')}`}<h3>Exploration</h3><p>Survey each system once for 15cr. Frontier surveys at Lantern, Rime and The Vessel reveal relics; three relics unlock the alien ship. ${account.discoveries?.length ?? 0}/3 found.</p>${button('Survey this system', 'survey', ' ' + (account.visited?.includes(account.system) ? 'disabled' : ''))}${button('Stranded pilot rescue', 'rescue')}<p class="note">Free rescue to Hearth is available with an empty hold, no contract and under 10cr.</p><h3>Station trading</h3><p>Buy here, jump, sell elsewhere. Station prices differ by system.</p><form data-action="spaceTrade">${select(
        'item',
        ['electronics', 'rareEarth', 'shipParts'].map((id) => [
          id,
          `${items[id].name} · buy ${stationPrice(account!.system, id).buy} / sell ${stationPrice(account!.system, id).sell}cr · station ${market?.stock[id] ?? 200} · carried ${account!.cargo[id] ?? 0}`,
        ]),
        'Cargo',
      )}${field('Quantity', 'quantity', 1, 'number', 'min="1" max="100"')}${select(
        'buy',
        [
          ['true', 'Buy'],
          ['false', 'Sell'],
        ],
        'Direction',
      )}<button>Trade</button></form>`,
    );
    return;
  }
  if (!world || !me) {
    modal(
      'Land first.',
      `<p>This is a planetside activity.</p>${button('Choose a world', 'galaxy')}`,
    );
    return;
  }
  const b = world.buildings.find((b) => b.id === selected);
  if (panel === 'building' && b) {
    buildingWindow(b);
    return;
  }
  if (panel === 'resources') {
    modal(
      'Gathering grounds',
      `<p>Drive within 10 metres of a marked ground. Carry tools for timber and minerals; topsoil can be gathered by hand. School qualifications double a load and shorten the task. Reserves replenish slowly, including offline.</p><div class="directory">${[
        ...resourceNodes,
      ]
        .sort((a, b) => distance(me!, a) - distance(me!, b))
        .map(
          (n) =>
            `<article><h3>${esc(n.name)} · ${esc(items[n.item].name)}</h3><p>${Math.round(distance(me!, n))}m away · map (${n.x}, ${n.z}) · ${resourceAmount(world!, n)}/${n.capacity} available</p>${button('Gather', 'gather', `data-id="${n.id}" ${distance(me!, n) > 10 ? 'disabled' : ''}`)}</article>`,
        )
        .join(
          '',
        )}</div><h3>Where it goes</h3><p>Logs → sawmill → timber → furniture. Stone and gravel → concrete works. Topsoil → brick kiln or composting yard. Gravel drains farm plots; topsoil and compost restore soil. Sell to a funded business or carry materials to your own stockroom.</p>`,
      true,
    );
    return;
  }
  if (panel === 'inventory' || panel === 'skills') {
    modal(
      panel === 'inventory' ? 'The things you carry.' : 'A few useful qualifications.',
      panel === 'inventory'
        ? `<p>${carry(me)} of ${vehicles[me.vehicle].capacity} capacity · ${esc(vehicles[me.vehicle].name)}</p><div class="item-list">${Object.entries(
            me.inventory,
          )
            .filter(([, n]) => n)
            .map(
              ([id, n]) =>
                `<div><span><b>${esc(items[id]?.name ?? id)}</b><small>${items[id]?.weight ?? 0} weight each</small></span><strong>${n}</strong>${button(items[id]?.fuel ? 'Refuel' : items[id]?.food || items[id]?.drink ? 'Use' : 'Equipment', 'use', `data-id="${id}" ${!items[id]?.food && !items[id]?.drink && !items[id]?.fuel ? 'disabled' : ''}`)}</div>`,
            )
            .join(
              '',
            )}</div>${button('Switch to walking', 'walk')}${button('Return to tractor', 'tractor')}${button('Toggle robocrow', 'crow')}`
        : `<p>${me.skills.length} of ${world.settings.maxSkills} skill slots used.</p>${me.skills.map((s) => `<div class="notice">${esc(s)} · Qualified</div>`).join('') || '<p>No qualifications yet. A visit to the school should sort that out.</p>'}${me.learning ? `<p>Learning ${esc(me.learning.skill)} · ${Math.ceil((me.learning.end - world.time) / 60)} minutes remaining</p>` : ''}<p>Employment: ${esc(world.buildings.find((b) => b.id === me!.job)?.name ?? 'Between opportunities')}</p>${me.job ? button('Quit job', 'quit') : ''}`,
    );
    return;
  }
  if (panel === 'directory') {
    modal(
      'Parish directory.',
      `<p>Find a building on the map, drive up, and press E. Transactions require you to be within 18 metres.</p><div class="directory">${world.buildings.map((b) => `<button data-do="building" data-id="${b.id}"><span><b>${esc(b.name)}</b><small>${esc(b.kind)} · ${b.owner ? (b.government ? 'Public service' : 'Player owned') : 'For sale ' + money(b.price)}</small></span><span>${Math.round(distance(me!, b))} m ↗</span></button>`).join('')}</div>`,
    );
    return;
  }
  if (panel === 'activities') {
    modal(
      'An entirely productive afternoon.',
      `${world.settings.fighting ? `<h3>Combat arena</h3><p>Balanced Rust and Moss teams. Keys 1–6 select weapons, Tab fires; hold and release Tab to charge javelins. Safe zones and teammates are protected. ${world.settings.weaponMode === 'ammo' ? 'Ammunition is limited per life; garage refits cost 25d.' : 'Weapons use regenerating energy.'} Win at 10 kills, 120 capture seconds or 3 flags; rounds last ten minutes.</p><div class="button-row">${button('Team deathmatch', 'joinCombat', 'data-id="deathmatch"')}${button('Capture point', 'joinCombat', 'data-id="capture"')}${button('Capture the flag', 'joinCombat', 'data-id="ctf"')}</div>${world.combat ? `<p>${world.combat.mode} · Rust ${Math.floor(world.combat.scores[0])} : ${Math.floor(world.combat.scores[1])} Moss · round ${world.combat.round}</p>` : ''}` : ''}<div class="activity-list"><article><span>01 / TEAM SPORT</span><h3>Hornball</h3><p>Two teams. One oversized ball. Honk within 22 metres to push it into the other goal. Rust ${world.scores[0]} : ${world.scores[1]} Moss.</p>${button('Join Hornball', 'joinGame', 'data-id="hornball"')}</article><article><span>02 / MOTORISED OPTIMISM</span><h3>Puddlewick circuit</h3><p>A three-second countdown, four checkpoints, and your tractor. Pass through each gate in order.</p>${button('Start a lap', 'joinGame', 'data-id="race"')}<small>${Object.entries(
        world.raceBest,
      )
        .map(([n, t]) => `${esc(n)} ${t.toFixed(1)}s`)
        .join(
          ' · ',
        )}</small></article><article><span>03 / MOSTLY WAITING</span><h3>Fishing</h3><p>Bring tackle. Cast from the dock. Reel when the “Fish!” prompt appears. The fish has eight seconds of patience.</p>${button('Cast a line', 'joinGame', 'data-id="fishing"')}${button('Reel in', 'reel')}</article><article><span>04 / QUESTIONABLE REGULATIONS</span><h3>Ultrakricket</h3><p>Two players: the first bowls, the second bats. Strike three seconds after the delivery. Miss, and the grenade objects.</p>${button('Join the pitch', 'joinGame', 'data-id="kricket"')}${button('Bowl / swing', 'kricket')}</article></div>${button('Leave current activity', 'leaveGame')}`,
      true,
    );
    return;
  }
  if (panel === 'construction') {
    modal(
      'Build something useful.',
      `<p>Civilization tier ${world.tier}. Structures cost cash plus town tax. Supply wood and stone blocks to finish construction. Stand on clear ground first.</p><label>Cottage style<select id="cottage-style">${appearance.cottages.map((s) => `<option value="${s.id}">${s.name} · ${s.siding} siding</option>`).join('')}</select></label><p class="note">Choose a style above, then choose Small cottage below. All cottage styles cost the same and keep human-sized doors and windows.</p><div class="directory">${Object.entries(
        definitions,
      )
        .filter(([, d]) => d.tier <= world!.tier)
        .map(
          ([id, d]) =>
            `<button data-do="construct" data-id="${id}"><span><b>${esc(d.name)}</b><small>${Object.entries(
              d.materials,
            )
              .map(([i, n]) => `${n} ${items[i].name}`)
              .join(
                ' + ',
              )}</small></span><b>${money(Math.round(d.price * (1 + world!.towns[0].tax)))}</b></button>`,
        )
        .join('')}</div>`,
    );
    return;
  }
  if (panel === 'editor') {
    editorWindow();
    return;
  }
  if (panel === 'menu') {
    modal(
      'Parish business.',
      `<div class="menu-grid">${button('Directory', 'directory')}${button('Inventory', 'inventory')}${button('Qualifications', 'skills')}${button('Activities', 'activities')}${button('Construction', 'construction')}${button('World editor', 'editor')}${button('Options & pilot key', 'options')}${button('Field guide', 'help')}${button('Return to town centre', 'respawn')}${button('Leave activity', 'leaveGame')}</div><h3>Noticeboard</h3><p>${esc(world.messages.find((m) => m.name === 'Parish notice')?.text ?? 'No news is respectable news.')}</p><form data-action="group">${select(
        'kind',
        [
          ['tribe', 'Tribe'],
          ['family', 'Family'],
        ],
        'Community',
      )}${field('Group name', 'name', '', 'text', 'required maxlength="32"')}<button>Join / create group</button></form><p class="note">Take off from the spaceport to visit another world. Your businesses stay behind and continue producing.</p>`,
    );
    return;
  }
}
function buildingWindow(b: Building) {
  if (!me || !world) return;
  const near = distance(me, b) < 18,
    owned = b.owner === me.id || me.authority === 20;
  const tabs = ['Main', 'Stockroom', 'Building Admin', 'Extra Info'];
  let html = `<div class="building-meta"><span>OWNER <b>${esc(b.government ? 'Parish' : (world.players[b.owner ?? '']?.name ?? (b.owner ? 'Another player' : 'Unclaimed')))}</b></span><span>INVESTMENT <b>${money(b.investment)}</b></span><span>EFFICIENCY <b>${Math.round(b.efficiency * 100)}%</b></span></div>${!near ? '<p class="notice">You are ' + Math.round(distance(me, b)) + ' metres away. Drive closer to trade or use this building.</p>' : ''}<nav class="tabs">${tabs.map((t) => button(t, 'tab', `data-id="${t}"`, t === tab ? 'active' : '')).join('')}</nav>`;
  if (b.construction) {
    html += `<p>Materials still needed: ${Object.entries(b.construction)
      .map(([i, n]) => `${n} ${items[i].name}`)
      .join(
        ', ',
      )}</p>${button('Deliver construction materials', 'supply', `data-building="${b.id}"`)}`;
    modal(b.name, html);
    return;
  }
  if (tab === 'Main') {
    if (Object.keys(b.sell).length || Object.keys(b.buy).length)
      html += `<div class="trade-columns">${(['sell', 'buy'] as const)
        .map(
          (side) =>
            `<section><h3>${side === 'sell' ? 'Items you can buy here' : 'Items we buy from you'}</h3><div class="trade-list">${Object.entries(
              b[side],
            )
              .map(
                ([id, price]) =>
                  `<div class="trade-row"><span><b>${esc(items[id]?.name ?? id)}</b><small>${b.stock[id] ?? 0} / ${b.capacity} in stock</small></span><b>${money(price)}</b><button data-do="trade" data-building="${b.id}" data-item="${id}" data-direction="${side === 'sell' ? 'buy' : 'sell'}" ${!near ? 'disabled' : ''}>${side === 'sell' ? 'Buy' : 'Sell'}</button></div>`,
              )
              .join('')}</div></section>`,
        )
        .join(
          '',
        )}</div><label class="quantity">Quantity per trade<input id="trade-quantity" type="number" min="1" max="10000" value="1"></label>`;
    if (b.kind === 'workhouse')
      html += `<p>Unskilled labour. A 15-second task pays 45d. You will be quite still while working.</p>${button('Work a shift · 45d', 'task', `data-building="${b.id}" data-id="labour"`, 'primary')}`;
    if (b.kind === 'school')
      html += `<p>First qualification: 80d and one minute. Later qualifications: 160d and forty minutes. Up to ${world.settings.maxSkills} skills.</p><div class="menu-grid">${skills.map((s) => button(s, 'learn', `data-id="${s}" data-building="${b.id}" ${me!.skills.includes(s) || me!.learning ? 'disabled' : ''}`)).join('')}</div>`;
    if (b.kind === 'garage')
      html += `<div class="directory">${vehicles
        .slice(0, 6)
        .map((v, i) =>
          button(
            `${esc(v.name)} <span>${(me!.fleet ?? [0, 5]).includes(i) ? 'Owned' : money(v.price)}</span>`,
            'vehicle',
            `data-id="${i}" data-building="${b.id}"`,
            'wide',
          ),
        )
        .join('')}</div>`;
    if (b.kind === 'garage')
      html += `<h3>Tractor paint shop</h3><p>A fresh finish costs ${money(appearance.paintPrice)}. Your choice stays with your tractor when you leave or sign out.</p><div class="paint-options">${appearance.paints.map((p) => `<button data-do="paint" data-id="${p.id}" data-building="${b.id}" ${!near || me!.tractorPaint === p.id ? 'disabled' : ''}><span class="paint-chip" style="background:${p.color}"></span>${esc(p.name)}</button>`).join('')}</div>`;
    if (b.kind === 'farm') {
      html += `<h3>Four plots · ${calendar(world).season}</h3><p>Learn farmer and own this farm or take a job here. Seeds and fertilizer use its investment account. Rain helps irrigation; repeated crop families reduce yield. Harvesting takes 15 seconds. Staff receive the posted wage per harvested plot. Growth continues offline.</p><div class="cards">${Array.from(
        { length: 4 },
        (_, i) => {
          const plot = b.plots?.[i],
            status = cropStatus(world!, b, i);
          const attrs = `data-building="${b.id}" data-plot="${i}"`;
          return `<article><h3>Plot ${i + 1} · ${plot?.crop ? esc(crops[plot.crop].name) : 'Fallow'}</h3>${
            plot?.crop
              ? `<p>${status.state === 'ripe' ? 'Ready to harvest' : `${status.days} game days remaining`} · estimated ${status.yield} units<br>Irrigation ${Math.round(status.water * 100)}% · fertilizer ${plot.fertilized ? '33% bonus' : 'none'}</p>${button('Water · 3 water', 'farm', attrs + ' data-id="water"')}${button('Fertilize · compost or 10d', 'farm', attrs + ' data-id="fertilize"')}${button('Harvest', 'farm', attrs + ' data-id="harvest"')}`
              : `<form data-action="farm">${hidden('building', b.id)}${hidden('plot', String(i))}${hidden('operation', 'plant')}${select(
                  'crop',
                  Object.entries(crops)
                    .filter(([, c]) => c.seasons.includes(calendar(world!).season))
                    .map(([id, c]) => [id, `${c.name} · ${c.days / 6}h · seed ${money(c.seed)}`]),
                )}<button>Plant seeds</button></form>`
          }${!plot?.crop && plot ? button('Drain · 6 gravel', 'farm', attrs + ' data-id="drain"') + button('Restore soil · 6 dirt + compost', 'farm', attrs + ' data-id="improve"') : ''}${plot?.crop ? `<p>${esc(crops[plot.crop].description)}${plot.drainage ? ' Gravel drainage installed.' : ''}</p>` : ''}</article>`;
        },
      ).join(
        '',
      )}</div><p class="note">One day = 10 real minutes. Four seasons span ~61 hours. Harvest within six real hours of ripening for best yield; later crops retain at least 65% of their quality-adjusted yield.</p>`;
    }
    if (b.kind === 'garage' && world.settings.fighting)
      html += button('Refit ammunition · 25d', 'refit', `data-building="${b.id}"`);
    if (b.kind === 'home')
      html += `<p>Stay inside to slow hunger and thirst by 20%. Your home feeds you from its storeroom even while you are offline. Offline ageing and health loss pause, so running out of supplies cannot kill you while away. Your chimney stays active while you are inside.</p>${owned ? button('Go home', 'home', `data-building="${b.id}"`) : ''}`;
    if (roomCount(b)) {
      const l = b.lodging,
        guest = l?.guests[me.id],
        booked = guest && guest.until > world.time;
      html += `<h3>${roomCount(b)} guest rooms</h3><p>${Object.values(l?.guests ?? {}).filter((g) => g.until > world!.time).length} booked · ${money(l?.rate ?? 600)} per real hour · ${l?.open ? 'Accepting guests' : 'Closed to new bookings'}</p><p>Prepaid stays last 1–24 real hours. Enter your room to eat and drink from your personal stores, including offline. Checkout has no refund; your leftover supplies remain collectible. The owner cannot take guest supplies.</p>${booked ? `<p>Your stay: ${Math.ceil((guest.until - world.time) / 60)} minutes left</p>${button('Enter your room', 'home', `data-building="${b.id}"`)}<form data-action="lodging">${hidden('building', b.id)}${hidden('operation', 'checkout')}<button>Check out early</button></form>` : `<form data-action="lodging">${hidden('building', b.id)}${hidden('operation', 'rent')}${field('Real hours', 'hours', 6, 'number', 'min="1" max="24"')}<button ${!l?.open ? 'disabled' : ''}>Book a room</button></form>`}`;
      if (guest)
        html += `<h3>Your room pantry</h3><p>${
          Object.entries(me.roomPantries?.[b.id] ?? guest.stock)
            .filter(([, n]) => n > 0)
            .map(([k, n]) => esc(items[k].name) + ' × ' + n)
            .join(' · ') || 'No provisions stored yet.'
        }</p><form data-action="lodging">${hidden('building', b.id)}${hidden('operation', 'store')}${select(
          'item',
          Object.entries(items)
            .filter(([, d]) => d.food || d.drink)
            .map(([k, d]) => [k, d.name]),
        )}${field('Quantity', 'quantity', 1, 'number', 'min="1" max="100"')}${select('direction', [
          ['deposit', 'Store provisions'],
          ['withdraw', 'Collect provisions'],
        ])}<button>Transfer provisions</button></form>`;
      if (owned)
        html += `<h3>Run your guesthouse</h3><p>Learn innkeeper at school. Booking payments enter Working capital; collect earnings in Building Admin. Closing only stops new bookings.</p><form data-action="lodging">${hidden('building', b.id)}${hidden('operation', 'configure')}${field('Hourly price in denarii', 'rateDenarii', (l?.rate ?? 600) / 100, 'number', 'min="0" max="10000" step="0.01"')}${select(
          'open',
          [
            ['true', 'Accept bookings'],
            ['false', 'Close to new bookings'],
          ],
        )}<button>Save room rates</button></form>`;
    }
    if (b.kind === 'starport')
      html += `<div class="notice">Local cash → galactic credits. ${world.settings.exchangeRate}d buys 1cr. Limit ${world.settings.exchangeCap}cr per real day.</div><form data-action="exchange">${field('Credits to receive', 'amount', 1, 'number', 'min="1" max="100"')}<button>Exchange</button></form>${button('Take off to space', 'takeoff', '', 'primary')}`;
    if (b.kind === 'bank')
      html += `<p>Bank balance: ${money(me.bank)}</p><form data-action="bank">${hidden('building', b.id)}${field('Amount in denarii', 'denarii', 10, 'number', 'min="0.01" step="0.01"')}${select(
        'direction',
        [
          ['deposit', 'Deposit'],
          ['withdraw', 'Withdraw'],
        ],
      )}<button>Transfer</button></form>`;
    if (b.kind === 'town')
      html += `<p>Parish tax: ${Math.round(world.towns[0].tax * 100)}% · Residents: ${world.towns[0].residents.length}</p>${button('Become a resident', 'town', `data-building="${b.id}" data-id="join"`)}${button('Stand for mayor', 'town', `data-building="${b.id}" data-id="stand"`)}<form data-action="town">${hidden('building', b.id)}${hidden('operation', 'tax')}${field('Tax (0–0.5)', 'tax', world.towns[0].tax, 'number', 'min="0" max="0.5" step="0.01"')}<button>Set tax as mayor</button></form>`;
    if (b.kind === 'pub')
      html +=
        '<p>Welcome to The Unsteady Axle. There is beer, a noticeboard, and absolutely no dress code.</p>' +
        button('Parish activities', 'activities');
    if ((!b.owner || b.forSale) && b.owner !== me.id && !b.government)
      html += `<div class="purchase"><span>This building is for sale.<b>${money(b.price)}</b></span>${button('Buy this property', 'buyBuilding', `data-building="${b.id}"`, 'primary')}</div>`;
    if (b.recipe && b.kind !== 'farm') {
      const r = b.production ?? recipes[b.recipe];
      html += `<h3>Production</h3><p>${
        Object.entries(r.inputs)
          .map(([k, n]) => `${n} ${esc(items[k].name)}`)
          .join(' + ') || 'Raw extraction'
      } → ${Object.entries(r.outputs)
        .map(([k, n]) => `${n} ${esc(items[k].name)}`)
        .join(' + ')} · ${productionInterval(world, b) / 60} minutes · ${esc(r.skill)}</p>`;
    }
    if (b.recipe || b.production)
      html += `<div class="employment"><span>Employment · ${money(b.wage)} per ${b.kind === 'farm' ? 'harvested plot' : 'production cycle'} · ${b.employees.length}/16 workers</span>${button(me.job === b.id ? (b.kind === 'farm' ? 'Refresh farm shift' : 'Work two cycles') : 'Take this job', me.job === b.id ? 'work' : 'job', `data-building="${b.id}"`)}</div>`;
    if (['sawmill', 'quarry', 'forge'].includes(b.kind))
      html += button(
        b.kind === 'forge' ? 'Craft tools (1 steel + 2 wood)' : 'Gather raw materials',
        b.kind === 'forge' ? 'task' : 'resources',
        `data-building="${b.id}" data-id="${b.kind === 'sawmill' ? 'logging' : b.kind === 'quarry' ? 'quarrying' : 'craft'}"`,
      );
  }
  if (tab === 'Stockroom')
    html += owned
      ? `<p>Transfer between your vehicle and the building. Storage limit: ${b.capacity} per item.</p><form data-action="stock">${hidden('building', b.id)}${select(
          'item',
          Object.entries(items).map(([id, d]) => [
            id,
            `${d.name} · stock ${b.stock[id] ?? 0} / carrying ${me!.inventory[id] ?? 0}`,
          ]),
        )}${field('Quantity', 'quantity', 1, 'number', 'min="1"')}${select('direction', [
          ['deposit', 'Store items'],
          ['withdraw', 'Collect items'],
        ])}<button>Transfer stock</button></form>`
      : '<p>The stockroom belongs to the owner. Use the trade window instead.</p>';
  if (tab === 'Building Admin')
    html += owned
      ? `<div class="admin-grid"><form data-action="investment">${hidden('building', b.id)}<h3>Working capital</h3>${field('Denarii', 'denarii', 50, 'number', 'min="0.01" step="0.01"')}${select(
          'direction',
          [
            ['deposit', 'Invest cash'],
            ['withdraw', 'Collect earnings'],
          ],
        )}<button>Transfer cash</button></form><form data-action="buildingAdmin">${hidden('building', b.id)}<h3>Business details</h3>${field('Building name', 'name', b.name, 'text', 'maxlength="48"')}${field('Wage in denarii', 'wageDenarii', b.wage / 100, 'number', 'min="0" step="0.01"')}<button>Save details</button></form><form data-action="buildingAdmin">${hidden('building', b.id)}<h3>Set trading prices</h3>${select(
          'item',
          Object.entries(items).map(([id, d]) => [id, d.name]),
        )}${select('side', [
          ['buy', 'Building buys'],
          ['sell', 'Building sells'],
        ])}${field('Denarii per item', 'priceDenarii', 10, 'number', 'min="0" step="0.01"')}<button>Set price</button></form></div>`
      : '<p>Only the owner may manage this building.</p>';
  if (tab === 'Building Admin' && owned && !b.government)
    html += `<form data-action="listProperty">${hidden('building', b.id)}<h3>Sell this property</h3><p>Stock and investment stay with the business. The purchase price is paid directly to you.</p>${field('Asking price in denarii', 'priceDenarii', b.price / 100, 'number', 'min="0.01" step="0.01"')}<button>List property for sale</button></form>`;
  if (tab === 'Extra Info')
    html += `<p>Building condition: ${b.condition.toFixed(1)}%. Government properties do not decay.</p><p>Production needs input stock, output space, and enough investment to pay wages. Active workers give full efficiency. Unstaffed businesses run at ${world.settings.offlineEfficiency * 100}%.</p>${owned ? button('Repair building', 'repair', `data-building="${b.id}"`) + button('Demolish building', 'demolish', `data-building="${b.id}"`) : ''}${me.job === b.id ? button('Quit job', 'quit') : ''}`;
  modal(b.name, html, true);
}
function editorWindow() {
  if (!world || !me) return;
  if (me.authority < 20) {
    modal(
      'World editor.',
      `<p>This world belongs to its caretaker. Create your own world to edit its terrain, rules, buildings and scripts.</p>${button('Create your own world', 'create', '', 'primary')}`,
    );
    return;
  }
  if (tab === 'Vehicles' || tab === 'Production') {
    const navigation = `<nav class="tabs">${['Rules', 'Landscape', 'Buildings', 'Production', 'Vehicles', 'Zones', 'Script', 'Assets', 'Ledger'].map((t) => button(t, 'tab', `data-id="${t}"`, tab === t ? 'active' : '')).join('')}</nav>`;
    modal(
      'Your world. Your peculiar rules.',
      navigation +
        (tab === 'Vehicles'
          ? `<p>Tune any of the 24 vehicle slots. Physics updates apply to everyone on this world.</p><form data-action="vehicleTuning">${select(
              'slot',
              vehicles.map((v, i) => [String(i), `${i + 1}. ${v.name}`]),
              'Vehicle slot',
            )}${field('Top speed (m/s)', 'speed', 13, 'number', 'min="1" max="100"')}${field('Acceleration', 'acceleration', 6, 'number', 'min="1" max="50"')}${field('Turn rate', 'turn', 1.7, 'number', 'min="0.1" max="6" step="0.1"')}${field('Armour percent', 'armour', 100, 'number', 'min="10" max="1000"')}${field('Fuel per second', 'fuel', 0.012, 'number', 'min="0" max="1" step="0.001"')}<button>Apply vehicle physics</button></form>`
          : `<p>Stand near the building to edit its production. Inputs and outputs are item-id to quantity maps. Outputs must fit its storage capacity.</p><form data-action="production">${select(
              'building',
              world.buildings.map((b) => [b.id, b.name]),
              'Building',
            )}${field('Inputs (JSON)', 'inputs', '{"wheat":5}')}${field('Outputs (JSON)', 'outputs', '{"flour":3}')}${field('Cycle seconds', 'seconds', 600, 'number', 'min="10" max="86400"')}${select(
              'skill',
              skills.map((s) => [s, s]),
              'Required profession',
            )}<button>Apply production recipe</button></form>`),
      true,
    );
    return;
  }
  modal(
    'Your world. Your peculiar rules.',
    `<nav class="tabs">${['Rules', 'Landscape', 'Buildings', 'Production', 'Vehicles', 'Zones', 'Script', 'Assets', 'Ledger'].map((t) => button(t, 'tab', `data-id="${t}"`, tab === t || (tab === 'Main' && t === 'Rules') ? 'active' : '')).join('')}</nav>${
      tab === 'Main' || tab === 'Rules'
        ? `<p>Changes apply live to everyone. Tune cautiously; people have businesses here.</p><form id="settings-form"><div class="settings-grid">${Object.entries(
            world.settings,
          )
            .map(([k, v]) =>
              typeof v === 'boolean'
                ? `<label class="check"><input name="${k}" type="checkbox" ${v ? 'checked' : ''}>${k}</label>`
                : k === 'weaponMode'
                  ? select(
                      k,
                      [
                        ['energy', 'Energy weapons'],
                        ['ammo', 'Ammunition per life'],
                      ],
                      k,
                    )
                  : field(k, k, v, 'number', 'step="any"'),
            )
            .join('')}</div><button class="primary">Apply changes to server</button></form>`
        : tab === 'Landscape'
          ? `<p>Raise or lower a circular area of the shared 128 × 128 heightmap. Coordinates run −250 to 250.</p><form data-action="terrain">${field('X', 'x', Math.round(me.x), 'number')}${field('Z', 'z', Math.round(me.z), 'number')}${field('Brush radius', 'radius', 20, 'number', 'min="1" max="100"')}${field('Height change', 'height', 5, 'number', 'min="-30" max="30"')}<button>Apply terrain brush</button></form>`
          : tab === 'Buildings'
            ? `<form data-action="place">${select(
                'kind',
                Object.entries(definitions).map(([id, d]) => [id, d.name]),
                'Building type',
              )}${field('X', 'x', Math.round(me.x), 'number')}${field('Z', 'z', Math.round(me.z), 'number')}<button>Place building</button></form><p>Open the building's Admin tab to edit its prices, wages and stocks.</p>`
            : tab === 'Zones'
              ? `<form data-action="zone">${select(
                  'kind',
                  [
                    ['safe', 'Safe zone (weapons disabled)'],
                    ['noBuild', 'No construction'],
                    ['spawn', 'Spawn marker'],
                    ['game', 'Game marker'],
                    ['script', 'Script marker'],
                    ['vehicle', 'Vehicle marker'],
                  ],
                  'Zone type',
                )}${field('X', 'x', Math.round(me.x), 'number')}${field('Z', 'z', Math.round(me.z), 'number')}${field('Radius', 'radius', 20, 'number', 'min="1" max="100"')}<button>Place zone</button></form><p>${world.zones.map((z) => esc(`${z.kind} at ${z.x}, ${z.z} (${z.radius}m)`)).join(' · ')}</p>`
              : tab === 'Script'
                ? `<p>Sandboxed Lua. Events: PlayerLogin, ScriptReload, TaskStart. Functions: on, announce, getvar, setvar, kudos. Memory, instruction and time limits enforced.</p><form id="script-form"><label>World script<textarea name="source" aria-label="World script" rows="14" spellcheck="false">${esc(world.script)}</textarea></label><button>Validate & reload Lua</button></form>`
                : tab === 'Assets'
                  ? `<p>Upload original PNG, JPEG, MP3 or GLB assets (2 MiB each, 32 per world). Uploaded media is cached by each client. Select an asset below to preview it.</p><form id="asset-form"><input name="file" type="file" accept="image/png,image/jpeg,audio/mpeg,.glb" required><button>Upload asset</button></form><div class="asset-list">${world.assets.map((a) => (a.type.startsWith('image/') ? `<figure><img src="${esc(withBase(a.url))}" alt="${esc(a.name)}"><figcaption>${esc(a.name)}</figcaption></figure>` : a.type.startsWith('audio/') ? `<label>${esc(a.name)}<audio controls src="${esc(withBase(a.url))}"></audio></label>` : `<a href="${esc(withBase(a.url))}" download>${esc(a.name)} · GLB</a>`)).join('')}</div>`
                  : `<p>Recent money movements. Internal units are hundredths of a denarius.</p><div class="ledger">${world.ledger
                      .slice(-25)
                      .reverse()
                      .map(
                        (l) =>
                          `<div><b>${esc(l.kind)}</b><span>${esc(l.reason)}</span><strong>${money(l.amount)}</strong></div>`,
                      )
                      .join('')}</div>${button('Download ledger JSON', 'ledger')}`
    }`,
    true,
  );
}
app.addEventListener('click', async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-do]');
  if (!el) return;
  const action = el.dataset.do!,
    id = el.dataset.id,
    building = el.dataset.building;
  try {
    const panels = [
      'menu',
      'directory',
      'help',
      'options',
      'shipyard',
      'inventory',
      'skills',
      'resources',
      'activities',
      'construction',
      'editor',
      'create',
    ];
    if (panels.includes(action)) {
      openPanel(action);
      return;
    }
    switch (action) {
      case 'close':
        closePanel();
        break;
      case 'galaxy':
        closePanel();
        void showGalaxy();
        break;
      case 'tab':
        tab = id!;
        renderPanel();
        break;
      case 'building':
        selected = id!;
        openPanel('building');
        break;
      case 'land':
        send({ type: 'land', world: id });
        break;
      case 'jump':
        send({ type: 'jump', system: id });
        break;
      case 'upgrade':
        send({ type: 'upgrade', kind: id });
        break;
      case 'courier':
        send({ type: 'courier', operation: id });
        break;
      case 'ship':
        send({ type: 'ship', ship: id });
        closePanel();
        break;
      case 'camera':
        scene.cameraMode = (scene.cameraMode + 1) % 3;
        toast(['Chase camera', 'First person', 'Overhead camera'][scene.cameraMode]);
        break;
      case 'horn':
        tone(130);
        send({ type: 'horn' });
        break;
      case 'use':
        send({ type: 'use', item: id });
        break;
      case 'trade':
        send({
          type: 'trade',
          building,
          item: el.dataset.item,
          quantity: Number(
            (document.getElementById('trade-quantity') as HTMLInputElement)?.value ?? 1,
          ),
          direction: el.dataset.direction,
        });
        break;
      case 'vehicle':
        send({ type: 'vehicle', slot: Number(id), building });
        break;
      case 'walk':
      case 'tractor':
        send({ type: 'vehicle', slot: action === 'walk' ? 5 : 0 });
        closePanel();
        break;
      case 'learn':
        send({ type: 'learn', skill: id, building });
        break;
      case 'gather':
        send({ type: 'gather', node: id });
        closePanel();
        break;
      case 'task':
        send({ type: 'task', building, task: id });
        closePanel();
        break;
      case 'town':
        send({ type: 'town', building, operation: id });
        break;
      case 'farm':
        send({ type: 'farm', building, plot: Number(el.dataset.plot), operation: id });
        break;
      case 'paint':
        send({ type: 'paint', building, color: id });
        break;
      case 'construct':
        send({
          type: 'construct',
          kind: id,
          ...(id === 'home'
            ? { style: (document.getElementById('cottage-style') as HTMLSelectElement).value }
            : {}),
        });
        closePanel();
        break;
      case 'joinCombat':
        send({ type: 'joinCombat', mode: id });
        closePanel();
        break;
      case 'joinGame':
        send({ type: 'joinGame', game: id });
        closePanel();
        break;
      case 'sound':
        sound = !sound;
        localStorage.setItem('aclone.sound', sound ? 'on' : 'off');
        tone(220);
        renderPanel();
        break;
      case 'quality':
        localStorage.setItem(
          'aclone.quality',
          localStorage.getItem('aclone.quality') === 'low'
            ? 'balanced'
            : localStorage.getItem('aclone.quality') === 'high'
              ? 'low'
              : 'high',
        );
        location.reload();
        break;
      case 'resendEmail':
        await api('/api/auth/resend', { method: 'POST', body: '{}' });
        toast('Check your email. Verification links can be resent once a minute.');
        break;
      case 'logout':
        await api('/api/auth/logout', { method: 'POST', body: '{}' });
        token = '';
        account = undefined;
        accountStatus = undefined;
        world = undefined;
        me = undefined;
        localStorage.removeItem('aclone.pilot');
        localStorage.removeItem('aclone.world');
        ws?.close();
        closePanel();
        login();
        break;
      case 'exportKey':
        download(
          'aclone-pilot-key.txt',
          `Aclone pilot: ${account?.name}\nKeep this key private. Paste it into Restore pilot.\n\n${token}\n`,
        );
        break;
      case 'ledger':
        download(
          'aclone-ledger.json',
          JSON.stringify(await api('/api/ledger/' + world!.id), null, 2),
        );
        break;
      default:
        send({ type: action, ...(building ? { building } : {}) });
        if (['takeoff', 'home', 'outside'].includes(action)) closePanel();
    }
  } catch (e) {
    toast((e as Error).message, true);
  }
});
app.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target as HTMLFormElement,
    data = Object.fromEntries(new FormData(form).entries());
  try {
    if (form.id === 'register-form') {
      const result = await api('/api/register', { method: 'POST', body: JSON.stringify(data) });
      token = result.token;
      account = result.account;
      localStorage.setItem('aclone.pilot', token);
      await connect();
    } else if (form.id === 'signin-form') {
      const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });
      token = result.token;
      account = result.account;
      localStorage.setItem('aclone.pilot', token);
      localStorage.removeItem('aclone.world');
      await connect();
    } else if (form.id === 'account-form') {
      accountStatus = await api('/api/auth/configure', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      toast(
        accountStatus?.deliveryError
          ? 'Password saved, but email delivery failed. Use Resend verification email to retry.'
          : accountStatus?.email && !accountStatus.verified
            ? 'Password saved. Check your email for the verification link.'
            : 'Password saved. You can now sign in by name.',
      );
      renderPanel();
    } else if (form.id === 'forgot-form') {
      const result = await api('/api/auth/forgot', { method: 'POST', body: JSON.stringify(data) });
      toast(result.message);
      form.reset();
    } else if (form.id === 'recovery-form') {
      await api(recovery.has('reset') ? '/api/auth/reset' : '/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ ...data, token: recoveryToken }),
      });
      if (recovery.has('reset')) {
        token = '';
        localStorage.removeItem('aclone.pilot');
      }
      login();
      toast(
        recovery.has('reset')
          ? 'Password reset. Sign in with your new password.'
          : 'Email verified. You can now use email recovery.',
      );
    } else if (form.id === 'restore-form') {
      token = String(data.key).trim();
      const r = await api('/api/session');
      account = r.account;
      localStorage.setItem('aclone.pilot', token);
      localStorage.removeItem('aclone.world');
      await connect();
    } else if (form.id === 'chat-form') {
      const text = String(data.message).trim();
      if (text) send({ type: 'chat', text });
      form.reset();
      (form.querySelector('input') as HTMLInputElement).blur();
    } else if (form.id === 'create-form') {
      const result = await api('/api/worlds', { method: 'POST', body: JSON.stringify(data) });
      toast('Your world is ready. Find it in the Hearth system.');
      closePanel();
      if (inSpace) {
        await showGalaxy();
        if (account?.system === 'hearth') send({ type: 'land', world: result.id });
      } else toast('World created. Take off from the spaceport to visit it.');
    } else if (form.id === 'settings-form') {
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(world!.settings))
        patch[k] =
          typeof v === 'boolean'
            ? data[k] === 'on'
            : typeof v === 'string'
              ? String(data[k])
              : Number(data[k]);
      send({ type: 'settings', patch });
      (document.activeElement as HTMLElement)?.blur();
    } else if (form.id === 'script-form') {
      send({ type: 'script', source: String(data.source) });
      (document.activeElement as HTMLElement)?.blur();
    } else if (form.id === 'asset-form') {
      const file = data.file as File;
      const response = await fetch(withBase('/api/assets/' + world!.id), {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + token,
          'content-type': file.type || 'model/gltf-binary',
          'x-asset-name': encodeURIComponent(file.name),
        },
        body: file,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      toast('Asset uploaded.');
    } else if (form.dataset.action) {
      const values: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) {
        values[k] = [
          'plot',
          'hours',
          'rate',
          'quantity',
          'amount',
          'tax',
          'x',
          'z',
          'radius',
          'height',
          'slot',
          'speed',
          'acceleration',
          'turn',
          'armour',
          'fuel',
          'seconds',
        ].includes(k)
          ? Number(v)
          : k === 'buy' || k === 'open'
            ? v === 'true'
            : v;
      }
      if (data.rateDenarii !== undefined) {
        values.rate = Math.round(Number(data.rateDenarii) * 100);
        delete values.rateDenarii;
      }
      if (data.inputs !== undefined) values.inputs = JSON.parse(String(data.inputs));
      if (data.outputs !== undefined) values.outputs = JSON.parse(String(data.outputs));
      if (data.denarii !== undefined) {
        values.amount = Math.round(Number(data.denarii) * 100);
        delete values.denarii;
      }
      if (data.wageDenarii !== undefined) {
        values.wage = Math.round(Number(data.wageDenarii) * 100);
        delete values.wageDenarii;
      }
      if (data.priceDenarii !== undefined) {
        values.price = Math.round(Number(data.priceDenarii) * 100);
        delete values.priceDenarii;
      }
      send({ type: form.dataset.action, ...values });
      (document.activeElement as HTMLElement)?.blur();
    }
  } catch (e) {
    toast((e as Error).message, true);
  }
});
function download(name: string, content: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('brand-button').addEventListener('click', () => openPanel(world ? 'menu' : 'options'));
scene.onBuilding = (id) => {
  selected = id;
  openPanel('building');
};
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).matches('input,textarea,select')) {
    if (e.key === 'Escape') (e.target as HTMLElement).blur();
    return;
  }
  // Let focused buttons use their native activation instead of honking or opening chat.
  if ((e.target as HTMLElement).closest('button') && [' ', 'Enter'].includes(e.key)) return;
  if (e.key === 'Escape') {
    document.documentElement.classList.remove('scenery-view');
    closePanel();
    return;
  }
  if (e.repeat) return;
  if (panel && e.key === 'Tab') {
    const controls = [
      ...$('modal-host').querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, select, textarea, summary, a[href]',
      ),
    ];
    if (controls.length) {
      e.preventDefault();
      const index = controls.indexOf(document.activeElement as HTMLElement);
      controls[(index + (e.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
    }
    return;
  }
  const key = e.key.toLowerCase();
  if (key === 'h' && world && !panel) {
    document.documentElement.classList.toggle('scenery-view');
    toast(
      document.documentElement.classList.contains('scenery-view')
        ? 'Scenery view · H or Escape restores the controls.'
        : 'Controls restored.',
    );
    return;
  }
  const handled = [
    'arrowup',
    'arrowdown',
    'arrowleft',
    'arrowright',
    ' ',
    'tab',
    'control',
    'insert',
    'delete',
    'f2',
    'f3',
    'f4',
    'f5',
    'f7',
    'f9',
    'f10',
  ];
  if (handled.includes(key)) e.preventDefault();
  keys.add(e.key);
  if (key === 'enter' || key === 'f2') {
    $('chat-input').focus();
    return;
  }
  if (key === 'f7') {
    openPanel('help');
    return;
  }
  if (key === 'f10') {
    openPanel('editor');
    return;
  }
  if (key === 'f9') {
    openPanel('menu');
    return;
  }
  if (key === 'm') {
    openPanel('directory');
    return;
  }
  if (key === 'i') {
    openPanel('inventory');
    return;
  }
  if (!world || panel) return;
  if (key === 'e' || key === 'control') {
    const b = scene.nearest();
    if (b) {
      selected = b.id;
      openPanel('building');
    }
  }
  if (key === 'f4') send({ type: 'engine' });
  if (key === 'l') send({ type: 'lights' });
  if (key === 'f5' || key === 'r') send({ type: 'crow' });
  if (key === 'f3') send({ type: 'reel' });
  if (key === 'c') scene.cameraMode = (scene.cameraMode + 1) % 3;
  if (key === ' ' || key === 'tab') {
    if (key === 'tab' && world.settings.fighting) {
      if (!e.repeat) send({ type: weapon === 'javelin' ? 'chargeWeapon' : 'fire', weapon });
      tone(60, 0.08);
    } else {
      send({ type: 'horn' });
      tone(130);
    }
  }
  if (['1', '2', '3', '4', '5', '6'].includes(key)) {
    weapon = Object.keys(weapons)[Number(key) - 1];
    toast('Selected ' + weapons[weapon].name);
  }
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.key);
  if (e.key === 'Tab' && weapon === 'javelin' && world && !panel) send({ type: 'fire', weapon });
});
window.addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) keys.clear();
});
for (const b of document.querySelectorAll<HTMLElement>('[data-key]')) {
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    keys.add(b.dataset.key!);
    b.setPointerCapture(e.pointerId);
  });
  b.addEventListener('pointerup', () => keys.delete(b.dataset.key!));
  b.addEventListener('pointercancel', () => keys.delete(b.dataset.key!));
}
setInterval(() => {
  if (!world || !ws || ws.readyState !== WebSocket.OPEN) return;
  const typing = panel || document.activeElement?.matches('input,textarea,select');
  const held = (...list: string[]) => !typing && list.some((k) => keys.has(k));
  ws.send(
    JSON.stringify({
      type: 'input',
      input: {
        throttle: Number(held('ArrowUp', 'w', 'W')) - Number(held('ArrowDown', 's', 'S')),
        steer: Number(held('ArrowLeft', 'a', 'A')) - Number(held('ArrowRight', 'd', 'D')),
        boost: held('Shift'),
        lift: Number(held('Insert')) - Number(held('Delete')),
      },
    }),
  );
}, 50);
setInterval(() => {
  const timer = document.getElementById('jump-countdown');
  if (timer && account?.transit)
    timer.textContent = String(Math.max(0, Math.ceil(account.transit.arrives - Date.now() / 1000)));
}, 500);
setInterval(() => {
  if (ws?.readyState === WebSocket.OPEN)
    ws.send(JSON.stringify({ type: 'ping', at: performance.now() }));
}, 5000);
if (recoveryToken) {
  login();
  const card = document.querySelector('.login-card')!;
  card.innerHTML = `<h2>${recovery.has('reset') ? 'Choose a new password' : 'Verify your recovery email'}</h2><form id="recovery-form">${recovery.has('reset') ? '<label>New password<input type="password" name="password" minlength="12" maxlength="128" required autocomplete="new-password"></label>' : '<p>Confirm that you want this address to recover your Aclone pilot.</p>'}<button class="primary">${recovery.has('reset') ? 'Reset password' : 'Verify email'}</button></form>`;
} else if (token) {
  api('/api/session')
    .then((r) => {
      account = r.account;
      void connect();
    })
    .catch(() => {
      token = '';
      login();
    });
} else login();
