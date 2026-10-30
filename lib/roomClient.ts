// Multiplayer layer on top of the documented Socket.IO room API (docs/sop-socket.md).
//
// The server only relays messages, so one player acts as the *host*: it owns the
// game state, rolls the dice, validates every move and broadcasts the full state after each change.
// Everyone else sends intents ("roll", "start", ...) and renders what the host
// sends. If the host drops, the next player in join order takes over — every
// client already holds the full state, so nothing is lost.

import { io, type Socket } from "socket.io-client";
import {
  actorId,
  addPlayer,
  backToLobby,
  confirmTurn,
  createGame,
  pickHost,
  removePlayer,
  rollDice,
  setPresence,
  skipOfflineTurn,
  startGame,
  throwKey,
  type Action,
  type GameState,
} from "./rules";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "https://coffeecoders.cc/socket";
const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH ?? "/flask_api/socket.io";
const ROOM_PREFIX = "dead-reckoning:";

const HELLO_EVERY_MS = 1500;
const SYNC_TIMEOUT_MS = 7000;
const OFFLINE_TURN_GRACE_MS = 6000;

/** What a player asks the host to do. The host validates every one against the rules. */
export type Intent =
  | { t: "roll" | "start" | "again" | "bye" }
  | { t: "confirm"; actions: Action[] }
  | { t: "throw"; to: number };

type Wire = { t: "hello" } | { t: "state"; s: GameState } | Intent;

export type Snapshot = {
  status: "idle" | "joining" | "in" | "error";
  error: string | null;
  game: GameState | null;
  connected: boolean; // socket is up
  meId: string;
  hostId: string | null;
  notice: { n: number; text: string } | null;
};

const IDLE: Snapshot = {
  status: "idle", error: null, game: null, connected: true, meId: "", hostId: null, notice: null,
};

// Usernames are not unique on the server, so we append a per-tab id: "Ada~k3x9q2".
const encodeUser = (name: string, id: string) => `${name.replace(/~/g, "")}~${id}`;
const decodeUser = (u: string) => {
  const i = u.lastIndexOf("~");
  return i < 0 ? { name: u, id: u } : { name: u.slice(0, i), id: u.slice(i + 1) };
};

export class RoomClient {
  private snap: Snapshot = IDLE;
  private listeners = new Set<() => void>();

  private socket: Socket | null = null;
  private roomId = "";
  private me = { id: "", name: "" };
  private game: GameState | null = null;
  private present = new Set<string>();
  private synced = false;
  private connectedBefore = false;
  private noticeCount = 0;
  private helloTimer: ReturnType<typeof setInterval> | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private skipTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.snap;
  getServerSnapshot = () => IDLE;

  // ── public actions ────────────────────────────────────────────────────────

  create(code: string, name: string, id: string) {
    this.game = createGame(code, id, name);
    this.synced = true;
    this.open(code, name, id, "in");
  }

  join(code: string, name: string, id: string) {
    this.game = null;
    this.synced = false;
    this.open(code, name, id, "joining");
  }

  roll() {
    this.intent({ t: "roll" });
  }
  /** Send the whole turn (steps, items, attacks) at once; nothing is shared before this. */
  confirm(actions: Action[]) {
    this.intent({ t: "confirm", actions });
  }
  /** A knocked-out pirate hurls their key to a tile. */
  throwKey(to: number) {
    this.intent({ t: "throw", to });
  }
  start() {
    this.intent({ t: "start" });
  }
  playAgain() {
    this.intent({ t: "again" });
  }

  leave() {
    if (this.socket && this.game) {
      if (this.isHost()) this.commit(removePlayer(this.game, this.me.id));
      else this.send({ t: "bye" });
      this.socket.emit("leave", { username: this.user(), room_id: this.roomId });
    }
    this.teardown();
    this.game = null;
    this.set(IDLE);
  }

  // ── connection ────────────────────────────────────────────────────────────

  private open(code: string, name: string, id: string, status: Snapshot["status"]) {
    this.teardown();
    this.me = { id, name };
    this.roomId = ROOM_PREFIX + code;
    this.present = new Set();
    this.connectedBefore = false;
    this.set({ ...IDLE, status, meId: id, game: this.game, hostId: this.currentHost() });

    const socket = io(SOCKET_URL, { path: SOCKET_PATH, transports: ["websocket"] });
    this.socket = socket;

    // Handlers first, then join (see the SOP).
    socket.on("status", ({ users, log }: { users: string[]; log?: string }) => this.onStatus(users, log));
    socket.on("message", ({ username, socket_data }: { username: string; socket_data: Wire }) =>
      this.onMessage(decodeUser(username), socket_data),
    );
    socket.on("connect", () => {
      this.set({ connected: true });
      // After a reconnect we may have missed updates: trust the host over our copy.
      if (this.connectedBefore && this.status() === "in") this.synced = false;
      this.connectedBefore = true;
      socket.emit("join", { username: this.user(), room_id: this.roomId });
      this.startSync();
    });
    socket.on("disconnect", () => this.set({ connected: false }));
    socket.on("connect_error", () => this.set({ connected: false }));
  }

  private teardown() {
    this.stopSync();
    if (this.skipTimer) clearTimeout(this.skipTimer);
    this.skipTimer = null;
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }

  /** Ask the host for the current state until we get one. */
  private startSync() {
    this.stopSync();
    if (this.synced && this.status() === "in" && this.game?.players.length === 1) return; // fresh creator
    this.helloTimer = setInterval(() => this.present.size && this.send({ t: "hello" }), HELLO_EVERY_MS);
    this.syncTimer = setTimeout(() => {
      this.stopSync();
      if (this.game) {
        this.synced = true; // nobody answered: we are the only one left
        this.afterChange();
      } else {
        this.fail("We couldn't find a hunt with that code.");
      }
    }, SYNC_TIMEOUT_MS);
  }

  private stopSync() {
    if (this.helloTimer) clearInterval(this.helloTimer);
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.helloTimer = this.syncTimer = null;
  }

  private fail(error: string) {
    this.teardown();
    this.game = null;
    this.set({ ...IDLE, status: "error", error });
  }

  // ── incoming ──────────────────────────────────────────────────────────────

  private onStatus(users: string[], log?: string) {
    const first = this.present.size === 0;
    this.present = new Set(users.map((u) => decodeUser(u).id));
    if (first && !this.synced) this.send({ t: "hello" });

    if (log && this.game) this.announcePresence(log);
    if (this.synced && this.game && this.isHost()) this.commit(setPresence(this.game, this.present));
    else this.afterChange();
  }

  private announcePresence(log: string) {
    const m = /^(.*) (joined room|disconnected from room)/.exec(log);
    if (!m) return;
    const { name, id } = decodeUser(m[1]);
    if (id === this.me.id) return;
    this.notice(m[2] === "joined room" ? `${name} came aboard` : `${name} lost connection`);
  }

  private onMessage(from: { name: string; id: string }, msg: Wire) {
    if (!msg || typeof msg !== "object") return;
    switch (msg.t) {
      case "state":
        if (from.id === this.me.id) return;
        // Not yet synced → take the host's word even if our copy looks newer.
        if (!this.game || !this.synced || msg.s.v > this.game.v) this.adopt(msg.s);
        return;
      case "hello":
        if (this.game && this.synced && this.isHost()) {
          this.commit(addPlayer(this.game, from.id, from.name), true);
        }
        return;
      default:
        if (this.game && this.synced && this.isHost()) this.handleIntent(msg, from.id);
    }
  }

  private handleIntent(msg: Intent, from: string) {
    const g = this.game!;
    switch (msg.t) {
      case "roll":
        this.commit(rollDice(g, from, 1 + Math.floor(Math.random() * 6)));
        break;
      case "confirm":
        if (Array.isArray(msg.actions)) this.commit(confirmTurn(g, from, msg.actions.slice(0, 60)));
        break;
      case "throw":
        this.commit(throwKey(g, from, msg.to));
        break;
      case "start":
        if (from === this.me.id) this.commit(startGame(g));
        break;
      case "again":
        if (from === this.me.id) this.commit(backToLobby(g));
        break;
      case "bye":
        this.commit(removePlayer(g, from));
        break;
    }
  }

  // ── state ─────────────────────────────────────────────────────────────────

  private adopt(s: GameState) {
    const before = this.game?.players.find((p) => p.id === this.me.id);
    this.game = s;
    this.synced = true;
    this.stopSync();
    if (this.status() !== "in") this.set({ status: "in" });
    const after = s.players.find((p) => p.id === this.me.id);
    if (before && !after && s.phase === "lobby") this.notice("The hunt was reset");
    this.afterChange();
  }

  /** Host-only: apply a change, bump the version, and tell everyone. */
  private commit(next: GameState, force = false) {
    if (!this.game) return;
    if (next === this.game && !force) return;
    this.game = next === this.game ? { ...next, v: next.v + 1 } : { ...next, v: this.game.v + 1 };
    this.send({ t: "state", s: this.game });
    this.afterChange();
  }

  private afterChange() {
    const g = this.game;
    this.set({ game: g, hostId: this.currentHost() });
    this.armSkipTimer();
  }

  /** If the player whose turn it is has dropped, wait a bit and then move on. */
  private armSkipTimer() {
    if (this.skipTimer) clearTimeout(this.skipTimer);
    this.skipTimer = null;
    const g = this.game;
    if (!g || !this.synced || !this.isHost() || g.phase !== "playing") return;
    if (g.players.find((p) => p.id === actorId(g))?.online !== false) return;
    this.skipTimer = setTimeout(() => {
      if (this.game && this.isHost()) this.commit(skipOfflineTurn(this.game));
    }, OFFLINE_TURN_GRACE_MS);
  }

  private intent(msg: Intent) {
    if (!this.game) return;
    if (this.isHost() && this.synced) this.handleIntent(msg, this.me.id);
    else this.send(msg);
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private currentHost() {
    return this.game ? pickHost(this.game, this.present.size ? this.present : new Set([this.me.id])) : null;
  }
  private isHost() {
    return this.currentHost() === this.me.id;
  }
  private status() {
    return this.snap.status;
  }
  private user() {
    return encodeUser(this.me.name, this.me.id);
  }
  private send(msg: Wire) {
    this.socket?.emit("message", {
      username: this.user(),
      room_id: this.roomId,
      socket_data: JSON.stringify(msg),
    });
  }
  private notice(text: string) {
    this.set({ notice: { n: ++this.noticeCount, text } });
  }
  private set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }
}
