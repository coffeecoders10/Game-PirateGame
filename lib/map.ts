// The world: a fixed chart of islands on a hexagon grid (pointy-top hexes, odd rows shoved half a
// tile to the right). Only the treasure, keys and powerups are randomised (see rules.ts).
// Tile index = row * COLS + col.
//   #  land     .  water     H  harbour (land)     1-5  player spawn (land)
//
// The layout was generated once from a seeded blob generator and pasted in, so every
// client sees exactly the same map. Edit the rows below to reshape the world.

export const COLS = 17;
export const ROWS = 20;
export const TILE_COUNT = COLS * ROWS;

const LAYOUT = [
  "..1###......###H.",
  ".H####.....#####3",
  ".#####.....#####.",
  ".####......#####.",
  "...#..#.....##...",
  "......###H.......",
  "......####.......",
  "..#...####.......",
  "H###..#.##.......",
  "###5##..#........",
  "######...#...##H.",
  "######..H##.#####",
  ".##.#....##..####",
  ".##.......#..####",
  "...............#.",
  "..##..#..#.......",
  "..###.########...",
  ".############H4..",
  "..###.##H#..##...",
  "..2#H.##.........",
];

const cells = LAYOUT.join("");

export const LAND: boolean[] = Array.from(cells, (ch) => ch !== ".");
export const HARBOURS: number[] = indicesOf((ch) => ch === "H");
/** Spawn tile for each player seat (index = player colour). */
export const SPAWNS: number[] = [1, 2, 3, 4, 5].map((n) => cells.indexOf(String(n)));

function indicesOf(test: (ch: string) => boolean) {
  return Array.from(cells, (ch, i) => (test(ch) ? i : -1)).filter((i) => i >= 0);
}

export const rowOf = (i: number) => Math.floor(i / COLS);
export const colOf = (i: number) => i % COLS;
export const isLand = (i: number) => LAND[i];
export const isHarbour = (i: number) => HARBOURS.includes(i);

// ── hex geometry (board SVG units) ──────────────────────────────────────────

/** Width of a tile, flat side to flat side. */
export const TILE_W = 10;
/** Corner radius of a tile. */
export const HEX_R = TILE_W / Math.sqrt(3);
/** Vertical distance between rows. */
export const ROW_H = HEX_R * 1.5;
/** Extent of the whole chart. */
export const BOARD_W = COLS * TILE_W + TILE_W / 2;
export const BOARD_H = (ROWS - 1) * ROW_H + HEX_R * 2;

/** Centre of a tile. */
export const tileCenter = (i: number) => ({
  x: colOf(i) * TILE_W + TILE_W / 2 + (rowOf(i) % 2) * (TILE_W / 2),
  y: rowOf(i) * ROW_H + HEX_R,
});

/** The six corners of a tile, starting bottom-right and going clockwise on screen. */
export function hexCorners(i: number, radius = HEX_R): [number, number][] {
  const { x, y } = tileCenter(i);
  return Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 180) * (30 + 60 * k);
    return [x + radius * Math.cos(a), y + radius * Math.sin(a)];
  });
}

/** SVG path of one tile; `inset` pulls the outline in from the tile edge. */
export function hexPath(i: number, inset = 0): string {
  return "M" + hexCorners(i, HEX_R - inset / Math.cos(Math.PI / 6)).map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L") + "Z";
}

// ── adjacency ───────────────────────────────────────────────────────────────

/**
 * Neighbour across side `k` of a tile, or -1 off the chart. Side k sits between corners k and
 * k+1 (see hexCorners): 0 south-east, 1 south-west, 2 west, 3 north-west, 4 north-east, 5 east.
 */
export function sideNeighbour(i: number, k: number): number {
  const r = rowOf(i);
  const c = colOf(i);
  const shift = r % 2; // odd rows sit half a tile to the right
  const [dr, dc] = [[1, shift], [1, shift - 1], [0, -1], [-1, shift - 1], [-1, shift], [0, 1]][k];
  const nr = r + dr;
  const nc = c + dc;
  return nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS ? nr * COLS + nc : -1;
}

/** The up-to-6 tiles around `i`. */
export function neighbours(i: number): number[] {
  return [0, 1, 2, 3, 4, 5].map((k) => sideNeighbour(i, k)).filter((n) => n >= 0);
}

/** Hex distance: the fewest steps between two tiles, matching movement and weapon radius. */
export function dist(a: number, b: number): number {
  const cube = (i: number) => {
    const x = colOf(i) - (rowOf(i) - (rowOf(i) % 2)) / 2;
    const z = rowOf(i);
    return [x, -x - z, z];
  };
  const [ax, ay, az] = cube(a);
  const [bx, by, bz] = cube(b);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

/** Chart reference like "C7" (column letter, row number). */
export const tileName = (i: number) => `${String.fromCharCode(65 + colOf(i))}${rowOf(i) + 1}`;

/** Land tiles of the islands drawn green (islands = connected land; every other one, from the second). */
export const GREEN_TILES: number[] = (() => {
  const seen = new Set<number>();
  const green: number[] = [];
  let island = 0;
  for (let start = 0; start < TILE_COUNT; start++) {
    if (!LAND[start] || seen.has(start)) continue;
    const stack = [start];
    seen.add(start);
    const tiles: number[] = [];
    while (stack.length) {
      const t = stack.pop()!;
      tiles.push(t);
      for (const n of neighbours(t)) {
        if (!LAND[n] || seen.has(n)) continue;
        seen.add(n);
        stack.push(n);
      }
    }
    if (island++ % 2 === 1) green.push(...tiles);
  }
  return green;
})();
