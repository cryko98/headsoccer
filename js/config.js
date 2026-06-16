/* ============================================================================
 *  WORLD CUP 2026 HEAD SOCCER — $GOAL Play-to-Earn
 *  config.js — global constants, team roster, token economy
 * ========================================================================== */

const CONFIG = {
  // --- Canvas / world ---
  WIDTH: 1000,
  HEIGHT: 560,
  GROUND_Y: 470,          // y of the pitch surface
  GOAL_WIDTH: 70,
  GOAL_HEIGHT: 190,
  WALL_PAD: 8,

  // --- Physics ---
  GRAVITY: 2100,          // px / s^2
  AIR_FRICTION: 0.999,
  GROUND_FRICTION: 0.86,
  BALL_RESTITUTION: 0.74,
  BALL_RADIUS: 26,
  PLAYER_RADIUS: 46,
  MAX_DT: 1 / 30,

  // --- Player movement ---
  MOVE_SPEED: 430,
  JUMP_VELOCITY: 920,
  KICK_RANGE: 96,
  KICK_POWER: 1180,
  POWER_SHOT_MULT: 1.95,
  POWER_CHARGE_TIME: 1.4, // seconds to fully charge the power meter

  // --- Match ---
  MATCH_SECONDS: 60,
  GOALS_TO_WIN_SUDDEN: 1,

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
    // Display-only on-chain config (scaffold for real Solana mint)
    NETWORK: 'solana-mainnet-beta',
    MINT: 'GoaLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx2026', // placeholder
    DECIMALS: 6,
  },
};

/* 2026 World Cup themed national sides.
 * primary/secondary = jersey + skin/accent palette used by the procedural head renderer. */
const TEAMS = [
  { id: 'usa', name: 'USA',         flag: '🇺🇸', primary: '#1c3f94', secondary: '#ffffff', skin: '#e8b48c', accent: '#bf0a30' },
  { id: 'mex', name: 'Mexico',      flag: '🇲🇽', primary: '#006847', secondary: '#ffffff', skin: '#c98a5e', accent: '#ce1126' },
  { id: 'can', name: 'Canada',      flag: '🇨🇦', primary: '#d52b1e', secondary: '#ffffff', skin: '#e0a878', accent: '#ffffff' },
  { id: 'arg', name: 'Argentina',   flag: '🇦🇷', primary: '#75aadb', secondary: '#ffffff', skin: '#d99a6c', accent: '#f6b40e' },
  { id: 'bra', name: 'Brazil',      flag: '🇧🇷', primary: '#ffdf00', secondary: '#009b3a', skin: '#8d5a3c', accent: '#002776' },
  { id: 'fra', name: 'France',      flag: '🇫🇷', primary: '#0055a4', secondary: '#ffffff', skin: '#6f4a32', accent: '#ef4135' },
  { id: 'eng', name: 'England',     flag: '🏴', primary: '#ffffff', secondary: '#1d3a8a', skin: '#e0a878', accent: '#cf081f' },
  { id: 'esp', name: 'Spain',       flag: '🇪🇸', primary: '#c60b1e', secondary: '#ffc400', skin: '#d99a6c', accent: '#ffc400' },
  { id: 'ger', name: 'Germany',     flag: '🇩🇪', primary: '#ffffff', secondary: '#000000', skin: '#e0a878', accent: '#dd0000' },
  { id: 'por', name: 'Portugal',    flag: '🇵🇹', primary: '#006600', secondary: '#ff0000', skin: '#c98a5e', accent: '#ff0000' },
  { id: 'ned', name: 'Netherlands', flag: '🇳🇱', primary: '#ff6c00', secondary: '#ffffff', skin: '#e0a878', accent: '#21468b' },
  { id: 'jpn', name: 'Japan',       flag: '🇯🇵', primary: '#0a2987', secondary: '#ffffff', skin: '#e6bd8f', accent: '#bc002d' },
  { id: 'kor', name: 'Korea Rep.',  flag: '🇰🇷', primary: '#c8102e', secondary: '#ffffff', skin: '#e6bd8f', accent: '#003478' },
  { id: 'mar', name: 'Morocco',     flag: '🇲🇦', primary: '#c1272d', secondary: '#006233', skin: '#a9744f', accent: '#006233' },
  { id: 'cro', name: 'Croatia',     flag: '🇭🇷', primary: '#ff0000', secondary: '#ffffff', skin: '#d99a6c', accent: '#171796' },
  { id: 'bel', name: 'Belgium',     flag: '🇧🇪', primary: '#e30613', secondary: '#000000', skin: '#e0a878', accent: '#fdda24' },
];

// Difficulty presets used by the AI controller.
const DIFFICULTY = {
  easy:   { reaction: 0.34, speedMult: 0.78, jumpChance: 0.35, kickWindow: 0.55, errorPx: 90, label: 'EASY' },
  normal: { reaction: 0.20, speedMult: 0.92, jumpChance: 0.55, kickWindow: 0.42, errorPx: 50, label: 'NORMAL' },
  hard:   { reaction: 0.11, speedMult: 1.02, jumpChance: 0.72, kickWindow: 0.30, errorPx: 22, label: 'HARD' },
  legend: { reaction: 0.05, speedMult: 1.10, jumpChance: 0.85, kickWindow: 0.22, errorPx: 8,  label: 'LEGEND' },
};

// 8-team single-player tournament bracket → 2026 World Cup "Road to Glory".
const TOURNAMENT_STAGES = ['Group Stage', 'Round of 16', 'Quarter-Final', 'Semi-Final', 'FINAL'];
