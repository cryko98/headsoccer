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

- **🌐 Online multiplayer** — host or join a room with a 4-letter code and play with friends over a real WebSocket server (bundled, dependency-free). Single-player vs bots is still fully available.
- **🎭 Roles** — each round you're randomly a **Crewmate** or an **Impostor** (or force a side from the menu).
- **🗺️ 3 original maps** — **Orbital Hub**, **Sky Relay** and **Frost Colony**, each a fully-connected station with its own rooms, corridor layout, vent network, security cameras and sabotage consoles. The map system is data-driven, so more maps drop in cleanly.
- **🤖 Up to 11 AI bots** that navigate the station, do tasks, kill, vent, **report bodies**, **help fix sabotages**, and **vote** in meetings.
- **🧰 Task taxonomy & 7 minigames** — **common** (everyone gets it), **short**, **long** (multi-step across rooms) and **visual** tasks (scan / asteroids / garbage that play a witnessable animation). Minigames: wiring, download/upload, card swipe, keypad, hold-to-fill, asteroids and a medical scan. A shared **task bar** tracks crew progress.
- **🔪 Impostor toolkit** — proximity **kills** on a cooldown, **vents** that teleport between connected rooms, and a full **sabotage** menu:
  - **Reactor meltdown** — timed; two consoles must be covered at once to fix.
  - **Lights** — shrinks the crew's vision.
  - **Comms** — disables the task list and minimap.
  - **Doors** — seals the impostor's current room for a few seconds.
- **📹 Security cameras & 🧭 minimap** — watch live room feeds from the security console, or pop the minimap (both go dark when comms are down).
- **🎨 Customization** — pick your **colour**, **hat** and **pet** (the pet follows you around the station) with a live preview.
- **⚙️ Customizable match settings** — players, impostors, player speed, kill cooldown & range, crew vision, emergency count, discussion & voting time, tasks per crew, **anonymous votes** and **confirm ejects**.
- **🚨 Emergency meetings & voting** — report a body or hit an emergency button to start a discussion → vote → ejection, with the role reveal.
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
| Toggle minimap | `M` |
| Close cameras / menus | `Esc` |

On-screen action buttons mirror the keys, so it's fully playable with a mouse too. **Use** is context-sensitive: it does tasks, opens vents (impostor), reads the security cameras, or calls an emergency meeting depending on what you're standing next to.

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

## 🌐 Online multiplayer

A bundled, **dependency-free** WebSocket server (Node built-ins only — no `npm install`) runs the
authoritative match flow (roles, kills, meetings, votes, sabotage, win conditions); clients handle
their own movement and task minigames.

```bash
# 1) start the game server (default port 8080)
node server/server.js          # or: cd server && npm start
#    PORT=9000 node server/server.js   # custom port

# 2) serve the game and open it (separate terminal)
npx serve -l 5050 .
```

Then, in the game: **PLAY ONLINE** → enter the server address (`ws://localhost:8080` by default) →
**HOST GAME** to get a 4-letter code, or **JOIN** with a friend's code. The host presses **START**
(needs 3+ players). To play across the internet, host the server on a reachable machine and share
`ws://<host>:8080` (use `wss://` behind a TLS proxy).

Run the server's logic test with `cd server && npm test`.

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
    ├── meeting.js      # emergency meeting + voting flow (single-player)
    ├── net.js          # online client: WebSocket wrapper + event bus
    ├── game.js         # engine: loop, camera, vision, interactions, sabotage, win logic, online mode
    └── ui.js           # HUD, menu, settings, cosmetics, lobby, meetings, game-over

server/                 # online multiplayer (Node, dependency-free)
├── server.js           # minimal RFC-6455 WebSocket server (http + crypto only)
├── room.js             # pure, testable game-flow authority (rooms, roles, votes, win)
├── _test.js            # room-logic integration test (npm test)
└── package.json
```

---

## 📜 License

MIT — see [`LICENSE`](LICENSE). Original work; the social-deduction format is a game genre, and all
code and art here are written from scratch.
