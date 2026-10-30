import { memo, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { COAST_PATH } from "@/lib/coast";
import { BOARD_H, BOARD_W, COLS, GREEN_TILES, HARBOURS, LAND, ROWS, TILE_COUNT, TILE_W, dist, hexPath, tileCenter, tileName } from "@/lib/map";
import { MAX_HP, LOW_HP, isActive, SEATS, type GameState, type LogEntry } from "@/lib/rules";
import { Glyph, ItemDefs } from "./ItemIcon";
import { TokenShape, initial } from "./Token";
import styles from "./Board.module.css";

export type View = { x: number; y: number; size: number };
/** Whole chart including the coordinate margin. */
export const FULL_VIEW: View = { x: -7, y: -7, size: Math.max(BOARD_W, BOARD_H) + 14 };

type Props = {
  game: GameState;
  meId: string;
  view: View;
  steps: { to: number; cost: number }[]; // tiles the player can step to now
  range: number | null; // weapon radius being aimed (tints tiles)
  ghost: number[] | null; // tiles your planned moves pass through; drawn as a see-through pirate
  targets: string[]; // pirates that can be hit with the selected weapon
  throwTo: number[]; // tiles a knocked-out pirate can hurl their key to
  fx: LogEntry | null; // newest event worth animating
  onStep: (to: number) => void;
  onTarget: (id: string) => void;
  onThrow: (to: number) => void;
};

const SIZE = Math.max(BOARD_W, BOARD_H);
const TILES = Array.from({ length: TILE_COUNT }, (_, i) => i);
const ALL_HEXES = TILES.map((i) => hexPath(i)).join("");
const costLabel = (c: number) => (c === 0.5 ? "½" : String(c));
const LETTERS = Array.from({ length: COLS }, (_, i) => String.fromCharCode(65 + i));
const ROW_NUMBERS = Array.from({ length: ROWS }, (_, r) => r);

/** Pirates sharing a tile stand in different corners of it. */
const SLOTS = [{ x: -2.7, y: -2.2 }, { x: 2.7, y: -2.2 }, { x: -2.7, y: 2.8 }, { x: 2.7, y: 2.8 }, { x: 0, y: 0.3 }];

const press = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

/** Eases the viewBox toward its target so zooming and following a pirate glide. */
function useGlide(target: View): View {
  const [view, setView] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    const from = cur.current;
    if (from.x === target.x && from.y === target.y && from.size === target.size) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - start) / 420);
      const e = 1 - Math.pow(1 - t, 4);
      cur.current = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        size: from.size + (target.size - from.size) * e,
      };
      setView(cur.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target.x, target.y, target.size]);
  return view;
}

/** Sea, soundings and islands. Static, so it renders once. */
export const Chart = memo(function Chart({ labels = true }: { labels?: boolean }) {
  return (
    <>
      <defs>
        <radialGradient id="ch-water" gradientUnits="userSpaceOnUse" cx={SIZE * 0.5} cy={SIZE * 0.45} r={SIZE * 0.75}>
          <stop offset="0" stopColor="#1b3a4a" />
          <stop offset="0.55" stopColor="#12293a" />
          <stop offset="1" stopColor="#0a1620" />
        </radialGradient>
        <linearGradient id="ch-land" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={SIZE} y2={SIZE}>
          <stop offset="0" stopColor="#ddd5bd" />
          <stop offset="0.5" stopColor="#cdc5ac" />
          <stop offset="1" stopColor="#b7ae93" />
        </linearGradient>
        <linearGradient id="ch-grass" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={SIZE} y2={SIZE}>
          <stop offset="0" stopColor="#a3c27e" />
          <stop offset="0.55" stopColor="#82a863" />
          <stop offset="1" stopColor="#5f8749" />
        </linearGradient>
      </defs>
      <rect x={-50} y={-50} width={SIZE + 100} height={SIZE + 100} fill="url(#ch-water)" />
      <g fill="none" strokeLinejoin="round">
        <path d={COAST_PATH} stroke="#5f9fb6" strokeOpacity={0.12} strokeWidth={9} />
        <path d={COAST_PATH} stroke="#9fd2de" strokeOpacity={0.2} strokeWidth={2} />
      </g>
      <path d={COAST_PATH} transform="translate(0.5 1)" fill="#04090d" fillOpacity={0.5} fillRule="evenodd" />
      <clipPath id="land"><path d={COAST_PATH} fillRule="evenodd" /></clipPath>
      <path d={COAST_PATH} fill="url(#ch-land)" fillRule="evenodd" stroke="var(--shore)" strokeWidth={0.5} strokeLinejoin="round" />
      <g clipPath="url(#land)">
        <g fill="url(#ch-grass)">
          {GREEN_TILES.map((i) => <path key={i} d={hexPath(i, -0.05)} />)}
        </g>
        <path d={COAST_PATH} fill="none" stroke="#f2ead2" strokeOpacity={0.45} strokeWidth={2} strokeLinejoin="round" />
        <path d={COAST_PATH} fill="none" stroke="#5c5440" strokeOpacity={0.35} strokeWidth={0.5} strokeLinejoin="round" />
      </g>
      <g strokeWidth={0.25} fill="none" strokeLinejoin="round">
        <path stroke="#fff" strokeOpacity={0.05} d={ALL_HEXES} />
        <path stroke="#000" strokeOpacity={0.09} clipPath="url(#land)" d={ALL_HEXES} />
      </g>
      {labels && (
        <g className={styles.axis} textAnchor="middle" dominantBaseline="central">
          {LETTERS.map((l, c) => (
            <g key={l}>
              <text x={c * TILE_W + TILE_W / 2} y={-3.5}>{l}</text>
              <text x={c * TILE_W + TILE_W / 2} y={BOARD_H + 3.5}>{l}</text>
            </g>
          ))}
          {ROW_NUMBERS.map((r) => (
            <g key={r}>
              <text x={-3.5} y={tileCenter(r * COLS).y}>{r + 1}</text>
              <text x={BOARD_W + 3.5} y={tileCenter(r * COLS).y}>{r + 1}</text>
            </g>
          ))}
        </g>
      )}
    </>
  );
});

/** Gear sits straight on its tile: no frame, no shadow. */
function Harbour({ i }: { i: number }) {
  const { x, y } = tileCenter(i);
  return (
    <g transform={`translate(${x} ${y})`}>
      <g transform="translate(-3.6 -3.8) scale(0.3)"><Glyph name="anchor" /></g>
    </g>
  );
}

function Chest({ i }: { i: number }) {
  const { x, y } = tileCenter(i);
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle className={styles.beacon} r={4.6} fill="none" stroke="var(--accent)" strokeWidth={0.4} />
      <g transform="translate(-4.3 -4.5) scale(0.36)"><Glyph name="chest" /></g>
    </g>
  );
}

function Marker({ kind, count }: { kind: GameState["items"][number]["kind"]; count: number }) {
  return (
    <g>
      <g transform="translate(-3.9 -4) scale(0.325)"><Glyph name={kind} /></g>
      {count > 1 && (
        <g transform="translate(3.4 -3.4)">
          <circle r={1.7} fill="#1d1a16" stroke="#efe6cf" strokeWidth={0.25} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={2.3} fontWeight={700} fill="#efe6cf">{count}</text>
        </g>
      )}
    </g>
  );
}

/** Short-lived effect at the spot where something just happened. */
function Effect({ fx }: { fx: LogEntry }) {
  if (fx.at === undefined) return null;
  const at = tileCenter(fx.at);
  if (fx.kind !== "attack") {
    const tone = fx.kind === "locked" ? "#e5534b" : "var(--accent)";
    return (
      <g transform={`translate(${at.x} ${at.y})`} pointerEvents="none">
        <circle className={styles.pop} r={3} fill="none" stroke={tone} strokeWidth={0.6} />
        <circle className={styles.pop} r={3} fill="none" stroke={tone} strokeWidth={0.4} style={{ animationDelay: "0.15s" }} />
      </g>
    );
  }
  const from = tileCenter(fx.from ?? fx.at);
  const style = { "--dx": `${from.x - at.x}px`, "--dy": `${from.y - at.y}px` } as CSSProperties;
  return (
    <g transform={`translate(${at.x} ${at.y})`} pointerEvents="none">
      {fx.weapon === "sword" ? (
        <path className={styles.slash} d="M-4 -4 Q3 -3 4 4" fill="none" stroke="#fff" strokeWidth={0.9} strokeLinecap="round" />
      ) : (
        <circle className={styles.shot} r={fx.weapon === "cannon" ? 1.2 : 0.7} fill="#fff" style={style} />
      )}
      <g className={styles.impact} stroke="#fff" strokeWidth={0.8} strokeLinecap="round">
        <path d="M-3 -3 L3 3 M3 -3 L-3 3" />
        <circle r={4.5} fill="none" strokeWidth={0.5} />
      </g>
    </g>
  );
}

export const Board = memo(function Board({ game, meId, view, steps, range, ghost, targets, throwTo, fx, onStep, onTarget, onThrow }: Props) {
  const box = useGlide(view);
  const me = game.players.find((p) => p.id === meId);
  const seated = game.players.filter(isActive);
  const tint = { "--tint": me ? SEATS[me.color].hex : "var(--accent)" } as CSSProperties;
  const aiming = range !== null && me;
  const aimFrom = ghost ? ghost[ghost.length - 1] : me?.pos ?? 0;

  // Group pirates by tile so each one gets its own corner, and items so stacks show a count.
  const crowd = new Map<number, number>();
  for (const p of seated) crowd.set(p.pos, (crowd.get(p.pos) ?? 0) + 1);
  const stacks = new Map<string, { pos: number; kind: GameState["items"][number]["kind"]; count: number }>();
  for (const it of game.items) {
    const k = `${it.pos}-${it.kind}`;
    stacks.set(k, { pos: it.pos, kind: it.kind, count: (stacks.get(k)?.count ?? 0) + 1 });
  }

  // Gear that is being carried returns to the tile it came from once used up: show a faint shadow there.
  const shadows = new Map<string, { pos: number; kind: GameState["items"][number]["kind"] }>();
  for (const p of seated) for (const l of p.loans) shadows.set(`${l.home}-${l.kind}`, { pos: l.home, kind: l.kind });

  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.size} ${box.size}`}
      className={styles.svg}
      role="group"
      aria-label={`Chart of ${COLS} by ${ROWS} hexagon tiles`}
    >
      <ItemDefs />
      <Chart />

      {aiming &&
        TILES.filter((i) => dist(i, aimFrom) <= range && i !== aimFrom).map((i) => (
          <path key={i} d={hexPath(i)} fill="var(--accent)" opacity={0.12} pointerEvents="none" />
        ))}

      {HARBOURS.map((i) => <Harbour key={i} i={i} />)}
      {seated.map((p) => (
        <path key={p.id} d={hexPath(p.spawn, 0.6)} strokeLinejoin="round" fill={SEATS[p.color].hex} fillOpacity={0.3} stroke={SEATS[p.color].hex} strokeWidth={0.5} strokeDasharray="1.4 1" />
      ))}
      {game.chest >= 0 && <Chest i={game.chest} />}

      {[...shadows.values()].map((s) => {
        const { x, y } = tileCenter(s.pos);
        return (
          <g key={`shadow-${s.pos}-${s.kind}`} transform={`translate(${x} ${y})`} opacity={0.3} pointerEvents="none">
            <title>{`${s.kind} returns here once used up`}</title>
            <Marker kind={s.kind} count={1} />
          </g>
        );
      })}

      {[...stacks.values()].map((s) => {
        const { x, y } = tileCenter(s.pos);
        return (
          <g key={`${s.pos}-${s.kind}`} transform={`translate(${x} ${y})`}>
            <g className={styles.rise}><Marker kind={s.kind} count={s.count} /></g>
          </g>
        );
      })}

      {steps.map(({ to, cost }) => {
        const { x, y } = tileCenter(to);
        const go = () => onStep(to);
        return (
          <g key={to} className={styles.hint} style={tint} role="button" tabIndex={0} aria-label={`Move to ${tileName(to)}, costs ${costLabel(cost)}`} onClick={go} onKeyDown={press(go)}>
            <path d={hexPath(to, 0.6)} className={styles.hintFill} />
            <path d={hexPath(to, 0.6)} className={styles.hintRing} />
            <circle className={styles.hintDot} cx={x} cy={y} r={1.3} />
          </g>
        );
      })}

      {throwTo.map((to) => {
        const { x, y } = tileCenter(to);
        const go = () => onThrow(to);
        return (
          <g key={`throw-${to}`} className={styles.hint} style={tint} role="button" tabIndex={0} aria-label={`Throw the key to ${tileName(to)}`} onClick={go} onKeyDown={press(go)}>
            <path d={hexPath(to, 0.6)} className={styles.hintFill} />
            <path d={hexPath(to, 0.6)} className={styles.hintRing} />
            <circle className={styles.hintDot} cx={x} cy={y} r={1.3} />
          </g>
        );
      })}

      {seated.map((p) => {
        const c = tileCenter(p.pos);
        const shared = (crowd.get(p.pos) ?? 0) > 1;
        const slot = shared ? SLOTS[p.color] : { x: 0, y: 0 };
        const afloat = !LAND[p.pos];
        const hot = targets.includes(p.id);
        const active = game.phase === "playing" && game.turn === p.id;
        const scale = shared ? 0.6 : 0.82;
        return (
          <g
            key={p.id}
            className={`${styles.pawn} ${!p.online || p.hp <= 0 ? styles.away : ""}`}
            style={{ transform: `translate(${c.x + slot.x}px, ${c.y + slot.y}px)` }}
            onClick={hot ? () => onTarget(p.id) : undefined}
            onKeyDown={hot ? press(() => onTarget(p.id)) : undefined}
            role={hot ? "button" : undefined}
            tabIndex={hot ? 0 : undefined}
            aria-label={hot ? `Attack ${p.name}` : undefined}
          >
            <title>{p.name}</title>
            {hot && <circle className={styles.target} r={6.2} fill="var(--accent)" fillOpacity={0.18} stroke="var(--accent)" strokeWidth={0.7} />}
            {active && <circle className={styles.turnRing} r={5.4 * scale + 1} fill="none" stroke="var(--accent)" strokeWidth={0.6} />}
            {afloat && p.ship && (
              <path d="M-5 1.6 H5 L3.1 4.4 H-3.1 Z" fill="url(#gi-wood)" stroke="#2e1c0d" strokeWidth={0.4} strokeLinejoin="round" />
            )}
            {afloat && !p.ship && <path className={styles.swim} d="M-4 3.4 q1 -1 2 0 t2 0 t2 0 t2 0" fill="none" stroke="#fff" strokeWidth={0.5} strokeLinecap="round" />}
            <g transform={`translate(0 ${afloat && p.ship ? -1 : 0}) scale(${scale})`}>
              <TokenShape seat={p.color} letter={initial(p.name)} />
            </g>
            <g aria-hidden="true">
              <rect x={-4} y={6} width={8} height={1.1} rx={0.55} fill="#000" fillOpacity={0.55} />
              <rect x={-4} y={6} width={(8 * p.hp) / MAX_HP} height={1.1} rx={0.55} fill={p.hp <= LOW_HP ? "#e5534b" : "#7fc77f"} />
            </g>
            {!afloat && p.ship && <path d="M3 4.4 H6.6 L5.8 5.8 H3.8 Z" fill="url(#gi-wood)" stroke="#2e1c0d" strokeWidth={0.3} />}
            {p.keys > 0 && (
              <g transform="translate(3.6 -3.6)">
                <circle r={2} fill="url(#gi-disc)" stroke="#d6b25e" strokeWidth={0.35} />
                <g transform="translate(-1.5 -1.5) scale(0.125)"><Glyph name="key" /></g>
              </g>
            )}
          </g>
        );
      })}

      {me && ghost && ghost.length > 1 && (
        <g pointerEvents="none">
          <path
            d={"M" + ghost.map((t) => { const c = tileCenter(t); return `${c.x.toFixed(2)} ${c.y.toFixed(2)}`; }).join("L")}
            fill="none" stroke={SEATS[me.color].hex} strokeOpacity={0.7} strokeWidth={0.7} strokeDasharray="1.4 1.2" strokeLinecap="round" strokeLinejoin="round"
          />
          <g className={styles.pawn} style={{ transform: `translate(${tileCenter(ghost[ghost.length - 1]).x}px, ${tileCenter(ghost[ghost.length - 1]).y}px)` }} opacity={0.5}>
            <g transform="scale(0.82)"><TokenShape seat={me.color} letter={initial(me.name)} /></g>
          </g>
        </g>
      )}

      {fx && <Effect key={fx.n} fx={fx} />}
    </svg>
  );
});
