import type { CSSProperties } from "react";
import styles from "./Dice.module.css";

const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

/** Cube rotation that brings each value to the front. Opposite faces sum to 7. */
const SETTLE: Record<number, [number, number]> = {
  1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180],
};
const FACES = [1, 2, 3, 4, 5, 6];

type Props = {
  value: number | null;
  rolls: number; // increments on every roll so the die tosses again
  canRoll: boolean;
  pending: boolean; // we asked the host to roll and are waiting
  size?: number;
  onRoll?: () => void;
};

export function Dice({ value, rolls, canRoll, pending, size = 72, onRoll }: Props) {
  const [rx, ry] = SETTLE[value ?? 1];
  const style = { "--s": `${size}px`, "--rx": `${rx}deg`, "--ry": `${ry}deg` } as CSSProperties;
  const ready = canRoll && !pending;
  return (
    <button
      type="button"
      className={`${styles.die} ${ready ? styles.ready : ""} ${pending ? styles.pending : ""} ${value === null && !pending ? styles.unrolled : ""}`}
      style={style}
      onClick={onRoll}
      disabled={!ready}
      aria-label={canRoll ? "Roll the die" : value ? `Die showing ${value}` : "Die"}
    >
      <span className={styles.shadow} />
      <span key={rolls} className={styles.hop}>
        <span className={styles.tilt}>
          <span className={styles.cube}>
            {FACES.map((f) => (
              <span key={f} className={`${styles.face} ${styles[`f${f}`]}`}>
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} className={PIPS[f].includes(i) ? `${styles.pip} ${f === 1 ? styles.one : ""}` : undefined} />
                ))}
              </span>
            ))}
          </span>
        </span>
      </span>
    </button>
  );
}
