# Dead Reckoning

A multiplayer pirate treasure hunt for 2–5 players, built with Next.js. Roll, sail, grab a key, reach the chest — and watch your back.

```bash
npm install
npm run dev   # http://localhost:3000 (the socket server only accepts localhost:3000 / coffeecoders.cc)
```

## How the game works

- **Turn:** roll a d6 → that many movement points (MP). Tap a highlighted tile to step there (6 directions, hexagon tiles). Each tile shows its cost. The turn ends when you run out of MP, run out of moves, or press *End turn*.
- **Cost:** land 1, water 2 — or 1 with a ship. Visit any harbour to get a ship (kept until you are killed).
- **Pick-ups:** keys and powerups are collected just by passing over them.
- **Win:** step on the chest while carrying a key. There are always N−1 keys for N players.
- **Powerups** (use costs 1 MP): sword (range 1, 3 shots), pistol (range 2, 3 shots), cannon (range 4, 2 shots), eyepatch (put on once; halves the cost of your next 6 steps). Picking up a duplicate adds its charges.

## Decisions I made (easy to change)

All numbers are at the top of [lib/rules.ts](lib/rules.ts); the map is in [lib/map.ts](lib/map.ts).

| Topic | Decision |
| --- | --- |
| Map | Fixed 17×20 hexagon chart of separate islands (coordinates A–Q, 1–20), 9 harbours, 5 spawns (one per seat). Edit the `LAYOUT` rows to reshape it. Coastlines are drawn from the tile boundary, smoothed in [lib/coast.ts](lib/coast.ts); gameplay always uses the exact tile grid. |
| Random setup | Chest, N−1 keys and 17 powerups (5 swords, 4 pistols, 3 cannons, 5 eyepatches) are placed randomly on land away from spawns and harbours. The chest goes as far from the active spawns as the map allows. |
| Chest | Visible from the start — the race is for the scarce keys. Reaching it without a key just tells you it's locked. |
| Distance | Weapon "radius" and movement both use hex distance (any of the 6 neighbouring tiles is 1 tile away). |
| Eyepatch | Costs 1 MP once, then stays on. Halves costs: land 0.5, water 1, ship water 0.5 (shown as ½). Each discounted step uses a charge. |
| First step | You can always take at least one step per turn even if you lack the MP (so a roll of 1 doesn't strand a swimmer). |
| Combat | Hits always kill. The victim respawns at their spawn, losing ship, items and eyepatch. **Carried keys drop on the tile they died on, land or sea**; anyone passing over picks them up. |
| Leaving | A player who quits drops their keys where they stood. |
| Stuck turns | If nothing more can be done (no step, no usable item), the turn passes automatically. |
| Shared tiles | Pirates may share a tile. |
| Zoom | The chart is large, so "Zoom in" shows a 9×9 window that follows the active pirate. It is the default on phones. |

## Design

An Admiralty-chart look: dark slate UI, one brass accent reserved for things you can act on (reachable tiles, selected item, whose turn), muted chart colours, hairline dividers. Players are abstract tokens, each a different shape and colour with an initial, so they read without relying on colour alone. Icons are drawn monoline SVG ([components/ItemIcon.tsx](components/ItemIcon.tsx)). Type: Newsreader (italic wordmark and headings) with Instrument Sans for the interface.

## Multiplayer architecture

The Socket.IO server only relays messages ([docs/sop-socket.md](docs/sop-socket.md)), so the **host** (first present player) is the authority: [lib/roomClient.ts](lib/roomClient.ts) receives intents (`roll`, `step`, `use`, `end`, …), validates each one with the pure rules in [lib/rules.ts](lib/rules.ts) — turn, stage, adjacency, movement points, weapon range, charges — and broadcasts the full state. Invalid or out-of-turn intents are ignored. If the host disconnects, the next player in join order takes over from their copy of the state. Disconnected players are skipped after a short grace period; players who quit drop their keys back onto the map.

Layout: `lib/` rules, map, coastline geometry and room client · `components/Board.tsx` the SVG map · `Table.tsx` the play screen (dice, gear, pirates) · Radix UI Dialog/Tooltip for the rules, win screen and item tooltips. Players are shown as shaped tokens (`Token.tsx`).
