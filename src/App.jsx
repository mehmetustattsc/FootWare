import { useEffect, useRef, useState } from "react";
import players from "./data/players.json";
import { T, LANGS, detectLang } from "./i18n.js";
import { clubColors, clubInitials } from "./clubs.js";
import {
  MAX_ROUNDS,
  buildOptions,
  calcScore,
  getTier,
  isCorrect,
  pickPlayer,
} from "./game.js";

const DIFF_COLORS = ["#16A34A", "#65A30D", "#CA8A04", "#EA580C", "#DC2626"];

// localStorage can be blocked (private mode, sandboxed iframes) – never let that crash the game.
const store = {
  get(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

async function shareResult(text, onCopied) {
  const url = window.location.origin + window.location.pathname;
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    onCopied();
  } catch {
    /* clipboard blocked – nothing else to do */
  }
}

/* ───────────────────────── small components ───────────────────────── */

function TopBar({ t, lang, onLang, score }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-logo" aria-hidden="true">⚽</span>
        <span className="brand-name">FootWare</span>
      </div>
      <div className="topbar-right">
        {score !== null && (
          <div className="score" aria-live="polite">
            <span className="score-label">{t.score}</span>
            <span className="score-value">{score.toLocaleString()}</span>
          </div>
        )}
        <div className="lang" role="group" aria-label="Language">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              className={l === lang ? "lang-btn active" : "lang-btn"}
              aria-pressed={l === lang}
              onClick={() => onLang(l)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

function ClubBadge({ name, index, isNew }) {
  const { fg, bg } = clubColors(name);
  return (
    <li className={isNew ? "club is-new" : "club"}>
      <span className="club-logo" style={{ color: fg, background: bg }} aria-hidden="true">
        {clubInitials(name)}
      </span>
      <span>
        <span className="club-name">{name}</span>
        <span className="club-idx">#{index + 1}</span>
      </span>
    </li>
  );
}

/* ───────────────────────── screens ───────────────────────── */

function Intro({ t, best, onStart }) {
  const stats = [
    [MAX_ROUNDS, t.statQuestions],
    [players.length, t.statPlayers],
    [5, t.statLevels],
  ];
  return (
    <main className="wrap center">
      <div className="hero">
        <div className="hero-ball" aria-hidden="true">⚽</div>
        <h1>FootWare</h1>
        <p className="hero-sub">{t.tagline}</p>
        <div className="stats">
          {stats.map(([n, label]) => (
            <div className="stat" key={label}>
              <div className="stat-n">{n}</div>
              <div className="stat-l">{label}</div>
            </div>
          ))}
        </div>
        {best > 0 && (
          <p className="best">
            {t.best}: <strong>{best.toLocaleString()}</strong>
          </p>
        )}
        <button type="button" className="btn btn-primary" onClick={onStart}>
          {t.start}
        </button>
      </div>
    </main>
  );
}

function Quiz({ t, lang, q, round, onReveal, onHint, onAnswer, onNext }) {
  const { player } = q;
  const answered = q.selected !== null;
  const resultRef = useRef(null);
  const nextRef = useRef(null);
  const clues = player.clues[lang] ?? player.clues.en;
  const diff = player.difficulty;

  // After answering: bring the result into view and focus "Continue" so Enter works.
  useEffect(() => {
    if (!answered) return;
    nextRef.current?.focus({ preventScroll: true });
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    resultRef.current?.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
  }, [answered]);

  return (
    <main className="wrap">
      <div className="qhead">
        <span className="qlabel">
          {t.question} {round}/{MAX_ROUNDS}
        </span>
        <span className="chip" style={{ "--c": DIFF_COLORS[diff - 1] }}>
          {t.difficulty[diff - 1]}
        </span>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">{t.careerPath}</div>
            <div className="mask" aria-hidden="true">??? ??? ???</div>
          </div>
          <div className="meter">
            <div className="meter-text">
              {q.clubsShown}/{player.clubs.length} {t.clubsShown}
            </div>
            <div className="dots" aria-hidden="true">
              {player.clubs.map((_, i) => (
                <span key={i} className={i < q.clubsShown ? "dot on" : "dot"} />
              ))}
            </div>
          </div>
        </div>

        <ol className="clubs">
          {player.clubs.slice(0, q.clubsShown).map((c, i) => (
            <ClubBadge key={i} name={c} index={i} isNew={i === q.clubsShown - 1 && i > 0} />
          ))}
          {q.clubsShown < player.clubs.length && (
            <li className="club club-hidden">
              <span className="club-logo" aria-hidden="true">?</span>
              <span className="club-name muted">{t.nextClubHidden}</span>
            </li>
          )}
        </ol>

        {q.hintsUsed > 0 && (
          <div className="hint" role="note">
            <span aria-hidden="true">💡</span>
            <ul>
              {clues.slice(0, q.hintsUsed).map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {!answered && (
          <div className="actions">
            {q.clubsShown < player.clubs.length && (
              <button type="button" className="btn btn-ghost" onClick={onReveal}>
                + {t.revealClub}
              </button>
            )}
            {q.hintsUsed < clues.length && (
              <button type="button" className="btn btn-hint" onClick={onHint}>
                💡 {t.getHint}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="card pad">
        <div className="eyebrow">{t.pickAnswer}</div>
        <div className="options">
          {q.options.map((opt, i) => {
            let cls = "option";
            if (answered) {
              if (isCorrect(player, opt)) cls += " correct";
              else if (i === q.selected) cls += " wrong";
              else cls += " reveal";
            }
            return (
              <button
                key={opt}
                type="button"
                className={cls}
                aria-disabled={answered}
                onClick={() => onAnswer(i)}
              >
                <span className="key" aria-hidden="true">{i + 1}</span>
                <span className="option-label">{opt}</span>
                {answered && isCorrect(player, opt) && <span aria-hidden="true">✓</span>}
                {answered && i === q.selected && !isCorrect(player, opt) && (
                  <span aria-hidden="true">✗</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {answered && (
        <div ref={resultRef} className="result-block">
          <div className={q.earned > 0 ? "banner ok" : "banner bad"} role="status">
            <div>
              <div className="banner-title">{q.earned > 0 ? t.correct : t.wrong}</div>
              <div className="banner-name">{player.name}</div>
              <div className="banner-meta">
                {player.nat} · {player.era}
              </div>
            </div>
            <div className="banner-score">{q.earned > 0 ? `+${q.earned}` : "+0"}</div>
          </div>

          <div className="card pad">
            <div className="eyebrow">{t.fullCareer}</div>
            <div className="chips">
              {player.clubs.map((c, i) => (
                <span className="chip-club" key={i}>
                  {c}
                  {i < player.clubs.length - 1 && <span className="arrow"> →</span>}
                </span>
              ))}
            </div>
          </div>

          <button ref={nextRef} type="button" className="btn btn-dark" onClick={onNext}>
            {round >= MAX_ROUNDS ? t.finish : t.next} →
          </button>
        </div>
      )}
    </main>
  );
}

function Result({ t, total, best, isNewBest, log, onAgain }) {
  const tier = getTier(total, t.tiers);
  const [copied, setCopied] = useState(false);

  const onShare = () => {
    const text = t.shareText.replace("{score}", total.toLocaleString()).replace("{tier}", tier.title);
    shareResult(text, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <main className="wrap">
      <section className="tier-card">
        <div className="tier-icon" aria-hidden="true">{tier.icon}</div>
        <div className="eyebrow light">{t.result}</div>
        <h2>{tier.title}</h2>
        <p className="tier-sub">{tier.sub}</p>
        <div className="tier-score">{total.toLocaleString()}</div>
        <div className="tier-score-l">
          {t.score}
          {isNewBest && total > 0 ? " · 🎉" : ""}
        </div>
        {best > 0 && !isNewBest && (
          <div className="tier-best">
            {t.best}: {best.toLocaleString()}
          </div>
        )}
      </section>

      <section className="card log">
        {log.map((r, i) => (
          <div className="log-row" key={i}>
            <span className={r.correct ? "log-mark ok" : "log-mark bad"} aria-hidden="true">
              {r.correct ? "✓" : "✗"}
            </span>
            <span className="log-name">{r.name}</span>
            <span className={r.correct ? "log-score ok" : "log-score bad"}>
              {r.correct ? `+${r.score}` : "+0"}
            </span>
          </div>
        ))}
      </section>

      <div className="two">
        <button type="button" className="btn btn-primary" onClick={onAgain}>
          {t.playAgain}
        </button>
        <button type="button" className="btn btn-ghost solid" onClick={onShare}>
          {copied ? t.copied : t.share}
        </button>
      </div>
    </main>
  );
}

/* ───────────────────────── app ───────────────────────── */

export default function App() {
  const [lang, setLang] = useState(detectLang);
  const [phase, setPhase] = useState("intro"); // intro | playing | result
  const [round, setRound] = useState(1);
  const [total, setTotal] = useState(0);
  const [log, setLog] = useState([]);
  const [used, setUsed] = useState([]);
  const [q, setQ] = useState(null);
  const [best, setBest] = useState(() => store.get("footware:best", 0));
  const [isNewBest, setIsNewBest] = useState(false);

  const t = T[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem("footware:lang", lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  function startRound(n, usedIds) {
    const recent = store.get("footware:recent", []);
    const player = pickPlayer(n, usedIds, players, recent);
    setQ({
      player,
      options: buildOptions(player),
      clubsShown: 1,
      hintsUsed: 0,
      selected: null,
      earned: 0,
    });
    setRound(n);
  }

  function startGame() {
    setUsed([]);
    setTotal(0);
    setLog([]);
    setIsNewBest(false);
    setPhase("playing");
    startRound(1, []);
  }

  function answer(i) {
    if (!q || q.selected !== null) return;
    const ok = isCorrect(q.player, q.options[i]);
    const earned = ok ? calcScore(q.clubsShown, q.player.clubs.length, q.hintsUsed) : 0;
    setQ({ ...q, selected: i, earned });
    setTotal((s) => s + earned);
    setLog((l) => [...l, { name: q.player.name, correct: ok, score: earned }]);
  }

  function next() {
    const newUsed = [...used, q.player.id];
    setUsed(newUsed);
    if (round >= MAX_ROUNDS) {
      const recent = store.get("footware:recent", []);
      store.set("footware:recent", [...recent, ...newUsed].slice(-24));
      if (total > best) {
        setBest(total);
        setIsNewBest(true);
        store.set("footware:best", total);
      }
      setPhase("result");
    } else {
      startRound(round + 1, newUsed);
    }
  }

  function reveal() {
    setQ((cur) =>
      cur.clubsShown < cur.player.clubs.length ? { ...cur, clubsShown: cur.clubsShown + 1 } : cur,
    );
  }

  function hint() {
    const clues = q.player.clues[lang] ?? q.player.clues.en;
    setQ((cur) => (cur.hintsUsed < clues.length ? { ...cur, hintsUsed: cur.hintsUsed + 1 } : cur));
  }

  // Keyboard: 1–4 pick an answer (Enter on the focused "Continue" button advances).
  useEffect(() => {
    if (phase !== "playing") return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= 4) answer(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="app">
      <TopBar t={t} lang={lang} onLang={setLang} score={phase === "playing" ? total : null} />
      {phase === "playing" && (
        <div className="progress" aria-hidden="true">
          <div className="progress-bar" style={{ width: `${(round / MAX_ROUNDS) * 100}%` }} />
        </div>
      )}
      {phase === "intro" && <Intro t={t} best={best} onStart={startGame} />}
      {phase === "playing" && q && (
        <Quiz
          t={t}
          lang={lang}
          q={q}
          round={round}
          onReveal={reveal}
          onHint={hint}
          onAnswer={answer}
          onNext={next}
        />
      )}
      {phase === "result" && (
        <Result
          t={t}
          total={total}
          best={best}
          isNewBest={isNewBest}
          log={log}
          onAgain={startGame}
        />
      )}
    </div>
  );
}
