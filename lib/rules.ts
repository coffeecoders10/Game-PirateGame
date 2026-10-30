// Pure game rules. Every function takes a GameState and returns a new one
// (or the same object when nothing changed). Only the room host runs these and
// validates every intent; everyone else just renders the state the host broadcasts.
//
// Tunable gameplay numbers live at the top of this file.

import { HARBOURS, PORT_LAND, SPAWNS, TILE_COUNT, dist, isLand, neighbours, tileName } from "./map";

export const MAX_PLAYERS = 5;
export const MIN_PLAYERS = 2;

export type Weapon = "sword" | "pistol" | "cannon";
export type Powerup = Weapon | "eyepatch";
export type ItemKind = Powerup | "key";

/** Tile radius each weapon reaches (every neighbouring hexagon counts as 1). */
export const RANGE: Record<Weapon, number> = { sword: 1, pistol: 2, cannon: 4 };
/** Uses a freshly found item gives. Eyepatch charges are discounted steps. */
export const CHARGES: Record<Powerup, number> = { sword: 3, pistol: 3, cannon: 2, eyepatch: 6 };
/** Powerups scattered at game start, scaled to the player count (17 at five players). */
const powerupSpawns = (players: number): Powerup[] => [
  ...Array<Powerup>(players).fill("sword"),
  ...Array<Powerup>(Math.round(players * 0.8)).fill("pistol"),
  ...Array<Powerup>(Math.round(players * 0.6)).fill("cannon"),
  ...Array<Powerup>(players).fill("eyepatch"),
];
/** Health every pirate starts with and wakes up with. */
export const MAX_HP = 6;
/** At or below this health every step costs double. */
export const LOW_HP = 3;
/** Health a weapon takes off its target per hit. */
export const DAMAGE: Record<Weapon, number> = { sword: 1, pistol: 1, cannon: 2 };
/** Tile radius a knocked-out pirate can hurl their key. */
export const THROW_RANGE = 4;
/** Movement points spent by activating any powerup. */
export const USE_COST = 1;

/** One seat per player. Every token is the same round medallion; the colour tells them apart. */
export const SEATS = [
  { name: "Crimson", hex: "#9b2c2f" },
  { name: "Cobalt", hex: "#2d5d9c" },
  { name: "Jade", hex: "#23765a" },
  { name: "Violet", hex: "#63489f" },
  { name: "Amber", hex: "#a8671b" },
] as const;

export type Phase = "lobby" | "playing" | "finished";
export type Inventory = Record<Powerup, number>;

export type Player = {
  id: string;
  name: string;
  color: number; // index into SEATS; also the spawn seat
  pos: number;
  spawn: number; // where this pirate starts; shuffled each game
  online: boolean;
  left: boolean; // quit mid-game; skipped forever
  ship: boolean;
  keys: number;
  inv: Inventory;
  loans: Loan[]; // gear picked up and where it came from; it goes back there once used up
  hp: number; // 0 = knocked out: misses their next turn and wakes with full health
  eyepatchOn: boolean; // eyepatch put on: halves step costs until its charges run out
  kills: number;
};

export type Item = { pos: number; kind: ItemKind };
/** A gear pick-up still carried: `left` charges remain, then the item returns to `home`. */
export type Loan = { kind: Powerup; home: number; left: number };

export type LogKind = "roll" | "pickup" | "ship" | "attack" | "throw" | "eyepatch" | "locked" | "stuck" | "info" | "win";
export type LogEntry = {
  n: number;
  kind: LogKind;
  text: string;
  pid?: string;
  /** For attacks: the weapon used, who was hit and where. */
  weapon?: Weapon;
  target?: string;
  from?: number;
  at?: number;
};

export type GameState = {
  v: number; // bumped on every change; receivers keep the highest
  code: string;
  phase: Phase;
  players: Player[];
  turn: string; // player id
  stage: "roll" | "move" | "throw"; // waiting for the die, spending movement points, or a knocked-out pirate hurling a key
  thrower: string | null; // who is hurling a key while stage is "throw"; `turn` still names the pirate who knocked them out
  dice: number | null; // last roll
  rolls: number; // total rolls so far (drives the dice animation)
  mp: number; // movement points left this turn
  moved: boolean; // took a step this turn
  chest: number;
  items: Item[];
  log: LogEntry[]; // newest last
  play: { n: number; by: string; actions: Action[] } | null; // last confirmed turn, replayed on other screens
  n: number; // log counter
  winner: string | null;
};

export type Rng = () => number;

const emptyInv = (): Inventory => ({ sword: 0, pistol: 0, cannon: 0, eyepatch: 0 });

const newPlayer = (id: string, name: string, color: number, spawn = SPAWNS[color]): Player => ({
  id, name, color, pos: spawn, spawn, online: true, left: false,
  ship: false, keys: 0, inv: emptyInv(), loans: [], hp: MAX_HP, eyepatchOn: false, kills: 0,
});

export function createGame(code: string, id: string, name: string): GameState {
  return {
    v: 1, code, phase: "lobby", players: [newPlayer(id, name, 0)], turn: id, stage: "roll", thrower: null,
    dice: null, rolls: 0, mp: 0, moved: false, chest: -1, items: [], log: [], play: null, n: 0, winner: null,
  };
}

export const isActive = (p: Player) => !p.left;
const byId = (s: GameState, id: string) => s.players.find((p) => p.id === id);
const pick = <T,>(arr: T[], rng: Rng) => arr[Math.floor(rng() * arr.length)];

// ── lobby ───────────────────────────────────────────────────────────────────

/** The host is the first player (in join order) who is still here. */
export function pickHost(s: GameState, present: ReadonlySet<string>): string | null {
  return s.players.find((p) => isActive(p) && present.has(p.id))?.id ?? null;
}

export function addPlayer(s: GameState, id: string, name: string): GameState {
  const existing = byId(s, id);
  if (existing) {
    if (existing.left || (existing.online && existing.name === name)) return s;
    return { ...s, players: s.players.map((p) => (p.id === id ? { ...p, online: true, name } : p)) };
  }
  if (s.phase !== "lobby" || s.players.length >= MAX_PLAYERS) return s;
  const taken = new Set(s.players.map((p) => p.color));
  const color = SEATS.findIndex((_, i) => !taken.has(i));
  return { ...s, players: [...s.players, newPlayer(id, name, color)] };
}

/** Sync `online` flags with who is really in the socket room. */
export function setPresence(s: GameState, present: ReadonlySet<string>): GameState {
  let players = s.players.map((p) => (p.online === present.has(p.id) ? p : { ...p, online: present.has(p.id) }));
  if (s.phase === "lobby") players = players.filter((p) => p.online);
  const unchanged = players.length === s.players.length && players.every((p, i) => p === s.players[i]);
  return unchanged ? s : { ...s, players };
}

/** Land tiles nothing sits on: no spawn, harbour, item or chest. */
function freeLand(s: Pick<GameState, "items" | "chest">, spawns: number[]): number[] {
  const used = new Set([...spawns, ...HARBOURS, s.chest, ...s.items.map((i) => i.pos)]);
  return Array.from({ length: TILE_COUNT }, (_, i) => i).filter((i) => isLand(i) && !used.has(i));
}

export function startGame(s: GameState, rng: Rng = Math.random): GameState {
  const ready = s.players.filter((p) => p.online);
  if (s.phase !== "lobby" || ready.length < MIN_PLAYERS) return s;

  // Every game scatters the pirates over fresh harbour-island tiles, as far apart as the map allows.
  const starts: number[] = [];
  for (let n = 0; n < ready.length; n++) {
    const open = PORT_LAND.filter((i) => !starts.includes(i));
    const gap = [7, 6, 5, 4, 3, 2, 1].find((d) => open.some((i) => starts.every((t) => dist(t, i) >= d))) ?? 0;
    starts.push(pick(open.filter((i) => starts.every((t) => dist(t, i) >= gap)), rng));
  }
  const players = ready.map((p, i) => newPlayer(p.id, p.name, p.color, starts[i]));
  // The chest goes on land, away from the harbours, as far from the starting spawns as the map allows
  // (tries 8 tiles away, then closer) so nobody starts next to it.
  const spawns = starts;
  const candidates = Array.from({ length: TILE_COUNT }, (_, i) => i).filter(
    (i) => isLand(i) && !HARBOURS.includes(i) && !spawns.includes(i),
  );
  const tier = [8, 7, 6, 5, 4, 3, 2, 1].find((d) => candidates.some((i) => spawns.every((sp) => dist(sp, i) >= d))) ?? 0;
  const far = candidates.filter((i) => spawns.every((sp) => dist(sp, i) >= tier));
  const chest = pick(far, rng);

  const board: Pick<GameState, "items" | "chest"> = { chest, items: [] };
  const kinds: ItemKind[] = [...Array<ItemKind>(players.length - 1).fill("key"), ...powerupSpawns(players.length)];
  for (const kind of kinds) {
    const spot = pick(freeLand(board, spawns), rng);
    board.items = [...board.items, { pos: spot, kind }];
  }
  return {
    ...s, phase: "playing", players, turn: players[0].id, stage: "roll", thrower: null, dice: null, rolls: 0, mp: 0,
    moved: false, chest, items: board.items, log: [], play: null, n: 0, winner: null,
  };
}

export function backToLobby(s: GameState): GameState {
  if (s.phase !== "finished") return s;
  const players = s.players.filter((p) => isActive(p) && p.online).map((p) => newPlayer(p.id, p.name, p.color));
  return {
    ...s, phase: "lobby", players, turn: players[0]?.id ?? s.turn, stage: "roll", thrower: null, dice: null, mp: 0,
    chest: -1, items: [], log: [], play: null, winner: null,
  };
}

// ── turn flow ───────────────────────────────────────────────────────────────

function say(s: GameState, e: Omit<LogEntry, "n">): GameState {
  const n = s.n + 1;
  return { ...s, n, log: [...s.log, { ...e, n }].slice(-8) };
}

/** Next player after the current one who is here (falls back to the current one). */
function nextTurnId(s: GameState): string {
  const n = s.players.length;
  const start = s.players.findIndex((p) => p.id === s.turn);
  for (let i = 1; i <= n; i++) {
    const p = s.players[(start + i) % n];
    if (isActive(p) && p.online) return p.id;
  }
  return s.turn;
}

/** Who the game is waiting on: the knocked-out pirate hurling a key, otherwise whoever's turn it is. */
export const actorId = (s: GameState) => (s.stage === "throw" ? s.thrower : s.turn);

/** Start the next pirate's turn. A knocked-out pirate misses it and wakes up with full health. */
function advance(s: GameState): GameState {
  let cur: GameState = { ...s, stage: "roll", mp: 0, moved: false, thrower: null };
  for (let i = 0; i <= cur.players.length; i++) {
    cur = { ...cur, turn: nextTurnId(cur) };
    const p = byId(cur, cur.turn)!;
    if (p.hp > 0) break;
    cur = { ...cur, players: cur.players.map((q) => (q.id === p.id ? { ...q, hp: MAX_HP } : q)) };
    cur = say(cur, { kind: "info", pid: p.id, text: `${p.name} comes to with full health, but misses this turn` });
  }
  return cur;
}

/**
 * End the current turn. Before the game goes on, every knocked-out pirate still holding a key
 * gets to hurl it (one at a time); one who is offline just drops it where they lie.
 */
function passTurn(s: GameState): GameState {
  const holders = s.players.filter((p) => p.hp <= 0 && p.keys > 0 && isActive(p));
  const thrower = holders.find((p) => p.online);
  if (thrower) return { ...s, stage: "throw", thrower: thrower.id, mp: 0, moved: false };
  const drops: Item[] = holders.flatMap((p) => Array.from({ length: p.keys }, () => ({ pos: p.pos, kind: "key" as const })));
  const players = s.players.map((p) => (holders.includes(p) ? { ...p, keys: 0 } : p));
  return advance(drops.length ? { ...s, players, items: [...s.items, ...drops] } : s);
}

export function skipOfflineTurn(s: GameState): GameState {
  const actor = actorId(s);
  if (s.phase !== "playing" || !actor || byId(s, actor)?.online) return s;
  const next = passTurn(s);
  return s.stage === "throw" || next.turn !== s.turn ? next : s;
}

// ── movement ────────────────────────────────────────────────────────────────

/** Cost of stepping onto `to`. Water is 2 without a ship, 1 with; wounds double it and the eyepatch halves it. */
export function stepCost(p: Player, to: number): number {
  const base = (isLand(to) ? 1 : p.ship ? 1 : 2) * (p.hp <= LOW_HP ? 2 : 1);
  return p.eyepatchOn && p.inv.eyepatch > 0 ? base / 2 : base;
}

/** Tiles the active player can step to right now, with their cost. */
export function legalSteps(s: GameState, p: Player): { to: number; cost: number }[] {
  if (s.phase !== "playing" || s.turn !== p.id || s.stage !== "move") return [];
  return neighbours(p.pos)
    .map((to) => ({ to, cost: stepCost(p, to) }))
    // The first step of a turn is always allowed, so a bad roll never strands a swimmer.
    .filter(({ cost }) => cost <= s.mp || !s.moved);
}

export const canUse = (s: GameState, p: Player, item: Powerup) =>
  s.phase === "playing" && s.turn === p.id && s.stage === "move" && s.mp >= USE_COST &&
  p.inv[item] > 0 && !(item === "eyepatch" && p.eyepatchOn);

export const targetsFor = (s: GameState, p: Player, w: Weapon) =>
  s.players.filter((o) => o.id !== p.id && isActive(o) && o.hp > 0 && dist(o.pos, p.pos) <= RANGE[w]);

/** Anything left to do this turn? If not, the turn ends by itself. */
function hasMoves(s: GameState): boolean {
  const p = byId(s, s.turn);
  if (!p) return false;
  if (legalSteps(s, p).length) return true;
  return (["sword", "pistol", "cannon"] as const).some((w) => canUse(s, p, w) && targetsFor(s, p, w).length) ||
    canUse(s, p, "eyepatch");
}

/** Close the turn when nothing more can be done. */
function settle(s: GameState): GameState {
  if (s.phase !== "playing" || s.stage !== "move" || hasMoves(s)) return s;
  const who = byId(s, s.turn)?.name ?? "";
  return passTurn(say(s, { kind: "info", pid: s.turn, text: `${who} has no moves left` }));
}

export function rollDice(s: GameState, pid: string, dice: number): GameState {
  const p = byId(s, pid);
  if (s.phase !== "playing" || s.turn !== pid || s.stage !== "roll" || !p) return s;
  const rolled: GameState = { ...s, stage: "move", dice, rolls: s.rolls + 1, mp: dice, moved: false };
  return settle(say(rolled, { kind: "roll", pid, text: `${p.name} rolled a ${dice}` }));
}

export function endTurn(s: GameState, pid: string): GameState {
  if (s.phase !== "playing" || s.turn !== pid || s.stage !== "move") return s;
  return passTurn(s);
}

/**
 * A move planned during a turn. The active player builds a list of these locally, and only the
 * confirmed list is sent to the host. With `auto` off the turn never ends by itself, so a draft
 * stays editable until it is confirmed.
 */
export type Action = { t: "step"; to: number } | { t: "use"; item: Powerup; target?: string };

export function applyActions(s: GameState, pid: string, actions: Action[]): GameState {
  return actions.reduce((cur, a) => {
    if (a.t === "step") return step(cur, pid, a.to, false);
    if (a.item === "eyepatch") return wearEyepatch(cur, pid, false);
    return typeof a.target === "string" ? attack(cur, pid, a.item, a.target, false) : cur;
  }, s);
}

/** Replay a confirmed plan on the host's state, then close the turn. */
export function confirmTurn(s: GameState, pid: string, actions: Action[]): GameState {
  if (s.phase !== "playing" || s.turn !== pid || s.stage !== "move") return s;
  const done = endTurn(applyActions(s, pid, actions), pid);
  return { ...done, play: { n: (s.play?.n ?? 0) + 1, by: pid, actions } };
}

export function step(s: GameState, pid: string, to: number, auto = true): GameState {
  const p = byId(s, pid);
  const move = p && legalSteps(s, p).find((m) => m.to === to);
  if (!p || !move) return s;

  let back: Item[] = [];
  let next: GameState = {
    ...s, moved: true, mp: Math.max(0, s.mp - move.cost),
    players: s.players.map((q) => {
      if (q.id !== pid) return q;
      const moved = { ...q, pos: to };
      if (!(q.eyepatchOn && q.inv.eyepatch > 0)) return moved; // each discounted step uses one eyepatch charge
      const used = useCharge(moved, "eyepatch");
      back = used.back;
      return used.p;
    }),
  };
  next = arrive(next, pid);
  // Gear that ran dry returns after arriving, so it is not picked straight back up.
  next = { ...next, items: [...next.items, ...back] };
  if (!auto) return next;
  return settle(next.phase === "playing" && next.mp <= 0 ? passTurn(next) : next);
}

/** Use up one charge of `kind`. A pick-up that runs dry goes back to the tile it came from. */
function useCharge(p: Player, kind: Powerup): { p: Player; back: Item[] } {
  const back: Item[] = [];
  let spent = false;
  const loans = p.loans.flatMap((l) => {
    if (spent || l.kind !== kind) return [l];
    spent = true;
    if (l.left > 1) return [{ ...l, left: l.left - 1 }];
    back.push({ pos: l.home, kind });
    return [];
  });
  return { p: { ...p, inv: { ...p.inv, [kind]: p.inv[kind] - 1 }, loans }, back };
}

/** Everything that happens when a pirate walks onto a tile (also when only passing through). */
function arrive(s: GameState, pid: string): GameState {
  let p = byId(s, pid)!;
  const here = s.items.filter((i) => i.pos === p.pos);
  let next = s;

  if (p.eyepatchOn && p.inv.eyepatch <= 0) {
    p = { ...p, eyepatchOn: false };
    next = { ...next, players: next.players.map((q) => (q.id === pid ? p : q)) };
    next = say(next, { kind: "eyepatch", pid, text: `${p.name}'s eyepatch wore out` });
  }

  for (const item of here) {
    if (item.kind === "key") p = { ...p, keys: p.keys + 1 };
    else {
      p = {
        ...p, inv: { ...p.inv, [item.kind]: p.inv[item.kind] + CHARGES[item.kind] },
        loans: [...p.loans, { kind: item.kind, home: item.pos, left: CHARGES[item.kind] }],
      };
    }
    next = say(next, { kind: "pickup", pid, at: item.pos, text: `${p.name} found ${item.kind === "key" ? "a key" : `a ${item.kind}`}` });
  }
  if (HARBOURS.includes(p.pos) && !p.ship) {
    p = { ...p, ship: true };
    next = say(next, { kind: "ship", pid, at: p.pos, text: `${p.name} boarded a ship` });
  }
  next = {
    ...next,
    items: here.length ? next.items.filter((i) => i.pos !== p.pos) : next.items,
    players: next.players.map((q) => (q.id === pid ? p : q)),
  };

  if (p.pos === next.chest) {
    if (p.keys > 0) {
      return say({ ...next, phase: "finished", winner: pid }, { kind: "win", pid, at: p.pos, text: `${p.name} opened the treasure chest!` });
    }
    next = say(next, { kind: "locked", pid, at: p.pos, text: `${p.name} found the chest — it's locked. Bring a key!` });
  }
  return next;
}

// ── items & combat ──────────────────────────────────────────────────────────

export function wearEyepatch(s: GameState, pid: string, auto = true): GameState {
  const p = byId(s, pid);
  if (!p || !canUse(s, p, "eyepatch")) return s;
  const next: GameState = {
    ...s, mp: s.mp - USE_COST,
    players: s.players.map((q) => (q.id === pid ? { ...q, eyepatchOn: true } : q)),
  };
  const said = say(next, { kind: "eyepatch", pid, text: `${p.name} put on the eyepatch — moves cost half` });
  return auto ? settle(said) : said;
}

export function attack(s: GameState, pid: string, weapon: Weapon, targetId: string, auto = true): GameState {
  const p = byId(s, pid);
  const t = byId(s, targetId);
  if (!p || !t || !(weapon in RANGE) || !canUse(s, p, weapon)) return s;
  if (!targetsFor(s, p, weapon).some((o) => o.id === targetId)) return s;

  // Every hit hurts. At 0 health the victim is knocked out where they stand: they miss their next
  // turn and wake with full health. A key they carry is hurled away once the attacker's turn ends.
  const hp = Math.max(0, t.hp - DAMAGE[weapon]);
  const ko = hp === 0;
  const spent = useCharge(p, weapon);
  const players = s.players.map((q) => {
    if (q.id === targetId) return { ...q, hp };
    if (q.id === pid) return { ...spent.p, kills: q.kills + (ko ? 1 : 0) };
    return q;
  });
  const next: GameState = { ...s, mp: s.mp - USE_COST, players, items: [...s.items, ...spent.back] };
  const said = say(next, {
    kind: "attack", pid, weapon, target: targetId, from: p.pos, at: t.pos,
    text: `${p.name} ${weapon === "cannon" ? "blasted" : weapon === "pistol" ? "shot" : "cut down"} ${t.name}` +
      ` for ${DAMAGE[weapon]}` + (ko ? " — knocked out!" : ` (${hp} health left)`),
  });
  return auto ? settle(said) : said;
}

/** A knocked-out pirate hurls their key to any tile within THROW_RANGE, then the game resumes. */
export function throwKey(s: GameState, pid: string, to: number): GameState {
  const p = byId(s, pid);
  if (s.phase !== "playing" || s.stage !== "throw" || s.thrower !== pid || !p || p.keys <= 0) return s;
  if (!Number.isInteger(to) || to < 0 || to >= TILE_COUNT || dist(p.pos, to) > THROW_RANGE) return s;
  const next: GameState = {
    ...s, items: [...s.items, { pos: to, kind: "key" }],
    players: s.players.map((q) => (q.id === pid ? { ...q, keys: q.keys - 1 } : q)),
  };
  return passTurn(say(next, { kind: "throw", pid, from: p.pos, at: to, text: `${p.name} hurled the key to ${tileName(to)}` }));
}

// ── leaving ─────────────────────────────────────────────────────────────────

/** Someone quit on purpose. */
export function removePlayer(s: GameState, id: string): GameState {
  const gone = byId(s, id);
  if (!gone) return s;
  if (s.phase === "lobby") return { ...s, players: s.players.filter((p) => p.id !== id) };

  // Keys they carried drop where they stood.
  const drops: Item[] = Array.from({ length: gone.keys }, () => ({ pos: gone.pos, kind: "key" }));
  // Their gear goes back where it came from.
  const gear: Item[] = gone.loans.map((l) => ({ pos: l.home, kind: l.kind }));
  let next: GameState = {
    ...s, items: [...s.items, ...drops, ...gear],
    players: s.players.map((p) => (p.id === id ? { ...p, left: true, keys: 0, loans: [], inv: emptyInv() } : p)),
  };
  if (next.phase === "playing") {
    const remaining = next.players.filter(isActive);
    if (remaining.length <= 1) return { ...next, phase: "finished", winner: remaining[0]?.id ?? null };
    if (next.turn === id || next.thrower === id) next = passTurn(next);
  }
  return next;
}
