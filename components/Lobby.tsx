import { useState } from "react";
import { MAX_PLAYERS, MIN_PLAYERS, SEATS, type GameState } from "@/lib/rules";
import { Rules } from "./Rules";
import { Token } from "./Token";
import styles from "./Lobby.module.css";

type Props = {
  game: GameState;
  meId: string;
  hostId: string | null;
  onStart: () => void;
  onLeave: () => void;
};

export function Lobby({ game, meId, hostId, onStart, onLeave }: Props) {
  const [copied, setCopied] = useState(false);
  const me = game.players.find((p) => p.id === meId);
  const isHost = hostId === meId;
  const host = game.players.find((p) => p.id === hostId);
  const ready = game.players.filter((p) => p.online).length;

  const copy = async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${game.code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this invite link:", url);
    }
  };

  return (
    <section className={styles.wrap} aria-labelledby="lobby-title">
      <h1 id="lobby-title" className={styles.title}>Hunt {game.code}</h1>
      <p className={styles.sub}>Share the code or the link. The host starts when everyone is in.</p>
      <button className="btn ghost" onClick={copy}>{copied ? "Link copied" : "Copy invite link"}</button>

      <ul className={styles.seats}>
        {Array.from({ length: MAX_PLAYERS }, (_, i) => {
          const p = game.players[i];
          return p ? (
            <li key={p.id} className={styles.seat}>
              <Token seat={p.color} name={p.name} size={32} />
              <span className={styles.name}>{p.name}</span>
              <span className={styles.tags}>
                <span>{SEATS[p.color].name}</span>
                {p.id === hostId && <b>host</b>}
                {p.id === meId && <b>you</b>}
              </span>
            </li>
          ) : (
            <li key={`empty${i}`} className={`${styles.seat} ${styles.empty}`}>
              <span className={styles.ghost} aria-hidden="true" />
              <span className={styles.name}>Open seat</span>
            </li>
          );
        })}
      </ul>

      {!me ? (
        <p className={styles.hint}>This hunt is full, or the voyage already started.</p>
      ) : isHost ? (
        <>
          <button className={`btn ${styles.start}`} disabled={ready < MIN_PLAYERS} onClick={onStart}>Start the hunt</button>
          <p className={styles.hint}>{ready < MIN_PLAYERS ? "You need at least 2 players." : "Everyone in? Start when ready."}</p>
        </>
      ) : (
        <p className={styles.hint}>Waiting for {host?.name ?? "the host"} to start…</p>
      )}

      <div className={styles.row}>
        <Rules />
        <button className="btn ghost" onClick={onLeave}>Leave hunt</button>
      </div>
    </section>
  );
}
