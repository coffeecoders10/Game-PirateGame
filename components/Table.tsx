import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import { TILE_COUNT, dist, tileCenter, tileName } from "@/lib/map";
import {
  CHARGES, DAMAGE, LOW_HP, MAX_HP, RANGE, THROW_RANGE, USE_COST, applyActions, canUse, isActive, legalSteps, targetsFor,
  type Action, type GameState, type Player, type Powerup, type Weapon,
} from "@/lib/rules";
import { Board, FULL_VIEW, type View } from "./Board";
import { Dice } from "./Dice";
import { ITEM_INFO, ItemIcon } from "./ItemIcon";
import { Rules } from "./Rules";
import { Token } from "./Token";
import styles from "./Table.module.css";

type Props = {
  game: GameState;
  meId: string;
  hostId: string | null;
  connected: boolean;
  onRoll: () => void;
  onConfirm: (actions: Action[]) => void;
  onThrow: (to: number) => void;
  onAgain: () => void;
  onLeave: () => void;
};

/** Pause between the moves of a replayed turn. */
const STEP_MS = 750;
const NO_ACTIONS: Action[] = [];
const POWERUPS: Powerup[] = ["sword", "pistol", "cannon", "eyepatch"];
const isWeapon = (i: Powerup): i is Weapon => i !== "eyepatch";
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : `${Math.floor(n) || ""}½`);

/** Close-up window: this many tiles across, centred on a tile and kept inside the chart. */
const CLOSE_TILES = 9;
function closeUp(tile: number): View {
  const size = CLOSE_TILES * 10;
  const lo = FULL_VIEW.x;
  const hi = FULL_VIEW.x + FULL_VIEW.size - size;
  const clamp = (v: number) => Math.min(hi, Math.max(lo, v));
  const { x, y } = tileCenter(tile);
  return { x: clamp(x - size / 2), y: clamp(y - size / 2), size };
}

export function Table({ game: live, meId, hostId, connected, onRoll, onConfirm, onThrow, onAgain, onLeave }: Props) {
  const liveMyTurn = live.phase === "playing" && live.turn === meId && live.stage === "move";

  // The turn is planned locally on top of the shared state; only Confirm sends it. The plan
  // belongs to one roll, so a new roll or turn starts it fresh.
  const planKey = `${live.rolls}:${live.turn}`;
  const [plan, setPlan] = useState<{ key: string; list: Action[] }>({ key: "", list: [] });
  const actions = liveMyTurn && plan.key === planKey ? plan.list : NO_ACTIONS;
  const draft = useMemo(() => (liveMyTurn ? applyActions(live, meId, actions) : live), [live, liveMyTurn, meId, actions]);

  // When someone else confirms their turn, replay it here move by move before showing the result.
  const [anim, setAnim] = useState<GameState | null>(null);
  const prev = useRef(live);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = live;
    const play = live.play;
    if (!play || play.n === before.play?.n) return;
    if (before.phase !== "playing" || before.turn !== play.by || before.stage !== "move") return;
    const frames = play.actions.map((_, i) => applyActions(before, play.by, play.actions.slice(0, i + 1)));
    if (timer.current) clearInterval(timer.current);
    if (!frames.length) return setAnim(null);
    let i = 0;
    setAnim(frames[0]);
    timer.current = setInterval(() => {
      i += 1;
      if (i < frames.length) return setAnim(frames[i]);
      clearInterval(timer.current!);
      timer.current = null;
      setAnim(null);
    }, STEP_MS);
  }, [live, meId]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const game = anim ?? draft;
  const shown = anim ?? live; // the shared chart; your plan only shows as a ghost on top of it
  const addAction = (a: Action) => setPlan({ key: planKey, list: [...actions, a] });

  // The tiles the planned moves pass through, drawn as a see-through pirate on the shared chart.
  const trail = useMemo(() => {
    if (!liveMyTurn || !actions.length) return null;
    const at = (g: GameState) => g.players.find((p) => p.id === meId)!.pos;
    const pts = [at(live), ...actions.map((_, i) => at(applyActions(live, meId, actions.slice(0, i + 1))))];
    const path = pts.filter((t, i) => i === 0 || t !== pts[i - 1]);
    return path.length > 1 ? path : null;
  }, [live, liveMyTurn, meId, actions]);

  const me = game.players.find((p) => p.id === meId);
  const byId = (id: string | null) => game.players.find((p) => p.id === id);
  const turnPlayer = byId(game.turn);
  const playing = live.phase === "playing";
  const myTurn = playing && live.turn === meId && !!me && live.stage !== "throw";

  // A knocked-out pirate holding a key hurls it once the attacker's turn is over; everyone waits.
  const throwing = playing && live.stage === "throw" && !anim;
  const thrower = throwing ? byId(live.thrower) : undefined;
  const iThrow = throwing && live.thrower === meId && !!me;
  const throwTiles = useMemo(
    () => (iThrow && connected && me ? Array.from({ length: TILE_COUNT }, (_, i) => i).filter((i) => dist(i, me.pos) <= THROW_RANGE) : []),
    [iThrow, connected, me],
  );

  // "pending" = we asked the host to roll and no new roll has arrived yet.
  const [pendingRoll, setPendingRoll] = useState<number | null>(null);
  useEffect(() => {
    if (pendingRoll === null) return;
    const t = setTimeout(() => setPendingRoll(null), 4000);
    return () => clearTimeout(t);
  }, [pendingRoll]);
  const pending = pendingRoll === live.rolls;
  const canRoll = myTurn && live.stage === "roll" && connected && !anim;

  // Everyone watches the toss: the big die stays up while a fresh roll settles.
  const [settling, setSettling] = useState(false);
  const lastRolls = useRef(live.rolls);
  useEffect(() => {
    const fresh = live.rolls > lastRolls.current && live.dice !== null;
    lastRolls.current = live.rolls;
    if (!fresh) return;
    setSettling(true);
    const t = setTimeout(() => setSettling(false), 2400);
    return () => clearTimeout(t);
  }, [live.rolls, live.dice]);
  const stageOpen = canRoll || pending || settling;
  const doRoll = () => {
    setPendingRoll(live.rolls);
    onRoll();
  };

  // Weapon being aimed. Drops away by itself when the turn or the weapon is gone.
  const [aimed, setAimed] = useState<Weapon | null>(null);
  const aim = aimed && me && myTurn && canUse(game, me, aimed) ? aimed : null;
  useEffect(() => {
    if (!aim) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAimed(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aim]);

  const steps = useMemo(() => (myTurn && me && !aim && connected ? legalSteps(game, me) : []), [game, me, myTurn, aim, connected]);
  const targets = aim && me ? targetsFor(game, me, aim).map((p) => p.id) : [];

  // Zoom: phones start close-up, because the hexagon tiles are tiny on a small screen.
  const [zoomed, setZoomed] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches);
  const focus = (thrower ?? (myTurn ? me : turnPlayer))?.pos ?? me?.pos ?? 0;
  const view = useMemo(() => (zoomed ? closeUp(focus) : FULL_VIEW), [zoomed, focus]);

  // Only animate events that happen after we arrived.
  const [seenN] = useState(live.n);
  const last = shown.log[shown.log.length - 1];
  const fx = last && last.n > seenN ? last : null;

  const attack = (id: string) => {
    if (aim) addAction({ t: "use", item: aim, target: id });
    setAimed(null);
  };

  let headline: string;
  if (live.phase === "finished") headline = "The hunt is over";
  else if (!me) headline = "Watching";
  else if (thrower) headline = iThrow ? `Knocked out! Hurl your key up to ${THROW_RANGE} tiles away` : `${thrower.name} is hurling their key…`;
  else if (turnPlayer && !turnPlayer.online) headline = "Waiting for them to reconnect…";
  else if (!myTurn) headline = live.stage === "roll" ? "About to roll" : "Moving";
  else if (live.stage === "roll") headline = pending ? "Rolling…" : "Roll the die";
  else if (aim) headline = targets.length ? `Pick a target for your ${aim}` : `Nobody in range of your ${aim}`;
  else if (game.phase === "finished") headline = "You reached the chest. Confirm to finish";
  else headline = steps.length ? "Plan your moves, then confirm" : "No tiles in reach. Use an item or confirm.";

  const finished = live.phase === "finished" && !anim;
  const winner = live.players.find((p) => p.id === live.winner);
  const isHost = hostId === meId;
  const showMp = playing && live.stage === "move";

  return (
    <Tooltip.Provider delayDuration={250}>
      <div className={styles.table}>
        <header className={styles.top}>
          <h1 className={styles.brand}>Dead Reckoning</h1>
          <span className={styles.code}>Hunt <b>{game.code}</b></span>
          <Rules />
          <button className="btn ghost" onClick={onLeave}>Leave</button>
        </header>

        <div className={styles.layout}>
          <div className={styles.boardCol}>
            <div className={styles.banner}>
              {(thrower ?? turnPlayer) && <Token seat={(thrower ?? turnPlayer)!.color} name={(thrower ?? turnPlayer)!.name} size={34} />}
              <p className={styles.headline} aria-live="polite">
                <b>{(thrower ?? turnPlayer)?.name}{myTurn || iThrow ? " (you)" : ""}</b>
                <span className={myTurn || iThrow ? styles.mine : ""}>{headline}</span>
              </p>
              {showMp && (
                <div className={styles.mp} aria-label={`${fmt(game.mp)} movement points left`}>
                  <b>{fmt(game.mp)}</b><span>moves left</span>
                </div>
              )}
            </div>

            <div className={styles.frame}>
              <Board game={shown} meId={meId} view={view} steps={steps} range={iThrow ? THROW_RANGE : aim ? RANGE[aim] : null} ghost={trail} targets={targets} throwTo={throwTiles} fx={fx} onStep={(to) => addAction({ t: "step", to })} onTarget={attack} onThrow={onThrow} />
              {stageOpen && (
                <div className={`${styles.stage} ${canRoll || pending ? styles.stageLive : ""}`}>
                  <Dice value={live.dice} rolls={live.rolls} canRoll={canRoll} pending={pending} size={canRoll || pending ? 104 : 96} onRoll={doRoll} />
                  <p className={styles.stageText} key={`${pending}-${settling}`}>
                    {pending ? "Rolling…" : canRoll ? <>Your turn.<small>Tap the die to roll</small></> : <><b>{live.dice}</b><small>{turnPlayer?.name} rolled {live.dice} move{live.dice === 1 ? "" : "s"}</small></>}
                  </p>
                </div>
              )}
              <button className={`btn ghost ${styles.zoom}`} aria-pressed={zoomed} aria-label={zoomed ? "Show whole chart" : "Zoom in"} title={zoomed ? "Show whole chart" : "Zoom in"} onClick={() => setZoomed((z) => !z)}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" /><path d={zoomed ? "M7.5 10.5h6" : "M7.5 10.5h6M10.5 7.5v6"} />
                </svg>
              </button>
            </div>
          </div>

          <aside className={styles.side}>
            <section className={styles.roller} aria-label="Dice">
              <Dice value={live.dice} rolls={live.rolls} canRoll={canRoll} pending={pending} size={52} onRoll={doRoll} />
              <div className={styles.rollerText}>
                <p>{live.dice ? `${turnPlayer?.name} rolled ${live.dice}` : "No roll yet"}</p>
                {myTurn && live.stage === "move" && (
                  <>
                  <p className={styles.used} aria-live="polite"><b>{fmt((live.dice ?? 0) - game.mp)}</b> of {live.dice} moves used</p>
                  <div className={styles.confirm}>
                    <button className="btn teal" onClick={() => { setAimed(null); setPlan({ key: "", list: [] }); onConfirm(actions); }}>
                      Confirm{actions.length ? ` (${actions.length})` : ""}
                    </button>
                    <button className={`btn ghost ${styles.iconBtn}`} title="Undo last move" aria-label="Undo last move" disabled={!actions.length} onClick={() => { setAimed(null); setPlan({ key: planKey, list: actions.slice(0, -1) }); }}>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
                    </button>
                    <button className={`btn ghost ${styles.iconBtn}`} title="Reset all moves" aria-label="Reset all moves" disabled={!actions.length} onClick={() => { setAimed(null); setPlan({ key: planKey, list: [] }); }}>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
                    </button>
                  </div>
                  </>
                )}
              </div>
            </section>

            {liveMyTurn && actions.length > 0 && (
              <section aria-label="Your moves">
                <h2 className={styles.h}>Your moves</h2>
                <ol className={styles.moves}>
                  {actions.length > 3 && <li className={styles.more}>+{actions.length - 3} earlier</li>}
                  {actions.map((a, i) => i >= actions.length - 3 && (
                    <li key={i} value={i + 1}>{describe(live, meId, actions, i)}</li>
                  ))}
                </ol>
              </section>
            )}

            {me && playing && <Inventory game={game} me={me} myTurn={myTurn} aim={aim} onAim={setAimed} onUse={(item) => addAction({ t: "use", item })} />}

            <section aria-label="Pirates">
              <h2 className={styles.h}>Pirates</h2>
              <ul className={styles.crew}>
                {game.players.map((p) => (
                  <Crewmate key={p.id} p={p} turn={playing && p.id === game.turn} you={p.id === meId} />
                ))}
              </ul>
            </section>
          </aside>
        </div>

        <Dialog.Root open={finished}>
          <Dialog.Portal>
            <Dialog.Overlay className={styles.overlay} />
            <Dialog.Content className={styles.modal} onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
              {winner ? (
                <>
                  <Token seat={winner.color} name={winner.name} size={64} />
                  <Dialog.Title>{winner.id === meId ? "You opened the chest" : `${winner.name} opened the chest`}</Dialog.Title>
                  <Dialog.Description>
                    {game.players.filter(isActive).length < 2 ? "Everyone else left." : "Key in hand, first to the treasure."}
                  </Dialog.Description>
                </>
              ) : (
                <>
                  <Dialog.Title>Everyone left</Dialog.Title>
                  <Dialog.Description>The treasure stays buried.</Dialog.Description>
                </>
              )}
              {isHost ? (
                <button className="btn" onClick={onAgain}>Play again</button>
              ) : (
                <p className={styles.wait}>Waiting for {byId(hostId)?.name ?? "the host"} to start another round…</p>
              )}
              <button className="btn ghost" onClick={onLeave}>Leave hunt</button>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </Tooltip.Provider>
  );
}

/** One line per planned action, e.g. "Moved to C4 · 2 left". */
function describe(live: GameState, pid: string, actions: Action[], i: number): string {
  const after = applyActions(live, pid, actions.slice(0, i + 1));
  const a = actions[i];
  const left = `${fmt(after.mp)} left`;
  if (a.t === "step") return `Moved to ${tileName(a.to)} · ${left}`;
  if (a.item === "eyepatch") return `Put on the eyepatch · ${left}`;
  const who = live.players.find((p) => p.id === a.target)?.name ?? "a pirate";
  return `Used ${a.item} on ${who} · ${left}`;
}

function Crewmate({ p, turn, you }: { p: Player; turn: boolean; you: boolean }) {
  const gear = POWERUPS.filter((k) => p.inv[k] > 0);
  return (
    <li className={`${styles.mate} ${turn ? styles.current : ""} ${p.left || !p.online ? styles.away : ""}`}>
      <Token seat={p.color} name={p.name} size={26} />
      <span className={styles.mname}>
        {p.name}
        {you && <small> you</small>}
        {p.left ? <small> left</small> : !p.online ? <small> offline</small> : p.hp <= 0 ? <small> knocked out</small> : null}
      </span>
      <span className={styles.badges}>
        <span className={`${styles.badge} ${p.hp <= LOW_HP ? styles.hurt : ""}`} title={`Health ${p.hp} of ${MAX_HP}`}>♥ {p.hp}</span>
        {p.keys > 0 && <span className={styles.badge} title={`${p.keys} key${p.keys > 1 ? "s" : ""}`}><ItemIcon kind="key" size={14} />{p.keys}</span>}
        {p.ship && <span className={styles.badge} title="Has a ship"><ItemIcon kind="ship" size={14} /></span>}
        {gear.map((k) => (
          <span key={k} className={styles.badge} title={`${ITEM_INFO[k].label}: ${p.inv[k]}`}><ItemIcon kind={k} size={14} />{p.inv[k]}</span>
        ))}
      </span>
    </li>
  );
}

type InvProps = {
  game: GameState;
  me: Player;
  myTurn: boolean;
  aim: Weapon | null;
  onAim: (w: Weapon | null) => void;
  onUse: (item: Powerup) => void;
};

function Inventory({ game, me, myTurn, aim, onAim, onUse }: InvProps) {
  const reason = (item: Powerup): string | null => {
    if (me.inv[item] <= 0) return "You don't have one yet. Find it on the chart.";
    if (!myTurn) return "Wait for your turn.";
    if (game.stage === "roll") return "Roll the die first.";
    if (item === "eyepatch" && me.eyepatchOn) return "Already wearing it.";
    if (game.mp < USE_COST) return `Needs ${USE_COST} move point.`;
    if (isWeapon(item) && targetsFor(game, me, item).length === 0) return `No pirate within ${RANGE[item]} tile${RANGE[item] > 1 ? "s" : ""}.`;
    return null;
  };

  return (
    <section aria-label="Your gear">
      <div className={styles.invHead}>
        <h2 className={styles.h}>Gear</h2>
        <span className={styles.status}>
          <span className={`${styles.on} ${me.hp <= LOW_HP ? styles.hurt : ""}`} title={me.hp <= LOW_HP ? "Wounded: every step costs double" : "Healthy"}>♥ {me.hp}/{MAX_HP}</span>
          <span className={me.keys ? styles.on : ""}><ItemIcon kind="key" size={16} /> {me.keys ? `${me.keys} key${me.keys > 1 ? "s" : ""}` : "No key"}</span>
          <span className={me.ship ? styles.on : ""}><ItemIcon kind="ship" size={16} /> {me.ship ? "Ship" : "No ship"}</span>
        </span>
      </div>
      <ul className={styles.slots}>
        {POWERUPS.map((item) => {
          const why = reason(item);
          const have = me.inv[item];
          const selected = aim === item;
          const worn = item === "eyepatch" && me.eyepatchOn;
          const click = () => {
            if (why && !selected) return;
            if (item === "eyepatch") onUse(item);
            else onAim(selected ? null : (item as Weapon));
          };
          return (
            <li key={item}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    type="button"
                    className={`${styles.slot} ${have ? styles.has : ""} ${selected ? styles.selected : ""} ${worn ? styles.worn : ""}`}
                    aria-pressed={isWeapon(item) ? selected : worn}
                    aria-disabled={!!why && !selected}
                    onClick={click}
                  >
                    <ItemIcon kind={item} size={26} />
                    <span className={styles.slotName}>{ITEM_INFO[item].label}</span>
                    <span className={styles.charges}>
                      {worn ? `on · ${have}` : have ? `${have} ${item === "eyepatch" ? "steps" : have > 1 ? "shots" : "shot"}` : "none"}
                    </span>
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className={styles.tip} sideOffset={6}>
                    <b>{ITEM_INFO[item].label}</b>
                    <span>{ITEM_INFO[item].blurb}</span>
                    <small>Costs {USE_COST} move point to use. Comes with {CHARGES[item]} {item === "eyepatch" ? "discounted steps" : "shots"}.{isWeapon(item) && ` Deals ${DAMAGE[item]} damage.`}</small>
                    {why && <em>{why}</em>}
                    <Tooltip.Arrow className={styles.arrow} />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </li>
          );
        })}
      </ul>
      {aim && <p className={styles.aimHint}>Aiming the {aim}. Select a highlighted pirate on the chart, or <button className={styles.link} onClick={() => onAim(null)}>cancel</button>.</p>}
    </section>
  );
}
