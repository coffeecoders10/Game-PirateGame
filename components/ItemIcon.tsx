import type { ItemKind } from "@/lib/rules";

export type GlyphName = ItemKind | "ship" | "anchor" | "chest";

export const ITEM_INFO: Record<ItemKind, { label: string; blurb: string }> = {
  key: { label: "Key", blurb: "Carry one to the chest to open it and win." },
  sword: { label: "Sword", blurb: "Strikes a pirate within 1 tile." },
  pistol: { label: "Pistol", blurb: "Shoots a pirate within 2 tiles." },
  cannon: { label: "Cannon", blurb: "Fires at a pirate within 4 tiles." },
  eyepatch: { label: "Eyepatch", blurb: "Halves every step's cost until the charges run out." },
};

const stops = (...c: string[]) => c.map((col, i) => <stop key={i} offset={i / (c.length - 1)} stopColor={col} />);

/** Shared paints for the item art. Render once per <svg>; identical copies elsewhere are harmless. */
export function ItemDefs() {
  return (
    <defs>
      <linearGradient id="gi-steel" x1="0" x2="1" y1="0" y2="0">{stops("#7d8996", "#eef2f6", "#b3bec9", "#6a7683")}</linearGradient>
      <linearGradient id="gi-steelV" x1="0" x2="0" y1="0" y2="1">{stops("#e4eaf0", "#aab6c2", "#5f6b78")}</linearGradient>
      <linearGradient id="gi-iron" x1="0" x2="0" y1="0" y2="1">{stops("#97a3af", "#515c68", "#262d35")}</linearGradient>
      <linearGradient id="gi-gold" x1="0" x2="1" y1="0" y2="1">{stops("#fbe9a6", "#d9a93a", "#8f6416")}</linearGradient>
      <linearGradient id="gi-wood" x1="0" x2="0" y1="0" y2="1">{stops("#b9854f", "#8a5a2e", "#5a3718")}</linearGradient>
      <linearGradient id="gi-woodH" x1="0" x2="1" y1="0" y2="0">{stops("#6d4322", "#a9794a", "#6d4322")}</linearGradient>
      <linearGradient id="gi-leather" x1="0" x2="1" y1="0" y2="1">{stops("#5b4030", "#2d1f17")}</linearGradient>
      <linearGradient id="gi-sail" x1="0" x2="1" y1="0" y2="0">{stops("#fffaf0", "#e6dcc3", "#c9bc9c")}</linearGradient>
      <radialGradient id="gi-disc" cx="0.4" cy="0.3" r="0.9">{stops("#f6efdb", "#e0d4b3", "#b9a77f")}</radialGradient>
    </defs>
  );
}

const INK = "#1d1a16";
const EDGE = { stroke: INK, strokeOpacity: 0.55, strokeWidth: 0.45, strokeLinejoin: "round" as const };

/** Illustrated items on a 24×24 canvas. */
export function GlyphPaths({ name }: { name: GlyphName }) {
  switch (name) {
    case "sword":
      return (
        <g transform="rotate(45 12 12)">
          <path d="M12 0.8 L14 4 V14.8 H10 V4 Z" fill="url(#gi-steel)" {...EDGE} />
          <path d="M12 3.6 V14.4" stroke="#56626f" strokeWidth={0.5} strokeLinecap="round" />
          <rect x={6.4} y={14.6} width={11.2} height={2.1} rx={1.05} fill="url(#gi-gold)" {...EDGE} />
          <circle cx={6.6} cy={15.65} r={1.1} fill="url(#gi-gold)" {...EDGE} />
          <circle cx={17.4} cy={15.65} r={1.1} fill="url(#gi-gold)" {...EDGE} />
          <rect x={10.8} y={16.7} width={2.4} height={4.6} rx={0.6} fill="url(#gi-leather)" {...EDGE} />
          <path d="M10.8 18.1 H13.2 M10.8 19.5 H13.2" stroke="#a9794a" strokeWidth={0.4} />
          <circle cx={12} cy={22} r={1.5} fill="url(#gi-gold)" {...EDGE} />
        </g>
      );
    case "pistol":
      return (
        <g>
          <path d="M8.5 8.4 H18.2 Q21.4 8.4 21.6 11.4 L21.2 13.4 H17.6 L18.9 20.2 Q19.1 21.6 17.7 21.6 H14.8 Q13.6 21.6 13.4 20.5 L11.8 13.4 H8.5 Z" fill="url(#gi-wood)" {...EDGE} />
          <path d="M15.2 15 L16.2 20.4" stroke="#d0a36f" strokeOpacity={0.5} strokeWidth={0.5} strokeLinecap="round" />
          <rect x={1.6} y={6} width={13.4} height={3.1} rx={1} fill="url(#gi-steelV)" {...EDGE} />
          <rect x={1.6} y={6} width={1.4} height={3.1} rx={0.6} fill="#4c5763" {...EDGE} />
          <rect x={9.2} y={5.6} width={0.9} height={3.9} fill="url(#gi-gold)" />
          <rect x={5.4} y={5.6} width={0.9} height={3.9} fill="url(#gi-gold)" />
          <path d="M11.6 9.1 H15.4 V12.4 H11.6 Z" fill="url(#gi-iron)" {...EDGE} />
          <path d="M14.6 6 Q15.8 3.4 17.6 3.8 L16.3 6.2 Z" fill="url(#gi-iron)" {...EDGE} />
          <path d="M11.9 13.4 Q13.6 16.8 15.6 13.4" fill="none" stroke="url(#gi-gold)" strokeWidth={0.9} strokeLinecap="round" />
        </g>
      );
    case "cannon":
      return (
        <g>
          <path d="M3.4 14.2 H17.6 L16 19.2 H5 Z" fill="url(#gi-wood)" {...EDGE} />
          <circle cx={9} cy={18.4} r={4.1} fill="url(#gi-wood)" {...EDGE} />
          <circle cx={9} cy={18.4} r={2.9} fill="none" stroke="#3d2711" strokeOpacity={0.6} strokeWidth={0.4} />
          <path d="M9 14.3 V22.5 M4.9 18.4 H13.1 M6.1 15.5 L11.9 21.3 M11.9 15.5 L6.1 21.3" stroke="#3d2711" strokeOpacity={0.6} strokeWidth={0.4} />
          <circle cx={9} cy={18.4} r={1} fill="url(#gi-gold)" {...EDGE} />
          <g transform="rotate(-20 11 9.5)">
            <path d="M3.4 5.6 H15.6 L19.6 4.4 V14.6 L15.6 13.4 H3.4 Q1.6 13.4 1.6 9.5 Q1.6 5.6 3.4 5.6 Z" fill="url(#gi-iron)" {...EDGE} />
            <path d="M3.2 6.6 H17 L19.2 5.9" fill="none" stroke="#c5ced7" strokeOpacity={0.65} strokeWidth={0.55} strokeLinecap="round" />
            <rect x={6.6} y={5.2} width={1.1} height={8.6} fill="#1c2229" fillOpacity={0.7} />
            <rect x={12.2} y={5.1} width={1.1} height={8.8} fill="#1c2229" fillOpacity={0.7} />
            <rect x={18.9} y={3.9} width={1.9} height={11.2} rx={0.8} fill="url(#gi-iron)" {...EDGE} />
          </g>
          <circle cx={20.2} cy={20.4} r={2.5} fill="url(#gi-iron)" {...EDGE} />
          <circle cx={19.4} cy={19.6} r={0.8} fill="#fff" fillOpacity={0.35} />
        </g>
      );
    case "eyepatch":
      return (
        <g>
          <path d="M1.2 6.6 Q12 1.4 22.8 6.6" fill="none" stroke="#14110e" strokeWidth={1.7} strokeLinecap="round" />
          <path d="M1.2 5.9 Q12 0.7 22.8 5.9" fill="none" stroke="#6b5240" strokeOpacity={0.55} strokeWidth={0.4} />
          <path d="M6.2 8.6 Q12 6.4 17.8 8.6 Q20.2 14.6 15.8 19.2 Q12 22 8.2 19.2 Q3.8 14.6 6.2 8.6 Z" fill="url(#gi-leather)" {...EDGE} />
          <path d="M7.6 10 Q12 8.2 16.4 10 Q18.4 14.6 14.9 18 Q12 20.2 9.1 18 Q5.6 14.6 7.6 10 Z" fill="none" stroke="#b78a5c" strokeOpacity={0.7} strokeWidth={0.4} strokeDasharray="1.1 0.9" />
          <path d="M8 11 Q10 9.4 12.4 9.2" fill="none" stroke="#fff" strokeOpacity={0.22} strokeWidth={0.9} strokeLinecap="round" />
        </g>
      );
    case "key":
      return (
        <g transform="rotate(45 12 12)">
          <path d="M10.4 10.9 H21.6 V13.1 H10.4 Z" fill="url(#gi-gold)" {...EDGE} />
          <path d="M17.2 13.1 H19.4 V17 H17.2 Z M13.6 13.1 H15.4 V15.8 H13.6 Z" fill="url(#gi-gold)" {...EDGE} />
          <path d="M10.4 11.4 H11.8 M10.4 12.6 H11.8" stroke="#8f6416" strokeWidth={0.4} />
          <path
            fillRule="evenodd"
            fill="url(#gi-gold)"
            {...EDGE}
            d="M6.4 6.6 A5.4 5.4 0 1 1 6.4 17.4 A5.4 5.4 0 1 1 6.4 6.6 Z M6.4 9.4 A2.6 2.6 0 1 0 6.4 14.6 A2.6 2.6 0 1 0 6.4 9.4 Z"
          />
          <path d="M3.6 9.2 A4.4 4.4 0 0 1 7 7.6" fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={0.6} strokeLinecap="round" />
        </g>
      );
    case "ship":
      return (
        <g>
          <path d="M11.5 3 H12.6 V16 H11.5 Z" fill="url(#gi-woodH)" {...EDGE} />
          <path d="M12.8 3.6 Q20.2 8.2 19.4 14.6 H12.8 Z" fill="url(#gi-sail)" {...EDGE} />
          <path d="M11.3 5.4 Q4.6 9.6 5.2 14.6 H11.3 Z" fill="url(#gi-sail)" {...EDGE} />
          <path d="M12.6 3 L12.6 0.8 L17 1.9 L12.6 3 Z" fill="#9b2c2f" {...EDGE} />
          <path d="M1.8 15.4 H22.2 Q21 20.2 17.2 21.2 H6.8 Q3 20.2 1.8 15.4 Z" fill="url(#gi-wood)" {...EDGE} />
          <path d="M2.6 17.2 H21.4" stroke="#d0a36f" strokeOpacity={0.5} strokeWidth={0.45} />
          <circle cx={7.2} cy={18.4} r={0.75} fill="#1d1a16" fillOpacity={0.7} />
          <circle cx={12} cy={18.4} r={0.75} fill="#1d1a16" fillOpacity={0.7} />
          <circle cx={16.8} cy={18.4} r={0.75} fill="#1d1a16" fillOpacity={0.7} />
        </g>
      );
    case "anchor":
      return (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <g stroke="#2a323b" strokeWidth={2.6}>
            <circle cx={12} cy={4.6} r={2.1} />
            <path d="M12 6.8 V20.6 M7.4 10.2 H16.6 M3.8 13.4 Q4.6 20.6 12 20.8 Q19.4 20.6 20.2 13.4" />
          </g>
          <g stroke="url(#gi-steelV)" strokeWidth={1.7}>
            <circle cx={12} cy={4.6} r={2.1} />
            <path d="M12 6.8 V20.6 M7.4 10.2 H16.6 M3.8 13.4 Q4.6 20.6 12 20.8 Q19.4 20.6 20.2 13.4" />
          </g>
          <path d="M2.2 14.6 L3.8 12.6 L6 14.8 M21.8 14.6 L20.2 12.6 L18 14.8" stroke="#2a323b" strokeWidth={2.2} />
          <path d="M2.2 14.6 L3.8 12.6 L6 14.8 M21.8 14.6 L20.2 12.6 L18 14.8" stroke="url(#gi-steelV)" strokeWidth={1.1} />
        </g>
      );
    case "chest":
      return (
        <g>
          <path d="M2.6 11.4 V20.2 Q2.6 21 3.4 21 H20.6 Q21.4 21 21.4 20.2 V11.4 Z" fill="url(#gi-wood)" {...EDGE} />
          <path d="M2.6 11.4 V9.8 Q2.6 3.6 12 3.6 Q21.4 3.6 21.4 9.8 V11.4 Z" fill="url(#gi-woodH)" {...EDGE} />
          <path d="M4.2 9 Q5.4 5.6 12 5.2" fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={0.7} strokeLinecap="round" />
          <path d="M6 5.6 V21 M18 5.6 V21 M2.6 11.4 H21.4" fill="none" stroke="url(#gi-gold)" strokeWidth={1.7} />
          <path d="M6 5.6 V21 M18 5.6 V21 M2.6 11.4 H21.4" fill="none" stroke={INK} strokeOpacity={0.35} strokeWidth={0.3} />
          <rect x={9.8} y={10} width={4.4} height={5.2} rx={1} fill="url(#gi-gold)" {...EDGE} />
          <circle cx={12} cy={12.2} r={0.9} fill={INK} />
          <path d="M12 12.4 V14" stroke={INK} strokeWidth={0.8} strokeLinecap="round" />
        </g>
      );
  }
}

/** For use inside an <svg> that renders <ItemDefs />, drawn on a 24-unit canvas. */
export function Glyph({ name }: { name: GlyphName }) {
  return <GlyphPaths name={name} />;
}

export function ItemIcon({ kind, size = 24 }: { kind: GlyphName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none" }}>
      <ItemDefs />
      <Glyph name={kind} />
    </svg>
  );
}
