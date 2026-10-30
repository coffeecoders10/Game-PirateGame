import type { KeyboardEvent } from "react";
import { SEATS } from "@/lib/rules";
import { Rules } from "./Rules";
import { Token } from "./Token";
import styles from "./Home.module.css";

type Props = {
  name: string;
  code: string;
  tab: HomeTab;
  onTab: (t: HomeTab) => void;
  error: string | null;
  onName: (v: string) => void;
  onCode: (v: string) => void;
  onCreate: () => void;
  onJoin: () => void;
};

const SAMPLE = ["A", "B", "C", "D", "E"];
const TABS = [
  { id: "create", label: "Create" },
  { id: "join", label: "Join" },
] as const;
export type HomeTab = (typeof TABS)[number]["id"];

export function Home({ name, code, tab, error, onName, onCode, onTab: setTab, onCreate, onJoin }: Props) {
  const hasName = name.trim().length > 0;
  const canJoin = hasName && code.length === 5;
  const joining = tab === "join";

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = tab === "create" ? "join" : "create";
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  return (
    <div className={styles.box}>
      <div className={styles.tokens} aria-hidden="true">
        {SEATS.map((_, c) => <Token key={c} seat={c} name={SAMPLE[c]} size={30} />)}
      </div>
      <h1 className={styles.title}>Dead Reckoning</h1>
      <p className={styles.tag}>A treasure hunt for two to five. Find a key, reach the chest, and keep an eye on the others.</p>

      <form className={styles.form} onSubmit={(e) => {
        e.preventDefault();
        if (joining ? canJoin : hasName) (joining ? onJoin : onCreate)();
      }}>
        <div className={styles.tabs} role="tablist" aria-label="Create or join a hunt" onKeyDown={onTabKey}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className={styles.tab}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className={styles.field}>
          <span>Your name</span>
          <input value={name} onChange={(e) => onName(e.target.value)} maxLength={14} placeholder="e.g. Anne" autoComplete="nickname" enterKeyHint="go" />
        </label>

        {joining ? (
          <div className={styles.panel} role="tabpanel" id="panel-join" aria-labelledby="tab-join">
            <p className={styles.hint}>Got a code from a friend? Enter it to take a seat.</p>
            <label className={styles.field}>
              <span className="srOnly">Hunt code</span>
              <input
                className={styles.code}
                value={code}
                onChange={(e) => onCode(e.target.value)}
                placeholder="CODE"
                maxLength={5}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-label="Hunt code"
              />
            </label>
            <button type="button" className="btn" disabled={!canJoin} onClick={onJoin}>Join hunt</button>
          </div>
        ) : (
          <div className={styles.panel} role="tabpanel" id="panel-create" aria-labelledby="tab-create">
            <p className={styles.hint}>Start a fresh hunt and share the code so the others can join.</p>
            <button type="button" className="btn" disabled={!hasName} onClick={onCreate}>Start a new hunt</button>
          </div>
        )}

        {error && <p className={styles.error} role="alert">{error}</p>}
      </form>

      <Rules label="How to play" />
    </div>
  );
}
