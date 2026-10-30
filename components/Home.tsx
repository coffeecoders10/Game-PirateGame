import { SEATS } from "@/lib/rules";
import { Rules } from "./Rules";
import { Token } from "./Token";
import styles from "./Home.module.css";

type Props = {
  name: string;
  code: string;
  error: string | null;
  onName: (v: string) => void;
  onCode: (v: string) => void;
  onCreate: () => void;
  onJoin: () => void;
};

const SAMPLE = ["A", "B", "C", "D", "E"];

export function Home({ name, code, error, onName, onCode, onCreate, onJoin }: Props) {
  const hasName = name.trim().length > 0;
  const canJoin = hasName && code.length === 5;
  return (
    <div className={styles.box}>
      <div className={styles.tokens} aria-hidden="true">
        {SEATS.map((_, c) => <Token key={c} seat={c} name={SAMPLE[c]} size={30} />)}
      </div>
      <h1 className={styles.title}>Dead Reckoning</h1>
      <p className={styles.tag}>A treasure hunt for two to five. Find a key, reach the chest, and keep an eye on the others.</p>

      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); (canJoin ? onJoin : onCreate)(); }}>
        <label className={styles.field}>
          <span>Your name</span>
          <input value={name} onChange={(e) => onName(e.target.value)} maxLength={14} placeholder="e.g. Anne" autoComplete="nickname" enterKeyHint="go" />
        </label>

        <button type="button" className="btn" disabled={!hasName} onClick={onCreate}>Start a new hunt</button>

        <div className={styles.or}><span>or join one</span></div>

        <div className={styles.joinRow}>
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
          <button type="button" className="btn teal" disabled={!canJoin} onClick={onJoin}>Join</button>
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}
      </form>

      <Rules label="How to play" />
    </div>
  );
}
