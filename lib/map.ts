// The world: a fixed 20×20 chart of islands. Only the treasure, keys and powerups
// are randomised (see rules.ts). Tile index = row * GRID + col.
//   #  land     .  water     H  harbour (land)     1-5  player spawn (land)
//
// The layout was generated once from a seeded blob generator and pasted in, so every
// client sees exactly the same map. Edit the rows below to reshape the world.

export const GRID = 20;
export const TILE_COUNT = GRID * GRID;

const LAYOUT = [
  "..1###.........###H.",
  ".H####........#####3",
  ".#####........#####.",
  ".####.........#####.",
  "...#...##......##...",
  "........###H........",
  "........####........",
  "..#.....####........",
  "H###....#.##........",
  "###5##....#.........",
  "######.....#....##H.",
  "######....H###.#####",
  ".##.#......###..####",
  ".##.........#...####",
  "..................#.",
  "..##....#..#........",
  "..###...#####.###...",
  ".#####.######.##H4..",
  "..###...##H#...##...",
  "..2#H...##..........",
];

const cells = LAYOUT.join("");

export const LAND: boolean[] = Array.from(cells, (ch) => ch !== ".");
export const HARBOURS: number[] = indicesOf((ch) => ch === "H");
/** Spawn tile for each player seat (index = player colour). */
export const SPAWNS: number[] = [1, 2, 3, 4, 5].map((n) => cells.indexOf(String(n)));

function indicesOf(test: (ch: string) => boolean) {
  return Array.from(cells, (ch, i) => (test(ch) ? i : -1)).filter((i) => i >= 0);
}

export const rowOf = (i: number) => Math.floor(i / GRID);
export const colOf = (i: number) => i % GRID;
export const isLand = (i: number) => LAND[i];
export const isHarbour = (i: number) => HARBOURS.includes(i);

/** Chebyshev distance: diagonal steps count as one, matching movement and weapon radius. */
export const dist = (a: number, b: number) =>
  Math.max(Math.abs(rowOf(a) - rowOf(b)), Math.abs(colOf(a) - colOf(b)));

/** The up-to-8 tiles around `i`, diagonals included. */
export function neighbours(i: number): number[] {
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = rowOf(i) + dr;
      const c = colOf(i) + dc;
      if ((dr || dc) && r >= 0 && r < GRID && c >= 0 && c < GRID) out.push(r * GRID + c);
    }
  }
  return out;
}

/** Centre of a tile in board SVG units (each tile is 10×10). */
export const tileCenter = (i: number) => ({ x: colOf(i) * 10 + 5, y: rowOf(i) * 10 + 5 });

/** Chart reference like "C7" (column letter, row number). */
export const tileName = (i: number) => `${String.fromCharCode(65 + colOf(i))}${rowOf(i) + 1}`;

/** Land tiles of the islands drawn green (islands = 8-connected land; every other one, from the second). */
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
