/* ============================================================================
 *  IMPOSTOR STATION — config.js
 *  Data backbone: settings, cosmetics, and a data-driven multi-map system.
 *  Original work — original names, layouts and art.
 * ========================================================================== */

// Fixed structural constants.
const CFG = {
  PLAYER_R: 22,
  USE_RANGE: 78,
  REPORT_RANGE: 115,
  INTERACT_RANGE: 72,
  KILL_COOLDOWN_RESET: true,
};

// Customizable match settings (mutated by the Settings panel).
const SETTINGS = {
  mapId: 'orbital',
  numPlayers: 8,
  numImpostors: 2,
  rolePref: 'random',          // random | crew | impostor
  moveSpeed: 230,              // px/s
  killCooldown: 24,            // s
  killRange: 88,
  crewVision: 300,
  impostorVision: 560,
  emergencies: 2,              // emergency meetings per player
  discussTime: 14,
  voteTime: 18,
  tasksPerCrew: 5,
  commonTasks: 1,
  anonymousVotes: false,
  confirmEjects: true,
  reactorCountdown: 35,
  sabotageCooldown: 18,
  // cosmetics
  color: 'red', hat: 'none', pet: 'none',
};

// Ranges/labels for the settings UI.
const SETTING_DEFS = [
  { key: 'numPlayers',    label: 'Players',        min: 4, max: 12, step: 1 },
  { key: 'numImpostors',  label: 'Impostors',      min: 1, max: 3,  step: 1 },
  { key: 'moveSpeed',     label: 'Player Speed',   min: 140, max: 340, step: 10 },
  { key: 'killCooldown',  label: 'Kill Cooldown',  min: 10, max: 45, step: 1, suffix: 's' },
  { key: 'killRange',     label: 'Kill Range',     min: 60, max: 140, step: 5 },
  { key: 'crewVision',    label: 'Crew Vision',    min: 200, max: 480, step: 20 },
  { key: 'emergencies',   label: 'Emergencies',    min: 0, max: 3,  step: 1 },
  { key: 'discussTime',   label: 'Discussion',     min: 5, max: 30, step: 1, suffix: 's' },
  { key: 'voteTime',      label: 'Voting Time',    min: 10, max: 40, step: 1, suffix: 's' },
  { key: 'tasksPerCrew',  label: 'Tasks / Crew',   min: 2, max: 8,  step: 1 },
];
const SETTING_TOGGLES = [
  { key: 'anonymousVotes', label: 'Anonymous Votes' },
  { key: 'confirmEjects',  label: 'Confirm Ejects' },
];

// Character colours.
const COLORS = [
  { id: 'red', name: 'Red', hex: '#e2333a' }, { id: 'blue', name: 'Blue', hex: '#1f6fe0' },
  { id: 'green', name: 'Green', hex: '#33b14b' }, { id: 'pink', name: 'Pink', hex: '#ec5fb0' },
  { id: 'orange', name: 'Orange', hex: '#ef8a2b' }, { id: 'yellow', name: 'Yellow', hex: '#f4d13d' },
  { id: 'cyan', name: 'Cyan', hex: '#46c7d4' }, { id: 'lime', name: 'Lime', hex: '#88d039' },
  { id: 'purple', name: 'Purple', hex: '#7b3fe4' }, { id: 'white', name: 'White', hex: '#e8ecf5' },
  { id: 'black', name: 'Black', hex: '#3a4252' }, { id: 'rose', name: 'Rose', hex: '#c0556b' },
];

// Cosmetic hats (drawn procedurally) and pets.
const HATS = [
  { id: 'none', name: 'None' }, { id: 'cap', name: 'Cap' }, { id: 'tophat', name: 'Top Hat' },
  { id: 'band', name: 'Headband' }, { id: 'antenna', name: 'Antenna' }, { id: 'crown', name: 'Crown' },
  { id: 'horn', name: 'Horn' },
];
const PETS = [
  { id: 'none', name: 'None' }, { id: 'cube', name: 'Bit' }, { id: 'orb', name: 'Orb' }, { id: 'bot', name: 'Mini-Bot' },
];

const BOT_NAMES = ['NOVA', 'ORBIT', 'COMET', 'PIXEL', 'ECHO', 'ZARA', 'BOLT', 'LUNA', 'RIVET', 'SABLE', 'FLARE', 'ONYX'];

/* --------------------------------------------------------------------------
 *  Map builder — lays out a connected grid of rooms with corridors so every
 *  map is guaranteed traversable. Returns { rooms, corridors }.
 * ------------------------------------------------------------------------ */
function buildGrid(spec) {
  const { cols, rows, rw, rh, gx, gy, ox, oy, names } = spec;
  const rooms = [], grid = [];
  let n = 0;
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const name = names[n++];
      if (!name) { grid[r][c] = null; continue; }
      const room = { id: name.toLowerCase().replace(/[^a-z0-9]/g, ''), name, x: ox + c * (rw + gx), y: oy + r * (rh + gy), w: rw, h: rh };
      grid[r][c] = room; rooms.push(room);
    }
  }
  const corridors = [];
  const cw = 92;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = grid[r][c]; if (!a) continue;
    const right = c + 1 < cols ? grid[r][c + 1] : null;
    const down = r + 1 < rows ? grid[r + 1][c] : null;
    if (right) corridors.push({ x: a.x + a.w - 4, y: a.y + a.h / 2 - cw / 2, w: (right.x) - (a.x + a.w) + 8, h: cw });
    if (down) corridors.push({ x: a.x + a.w / 2 - cw / 2, y: a.y + a.h - 4, w: cw, h: (down.y) - (a.y + a.h) + 8 });
  }
  return { rooms, corridors };
}

// Resolve a list of {room,dx,dy,...} placements to absolute coords on a map.
function place(map, list) {
  return list.map(p => {
    const r = map.rooms.find(rr => rr.id === p.room);
    return { ...p, x: r.x + r.w / 2 + (p.dx || 0), y: r.y + r.h / 2 + (p.dy || 0) };
  });
}

/* --------------------------------------------------------------------------
 *  MAPS — three original stations.
 * ------------------------------------------------------------------------ */
const MAPS = (() => {
  // ---- Map 1: Orbital Hub (3x3) ----
  const m1 = buildGrid({ cols: 3, rows: 3, rw: 360, rh: 250, gx: 240, gy: 200, ox: 120, oy: 110,
    names: ['MedBay', 'Cafeteria', 'Weapons', 'Electrical', 'Reactor', 'Navigation', 'Storage', 'Engine', 'Shields'] });
  m1.id = 'orbital'; m1.label = 'Orbital Hub';
  m1.spawn = { room: 'cafeteria', dx: 0, dy: 80 };
  m1.tasks = [
    { room: 'cafeteria', name: 'Empty Garbage', type: 'hold', kind: 'visual', dx: -120, dy: -60 },
    { room: 'cafeteria', name: 'Fix Wiring', type: 'wires', kind: 'common', dx: 110, dy: -40 },
    { room: 'weapons', name: 'Clear Asteroids', type: 'asteroids', kind: 'visual', dx: 100, dy: 40 },
    { room: 'weapons', name: 'Download Data', type: 'download', kind: 'short', dx: -110, dy: -40 },
    { room: 'navigation', name: 'Chart Course', type: 'keypad', kind: 'short', dx: 90, dy: 40 },
    { room: 'navigation', name: 'Fix Wiring', type: 'wires', kind: 'short', dx: -100, dy: -50 },
    { room: 'medbay', name: 'Submit Scan', type: 'scan', kind: 'visual', dx: -110, dy: -30 },
    { room: 'medbay', name: 'Swipe Card', type: 'card', kind: 'short', dx: 100, dy: 40 },
    { room: 'electrical', name: 'Fix Wiring', type: 'wires', kind: 'short', dx: -90, dy: 0 },
    { room: 'reactor', name: 'Start Reactor', type: 'keypad', kind: 'long', dx: 0, dy: -40, steps: 2 },
    { room: 'reactor', name: 'Upload Data', type: 'download', kind: 'short', dx: 120, dy: 40 },
    { room: 'storage', name: 'Fuel Engine', type: 'hold', kind: 'long', dx: 0, dy: 0, steps: 2,
      stepRooms: ['storage', 'engine'] },
    { room: 'engine', name: 'Align Engine', type: 'hold', kind: 'short', dx: 110, dy: 40 },
    { room: 'shields', name: 'Prime Shields', type: 'asteroids', kind: 'visual', dx: 0, dy: 40 },
    { room: 'shields', name: 'Swipe Card', type: 'card', kind: 'short', dx: -100, dy: -40 },
  ];
  m1.vents = [
    [{ room: 'medbay', dx: -130, dy: 80 }, { room: 'electrical', dx: -120, dy: -60 }, { room: 'reactor', dx: -150, dy: 70 }],
    [{ room: 'weapons', dx: 140, dy: -70 }, { room: 'navigation', dx: 140, dy: -60 }, { room: 'shields', dx: 140, dy: 70 }],
    [{ room: 'cafeteria', dx: 150, dy: 90 }, { room: 'storage', dx: -130, dy: 80 }, { room: 'engine', dx: 0, dy: 90 }],
  ];
  m1.buttons = [{ room: 'cafeteria', dx: 0, dy: -70 }];
  m1.cameras = [{ room: 'storage' }, { room: 'medbay' }, { room: 'weapons' }, { room: 'shields' }];
  m1.securityRoom = 'navigation';
  m1.lightsRoom = 'electrical';
  m1.reactorRooms = ['reactor', 'engine'];
  m1.commsRoom = 'navigation';

  // ---- Map 2: Sky Relay (4x2, wide) ----
  const m2 = buildGrid({ cols: 4, rows: 2, rw: 320, rh: 260, gx: 200, gy: 230, ox: 110, oy: 150,
    names: ['Launchpad', 'Greenhouse', 'Comms', 'Office', 'Locker', 'Lounge', 'Lab', 'Balcony'] });
  m2.id = 'skyrelay'; m2.label = 'Sky Relay';
  m2.spawn = { room: 'lounge', dx: 0, dy: 0 };
  m2.tasks = [
    { room: 'launchpad', name: 'Fix Wiring', type: 'wires', kind: 'common', dx: 0, dy: -40 },
    { room: 'launchpad', name: 'Align Engine', type: 'hold', kind: 'short', dx: 90, dy: 40 },
    { room: 'greenhouse', name: 'Water Plants', type: 'hold', kind: 'visual', dx: 0, dy: 0 },
    { room: 'greenhouse', name: 'Submit Scan', type: 'scan', kind: 'visual', dx: -90, dy: -40 },
    { room: 'comms', name: 'Download Data', type: 'download', kind: 'short', dx: 0, dy: 0 },
    { room: 'comms', name: 'Chart Course', type: 'keypad', kind: 'short', dx: 90, dy: 50 },
    { room: 'office', name: 'Swipe Card', type: 'card', kind: 'short', dx: 0, dy: -40 },
    { room: 'office', name: 'Sort Records', type: 'keypad', kind: 'long', dx: 80, dy: 40, steps: 2 },
    { room: 'locker', name: 'Fix Wiring', type: 'wires', kind: 'short', dx: 0, dy: 0 },
    { room: 'lab', name: 'Run Diagnostic', type: 'download', kind: 'long', dx: 0, dy: 0, steps: 2,
      stepRooms: ['lab', 'comms'] },
    { room: 'lab', name: 'Clear Samples', type: 'asteroids', kind: 'visual', dx: 80, dy: 40 },
    { room: 'balcony', name: 'Calibrate Dish', type: 'keypad', kind: 'short', dx: 0, dy: 0 },
    { room: 'lounge', name: 'Empty Garbage', type: 'hold', kind: 'visual', dx: 90, dy: 40 },
  ];
  m2.vents = [
    [{ room: 'launchpad', dx: -120, dy: -80 }, { room: 'locker', dx: -120, dy: 80 }],
    [{ room: 'comms', dx: 120, dy: -80 }, { room: 'lab', dx: 120, dy: 80 }, { room: 'office', dx: 120, dy: -80 }],
    [{ room: 'greenhouse', dx: 0, dy: -90 }, { room: 'balcony', dx: 0, dy: 90 }],
  ];
  m2.buttons = [{ room: 'lounge', dx: 0, dy: -80 }];
  m2.cameras = [{ room: 'launchpad' }, { room: 'greenhouse' }, { room: 'lab' }, { room: 'balcony' }];
  m2.securityRoom = 'office';
  m2.lightsRoom = 'locker';
  m2.reactorRooms = ['launchpad', 'lab'];
  m2.commsRoom = 'comms';

  // ---- Map 3: Frost Colony (3x3 compact, icy) ----
  const m3 = buildGrid({ cols: 3, rows: 3, rw: 330, rh: 230, gx: 210, gy: 180, ox: 130, oy: 120,
    names: ['Dropship', 'Specimen', 'Outpost', 'Boiler', 'Decon', 'Comms', 'Storage', 'Lab', 'Vault'] });
  m3.id = 'frost'; m3.label = 'Frost Colony';
  m3.spawn = { room: 'decon', dx: 0, dy: 0 };
  m3.tasks = [
    { room: 'dropship', name: 'Fix Wiring', type: 'wires', kind: 'common', dx: 0, dy: -30 },
    { room: 'dropship', name: 'Fuel Engine', type: 'hold', kind: 'long', dx: 80, dy: 30, steps: 2, stepRooms: ['dropship', 'storage'] },
    { room: 'specimen', name: 'Submit Scan', type: 'scan', kind: 'visual', dx: 0, dy: 0 },
    { room: 'specimen', name: 'Inspect Sample', type: 'asteroids', kind: 'visual', dx: 80, dy: 30 },
    { room: 'outpost', name: 'Chart Course', type: 'keypad', kind: 'short', dx: 0, dy: -30 },
    { room: 'boiler', name: 'Open Valves', type: 'hold', kind: 'short', dx: 0, dy: 0 },
    { room: 'decon', name: 'Swipe Card', type: 'card', kind: 'short', dx: -80, dy: -30 },
    { room: 'comms', name: 'Download Data', type: 'download', kind: 'short', dx: 0, dy: 0 },
    { room: 'storage', name: 'Sort Crates', type: 'keypad', kind: 'short', dx: 0, dy: 30 },
    { room: 'lab', name: 'Run Diagnostic', type: 'download', kind: 'long', dx: 0, dy: 0, steps: 2, stepRooms: ['lab', 'comms'] },
    { room: 'lab', name: 'Fix Wiring', type: 'wires', kind: 'short', dx: 80, dy: 30 },
    { room: 'vault', name: 'Unlock Vault', type: 'keypad', kind: 'short', dx: 0, dy: 0 },
  ];
  m3.vents = [
    [{ room: 'dropship', dx: -110, dy: 70 }, { room: 'boiler', dx: -110, dy: -60 }, { room: 'storage', dx: -110, dy: 60 }],
    [{ room: 'outpost', dx: 120, dy: -60 }, { room: 'comms', dx: 120, dy: 0 }, { room: 'vault', dx: 120, dy: 60 }],
    [{ room: 'specimen', dx: 0, dy: -80 }, { room: 'lab', dx: 0, dy: 80 }],
  ];
  m3.buttons = [{ room: 'decon', dx: 0, dy: -70 }];
  m3.cameras = [{ room: 'dropship' }, { room: 'specimen' }, { room: 'storage' }, { room: 'vault' }];
  m3.securityRoom = 'outpost';
  m3.lightsRoom = 'boiler';
  m3.reactorRooms = ['boiler', 'lab'];
  m3.commsRoom = 'comms';

  // Resolve placements to absolute coordinates + compute bounds.
  for (const m of [m1, m2, m3]) {
    m.taskSpots = place(m, m.tasks);
    m.ventGroups = m.vents.map(g => place(m, g));
    m.buttonSpots = place(m, m.buttons);
    m.cameraSpots = m.cameras.map(c => { const r = m.rooms.find(rr => rr.id === c.room); return { room: c.room, x: r.x + r.w / 2, y: r.y + r.h / 2, rect: r }; });
    let maxX = 0, maxY = 0, minX = 1e9, minY = 1e9;
    for (const r of m.rooms) { maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h); minX = Math.min(minX, r.x); minY = Math.min(minY, r.y); }
    m.w = maxX + minX; m.h = maxY + minY;
    m.bounds = { minX: minX - 40, minY: minY - 40, maxX: maxX + 40, maxY: maxY + 40 };
  }
  return [m1, m2, m3];
})();

const Util = {
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  shuffle: arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  mapById: id => MAPS.find(m => m.id === id) || MAPS[0],
};
