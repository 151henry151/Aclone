import { itemEntries } from './item-order';
import { earthworkGuidance } from '../shared/earthworks-work';
import { garageStoragePanel } from './garage-storage-panel';
import { earthworksPanel, mountEarthworksPanel } from './earthworks-panel';
import { isEarthmover } from '../shared/earthmoving-definitions';
import { HIGHWAY_TRACTOR } from '../shared/highway-definitions';
import { manufacturingPanel, refreshManufacturing } from './automotive-panel';
import { automotiveConfig } from '../shared/automotive-config';
import { bridgePanel, mountBridgePanel, type BridgeDraft } from './bridge-panel';
import { boardingPanel, boardingReason } from './parking-status';
import { GARAGE_STORAGE } from '../shared/parked-vehicles';
import { parkingStatus, tractorWaypoint } from './parking-status';
import { persistentVehicles } from '../shared/parked-vehicles';
import { waterSourceRules } from '../shared/water-source-rules';
import { springPanel, refreshSpringPanel } from './spring-panel';
import { marineSafetyPanel } from './marine-safety-panel';
import { ROWBOAT, rowboatRules } from '../shared/rowboat-rules';
import { freightPanel } from './freight-panel';
import { communicationRules } from '../shared/communication-rules';
import { boatNavigationRules } from '../shared/boat-navigation-rules';
import { vehicleRunningRules } from '../shared/vehicle-running-rules';
import { fishingRules } from '../shared/fishing-rules';
import { meanBiteWait } from '../shared/boat-fishing';
import { farmYieldRules, cropFrostKeys } from '../shared/farm-yield-rules';
import { gatheringImplements } from '../shared/resources';
import { constructionRefundPercentage, constructionRules } from '../shared/construction-rules';
import { charterRules } from '../shared/charter-rules';
import { economyRules, lighthouseWage } from '../shared/economy-rules';
import { survivalRules, skillFits, skillSlotsUsed } from '../shared/survival-rules';
import { RadioConsole } from './radio-console';
import { CANOE } from '../shared/canoe-rules';
import { canoePanel } from './canoe-panel';
import { fuelPanel } from './fuel-panel';
import { alpineWeather } from '../shared/alpine-weather';
import { tenderOf } from '../shared/boat-tender';
import { trailerPanel } from './trailer-panel';
import { towingPanel } from './towing-panel';
import { TUGBOAT, MOTORBOAT } from '../shared/boats';
import { hasMotor } from '../shared/vehicle-config';
import { waterDepth } from '../shared/fishing-water';
import { HudPanels, hudPanels, type HudPanel } from './hud-panels';
import { FrameInbox } from './frame-inbox';
import { vehicleForm } from './vehicle-editor';
import { isTrawler } from '../shared/vehicle-config';
import { vehicleDef } from '../shared/vehicle-config';
import { livestockPanel, butcherPanel, meatMenuPanel, homeCookingPanel } from './meat-panels';
import { rawMeats } from '../shared/meat-recipes';
import { productionRecipe } from '../shared/production-recipe';
import { charterPanel } from './charter-panel';
import { CHARTER_BOAT, throttleBoat } from '../shared/boats';
import { fishingVessel } from '../shared/boat-fishing';
import { farmPolicyEditor, farmPolicySummary, farmPolicyFormValue } from './farm-policy';
import { farmStaffBlocker } from '../shared/farm-policy';
import { debtStatusHtml, debtNotice, loanStatusHtml } from './debt-status';
import { bulkDiscountEditor, bulkDiscountFormValue, bulkDiscountSummary } from './bulk-discounts';
import { bulkPurchaseQuote } from '../shared/bulk-discounts';
import { waterLevel } from '../shared/ocean';
import { homeProvisionsStatus } from './home-provisions';
import { mapWaterPath } from './map-water';
import { expeditionPanel, boatLightingPanel } from './fishing-expedition-panel';
import { seafoodKitchens } from '../shared/seafood';
import { poweredBoat, boatSlot, FISHING_BOAT } from '../shared/boats';
import { trawlParameters } from '../shared/commercial-fishing';
import { trawlStatus as fishingTrawlStatus, TrawlCapacityAlerts } from './trawl-status';
import { nauticalHeadingLabel } from './nautical-heading';
import { boatLandings, boatLanding, nearBoathouse, landingAccepts } from '../shared/boathouse';
import { riverDockAccepts } from '../shared/river-dock';
import { LIFEBOAT, reboardReason } from '../shared/boat-rescue';
import { deepBoatFishing } from '../shared/boat-fishing';
import { aircraftCount, hasAircraftHangar } from '../shared/airfield';
import { aircraftInput } from './flight-controls';
import { flightRules } from '../shared/flight-rules';
import { tractorShopHtml, mountTractorShop, vehiclePaintShop } from './tractor-shop';
import { fuelCapacity, returnTractor, isTractor } from '../shared/tractors';
import { onlineInventory } from '../shared/automatic-provisions';
import type { PlaytimeStatistics } from '../shared/player-statistics';
import { staffingPanel, economicsPanel } from './staffing-panel';
import { hiringLimit, jobVacancy } from '../shared/staffing';
import { taxesPanel, taxSummary, tradeQuoteText } from './tax-info';
import { contractPanel } from './property-contracts';
import { coursesPanel } from './courses';
import { firstSteps } from '../shared/first-steps';
import { Controller } from './controller';
import { buildMenuHtml, mountBuildMenu } from './build-menu';
let bridgeDraft: BridgeDraft | undefined;
let bridgePanelSignature = '';
const bridgeStateSignature = () =>
  world && me
    ? JSON.stringify([
        me.bridgeSurvey,
        me.cash,
        me.inventory,
        me.bridgePasses,
        Math.round(me.x),
        Math.round(me.z),
        world.bridges?.map((b) => [b.id, b.revision, b.completedAt]),
        world.settings.bridgeBuilding,
        world.settings.bridgePublicAccess,
        world.settings.bridgeToll,
      ])
    : '';
let closeBuildPreview: (() => void) | undefined;
import { labourQuote, labourShiftPay, labourDailyCap } from '../shared/public-labour.ts';
import { actionVisible, refreshActionVisibility } from './action-visibility';
import { farmPlotCount, farmExpansionCost, farmExpansionBlocker } from '../shared/farm-land';
import { constructionRefund } from '../shared/construction';
import { crowClasses } from '../shared/robocrows';
import { lotteryPanel } from './lottery';
import { townEventsPanel } from './story-editor';
import { texturePainterMarkup, mountTexturePainter } from './texture-painter';
import { rulesSummary } from '../shared/rulesets';
import { alcoholDose, intoxicationLabel } from '../shared/intoxication';
import { spaceportFlight } from '../shared/spaceport-flight';
import { acceptsHay } from '../shared/livestock';
import { Waypoints, waypointGuidance } from './waypoint';
import { socialHtml, showSocialPane } from './social';
import { adoptCarriedPilot } from './pilot-handoff';
let socialPane = 'letters';
import { mapAvailable, vehicleCondition, maintainable } from '../shared/vehicle-services';
import { helmQualification } from '../shared/captain';
import { maximumHealth, nutritionDescription } from '../shared/nutrition';
import { landscapeEditor, landscapeControls } from './landscape-editor';
import { worldItems, worldSkills, skillLesson, worldBuildings } from '../shared/world-catalogue';
import { questList } from './quests';
import { procurementHtml } from './procurement';
import { statementHtml, journalHtml, statisticsHtml } from './reports';
import { caretakerBody, caretakerPanel, type CaretakerUi } from './caretaker';
import type { CaretakerView, CaretakerLogPage } from '../shared/caretaker';
import { workShift } from './work-shift';
import { TradeFeedback } from './trade-feedback';
import { bulkSale } from './bulk-sale';
// SPDX-License-Identifier: GPL-3.0-or-later
import { emergencyImport } from '../shared/harbour-supply';
import { bankLoans, bankQuote } from './bank';
import {
  townPanel,
  townFormAction,
  charterForm,
  charterFormAction,
  townLocation,
  foundTownForm,
  nearbyTownPanels,
} from './town-panel';
import { propertyQuote } from '../shared/property';
import { creatorControls } from './creator-editor';
import {
  creatorTabs,
  creatorPanel,
  creatorClick,
  creatorSubmit,
  creatorMemoryKey,
  creationFields,
  settingsData,
  settingsFields,
  refreshCreatorPreview,
  closeCreatorPreview,
} from './creator-editor';
import { giftAmount } from '../shared/player-aid';
import { playerAidPanel, refreshPlayerAid } from './player-aid';
import { MAX_CHAT_LENGTH } from '../shared/messages';
import { townRoads } from '../shared/town';
import { fishingDock, nearFishingDock } from '../shared/dock';
import { worldResources, gatheringStatus } from '../shared/resources';
import { waterProductionBlocker } from '../shared/fresh-water';
import { roomCount } from '../shared/lodging';
import { shipStats, routeQuote, stationPrice, spaceGoods } from '../shared/galaxy';
import {
  calendar,
  calendarYearSeconds,
  worldWeather,
  snowDescription,
} from '../shared/environment';
import { crops, cropStatus, fertilizerPrice, harvestOffer } from '../shared/farming';
import { VERSION } from '../shared/version';
import './style.css';
import './mobile.css';
import { MobileUI } from './mobile';
import { GameScene } from './scene';
import { mergeState } from './state';
import { InputStream } from './input-stream';
import { ChatLog } from './chat-log';
import { PanelMemory } from './panel-memory';
import { ParishMap } from './parish-map';
import {
  items as defaultItems,
  recipes,
  vehicles,
  buildings as definitions,
  skills as defaultSkills,
  galaxy,
  weapons,
} from '../shared/catalog';
import { money, carry, distance, terrainHeight, productionInterval } from '../shared/simulation';
import {
  collectableReturn,
  ownerWithdrawable,
  remainingClaim,
  unpaidPrincipal,
} from '../shared/stakes';
import { mapHalf, legacyHalf } from '../shared/terrain';
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
let items = defaultItems,
  skills = defaultSkills;
const button = (text: string, action: string, extra = '', className = '') =>
  `<button type="button" data-do="${action}" ${extra} class="${className}">${text}</button>`;
app.innerHTML = `<div id="viewport"></div><div class="grain" aria-hidden="true"></div><header class="brand"><button id="brand-button" aria-label="Open game menu"><span class="brand-icon">a</span><strong>Aclone<span>A SMALL, PERSISTENT UNIVERSE</span></strong></button><span id="connection" role="status">OFFLINE</span></header><div id="world-hud" hidden><div class="location"><span class="eyebrow">YOUR LITTLE CORNER OF THE UNIVERSE</span><b id="location">Puddlewick</b><span id="clock"></span></div><aside class="left-panel"><div class="minimap-panel"><div class="panel-heading"><span>PARISH MAP · M</span><button data-do="hud-hide" data-id="map" aria-label="Hide minimap">−</button></div><button type="button" class="minimap-button" data-do="map" aria-label="Open parish map"><canvas id="minimap" width="230" height="170" aria-hidden="true"></canvas></button><div class="map-legend"><i class="dot rust"></i> You <i class="dot cream"></i> Buildings <span>N ↑</span></div></div><section class="journal"><span class="eyebrow">GETTING ESTABLISHED</span><h2>An honest day's work.</h2><p id="objective">Drive to the Odd Jobs Office and take a shift. The economy won't run itself. Mostly.</p>${button('First steps & leaving safely', 'worldRules', '', 'wide')}${button('View parish directory <span>↗</span>', 'directory', '', 'wide')}${button('How things work <kbd>F7</kbd>', 'help', '', 'wide quiet')}<p class="menu-tip">Press <kbd>F9</kbd> or click Menu for maps, reports and settings.</p></section></aside><aside class="status-panel"><div class="pilot-summary"><button class="hud-dismiss" data-do="hud-hide" data-id="status" aria-label="Hide player status">−</button><div class="pilot"><span class="dot live"></span><strong id="pilot-name"></strong><span id="age"></span></div><div class="cash"><small>CASH IN HAND</small><b id="cash"></b></div><button id="debt-notice" data-do="loans" class="wide" hidden></button><div id="needs"></div></div><div class="parish-players"><div class="player-heading">IN THE PARISH <span id="player-count"></span></div><div id="players"></div></div></aside><div class="bottom-left"><div id="driving"></div><div id="intoxication-status" role="status" hidden></div><div class="button-row">${button('Engine <kbd>F4</kbd>', 'engine')}${button('Lights', 'lights')}${button('View <kbd>C</kbd>', 'camera')}${button('CB radio <kbd>V</kbd>', 'radio')}${button('Sound: tap to start', 'sound')}</div><p class="tourney">◈ A modest ambition: live a long life. Get reasonably rich.</p></div><section class="chat-panel"><div class="chat-heading"><span>PARISH CHAT · Enter</span><button data-do="hud-hide" data-id="chat" aria-label="Hide chat">−</button></div><div id="target"></div><div id="npc-notice" hidden><button type="button" data-do="npc">AI resident · chat &amp; memory info</button></div><div id="chat-recipient" hidden></div><div id="chat-log" title="Scroll for earlier messages; Page Up / Page Down also work while typing" role="log" aria-label="Recent parish and private messages" aria-live="polite" tabindex="0"></div><button type="button" id="chat-latest" hidden>New messages · jump to latest ↓</button><form id="chat-form"><span>›</span><input id="chat-input" name="message" maxlength="${MAX_CHAT_LENGTH}" placeholder="Enter to chat · *help for commands" aria-label="Chat message" autocomplete="off"><button aria-label="Send message">↵</button></form></section><aside class="inventory-panel"><nav>${button('Inventory <kbd>I</kbd>', 'inventory')}${button('Skills', 'skills')}${button('World <kbd>F9</kbd>', 'menu')}</nav><div id="bag"></div></aside><nav class="quickbar" aria-label="Game actions">${button('Menu <kbd>F9</kbd>', 'menu', 'title="Game menu: maps, reports, settings and pilot key"')}${button('Find tractor', 'find-tractor', 'id="find-tractor-shortcut" hidden')}${button('Parp <kbd>Space</kbd>', 'horn')}${button('Activities', 'activities')}${button('Resources', 'resources')}${button('Build', 'construction')}${button('Editor <kbd>F10</kbd>', 'editor')}</nav></div><div id="overlay"></div><div id="modal-host"></div><div id="toast" role="status" aria-live="polite"></div>`;
document
  .getElementById('world-hud')!
  .insertAdjacentHTML(
    'beforeend',
    '<section id="fishing-control" hidden aria-label="Fishing"><p id="fishing-status" role="status"></p><button id="trawl-toggle" data-do="trawl-toggle" aria-controls="trawl-controls" aria-expanded="false" hidden>Fishing controls</button><div id="trawl-controls" hidden><strong>Commercial trawling</strong><p id="trawl-status" role="status"></p><p id="trawl-throttle"></p><button data-do="boatIdle">Idle throttle (B)</button><button data-do="trawl" data-id="deploy">Deploy / resume nets</button><button data-do="trawl" data-id="stow">Stow nets</button><button data-do="trawl" data-id="haul">Haul catch &amp; stow</button></div><button id="scenery-fishing-action" type="button" data-do="leaveGame" aria-live="polite">Waiting · Stop fishing</button><div class="fishing-buttons"><button id="fishing-cast" type="button" data-do="joinGame" data-id="fishing" hidden>Cast a line</button><button id="fishing-reel" type="button" data-do="reel" aria-describedby="fishing-status" disabled>Reel in <kbd>F3</kbd></button><button id="fishing-stop" type="button" data-do="leaveGame" hidden>Stop fishing</button></div></section>',
  );
document
  .getElementById('world-hud')!
  .insertAdjacentHTML(
    'beforeend',
    '<section id="resource-control" hidden aria-label="Nearby resource"><strong id="resource-name"></strong><p id="resource-stock"></p><p id="resource-status" role="status"></p><button id="resource-gather" type="button" data-do="gather" aria-describedby="resource-status">Gather</button><button id="resource-repeat" type="button" data-do="gatherRepeat">Repeat gathering</button></section>',
  );
document
  .getElementById('world-hud')!
  .insertAdjacentHTML(
    'beforeend',
    '<section id="task-control" hidden aria-label="Task progress"><strong id="task-name" role="status"></strong><div id="task-countdown" role="timer" aria-atomic="true"></div><span id="task-caption">seconds remaining</span><button id="resource-stop" type="button" data-do="stopGather" hidden>Stop gathering</button></section>',
  );
document
  .querySelector('.bottom-left')!
  .insertAdjacentHTML(
    'beforeend',
    '<section id="earthwork-guide" hidden aria-label="Earthworks driver guide"></section><section id="parked-status" hidden aria-label="Parked vehicle"></section>',
  );
const waypoints = new Waypoints(localStorage);
document
  .getElementById('world-hud')!
  .insertAdjacentHTML(
    'beforeend',
    '<section id="work-shift" hidden aria-label="Work shift"><strong id="work-shift-name"></strong><span id="work-shift-status" role="status"></span></section>',
  );
document.querySelector('.pilot-summary')!.appendChild(document.getElementById('work-shift')!);
document
  .getElementById('world-hud')!
  .insertAdjacentHTML(
    'beforeend',
    '<section id="waypoint-hud" hidden aria-label="Waypoint guidance"><span id="waypoint-arrow" aria-hidden="true">↑</span><span><b id="waypoint-name"></b><small id="waypoint-distance"></small></span><button type="button" id="waypoint-clear" aria-label="Clear waypoint">×</button></section>',
  );
document.getElementById('waypoint-clear')!.addEventListener('click', () => {
  waypoints.set();
  updateHud();
});
const panelMemory = new PanelMemory(document.getElementById('modal-host')!);
let npcResidents:
  | {
      id: string;
      playerId: string;
      name: string;
      personality: string;
      provider?: string;
      conversationProvider?: string;
      presence?: string;
      nextVisitAt?: number;
      sessionEndsAt?: number;
      world: string;
      online: boolean;
      status: string;
    }[]
  | undefined;
let tradingSelection: { building: string; item: string; side: 'buy' | 'sell' } | undefined;
let chatRecipient: { id: string; name: string } | undefined;
let parishMap: ParishMap | undefined;
let scene: GameScene;
try {
  scene = new GameScene(document.querySelector('#viewport')!);
} catch (e) {
  app.innerHTML = `<div class="fatal"><h1>Aclone needs WebGL</h1><p>Enable hardware acceleration in your browser, then reload.</p><p>${esc((e as Error).message)}</p></div>`;
  throw e;
}
// Follow the rendered position and camera every frame, even between snapshots.
scene.onView = (position, heading) => {
  const goal = waypoints.point;
  if (!goal) return;
  const guidance = waypointGuidance(position, goal, heading);
  $('waypoint-distance').textContent =
    guidance.metres <= 10
      ? 'Arrived · within 10m'
      : `${Math.round(guidance.metres)}m · straight-line direction`;
  $('waypoint-arrow').style.transform = `rotate(${guidance.degrees.toFixed(1)}deg)`;
  $('waypoint-arrow').style.opacity = guidance.metres <= 10 ? '0.3' : '1';
};
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
  rules?: string;
}[] = [];
let market: { stock: Record<string, number> } | undefined;
const carriedHash = adoptCarriedPilot(location.hash, localStorage);
if (carriedHash !== location.hash)
  history.replaceState(null, '', location.pathname + location.search + carriedHash);
let panel = '',
  selected = '',
  tab = 'Main',
  caretakerSnapshot: CaretakerView | undefined,
  caretakerUi: CaretakerUi = { tab: 'Overview', query: '', selected: '' },
  caretakerTimer: ReturnType<typeof setInterval> | undefined,
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
const arrivalTicket = recovery.get('arrival') ?? sessionStorage.getItem('aclone.arrival');
if (recovery.has('arrival')) {
  sessionStorage.setItem('aclone.arrival', arrivalTicket!);
  history.replaceState(null, '', location.pathname + location.search);
}
const recoveryToken = recovery.get('reset') ?? recovery.get('verify');
if (recoveryToken) history.replaceState(null, '', location.pathname + location.search);
const sound = scene.audio;
let weapon = 'plasma';
const keys = new Set<string>();
const $ = (id: string) => document.getElementById(id)!;
const hud = new HudPanels(document.documentElement, localStorage);
$('world-hud').insertAdjacentHTML(
  'beforeend',
  '<button id="hud-controls" data-do="hud" aria-label="HUD layout and visible panels" title="Choose visible panels">HUD ⚙</button>',
);
app.insertAdjacentHTML(
  'beforeend',
  '<section id="startup-loading" hidden role="status" aria-live="polite"><div><span class="eyebrow">ENTERING THE PARISH</span><h2 id="startup-message">Preparing scenery…</h2><p>The controls will be ready when scenery preparation finishes. Slow loading? Try simpler graphics.</p><button id="startup-performance" type="button">Use Performance graphics and reload</button></div></section>',
);
$('startup-performance').addEventListener('click', () => {
  localStorage.setItem('aclone.quality', 'low');
  location.reload();
});
scene.onLoading = (message, warning, live) => {
  if ($('startup-loading').hidden === !!message) sound.setActive(!message && !document.hidden);
  $('startup-loading').hidden = !message;
  $('world-hud').hidden = (!!message && !live) || !world;
  if (message) {
    $('startup-message').textContent = message;
    keys.clear();
  } else {
    keys.clear();
    mobile.reset();
    if (warning) toast(warning, true);
  }
};

declare const __ACLONE_BASE__: string;
const withBase = (path: string) => publicPath(__ACLONE_BASE__, path);
let touchWeapon: string | undefined;
const mobile = new MobileUI(
  () => {
    keys.clear();
    mobile.reset();
    scene.paused = true;
  },
  (phase) => {
    if (phase === 'start' && world?.settings.fighting && !panel) {
      touchWeapon = weapon;
      send({ type: weapon === 'javelin' ? 'chargeWeapon' : 'fire', weapon });
      if (weapon !== 'javelin') sound.weapon();
    } else {
      if (phase === 'end' && touchWeapon === 'javelin' && world && !panel) {
        send({ type: 'fire', weapon: touchWeapon });
        sound.weapon();
      }
      touchWeapon = undefined;
    }
  },
);
function focusChat() {
  keys.clear();
  hud.set('chat', true);
  document.documentElement.classList.remove('scenery-view');
  if (mobile.active) {
    closePanel();
    mobile.open('chat');
  }
  $('chat-input').focus();
}

function setChatRecipient(recipient?: { id: string; name: string }) {
  chatRecipient = recipient;
  $('chat-recipient').hidden = !recipient;
  $('chat-recipient').innerHTML = recipient
    ? `Private message to ${esc(recipient.name)} ${button('Back to parish chat', 'chat-public')}`
    : '';
  ($('chat-input') as HTMLInputElement).placeholder = recipient
    ? 'Message this AI resident…'
    : 'Enter to chat · *help for commands';
}
function toast(text: string, error = false, duration = 5000) {
  $('toast').textContent = text;
  $('toast').className = error ? 'show error' : 'show';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ($('toast').className = ''), duration);
}
let toastTimer = 0;
const trawlCapacityAlerts = new TrawlCapacityAlerts();
function refreshSoundControls() {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-do="sound"]')) {
    button.textContent = sound.status;
    button.setAttribute('aria-pressed', String(sound.enabled && sound.volume > 0));
  }
  const volume = document.getElementById('sound-volume-value');
  if (volume) volume.textContent = `${Math.round(sound.volume * 100)}%`;
}
sound.onChange = refreshSoundControls;
refreshSoundControls();
const unlockSound = (e: Event) => {
  if (!(e.target as Element)?.closest?.('[data-do="sound"]')) sound.unlock();
};
window.addEventListener('pointerdown', unlockSound, { capture: true });
window.addEventListener('keydown', unlockSound, { capture: true });
window.addEventListener('pagehide', () => sound.clear());
window.addEventListener('pageshow', () => sound.setActive(!document.hidden));
document.addEventListener('input', (e) => {
  const input = e.target as HTMLInputElement;
  if (input.id === 'sound-volume') sound.setVolume(Number(input.value) / 100);
  if (input.dataset.audioChannel)
    sound.setChannel(
      input.dataset.audioChannel as import('./audio').AudioChannel,
      Number(input.value) / 100,
    );
});
const radioRequests = new Map<number, Action>();
const radioConsole = new RadioConsole(
  send,
  (volume) => sound.radio(volume),
  (frame, limit) => {
    if (ws?.readyState !== WebSocket.OPEN || ws.bufferedAmount >= limit) return false;
    ws.send(JSON.stringify(frame));
    return true;
  },
  () => (sound.enabled && !document.hidden ? sound.volume : 0),
);
window.addEventListener('pointerdown', () => void radioConsole.unlock(), { capture: true });
window.addEventListener('keydown', () => void radioConsole.unlock(), { capture: true });
const actionViews = new Map<number, string | undefined>();
const tradeFeedback = new TradeFeedback();
const tradeVisits = new Map<number, number>();
let tradeVisit = 0;
let lastTradeVisit: number | undefined;
function send(action: Action) {
  if (ws?.readyState !== WebSocket.OPEN) {
    toast('Connection unavailable. Reconnect before making changes.', true);
    return;
  }
  const id = ++request;
  if (action.type === 'radio') radioRequests.set(id, action);
  actionViews.set(id, $('modal-host').dataset.viewKey);
  if (action.type === 'trade') tradeVisits.set(id, tradeVisit);
  if (tradeVisits.size > 128) tradeVisits.delete(tradeVisits.keys().next().value!);
  if (actionViews.size > 128) actionViews.delete(actionViews.keys().next().value!);
  ws.send(JSON.stringify({ type: 'action', request: id, action }));
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
let requestedArrival: string | undefined;
let arrivalRequest: number | undefined;
let garageDeparture: { world: string; slot: number; building: string } | undefined;
type StatePresentation = { world: string; me: string; inputAck?: number; inputElapsed?: number };
const stateInbox = new FrameInbox<StatePresentation>((state) => {
  if (!world || world.id !== state.world) return;
  inSpace = false;
  localStorage.setItem('aclone.world', world!.id);
  $('overlay').innerHTML = '';
  $('world-hud').hidden = !scene.ready;
  scene.setWorld(world!, state.me);
  scene.prediction.receive(
    world!,
    me!,
    state.inputAck ?? 0,
    state.inputElapsed ?? 0,
    performance.now(),
  );
  $('world-hud').hidden = !scene.ready;
  updateHud();
  if (requestedArrival && me?.inside === requestedArrival) {
    selected = requestedArrival;
    requestedArrival = undefined;
    openPanel('building');
  }
  if (garageDeparture && me && !me.inside && !me.task) {
    const pending = garageDeparture;
    garageDeparture = undefined;
    if (world.id === pending.world)
      send({ type: 'vehicle', slot: pending.slot, building: pending.building });
  }
  if (me) {
    const alert = trawlCapacityAlerts.update(world!.id, me, world);
    if (alert) toast(alert, false, 12000);
  }
  if (world && me) radioConsole.sync(world, me);
  refreshTradingPrices();
  if (world && me && panel === 'player') refreshPlayerAid($('modal-host'), world, me, selected);
});
let inputStream = new InputStream();
async function connect() {
  stateInbox.clear();
  inputStream = new InputStream();
  scene.prediction.reset();
  clearTimeout(reconnectTimer);
  $('connection').textContent = 'CONNECTING';
  ws = new WebSocket(
    `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${withBase('/ws')}`,
  );
  const socket = ws;
  ws.addEventListener('open', () => {
    if (ws !== socket) return;
    mobile.reset();
    if (mobile.active) keys.clear();
    socket.send(
      JSON.stringify({
        type: 'hello',
        token,
        protocol: 4,
        world: localStorage.getItem('aclone.world') ?? undefined,
      }),
    );
  });
  ws.addEventListener('message', (e) => {
    if (ws !== socket) return;
    const msg = JSON.parse(e.data);
    if (msg.type === 'welcome') {
      account = msg.account;
      registry = msg.galaxy.worlds;
      market = msg.market;
      $('connection').textContent = 'CONNECTED';
      if (!world) showGalaxy();
    }
    if (msg.type === 'radio') radioConsole.receive(msg);
    if (msg.type === 'radio-audio') radioConsole.audio(msg);
    if (msg.type === 'state') {
      const previousWorld = world;
      world = mergeState(world, msg);
      me = world!.players[msg.me];
      if (panel === 'bridges') {
        const signature = bridgeStateSignature();
        if (
          signature !== bridgePanelSignature &&
          !document.activeElement?.matches('input,select,textarea')
        ) {
          bridgePanelSignature = signature;
          renderPanel();
        }
      }
      items = worldItems(world!);
      skills = worldSkills(world!);
      if (msg.account) account = msg.account;
      // A landscape form replaces the full layout. Bind the next edit to the
      // accepted snapshot, preserving draft fields through PanelMemory.
      if (
        panel === 'editor' &&
        tab === 'Landscape' &&
        previousWorld?.id === world.id &&
        (previousWorld.landscape !== world.landscape || previousWorld.terrain !== world.terrain)
      )
        renderPanel();
      stateInbox.push({
        world: world!.id,
        me: msg.me,
        inputAck: msg.inputAck,
        inputElapsed: msg.inputElapsed,
      });
      if (msg.sequence !== undefined && ws?.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: 'ack', sequence: msg.sequence }));
    }
    if (msg.type === 'space') {
      radioConsole.reset();
      stateInbox.clear();
      setChatRecipient();
      account = msg.account;
      registry = msg.galaxy.worlds;
      market = msg.market;
      const leavingWorld = !!world;
      world = undefined;
      me = undefined;
      localStorage.removeItem('aclone.world');
      const reopen = panel === 'shipyard';
      // Initial space snapshots must not dismiss an account form opened during login.
      if (leavingWorld || reopen) closePanel();
      void showGalaxy().then(() => {
        if (reopen) openPanel('shipyard');
      });
    }
    if (msg.type === 'caretaker') {
      caretakerSnapshot = msg.view;
      const editing = document.activeElement?.matches('#caretaker-query');
      // Archived chat changes only on explicit refresh/pagination. Replacing
      // its DOM for a live census update can interrupt wheel scrolling,
      // keyboard focus and text selection even when scrollTop is restored.
      const readingChat =
        caretakerUi.tab === 'Chat logs' && !!app.querySelector('#caretaker-body .caretaker-log');
      if (panel === 'caretaker' && !editing && !readingChat) renderPanel();
    }
    if (msg.type === 'result') {
      if (!msg.ok && msg.request === arrivalRequest) requestedArrival = undefined;
      const radioResult = radioRequests.get(msg.request);
      radioRequests.delete(msg.request);
      if (radioResult) radioConsole.result(msg.ok, msg.message ?? '', radioResult);
      const visit = tradeVisits.get(msg.request);
      tradeVisits.delete(msg.request);
      if (msg.ok && msg.trade && visit !== undefined) {
        msg.message = tradeFeedback.add(msg.trade, visit);
        lastTradeVisit = visit;
      }
      if (
        !radioResult &&
        msg.message &&
        !['Parp.', 'Done. Quietly competent.'].includes(msg.message)
      )
        toast(msg.message, !msg.ok);
      const view = actionViews.get(msg.request);
      actionViews.delete(msg.request);
      if (
        !radioResult &&
        (msg.ok || visit !== undefined) &&
        !(panel === 'editor' && tab === 'Landscape') &&
        panel !== 'bridges' &&
        panel !== 'earthworks' &&
        panel &&
        view === $('modal-host').dataset.viewKey
      )
        setTimeout(() => {
          // A prior action must never replace a newly opened tab or an input being edited.
          const editing = document.activeElement?.matches('input,select,textarea');
          if (panel && view === $('modal-host').dataset.viewKey && !editing) renderPanel();
        }, 100);
      if (!msg.ok && msg.message.includes('Invalid pilot key')) {
        token = '';
        localStorage.removeItem('aclone.pilot');
        login();
      }
    }
    if (msg.type === 'pong') ping = Math.round(performance.now() - msg.at);
  });
  ws.addEventListener('close', (e) => {
    if (ws !== socket) return;
    radioConsole.reset();
    radioRequests.clear();
    $('connection').textContent = 'DISCONNECTED';
    sound.clear();
    keys.clear();
    mobile.reset();
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
  mobile.close();
  scene.setSpace();
  $('world-hud').hidden = true;
  $('overlay').innerHTML =
    `<div class="landing"><div class="landing-copy"><div class="eyebrow">INDEPENDENT. OPEN SOURCE. SLIGHTLY AGRICULTURAL.</div><h1>A little world.<br>A lot to get<br><em>on with.</em></h1><p>Build a business. Drive a tractor. Honk a ball into a goal.<br>A persistent universe, made by the people in it.</p><span class="release">ALPHA ${VERSION} <i>✦</i> GPL-3.0-OR-LATER</span></div><section class="login-card"><span class="eyebrow">YOUR FIRST DAY, PRESUMABLY</span><h2>Welcome to Aclone.</h2><p>A pilot name, a modest shuttle, and absolutely no grand destiny.</p>${location.hostname === 'nogits.com' || location.hostname === 'www.nogits.com' ? '<p><a href="https://hromp.com/continue-aclone/">Already play on hromp.com? Bring that pilot here.</a></p>' : ''}<form id="register-form"><label>Pilot name<input name="name" placeholder="e.g. Ada Turnip" minlength="2" maxlength="24" required autocomplete="nickname"></label><button class="primary">Make yourself at home <span>↗</span></button></form><details><summary>Sign in with a password</summary><form id="signin-form"><label>Returning pilot name<input name="name" required autocomplete="username"></label><label>Password<input name="password" type="password" required maxlength="128" autocomplete="current-password"></label><button class="primary">Sign in</button></form></details><details><summary>Forgot your password?</summary><form id="forgot-form"><label>Verified email<input name="email" type="email" required autocomplete="email"></label><button>Send reset link</button></form><small>Email recovery must be enabled by the server operator.</small></details><details><summary>Been here before? Restore your pilot.</summary><form id="restore-form"><label>Pilot key<input name="key" type="password" required placeholder="Paste your saved pilot key" autocomplete="off"></label><button>Restore pilot</button></form></details><small>Your pilot stays in this browser. Add a password and recovery email in Pilot & preferences, or export a private key.</small></section><footer>NO INSTALL. NO SUBSCRIPTION. BRING YOUR OWN AMBITION.<span>Original code, art & sound · Community built</span></footer></div>`;
}
let lastVisitedWorld = '';
function recentlyVisited(id: string) {
  try {
    return JSON.parse(localStorage.getItem('aclone.recentWorlds') ?? '[]').includes(id);
  } catch {
    return false;
  }
}
let connectedGalaxies: {
  enabled: boolean;
  name?: string;
  url?: string;
  peers?: { name: string; url: string }[];
} = { enabled: false };
async function showGalaxy() {
  mobile.close();
  inSpace = true;
  scene.setSpace();
  $('world-hud').hidden = true;
  const [directory, connections] = await Promise.allSettled([
    api('/api/galaxy'),
    api('/api/federation'),
  ]);
  if (directory.status === 'fulfilled') registry = directory.value.worlds;
  if (connections.status === 'fulfilled') connectedGalaxies = connections.value;
  if (!account) return;
  // The built-in world's identity survives ownership changes; names are not unique.
  const isMainWorld = (r: (typeof registry)[number]) => r.id === 'puddlewick';
  const localWorlds = registry
    .filter((r) => r.system === account!.system)
    .sort((a, b) => Number(isMainWorld(b)) - Number(isMainWorld(a)));
  const system = galaxy.systems.find((s) => s.id === account!.system)!;
  $('overlay').innerHTML =
    `<div class="galaxy-view"><div class="galaxy-heading"><div><span class="eyebrow">${esc(connectedGalaxies.name ?? 'GALACTIC DIRECTORY')} / ${esc(system.name.toUpperCase())} SYSTEM · HAZARD ${system.hazard}/4</span><h1>Somewhere to call home.</h1><p>A handful of worlds. A pleasantly unreasonable number of possibilities.</p></div><div class="pilot-card">${esc(account.traveler?.name ?? account.name)}<b>${account.credits} <small>cr</small></b><span>${esc(galaxy.ships.find((s) => s.id === account!.ship)!.name)}</span></div></div>${account.transit ? `<div class="notice">Jumping to ${esc(galaxy.systems.find((s) => s.id === account!.transit!.destination)?.name)}. <span id="jump-countdown">${Math.max(0, Math.ceil(account.transit.arrives - Date.now() / 1000))}</span>s until arrival. Your flight is saved if you disconnect.</div>` : ''}${directory.status === 'rejected' ? '<p class="notice" role="status">The world directory could not be refreshed. Showing the last available worlds.</p>' : ''}${localWorlds.length ? '' : '<p class="notice">No worlds in this system yet.</p>'}<div class="world-cards">${localWorlds
      .map(
        (r, i) =>
          `<article class="world-card${isMainWorld(r) ? ' main-world' : ''}"><div class="world-art art-${i % 3}"><div class="planet"></div><span class="world-type">${esc(r.template.toUpperCase())}</span><span class="world-online">● ${r.players} ONLINE</span></div><div class="world-detail"><div class="world-origin">${isMainWorld(r) ? 'Main world <span>Recommended for new pilots</span>' : r.owner === 'server' ? 'Server-hosted world' : 'Player-created world'}</div><h2>${esc(r.name)}</h2>${recentlyVisited(r.id) ? '<small>Recently visited</small>' : ''}<p>${isMainWorld(r) ? 'Start here for village life, jobs, farming and adventures with the community.' : r.template === 'economy' ? 'An honest living, a village green, and the occasional tractor-related incident.' : r.template === 'combat' ? 'Settle differences with wildly disproportionate farm machinery.' : 'Boats, biplanes, and a conspicuous lack of responsibility.'}</p>${button('Land on this world <span>↗</span>', 'land', `data-id="${esc(r.id)}" ${account!.transit ? 'disabled' : ''}`, 'primary wide')}<div class="world-facts"><span>PERSISTENT WORLD</span>${r.owner === account!.id ? '<span>YOUR WORLD</span>' : ''}</div><details class="world-rules"><summary>World rules & settings</summary><p>${esc(r.rules ?? 'Inspect world rules after landing.')}</p></details></div></article>`,
      )
      .join(
        '',
      )}<article class="create-card"><div class="create-mark">+</div><h2>Make your own parish.</h2><p>Your terrain. Your economy.<br>Your deeply questionable rules.</p>${button('Create a world', 'create', '', 'wide')}</article></div><div class="star-map"><svg viewBox="0 0 700 260" role="img" aria-label="Galaxy map; bright routes are within your current jump range">${galaxy.systems
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
      )}${galaxy.systems.map((s) => `<circle cx="${80 + (s.x + 3) * 28}" cy="${220 - s.y * 23}" r="${s.id === account!.system ? 8 : 5}" fill="${s.id === account!.system ? '#ffd889' : '#c7dbd8'}"/><text x="${90 + (s.x + 3) * 28}" y="${215 - s.y * 23}" fill="#ece8cc" font-size="13">${esc(s.name)}</text>`).join('')}</svg><p>${esc(shipStats(account).name)} · ${shipStats(account).range} pc jump range. Routes below show intermediate stops and fuel costs.</p></div><div class="galaxy-bottom"><div><span class="eyebrow">FURTHER AFIELD</span><div class="button-row">${galaxy.systems
      .filter((s) => s.id !== account!.system)
      .map((s) =>
        button(
          `${s.name} · ${Math.hypot(s.x - system.x, s.y - system.y).toFixed(1)} pc · ${routeQuote(account!, account!.system, s.id) ? `${routeQuote(account!, account!.system, s.id)!.cost}cr / ${routeQuote(account!, account!.system, s.id)!.seconds}s${routeQuote(account!, account!.system, s.id)!.path.length > 2 ? ' · via ' + routeQuote(account!, account!.system, s.id)!.path.slice(1, -1).join(' → ') : ''}` : 'upgrade required'}`,
          'jump',
          `data-id="${s.id}" ${account!.transit || Math.hypot(s.x - system.x, s.y - system.y) > shipStats(account!).range ? 'disabled' : ''}`,
        ),
      )
      .join(
        '',
      )}</div>${connectedGalaxies.enabled ? `<h3>Other galaxies</h3><p>Visit connected servers with your character passport. Money, inventory, businesses and skills stay saved in each galaxy. Return here to resume them.</p><div class="button-row">${connectedGalaxies.peers?.map((g) => button('Travel to ' + esc(g.name), 'galaxy-travel', `data-id="${esc(g.url)}" ${account!.transit ? 'disabled' : ''}`)).join('') || '<p>No connections configured by this host.</p>'}</div>` : ''}${account.traveler ? `<p>Visiting character: ${esc(account.traveler.name)} · home galaxy ${esc(account.traveler.home)}</p><p>To return even if this host becomes unavailable, open your home galaxy directly and sign in with your saved home pilot key. Progress stays with each host.</p>` : ''}${sessionStorage.getItem('aclone.arrival') ? button('Complete pending galaxy arrival', 'galaxy-arrival') : ''}</div><div class="button-row">${button('Shipyard & space trade', 'shipyard')}${button('Pilot key & options', 'options')}${button('Controller settings', 'controllerOptions')}${button('Field guide', 'help')}</div></div></div>`;
}
const chatLog = new ChatLog($('chat-log'), $('chat-latest') as HTMLButtonElement);
let previousTargetHtml = '';
const hudHtml = new Map<string, string>();
function setHudHtml(id: string, html: string) {
  if (hudHtml.get(id) === html) return;
  $(id).innerHTML = html;
  hudHtml.set(id, html);
}
function buildingOwner(b: Building) {
  return b.government
    ? 'Parish'
    : b.owner
      ? (b.ownerName ?? world?.players[b.owner]?.name ?? 'Unknown owner')
      : 'Unclaimed';
}
function updateHud() {
  if (!world || !me) return;
  waypoints.selectWorld(world.id, mapHalf(world));
  if (lastVisitedWorld !== world.id) {
    lastVisitedWorld = world.id;
    try {
      const prior = JSON.parse(localStorage.getItem('aclone.recentWorlds') ?? '[]');
      localStorage.setItem(
        'aclone.recentWorlds',
        JSON.stringify(
          [world.id, ...(Array.isArray(prior) ? prior : []).filter((id) => id !== world!.id)].slice(
            0,
            8,
          ),
        ),
      );
    } catch {}
  }
  const goal = waypoints.point;
  ($('chat-input') as HTMLInputElement).maxLength = communicationRules(
    world.settings,
  ).chatMaxLength;
  $('waypoint-hud').hidden = !goal || !mapAvailable(world, me);
  if (goal) $('waypoint-name').textContent = goal.name;
  $('location').textContent = mobile.active
    ? world.name
    : world.name + ' · ' + townLocation(world, me);
  const days = Math.floor(world.time / 600),
    hours = Math.floor(world.settings.time / 3600),
    weather = alpineWeather(world, worldWeather(world, calendar(world).absoluteDay), me.y),
    snow = snowDescription(world.climate),
    weatherName =
      weather.precipitation === 'clear' && weather.clouds >= 0.6
        ? 'overcast'
        : weather.precipitation;
  $('clock').textContent =
    `${String(hours).padStart(2, '0')}:${String(Math.floor(world.settings.time / 60) % 60).padStart(2, '0')} · ${calendar(world).season} · Day ${calendar(world).dayOfYear + 1}, Year ${calendar(world).year} · ${weatherName} · ${weather.storm ? 'STORM · ' : ''}${snow ? snow + ' · ' : (world.climate?.wetness ?? 0) > 0.2 ? 'Wet roads · ' : ''}${world.template}`;
  $('mobile-calendar').textContent = $('clock').textContent;
  if (mobile.active) {
    $('clock').title = $('clock').textContent ?? '';
    $('clock').textContent =
      `${String(hours).padStart(2, '0')}:${String(Math.floor(world.settings.time / 60) % 60).padStart(2, '0')} · ${calendar(world).season} · ${weatherName}${weather.storm ? ' storm' : ''}${snow ? ' · ' + snow : ''}`;
  }
  $('pilot-name').textContent = me.name;
  $('age').textContent = 'Age ' + Math.floor(me.age);
  $('cash').textContent = money(me.cash, world.settings.denariiPerSheckle);
  $('mobile-cash').textContent = $('cash').textContent;
  const urgent =
    me.thirst > 35000
      ? 'Drink soon'
      : me.hunger > 35000
        ? 'Eat soon'
        : me.health < 20000
          ? 'Low health'
          : me.fuel < 8 && vehicleDef(world, me.vehicle).fuel
            ? 'Low fuel'
            : 'Pilot status';
  $('mobile-vitals').textContent = urgent;
  $('mobile-status').classList.toggle('needs-attention', urgent !== 'Pilot status');
  mobile.setAircraft(vehicleDef(world, me.vehicle).mode === 2, me.vehicle === HIGHWAY_TRACTOR);
  $('mobile-flight').hidden = ![2, 6].includes(vehicleDef(world, me.vehicle).mode);
  $('mobile-combat').hidden = !world.settings.fighting;
  mobile.messages(world.id, JSON.stringify(world.messages.at(-1)) ?? '');
  if (panel === 'mobile-actions') {
    for (const [selector, text, action] of [
      ['[data-do=engine]', me.engine ? 'Stop engine' : 'Start engine', 'engine'],
      [
        '[data-do=lights]',
        me.vehicle === 5
          ? me.lights
            ? 'Flashlight off'
            : 'Flashlight on'
          : isTrawler(me.vehicle, world)
            ? 'Boat lighting'
            : me.lights
              ? 'Turn lights off'
              : 'Turn lights on',
        'lights',
      ],
    ]) {
      const b = $('modal-host').querySelector<HTMLButtonElement>(selector);
      if (b) {
        b.textContent = text;
        b.dataset.do = action;
      }
    }
  }
  let assetStatus = document.getElementById('creator-asset-status');
  if (!assetStatus) {
    assetStatus = document.createElement('div');
    assetStatus.id = 'creator-asset-status';
    assetStatus.setAttribute('role', 'status');
    $('world-hud').append(assetStatus);
  }
  const visual = document.querySelector<HTMLCanvasElement>('#viewport canvas'),
    loading = Number(visual?.dataset.assetLoading ?? 0),
    failed = Number(visual?.dataset.assetFailed ?? 0);
  assetStatus.hidden = !loading && !failed;
  assetStatus.textContent = failed
    ? `${failed} custom visuals failed to load; placeholders remain. Reload to retry.`
    : `Loading ${loading} custom visuals…`;
  const immobile = !!(me.atHome || me.task || me.health <= 0);
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-hold]'))
    b.disabled = immobile;
  if (immobile) mobile.reset();

  const bars: [string, number, string][] = [
    ['Health', me.health / maximumHealth(me, world), 'health'],
    ['Hunger', me.hunger / survivalRules(world.settings).needsDamageThreshold, 'hunger'],
    ['Thirst', me.thirst / survivalRules(world.settings).needsDamageThreshold, 'thirst'],
    [
      'Wellbeing',
      1 - (me.hunger + me.thirst) / (2 * survivalRules(world.settings).needsDamageThreshold),
      'wellbeing',
    ],
    ['Fuel', me.fuel / fuelCapacity(me, world), 'fuel'],
    ['Energy', me.energy / 65000, 'energy'],
  ];
  setHudHtml(
    'needs',
    bars
      .filter(([, , cls]) => cls !== 'fuel' || hasMotor(world, me!.vehicle))
      .map(
        ([name, value, cls]) =>
          `<div class="need"><label>${name}</label><div class="bar"><i class="${cls}" style="width:${Math.round(Math.max(0, Math.min(100, value * 100)) * 10) / 10}%"></i></div><small>${Math.round(value * 100)}%</small></div>`,
      )
      .join(''),
  );
  const online = Object.values(world.players).filter((p) => p.online);
  $('player-count').textContent = String(online.length);
  setHudHtml(
    'players',
    online
      .slice(0, 8)
      .map(
        (p) =>
          `<div class="player-row">${p.id === me!.id ? `<span>▸ ${esc(p.name)}</span>` : button(`${esc(p.name)}${p.npc ? ' <small class="ai-tag">AI</small>' : ''}`, 'player', `data-id="${esc(p.id)}"`, 'player-link')}<small>${p.kudos} kudos</small></div>`,
      )
      .join(''),
  );
  document
    .querySelectorAll<HTMLButtonElement>(
      '.bottom-left [data-do="lights"], .bottom-left [data-do="engine"]',
    )
    .forEach((button) => {
      button.hidden =
        button.dataset.do === 'engine' ? !hasMotor(world, me!.vehicle) : me!.vehicle === LIFEBOAT;
      if (button.dataset.do === 'lights')
        button.textContent = me!.vehicle === 5 ? 'Flashlight' : 'Lights';
    });
  $('driving').title =
    `Ping: round-trip network delay. FPS: rendered frames per second. Motion buffer: ${scene.motionBufferMs} ms; grows only on uneven connections.`;
  setHudHtml(
    'driving',
    `<strong>${Math.round(Math.abs(me.speed) * 2.237)}<small> MPH</small></strong><span>${esc(vehicleDef(world, me.vehicle).name)}<small>${me.vehicle === LIFEBOAT ? 'ROWING · FLARE LIT' : !hasMotor(world, me.vehicle) ? '' : me.engine ? 'ENGINE ON' : 'ENGINE OFF'} · ${mobile.active ? '' : `${ping} ms ping · ${scene.renderFps} FPS`}</small></span>`,
  );
  document.getElementById('flight-readout')?.remove();
  if (vehicleDef(world, me.vehicle).mode === 2) {
    const f = me.flight;
    const info = document.createElement('small');
    info.id = 'flight-readout';
    info.textContent = `THROTTLE ${Math.round((f?.throttle ?? 0) * 100)}% · AGL ${Math.max(0, Math.round(me.y - terrainHeight(world, me.x, me.z)))} m · V/S ${(f?.vy ?? 0).toFixed(1)} m/s · ${f?.stalled ? 'STALL — LOWER NOSE' : f?.grounded ? (me.speed < -0.05 ? 'PUSHBACK · A/D steer · B stop' : 'GROUND · Hold S at idle to back up · B brakes') : 'AIRBORNE'}`;
    $('driving').append(info);
  }
  $('find-tractor-shortcut').hidden = !tractorWaypoint(world, me);
  const guide = earthworkGuidance(world, me, scene.earthworkGuide.selection);
  $('earthwork-guide').hidden = !guide;
  if (guide) {
    const pad = guide.pad,
      bearing = pad ? Math.atan2(pad.x - me.x, me.z - pad.z) : 0;
    const direction = [
      'north',
      'northeast',
      'east',
      'southeast',
      'south',
      'southwest',
      'west',
      'northwest',
    ][(Math.round(bearing / (Math.PI / 4)) + 8) % 8];
    setHudHtml(
      'earthwork-guide',
      `<strong>${pad ? `Earthworks · ${Math.floor(guide.progress * 100)}%` : 'Earthworks'}</strong>${pad ? `<small><span aria-hidden="true" style="display:inline-block;transform:rotate(${Math.atan2(pad.x - me.x, pad.z - me.z) - me.heading}rad)">↑</span> ${Math.round(guide.distance)} m ${direction} to centre · solid line = work area</small><progress max="1" value="${guide.progress}" aria-label="Earthworks progress"></progress>` : ''}<p role="status">${esc(guide.message)}</p><div class="button-row">${button('Earthworks', 'earthworks')}${button(me.earthmovingImplement ? 'Raise implement' : 'Lower implement', 'earthmoving-implement')}${!me.engine ? button('Start engine', 'engine') : ''}</div>`,
    );
  }
  const parking = guide ? undefined : parkingStatus(world, me);
  $('parked-status').hidden = !parking;
  if (parking)
    setHudHtml(
      'parked-status',
      `<p>${esc(parking.text)}</p>${button('Mark parked vehicle', 'parked-waypoint')}${button('Get in ' + esc(parking.point.name), 'vehicle', `data-id="${parking.slot}" ${parking.returnReason ? `disabled title="${esc(parking.returnReason)}"` : ''}`)}${button('Refuel parked vehicle', 'refuelParked', `data-id="${parking.slot}" ${parking.refuelReason ? `disabled title="${esc(parking.refuelReason)}"` : ''}`)}${parking.returnReason ? `<small>${esc(parking.returnReason)}</small>` : ''}${parking.refuelReason ? `<small>${esc(parking.refuelReason)}</small>` : ''}`,
    );
  const drunk = intoxicationLabel(me, world.time);
  $('intoxication-status').hidden = !drunk;
  $('intoxication-status').textContent = drunk
    ? `${drunk} · steering impaired · recovering over time`
    : '';
  const target = scene.nearest();
  let targetHtml = me.atHome
    ? homeDepartureButtons() +
      `<p class="home-provisions" data-home-provisions title="Estimate from stored supplies and current automatic eating/drinking rules. Assumes you remain at home; no starvation or death time is included.">${esc(homeProvisionsStatus(world, me))}</p>`
    : target && !me.task
      ? button(
          `<kbd>Ctrl / E</kbd> ${esc(target.name)} <span>↗</span>`,
          'building',
          `data-id="${target.id}"`,
          'wide target-button',
        )
      : vehicleDef(world, me.vehicle).mode === 2
        ? '<span class="hint">W/S throttle · A/D rudder · ↓ pull up · ↑ nose down · ←/→ bank · B brakes · F7 guide</span>'
        : '<span class="hint">ARROWS / WASD to drive · SHIFT to give it a bit more</span>';
  targetHtml += outdoorServiceButton(target?.id);
  $('task-control').hidden = !me.task || !!panel || !!mobile.drawer;
  $('task-control').classList.toggle('arrival-progress', !!(me.task?.arrival || me.task?.mount));
  if (me.task) {
    const remaining = Math.max(0, Math.ceil(me.task.end - world.time));
    const label =
      me.task.kind === 'gather'
        ? `Gathering ${me.task.amount ?? ''} ${items[worldResources(world).find((n) => n.id === me!.task!.resource)?.item ?? '']?.name ?? 'resources'}`
        : ((
            {
              labour: 'Working a labour shift',
              craft: 'Crafting tools',
              harvest: 'Harvesting crops',
              slaughter: 'Butcher service',
              homeCook: 'Cooking a meal',
            } as Record<string, string>
          )[me.task.kind] ?? me.task.kind.replace(/_/g, ' '));
    if ($('task-name').textContent !== label) $('task-name').textContent = label;
    const time = remaining > 0 ? String(remaining) : 'Finishing…';
    if ($('task-countdown').textContent !== time) $('task-countdown').textContent = time;
    $('task-countdown').classList.toggle('finishing', remaining === 0);
    $('task-caption').hidden = remaining === 0;
  }
  chatLog.update(
    world.id,
    world.messages.map(
      (m) =>
        `<div class="chat-line ${esc(m.kind)}"><b>${esc(m.name)}${m.npc ? ' · AI' : ''}</b>${m.to ? ' <small>private</small>' : ''} ${esc(m.text)}</div>`,
    ),
  );

  setHudHtml(
    'bag',
    itemEntries(me.inventory, items, me.inventory)
      .filter(([, n]) => n > 0)
      .slice(0, 4)
      .map(
        ([id, n]) =>
          `<button data-do="${actionVisible(world!, me!, 'use', id) ? 'use' : 'inventory'}" data-id="${id}" title="${esc(items[id]?.name)}"><span>${esc(items[id]?.icon ?? '')} ${esc(items[id]?.name ?? id)}</span><b>${n}</b></button>`,
      )
      .join('') +
      `<div class="carry">${carry(me, world!)} / ${vehicleDef(world, me.vehicle).capacity} carried</div>`,
  );
  $('objective').textContent = me.task
    ? 'A shift in progress. Take in the view.'
    : me.learning
      ? `Learning ${me.learning.skill}. ${Math.ceil((me.learning.end - world.time) / 60)} minutes to go.`
      : me.job
        ? 'Keep working at your employer to earn wages when production runs.'
        : 'Earn cash at the Odd Jobs Office. Learn a skill at the school. Own a business. In roughly that order.';
  const employer =
    world.buildings.find((b) => b.id === me!.job) ??
    world.buildings.find((b) => b.owner === me!.id && b.ownerActiveUntil !== undefined);
  const shift = employer && workShift(world, me, employer);
  $('work-shift').hidden = !shift || !!panel || !!mobile.drawer || !!me.task || !!me.game;
  if (shift && employer) {
    $('work-shift-name').textContent = employer.name;
    if ($('work-shift-status').textContent !== shift.label)
      $('work-shift-status').textContent = shift.label;
    $('work-shift').title = shift.detail;
  }
  if (me.game === 'combat' && world.combat)
    $('objective').textContent =
      `${world.combat.mode} · ${world.creator?.arena.teams[me.team] ?? (me.team === 0 ? 'Rust' : 'Moss')} team · ${world.creator?.arena.teams[0] ?? 'Rust'} ${Math.floor(world.combat.scores[0])} : ${Math.floor(world.combat.scores[1])} ${world.creator?.arena.teams[1] ?? 'Moss'}. ${weapons[weapon].name}: ${world.settings.weaponMode === 'ammo' ? (me.ammo?.[weapon] ?? 'full') + ' rounds' : Math.floor(me.energy / 650) + '% energy'}. Tab fires; 1–6 select.`;
  $('mobile-objective').textContent = $('objective').textContent;
  $('npc-notice').hidden =
    !Object.values(world.players).some((p) => p.npc) && !world.messages.some((m) => m.npc);
  if (!mobile.active) drawMap();
  parishMap?.update(world, me);
  // Update read-only building facts without rebuilding focused forms/buttons.
  const shown = panel === 'building' ? world.buildings.find((b) => b.id === selected) : undefined;
  if (panel === 'building' && !shown) closePanel();
  if (shown) {
    if (buildingAccessSignature !== buildingAccessKey(shown)) buildingWindow(shown);
    for (const summary of app.querySelectorAll('[data-farm-policy-status]'))
      summary.textContent = farmPolicySummary(world, shown);
    const assemblyPanel = app.querySelector<HTMLElement>('[data-manufacturing-panel]');
    if (assemblyPanel) refreshManufacturing(assemblyPanel, world, me, shown);
    const shift = workShift(world, me, shown);
    const facts: [string, string][] = [
      ['[data-building-owner]', buildingOwner(shown)],
      ['[data-building-efficiency]', `${Math.round(shown.efficiency * 100)}%`],
      ['[data-building-staffing]', staffingStatus(shown)],
      ['[data-building-investment]', money(shown.investment)],
      ['[data-production-status]', productionStatus(world, shown)],
      ['[data-work-status]', shift ? `${shift.label}. ${shift.detail}` : ''],
    ];
    for (const [selector, text] of facts) {
      const element = $('modal-host').querySelector(selector);
      if (element && element.textContent !== text) element.textContent = text;
    }
    const workButton = $('modal-host').querySelector<HTMLButtonElement>('[data-work-button]');
    if (workButton && shift) {
      workButton.textContent = shift.button;
      workButton.disabled = !shift.canRenew || distance(me, shown) >= 18;
    }
  }
  const debt = debtNotice(me);
  $('debt-notice').hidden = !debt;
  if ($('debt-notice').textContent !== debt) $('debt-notice').textContent = debt;
  const debtPanel = app.querySelector('[data-debt-status]');
  if (debtPanel) {
    const html = debtStatusHtml(world, me);
    if (debtPanel.outerHTML !== html) debtPanel.outerHTML = html;
  }
  for (const node of app.querySelectorAll<HTMLElement>('[data-loan-status]')) {
    const loan = me.loans?.find((l) => l.id === node.dataset.loanStatus);
    if (loan) {
      const html = loanStatusHtml(world, me, loan);
      if (node.outerHTML !== html) node.outerHTML = html;
    }
  }
  refreshActionVisibility(app, world, me);
  const bite =
    me.game === 'fishing' &&
    me.fishAt !== undefined &&
    world.time >= me.fishAt &&
    world.time <= (me.fishUntil ?? 0);
  const fishing = me.game === 'fishing';
  const atDock =
    (nearFishingDock(world, me) ||
      (fishingVessel(world, me) && Math.abs(fishingVessel(world, me)!.speed) < 0.5)) &&
    !me.atHome &&
    !me.task &&
    !me.game &&
    !me.crowBody &&
    (!me.hitch || !!me.charterPassage);
  const commercial = isTrawler(me.vehicle, world) && !me.hitch && !me.game && !me.atHome;
  const fishingControl = $('fishing-control');
  const fishingHost = commercial ? app.querySelector('.bottom-left')! : $('world-hud');
  if (fishingControl.parentElement !== fishingHost) fishingHost.prepend(fishingControl);
  const trawlExpanded = localStorage.getItem('aclone.trawl-expanded') === 'yes';
  $('trawl-controls').hidden = !commercial || !trawlExpanded;
  $('trawl-toggle').hidden = !commercial;
  $('trawl-toggle').setAttribute('aria-expanded', String(trawlExpanded));
  $('fishing-control').classList.toggle('collapsed', commercial && !trawlExpanded);
  $('fishing-control').classList.toggle('commercial', commercial);
  $('fishing-control').classList.toggle(
    'capacity-alert',
    commercial && !!(me.trawl?.netFull || me.trawl?.holdFull),
  );
  if (commercial) {
    $('trawl-status').textContent = trawlStatus();
    $('trawl-toggle').textContent =
      `${trawlExpanded ? '▾ Hide controls' : '▸ Fishing controls'} · ${trawlStatus()} · Depth ${waterDepth(world, me).toFixed(1)} m`;
    $('trawl-throttle').textContent =
      `Heading ${nauticalHeadingLabel(me.heading)} · Throttle ${Math.round((me.boatThrottle ?? 0) * 100)}% · Tank ${me.fuel.toFixed(1)}/${vehicleDef(world, me.vehicle).tank} · W/S adjust, A/D steer, B idle`;
  }
  $('fishing-control').hidden = (!fishing && !atDock && !commercial) || !!panel || !!mobile.drawer;
  $('fishing-cast').hidden = fishing || commercial;
  $('fishing-stop').hidden = !fishing;
  $('fishing-reel').hidden = !fishing;
  ($('fishing-cast') as HTMLButtonElement).disabled =
    !me.inventory.tackle || world.settings.fishingMode === 0;
  $('fishing-control').classList.toggle('biting', bite);
  fishingControl.classList.toggle('angling', fishing);
  const sceneryAction = $('scenery-fishing-action');
  sceneryAction.dataset.do = bite ? 'reel' : 'leaveGame';
  // Generic reel gating ran before this button changed back to Stop.
  // Both contextual actions are available; the server still validates each catch.
  (sceneryAction as HTMLButtonElement).disabled = false;
  const sceneryLabel = bite ? 'Fish! Reel in · F3' : 'Waiting · Stop fishing';
  if (sceneryAction.textContent !== sceneryLabel) sceneryAction.textContent = sceneryLabel;
  ($('fishing-reel') as HTMLButtonElement).disabled = !bite;
  const fishingStatus = fishing
    ? bite
      ? 'Fish! Reel in now.'
      : 'Waiting for a bite…'
    : world.settings.fishingMode === 0
      ? 'Fishing is disabled in this parish.'
      : me.inventory.tackle
        ? fishingVessel(world, me)
          ? deepBoatFishing(world, me)
            ? 'Offshore deep water · Cod, halibut and tuna possible.'
            : 'Coastal or shallow water · Small fish only. Larger fish need 8 m depth and 600 m from shore.'
          : 'Fishing dock · Ready to cast.'
        : 'Bring Fishing tackle from a boathouse or Harbour stores.';
  $('fishing-status').hidden = commercial;
  if ($('fishing-status').textContent !== fishingStatus)
    $('fishing-status').textContent = fishingStatus;
  const gathering = me.task?.kind === 'gather' ? me.task : undefined;
  const resource = gathering
    ? worldResources(world).find((n) => n.id === gathering.resource)
    : worldResources(world)
        .filter((n) => distance(me!, n) <= 10)
        .sort((a, b) => distance(me!, a) - distance(me!, b))[0];
  $('resource-control').hidden =
    !resource ||
    !!panel ||
    !!mobile.drawer ||
    !!me.atHome ||
    !!me.game ||
    !!me.crowBody ||
    !!me.task ||
    Math.abs(me.y - terrainHeight(world, me.x, me.z)) > 3;
  if (resource) {
    const status = gatheringStatus(world, me, resource);
    const remaining = gathering ? Math.max(0, Math.ceil(gathering.end - world.time)) : 0;
    const item = items[resource.item].name;
    const texts: [string, string][] = [
      ['resource-name', `${resource.name} · ${item}`],
      [
        'resource-stock',
        `${status.available}/${status.capacity} available · ${Math.round(distance(me, resource))}m away`,
      ],
      [
        'resource-status',
        gathering
          ? `Gathering ${gathering.amount} ${item.toLowerCase()} · ${remaining}s remaining`
          : (status.reason ??
            `${status.amount} ${item.toLowerCase()} per load · ${status.seconds} seconds`),
      ],
      [
        'resource-gather',
        gathering ? 'Gathering…' : `Gather ${status.amount} ${item.toLowerCase()}`,
      ],
    ];
    for (const [id, text] of texts) if ($(id).textContent !== text) $(id).textContent = text;
    const gatherButton = $('resource-gather') as HTMLButtonElement;
    gatherButton.dataset.id = resource.id;
    gatherButton.disabled = !!status.reason;
    const repeat = $('resource-repeat') as HTMLButtonElement;
    repeat.dataset.id = resource.id;
    repeat.disabled = !!status.reason;
    repeat.hidden = !!gathering;
    $('resource-stop').hidden = !gathering;
    if (gathering?.repeat) $('task-name').textContent += ' · repeating';
  }
  if (me.courseRun)
    $('clock').textContent +=
      ` · Course checkpoint ${me.courseRun.next + 1} · ${Math.floor(world.time - me.courseRun.start)}s`;
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
function homeDepartureButtons() {
  if (!world || !me || !persistentVehicles(world, me))
    return button('At home · Go outside', 'outside', '', 'wide');
  return (
    button('Depart on foot', 'outside', 'data-depart="foot"') +
    button('Depart in tractor', 'outside', 'data-depart="tractor"')
  );
}
function drawMap() {
  if (!world || !me) return;
  const c = $('minimap') as HTMLCanvasElement,
    ctx = c.getContext('2d')!;
  ctx.fillStyle = '#4e6247';
  ctx.fillRect(0, 0, 230, 170);
  if (!mapAvailable(world, me)) {
    ctx.fillStyle = '#eee4c6';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Buy a map at a garage', 115, 85);
    ctx.textAlign = 'start';
    return;
  }
  const scale = world.townLayout === 2 ? 0.31 : 0.6;
  // Out in the countryside of a large map the minimap follows the tractor instead.
  const wide = mapHalf(world) > legacyHalf,
    roaming = wide && Math.max(Math.abs(me.x), Math.abs(me.z)) > 200,
    cx = roaming ? me.x : 0,
    cz = roaming ? me.z : 0,
    oy = roaming || world.townLayout === 2 ? 85 : 65;
  const sx = (x: number) => 115 + (x - cx) * scale,
    sz = (z: number) => oy + (z - cz) * scale;
  if (wide) {
    ctx.fillStyle = '#758e86';
    ctx.fill(
      new Path2D(
        mapWaterPath(
          230,
          170,
          (px, py) =>
            terrainHeight(world!, cx + (px - 115) / scale, cz + (py - oy) / scale) -
            waterLevel(world!),
        ),
      ),
    );
  }
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
  if (!wide) {
    ctx.fillStyle = '#758e86';
    ctx.fillRect(0, sz(150), 230, 170 - sz(150));
  }
  ctx.strokeStyle = '#e8d9a6';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  for (const t of world.towns) {
    ctx.beginPath();
    ctx.arc(sx(t.x), sz(t.z), t.radius * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
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
  ctx.fillStyle = '#a9cf86';
  if (wide)
    for (const n of worldResources(world))
      if (Math.abs(n.x - cx) < 400 && Math.abs(n.z - cz) < 300)
        ctx.fillRect(sx(n.x) - 1.5, sz(n.z) - 1.5, 3, 3);
  ctx.strokeStyle = '#c8d29e';
  ctx.strokeRect(sx(60), sz(20), 60 * scale, 50 * scale);
  for (const p of Object.values(world.players)) {
    ctx.fillStyle = p.id === me.id ? '#f2ba71' : '#b9d3cc';
    ctx.beginPath();
    ctx.arc(sx(p.x), sz(p.z), p.id === me.id ? 4 : 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffe791';
  for (const v of Object.values(world.parkedVehicles ?? {})) {
    if (v.owner !== me.id || v.inside === GARAGE_STORAGE) continue;
    const garage = world.buildings.find((b) => b.id === v.inside);
    ctx.fillRect(sx(garage?.x ?? v.x) - 3, sz(garage?.z ?? v.z) - 3, 6, 6);
  }
  const goal = waypoints.point;
  if (goal) {
    ctx.strokeStyle = '#ffe791';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx(goal.x), sz(goal.z), 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.font = '9px monospace';
  ctx.fillStyle = '#f0e6c4';
  ctx.fillText('PUDDLEWICK', sx(-30), sz(-22));
  ctx.fillText('HORN BALL', sx(63), sz(84));
  ctx.fillText('CIRCUIT', sx(-123), sz(95));
}
let storyPanelSignature = '';
let caretakerBuilding = '';
let buildingAccessSignature = '';
function buildingAccessKey(b: Building) {
  return JSON.stringify([
    b.id,
    b.owner,
    b.government,
    !!b.construction,
    !!b.lien,
    me?.authority,
    me?.job,
    caretakerBuilding,
    (b.kind === 'garage' || b.kind === 'vehicleStorage') && world && me
      ? [
          Object.values(world.parkedVehicles ?? {})
            .filter((v) => v.owner === me!.id)
            .map((v) => [v.slot, v.inside, v.x, v.z]),
          Object.values(world.trailers ?? {})
            .filter((t) => t.owner === me!.id)
            .map((t) => [t.id, t.storedAt, t.parkedWith, t.attached, t.x, t.z]),
          world.settings.garageStorageEnabled,
          world.settings.garageStorageLimit,
          world.settings.garageStorageRange,
        ]
      : undefined,
    b.kind === 'farm' && world ? calendar(world).season : undefined,
    b.kind === 'farm' && world && me && b.owner !== me.id
      ? Object.entries(crops).map(([id, c]) => !farmStaffBlocker(world!, me!, b, c.seed, id))
      : undefined,
  ]);
}
let playtimeStats: PlaytimeStatistics | undefined;
let statisticsError = '';
function openPanel(name: string) {
  if (panel === 'radio' && name === 'radio') return;
  if (panel === 'radio') radioConsole.unmount();
  if (name === 'statistics') {
    playtimeStats = undefined;
    statisticsError = '';
    void api('/api/statistics')
      .then((r) => {
        playtimeStats = r.playtime;
        if (panel === 'statistics') renderPanel();
      })
      .catch(() => {
        statisticsError = 'Playtime could not be loaded. Reopen Statistics to retry.';
        if (panel === 'statistics') renderPanel();
      });
  }
  if (name !== 'building') caretakerBuilding = '';
  mobile.close();
  mobile.setBlocked(true);
  if (name === 'npc') {
    npcResidents = undefined;
    void api('/api/npc')
      .then((r) => {
        npcResidents = r.residents;
        if (panel === 'npc') renderPanel();
      })
      .catch((e) => toast(e.message, true));
  }
  parishMap?.dispose();
  parishMap = undefined;
  if (name === 'options' && token) {
    accountStatus = undefined;
    void api('/api/auth/status')
      .then((r) => {
        accountStatus = r;
        if (panel === 'options') renderPanel();
      })
      .catch((e) => toast(e.message, true));
  }
  scene.paused = true;
  panel = name;
  tab = 'Main';
  keys.clear();
  watchCaretaker(name === 'caretaker');
  renderPanel();
}
let caretakerLogWorld = '';
let caretakerLogGeneration = 0;
async function loadCaretakerLog(kind: 'notices' | 'chat', refresh = false) {
  if (!world || panel !== 'caretaker') return;
  const worldId = world.id,
    generation = caretakerLogGeneration;
  const previous = caretakerUi.logs?.[kind];
  if (previous?.loading || (!refresh && previous && !previous.before && !previous.error)) return;
  const before = refresh ? undefined : previous?.before;
  const log = {
    entries: refresh ? [] : (previous?.entries ?? []),
    before,
    loading: true,
  } as CaretakerLogPage & { loading?: boolean; error?: string };
  caretakerUi.logs = { ...caretakerUi.logs, [kind]: log };
  renderPanel();
  try {
    const page: CaretakerLogPage = await api(
      `/api/caretaker/${encodeURIComponent(worldId)}?kind=${kind}${before ? `&before=${before}` : ''}`,
    );
    if (world?.id !== worldId || generation !== caretakerLogGeneration) return;
    log.entries.push(...page.entries);
    log.before = page.before;
  } catch (error) {
    log.error = (error as Error).message;
  } finally {
    log.loading = false;
    if (panel === 'caretaker' && world?.id === worldId && generation === caretakerLogGeneration)
      renderPanel();
  }
}
function watchCaretaker(open: boolean) {
  clearInterval(caretakerTimer);
  caretakerTimer = undefined;
  if (!open || (me?.authority ?? 0) < 20) return;
  if (caretakerLogWorld !== world?.id) {
    caretakerLogWorld = world?.id ?? '';
    caretakerLogGeneration++;
    caretakerUi.logs = {};
    caretakerSnapshot = undefined;
  }
  const kind = caretakerUi.tab === 'Chat logs' ? 'chat' : 'notices';
  if (!caretakerUi.logs?.[kind]) void loadCaretakerLog(kind);
  send({ type: 'caretaker' });
  caretakerTimer = setInterval(() => {
    if (panel === 'caretaker') send({ type: 'caretaker' });
  }, 4000);
}
let closeTractorPreview: (() => void) | undefined;
function closePanel(exit = true) {
  if (exit && (me?.inside || me?.task?.kind === 'entering')) send({ type: 'exitBuilding' });
  requestedArrival = undefined;
  radioConsole.unmount();
  if (panel === 'building' && lastTradeVisit === tradeVisit && tradeFeedback.summary)
    toast(tradeFeedback.summary);
  tradeVisit++;
  closeCreatorPreview();
  closeTractorPreview?.();
  closeTractorPreview = undefined;
  closeBuildPreview?.();
  closeBuildPreview = undefined;
  panelMemory.capture();
  parishMap?.dispose();
  parishMap = undefined;
  scene.paused = false;
  mobile.setBlocked(false);
  panel = '';
  caretakerBuilding = '';
  watchCaretaker(false);
  $('modal-host').innerHTML = '';
}
function modal(title: string, content: string, wide = false) {
  closeCreatorPreview();
  closeTractorPreview?.();
  closeTractorPreview = undefined;
  closeBuildPreview?.();
  closeBuildPreview = undefined;
  panelMemory.capture();
  $('modal-host').innerHTML =
    `<div class="modal-backdrop"><section class="window ${wide ? 'large' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><span class="eyebrow">ACLONE / ${esc(world?.name ?? 'UNIVERSE')}</span>${button('×', 'close', 'aria-label="Close dialog"', 'close')}</header><h2>${esc(title)}</h2>${content}</section></div>`;
  panelMemory.restore(
    JSON.stringify([
      account?.id ?? 'anonymous',
      world?.id ?? 'space',
      panel,
      ['building', 'player'].includes(panel) ? selected : '',
      tab,
      panel === 'editor' ? creatorMemoryKey() : '',
      panel === 'caretaker' ? caretakerUi.tab : '',
    ]),
    () => {
      if (world && me) refreshActionVisibility(app, world, me);
      // Populate quantity-dependent quotes before restoring scroll offsets.
      refreshTaxInfo();
    },
  );
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
function select(name: string, entries: [string, string][], label = '', selectedValue?: string) {
  return `<label>${label}<select name="${name}">${entries.map(([v, l]) => `<option value="${esc(v)}" ${v === selectedValue ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
}
function refreshBusinessDetails() {
  const form = app.querySelector<HTMLFormElement>('form[data-business-details]');
  const b = world?.buildings.find((b) => b.id === form?.dataset.businessDetails);
  if (!form || !b) return;
  for (const [name, value] of [
    ['name', b.name],
    ['wageDenarii', String(b.wage / 100)],
  ]) {
    const input = form.elements.namedItem(name) as HTMLInputElement;
    if (input.dataset.dirty !== 'true') input.value = value;
  }
  form.querySelector('[data-saved-wage]')!.textContent =
    `Saved wage: ${money(b.wage)} per worker per ${b.kind === 'farm' ? 'harvested plot' : 'production cycle'}, before wage tax. Edit and press Save details to change it.`;
}
let questSignature = '';
let procurementSignature = '';
let socialSignature = '';
function refreshTaxInfo() {
  if (!world || !me) return;
  const overview = app.querySelector<HTMLElement>('[data-tax-overview]');
  if (overview) {
    const html = taxesPanel(world, me);
    if (overview.dataset.rendered !== html) {
      overview.innerHTML = html;
      overview.dataset.rendered = html;
    }
  }
  const b = world.buildings.find((b) => b.id === selected);
  if (!b) return;
  for (const note of app.querySelectorAll<HTMLElement>('[data-bulk-summary], [data-bulk-saved]'))
    note.textContent = bulkDiscountSummary(b);
  for (const note of app.querySelectorAll<HTMLElement>('[data-shop-tax]')) {
    const summary = taxSummary(world, b);
    if (note.textContent !== summary) note.textContent = summary;
  }
  for (const count of app.querySelectorAll<HTMLElement>('[data-trade-carried]')) {
    count.textContent = `You have ${me.inventory[count.dataset.item!] ?? 0}`;
  }
  for (const button of app.querySelectorAll<HTMLButtonElement>('[data-do="sellAll"]')) {
    const item = button.dataset.item!;
    const carried = me.inventory[item] ?? 0;
    const sale = bulkSale(b, item, carried, Number(button.dataset.price), world);
    const near = b.kind === 'boathouse' ? nearBoathouse(world, me, b) : distance(me, b) < 18;
    button.dataset.quantity = String(sale.quantity);
    button.disabled = !near || b.owner === me.id || sale.quantity === 0;
    button.textContent = `${sale.quantity < carried ? 'Sell max' : 'Sell all'} (${sale.quantity})`;
    const note = button.closest('.trade-row')?.querySelector('[data-bulk-note]');
    if (note) note.textContent = sale.note;
  }
  const quantity = Number((app.querySelector('#trade-quantity') as HTMLInputElement)?.value ?? 1);
  for (const quote of app.querySelectorAll<HTMLElement>('[data-trade-quote]')) {
    // Use the price actually attached to the visible button, not a fresh unseen quote.
    const text = tradeQuoteText(
      world,
      b,
      quote.dataset.item!,
      quote.dataset.side as 'buy' | 'sell',
      Number(quote.dataset.price),
      quantity,
      b.owner === me.id,
    );
    if (quote.textContent !== text) quote.textContent = text;
    const button = quote
      .closest('.trade-row')
      ?.querySelector<HTMLButtonElement>('[data-do="trade"]');
    if (button)
      button.dataset.total = String(
        quote.dataset.side === 'sell'
          ? bulkPurchaseQuote(b, Number(quote.dataset.price), quantity).total
          : Number(quote.dataset.price) * quantity,
      );
  }
}
let fuelSignature = '';
let boardingRoot: Element | null = null;
let boardingSignature = '';
let fuelPanelRoot: Element | null = null;
let charterSignature = '';
let expeditionSignature = '';
function refreshTradingPrices() {
  if (world && me)
    for (const canoeRoot of app.querySelectorAll('.canoe-panel')) {
      const html = canoePanel(world, me, panel === 'inventory'),
        wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      if (canoeRoot.outerHTML !== wrapper.firstElementChild!.outerHTML)
        canoeRoot.replaceWith(wrapper.firstElementChild!);
    }

  if (world && me && panel === 'building') {
    const b = world.buildings.find((b) => b.id === selected);
    if (b)
      for (const [selector, render] of [
        ['[data-livestock-panel]', livestockPanel],
        ['[data-butcher-panel]', butcherPanel],
        ['[data-home-cooking]', homeCookingPanel],
        ['[data-meat-menu]', meatMenuPanel],
      ] as const) {
        const root = app.querySelector<HTMLElement>(selector);
        if (
          !root ||
          root.contains(
            document.activeElement?.matches('input,select,textarea')
              ? document.activeElement
              : null,
          )
        )
          continue;
        const html = render(world, me, b);
        if (root.dataset.rendered === html) continue;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        const next = wrapper.firstElementChild as HTMLElement | null;
        if (next) {
          next.dataset.rendered = html;
          root.replaceWith(next);
        }
      }
  }
  refreshTaxInfo();
  const fuelRoot = app.querySelector('.fuel-services');
  if (
    fuelRoot &&
    world &&
    me &&
    !fuelRoot.contains(
      document.activeElement?.matches('input,select,textarea') ? document.activeElement : null,
    )
  ) {
    const html = fuelPanel(world, me);
    if (fuelPanelRoot !== fuelRoot || fuelSignature !== html) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      const next = wrapper.firstElementChild!;
      fuelRoot.replaceWith(next);
      fuelPanelRoot = next;
      fuelSignature = html;
    }
  }
  if (panel === 'inventory' && world && me) {
    refreshSpringPanel(app.querySelector('[data-spring-panel]'), world, me, true);
    const boating = app.querySelector<HTMLElement>('[data-inventory-boating]');
    if (boating) {
      const html = boatControls();
      if (boating.dataset.rendered !== html) {
        boating.innerHTML = html;
        boating.dataset.rendered = html;
      }
    }
    const host = app.querySelector('[data-boarding-panel]'),
      html = boardingPanel(world, me);
    if (host && (host !== boardingRoot || boardingSignature !== html)) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      boardingRoot = wrapper.firstElementChild!;
      host.replaceWith(boardingRoot);
      boardingSignature = html;
    }
  }
  if (panel === 'social' && world && me) {
    const key = JSON.stringify([
      me.mail,
      me.sentMail,
      me.familyInvites,
      me.tradeOffers,
      me.family,
      world.families,
    ]);
    if (key !== socialSignature && !document.activeElement?.matches('input,select,textarea')) {
      socialSignature = key;
      renderPanel();
    }
  }
  if (
    world &&
    me &&
    (panel === 'inventory' ||
      panel?.startsWith('book:') ||
      panel === 'townEvents' ||
      panel === 'lottery' ||
      panel === 'activities')
  ) {
    const key = JSON.stringify([
      panel,
      world.creator?.books,
      world.creator?.townEvents,
      world.lottery,
      panel === 'lottery'
        ? [
            world.settings.lotteryEnabled,
            world.settings.lotteryDrawDays,
            world.settings.lotteryTicketPrice,
          ]
        : null,
      world.towJobs,
      reboardReason(world, me) === undefined,
      tenderOf(world, me)?.towedBy,
      tenderOf(world, me)?.landing,
      Object.values(world.players).map((q) => [q.id, q.canBeTowed]),
      me.inventory,
      me.trailerCargo,
      me.boatHold,
      me.boatHolds,
      me.task?.freight,
      me.task?.kind === 'freight' ? Math.floor(world.time * 2) : null,
      world.settings.freightTransferRate,
      world.settings.freightShopRange,
      Object.values(world.trailers ?? {}).map((t) => [
        t.id,
        t.kind,
        t.attached,
        t.storedAt,
        t.parkedWith,
      ]),
      me.vehicle,
      me.atHome,
      me.task?.kind,
      me.hitch,
      me.game,
      me.skills,
      me.crewOffers,
      me.crewBerth,
      me.fishingVoyage?.members,
      me.fishingVoyage?.offers,
      me.lastFishingSettlement,
      world.boatRescues?.[me.id]?.spoilage?.spoiled,
      world.boatRescues?.[me.id]?.dinghy.moored,
      me.boatLighting,
      panel === 'inventory' && boatSlot(me.vehicle, world) ? Math.floor(world.time) : null,
      me.stormExposure,
      me.lights,
      me.crowBody,
      me.crowClass,
      me.crowMark,
      me.crowIntegrity,
      Math.floor(world.time / 60),
    ]);
    if (key !== storyPanelSignature && !document.activeElement?.matches('input,select,textarea')) {
      storyPanelSignature = key;
      renderPanel();
    }
  }
  const charterRoot = app.querySelector('.charter-panel');
  if (
    charterRoot &&
    world &&
    me &&
    !document.activeElement?.matches(
      '.charter-panel input,.charter-panel select,.charter-panel textarea',
    )
  ) {
    const key = JSON.stringify([
      me.charter ? { ...me.charter, elapsed: Math.floor(me.charter.elapsed / 60) } : undefined,
      me.charterPassage,
      me.charterOffers,
      Math.floor((me.charterElapsed ?? 0) / 60),
      Math.floor(world.time / 5),
    ]);
    if (key !== charterSignature) {
      charterSignature = key;
      charterRoot.outerHTML = charterPanel(world, me);
    }
  }
  const expeditionRoot = app.querySelector('.expedition-panel');
  if (
    expeditionRoot &&
    world &&
    me &&
    !document.activeElement?.matches(
      '.expedition-panel input,.expedition-panel select,.expedition-panel textarea',
    )
  ) {
    const dock = boatLanding(world, me, boatSlot(me.vehicle, world));
    const key = JSON.stringify([
      me.crewOffers,
      me.crewBerth,
      me.boatStores,
      me.inventory,
      me.fishingVoyage,
      me.lastFishingSettlement,
      me.boatLighting,
      me.lights,
      me.hitch,
      dock?.id,
      Object.values(world.players).map((p) => [p.id, p.name, p.online]),
    ]);
    if (key !== expeditionSignature) {
      expeditionSignature = key;
      expeditionRoot.outerHTML = expeditionPanel(world, me);
    }
  }
  if (panel === 'boat-lighting' && me) {
    const root = app.querySelector('.boat-lighting-panel');
    const html = boatLightingPanel(me);
    if (root && root.outerHTML !== html) root.outerHTML = html;
  }
  if (panel === 'quests' && world && me) {
    const key = JSON.stringify([world.creator?.quests, me.quests]);
    if (key !== questSignature) {
      questSignature = key;
      renderPanel();
    }
  }
  if (panel === 'procurement' && world && me) {
    const html = procurementHtml(world, me);
    if (html !== procurementSignature) renderPanel();
  }
  const statement = app.querySelector<HTMLElement>('[data-business-statement]');
  if (statement && world && me) {
    const b = world.buildings.find((b) => b.id === statement.dataset.businessStatement);
    if (b) {
      const signature = JSON.stringify([b.productionStatus, me.statements?.[b.id]]);
      if (statement.dataset.signature !== signature) {
        statement.innerHTML = statementHtml(world, me, b);
        statement.dataset.signature = signature;
      }
    }
  }
  for (const el of app.querySelectorAll<HTMLElement>('[data-property-quote]')) {
    const b = world?.buildings.find((b) => b.id === el.dataset.propertyQuote);
    if (!world || !b) continue;
    const q = propertyQuote(world, b);
    el.innerHTML = `This building is for sale.<b>${money(q.total)}</b>${b.estate && !b.owner ? `<small>Base ${money(q.base)} + ${Math.round(world.settings.estateEquityShare * 100)}% of goods ${money(q.goods)} and investment ${money(q.cash)} · ${q.years} years unclaimed, ${Math.round((1 - q.discount) * 100)}% discount. Price follows current contents.</small>` : ''}`;
  }
  refreshBusinessDetails();
  const form = app.querySelector<HTMLFormElement>('form[data-price-editor]');
  const b = world?.buildings.find((b) => b.id === form?.dataset.priceEditor);
  if (!form || !b) return;
  const item = (form.elements.namedItem('item') as HTMLSelectElement).value;
  const side = (form.elements.namedItem('side') as HTMLSelectElement).value as 'buy' | 'sell';
  const price = b[side][item];
  const remembered = price ?? b.pausedPrices?.[side]?.[item];
  const enabled = form.elements.namedItem('enabled') as HTMLSelectElement;
  if (enabled.dataset.dirty !== 'true') enabled.value = price === undefined ? 'false' : 'true';
  const input = form.elements.namedItem('priceDenarii') as HTMLInputElement;
  input.min = side === 'buy' ? String(economyRules(world?.settings).minimumBuyPrice / 100) : '0';
  input.disabled = enabled.value === 'false';
  input.required = !input.disabled;
  if (input.dataset.dirty !== 'true')
    input.value =
      remembered === undefined ||
      (side === 'buy' && remembered < economyRules(world?.settings).minimumBuyPrice)
        ? ''
        : String(remembered / 100);
  form.querySelector('[data-saved-price]')!.textContent =
    price === undefined
      ? `Not ${side === 'buy' ? 'buying' : 'selling'} this item.${remembered !== undefined && remembered > 0 ? ` Last price: ${money(remembered)} per item.` : ''}`
      : `Saved price: ${money(price)} per item`;
  const list = form.querySelector<HTMLElement>('[data-current-prices]')!;
  const key = JSON.stringify([b.buy, b.sell, b.pausedPrices]);
  if (list.dataset.prices !== key) {
    list.dataset.prices = key;
    list.innerHTML =
      '<h4>Current trading prices</h4><ul>' +
      [
        ...new Set([
          ...Object.keys(b.buy),
          ...Object.keys(b.sell),
          ...Object.keys(b.pausedPrices?.buy ?? {}),
          ...Object.keys(b.pausedPrices?.sell ?? {}),
        ]),
      ]
        .map(
          (i) =>
            `<li>${esc(items[i]?.name ?? i)} · buys: ${b.buy[i] === undefined ? 'not buying' : money(b.buy[i])} · sells: ${b.sell[i] === undefined ? 'not selling' : money(b.sell[i])}</li>`,
        )
        .join('') +
      '</ul>';
  }
}
app.addEventListener('change', (event) => {
  const control = event.target as HTMLInputElement;
  if (control.name === 'bulkMode') {
    const levels = control
      .closest('form')
      ?.querySelector<HTMLFieldSetElement>('[data-bulk-levels]');
    if (levels) levels.disabled = control.value !== 'custom';
  }
  const form = control.closest<HTMLFormElement>('form[data-price-editor]');
  if (!form) return;
  if (control.name === 'enabled') {
    control.dataset.dirty = 'true';
    refreshTradingPrices();
    return;
  }
  if (!['item', 'side'].includes(control.name)) return;
  tradingSelection = {
    building: form.dataset.priceEditor!,
    item: (form.elements.namedItem('item') as HTMLSelectElement).value,
    side: (form.elements.namedItem('side') as HTMLSelectElement).value as 'buy' | 'sell',
  };
  delete (form.elements.namedItem('priceDenarii') as HTMLInputElement).dataset.dirty;
  delete (form.elements.namedItem('enabled') as HTMLSelectElement).dataset.dirty;
  refreshTradingPrices();
});
app.addEventListener('input', (event) => {
  if (world && me && panel === 'player') refreshPlayerAid($('modal-host'), world, me, selected);
  const input = event.target as HTMLInputElement;
  if (input.id === 'trade-quantity') refreshTaxInfo();
  if (input.id === 'caretaker-query' && caretakerSnapshot && world) {
    caretakerUi = { ...caretakerUi, query: input.value };
    const body = document.getElementById('caretaker-body');
    if (body)
      body.innerHTML = caretakerBody(
        caretakerSnapshot,
        caretakerUi,
        world.settings.denariiPerSheckle,
      );
  }
  if (
    (input.name === 'priceDenarii' && input.closest('form[data-price-editor]')) ||
    input.closest('form[data-business-details]')
  )
    input.dataset.dirty = 'true';
});
function renderPanel() {
  if (!panel) return;
  if (panel === 'radio' && world && me) {
    radioConsole.sync(world, me);
    if (!$('modal-host').querySelector('.radio-console')) {
      modal('CB radio', '<section class="radio-console"></section>');
      radioConsole.mount($('modal-host').querySelector('.radio-console')!);
    }
    return;
  }
  if (panel === 'create') {
    modal(
      'A parish of your own.',
      `<p>Start from a template. You become its owner, with live editing and a Lua world script. Friends can find it in the Hearth system.</p><form id="create-form">${field('World name', 'name', '', 'text', 'required maxlength="48" placeholder="e.g. Lesser Wobbleton"')}${creationFields()}<button class="primary">Create world</button></form>`,
    );
    return;
  }
  if (panel === 'help') {
    modal(
      'The field guide.',
      `<p class="lede">Live a long life. Get reasonably rich. Try not to become an ostrich.</p><div class="guide-grid"><section><h3>On a phone or tablet</h3><p>Use both thumbs: steering on the left, forward/reverse on the right. Hold Boost for extra speed. Map, Bag, Chat and Actions open focused panels; tap Done or × to return. Tap your cash for health and neighbours. Drag scenery to look; pinch to zoom. Actions includes lights, camera, walking, flight/combat controls and every game menu.</p><h3>Flying the biplane</h3><p>Taxi slowly with low throttle and A/D; hold B to brake. To back away from a building, hold S until the throttle reaches zero, then keep holding S for slow pushback; A/D steer and B stops you. Board at Puddlewick’s airfield hangar on the western edge of town. Buy Fuel there and use it from your inventory, start the engine with F4, and taxi to the marked runway. Increase throttle with W; at about 45–55 mph, gently raise the nose with ↓. Bank with ←/→ to turn; steep banks lose height. If STALL appears, lower the nose with ↑ and add power. For landing, reduce throttle with S and approach near ${Math.round(flightRules(world?.settings).flightApproachSpeed * 2.23694)} mph. Hold B in the air to slow and descend when the world enables the airbrake. Release the arrows to steady the nose and wings, then tap Down for a gentle flare. B remains the wheel brake after touchdown. A hard landing or wing/nose strike destroys the aircraft. Chat and menus neutralise the controls but do not pause flight or reset throttle.</p><h3>Springs and water supply</h3><p>Look for mossy spring basins in the uplands and at river heads. Their droplet-ring map symbols appear at 50% zoom or closer. On foot, stand within ${waterSourceRules(world?.settings).springDrinkRange} m and open Inventory → Drink from the spring; wait ${waterSourceRules(world?.settings).springDrinkCooldown} seconds between drinks. Nothing is bottled. Build a pump-house on an unused spring or dry river/pond bank to make Water for sale; desalination plants draw from the ocean. World Builder controls surveys, drinking, intake rules and recipes.</p><h3>Your first few minutes</h3><ol><li>Land in Puddlewick. Drive with the arrows or WASD.</li><li>Approach the <b>Odd Jobs Office</b>, north of the green. Press E or Ctrl and work a ${survivalRules(world?.settings).labourShiftSeconds}-second shift. Ordinary starting pay is ${money(world?.settings.labourShiftPay ?? 100)}; residents below ${money(survivalRules(world?.settings).labourReliefMeans)} cash plus bank qualify for ${money(survivalRules(world?.settings).labourReliefPay)} relief at most once per ${survivalRules(world?.settings).labourReliefCooldown / 60} minutes.</li><li>Buy bread and water from <b>Harbour stores</b>. Click them in your inventory to consume.</li><li>Learn a profession at the <b>school</b>. The first standard lesson takes ${survivalRules(world?.settings).schoolFirstSeconds} seconds and costs ${money(survivalRules(world?.settings).schoolFirstPrice)}.</li><li>Take a job, work, then buy a business. Fund its investment and inputs; production runs every ten minutes; farms use seasonal plots and harvest shifts.</li><li>Before signing off, go home with food and water stocked. Hunger and thirst keep growing offline; an empty pantry can be fatal. Businesses and training keep running.</li></ol></section><section><h3>The buttons that matter</h3><dl><dt>Arrows / WASD</dt><dd>Drive & steer</dd><dt>Shift</dt><dd>Boost (uses more fuel)</dd><dt>E / Ctrl</dt><dd>Open nearby building</dd><dt>Space / Tab</dt><dd>Horn; Tab fires in combat. Hold/release Tab for javelins; 1–6 select weapons.</dd><dt>F2 / Enter</dt><dd>Enter chat; Enter sends and keeps typing; Escape returns to driving · *help for commands</dd><dt>F4 / L</dt><dd>Engine / headlights</dd><dt>Sound button</dt><dd>Mute/unmute nearby engines, horns and machinery; volume in Pilot & preferences</dd><dt>F5 / R</dt><dd>Robocrow</dd><dt>C / mouse wheel</dt><dd>Camera / zoom; drag in first-person to look around and up</dd><dt>H</dt><dd>Scenery view · hide or restore the HUD; Escape restores it</dd><dt>Biplane: W / S</dt><dd>Increase / decrease persistent throttle; hold S at idle on the ground to push back</dd><dt>Biplane: A / D</dt><dd>Rudder left / right; steer while taxiing</dd><dt>Biplane: arrows</dt><dd>Down: pull the nose up. Up: push the nose down. Left/right: bank left/right. B: airbrake in flight (when enabled), wheel brakes on the ground.</dd><dt>Insert / Delete</dt><dd>Robocrow climb / descend</dd><dt>F3</dt><dd>Reel when the fish bites</dd><dt>M / click minimap</dt><dd>Parish map with building and resource names; zoom and drag to explore</dd><dt>F9 / F10 / F6</dt><dd>Menu / owner editor / caretaker dashboard</dd><dt>Esc</dt><dd>Close window</dd></dl></section></div><p class="note">A day takes ten real minutes and the local seasonal year ${(calendarYearSeconds(world?.settings) / 3600).toFixed(2)} real hours. Farms grow seven crops over 1h 40m to ten hours; tend plots and complete 15-second harvest shifts. Choose combat modes in Activities, building styles, sizes and rotation in Build, and paint at the garage. Space journeys, courier contracts and discoveries are saved across disconnects. Cash is sheckles and denarii (normally 100d = 1s). The server keeps your property working while you are away. Keep inputs, stock space and wages funded. At 1% efficiency, unattended businesses still produce slowly. Browser-reserved keys have on-screen alternatives.</p>`,
      true,
    );
    return;
  }
  if (panel === 'courses' && world && me) {
    modal('Courses & scoreboards', coursesPanel(world, me), true);
    return;
  }
  if (panel === 'worldRules' && world && me) {
    modal(
      'World rules & leaving safely',
      `<ol>${firstSteps(world, me)
        .map(
          (step) =>
            `<li><b>${esc(step.title)}</b><p>${esc(step.detail)}</p>${step.destination ? button('Set destination', 'guideWaypoint', `data-id="${esc(step.destination)}"`) : ''}</li>`,
        )
        .join(
          '',
        )}</ol><p>${esc(rulesSummary(world))}</p><p>${me.atHome ? 'You are sheltered. Check that your home or room pantry has enough food and water; carried supplies do not feed you automatically.' : 'You are outside. Go home to use stored provisions while offline.'}</p>${
        me.authority >= 20 || world.owner === me.id
          ? `<h3>Host operations</h3><p>${world.maintenance?.paused ? 'Maintenance pause active: game clocks frozen.' : 'World running; normal offline survival applies.'}</p>${button(world.maintenance?.paused ? 'Resume world' : 'Pause for maintenance', 'maintenanceToggle')}<p>${
              world.maintenance?.history
                .slice(-8)
                .map(
                  (e) =>
                    `${e.paused ? 'Paused' : 'Resumed'} at world second ${Math.floor(e.worldTime)}`,
                )
                .join(' · ') ?? ''
            }</p>${button('Operating leases: ' + (world.contractRules?.leases ? 'on' : 'off'), 'leasesToggle')}${button('Property auctions: ' + (world.contractRules?.auctions ? 'on' : 'off'), 'auctionsToggle')}`
          : ''
      }${button('Sign out of all devices', 'confirmLogout')}`,
    );
    return;
  }
  if (panel === 'controllerOptions') {
    modal(
      'Controller settings',
      `<p>Left stick drives. A opens the nearby building. Menu opens Actions; B closes it. X (PlayStation Square) raises or lowers earthmoving equipment. In menus use D-pad up/down to focus, left/right to change a selector or number, A to press a button. These controls also operate buying and building forms. Text entry uses your device keyboard.</p><form id="controller-settings">${Object.entries(
        controller.config,
      )
        .map(
          ([key, value]) =>
            `<label>${esc(key)}<input name="${key}" type="number" value="${value}" min="${key === 'deadZone' ? '.05' : '0'}" max="${key === 'deadZone' ? '.5' : '15'}" step="${key === 'deadZone' ? '.01' : '1'}"></label>`,
        )
        .join('')}<button>Save controller bindings</button></form>`,
    );
    return;
  }
  if (panel === 'boat-lighting' && me) {
    modal('Boat lighting.', boatLightingPanel(me));
    return;
  }
  if (panel === 'options') {
    modal(
      'Pilot & preferences.',
      `<p>Save your pilot key somewhere private. It is the key to your identity and property. Anyone who has it can play as you.</p>${button('Download pilot recovery key', 'exportKey', '', 'primary')}${button(sound.status, 'sound')}<label>Sound volume <output id="sound-volume-value">${Math.round(sound.volume * 100)}%</output><input id="sound-volume" type="range" min="0" max="100" step="1" value="${Math.round(sound.volume * 100)}" aria-label="Sound volume"></label>${Object.entries(
        sound.channels,
      )
        .map(
          ([key, value]) =>
            `<label>${{ engine: 'Engines', effects: 'Effects & machinery', ambience: 'Ambience', chat: 'Chat alerts' }[key as import('./audio').AudioChannel]}<input data-audio-channel="${key}" type="range" min="0" max="100" value="${Math.round(value * 100)}"></label>`,
        )
        .join(
          '',
        )}<p class="note">Engines, horns and working machinery are audible nearby. Sound starts after a click or keypress; hidden tabs are silent. Your sound and volume preferences are saved in this browser.</p>${button('Drunk visual effects: ' + scene.drunkVision.label, 'drunkEffects')}<p class="note">Automatic respects your device’s reduced-motion setting. Reduced removes sway and double vision; Off disables the visual effect. Steering impairment still applies.</p>${button('Graphics: ' + scene.qualityLabel, 'quality')}${button('Dynamic shadows: ' + (localStorage.getItem('aclone.shadows') === 'on' ? 'on' : 'off'), 'shadows')}<p class="note">Graphics cycles through adaptive, detailed, and performance. Dynamic shadows default off to keep gameplay smooth; contact shading, headlights and town lighting remain. Shadows can be enabled separately except in performance mode. The server stores progress automatically, including when you disconnect.</p><hr>${account && !accountStatus ? '<p>Loading account security…</p>' : account ? `<h3>Secure your pilot</h3><p>${accountStatus?.password ? 'Password enabled.' : 'Add a password to sign in on another device.'} ${accountStatus?.verified ? 'Recovery email verified.' : 'Email must be verified before it can recover this pilot.'}</p><form id="account-form">${accountStatus?.password ? '<label>Current password<input type="password" name="currentPassword" required autocomplete="current-password"></label>' : ''}<label>New password<input type="password" name="password" minlength="12" maxlength="128" required autocomplete="new-password"></label>${accountStatus?.recoveryAvailable ? `<label>Recovery email (optional)<input type="email" name="email" value="${esc(accountStatus?.email)}" autocomplete="email"></label>` : '<p class="note">This server has not configured email delivery. Export your pilot key as a backup.</p>'}<button class="primary">Save account security</button></form>${accountStatus?.email && !accountStatus.verified ? button('Resend verification email', 'resendEmail') : ''}${button('Sign out of all devices', 'logout')}` : ''}<hr><p>Aclone ${VERSION} · GPL-3.0-or-later<br>Original models, AI-generated material textures, and synthesized audio. Reference material is not part of the game distribution.</p>${button('Controller settings', 'controllerOptions')}${button('Field guide', 'help')}`,
    );
    return;
  }
  if (panel === 'shipyard') {
    if (!account) return;
    modal(
      'A slightly better spaceship.',
      `<p>${account.credits} galactic credits · ${Object.values(account.cargo).reduce((s, n) => s + n, 0)} cargo items</p><div class="cards">${galaxy.ships.map((s) => `<article><h3>${esc(s.name)}</h3><p>${esc(s.role)} · ${s.range} pc range · ${s.capacity} cargo · ${s.price} cr</p><p>${s.fuelPerPc}cr/pc · ${s.secondsPerPc}s/pc · ${Math.round(s.shield * 100)}% shielding</p>${button(s.id === account!.ship ? 'Current ship' : account!.hangar?.includes(s.id) ? 'Fly owned ship' : 'Buy ship', 'ship', `data-id="${s.id}" ${s.id === account!.ship ? 'disabled' : ''}`)}</article>`).join('')}</div><p class="note">Jumps add six seconds for departure. Frontier lanes have a published shielding-energy surcharge: 2cr per hazard level, reduced by hull shielding and rounded up. No random cargo loss or space combat. Route prices include every leg; you fly them individually.</p><h3>Ship fittings</h3><p>Fleet-wide fittings stay installed when switching ships. Current range ${shipStats(account).range} pc · capacity ${shipStats(account).capacity}.</p>${['drive', 'hold'].map((kind) => button(`${kind === 'drive' ? 'Jump drive +2 pc' : 'Cargo hold +20'} · level ${account!.upgrades?.[kind] ?? 0}/3 · ${((account!.upgrades?.[kind] ?? 0) + 1) * (kind === 'drive' ? 80 : 60)}cr`, 'upgrade', `data-id="${kind}" ${(account!.upgrades?.[kind] ?? 0) >= 3 ? 'disabled' : ''}`)).join('')}<h3>Courier desk</h3>${account.mission ? `<p>Ten sealed packages to ${esc(galaxy.systems.find((s) => s.id === account!.mission!.destination)?.name)} · reward ${account.mission.reward}cr. No expiry while offline.</p>${account.system === account.mission.destination && !account.transit ? button('Deliver contract', 'courier', 'data-id="deliver"') : ''}${button('Cancel contract', 'courier', 'data-id="cancel"')}` : `<p>Carry ten sealed packages to a reachable station. Keep jump fuel in reserve.</p>${button('Accept delivery contract', 'courier', 'data-id="accept"')}`}<h3>Exploration</h3><p>Survey each system once for 15cr. Frontier surveys at Lantern, Rime and The Vessel reveal relics; three relics unlock the alien ship. ${account.discoveries?.length ?? 0}/3 found.</p>${button('Survey this system', 'survey', ' ' + (account.visited?.includes(account.system) ? 'disabled' : ''))}${account.system !== 'hearth' && !account.transit && !account.mission && account.credits < 10 && !Object.values(account.cargo).some((n) => n > 0) ? button('Stranded pilot rescue', 'rescue') : ''}<p class="note">Free rescue to Hearth is available with an empty hold, no contract and under 10cr.</p><h3>Station trading</h3><p>Buy here, jump, sell elsewhere. Station prices differ by system.</p><form data-action="spaceTrade">${select(
        'item',
        itemEntries(
          Object.fromEntries(
            ['electronics', 'rareEarth', 'shipParts'].map((id) => [id, items[id]]),
          ),
          items,
          market?.stock ?? {},
          account.cargo,
        ).map(([id]) => [
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
  if (panel === 'npc') {
    const residents = npcResidents?.filter((r) => r.world === world!.id);
    const supplyIntents = (world!.supplyIntents ?? []).filter((c) => c.expires > world!.time);
    const supplyNotice = supplyIntents.length
      ? `<h3>Voluntary supply errands</h3><p class="note">Public plans, not promises or reserved stock. Anyone can help by delivering inputs or taking a job.</p>${supplyIntents.map((c) => `<p>${c.role === 'found' && c.kind ? `${esc(c.name)} intends to found a ${esc(c.kind)} to supply ${esc(c.item)}.` : `${esc(c.name)} is trying to restore ${esc(c.item)} production at ${esc(world!.buildings.find((b) => b.id === c.building)?.name ?? c.building)}.`} Expires in ${Math.ceil((c.expires - world!.time) / 60)} min without progress.</p>`).join('')}`
      : '';
    modal(
      'AI neighbours.',
      `<p>These residents are AI agents with their own personalities, savings and memories. They drive, work and trade under the same rules as you.</p><p class="notice">Parish chat and messages sent to an AI are saved in its memory. Relevant excerpts and game observations are sent to that resident’s AI provider (OpenAI, Anthropic/Claude, or TypeSafe/Jev; Jev chooses actions; Mabel uses OpenAI for conversation, all other residents use Claude) to decide its replies and actions. Private messages go only to the addressed resident.</p>${supplyNotice}${residents === undefined ? '<p>Loading residents…</p>' : residents.length ? residents.map((r) => `<article class="npc-card"><h3>${esc(r.name)} <small class="ai-tag">AI · ${r.provider === 'jev' ? (r.conversationProvider === 'openai' ? 'Jev + OpenAI' : 'Jev + Claude') : r.provider === 'anthropic' ? 'Claude' : 'OpenAI'}</small></h3><p>${esc(r.personality)}</p><p>${r.online ? 'In the parish' : r.status === 'In space' ? 'Exploring the galaxy' : 'Currently resting'} · ${esc(r.status)}${r.nextVisitAt ? ` · Expected back around ${esc(new Date(r.nextVisitAt).toLocaleString())}` : ''}</p>${r.online ? button('Chat with ' + esc(r.name), 'npc-chat', `data-id="${esc(r.playerId)}"`) : ''}</article>`).join('') : '<p>No AI resident is enabled in this parish. The server operator can enable the proof of concept.</p>'}<p class="note">Use the chat button for a private conversation, or mention their first name in parish chat. Start with “Hey guys” or @all to invite one interested neighbour to answer the group. Replies can take a little time. Mabel stays online; other residents have individual playing habits and do not answer while signed off. Unnamed public follow-ups work for two minutes after your latest turn. Memories persist across restarts; the server operator can inspect and manage them.</p>${button('Refresh residents', 'npc')}`,
    );
    return;
  }
  if (panel === 'map') {
    if (!mapAvailable(world, me)) {
      parishMap?.dispose();
      parishMap = undefined;
      modal(
        'Parish map.',
        `<p>This world requires a Parish map in your inventory. Garages print one for ${money(economyRules(world.settings).mapPrintPrice)}.</p>`,
      );
      return;
    }
    if (!parishMap) {
      modal('Parish map.', '<div id="parish-map"></div>', true);
      $('modal-host').querySelector('.window')!.classList.add('map-window');
      parishMap = new ParishMap($('parish-map'), world, me, {
        get: () => waypoints.point,
        set: (point) => {
          waypoints.set(point);
          updateHud();
        },
      });
      $('modal-host').querySelector<HTMLButtonElement>('.close')!.focus();
    } else parishMap.update(world, me);
    return;
  }
  if (panel === 'fishing-dock') {
    modal(
      'Fishing dock',
      `<p>Drive up the boardwalk or walk onto the dock. Bring Fishing tackle from a boathouse or Harbour stores, then cast a line. When a fish bites, use the on-screen Reel in button or F3.</p><p>Cast, reel and stop fishing directly on screen beside the dock. Base mean wait here: ${meanBiteWait(world, me)} seconds; boat depth can adjust it. Bites are random.</p>${me.game === 'fishing' ? button('Stop fishing', 'leaveGame') : button('Cast a line', 'joinGame', 'data-id="fishing"')}${boatControls(fishingDock.id)}`,
    );
    return;
  }
  if (panel === 'creator-object') {
    const o = world.creator?.objects.find((o) => 'object:' + o.id === selected);
    if (o)
      modal(
        o.name,
        `<p>Custom world object. Approach it to interact.</p>${button(esc(o.prompt), 'interactObject', `data-id="${o.id}"`)}`,
      );
    return;
  }
  if (panel === 'social') {
    modal('Mail, family & trades', socialHtml(world, me));
    showSocialPane($('modal-host'), socialPane);
    return;
  }
  if (panel === 'players') {
    const others = Object.values(world.players).filter((p) => p.online && p.id !== me!.id);
    modal(
      'Players & roadside help',
      `<p>Select a player to give money, help refuel or repair their vehicle, hitch a ride, or chat privately.</p><div class="directory">${others.map((p) => button(`${esc(p.name)}${p.npc ? ' · AI' : ''}<small>${Math.round(distance(me!, p))} m away</small>`, 'player', `data-id="${esc(p.id)}"`)).join('') || '<p>No other players are online in this parish.</p>'}</div>`,
    );
    return;
  }
  if (panel === 'player') {
    const target = world.players[selected];
    modal(
      target?.name ?? 'Player unavailable',
      target ? playerAidPanel(target, world) : '<p>This player has left the parish.</p>',
    );
    refreshPlayerAid($('modal-host'), world, me, selected);
    return;
  }
  const b = world.buildings.find((b) => b.id === selected);
  if (panel === 'building' && b) {
    buildingWindow(b);
    return;
  }
  if (panel === 'mobile-actions') {
    modal(
      'On the move.',
      `${outdoorServiceButton(scene.nearest()?.id)}${earthmovingControls()}<p>Hold the arrows to drive; use steering and throttle together. Drag the scenery to look around; pinch to zoom. Release the controls to slow down.</p><h3>Vehicle & camera</h3><div class="menu-grid">${button('Find tractor', 'find-tractor')}${hasMotor(world, me.vehicle) ? button(me.engine ? 'Stop engine' : 'Start engine', 'engine') : ''}${button(me.vehicle === 5 ? (me.lights ? 'Flashlight off' : 'Flashlight on') : poweredBoat(me.vehicle, world) || vehicleDef(world, me.vehicle).lights?.length ? 'Vehicle lighting' : me.lights ? 'Turn lights off' : 'Turn lights on', 'lights')}${button('CB radio', 'radio')}${button('Change camera', 'camera')}${button('Zoom in', 'camera-zoom', 'data-id="in"')}${button('Zoom out', 'camera-zoom', 'data-id="out"')}${button('Walk on foot', 'walk')}${button('Return to tractor', 'tractor')}${button('Toggle robocrow', 'crow')}${button(sound.status, 'sound')}</div>${
        world.settings.fighting
          ? `<h3>Weapon · ${esc(weapons[weapon].name)}</h3><p>Use Fire beside the driving controls. Hold and release Fire to throw a javelin.</p><div class="menu-grid">${Object.entries(
              weapons,
            )
              .map(([id, w]) =>
                button(
                  esc(w.name),
                  'select-weapon',
                  `data-id="${id}" aria-pressed="${id === weapon}"`,
                ),
              )
              .join('')}</div>`
          : ''
      }<h3>Around the parish</h3><div class="menu-grid">${button('Parish directory', 'directory')}${button('Resources', 'resources')}${button('Activities', 'activities')}${button('Build', 'construction')}${button('Skills & employment', 'skills')}${button('Players & roadside help', 'players')}${button('Mail, family & trades', 'social')}${button('AI neighbours', 'npc')}${button('World & community', 'menu')}${button('World editor', 'editor')}${me.authority >= 20 ? button('Caretaker dashboard', 'caretaker') : ''}${button('Pilot & preferences', 'options')}${button('How to play', 'help')}</div>`,
    );
    return;
  }
  if (panel === 'hud') {
    modal(
      'Your screen.',
      `<p>Choose the panels you want around the game. Saved on this browser. Press <kbd>H</kbd> for scenery view; <kbd>Enter</kbd> brings chat back.</p><div class="hud-options">${Object.entries(
        hudPanels,
      )
        .map(
          ([key, label]) =>
            `<label><input type="checkbox" data-hud-panel="${key}" ${hud.settings[key as HudPanel] ? 'checked' : ''}>${label}</label>`,
        )
        .join(
          '',
        )}</div><div class="button-row">${button('Essential panels', 'hud-preset', 'data-id="essential"')}${button('Show all panels', 'hud-preset', 'data-id="all"')}</div><p class="note">The layout adapts to the space available. On phones, Map, Chat and Pilot remain available in their touch drawers. F9 always opens the game menu.</p>`,
    );
    return;
  }
  if (panel === 'resources') {
    const implementsRules = gatheringImplements(world!.settings);
    modal(
      'Gathering grounds',
      `<p>Drive within 10 metres of a marked ground. ${['logs', 'stone', 'gravel', 'dirt'].map((item) => `${esc(items[item].name)}: ${esc(implementsRules[item]?.item ?? 'no implement')}`).join('; ')}. School qualifications select this world’s skilled load and gathering time. Reserves replenish slowly, including offline. The nearest forty grounds are listed; the parish map shows the rest.</p><div class="directory">${[
        ...worldResources(world!),
      ]
        .sort((a, b) => distance(me!, a) - distance(me!, b))
        .slice(0, 40)
        .map((n) => {
          const status = gatheringStatus(world!, me!, n);
          return `<article><h3>${esc(n.name)} · ${esc(items[n.item].name)}</h3><p>${Math.round(distance(me!, n))}m away · map (${n.x}, ${n.z}) · ${status.available}/${status.capacity} available</p><p>${esc(status.reason ?? `${status.amount} per load · ${status.seconds} seconds`)}</p>${button('Gather', 'gather', `data-id="${n.id}" ${status.reason ? 'disabled' : ''}`)}</article>`;
        })
        .join(
          '',
        )}</div><h3>Where it goes</h3><p>Logs → sawmill → timber → furniture. Stone and gravel → concrete works. Topsoil → brick kiln or composting yard. Gravel drains farm plots; topsoil and compost restore soil. Sell to a funded business or carry materials to your own stockroom.</p>`,
      true,
    );
    return;
  }
  if (panel?.startsWith('book:')) {
    const book = world.creator?.books.find((b) => b.id === panel.slice(5));
    if (!book || !(me.inventory[book.item] > 0)) {
      modal('Book unavailable', '<p>Carry the book to read it.</p>');
      return;
    }
    modal(
      book.title,
      book.pages
        .map(
          (text, i) =>
            `<section class="notice"><small>Page ${i + 1} / ${book.pages.length}</small><p style="white-space:pre-wrap">${esc(text)}</p></section>`,
        )
        .join(''),
    );
    return;
  }
  if (panel === 'lottery') {
    modal('Parish lottery', lotteryPanel(world, me));
    return;
  }
  if (panel === 'townEvents') {
    modal('Town events', townEventsPanel(world));
    return;
  }
  if (panel === 'inventory' || panel === 'skills') {
    modal(
      panel === 'inventory' ? 'The things you carry.' : 'A few useful qualifications.',
      panel === 'inventory'
        ? `${boardingPanel(world, me)}<p>${carry(me, world!)} of ${vehicleDef(world, me.vehicle).capacity} capacity · ${esc(vehicleDef(world, me.vehicle).name)}</p><div class="item-list">${itemEntries(
            me.inventory,
            items,
            me.inventory,
          )
            .filter(([, n]) => n)
            .map(
              ([id, n]) =>
                `<div><span><b>${esc(items[id]?.icon ?? '')} ${esc(items[id]?.name ?? id)}</b><small>${items[id]?.weight ?? 0} weight each · ${esc(nutritionDescription(items[id] ?? { name: id, weight: 0, price: 0 }))}${alcoholDose(id) ? ' · Alcohol: repeated drinks impair steering and vision' : ''}</small></span><strong>${n}</strong>${(
                  world!.creator?.books ?? []
                )
                  .filter((b) => b.item === id)
                  .map((b) => button('Read ' + esc(b.title), 'readBook', `data-id="${esc(b.id)}"`))
                  .join(
                    '',
                  )}${button(items[id]?.fuel ? 'Refuel' : items[id]?.food || items[id]?.drink || items[id]?.health || items[id]?.maxHealth || rawMeats.includes(id) ? 'Use' : 'Equipment', 'use', `data-id="${id}" ${!items[id]?.food && !items[id]?.drink && !items[id]?.fuel && !items[id]?.health && !items[id]?.maxHealth && !rawMeats.includes(id) ? 'disabled' : ''}`)}${button('Discard 1', 'discard', `data-id="${esc(id)}" title="Permanently discard one item; no refund"`)}</div>`,
            )
            .join(
              '',
            )}</div>${Object.values(me.inventory).some((n) => n > 0) ? '<p class="note">Discarding permanently removes an item without payment. Sell it or store it when possible.</p>' : "<p>You're not carrying any items.</p>"}${springPanel(world, me, true)}${canoePanel(world, me, true)}${trailerPanel(world, me)}${earthmovingControls()}<div data-inventory-boating>${boatControls()}</div>${me.vehicle !== 5 ? button('Switch to walking', 'walk') : ''}${me.vehicle === 5 ? button('Return to tractor', 'tractor') : ''}${button('Find tractor', 'find-tractor')}${me.crowBody || (me.inventory.rc ?? 0) > 0 ? button(me.crowBody ? 'Return to body' : 'Launch robocrow', 'crow') : ''}`
        : `<p>${skillSlotsUsed(world, me)} of ${world.settings.maxSkills} skill slots used.</p>${me.skills.map((s) => `<div class="notice">${esc(world!.catalogue?.skills[s]?.name ?? s)} · Qualified</div>`).join('') || '<p>No qualifications yet. A visit to the school should sort that out.</p>'}${me.learning ? `<p>Learning ${esc(world.catalogue?.skills[me.learning.skill]?.name ?? me.learning.skill)} · ${Math.ceil((me.learning.end - world.time) / 60)} minutes remaining</p>` : ''}<p>Employment: ${esc(world.buildings.find((b) => b.id === me!.job)?.name ?? 'Between opportunities')}</p>${me.job ? button('Quit job', 'quit') : ''}`,
    );
    return;
  }
  if (panel === 'taxes') {
    modal('Taxes & rates', '<div data-tax-overview></div>');
    refreshTaxInfo();
    return;
  }
  if (panel === 'directory') {
    modal(
      'Parish directory.',
      `${button('Taxes & rates', 'taxes')}${button('Earthworks contracts', 'earthworks')}<p>Find a building on the map, drive up, and press E. Transactions require you to be within 18 metres.</p><div class="directory">${world.buildings.map((b) => `<button data-do="building" data-id="${b.id}"><span><b>${esc(b.name)}</b><small>${esc(b.kind)} · ${b.owner ? (b.government ? 'Public service' : 'Player owned') : 'For sale ' + money(b.price)}</small></span><span>${Math.round(distance(me!, b))} m ↗</span></button>`).join('')}</div>`,
    );
    return;
  }
  if (panel === 'activities') {
    modal(
      'An entirely productive afternoon.',
      `${springPanel(world, me)}${canoePanel(world, me)}${trailerPanel(world, me)}${towingPanel(world, me)}${
        world.settings.crowAbilities && world.settings.fighting
          ? `<h3>Robocrows</h3><p>Scout: fast, unarmed. Interceptor: armoured, machine/plasma weapons. Bomber: slower, grenades/rockets. Every launch consumes one disposable robocrow. Available outside team matches; drone destruction returns you to your body.</p>${
              me.crowBody
                ? `<p>${esc(me.crowClass ?? 'Scout')} · integrity ${Math.max(0, me.crowIntegrity ?? 0)} · recall needs 25,000 energy and a 10-second cooldown. Only the drone moves; no goods or flags travel.</p>${button('Mark drone position', 'crowMark')}${button('Recall drone to mark', 'crowRecall')}${button('Return to body', 'crow')}`
                : Object.entries(crowClasses)
                    .map(([id, c]) => button('Launch ' + c.name, 'crowClass', `data-id="${id}"`))
                    .join('')
            }`
          : ''
      }${world.settings.fighting ? `<h3>Combat arena</h3><p>Balanced ${esc(world.creator?.arena.teams[0] ?? 'Rust')} and ${esc(world.creator?.arena.teams[1] ?? 'Moss')} teams. Keys 1–6 select weapons, Tab fires; hold and release Tab to charge javelins. Safe zones and teammates are protected. ${world.settings.weaponMode === 'ammo' ? `Ammunition is limited per life; garage refits cost ${money(economyRules(world.settings).ammunitionRefitPrice)}.` : 'Weapons use regenerating energy.'} ${world.creator ? `Win at ${world.creator.arena.scoreLimit} points; rounds last ${world.creator.arena.roundSeconds} seconds. ${world.creator.arena.mode === 'open' ? 'Choose a mode below.' : 'Fixed mode: ' + esc(world.creator.arena.mode) + '.'}` : 'Win at 10 kills, 120 capture seconds or 3 flags; rounds last ten minutes.'}</p><div class="button-row">${button('Team deathmatch', 'joinCombat', 'data-id="deathmatch"')}${button('Capture point', 'joinCombat', 'data-id="capture"')}${button('Capture the flag', 'joinCombat', 'data-id="ctf"')}</div>${world.combat ? `<p>${world.combat.mode} · ${esc(world.creator?.arena.teams[0] ?? 'Rust')} ${Math.floor(world.combat.scores[0])} : ${Math.floor(world.combat.scores[1])} ${esc(world.creator?.arena.teams[1] ?? 'Moss')} · round ${world.combat.round}</p>` : ''}` : ''}<div class="activity-list"><article><span>01 / TEAM SPORT</span><h3>Hornball</h3><p>Two teams. One oversized ball. Honk within 22 metres to push it into the other goal. Rust ${world.scores[0]} : ${world.scores[1]} Moss.</p>${button('Join Hornball', 'joinGame', 'data-id="hornball"')}</article><article><span>02 / MOTORISED OPTIMISM</span><h3>Puddlewick circuit</h3><p>A three-second countdown, four checkpoints, and your tractor. Pass through each gate in order.</p>${button('Start a lap', 'joinGame', 'data-id="race"')}<small>${Object.entries(
        world.raceBest,
      )
        .map(([n, t]) => `${esc(n)} ${t.toFixed(1)}s`)
        .join(
          ' · ',
        )}</small></article><article><span>03 / MOSTLY WAITING</span><h3>Fishing</h3><p>Bring tackle. Cast from the dock. Reel when the “Fish!” prompt appears. The fish has eight seconds of patience. Base mean wait here: ${meanBiteWait(world, me)} seconds; boat depth can adjust it. Bites are random, not a countdown.</p>${button('Cast a line', 'joinGame', 'data-id="fishing"')}${button('Reel in', 'reel')}</article><article><span>04 / QUESTIONABLE REGULATIONS</span><h3>Ultrakricket</h3><p>Two players: the first bowls, the second bats. Strike three seconds after the delivery. Miss, and the grenade objects.</p>${button('Join the pitch', 'joinGame', 'data-id="kricket"')}${button('Bowl / swing', 'kricket')}</article></div>${button('Leave current activity', 'leaveGame')}`,
      true,
    );
    return;
  }
  if (panel === 'bridges' && world && me) {
    bridgePanelSignature = bridgeStateSignature();
    if (!bridgeDraft || bridgeDraft.world !== world.id)
      bridgeDraft = {
        world: world.id,
        a: { x: me.x, z: me.z },
        b: { x: me.x + Math.sin(me.heading) * 30, z: me.z + Math.cos(me.heading) * 30 },
        design: 'wide',
      };
    modal('Build a river bridge.', bridgePanel(world, me, bridgeDraft), true);
    closeBuildPreview = mountBridgePanel(
      $('modal-host'),
      world,
      me,
      bridgeDraft,
      (draft) => {
        bridgeDraft = draft;
        renderPanel();
      },
      send,
    );
    return;
  }
  if (panel === 'earthworks') {
    modal('Earthworks', earthworksPanel(world, me), true);
    closeBuildPreview = mountEarthworksPanel(
      $('modal-host').querySelector<HTMLElement>('[data-earthworks-panel]')!,
      () => ({ w: world!, p: me! }),
      send,
      (id) => {
        scene.earthworkGuide.selection = id;
        scene.earthworkGuide.update(world!, me!);
        closePanel();
        updateHud();
      },
    );
    return;
  }
  if (panel === 'construction') {
    modal(
      'Build something useful.',
      button('Earthworks', 'earthworks') +
        button('River bridges', 'bridges') +
        buildMenuHtml(world.settings) +
        `<h3>Town government</h3><p>Visit a council building or town centre to join, vote or stand for office.</p>${nearbyTownPanels(world, me)}${foundTownForm(world, me)}`,
      true,
    );
    closeBuildPreview = mountBuildMenu(
      $('modal-host').querySelector<HTMLElement>('[data-build-designer]')!,
      () => ({ w: world!, p: me! }),
      (action) => {
        send(action);
        closePanel();
      },
      {
        show: (b, w, refusal) => scene.constructionGhost.show(b, w, refusal),
        clear: () => scene.constructionGhost.clear(),
        turn: (angle) => scene.constructionGhost.turn(angle),
      },
    );
    return;
  }
  if (panel === 'caretaker') {
    if (!world || !me || me.authority < 20) {
      modal(
        'Caretaker dashboard.',
        '<p>Only the world creator can open the parish books. Create your own world to inspect its residents and buildings.</p>',
      );
      return;
    }
    modal(
      'Caretaker dashboard.',
      caretakerPanel(caretakerSnapshot, caretakerUi, world.settings.denariiPerSheckle),
      true,
    );
    return;
  }
  if (panel === 'editor') {
    editorWindow();
    return;
  }
  if (panel === 'procurement') {
    procurementSignature = procurementHtml(world, me);
    modal('Parish supply orders', procurementSignature);
    return;
  }
  if (panel === 'quests') {
    modal('Quests', questList(world, me));
    return;
  }
  if (panel === 'statistics') {
    modal('Your statistics', statisticsHtml(world, me, playtimeStats, statisticsError));
    return;
  }
  if (panel === 'loans') {
    modal('Loans & repayment warnings', debtStatusHtml(world, me));
    return;
  }
  if (panel === 'reports') {
    modal('Journal & reports', journalHtml(world, me));
    return;
  }
  if (panel === 'menu') {
    modal(
      'Parish business.',
      `<div class="menu-grid">${button('Parish map', 'map')}${button('Find tractor', 'find-tractor')}${button('Journal & reports', 'reports')}${button('Statistics', 'statistics')}${button('Loans & repayments', 'loans')}${button('Quests', 'quests')}${button('Town events', 'townEvents')}${button('Courses & scoreboards', 'courses')}${world.settings.lotteryEnabled || world.lottery ? button('Parish lottery', 'lotteryPanel') : ''}${world.settings.parishOrders ? button('Parish supply orders', 'procurement') : ''}${button('Earthworks contracts', 'earthworks')}${button('Directory', 'directory')}${button('Players & roadside help', 'players')}${button('Mail, family & trades', 'social')}${button('AI neighbours', 'npc')}${button('Inventory', 'inventory')}${button('Qualifications', 'skills')}${button('Activities', 'activities')}${button('Construction', 'construction')}${button('World editor', 'editor')}${me.authority >= 20 ? button('Caretaker dashboard', 'caretaker') : ''}${button('HUD & layout', 'hud')}${button('Options & pilot key', 'options')}${button('World rules & leaving safely', 'worldRules')}${button('Taxes & rates', 'taxes')}${button('Controller settings', 'controllerOptions')}${button('Field guide', 'help')}${button('Leave activity', 'leaveGame')}</div><h3>Noticeboard</h3><p>${esc(world.messages.find((m) => m.name === 'Parish notice')?.text ?? 'No news is respectable news.')}</p><p class="note">Take off from the spaceport to visit another world. Your businesses stay behind and continue producing.</p>`,
    );
    return;
  }
}
function staffingStatus(b: Building) {
  const c = b.staffing;
  if (!c) return '';
  return `${c.active} active / ${c.ideal} ideal${c.ownerOperating ? ' (includes operating owner)' : ''}${!c.active && b.government ? ' · public operation' : ''}`;
}
function productionStatus(w: World, b: Building) {
  const recipe = productionRecipe(world, b);
  if (!recipe || b.kind === 'farm') return '';
  if (waterProductionBlocker(w, b))
    return 'Production paused: ' + waterProductionBlocker(w, b) + '.';
  const interval = productionInterval(w, b);
  const remaining = Math.ceil(interval - (w.time % interval));
  const stock = [
    ...new Set([
      ...Object.keys(recipe.inputs),
      ...(acceptsHay(b) ? ['hay'] : []),
      ...Object.keys(recipe.outputs),
    ]),
  ]
    .map((id) => `${b.stock[id] ?? 0} ${items[id]?.name ?? id}`)
    .join(' · ');
  return `Next production check in ${Math.floor(remaining / 60)}m ${remaining % 60}s. Stockroom: ${stock}.`;
}
function buildingWindow(b: Building) {
  if (!me || !world) return;
  const near = b.kind === 'boathouse' ? nearBoathouse(world, me, b) : distance(me, b) < 18,
    selfOwned = b.owner === me.id,
    caretaker = caretakerBuilding === b.id && me.authority >= 20,
    owned = selfOwned || caretaker;
  buildingAccessSignature = buildingAccessKey(b);
  const tabs = [
    'Main',
    ...(owned
      ? ['Stockroom', 'Building Admin']
      : !b.government && !b.construction
        ? ['Investment']
        : []),
    'Extra Info',
    'Statement',
  ];
  if (!tabs.includes(tab)) tab = 'Main';
  let html = `${caretaker ? '<p class="notice">Caretaker mode: managing this property as world administrator.</p>' : ''}<div class="building-meta"><span>OWNER <b data-building-owner>${esc(buildingOwner(b))}</b></span><span>INVESTMENT <b data-building-investment>${money(b.investment)}</b></span><span>EFFICIENCY <b data-building-efficiency>${Math.round(b.efficiency * 100)}%</b></span></div>${b.staffing ? `<p class="note" data-building-staffing>${esc(staffingStatus(b))}</p>` : ''}${!near ? '<p class="notice">You are ' + Math.round(distance(me, b)) + ' metres away. Drive closer to trade or use this building.</p>' : ''}<nav class="tabs">${tabs.map((t) => button(t, 'tab', `data-id="${t}"`, t === tab ? 'active' : '')).join('')}</nav>`;
  if (b.construction) {
    html += `<p>Materials still needed: ${Object.entries(b.construction)
      .map(([i, n]) => `${n} ${esc(items[i]?.name ?? i)}`)
      .join(
        ', ',
      )}</p>${button('Deliver construction materials', 'supply', `data-building="${b.id}" ${!near ? 'disabled' : ''}`)}${selfOwned && !b.government && !b.lien ? `<details class="notice"><summary>Cancel construction</summary><p>Receive ${money(constructionRefund(world, b))} back (${constructionRefundPercentage(world.settings)} of the base cash cost). Construction tax and any materials already delivered are not returned. This removes the site.</p>${button('Cancel building and receive refund', 'cancelConstruction', `data-building="${b.id}" ${!near ? 'disabled' : ''}`)}</details>` : ''}`;
    modal(b.name, html);
    refreshTradingPrices();
    return;
  }
  if (tab === 'Main') {
    if (b.kind === 'automotiveFactory')
      html += `<section data-manufacturing-panel>${manufacturingPanel(world, me, b)}</section>`;
    if (b.id === 'parish-government-stores')
      html +=
        '<p class="notice">Food, drinking water and fuel are imported on demand, even when stored stock is zero. These premium prices keep supplies available during shortages; local producers and ordinary pumps are usually cheaper.</p>';
    if (world.settings.parishOrders && world.procurement?.building === b.id)
      html += button('Parish supply orders', 'procurement');
    if (selfOwned)
      html +=
        b.kind === 'lighthouse'
          ? '<p class="notice">Your lighthouse: collect the navigation allowance in Building Admin. You may take the keeper job if its single place is vacant.</p>'
          : '<p class="notice">Your business: use Stockroom to move goods and Building Admin to manage cash. Owners cannot trade with or take jobs at their own property. Farm owners can tend their plots without taking wages. Where owner operation is enabled, qualified owners also operate factories without wages.</p>';
    if (!b.government && (b.stakes?.length || (!selfOwned && !b.construction))) {
      const mine = b.stakes?.find((s) => s.investor === me!.id);
      const locked = unpaidPrincipal(b);
      const due = mine ? collectableReturn(world, b, me!.id) : 0;
      html += `<p class="notice">${
        locked
          ? `Outside stakes ${money(locked)} remain in this till until the business earns. Existing claims keep their agreed terms. New deposits earn up to ${economyRules(world.settings).outsideReturnPercent}% above principal.`
          : `Neighbours can invest working capital here. Returns come only from later earnings, capped at ${economyRules(world.settings).outsideReturnPercent}% above the stake, and never empty the operating reserve.`
      }${
        mine
          ? ` You have put in ${money(mine.principal)}, collected ${money(mine.paid)}, and may take ${money(due)} now (claim ${money(mine.claim)}).`
          : ''
      }</p>`;
    }
    if (me.atHome && me.home === b.id) html += homeDepartureButtons();
    if (Object.keys(b.sell).length || Object.keys(b.buy).length)
      html += `<p class="note" data-shop-tax></p>${button('Taxes & rates', 'taxes')}<p class="note">Available goods first, then other listings; each group is alphabetical. Buy lists use shop stock; sell lists use what you carry.</p><div class="trade-columns">${(
        ['sell', 'buy'] as const
      )
        .map(
          (side) =>
            `<section><h3>${selfOwned ? (side === 'sell' ? 'Your sale listings' : 'Your purchase bids') : side === 'sell' ? 'Items you can buy here' : 'Items we buy from you'}</h3><div class="trade-list">${itemEntries(
              b[side],
              items,
              side === 'sell' ? b.stock : me!.inventory,
            )
              .map(
                ([id, price]) =>
                  `<div class="trade-row"><span><b>${esc(items[id]?.icon ?? '')} ${esc(items[id]?.name ?? id)}</b><small>${b.stock[id] ?? 0} / ${b.capacity} in stock${side === 'sell' && emergencyImport(world!, b, id) ? ' · Emergency imports available at this price' : ''}</small><small data-trade-carried data-item="${id}">You have ${me!.inventory[id] ?? 0}</small></span><b>${money(price)}</b>${selfOwned ? '' : `<button data-do="trade" data-price="${price}" data-building="${b.id}" data-item="${id}" data-direction="${side === 'sell' ? 'buy' : 'sell'}" ${!near ? 'disabled' : ''}>${side === 'sell' ? 'Buy' : 'Sell'}</button>${side === 'buy' ? `<button data-do="sellAll" data-building="${b.id}" data-item="${id}" data-price="${price}" disabled>Sell all</button><small class="trade-bulk-note" data-bulk-note></small>` : ''}`}<small class="trade-tax-quote" data-trade-quote data-item="${id}" data-side="${side}" data-price="${price}"></small></div>`,
              )
              .join('')}</div></section>`,
        )
        .join(
          '',
        )}</div><label class="quantity">${selfOwned ? 'Quantity for estimate' : 'Quantity per trade'}<input id="trade-quantity" type="number" min="1" max="${economyRules(world.settings).transactionItemLimit}" value="1"></label><p data-bulk-summary></p>`;
    if (b.kind === 'workhouse' && !selfOwned && world.settings.jobsEnabled !== false) {
      const quote = labourQuote(world, me!);
      html += `<p>Unskilled labour. A ${survivalRules(world.settings).labourShiftSeconds}-second task pays ${money(labourShiftPay(world))} for the first eight shifts in a row, then less until a ten-minute break or other work, up to ${money(labourDailyCap(world))} a game day. ${quote.reason ? `${quote.reason[0].toUpperCase()}${quote.reason.slice(1)}. ` : ''}Residents below ${money(survivalRules(world.settings).labourReliefMeans)} cash plus bank can receive ${money(survivalRules(world.settings).labourReliefPay)} relief at most once per ${survivalRules(world.settings).labourReliefCooldown / 60} minutes, and relief does not count toward the daily cap. You will be quite still while working.</p>${button(`Work a shift · ${money(quote.pay)}`, 'task', `data-building="${b.id}" data-id="labour"`, 'primary')}`;
    }
    if (b.kind === 'school')
      html += `<p>First qualification: ${money(survivalRules(world.settings).schoolFirstPrice)} and ${survivalRules(world.settings).schoolFirstSeconds} seconds. Later standard qualifications: ${money(survivalRules(world.settings).schoolLaterPrice)} and ${survivalRules(world.settings).schoolLaterSeconds} seconds. Custom courses use the prices and times below. Up to ${world.settings.maxSkills} skills; ${survivalRules(world.settings).licencesCountSkills ? 'licences count' : 'licences do not count'} against this limit.</p><div class="menu-grid">${skills
        .map((s) => {
          const lesson = skillLesson(world!, me!, s);
          return button(
            `${esc(lesson.name)} · ${money(lesson.price)} · ${lesson.seconds}s${lesson.prerequisites.length ? ' · requires ' + esc(lesson.prerequisites.join(', ')) : ''}`,
            'learn',
            `data-id="${esc(s)}" data-building="${b.id}" ${me!.skills.includes(s) || me!.learning || !skillFits(world!, me!, s) || !lesson.prerequisites.every((s) => me!.skills.includes(s)) ? 'disabled' : ''}`,
          );
        })
        .join('')}</div>`;
    if (b.kind === 'boathouse')
      html +=
        boatControls(b.id) +
        '<p>Buy Fuel here and use it after boarding your boat. Atlantic cod, halibut and bluefin tuna can be sold here when the till has funds. Boat fishing in water at least 8 metres deep can catch these species; shallow water yields small fish.</p>';
    if (b.kind === 'quay')
      html +=
        boatControls(b.id) +
        '<p>An open freight wharf. Board an owned vessel here, transfer freight and trade with shops near the shore entrance. Buy new vessels at a boathouse.</p>';
    if (b.kind === 'riverDock')
      html +=
        boatControls(b.id) +
        '<p>A small log jetty on a navigable river reach. Owned vessels that fit the world’s river limits board here and remain moored in view. Freight holds use the same transfer rules as coastal docks. Nearby shops or fuel tankers can supply fuel; carry cans aboard and use Refuel. Recover stranded upriver boats at their saved position using the lifeboat, motorboat or towing controls.</p>';
    html += garageStoragePanel(world, me, b) + canoePanel(world, me) + trailerPanel(world, me, b);
    if (b.kind === 'garage' && !b.aircraftHangar) html += tractorShopHtml(world);
    if (b.aircraftHangar)
      html += `<h3>Aircraft hangar</h3><p>${aircraftCount(me)} biplane airframes owned (${me.spareBiplanes ?? 0} spare). Board here. When garage storage is enabled, entering in a land vehicle stores it and its rig here, keeping the apron clear. Expand Vehicle storage to retrieve it after flying. Aircraft appear outside on the apron with the engine off. Press F4 to start, then taxi west to the runway (${world.airfield?.length ?? 240} metres). Spare airframes start with empty tanks: buy and use Fuel here before flying. Crashes destroy one aircraft only.</p>`;
    if (b.kind === 'garage' && !b.aircraftHangar && hasAircraftHangar(world))
      html +=
        '<p>Biplanes are available at Puddlewick airfield hangar, on the western edge of town.</p>';
    if (b.kind === 'garage')
      html += `<h3>Vehicles</h3><div class="directory">${vehicles
        .slice(0, 6)
        .map((v, i) =>
          i === 0 || i === 3 || (b.aircraftHangar ? i !== 2 : i === 2 && hasAircraftHangar(world!))
            ? ''
            : button(
                `${esc(v.name)}${helmQualification(world!, i) ? ` · ${esc(helmQualification(world!, i)!)} licence` : ''} <span>${(i === 2 ? aircraftCount(me!) > 0 : (me!.fleet ?? [0, 5]).includes(i)) ? (i === 2 ? 'Board owned aircraft' : 'Owned') : money(v.price)}</span>`,
                'vehicle',
                `data-id="${i}" data-building="${b.id}"${i === 2 ? ' data-explain' : ''}`,
                'wide',
              ),
        )
        .join('')}</div>`;
    if (b.kind === 'garage') {
      const record = me!.fleetState?.[me!.vehicle];
      html += `<h3>Vehicle service</h3><p>${esc(vehicleDef(world, me!.vehicle).name)} · condition ${vehicleCondition(me!).toFixed(1)}%${record ? ` · ${(record.metres / 1000).toFixed(1)} km · ${((world!.time - record.acquiredAt) / 3600).toFixed(1)} hours since first recorded use` : ' · no journey recorded yet'}. ${world.settings.vehicleMaintenance ? `Travel wears ${vehicleRunningRules(world.settings).vehicleWearPerMetre * 1000} condition points per kilometre` : 'Distance wear is disabled'}; poor condition slightly reduces top speed and increases fuel use when maintenance is enabled. No wear while parked or in minigames.</p><p>Each service consumes ${economyRules(world.settings).vehicleServiceSteel} carried Steel and restores up to 25 condition points. Labour ${money(b.owner === me!.id ? 0 : economyRules(world.settings).vehicleServiceFee)}; paid to this garage. Buy parts at a steelworks or shop.</p>${button('Service vehicle', 'serviceVehicle', `data-building="${b.id}" ${!near || !maintainable(me!.vehicle, world) || vehicleCondition(me!) >= 100 ? 'disabled' : ''}`)}<p>Printed Parish map: ${money(economyRules(world.settings).mapPrintPrice)}. ${world!.settings.requireMapItem ? 'Required in this world to view maps.' : 'Maps are free to view in this world; purchase is optional.'}</p>${button('Buy parish map', 'buyMap', `data-building="${b.id}" ${!near || me!.inventory.parishMap > 0 ? 'disabled' : ''}`)}`;
    }
    if (b.kind === 'boathouse' && poweredBoat(me.vehicle, world))
      html +=
        vehiclePaintShop(world, me, b, me.vehicle) +
        button(
          `Service boat · ${economyRules(world.settings).vehicleServiceSteel} Steel + ${money(b.owner === me!.id ? 0 : economyRules(world.settings).vehicleServiceFee)}`,
          'serviceVehicle',
          `data-building="${b.id}"`,
        );
    if (b.kind === 'boathouse')
      html +=
        '<h3>Commercial fishing</h3><p>North Star: 300s, 3,200-weight hold, 3,200-unit tank. New boats start empty. Bring food, water and fuel for the return. Deploy the nets while moving, and haul whenever you want to inspect your catch. A full net stops towing until you haul it aboard. Sell landed fish here or take them to another buyer; prices, available cash and storage vary.</p>';
    if (b.kind === 'garage' && !isTractor(me.vehicle))
      html += vehiclePaintShop(world, me, b, me.vehicle);
    if (seafoodKitchens.includes(b.kind))
      html +=
        '<h3>Seafood kitchen</h3><p>Buy Atlantic cod, halibut or tuna from skippers or hauliers. Owners can choose a seafood menu; cooks turn fish, potatoes and water into meals through normal funded production. Guests can also buy fish and store it in their room pantry.</p>' +
        (selfOwned && !b.production
          ? ['standard', 'cod', 'halibut', 'tuna']
              .map((menu) =>
                button(
                  menu === 'standard' ? 'Standard menu' : `${menu} meals`,
                  'seafoodMenu',
                  `data-id="${menu}" data-building="${b.id}"`,
                ),
              )
              .join('')
          : '');
    if (b.kind === 'haybarn')
      html += `<p>Dry bulk storage: ${b.capacity} hay bales per item slot. Buy seasonal harvests, keep a winter reserve and sell to livestock keepers. This is a trading business, with no automatic production or paid jobs. Fund purchase bids in Building Admin; owners move their own bales through Stockroom.</p>`;
    if (b.kind === 'farm') {
      const season = calendar(world).season;
      const plantingCrops = Object.entries(crops).filter(
        ([id, c]) => c.seasons.includes(season) && !farmStaffBlocker(world!, me!, b, c.seed, id),
      );
      html += selfOwned
        ? farmPolicyEditor(world, b)
        : `<p data-farm-policy-status>${esc(farmPolicySummary(world, b))}</p>`;
      if (selfOwned) {
        const blocked = farmExpansionBlocker(world, b, me);
        html += `<h3>Farmland</h3><p>${farmPlotCount(b)} / ${constructionRules(world.settings).maximumFarmPlots} plots · each plot is 7 × 6 metres. Buy an adjoining four-plot parcel using personal cash. Land remains with this farm when sold. Crops still need seed capital, care and manual harvesting.</p>${farmPlotCount(b) < constructionRules(world.settings).maximumFarmPlots ? button('Buy four more plots · ' + money(farmExpansionCost(b)), 'farm', `data-id="expand" data-building="${b.id}" ${!near || blocked || me.cash < farmExpansionCost(b) ? 'disabled' : ''}`) : ''}${blocked ? `<p class="note">${esc(blocked)}</p>` : ''}`;
      }
      const canTend =
        b.owner === me!.id ||
        (world!.settings.jobsEnabled !== false && b.employees.includes(me!.id));
      const offer = canTend ? harvestOffer(world!, b, me!) : undefined;
      const harvestAll = offer?.ripe
        ? `<p class="note" data-harvest-all>${esc(offer.note)}</p>${button(offer.percent < 100 ? `Harvest all · ${offer.percent}%` : 'Harvest all', 'farm', `data-building="${b.id}" data-id="harvestAll"`)}`
        : '';
      html += `<h3>${farmPlotCount(b)} plots · ${season}</h3><p>Learn farmer and own this farm or take a job here. Seeds and fertilizer use its investment account. Irrigation uses world moisture and crop-thirst rules, with up to ${farmYieldRules(world!.settings).farmIrrigationTreatments} watering treatments per crop; repeated crop families lose ${farmYieldRules(world!.settings).farmRotationYieldPenalty.toLocaleString('en', { style: 'percent', maximumFractionDigits: 10 })} yield. Harvesting one plot takes 15 seconds. Harvest all takes half again as long. Staff receive the posted wage per harvested plot. Growth continues offline. Finish harvesting before winter begins or the crop is lost.</p>${harvestAll}${plantingCrops.length ? '' : `<p class="notice" data-planting-notice>${season === 'Winter' ? 'No crops can be planted in winter.' : 'No crops are currently available for you to plant.'}${season === 'Winter' ? ' Planting resumes in spring. Unharvested crops die at the start of winter; stored produce is safe.' : ' Check the planting season and the owner’s staff rules and budget.'}</p>`}<div class="cards">${Array.from(
        { length: farmPlotCount(b) },
        (_, i) => {
          const plot = b.plots?.[i],
            status = cropStatus(world!, b, i);
          const attrs = `data-building="${b.id}" data-plot="${i}"`;
          return `<article><h3>Plot ${i + 1} · ${plot?.crop ? esc(crops[plot.crop].name) : 'Fallow'}</h3>${
            status.state === 'withered'
              ? '<p class="notice">Crop lost to winter.</p>'
              : plot?.crop
                ? `<p>${status.state === 'ripe' ? 'Ready to harvest' : `${status.days} game days remaining`} · estimated ${status.yield} units<br>Irrigation ${Math.round(status.water * 100)}% · watering treatments ${plot.water}/${farmYieldRules(world!.settings).farmIrrigationTreatments}${plot.water >= farmYieldRules(world!.settings).farmIrrigationTreatments ? ' (watering limit reached)' : ''} · fertilizer ${plot.fertilized ? `${farmYieldRules(world!.settings).farmCompostYieldBonus.toLocaleString('en', { style: 'percent', maximumFractionDigits: 10 })} bonus` : 'none'}</p>${button(`Water · ${farmYieldRules(world!.settings).farmIrrigationWaterCost} stocked/carried water`, 'farm', attrs + ' data-id="water"')}${button(`Fertilize · stocked/carried compost or ${money(fertilizerPrice)}`, 'farm', attrs + ' data-id="fertilize"')}${button('Harvest', 'farm', attrs + ' data-id="harvest"')}`
                : plantingCrops.length
                  ? `<form data-action="farm">${hidden('building', b.id)}${hidden('plot', String(i))}${hidden('operation', 'plant')}${select(
                      'crop',
                      plantingCrops.map(([id, c]) => [
                        id,
                        `${c.name} · ${c.days / 6}h · seed ${money(c.seed)}`,
                      ]),
                    )}<button>Plant seeds</button></form>`
                  : '<p class="note">Resting until planting season.</p>'
          }${plot?.winterLoss ? `<p class="note">${esc(crops[plot.winterLoss]?.name ?? plot.winterLoss)} lost to winter.</p>` : ''}${!plot?.crop && plot ? button('Drain · 6 stocked/carried gravel', 'farm', attrs + ' data-id="drain"') + button('Restore soil · stocked/carried dirt + compost', 'farm', attrs + ' data-id="improve"') : ''}${plot?.crop ? `<p>${esc(crops[plot.crop].description)} Frost sensitivity ${farmYieldRules(world!.settings)[cropFrostKeys[plot.crop as keyof typeof cropFrostKeys]]}; maximum frost yield loss ${farmYieldRules(world!.settings).farmFrostMaximumLoss.toLocaleString('en', { style: 'percent', maximumFractionDigits: 10 })}. Zero sensitivity or cap removes frost yield loss.${plot.drainage ? ' Gravel drainage installed.' : ''}</p>` : ''}</article>`;
        },
      ).join(
        '',
      )}</div><p class="note">One day = 10 real minutes. Four seasons span ${(calendarYearSeconds(world!.settings) / 3600).toFixed(2)} real hours. Ripe crops keep full quality for ${farmYieldRules(world!.settings).farmRipeQualitySeconds} real seconds after ripening, then lose ${farmYieldRules(world!.settings).farmLateLossPerDay.toLocaleString('en', { style: 'percent', maximumFractionDigits: 10 })} per game day up to ${farmYieldRules(world!.settings).farmLateMaximumLoss.toLocaleString('en', { style: 'percent', maximumFractionDigits: 10 })}. Zero rate or maximum loss removes lateness loss. Winter kills all unharvested crops.</p>`;
    }
    if (b.kind === 'garage' && world.settings.fighting)
      html += button(
        `Refit ammunition · ${money(economyRules(world.settings).ammunitionRefitPrice)}`,
        'refit',
        `data-building="${b.id}"`,
      );
    if (b.kind === 'starport') {
      const flight = spaceportFlight(world.id, world.time);
      html += `<h3>Cargo launcher</h3><p>${flight.phase === 'docked' ? `Next launch in ${Math.ceil((flight.next - world.time) / 60)} minutes.` : flight.phase === 'away' ? 'Cargo ship in flight; returning to the pad half a game day after departure.' : `Cargo ship: ${flight.phase}.`} The service departs every three or four game days. Keep clear of the reserved launch pad; this ambient flight does not change your own travel bookings.</p>`;
    }
    html +=
      livestockPanel(world, me, b) +
      butcherPanel(world, me, b) +
      meatMenuPanel(world, me, b) +
      homeCookingPanel(world, me, b);
    if (b.kind === 'lighthouse') {
      const keeper = me.job === b.id && b.employees.includes(me.id);
      const guest = b.lodging?.guests[me.id];
      html += `<h3>Lighthouse keeper</h3><p>One paid place, no qualification or deposit. The keeper may live here while employed; ownership alone does not provide housing. Bring your own food and water. Keeper wage: ${money(lighthouseWage(world.settings, b.wage))} per game day before tax. The navigation service pays the private owner 4d per game day into Working capital.</p>`;
      if (world.settings.jobsEnabled !== false)
        html += button(
          keeper ? 'Renew keeper shift' : 'Take keeper job',
          'job',
          `data-building="${b.id}" ${!near || !jobVacancy(world, b, me.id) ? 'disabled' : ''}`,
        );
      if (keeper)
        html +=
          button('Enter keeper quarters', 'home', `data-building="${b.id}"`) +
          button('Leave keeper job', 'quit');
      if (guest)
        html += `<h3>Your keeper pantry</h3><p>${
          itemEntries(
            me.roomPantries?.[b.id] ?? guest.stock,
            items,
            me.roomPantries?.[b.id] ?? guest.stock,
          )
            .filter(([, n]) => n > 0)
            .map(([k, n]) => `${esc(items[k]?.name ?? k)} × ${n}`)
            .join(' · ') || 'No provisions stored.'
        }</p><form data-action="lodging">${hidden('building', b.id)}${hidden('operation', 'store')}${select(
          'item',
          itemEntries(items, items, me.inventory, me.roomPantries?.[b.id] ?? guest.stock)
            .filter(([id, d]) => d.food || d.drink || rawMeats.includes(id))
            .map(([k, d]) => [k, d.name]),
        )}${field('Quantity', 'quantity', 1, 'number', 'min="1" max="100"')}${select('direction', [
          ['deposit', 'Store provisions'],
          ['withdraw', 'Collect provisions'],
        ])}<button>Transfer provisions</button></form>`;
    }
    if (b.kind === 'home')
      html += `<p>While inside, hunger and thirst drain at ${Math.round((world.settings.homeNeedsMultiplier ?? 0.8) * 100)}% of the normal rate. Your home feeds you from its storeroom even while you are offline. ${world.settings.autoConsumeInventory ? (onlineInventory(world) ? 'Carried food and drink are also eaten automatically, online and offline.' : 'Carried food and drink are eaten automatically while you are signed off; use them yourself while signed in.') : 'Carried food and drink must be used manually.'} Beer and wine are never consumed automatically. ${world.settings.autoConsumeHomeStock ? 'Your selected home also supplies meals while you are away.' : 'Home supplies are used only while inside.'} Hunger, thirst and starvation damage continue offline. Stock enough food and water before signing off; running out can kill you. Ageing still pauses while offline. Your chimney stays active while you are inside.</p>${selfOwned ? button('Go home', 'home', `data-building="${b.id}"`) : ''}`;
    if (roomCount(b)) {
      const l = b.lodging,
        guest = l?.guests[me.id],
        booked = guest && guest.until > world.time;
      html += `<h3>${roomCount(b)} guest rooms</h3><p>${Object.values(l?.guests ?? {}).filter((g) => g.until > world!.time).length} booked · ${money(l?.rate ?? 600)} per real hour · ${l?.open ? 'Accepting guests' : 'Closed to new bookings'}</p><p>Prepaid stays last 1–24 real hours. Enter your room to eat and drink from your personal stores, including offline. Checkout has no refund; your leftover supplies remain collectible. The owner cannot take guest supplies.</p>${booked ? `<p>Your stay: ${Math.ceil((guest.until - world.time) / 60)} minutes left</p>${button('Enter your room', 'home', `data-building="${b.id}"`)}<form data-action="lodging">${hidden('building', b.id)}${hidden('operation', 'checkout')}<button>Check out early</button></form>` : `<form data-action="lodging">${hidden('building', b.id)}${hidden('operation', 'rent')}${field('Real hours', 'hours', 6, 'number', 'min="1" max="24"')}<button ${!l?.open ? 'disabled' : ''}>Book a room</button></form>`}`;
      if (guest)
        html += `<h3>Your room pantry</h3><p>${
          itemEntries(
            me.roomPantries?.[b.id] ?? guest.stock,
            items,
            me.roomPantries?.[b.id] ?? guest.stock,
          )
            .filter(([, n]) => n > 0)
            .map(([k, n]) => esc(items[k].name) + ' × ' + n)
            .join(' · ') || 'No provisions stored yet.'
        }</p><form data-action="lodging">${hidden('building', b.id)}${hidden('operation', 'store')}${select(
          'item',
          itemEntries(items, items, me.inventory, me.roomPantries?.[b.id] ?? guest.stock)
            .filter(([id, d]) => d.food || d.drink || rawMeats.includes(id))
            .map(([k, d]) => [k, d.name]),
        )}${field('Quantity', 'quantity', 1, 'number', 'min="1" max="100"')}${select('direction', [
          ['deposit', 'Store provisions'],
          ['withdraw', 'Collect provisions'],
        ])}<button>Transfer provisions</button></form>`;
      if (selfOwned && me.skills.includes('innkeeper'))
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
      html += `<p>Bank balance: ${money(me.bank)}</p><form data-action="bank">${hidden('building', b.id)}${field('Amount in denarii', 'denarii', 10, 'number', `min="0.01" max="${economyRules(world.settings).cashTransferLimit / 100}" step="0.01"`)}${select(
        'direction',
        [
          ['deposit', 'Deposit'],
          ['withdraw', 'Withdraw'],
        ],
      )}<button>Transfer</button></form>`;
    if (b.kind === 'bank') html += bankLoans(world, me, b);
    if (b.kind === 'town') html += townPanel(world, me, b);
    if (b.kind === 'pub')
      html +=
        '<p>Welcome to The Unsteady Axle. There is beer, a noticeboard, and absolutely no dress code.</p>' +
        button('Parish activities', 'activities');
    if ((!b.owner || b.forSale) && b.owner !== me.id && !b.government)
      html += `<div class="purchase"><span data-property-quote="${b.id}"></span>${button('Buy this property', 'buyBuilding', `data-building="${b.id}"`, 'primary')}</div>`;
    if ((b.recipe || b.production) && b.kind !== 'farm') {
      const r = productionRecipe(world, b)!;
      const interval = productionInterval(world, b);
      html += `<h3>Production</h3><p>${
        Object.entries(r.inputs)
          .map(
            ([k, n]) =>
              `${n} ${k === 'feed' && acceptsHay(b) ? 'Hay or livestock feed' : esc(items[k].name)}`,
          )
          .join(' + ') || 'Raw extraction'
      } → ${Object.entries(r.outputs)
        .map(([k, n]) => `${n} ${esc(items[k].name)}`)
        .join(
          ' + ',
        )} · ${interval / 60} minutes · ${esc(r.skill)}</p><p class="note"><span data-production-status>${esc(productionStatus(world, b))}</span> Batches use this building's stockroom and need inputs, output space and funded wages. Efficiency sets batch speed: an ideal crew gives 100%; too few or too many active workers slow production. Partial progress carries over. Wages are paid per completed batch, not per check.</p>`;
    }
    const shift = workShift(world, me, b);
    const workAttributes = `data-building="${b.id}" data-work-button ${!near || !shift?.canRenew ? 'disabled' : ''}`;
    if (
      selfOwned &&
      world.settings.ownerOperation &&
      (b.kind === 'automotiveFactory' || b.recipe || b.production) &&
      b.kind !== 'farm'
    )
      html += shift
        ? button(shift.button, 'work', workAttributes)
        : `<p class="note">Learn ${esc(b.kind === 'automotiveFactory' ? (b.manufacturing?.orders[0]?.skill ?? automotiveConfig(world).factory.skill) : productionRecipe(world, b)!.skill)} to operate your business without wages.</p>`;
    if (
      !selfOwned &&
      world.settings.jobsEnabled !== false &&
      (b.kind === 'automotiveFactory' || b.recipe || b.production)
    )
      html += `<div class="employment"><span>Employment · ${money(b.wage)} per ${b.kind === 'farm' ? 'harvested plot' : 'production cycle'} · ${b.employees.length}/${hiringLimit(world, b)} paid places</span>${button(me.job === b.id ? shift!.button : !jobVacancy(world, b, me.id) ? 'Hiring closed' : 'Take this job', me.job === b.id ? 'work' : 'job', me.job === b.id ? workAttributes : `data-building="${b.id}" ${!near || !jobVacancy(world, b, me.id) ? 'disabled' : ''}`)}</div>`;
    if (shift)
      html += `<p class="note" data-work-status>${esc(`${shift.label}. ${shift.detail}`)}</p>`;
    if (['sawmill', 'quarry', 'forge'].includes(b.kind) && !(selfOwned && b.kind === 'forge'))
      html += button(
        b.kind === 'forge' ? 'Craft tools (1 steel + 2 wood)' : 'Gather raw materials',
        b.kind === 'forge' ? 'task' : 'resources',
        `data-building="${b.id}" data-id="${b.kind === 'sawmill' ? 'logging' : b.kind === 'quarry' ? 'quarrying' : 'craft'}"`,
      );
  }
  if (tab === 'Stockroom')
    html += owned
      ? `<p>Transfer between your vehicle and the building. Items held in either place come first, alphabetically. Storage limit: ${b.capacity} per item.</p><form data-action="stock">${hidden('building', b.id)}${select(
          'item',
          itemEntries(items, items, b.stock, me.inventory).map(([id, d]) => [
            id,
            `${d.name} · stock ${b.stock[id] ?? 0} / carrying ${me!.inventory[id] ?? 0}`,
          ]),
          'Item',
        )}${field('Quantity', 'quantity', 1, 'number', 'min="1"')}${select('direction', [
          ['deposit', 'Store items'],
          ['withdraw', 'Collect items'],
        ])}<button>Transfer stock</button></form>`
      : '<p>The stockroom belongs to the owner. Use the trade window instead.</p>';
  if (tab === 'Building Admin' && tradingSelection?.building !== b.id)
    tradingSelection = {
      building: b.id,
      item: Object.keys(b.buy)[0] ?? Object.keys(b.sell)[0] ?? Object.keys(items)[0],
      side: 'buy',
    };
  if (tab === 'Building Admin' || tab === 'Investment')
    html += owned
      ? `<div class="admin-grid"><form data-action="investment">${hidden('building', b.id)}${caretaker ? hidden('caretaker', 'true') : ''}<h3>Working capital</h3>${
          remainingClaim(b)
            ? `<p>Outside stakes lock ${money(remainingClaim(b))} in this till. You may withdraw ${money(ownerWithdrawable(world, b))} of your own surplus; invested cash stays until investors are paid from earnings.</p>`
            : ''
        }${field('Denarii', 'denarii', 50, 'number', `min="0.01" max="${economyRules(world.settings).cashTransferLimit / 100}" step="0.01"`)}${select(
          'direction',
          [
            ['deposit', 'Invest cash'],
            ['withdraw', 'Collect earnings'],
          ],
        )}<button>Transfer cash</button></form><form data-action="buildingAdmin" data-business-details="${esc(b.id)}">${hidden('building', b.id)}<h3>Business details</h3><p data-saved-wage></p>${field('Building name', 'name', b.name, 'text', 'maxlength="48"')}${field('Wage in denarii', 'wageDenarii', b.wage / 100, 'number', 'min="0" max="10000" step="0.01" required')}<button>Save details</button></form><form data-action="buildingAdmin" data-price-editor="${esc(b.id)}">${hidden('building', b.id)}<h3>Set trading prices</h3><p class="note" data-shop-tax></p>${select(
          'item',
          itemEntries(items, items, b.stock, me.inventory).map(([id, d]) => [id, d.name]),
          'Item',
          tradingSelection!.item,
        )}${select(
          'side',
          [
            ['buy', 'Building buys'],
            ['sell', 'Building sells'],
          ],
          'Trade direction',
          tradingSelection!.side,
        )} ${select(
          'enabled',
          [
            ['true', 'Trading enabled'],
            ['false', 'Not trading this item'],
          ],
          'Trading status',
        )}<p data-saved-price></p>${field('Denarii per item', 'priceDenarii', '', 'number', `min="${economyRules(world.settings).minimumBuyPrice / 100}" step="0.01" required placeholder="Enter a price to resume trading"`)}<button>Save trading settings</button><div data-current-prices></div></form>${bulkDiscountEditor(b)}</div>`
      : !b.government && !b.construction
        ? `<form data-action="investment">${hidden('building', b.id)}<h3>Outside investment</h3><p>Fund this till so it can buy goods and pay wages even if the owner is away. You collect a return only after the business earns, up to ${economyRules(world.settings).outsideReturnPercent}% above what you put in, and you cannot take the stake back. The operating reserve is at least ${money(economyRules(world.settings).outsideOperatingReserve)}; existing claims keep their agreed terms.</p>${field('Denarii', 'denarii', 50, 'number', `min="0.01" max="${economyRules(world.settings).cashTransferLimit / 100}" step="0.01"`)}${select(
            'direction',
            [
              ['deposit', 'Invest cash'],
              ['withdraw', 'Collect earned return'],
            ],
          )}<button>Transfer cash</button></form>`
        : '<p>Only the owner may manage this building.</p>';
  if (
    tab === 'Main' &&
    (world.creator?.rules.some((r) => r.enabled && r.event === 'interact' && r.target === b.id) ||
      world.creator?.quests?.some((q) =>
        q.steps.some((s) => s.event === 'interact' && (!s.target || s.target === b.id)),
      ) ||
      world.scriptInteraction)
  )
    html += button(
      'World interaction',
      'interactObject',
      `data-id="${esc(b.id)}" ${!near ? 'disabled' : ''}`,
    );
  if (
    tab === 'Building Admin' &&
    owned &&
    !b.government &&
    !b.lien &&
    !b.operatingLease &&
    !b.auction
  )
    html += `<form data-action="listProperty">${hidden('building', b.id)}<h3>Sell this property</h3><p>Stock and investment stay with the business. The purchase price is paid directly to you.</p>${field('Asking price in denarii', 'priceDenarii', b.price / 100, 'number', 'min="0.01" step="0.01"')}<button>${b.forSale ? 'Update asking price' : 'List property for sale'}</button></form>${b.forSale ? `<form data-action="unlistProperty">${hidden('building', b.id)}<p>Currently listed for ${money(b.price)}.</p><button>Remove from sale</button></form>` : ''}`;
  if (
    tab === 'Building Admin' &&
    owned &&
    (b.kind === 'automotiveFactory' || b.recipe || b.production)
  )
    html += staffingPanel(world, b) + economicsPanel(world, b);
  if (tab === 'Main' || tab === 'Building Admin') html += contractPanel(world, me, b);
  if (tab === 'Statement')
    html += `<section data-business-statement="${esc(b.id)}">${statementHtml(world, me, b)}</section>`;
  if (tab === 'Extra Info')
    html += `<p>Building condition: ${b.condition.toFixed(1)}%. Government properties do not decay.</p><p>Production needs input stock, output space, and enough investment to pay wages. Each production building has an ideal active crew. Below it, efficiency is active ÷ ideal; above it, ideal ÷ active. Unstaffed private businesses run at ${world.settings.offlineEfficiency * 100}%.</p>${owned && !b.operatingLease && !b.auction ? button('Repair building', 'repair', `data-building="${b.id}"`) + button('Demolish building', 'demolish', `data-building="${b.id}"`) : ''}${me.job === b.id ? button('Quit job', 'quit') : ''}`;
  modal(b.name, html, true);
  if (b.kind === 'garage' && tab === 'Main')
    closeTractorPreview = mountTractorShop($('modal-host'), world, me, b);
  refreshTradingPrices();
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
  if (tab === 'Main') tab = 'Start here';
  if (creatorTabs.includes(tab)) {
    modal(
      'World creator studio',
      `<nav class="tabs">${[...creatorTabs, 'Rules', 'Towns', 'Landscape', 'Buildings', 'Zones', 'Script', 'Assets', 'Ledger'].map((t) => button(t, 'tab', `data-id="${t}"`, t === tab ? 'active' : '')).join('')}</nav>` +
        creatorPanel(world, me, tab),
      true,
    );
    creatorControls(world);
    if (tab === 'Workshop') refreshCreatorPreview(world);
    return;
  }
  modal(
    'Your world. Your peculiar rules.',
    `<nav class="tabs">${[...creatorTabs, 'Rules', 'Towns', 'Landscape', 'Buildings', 'Zones', 'Script', 'Assets', 'Ledger'].map((t) => button(t, 'tab', `data-id="${t}"`, tab === t || (tab === 'Main' && t === 'Rules') ? 'active' : '')).join('')}</nav>${
      tab === 'Towns'
        ? `<p>The charter decides how towns work on this world: who may found them, how their borders grow, how they are governed and which rules their governments control. Changes apply live.</p>${charterForm(world)}`
        : tab === 'Main' || tab === 'Rules'
          ? `<p>Changes apply live to everyone. Tune cautiously; people have businesses here. Death retention values run from 0 (lose all) to 1 (keep all). Set hunger/thirst rates to 0 to disable needs. maxOfflineDays uses real days; 0 disables the absence limit.</p><form id="settings-form"><div class="settings-grid">${settingsFields(world.settings)}</div><button class="primary">Apply changes to server</button></form>`
          : tab === 'Landscape'
            ? landscapeEditor(world, me)
            : tab === 'Buildings'
              ? `<form data-action="place">${select(
                  'kind',
                  Object.entries(definitions).map(([id, d]) => [id, d.name]),
                  'Building type',
                )}${field('X', 'x', Math.round(me.x), 'number')}${field('Z', 'z', Math.round(me.z), 'number')}<button>Place building</button></form><h3>Manage existing buildings as caretaker</h3><p>These tools use administrator permissions, separate from properties you personally own.</p><div class="directory">${world.buildings.map((b) => button(esc(b.name), 'manage-building', `data-id="${b.id}"`)).join('')}</div>`
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
                  ? `<p>Sandboxed Lua. Events: PlayerLogin, ScriptReload, TaskStart, TaskComplete, ObjectInteract, ZoneEnter, Timer. Functions: on, announce, getvar, setvar, kudos, heal, needs, give, teleport, score, object_visible, player_value. See the World Building and Scripting guides for examples. Memory, instruction and time limits enforced.</p><form id="script-form"><label>World script<textarea name="source" aria-label="World script" rows="14" spellcheck="false">${esc(world.script)}</textarea></label><button>Validate & reload Lua</button></form>`
                  : tab === 'Assets'
                    ? `<p>Upload original PNG, JPEG, MP3, OBJ or GLB assets (2 MiB each, 32 per world). Images: up to 2048 × 2048 pixels. OBJ: static faces, up to 50,000 triangles; select a PNG/JPEG texture atlas in Workshop. GLB: embedded media, up to 128 primitives, 8 animation clips and 64 joints per skin. No external resources, morph targets or extensions. Choose a clip in Workshop. Assign visuals in Workshop. Uploaded media is cached by each client. Select an asset below to preview it.</p><form id="asset-form"><input name="file" type="file" accept="image/png,image/jpeg,audio/mpeg,.glb,.obj" required><label>Author<input name="author" maxlength="120"></label><label>Licence<input name="license" maxlength="120" placeholder="e.g. CC0-1.0, CC-BY-4.0, original work"></label><label>Source / credits<input name="source" maxlength="300"></label><button>Upload asset</button></form>${texturePainterMarkup()}<div class="asset-list">${world.assets.map((a) => (a.type.startsWith('image/') ? `<figure><img src="${esc(withBase(a.url))}" alt="${esc(a.name)}"><figcaption>${esc(a.name)}</figcaption></figure>` : a.type.startsWith('audio/') ? `<label>${esc(a.name)}<audio controls src="${esc(withBase(a.url))}"></audio></label>` : `<a href="${esc(withBase(a.url))}" download>${esc(a.name)} · ${a.type === 'model/obj' ? 'OBJ' : 'GLB'}</a>`)).join('')}</div>`
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
  if (tab === 'Assets')
    mountTexturePainter(world.id, async (blob, name) => {
      const response = await fetch(withBase('/api/assets/' + world!.id), {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + token,
          'content-type': 'image/png',
          'x-asset-name': encodeURIComponent(name + '.png'),
          'x-asset-provenance': encodeURIComponent(
            JSON.stringify({
              author: account?.name ?? '',
              license: 'Original work',
              source: 'Painted in Aclone',
            }),
          ),
        },
        body: blob,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
    });
  if (tab === 'Landscape') landscapeControls(world, send);
}
app.addEventListener('click', async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-do]');
  if (!el) return;
  const action = el.dataset.do!,
    id = el.dataset.id,
    building = el.dataset.building;
  try {
    if (action.startsWith('creator:') && world) {
      const op = action.slice(8);
      if (op === 'export' || op === 'exportBundle') {
        download(
          'aclone-world-design.json',
          JSON.stringify(
            await api('/api/design/' + world.id + (op === 'exportBundle' ? '?media=1' : '')),
            null,
            2,
          ),
        );
        return;
      }
      creatorClick(op, id ?? '', world, send);
      renderPanel();
      return;
    }
    if (action === 'manage-building' && (me?.authority ?? 0) >= 20) {
      caretakerBuilding = id ?? '';
      selected = id ?? '';
      openPanel('building');
      return;
    }
    const panels = [
      'radio',
      'loans',
      'menu',
      'reports',
      'statistics',
      'social',
      'quests',
      'procurement',
      'mobile-actions',
      'directory',
      'taxes',
      'map',
      'npc',
      'players',
      'help',
      'options',
      'worldRules',
      'courses',
      'controllerOptions',
      'shipyard',
      'inventory',
      'skills',
      'resources',
      'activities',
      'construction',
      'earthworks',
      'bridges',
      'editor',
      'caretaker',
      'create',
    ];
    if (panels.includes(action)) {
      openPanel(action);
      return;
    }
    switch (action) {
      case 'social-tab':
        socialPane = ['letters', 'family', 'trades'].includes(id!) ? id! : 'letters';
        showSocialPane($('modal-host'), socialPane);
        break;
      case 'deleteMail':
        send({ type: action, message: id, folder: el.dataset.folder });
        break;
      case 'acceptTrade':
      case 'cancelTrade':
        send({ type: action, offer: id });
        break;
      case 'family-join':
      case 'family-decline':
      case 'family-leave':
      case 'family-remove':
        send({ type: 'family', operation: action.slice(7), family: id, player: id });
        break;

      case 'galaxy-travel': {
        const trip = await api('/api/federation/depart', {
          method: 'POST',
          body: JSON.stringify({ destination: id }),
        });
        if (account && !account.traveler) localStorage.setItem('aclone.homePilot', token);
        location.assign(trip.url);
        break;
      }
      case 'galaxy-arrival':
        await showArrival();
        break;
      case 'arrival-cancel':
        sessionStorage.removeItem('aclone.arrival');
        if (token) void connect();
        else login();
        break;
      case 'interactObject':
        send({ type: 'interactObject', object: id });
        closePanel();
        break;
      case 'caretaker-tab':
        caretakerUi = { ...caretakerUi, tab: id || 'Overview', selected: '' };
        renderPanel();
        if (caretakerUi.tab === 'Chat logs' && !caretakerUi.logs?.chat)
          void loadCaretakerLog('chat');
        if (caretakerUi.tab === 'Overview' && !caretakerUi.logs?.notices)
          void loadCaretakerLog('notices');
        break;
      case 'caretaker-open':
        caretakerUi = { ...caretakerUi, selected: id ?? '' };
        renderPanel();
        break;
      case 'caretaker-older':
        void loadCaretakerLog(id === 'chat' ? 'chat' : 'notices');
        break;
      case 'caretaker-refresh':
        void loadCaretakerLog(caretakerUi.tab === 'Chat logs' ? 'chat' : 'notices', true);
        send({ type: 'caretaker' });
        break;
      case 'player':
        selected = id!;
        openPanel('player');
        break;
      case 'player-chat': {
        const target = world?.players[id!];
        if (target) {
          setChatRecipient({ id: target.id, name: target.name });
          closePanel();
          focusChat();
        }
        break;
      }
      case 'detach':
        send({ type: 'detach' });
        break;
      case 'repairVehicle':
      case 'hitch':
      case 'refuelPlayer':
        send({ type: action, player: id });
        break;
      case 'npc-chat': {
        const resident = npcResidents?.find((r) => r.playerId === id);
        if (resident) {
          setChatRecipient({ id: resident.playerId, name: resident.name });
          closePanel();
          focusChat();
        }
        break;
      }
      case 'chat-public':
        setChatRecipient();
        focusChat();
        break;
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
      case 'building-outside':
        if (outdoorServiceButton(id)) {
          caretakerBuilding = '';
          selected = id!;
          openPanel('building');
        }
        break;
      case 'building':
        caretakerBuilding = '';
        openInteraction(id!);
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
        break;
      case 'select-weapon':
        if (id && weapons[id]) weapon = id;
        closePanel();
        break;
      case 'camera-zoom':
        scene.setZoom(scene.zoom + (id === 'in' ? -0.25 : 0.25));
        break;
      case 'camera':
        scene.cameraMode = (scene.cameraMode + 1) % 3;
        toast(['Chase camera', 'First person', 'Overhead camera'][scene.cameraMode]);
        break;
      case 'horn':
        send({ type: 'horn' });
        break;
      case 'discard':
        send({ type: 'discard', item: id, quantity: 1 });
        break;
      case 'drinkSpring':
        send({ type: 'drinkSpring', spring: id });
        break;
      case 'use':
        send({ type: 'use', item: id });
        break;
      case 'sellAll':
        send({
          type: 'trade',
          building,
          item: el.dataset.item,
          quantity: Number(el.dataset.quantity),
          direction: 'sell',
          expectedPrice: Number(el.dataset.price),
        });
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
          expectedPrice: Number(el.dataset.price),
          expectedTotal: Number(el.dataset.total),
        });
        break;
      case 'serviceVehicle':
      case 'buyMap':
        send({ type: action, building });
        break;
      case 'boat-recovery-dock': {
        const r = world?.boatRescues?.[me!.id];
        const d = world && boatLandings(world).find((d) => d.id === r?.dinghy.landing);
        if (d) waypoints.set({ ...d.land, name: 'Recovery lifeboat' });
        closePanel();
        break;
      }
      case 'boat-rescue-waypoint': {
        const r = world?.boatRescues?.[me!.id];
        if (r) waypoints.set({ ...r.boat, name: 'Your stranded boat' });
        closePanel();
        break;
      }
      case 'seafoodMenu':
        send({ type: 'seafoodMenu', building, menu: id });
        break;
      case 'boatIdle':
        send({ type: 'boatIdle' });
        break;
      case 'earthmoving-implement':
        send({ type: 'earthmovingImplement' });
        break;
      case 'lights':
        if (
          me &&
          (poweredBoat(me.vehicle, world) || vehicleDef(world, me.vehicle).lights?.length) &&
          !me.hitch
        )
          openPanel('boat-lighting');
        else send({ type: 'lights' });
        break;
      case 'trawl-toggle':
        localStorage.setItem(
          'aclone.trawl-expanded',
          localStorage.getItem('aclone.trawl-expanded') === 'yes' ? 'no' : 'yes',
        );
        break;
      case 'boatLights':
        send({ type: 'boatLights', circuit: id });
        break;
      case 'charter':
        send({
          type: 'charter',
          operation: id,
          captain: el.dataset.captain,
          player: el.dataset.player,
          fare: Math.round(
            Number(
              (document.getElementById('charter-fare') as HTMLInputElement)?.value ??
                charterRules(world?.settings).charterDefaultFare / 100,
            ) * 100,
          ),
          minutes: Number(
            (document.getElementById('charter-minutes') as HTMLInputElement)?.value ??
              charterRules(world?.settings).charterDefaultMinutes,
          ),
        });
        break;
      case 'expedition':
        send({
          type: 'expedition',
          operation: id,
          captain: el.dataset.captain,
          player: el.dataset.player,
          item: el.dataset.item,
          quantity: Number(
            (document.getElementById('boat-store-quantity') as HTMLInputElement)?.value ?? 1,
          ),
          share: Number((document.getElementById('crew-share') as HTMLInputElement)?.value ?? 15),
        });
        break;
      case 'trawl':
        send({ type: 'trawl', operation: id });
        break;
      case 'lifeboat':
        send({ type: 'lifeboat', operation: id });
        break;
      case 'find-tractor': {
        if (!world || !me) break;
        if (!mapAvailable(world, me)) {
          toast('Carry a parish map to use tractor navigation in this world.', true);
          break;
        }
        const point = tractorWaypoint(world, me);
        if (!point) {
          toast(
            isTractor(me.vehicle)
              ? 'You are already driving a tractor.'
              : !persistentVehicles(world, me)
                ? 'This world uses instant vehicle switching; choose Return to tractor.'
                : 'No parked tractor found in this world.',
          );
          break;
        }
        waypoints.set(point);
        closePanel(false);
        updateHud();
        break;
      }
      case 'parked-waypoint': {
        const status = world && me && parkingStatus(world, me);
        if (status) waypoints.set(status.point);
        break;
      }
      case 'refuelParked':
        send({ type: 'refuelParked', slot: Number(id) });
        break;
      case 'vehicle':
        if (
          world &&
          me?.inside &&
          building === me.inside &&
          world.buildings.find((b) => b.id === building)?.kind === 'garage'
        ) {
          garageDeparture = { world: world.id, slot: Number(id), building };
          closePanel();
        } else send({ type: 'vehicle', slot: Number(id), building });
        break;
      case 'outside':
        send({ type: 'outside', depart: el.dataset.depart });
        closePanel(false);
        break;
      case 'walk':
      case 'tractor':
        send({ type: 'vehicle', slot: action === 'walk' ? 5 : returnTractor(me!) });
        closePanel();
        break;
      case 'learn':
        send({ type: 'learn', skill: id, building });
        break;
      case 'maintenanceToggle':
        send({ type: 'maintenance', paused: !world?.maintenance?.paused });
        break;
      case 'leasesToggle':
      case 'auctionsToggle':
        send({
          type: 'propertyContract',
          operation: 'rules',
          leases:
            action === 'leasesToggle'
              ? !world?.contractRules?.leases
              : !!world?.contractRules?.leases,
          auctions:
            action === 'auctionsToggle'
              ? !world?.contractRules?.auctions
              : !!world?.contractRules?.auctions,
        });
        break;
      case 'courseStart':
      case 'courseStop':
      case 'courseRefund':
        send({
          type: 'course',
          operation:
            action === 'courseStart' ? 'start' : action === 'courseStop' ? 'stop' : 'refund',
          course: id,
        });
        break;
      case 'courseWaypoint': {
        const c = world!.courses?.find((c) => c.definition.id === id);
        if (c) {
          const pt =
            c.definition.points[me?.courseRun && me.courseRun.id === id ? me.courseRun.next : 0];
          waypoints.set({ ...pt, name: c.definition.name });
          closePanel();
        }
        break;
      }
      case 'guideWaypoint': {
        const b = world!.buildings.find((b) => b.id === id);
        if (b) {
          waypoints.set({ x: b.x, z: b.z, name: b.name });
          closePanel();
        }
        break;
      }
      case 'gatherRepeat':
        send({ type: 'gather', node: id, repeat: true });
        break;
      case 'stopGather':
        send({ type: 'stopGather' });
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
        if (id === 'harvest' || id === 'harvestAll') closePanel();
        break;
      case 'paint':
        send({ type: 'paint', building, color: id, slot: Number(el.dataset.vehicle) });
        break;
      case 'construct':
        send({
          type: 'construct',
          kind: id,
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
      case 'crowClass':
        send({ type: 'crow', class: id });
        break;
      case 'crowMark':
        send({ type: 'crowAbility', operation: 'mark' });
        break;
      case 'crowRecall':
        send({ type: 'crowAbility', operation: 'recall' });
        break;
      case 'readBook':
        send({ type: 'readBook', book: id });
        openPanel('book:' + id);
        break;
      case 'lotteryPanel':
        openPanel('lottery');
        break;
      case 'townEvents':
        openPanel('townEvents');
        break;
      case 'hud-hide':
        if (id && id in hudPanels) hud.set(id as HudPanel, false);
        (document.activeElement as HTMLElement)?.blur();
        break;
      case 'hud-preset':
        hud.preset(id === 'all');
        renderPanel();
        break;
      case 'hud':
        openPanel('hud');
        break;
      case 'sound':
        sound.toggle();
        renderPanel();
        break;
      case 'drunkEffects':
        scene.drunkVision.cycle();
        renderPanel();
        break;
      case 'shadows':
        localStorage.setItem(
          'aclone.shadows',
          localStorage.getItem('aclone.shadows') === 'on' ? 'off' : 'on',
        );
        location.reload();
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
        if (world && me) {
          openPanel('worldRules');
          break;
        }
      // In the galaxy there is no world whose offline rules need showing.
      case 'confirmLogout':
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
        panelMemory.clear();
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
        if (['takeoff', 'home', 'outside'].includes(action))
          closePanel(action !== 'home' && action !== 'outside');
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
    if (form.hasAttribute('data-farm-policy')) {
      send({
        type: 'farm',
        building: selected,
        operation: 'policy',
        policy: farmPolicyFormValue(form),
      });
      (document.activeElement as HTMLElement)?.blur();
      return;
    }
    if (form.hasAttribute('data-bulk-discounts')) {
      send({
        type: 'buildingAdmin',
        building: selected,
        bulkDiscounts: bulkDiscountFormValue(data),
      });
      (document.activeElement as HTMLElement)?.blur();
      return;
    }
    if ((form.getAttribute('id') ?? '') === 'arrival-form') {
      const ticket = sessionStorage.getItem('aclone.arrival');
      const local =
        form.dataset.home === 'true' ? (localStorage.getItem('aclone.homePilot') ?? token) : token;
      const result = await api('/api/federation/arrive', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + local },
        body: JSON.stringify({ ticket }),
      });
      if (token && account && !account.traveler) localStorage.setItem('aclone.homePilot', token);
      token = result.token;
      account = result.account;
      localStorage.setItem('aclone.pilot', token);
      localStorage.removeItem('aclone.world');
      sessionStorage.removeItem('aclone.arrival');
      await connect();
    } else if ((form.getAttribute('id') ?? '') === 'register-form') {
      const result = await api('/api/register', { method: 'POST', body: JSON.stringify(data) });
      token = result.token;
      account = result.account;
      localStorage.setItem('aclone.pilot', token);
      await connect();
    } else if ((form.getAttribute('id') ?? '') === 'signin-form') {
      const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });
      token = result.token;
      account = result.account;
      localStorage.setItem('aclone.pilot', token);
      localStorage.removeItem('aclone.world');
      if (sessionStorage.getItem('aclone.arrival')) await showArrival();
      else await connect();
    } else if ((form.getAttribute('id') ?? '') === 'account-form') {
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
    } else if ((form.getAttribute('id') ?? '') === 'forgot-form') {
      const result = await api('/api/auth/forgot', { method: 'POST', body: JSON.stringify(data) });
      toast(result.message);
      form.reset();
    } else if ((form.getAttribute('id') ?? '') === 'recovery-form') {
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
    } else if ((form.getAttribute('id') ?? '') === 'restore-form') {
      token = String(data.key).trim();
      const r = await api('/api/session');
      account = r.account;
      localStorage.setItem('aclone.pilot', token);
      localStorage.removeItem('aclone.world');
      if (sessionStorage.getItem('aclone.arrival')) await showArrival();
      else await connect();
    } else if ((form.getAttribute('id') ?? '') === 'chat-form') {
      const text = String(data.message).trim();
      if (text) send({ type: 'chat', text, ...(chatRecipient ? { to: chatRecipient.id } : {}) });
      form.reset();
      (form.querySelector('input') as HTMLInputElement).focus({ preventScroll: true });
    } else if ((form.getAttribute('id') ?? '') === 'loan-quote-form' && world && me) {
      const b = world.buildings.find((b) => b.id === String(data.building));
      if (b)
        $('loan-quote-result').innerHTML = bankQuote(
          world,
          me,
          b,
          Math.round(Number(data.denarii) * 100),
          Number(data.months),
          String(data.collateral || '') || undefined,
        );
    } else if ((form.getAttribute('id') ?? '') === 'creator-import-form') {
      const file = data.file as File;
      if (file.size > 12 * 1024 * 1024) throw Error('Design/bundle file is too large');
      const imported = JSON.parse(await file.text());
      if (imported.format === 'aclone-world-bundle' && imported.version !== 1)
        throw Error('Unsupported world bundle version');
      await api('/api/worlds', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          template: 'blank',
          design: imported.format === 'aclone-world-bundle' ? imported.design : imported,
          ...(imported.format === 'aclone-world-bundle' ? { assets: imported.assets } : {}),
        }),
      });
      toast('Imported world created in the Hearth system.');
    } else if ((form.getAttribute('id') ?? '').startsWith('creator-') && world) {
      const action = creatorSubmit(form, world);
      if (action) send(action);
    } else if ((form.getAttribute('id') ?? '') === 'create-form') {
      const result = await api('/api/worlds', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          template: data.template,
          ...(data.customSettings ? { settings: settingsData(form) } : {}),
        }),
      });
      toast('Your world is ready. Find it in the Hearth system.');
      closePanel();
      if (inSpace) {
        await showGalaxy();
        if (account?.system === 'hearth') send({ type: 'land', world: result.id });
      } else toast('World created. Take off from the spaceport to visit it.');
    } else if ((form.getAttribute('id') ?? '') === 'money-gift-form') {
      send({
        type: 'giveMoney',
        player: form.dataset.player,
        amount: giftAmount(String(data.denarii), world),
      });
    } else if ((form.getAttribute('id') ?? '') === 'settings-form') {
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
    } else if ((form.getAttribute('id') ?? '') === 'script-form') {
      send({ type: 'script', source: String(data.source) });
      (document.activeElement as HTMLElement)?.blur();
    } else if ((form.getAttribute('id') ?? '') === 'asset-form') {
      const file = data.file as File;
      const response = await fetch(withBase('/api/assets/' + world!.id), {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + token,
          'content-type': /\.obj$/i.test(file.name)
            ? 'model/obj'
            : /\.glb$/i.test(file.name)
              ? 'model/gltf-binary'
              : file.type,
          'x-asset-name': encodeURIComponent(file.name),
          'x-asset-provenance': encodeURIComponent(
            JSON.stringify({
              author: String(data.author ?? ''),
              license: String(data.license ?? 'Unspecified'),
              source: String(data.source ?? ''),
            }),
          ),
        },
        body: file,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      toast('Asset uploaded.');
    } else if (form.dataset.townForm !== undefined) {
      send(townFormAction(new FormData(form).entries()));
      (document.activeElement as HTMLElement)?.blur();
    } else if (form.dataset.charterForm !== undefined) {
      send(charterFormAction(new FormData(form).entries()));
      (document.activeElement as HTMLElement)?.blur();
    } else if (form.hasAttribute('data-vehicle-editor')) {
      send(vehicleForm(form));
    } else if (form.dataset.action) {
      const values: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) {
        values[k] = [
          'limit',
          'plot',
          'hours',
          'rate',
          'quantity',
          'capacity',
          'expectedPrice',
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
          'months',
          'apr',
          'payment',
          'periodSeconds',
        ].includes(k)
          ? Number(v)
          : ['buy', 'open', 'accepted', 'autoPay', 'enabled', 'caretaker', 'automatic'].includes(k)
            ? v === 'true'
            : v;
      }
      if (data.feeDenarii !== undefined) {
        values.fee = Math.round(Number(data.feeDenarii) * 100);
        delete values.feeDenarii;
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
      if (form.dataset.action === 'lottery' && values.operation === 'fund')
        values.amount = Math.round(Number(values.amount) * 100);
      if (form.dataset.action === 'trade' && values.storage === 'hold') {
        const quote =
          form.querySelector<HTMLSelectElement>('select[name="item"]')?.selectedOptions[0]?.dataset
            .price;
        if (quote !== undefined) values.expectedPrice = Number(quote);
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
function outdoorServiceButton(id?: string) {
  if (
    !world ||
    !me ||
    !id ||
    !persistentVehicles(world, me) ||
    me.inside ||
    me.atHome ||
    me.task ||
    !world.buildings.some((b) => b.id === id) ||
    scene.nearest()?.id !== id
  )
    return '';
  return button('Trade & services outside', 'building-outside', `data-id="${id}"`, 'wide');
}
function openInteraction(id: string) {
  if (
    world &&
    me &&
    persistentVehicles(world, me) &&
    !boatSlot(me.vehicle, world) &&
    !me.crowBody &&
    world.buildings.some((b) => b.id === id) &&
    me.inside !== id
  ) {
    requestedArrival = id;
    send({ type: 'approach', building: id });
    arrivalRequest = request;
    return;
  }
  selected = id;
  openPanel(
    id.startsWith('object:')
      ? 'creator-object'
      : id === fishingDock.id
        ? 'fishing-dock'
        : 'building',
  );
}
scene.onBuilding = openInteraction;
scene.onParkedVehicle = (key) => {
  if (!world || !me) return;
  const v = world.parkedVehicles?.[key];
  if (!v) return;
  const reason = boardingReason(world, me, v);
  if (reason) {
    toast(reason);
    return;
  }
  send({ type: 'vehicle', slot: v.slot });
};
window.addEventListener('keydown', (e) => {
  if (
    (e.target as HTMLElement).matches('input,textarea,select') ||
    (e.target as HTMLElement).isContentEditable
  ) {
    if (e.key === 'Escape') (e.target as HTMLElement).blur();
    return;
  }
  if (
    (e.target as HTMLElement).closest('#chat-log') &&
    ['PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)
  )
    return;
  // Preserve keyboard activation of focused controls, including HUD buttons.
  if ((e.target as HTMLElement).closest('button,a[href],summary') && [' ', 'Enter'].includes(e.key))
    return;
  // Enter starts chat from the scenery or chat log; F2 is always available from the HUD.
  if (
    world &&
    !panel &&
    !mobile.drawer &&
    ['Enter', 'F2'].includes(e.key) &&
    !e.ctrlKey &&
    !e.altKey &&
    !e.metaKey
  ) {
    e.preventDefault();
    if (!e.repeat) focusChat();
    return;
  }
  if (mobile.drawer) {
    if (e.key === 'Escape') mobile.close();
    return;
  }
  if (e.key === 'Escape') {
    document.documentElement.classList.remove('scenery-view');
    closePanel();
    mobile.close();
    return;
  }
  if (world && !scene.ready) return;
  if (e.key.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;
  if (panel && e.key === 'Tab') {
    const controls = [
      ...$('modal-host').querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, select, textarea, summary, a[href], [tabindex="0"]',
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
  if (key === 'v' && world) {
    e.preventDefault();
    openPanel('radio');
    return;
  }
  if (key === 't' && panel === 'radio') {
    e.preventDefault();
    radioConsole.transmit(true);
    return;
  }
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
    'f6',
  ];
  if (handled.includes(key)) e.preventDefault();
  keys.add(e.key);
  if (key === 'enter' || key === 'f2') {
    if (panel || !world) return;
    e.preventDefault();
    focusChat();
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
  if (key === 'f6' && me && me.authority >= 20) {
    openPanel('caretaker');
    return;
  }
  if (key === 'f9') {
    openPanel('menu');
    return;
  }
  if (key === 'm' && world) {
    if (panel === 'map') closePanel();
    else openPanel('map');
    return;
  }
  if (key === 'i') {
    openPanel('inventory');
    return;
  }
  if (!world || !scene.ready || panel || mobile.drawer) return;
  if (key === 'e' || key === 'control') {
    const b = scene.nearest();
    if (b) openInteraction(b.id);
  }
  if (key === 'b' && throttleBoat(me?.vehicle ?? -1, world) && !e.repeat)
    send({ type: 'boatIdle' });
  if (key === 'g' && isEarthmover(me?.vehicle ?? -1) && !e.repeat)
    send({ type: 'earthmovingImplement' });
  if (key === 'f4') send({ type: 'engine' });
  if (key === 'l') send({ type: 'lights' });
  if (key === 'f5' || key === 'r') send({ type: 'crow' });
  if (key === 'f3') send({ type: 'reel' });
  if (key === 'c') scene.cameraMode = (scene.cameraMode + 1) % 3;
  if (key === ' ' || key === 'tab') {
    if (key === 'tab' && world.settings.fighting) {
      if (!e.repeat) send({ type: weapon === 'javelin' ? 'chargeWeapon' : 'fire', weapon });
      sound.weapon();
    } else if (!e.repeat) {
      send({ type: 'horn' });
    }
  }
  if (['1', '2', '3', '4', '5', '6'].includes(key)) {
    weapon = Object.keys(weapons)[Number(key) - 1];
    toast('Selected ' + weapons[weapon].name);
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key.toLowerCase() === 't') radioConsole.transmit(false);
  const wasHeld = keys.has(e.key);
  keys.delete(e.key);
  if (wasHeld && e.key === 'Tab' && weapon === 'javelin' && world && !panel && !mobile.drawer)
    send({ type: 'fire', weapon });
});
window.addEventListener('blur', () => {
  radioConsole.transmit(false);
  keys.clear();
  stateInbox.setActive(!document.hidden);
});
window.addEventListener('focus', () => {
  scene.resumeMotion();
  stateInbox.setActive(!document.hidden);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    keys.clear();
    radioConsole.transmit(false);
  } else scene.resumeMotion();
  stateInbox.setActive(!document.hidden);
  sound.setActive(!document.hidden && scene.ready);
});
const controller = new Controller(
  () => openPanel('menu'),
  () => closePanel(),
  () => {
    const button = document.querySelector<HTMLButtonElement>('#target button');
    button?.click();
  },
  () => {
    if (world) openPanel('radio');
  },
  (down) => radioConsole.transmit(down),
  () => {
    if (
      world &&
      scene.ready &&
      !panel &&
      !mobile.drawer &&
      !document.activeElement?.matches('input,textarea,select') &&
      isEarthmover(world.players[account!.id]?.vehicle ?? -1)
    )
      send({ type: 'earthmovingImplement' });
  },
);
document.addEventListener('submit', (e) => {
  const form = e.target as HTMLFormElement;
  if ((form.getAttribute('id') ?? '') !== 'controller-settings') return;
  e.preventDefault();
  const data = new FormData(form);
  for (const key of Object.keys(controller.config) as (keyof typeof controller.config)[]) {
    const value = Number(data.get(key));
    if (Number.isFinite(value))
      controller.config[key] =
        key === 'deadZone'
          ? Math.max(0.05, Math.min(0.5, value))
          : Math.max(0, Math.min(15, Math.floor(value)));
  }
  controller.save();
  closePanel();
});
setInterval(() => controller.poll(!!panel), 50);
function drivingInput() {
  const typing =
    !scene.ready ||
    panel ||
    mobile.drawer ||
    document.activeElement?.matches('input,textarea,select');
  const held = (...list: string[]) => !typing && list.some((k) => keys.has(k));
  const touch = mobile.input();
  if (world && vehicleDef(world, world.players[account!.id]?.vehicle)?.mode === 2)
    return aircraftInput(keys, touch, controller.flight, !!typing, world?.settings);
  if (throttleBoat(world?.players[account!.id]?.vehicle ?? -1, world))
    return {
      throttle: typing
        ? 0
        : Math.max(
            -1,
            Math.min(
              1,
              +held('w', 'W', 'ArrowUp') -
                +held('s', 'S', 'ArrowDown') +
                touch.throttle +
                controller.input.throttle,
            ),
          ),
      steer: typing
        ? 0
        : Math.max(
            -1,
            Math.min(
              1,
              +held('a', 'A', 'ArrowLeft') -
                +held('d', 'D', 'ArrowRight') +
                touch.steer +
                controller.input.steer,
            ),
          ),
      brake: held('b', 'B'),
      boost: false,
    };
  return {
    throttle: typing
      ? 0
      : Math.max(
          -1,
          Math.min(
            1,
            touch.throttle +
              controller.input.throttle +
              Number(held('ArrowUp', 'w', 'W')) -
              Number(held('ArrowDown', 's', 'S')),
          ),
        ),
    steer: typing
      ? 0
      : Math.max(
          -1,
          Math.min(
            1,
            touch.steer +
              controller.input.steer +
              Number(held('ArrowLeft', 'a', 'A')) -
              Number(held('ArrowRight', 'd', 'D')),
          ),
        ),
    brake:
      me?.vehicle === HIGHWAY_TRACTOR &&
      !typing &&
      (!!touch.brake || !!controller.flight.brake || held('b', 'B')),
    boost: !typing && (touch.boost || controller.input.boost || held('Shift')),
    lift: typing
      ? 0
      : Math.max(
          -1,
          Math.min(1, (touch.lift ?? 0) + Number(held('Insert')) - Number(held('Delete'))),
        ),
  };
}
scene.localInput = drivingInput;
setInterval(() => {
  if (!world || !ws || ws.readyState !== WebSocket.OPEN) return;
  scene.paused = !!(panel || mobile.drawer);
  const input = drivingInput(),
    now = performance.now();
  const packet = inputStream.encode(input, now, ws.bufferedAmount);
  if (packet) {
    ws.send(packet);
    scene.prediction.sent(inputStream.sequence, input, now);
  }
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
async function showArrival() {
  login();
  try {
    if (token) {
      try {
        const current = await api('/api/session');
        account = current.account;
        if (!account!.traveler) localStorage.setItem('aclone.homePilot', token);
      } catch {
        /* A saved visitor key can expire; home sign-in remains available. */
      }
    }
    const info = await api('/api/federation/preview', {
      method: 'POST',
      body: JSON.stringify({ ticket: sessionStorage.getItem('aclone.arrival') }),
    });
    const card = document.querySelector('.login-card')!;
    card.insertAdjacentHTML(
      'afterbegin',
      `<section class="arrival-card"><h2>Arrive in ${esc(info.destination)}</h2><p>Character: <b>${esc(info.name)}</b><br>Home: ${esc(info.home)}</p><p>Your progress is saved separately in each galaxy. ${info.returningHome ? 'Your saved home pilot key or home sign-in is required to return.' : 'This uses a visiting pilot; it does not replace your home account.'}</p><form id="arrival-form" data-home="${info.returningHome}"><button class="primary">Continue as ${esc(info.name)}</button></form>${button('Cancel arrival', 'arrival-cancel')}</section>`,
    );
  } catch (e) {
    sessionStorage.removeItem('aclone.arrival');
    toast((e as Error).message, true);
  }
}
if (arrivalTicket) {
  void showArrival();
} else if (recoveryToken) {
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

let creatorPreviewTimer: ReturnType<typeof setTimeout> | undefined;
app.addEventListener('input', (e) => {
  if ((e.target as HTMLElement).closest('#creator-model-form') && world) {
    clearTimeout(creatorPreviewTimer);
    creatorPreviewTimer = setTimeout(() => {
      if (world && panel === 'editor' && tab === 'Workshop') refreshCreatorPreview(world);
    }, 250);
  }
});

app.addEventListener('change', (e) => {
  if (world) creatorControls(world, e.target as HTMLElement);
});

function earthmovingControls() {
  if (!world || !me || !isEarthmover(me.vehicle)) return '';
  return `<section data-earthmoving-controls>${button('Earthworks', 'earthworks')}<h3>${esc(vehicleDef(world, me.vehicle).name)}</h3>${button(me.earthmovingImplement ? 'Raise implement (G)' : 'Lower implement (G)', 'earthmoving-implement')}<p>G raises or lowers the blade and digging equipment. Start the engine with F4; carry Fuel and use Refuel in Inventory.</p></section>`;
}
function boatControls(building?: string) {
  if (!world || !me || me.vehicle === CANOE) return '';
  const dock = boatLanding(world, me, boatSlot(me.vehicle, world), building);
  const rescue = world.boatRescues?.[me.id];
  if (!dock && !boatSlot(me.vehicle, world) && !rescue) return '';
  const navigation = boatNavigationRules(world.settings);
  const attrs = building ? `data-building="${esc(building)}"` : '';
  let html =
    '<section><h3>Boating</h3>' +
    (me.vehicle === ROWBOAT
      ? `<p>This rowboat needs no fuel. Hold W/S or the arrows to row. Gentle shore contact up to ${rowboatRules(world.settings).rowboatShoreSpeed} m/s stops without recoil or impact damage. Stop beside a clear dry bank in water no deeper than ${rowboatRules(world.settings).rowboatStepOutDepth} m to step out; the whole hull must stay afloat.</p>`
      : `<p>To refuel, carry Fuel aboard, open Inventory (I / Bag), and choose Refuel beside Fuel. Each can adds up to ${worldItems(world).fuel.fuel} tank units. Start the engine with F4 or the Engine button.</p>`) +
    `<p>River docks require ${navigation.riverDockDraft} m depth and admit vessels up to ${navigation.riverDockMaxLength} m long × ${navigation.riverDockMaxBeam} m beam.</p><p>Arrival: hull within ${navigation.boatHouseArrivalRadius} m of a boathouse berth or ${navigation.boatLandingArrivalRadius} m of a pier/river berth, with a clear water path. Shore boarding at those landings: ${navigation.boatLandingShoreRadius} m. ${me.vehicle === ROWBOAT ? '' : `Shore impacts cost ${navigation.boatShoreImpactLoss} condition points; the boat still stops and recoils when damage is zero.`}</p>` +
    marineSafetyPanel(world, me) +
    freightPanel(world, me) +
    expeditionPanel(world, me) +
    charterPanel(world, me) +
    towingPanel(world, me);
  const tender = tenderOf(world, me);
  if (tender && !tender.landing && poweredBoat(me.vehicle, world) && me.vehicle !== MOTORBOAT)
    html += `<form data-action="tender"><input type="hidden" name="operation" value="${tender.towedBy ? 'dock' : 'hook'}"><button>${tender.towedBy ? 'Secure motorboat tender at dock' : 'Attach motorboat as tender'}</button></form>`;
  if (me.vehicle === ROWBOAT)
    html +=
      '<p>Hold W/S or the arrows to row. Your passenger rides without adding rowing power. Stop beside a dry bank in shallow water to disembark; the hull stays moored there. Rowboats cannot be carried or towed as tenders.</p>';
  if (me.vehicle === MOTORBOAT && me.fuel <= 0)
    html += '<p>Tank empty. Hold W/S or the arrow keys to row; your oars need no fuel.</p>';
  if (rescue?.spoilage) {
    html +=
      `<p>Your boat remains offshore. ${rescue.spoilage.spoiled ? 'Cargo and provisions have spoiled.' : rescue.spoilage.never ? 'Cargo spoilage is disabled in this world.' : `Recover cargo and provisions within ${rescue.spoilage.daysLeft.toFixed(1)} game days.`} Any remaining tank fuel does not spoil.</p>` +
      button('Show route to stranded boat', 'boat-rescue-waypoint');
    const recoveryDock = boatLandings(world).find((d) => d.id === rescue.dinghy.landing);
    if (recoveryDock)
      html +=
        `<p>Recovery lifeboat: ${esc(world.buildings.find((b) => b.id === recoveryDock.id)?.name ?? 'Fishing pier')}.</p>` +
        button('Show route to recovery lifeboat', 'boat-recovery-dock');
  }
  if (dock && !boatSlot(me.vehicle, world)) {
    if (rescue?.dinghy.moored)
      html += button('Board your moored lifeboat', 'lifeboat', 'data-id="board"');
    for (const slot of vehicles
      .map((_, slot) => slot)
      .filter(
        (slot) =>
          slot !== CANOE &&
          poweredBoat(slot, world) &&
          (!rescue || ([TUGBOAT, MOTORBOAT].includes(slot) && rescue.boat.slot !== slot)),
      )) {
      if (
        !(me.fleet ?? []).includes(slot) &&
        !dock.building &&
        !(slot === ROWBOAT && !dock.river && !dock.quay && !dock.beached)
      )
        continue;
      if (
        slot === ROWBOAT &&
        !rowboatRules(world.settings).rowboatsEnabled &&
        !(me.fleet ?? []).includes(slot)
      )
        continue;
      if (!landingAccepts(world, dock, slot)) continue;
      html += button(
        (me.fleet ?? []).includes(slot)
          ? `Board your ${esc(vehicleDef(world, slot).name)}`
          : `Buy and board ${esc(vehicleDef(world, slot).name)} · ${money(vehicleDef(world, slot).price)}`,
        'vehicle',
        `data-id="${slot}" ${attrs}`,
      );
    }
  }
  if (dock?.beached && !boatSlot(me.vehicle, world)) {
    for (const b of Object.values(world.mooredBoats ?? {}))
      if (b.slot === ROWBOAT && b.beached && b.landing === dock.id && b.owner !== me.id) {
        html +=
          rowboatRules(world.settings).rowboatPublicPickup && !(me.fleet ?? []).includes(ROWBOAT)
            ? `<form data-action="vehicle"><input type="hidden" name="slot" value="${ROWBOAT}"><input type="hidden" name="owner" value="${esc(b.owner)}"><button>Take beached rowboat</button></form>`
            : '<p>This beached rowboat belongs to another player.</p>';
      }
  }
  if (isTrawler(me.vehicle, world)) html += trawlControls();
  if (boatSlot(me.vehicle, world)) {
    html += dock
      ? button('Disembark on foot', 'walk') + button('Disembark into tractor', 'tractor')
      : '<p>Return to a boathouse berth, the side of the fishing pier or a river dock to disembark.</p>';
    if (poweredBoat(me.vehicle, world) && hasMotor(world, me.vehicle) && me.fuel <= 0)
      html += button('Launch emergency lifeboat', 'lifeboat', 'data-id="launch"');
  }
  if (rescue) {
    html +=
      '<p>Row back in your lifeboat, take your motorboat, or hitch a ride from shore on another player’s boat. A recovery passenger receives no crew profit share. Stop alongside your own boat to transfer; bring Fuel if its tank is empty.</p>' +
      button('Show route to stranded boat', 'boat-rescue-waypoint');
    if (!reboardReason(world, me))
      html += button('Reboard your stranded boat', 'lifeboat', 'data-id="reboard"');
  }
  return (
    html +
    '<p>Fishing piers, river docks and quays leave boats moored outside. Freight holds always stay with their boat, including at boathouses. Rowboats also stay at the bank where you leave them. Other boats store inside a boathouse. Lifeboats remain moored until you return.</p></section>'
  );
}

function trawlStatus() {
  if (!me || !world) return '';
  return fishingTrawlStatus(world, me);
}
function trawlControls() {
  if (!me || !world || !isTrawler(me.vehicle, world)) return '';
  const t = me.trawl,
    parameters = trawlParameters(world, me.vehicle);
  return `<strong>Commercial trawling</strong><p>W/S or ↑/↓ adjust throttle; A/D or ←/→ steer. S continues through idle into slow reverse. B sets idle. Chat and menus keep the set throttle.</p>${button('Idle throttle', 'boatIdle')}<p>${esc(trawlStatus())}</p><p>Depth ${waterDepth(world, me).toFixed(1)} m · Tank ${me.fuel.toFixed(1)} / ${vehicleDef(world, me.vehicle).tank}. Deep fishing requires ${fishingRules(world.settings).fishingDeepDepth} m depth and ${fishingRules(world.settings).fishingShoreDistance} m shore clearance. Towing speed up to ${parameters.speed} m/s; net capacity ${parameters.netCapacity} weight. Nets down use ${(parameters.fuelPerSecond * 60).toFixed(1)} fuel units per minute; keep a reserve for your return.</p>${t ? button('Haul catch and stow nets', 'trawl', 'data-id="haul"') : ''}${t?.deployed ? button('Stow nets', 'trawl', 'data-id="stow"') : button('Deploy nets', 'trawl', 'data-id="deploy"')}<p class="note">Watch the net, then haul to inspect your catch. Food, water and fuel cans share the hold with landed fish. Idle before docking.</p>`;
}

document.addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  if (input.dataset.hudPanel && input.dataset.hudPanel in hudPanels)
    hud.set(input.dataset.hudPanel as HudPanel, input.checked);
});
