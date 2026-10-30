"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { RoomClient } from "@/lib/roomClient";
import { ChartBackdrop } from "./ChartBackdrop";
import { Home } from "./Home";
import { Lobby } from "./Lobby";
import { Table } from "./Table";
import styles from "./Game.module.css";

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const randomString = (chars: string, n: number) =>
  Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

const cleanName = (s: string) => s.replace(/[~\s]+/g, " ").trim().slice(0, 14);
const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);

/** One id per browser tab, so a refresh reconnects as the same player. */
function playerId() {
  try {
    let id = sessionStorage.getItem("dr:id");
    if (!id) sessionStorage.setItem("dr:id", (id = randomString("abcdefghjkmnpqrstuvwxyz23456789", 6)));
    return id;
  } catch {
    return randomString("abcdefghjkmnpqrstuvwxyz23456789", 6);
  }
}

function setUrlRoom(code: string | null) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set("room", code);
  else url.searchParams.delete("room");
  window.history.replaceState(null, "", url);
}

export function Game() {
  const [client] = useState(() => new RoomClient());
  const snap = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getServerSnapshot);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const enter = (mode: "create" | "join", rawName: string, rawCode: string) => {
    const n = cleanName(rawName);
    const c = mode === "create" ? randomString(CODE_CHARS, 5) : cleanCode(rawCode);
    if (!n || c.length < 5) return;
    try {
      localStorage.setItem("dr:name", n);
    } catch {}
    setUrlRoom(c);
    if (mode === "create") client.create(c, n, playerId());
    else client.join(c, n, playerId());
  };

  // Restore name, and rejoin automatically when opened from an invite link or after a refresh.
  useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem("dr:name") ?? "";
    } catch {}
    const room = cleanCode(new URLSearchParams(window.location.search).get("room") ?? "");
    setName(saved); // eslint-disable-line react-hooks/set-state-in-effect
    setCode(room);
    if (saved && room.length === 5) enter("join", saved, room);
    return () => client.leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = () => {
    client.leave();
    setUrlRoom(null);
    setCode("");
  };

  const { game } = snap;
  let view;
  if (snap.status === "in" && game) {
    view =
      game.phase === "lobby" ? (
        <Lobby game={game} meId={snap.meId} hostId={snap.hostId} onStart={() => client.start()} onLeave={leave} />
      ) : (
        <Table
          game={game}
          meId={snap.meId}
          hostId={snap.hostId}
          connected={snap.connected}
          onRoll={() => client.roll()}
          onConfirm={(actions) => client.confirm(actions)}
          onAgain={() => client.playAgain()}
          onLeave={leave}
        />
      );
  } else if (snap.status === "joining") {
    view = (
      <div className={styles.center}>
        <div className={styles.spinner} aria-hidden="true" />
        <p className={styles.msg}>Finding the hunt…</p>
        <button className="btn ghost" onClick={leave}>Cancel</button>
      </div>
    );
  } else {
    view = (
      <Home
        name={name}
        code={code}
        error={snap.error}
        onName={setName}
        onCode={(v) => setCode(cleanCode(v))}
        onCreate={() => enter("create", name, "")}
        onJoin={() => enter("join", name, code)}
      />
    );
  }

  return (
    <main className={styles.root}>
      {!(snap.status === "in" && game?.phase === "playing") && <ChartBackdrop />}
      {!snap.connected && snap.status !== "idle" && (
        <div className={styles.banner} role="status">Connection lost — reconnecting…</div>
      )}
      {snap.notice && (
        <div key={snap.notice.n} className={styles.toast} role="status">{snap.notice.text}</div>
      )}
      {view}
    </main>
  );
}
