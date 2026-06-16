/* ============================================================================
 *  WORLD CUP 2026 HEAD SOCCER — $GOAL Play-to-Earn
 *  config.js — global constants, team roster, token economy
 * ========================================================================== */

const CONFIG = {
  // --- Canvas / world ---
  WIDTH: 1000,
  HEIGHT: 560,
  GROUND_Y: 476,          // y of the pitch surface
  GOAL_WIDTH: 64,
  GOAL_HEIGHT: 200,
  WALL_PAD: 8,

  // --- Physics (tuned for a heavier, more controllable ball) ---
  GRAVITY: 1650,          // px / s^2  (was 2100 — floatier, easier to read)
  AIR_FRICTION: 0.9965,
  GROUND_FRICTION: 0.82,
  BALL_RESTITUTION: 0.60, // less bouncy
  BALL_RADIUS: 24,
  MAX_BALL_SPEED: 880,    // hard clamp so shots stay readable
  PLAYER_RADIUS: 47,
  MAX_DT: 1 / 30,

  // --- Player movement ---
  MOVE_SPEED: 360,
  JUMP_VELOCITY: 760,
  KICK_RANGE: 98,
  KICK_POWER: 720,        // base kick (was 1180)
  POWER_SHOT_MULT: 1.55,
  POWER_CHARGE_TIME: 1.1, // seconds to fully charge the power meter
  KICK_COOLDOWN: 0.22,

  // --- Match ---
  MATCH_SECONDS: 75,

  // --- P2E token economy ($GOAL) ---
  TOKEN: {
    SYMBOL: '$GOAL',
    NAME: 'GoalCoin',
    PER_GOAL: 12,
    WIN_BONUS: 60,
    CLEAN_SHEET_BONUS: 40,
    TOURNAMENT_STAGE_BONUS: 150,
    TOURNAMENT_WIN_BONUS: 1000,
    DAILY_REWARD: 25,
    NETWORK: 'solana-mainnet-beta',
    MINT: 'GoaLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx2026', // placeholder
    DECIMALS: 6,
  },
};

/* 2026 World Cup themed national sides.
 *  primary/secondary = jersey palette · skin/hair = procedural head renderer
 *  hairStyle: 0 short · 1 buzz · 2 swept · 3 curly/afro · 4 bald · 5 long
 *  flag = structured descriptor rendered procedurally (no emoji). */
const TEAMS = [
  { id: 'usa', name: 'USA',         primary: '#1c3f94', secondary: '#ffffff', accent: '#bf0a30', skin: '#e8b48c', hair: '#5b3a22', hairStyle: 2, flag: { type: 'usa' } },
  { id: 'mex', name: 'Mexico',      primary: '#006847', secondary: '#ffffff', accent: '#ce1126', skin: '#c98a5e', hair: '#1c130d', hairStyle: 0, flag: { type: 'v3', c: ['#006847', '#ffffff', '#ce1126'] } },
  { id: 'can', name: 'Canada',      primary: '#d52b1e', secondary: '#ffffff', accent: '#d52b1e', skin: '#e0a878', hair: '#7a4a26', hairStyle: 5, flag: { type: 'canada' } },
  { id: 'arg', name: 'Argentina',   primary: '#74acdf', secondary: '#ffffff', accent: '#f6b40e', skin: '#d99a6c', hair: '#1c130d', hairStyle: 0, flag: { type: 'h3s', c: ['#74acdf', '#ffffff', '#74acdf'], em: '#f6b40e' } },
  { id: 'bra', name: 'Brazil',      primary: '#ffdf00', secondary: '#009b3a', accent: '#002776', skin: '#8d5a3c', hair: '#0e0a06', hairStyle: 3, flag: { type: 'brazil' } },
  { id: 'fra', name: 'France',      primary: '#0055a4', secondary: '#ffffff', accent: '#ef4135', skin: '#6f4a32', hair: '#0e0a06', hairStyle: 1, flag: { type: 'v3', c: ['#0055a4', '#ffffff', '#ef4135'] } },
  { id: 'eng', name: 'England',     primary: '#ffffff', secondary: '#1d3a8a', accent: '#cf081f', skin: '#e0a878', hair: '#caa06a', hairStyle: 2, flag: { type: 'cross', c: ['#ffffff', '#cf081f'] } },
  { id: 'esp', name: 'Spain',       primary: '#c60b1e', secondary: '#ffc400', accent: '#ffc400', skin: '#d99a6c', hair: '#1c130d', hairStyle: 0, flag: { type: 'h3', c: ['#c60b1e', '#ffc400', '#c60b1e'], ratio: [1, 2, 1] } },
  { id: 'ger', name: 'Germany',     primary: '#1a1a1a', secondary: '#ffffff', accent: '#dd0000', skin: '#e0a878', hair: '#c8a25a', hairStyle: 2, flag: { type: 'h3', c: ['#111111', '#dd0000', '#ffce00'] } },
  { id: 'por', name: 'Portugal',    primary: '#006600', secondary: '#ff0000', accent: '#ffd000', skin: '#c98a5e', hair: '#0e0a06', hairStyle: 0, flag: { type: 'v2', c: ['#006600', '#ff0000'], em: '#ffd000' } },
  { id: 'ned', name: 'Netherlands', primary: '#ff6c00', secondary: '#ffffff', accent: '#21468b', skin: '#e0a878', hair: '#caa06a', hairStyle: 2, flag: { type: 'h3', c: ['#ae1c28', '#ffffff', '#21468b'] } },
  { id: 'jpn', name: 'Japan',       primary: '#0a2987', secondary: '#ffffff', accent: '#bc002d', skin: '#e6bd8f', hair: '#0a0a0a', hairStyle: 0, flag: { type: 'disc', c: ['#ffffff', '#bc002d'] } },
  { id: 'kor', name: 'Korea Rep.',  primary: '#c8102e', secondary: '#ffffff', accent: '#003478', skin: '#e6bd8f', hair: '#0a0a0a', hairStyle: 0, flag: { type: 'korea' } },
  { id: 'mar', name: 'Morocco',     primary: '#c1272d', secondary: '#006233', accent: '#006233', skin: '#a9744f', hair: '#0e0a06', hairStyle: 0, flag: { type: 'star', c: ['#c1272d', '#006233'] } },
  { id: 'cro', name: 'Croatia',     primary: '#ff0000', secondary: '#ffffff', accent: '#171796', skin: '#d99a6c', hair: '#5b3a22', hairStyle: 0, flag: { type: 'h3', c: ['#ff0000', '#ffffff', '#171796'] } },
  { id: 'bel', name: 'Belgium',     primary: '#e30613', secondary: '#1a1a1a', accent: '#fdda24', skin: '#e0a878', hair: '#3a2414', hairStyle: 0, flag: { type: 'v3', c: ['#111111', '#fdda24', '#e30613'] } },
];

// Difficulty presets used by the AI controller.
const DIFFICULTY = {
  easy:   { reaction: 0.30, speedMult: 0.74, jumpChance: 0.30, aggression: 0.55, errorPx: 80, label: 'EASY' },
  normal: { reaction: 0.18, speedMult: 0.90, jumpChance: 0.50, aggression: 0.72, errorPx: 46, label: 'NORMAL' },
  hard:   { reaction: 0.10, speedMult: 1.00, jumpChance: 0.70, aggression: 0.85, errorPx: 22, label: 'HARD' },
  legend: { reaction: 0.05, speedMult: 1.08, jumpChance: 0.85, aggression: 0.95, errorPx: 9,  label: 'LEGEND' },
};

// 8-stage single-player tournament → 2026 World Cup "Road to Glory".
const TOURNAMENT_STAGES = ['Group Stage', 'Round of 16', 'Quarter-Final', 'Semi-Final', 'FINAL'];
