// Coastline geometry for the chart. The gameplay grid is exact; only the drawn shoreline is
// organic: we trace the boundary of the land hexes, nudge it deterministically, then smooth it.
// Integer-only hashing keeps the result identical on every client.

import { LAND, TILE_COUNT, hexCorners, sideNeighbour } from "./map";

type P = [number, number];

const hash = (x: number, y: number, salt: number) => {
  let h = Math.imul(Math.round(x * 10) * 374761393 + Math.round(y * 10) * 668265263 + salt * 1013904223, 1274126177);
  h ^= h >>> 13;
  h = Math.imul(h, 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const key = ([x, y]: P) => `${x.toFixed(2)},${y.toFixed(2)}`;

/** Closed loops of tile-corner points, land on the same side of travel throughout. */
function traceLoops(): P[][] {
  const out = new Map<string, P[]>();
  for (let i = 0; i < TILE_COUNT; i++) {
    if (!LAND[i]) continue;
    const corners = hexCorners(i);
    for (let k = 0; k < 6; k++) {
      const n = sideNeighbour(i, k);
      if (n >= 0 && LAND[n]) continue;
      const a = corners[k];
      if (!out.has(key(a))) out.set(key(a), []);
      out.get(key(a))!.push(corners[(k + 1) % 6]);
    }
  }
  const loops: P[][] = [];
  for (const [k0, ends] of out) {
    while (ends.length) {
      const start = k0.split(",").map(Number) as P;
      const pts: P[] = [start];
      let cur = ends.pop()!;
      while (key(cur) !== k0) {
        pts.push(cur);
        cur = out.get(key(cur))!.pop()!;
      }
      loops.push(pts);
    }
  }
  return loops;
}

function smooth(loop: P[]): P[] {
  const n = loop.length;
  // 1. wobble the corners, and bow each edge's midpoint a little toward or away from the water
  const wobbled: P[] = [];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = loop[i];
    const [bx, by] = loop[(i + 1) % n];
    const a: P = [ax + (hash(ax, ay, 1) - 0.5) * 2.5, ay + (hash(ax, ay, 2) - 0.5) * 2.5];
    const dx = bx - ax;
    const dy = by - ay;
    const bow = (hash(ax + bx, ay + by, 3) - 0.5) * 0.5;
    wobbled.push(a, [(ax + bx) / 2 + dy * bow, (ay + by) / 2 - dx * bow]);
  }
  // 2. Chaikin corner cutting rounds everything into soft shoreline
  let pts = wobbled;
  for (let k = 0; k < 2; k++) {
    const next: P[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = pts[i];
      const [qx, qy] = pts[(i + 1) % pts.length];
      next.push([0.75 * px + 0.25 * qx, 0.75 * py + 0.25 * qy], [0.25 * px + 0.75 * qx, 0.25 * py + 0.75 * qy]);
    }
    pts = next;
  }
  return pts;
}

/** SVG path of every island's shoreline, in board units. Use fill-rule evenodd. */
export const COAST_PATH = traceLoops()
  .map((l) => "M" + smooth(l).map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") + "Z")
  .join("");
