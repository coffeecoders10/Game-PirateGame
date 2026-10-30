import { memo, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { COAST_PATH } from "@/lib/coast";
import { BOARD_H, BOARD_W, COLS, GREEN_TILES, HARBOURS, LAND, ROWS, SPAWNS, TILE_COUNT, TILE_W, dist, hexPath, tileCenter, tileName } from "@/lib/map";
import { isActive, SEATS, type GameState, type LogEntry } from "@/lib/rules";
import { Glyph } from "./ItemIcon";
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
  targets: string[]; // pirates that can be hit with the selected weapon
  fx: LogEntry | null; // newest event worth animating
  onStep: (to: number) => void;
  onTarget: (id: string) => void;
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
      <rect x={-50} y={-50} width={SIZE + 100} height={SIZE + 100} fill="var(--water)" />
      <g fill="none" strokeLinejoin="round">
        <path d={COAST_PATH} stroke="var(--sound-3)" strokeWidth={30} />
        <path d={COAST_PATH} stroke="var(--sound-2)" strokeWidth={18} />
        <path d={COAST_PATH} stroke="var(--sound-1)" strokeWidth={8} />
      </g>
      <clipPath id="land"><path d={COAST_PATH} fillRule="evenodd" /></clipPath>
      <path d={COAST_PATH} fill="var(--land)" fillRule="evenodd" stroke="var(--shore)" strokeWidth={0.5} strokeLinejoin="round" />
      <g clipPath="url(#land)" fill="var(--grass)">
        {GREEN_TILES.map((i) => <path key={i} d={hexPath(i, -0.05)} />)}
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

function Harbour({ i }: { i: number }) {
  const { x, y } = tileCenter(i);
  return (
    <g transform={`translate(${x} ${y})`} color="var(--land)">
      <circle r={3.6} fill="var(--panel)" stroke="var(--land)" strokeWidth={0.4} />
      <g transform="translate(-2.4 -2.4) scale(0.2)"><Glyph name="anchor" width={1.8} /></g>
    </g>
  );
}

function Chest({ i }: { i: number }) {
  const { x, y } = tileCenter(i);
  return (
    <g transform={`translate(${x} ${y})`} color="var(--accent)">
      <circle className={styles.beacon} r={4.6} fill="none" stroke="var(--accent)" strokeWidth={0.4} />
      <circle r={4.4} fill="var(--panel)" stroke="var(--accent)" strokeWidth={0.7} />
      <g transform="translate(-2.9 -3) scale(0.24)"><Glyph name="chest" width={1.8} /></g>
    </g>
  );
}

function Marker({ kind, count }: { kind: GameState["items"][number]["kind"]; count: number }) {
  const key = kind === "key";
  return (
    <g color={key ? "var(--panel)" : "var(--text)"}>
      <circle r={3.5} fill={key ? "var(--accent)" : "var(--panel)"} stroke={key ? "var(--panel)" : "var(--text)"} strokeWidth={0.4} />
      <g transform="translate(-2.4 -2.4) scale(0.2)"><Glyph name={kind} width={1.9} /></g>
      {count > 1 && (
        <g transform="translate(3 -3)">
          <circle r={1.7} fill="var(--text)" />
          <text textAnchor="middle" dominantBaseline="central" fontSize={2.3} fontWeight={700} fill="var(--panel)">{count}</text>
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

export const Board = memo(function Board({ game, meId, view, steps, range, targets, fx, onStep, onTarget }: Props) {
  const box = useGlide(view);
  const me = game.players.find((p) => p.id === meId);
  const seated = game.players.filter(isActive);
  const aiming = range !== null && me;

  // Group pirates by tile so each one gets its own corner, and items so stacks show a count.
  const crowd = new Map<number, number>();
  for (const p of seated) crowd.set(p.pos, (crowd.get(p.pos) ?? 0) + 1);
  const stacks = new Map<string, { pos: number; kind: GameState["items"][number]["kind"]; count: number }>();
  for (const it of game.items) {
    const k = `${it.pos}-${it.kind}`;
    stacks.set(k, { pos: it.pos, kind: it.kind, count: (stacks.get(k)?.count ?? 0) + 1 });
  }

  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.size} ${box.size}`}
      className={styles.svg}
      role="group"
      aria-label={`Chart of ${COLS} by ${ROWS} hexagon tiles`}
    >
      <Chart />

      {aiming &&
        TILES.filter((i) => dist(i, me.pos) <= range && i !== me.pos).map((i) => (
          <path key={i} d={hexPath(i)} fill="var(--accent)" opacity={0.12} pointerEvents="none" />
        ))}

      {HARBOURS.map((i) => <Harbour key={i} i={i} />)}
      {SPAWNS.map((tile, seat) => {
        if (!seated.some((p) => p.color === seat)) return null;
        return <path key={seat} d={hexPath(tile, 0.6)} strokeLinejoin="round" fill={SEATS[seat].hex} fillOpacity={0.18} stroke={SEATS[seat].hex} strokeWidth={0.5} strokeDasharray="1.4 1" />;
      })}
      {game.chest >= 0 && <Chest i={game.chest} />}

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
          <g key={to} className={styles.hint} role="button" tabIndex={0} aria-label={`Move to ${tileName(to)}, costs ${costLabel(cost)}`} onClick={go} onKeyDown={press(go)}>
            <path d={hexPath(to, 0.6)} className={styles.hintFill} />
            <path d={hexPath(to, 0.6)} className={styles.hintRing} />
            <g transform={`translate(${x + 2.9} ${y - 2.9})`}>
              <circle r={1.9} fill="var(--panel)" stroke="var(--accent)" strokeWidth={0.35} />
              <text y={0.1} textAnchor="middle" dominantBaseline="central" fontSize={2.6} fontWeight={700} fill="var(--accent)">{costLabel(cost)}</text>
            </g>
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
            className={`${styles.pawn} ${!p.online ? styles.away : ""}`}
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
              <path d="M-5 1.6 H5 L3.1 4.4 H-3.1 Z" fill="var(--text)" stroke="var(--panel)" strokeWidth={0.4} strokeLinejoin="round" />
            )}
            {afloat && !p.ship && <path className={styles.swim} d="M-4 3.4 q1 -1 2 0 t2 0 t2 0 t2 0" fill="none" stroke="#fff" strokeWidth={0.5} strokeLinecap="round" />}
            <g transform={`translate(0 ${afloat && p.ship ? -1 : 0}) scale(${scale})`}>
              <TokenShape seat={p.color} letter={initial(p.name)} />
            </g>
            {!afloat && p.ship && <path d="M3 4.4 H6.6 L5.8 5.8 H3.8 Z" fill="var(--text)" stroke="var(--panel)" strokeWidth={0.3} />}
            {p.keys > 0 && (
              <g transform="translate(3.4 -3.6)" color="var(--panel)">
                <circle r={1.9} fill="var(--accent)" stroke="var(--panel)" strokeWidth={0.3} />
                <g transform="translate(-1.2 -1.2) scale(0.1)"><Glyph name="key" width={2.6} /></g>
              </g>
            )}
          </g>
        );
      })}

      {fx && <Effect key={fx.n} fx={fx} />}
    </svg>
  );
});
