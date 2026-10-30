import { SEATS } from "@/lib/rules";

const RIM = "#efe6cf";

/** A player's marker: a round medallion in the seat's colour with their initial. Drawn on a -5..5 canvas. */
export function TokenShape({ seat, letter }: { seat: number; letter: string }) {
  const s = SEATS[seat % SEATS.length];
  return (
    <>
      <defs>
        <radialGradient id="tk-shine" cx="0.35" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#fff" stopOpacity={0.38} />
          <stop offset="0.45" stopColor="#fff" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.45} />
        </radialGradient>
      </defs>
      <circle r={4.6} fill="#0b1015" opacity={0.45} cy={0.5} />
      <circle r={4.4} fill={s.hex} stroke={RIM} strokeWidth={0.55} />
      <circle r={4.4} fill="url(#tk-shine)" />
      <circle r={3.2} fill="none" stroke={RIM} strokeOpacity={0.35} strokeWidth={0.25} />
      <text y={0.15} textAnchor="middle" dominantBaseline="central" fontSize={4.2} fontWeight={700} fill={RIM} style={{ fontFamily: "var(--ui)" }}>
        {letter}
      </text>
    </>
  );
}

export const initial = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

export function Token({ seat, name, size = 28 }: { seat: number; name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-5.6 -5.6 11.2 11.2" aria-hidden="true" style={{ flex: "none" }}>
      <TokenShape seat={seat} letter={initial(name)} />
    </svg>
  );
}
