<h1 align="center">🛰️ IMPOSTOR STATION</h1>
<p align="center"><b>A browser social-deduction game — do your tasks, find the impostors, vote them out.</b></p>

<p align="center">
  <img alt="HTML5" src="https://img.shields.io/badge/HTML5-Canvas-orange">
  <img alt="JavaScript" src="https://img.shields.io/badge/Vanilla-JS-yellow">
  <img alt="No build" src="https://img.shields.io/badge/build-none-brightgreen">
  <img alt="Single player" src="https://img.shields.io/badge/mode-single--player%20vs%20bots-blue">
</p>

A single-player, browser-based **social-deduction game** inspired by the "impostor" genre.
Crewmates race to finish station tasks and identify the impostors hiding among them; impostors
pick off the crew, sabotage systems, and slip through the vents without getting caught. Everything
is rendered procedurally on an HTML5 `<canvas>` and runs as **static files** — no build, no
framework, no backend.

> Original game: original code, art, station layout, names and tasks. Not affiliated with, and not
> reusing the assets of, any existing game — only the (uncopyrightable) genre mechanics.

---

## ✨ Features

- **🎭 Roles** — each round you're randomly a **Crewmate** or an **Impostor** (or force a side from the menu).
- **🤖 7 AI bots** that navigate the station, do tasks, kill, vent, report bodies and **vote** in meetings.
- **🗺️ A connected 9-room station** (Cafeteria, Reactor, Electrical, Navigation, MedBay, Weapons, Storage, Engine, Shields) with corridors, vents and a fog-of-war **vision** system.
- **🧰 6 task minigames** — wiring, data download/upload, card swipe, code keypad, hold-to-fill, and an asteroid-clearing task. A shared **task bar** tracks crew progress.
- **🔪 Impostor toolkit** — proximity **kills** on a cooldown, **vents** that teleport between connected rooms, and **sabotages** (kill the lights to blind the crew, or trigger a reactor meltdown countdown).
- **🚨 Emergency meetings & voting** — report a body or hit the emergency button to start a discussion → vote → ejection, with the classic role reveal.
- **🏆 Win conditions** — crew win by finishing every task or ejecting all impostors; impostors win by reaching numerical parity or letting the reactor melt down.
- **🔊 Procedural audio** — synthesized footsteps, task jingles, kill stinger, meeting alarm and more via the Web Audio API.

---

## 🕹️ Controls

| Action | Keys |
|---|---|
| Move | `W A S D` / Arrow keys |
| Use / do task / vent / fix | `E` (or **USE** button) |
| Report body | `R` |
| Kill (impostor) | `Q` |
| Sabotage (impostor) | `F` |

On-screen action buttons mirror the keys, so it's fully playable with a mouse too.

---

## 🎯 How to play

**As a Crewmate** — walk to the glowing task markers and complete the minigames to fill the task bar.
If you find a body, press **R** to report it and argue your case in the meeting. Watch who's near
bodies, who vents, and who never seems to do tasks.

**As an Impostor** — blend in by faking tasks, isolate a crewmate and press **Q** to eliminate them,
then **vent** away or call **sabotage (F)** to split the crew. Don't get caught on cooldown next to a
fresh body. Reach parity with the crew and the station is yours.

---

## 🚀 Run locally

Static files — any HTTP server works:

```bash
# Node
npx serve -l 5050 .
# or Python
python -m http.server 5050
```

Open <http://localhost:5050>.

---

## 📁 Project structure

```
.
├── index.html          # shell + DOM overlays, loads scripts in order
├── css/style.css       # full UI + minigame theme
└── js/
    ├── config.js       # world, rooms, corridors, tasks, vents, colours, tuning
    ├── audio.js        # Web Audio synthesized SFX
    ├── input.js        # keyboard + action edges
    ├── map.js          # floor render, collision, vents, bot waypoint graph (BFS)
    ├── entities.js     # Crewmate (player + bots) + Corpse — procedural astronaut art
    ├── tasks.js        # task minigame overlays
    ├── ai.js           # bot behaviour (crew + impostor) and voting heuristics
    ├── meeting.js      # emergency meeting + voting flow
    ├── game.js         # engine: loop, camera, vision, interactions, sabotage, win logic
    └── ui.js           # HUD, menu, role reveal, action buttons, sabotage menu, game-over
```

---

## 📜 License

MIT — see [`LICENSE`](LICENSE). Original work; the social-deduction format is a game genre, and all
code and art here are written from scratch.
