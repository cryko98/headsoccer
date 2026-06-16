<h1 align="center">⚽ World Cup 2026 · Head Soccer</h1>
<p align="center"><b>A Solana <code>$GOAL</code> Play-to-Earn arcade football game</b></p>

<p align="center">
  <img alt="HTML5" src="https://img.shields.io/badge/HTML5-Canvas-orange">
  <img alt="JavaScript" src="https://img.shields.io/badge/Vanilla-JS-yellow">
  <img alt="Solana" src="https://img.shields.io/badge/Solana-P2E-14F195">
  <img alt="No build" src="https://img.shields.io/badge/build-none-brightgreen">
</p>

A fast, arcade-style **Head Soccer** game themed around the **2026 FIFA World Cup**, with a built-in
**Play-to-Earn** layer for the Solana memecoin **`$GOAL`**. Pick your nation, smash the ball into the
net, and earn `$GOAL` tokens for goals, wins, clean sheets and tournament glory — then claim them to
your Phantom wallet.

Everything is rendered procedurally on an HTML5 `<canvas>` (no image/audio assets) and the whole game
runs as **static files** — no build step, no framework, no backend required to play.

---

## ✨ Features

- **🌍 16 national sides** with authentic kit colours (USA, Mexico, Canada, Argentina, Brazil, France, England, Spain, Germany, …).
- **🎮 Two game modes**
  - **Quick Match** — one-off game vs. CPU with sudden-death on a draw.
  - **🏆 Road to Glory** — 5-stage World Cup bracket (Group Stage → Final) with rising difficulty.
- **🤖 4 AI difficulty tiers** — Easy / Normal / Hard / Legend, each with distinct reaction, speed and aggression.
- **⚡ Real physics** — gravity, ball restitution, momentum transfer on headers, charge-up **power shots**.
- **💰 `$GOAL` Play-to-Earn economy**
  | Action | Reward |
  |---|---|
  | Goal scored | `+12 $GOAL` |
  | Match win | `+60 $GOAL` |
  | Clean sheet | `+40 $GOAL` |
  | Tournament stage cleared | `+150 $GOAL` |
  | **World Cup won** | `+1000 $GOAL` |
  | Daily login | `+25 $GOAL` |
- **👛 Phantom wallet integration** — connect, accrue off-chain, and **claim** to your wallet (with a DEMO fallback when no wallet is installed, so the full loop is always playable).
- **🔊 Procedural audio** — synthesized kicks, crowd roar, whistle and goal jingles via the Web Audio API.
- **📱 Responsive** — scales to desktop and mobile viewports.

---

## 🕹️ Controls

| Action | Keys |
|---|---|
| Move | `◀` `▶` &nbsp;/&nbsp; `A` `D` |
| Jump | `▲` &nbsp;/&nbsp; `W` &nbsp;/&nbsp; `Space` |
| Shoot / Kick | `X` `Z` &nbsp;/&nbsp; `▼` `S` &nbsp;— *hold to charge a power shot* |

Stand next to the ball and press shoot to kick. **Hold** shoot to build the power meter (top of screen) for a
much harder, goal-bound strike.

---

## 🚀 Run locally

It's static — any HTTP server works:

```bash
# Option A — Node
npx serve -l 5050 .

# Option B — Python
python -m http.server 5050
```

Then open <http://localhost:5050>. (Opening `index.html` directly works too, though a server is recommended for the Web Audio autoplay policy.)

---

## 📁 Project structure

```
.
├── index.html          # shell + DOM overlays, loads scripts in order
├── css/
│   └── style.css       # full UI theme
└── js/
    ├── config.js       # constants, 16-team roster, $GOAL token economy
    ├── physics.js      # vector math + circle collision resolution
    ├── audio.js        # Web Audio synthesized SFX + crowd ambience
    ├── wallet.js       # Solana / Phantom P2E ledger + claim flow
    ├── entities.js     # Ball, Player (procedural heads), Goal
    ├── ai.js           # CPU opponent controller
    ├── game.js         # engine: loop, match flow, tournament, rendering
    └── ui.js           # menus, HUD, results, wallet panel
```

---

## 🔗 Going on-chain (real `$GOAL` mint)

The economy is **off-chain by default** — rewards accrue locally and settle to the wallet on **claim**.
To make claims transfer a real SPL token:

1. Create your `$GOAL` SPL mint on Solana and set `CONFIG.TOKEN.MINT` / `DECIMALS` in [`js/config.js`](js/config.js).
2. Stand up a small backend (reward authority) that signs SPL transfers of the claimed amount to the player's address.
3. Replace the **DEMO settlement** block in `claimToChain()` inside [`js/wallet.js`](js/wallet.js) with a `fetch()` to that backend, returning the confirmed transaction signature.

The connect / accrue / claim UX and all integration points are already wired — only the settlement call needs swapping.

> ⚠️ This repository ships a **placeholder** mint address and a demo settlement path. Do your own
> security review and audit before handling real funds. Not financial advice.

---

## 📜 License

MIT — see [`LICENSE`](LICENSE). Original game built from scratch; not affiliated with FIFA or any third party.
Country names/flags are used nominally for a sports theme.
