/* ============================================================================
 *  IMPOSTOR STATION — a single-player social-deduction game.
 *  Original code & art, inspired by the "impostor" genre. config.js
 * ========================================================================== */

const CFG = {
  WORLD_W: 1900,
  WORLD_H: 1300,

  PLAYER_R: 22,
  MOVE_SPEED: 230,            // px/s
  BOT_SPEED: 205,

  KILL_RANGE: 88,
  KILL_COOLDOWN: 24,         // s
  USE_RANGE: 78,
  REPORT_RANGE: 110,
  INTERACT_RANGE: 70,

  VISION_CREW: 300,          // crewmate sight radius
  VISION_IMPOSTOR: 560,      // impostors see further
  VISION_LIGHTS_OUT: 150,    // crewmate sight when lights sabotaged

  NUM_PLAYERS: 8,
  NUM_IMPOSTORS: 2,
  TASKS_PER_CREW: 5,
  EMERGENCY_USES: 1,

  MEETING_DISCUSS: 14,       // s discussion
  MEETING_VOTE: 18,          // s voting
  EJECT_REVEAL: true,

  REACTOR_COUNTDOWN: 30,     // s before impostors win if not fixed
  SABOTAGE_COOLDOWN: 18,
};

// Crewmate colours (name → hex). Original palette.
const COLORS = [
  { id: 'red',    name: 'Red',    hex: '#e2333a' },
  { id: 'blue',   name: 'Blue',   hex: '#1f6fe0' },
  { id: 'green',  name: 'Green',  hex: '#33b14b' },
  { id: 'pink',   name: 'Pink',   hex: '#ec5fb0' },
  { id: 'orange', name: 'Orange', hex: '#ef8a2b' },
  { id: 'yellow', name: 'Yellow', hex: '#f4d13d' },
  { id: 'cyan',   name: 'Cyan',   hex: '#46c7d4' },
  { id: 'lime',   name: 'Lime',   hex: '#88d039' },
  { id: 'purple', name: 'Purple', hex: '#7b3fe4' },
  { id: 'white',  name: 'White',  hex: '#e8ecf5' },
];

// Bot display names.
const BOT_NAMES = ['NOVA', 'ORBIT', 'COMET', 'PIXEL', 'ECHO', 'ZARA', 'BOLT', 'LUNA', 'RIVET', 'SABLE'];

/* Station rooms (world coords). Rooms are walkable rectangles; corridors below
 * stitch them into one connected floor. */
const ROOMS = [
  { id: 'medbay',   name: 'MedBay',      x: 120,  y: 120,  w: 340, h: 250 },
  { id: 'cafe',     name: 'Cafeteria',   x: 740,  y: 90,   w: 420, h: 300 },
  { id: 'weapons',  name: 'Weapons',     x: 1440, y: 120,  w: 340, h: 250 },
  { id: 'electric', name: 'Electrical',  x: 120,  y: 540,  w: 340, h: 240 },
  { id: 'reactor',  name: 'Reactor',     x: 760,  y: 540,  w: 380, h: 240 },
  { id: 'nav',      name: 'Navigation',  x: 1440, y: 540,  w: 340, h: 240 },
  { id: 'storage',  name: 'Storage',     x: 120,  y: 950,  w: 340, h: 250 },
  { id: 'engine',   name: 'Engine',      x: 740,  y: 950,  w: 420, h: 250 },
  { id: 'shields',  name: 'Shields',     x: 1440, y: 950,  w: 340, h: 250 },
];

// Connecting corridors (walkable). Width ~90 to feel roomy.
const CORRIDORS = [
  // Horizontal between columns, on each row's vertical centre.
  { x: 440, y: 205, w: 320, h: 90 },   // medbay-cafe
  { x: 1140, y: 205, w: 320, h: 90 },  // cafe-weapons
  { x: 440, y: 615, w: 340, h: 90 },   // electric-reactor
  { x: 1120, y: 615, w: 340, h: 90 },  // reactor-nav
  { x: 440, y: 1035, w: 320, h: 90 },  // storage-engine
  { x: 1140, y: 1035, w: 320, h: 90 }, // engine-shields
  // Vertical between rows, on each column's centre.
  { x: 245, y: 350, w: 90, h: 210 },   // medbay-electric
  { x: 245, y: 760, w: 90, h: 210 },   // electric-storage
  { x: 905, y: 370, w: 90, h: 190 },   // cafe-reactor
  { x: 905, y: 760, w: 90, h: 210 },   // reactor-engine
  { x: 1565, y: 350, w: 90, h: 210 },  // weapons-nav
  { x: 1565, y: 760, w: 90, h: 210 },  // nav-shields
];

/* Task definitions. type drives the minigame. Each entry is one task instance
 * placed in a room. assignable tasks are pooled and dealt to crewmates. */
const TASK_DEFS = [
  { id: 'wires_caf',   room: 'cafe',     name: 'Fix Wiring',        type: 'wires',   x: 880,  y: 150 },
  { id: 'wires_nav',   room: 'nav',      name: 'Fix Wiring',        type: 'wires',   x: 1520, y: 600 },
  { id: 'wires_str',   room: 'storage',  name: 'Fix Wiring',        type: 'wires',   x: 200,  y: 1010 },
  { id: 'down_weap',   room: 'weapons',  name: 'Download Data',     type: 'download',x: 1520, y: 180 },
  { id: 'up_admin',    room: 'reactor',  name: 'Upload Data',       type: 'download',x: 840,  y: 600 },
  { id: 'card_med',    room: 'medbay',   name: 'Swipe Card',        type: 'card',    x: 200,  y: 180 },
  { id: 'card_shd',    room: 'shields',  name: 'Swipe Card',        type: 'card',    x: 1520, y: 1010 },
  { id: 'keypad_reac', room: 'reactor',  name: 'Start Reactor',     type: 'keypad',  x: 1040, y: 600 },
  { id: 'keypad_nav',  room: 'nav',      name: 'Chart Course',      type: 'keypad',  x: 1660, y: 600 },
  { id: 'fuel_eng',    room: 'engine',   name: 'Fuel Engine',       type: 'hold',    x: 840,  y: 1010 },
  { id: 'fuel_eng2',   room: 'engine',   name: 'Calibrate Engine',  type: 'hold',    x: 1040, y: 1010 },
  { id: 'aim_weap',    room: 'weapons',  name: 'Clear Asteroids',   type: 'asteroids',x: 1660, y: 180 },
  { id: 'aim_med',     room: 'medbay',   name: 'Submit Scan',       type: 'hold',    x: 360,  y: 180 },
  { id: 'wires_ele',   room: 'electric', name: 'Fix Wiring',        type: 'wires',   x: 200,  y: 600 },
];

// Vent groups — impostor cycles between vents in the same group.
const VENT_GROUPS = [
  [ { room: 'medbay', x: 150, y: 330 }, { room: 'electric', x: 150, y: 560 }, { room: 'reactor', x: 790, y: 740 } ],
  [ { room: 'weapons', x: 1750, y: 330 }, { room: 'nav', x: 1750, y: 560 }, { room: 'shields', x: 1750, y: 980 } ],
  [ { room: 'cafe', x: 1120, y: 120 }, { room: 'storage', x: 150, y: 980 }, { room: 'engine', x: 1130, y: 1170 } ],
];

// Emergency button location (in cafeteria).
const EMERGENCY_BTN = { x: 950, y: 240 };

const Util = {
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  shuffle: arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  roomAt(x, y) { return ROOMS.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h); },
  inWalkable(x, y) {
    for (const r of ROOMS) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
    for (const c of CORRIDORS) if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return true;
    return false;
  },
};
