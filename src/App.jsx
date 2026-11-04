import { useEffect, useRef, useState } from "react";
import players from "./data/players.json";
import transfers from "./data/transfers.json";
import { T, LANGS, detectLang } from "./i18n.js";
import { clubColors, clubInitials } from "./clubs.js";
import {
  LEVELS,
  LEVEL_CFG,
  MAX_ROUNDS,
  MAX_ROUND_SCORE,
  applyLevel,
  buildOptions,
  calcScore,
  getTierByShare,
  pickPlayer,
} from "./game.js";
import {
  MODES,
  WHOAMI_LADDER,
  makeCommon,
  makeFee,
  makeMystery,
  makeWhoAmI,
} from "./modes.js";

const MODE_ICON = { career: "🛤️", whoami: "🕵️", common: "🤝", mystery: "🏟️", fee: "💶" };
const NEW_MODES = ["whoami", "common", "mystery", "fee"];
const DIFF_COLORS = ["#16A34A", "#65A30D", "#CA8A04", "#EA580C", "#DC2626"];
const LEVEL_COLORS = { easy: "#16A34A", medium: "#CA8A04", hard: "#DC2626" };

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
const bestKey = (mode, level) => `footware:best:${mode}:${level}`;

function fromUrl(name, allowed) {
  try {
    const v = new URLSearchParams(window.location.search).get(name);
    return allowed.includes(v) ? v : null;
  } catch {
    return null;
  }
}

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

const fmtFee = (t, n) => t.feeUnit.replace("{n}", String(n).replace(/\.0$/, ""));

/* ───────────────────────── small components ───────────────────────── */

function TopBar({ t, lang, onLang, score, onBack }) {
  return (
    <header className="topbar">
      {onBack ? (
        <button type="button" className="back" onClick={onBack}>
          ← {t.back}
        </button>
      ) : (
        <div className="brand">
          <span className="brand-logo" aria-hidden="true">⚽</span>
          <span className="brand-name">FootWare</span>
        </div>
      )}
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

function ClubLogo({ name }) {
  const { fg, bg } = clubColors(name);
  return (
    <span className="club-logo" style={{ color: fg, background: bg }} aria-hidden="true">
      {clubInitials(name)}
    </span>
  );
}

function ClubBadge({ name, index, isNew }) {
  return (
    <li className={isNew ? "club is-new" : "club"}>
      <ClubLogo name={name} />
      <span>
        <span className="club-name">{name}</span>
        <span className="club-idx">#{index + 1}</span>
      </span>
    </li>
  );
}

function PlayerChip({ p }) {
  return (
    <div className="pchip">
      <span className="pchip-nat">{p.nat}</span>
      <span className="pchip-name">{p.name}</span>
      <span className="pchip-era">{p.era}</span>
    </div>
  );
}

function Options({ t, q, onPick, clubs = false }) {
  return (
    <section className="card pad">
      <div className="eyebrow">{t.pickAnswer}</div>
      <div className="options">
        {q.options.map((opt, i) => {
          const removed = q.removed.includes(opt);
          let cls = "option";
          if (removed) cls += " removed";
          if (q.done) {
            if (opt === q.answer) cls += " correct";
            else if (q.picked === opt || q.wrongPicks?.includes(opt)) cls += " wrong";
            else cls += " reveal";
          }
          return (
            <button
              key={opt}
              type="button"
              className={cls}
              aria-disabled={q.done || removed}
              onClick={() => onPick(opt)}
            >
              <span className="key" aria-hidden="true">{i + 1}</span>
              {clubs && <ClubLogo name={opt} />}
              <span className="option-label">{opt}</span>
              {q.done && opt === q.answer && <span aria-hidden="true">✓</span>}
              {q.done && opt !== q.answer && (q.picked === opt || q.wrongPicks?.includes(opt)) && (
                <span aria-hidden="true">✗</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function JokerButton({ t, q, cfg, onJoker }) {
  if (!cfg.joker || q.done) return null;
  return (
    <div className="actions joker-row">
      <button type="button" className="btn btn-hint" disabled={q.jokerUsed} onClick={onJoker}>
        ✂️ {q.jokerUsed ? t.jokerUsed : t.joker}
      </button>
    </div>
  );
}

/* ───────────────────────── screens ───────────────────────── */

function Menu({ t, level, onLevel, onStart }) {
  return (
    <main className="wrap">
      <div className="hero small">
        <div className="hero-ball" aria-hidden="true">⚽</div>
        <h1>FootWare</h1>
        <p className="hero-sub">{t.tagline}</p>
      </div>

      <section aria-label={t.levelLabel}>
        <div className="eyebrow">{t.levelLabel}</div>
        <div className="seg" role="group" aria-label={t.levelLabel}>
          {LEVELS.map((l, i) => (
            <button
              key={l}
              type="button"
              className={l === level ? "seg-btn active" : "seg-btn"}
              style={{ "--c": LEVEL_COLORS[l] }}
              aria-pressed={l === level}
              onClick={() => onLevel(l)}
            >
              {t.levels[i]}
            </button>
          ))}
        </div>
        <p className="seg-hint">{t.levelHint[LEVELS.indexOf(level)]}</p>
      </section>

      <section aria-label={t.menuTitle}>
        <div className="eyebrow">{t.menuTitle}</div>
        <div className="modes">
          {MODES.map((m) => {
            const best = store.get(bestKey(m, level), 0);
            return (
              <button key={m} type="button" className="mode" onClick={() => onStart(m)}>
                <span className="mode-ic" aria-hidden="true">{MODE_ICON[m]}</span>
                <span className="mode-body">
                  <span className="mode-name">
                    {t[`m_${m}`]}
                    {NEW_MODES.includes(m) && <span className="new-tag">{t.newTag}</span>}
                  </span>
                  <span className="mode-desc">{t[`m_${m}_d`]}</span>
                  {best > 0 && (
                    <span className="mode-best">
                      {t.best}: {best.toLocaleString()}
                    </span>
                  )}
                </span>
                <span className="mode-go" aria-hidden="true">›</span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function CareerCard({ t, q, cfg, onReveal, onHint, lang }) {
  const { player } = q;
  const clues = player.clues[lang] ?? player.clues.en;
  return (
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

      {!q.done && (
        <div className="actions">
          {q.clubsShown < player.clubs.length && (
            <button type="button" className="btn btn-ghost" onClick={onReveal}>
              + {t.revealClub}
            </button>
          )}
          {cfg.hints && q.hintsUsed < clues.length && (
            <button type="button" className="btn btn-hint" onClick={onHint}>
              💡 {t.getHint}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function WhoAmICard({ t, q, cfg, level, lang }) {
  const { player } = q;
  const clues = player.clues[lang] ?? player.clues.en;
  const rows = [
    [t.s_nat, `${player.nat} · ${player.era}`],
    [t.s_count, `${player.clubs.length} · ${t.s_first}: ${player.clubs[0]}`],
    [t.clueN.replace("{n}", 1), clues[0]],
    [t.clueN.replace("{n}", 2), clues[1]],
    [t.clueN.replace("{n}", 3), clues[2]],
  ];
  const left = cfg.maxWrong + 1 - q.wrongs;
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <div className="eyebrow">{t.m_whoami}</div>
          <div className="mask" aria-hidden="true">??? ??? ???</div>
        </div>
        <div className="meter">
          <div className="meter-text">
            {t.guessesLeft}: {Math.max(left, 0)}
          </div>
          <div className="dots" aria-hidden="true">
            {WHOAMI_LADDER.map((_, i) => (
              <span key={i} className={i <= q.step ? "dot on" : "dot"} />
            ))}
          </div>
        </div>
      </div>
      <ol className="steps">
        {rows.slice(0, q.step + 1).map(([label, text], i) => (
          <li key={i} className={i === q.step && i > 0 ? "step is-new" : "step"}>
            <span className="step-l">{label}</span>
            <span className="step-t">{text}</span>
          </li>
        ))}
      </ol>
      {!q.done && (
        <div className="step-pts">
          {WHOAMI_LADDER[q.step] !== undefined && applyLevel(WHOAMI_LADDER[q.step], level).toLocaleString()} {t.score.toLowerCase()}
        </div>
      )}
    </section>
  );
}

function CommonCard({ t, q }) {
  return (
    <section className="card pad">
      <div className="eyebrow">{t.m_common}</div>
      <div className="duo">
        <PlayerChip p={q.a} />
        <span className="duo-x" aria-hidden="true">+</span>
        <PlayerChip p={q.b} />
      </div>
      <p className="qtext">{t.commonQ}</p>
    </section>
  );
}

function MysteryCard({ t, q }) {
  return (
    <section className="card pad">
      <div className="eyebrow">{t.m_mystery}</div>
      <div className="stack">
        {q.shown.map((p) => (
          <PlayerChip key={p.id} p={p} />
        ))}
      </div>
      <p className="qtext">{t.mysteryQ}</p>
    </section>
  );
}

function FeeCard({ t, q, onPick }) {
  const { shown, hidden } = q;
  const T1 = ({ x, fee }) => (
    <div className="tcard">
      <div className="tcard-name">{x.player}</div>
      <div className="tcard-route">
        {x.from} → {x.to} · {x.year}
      </div>
      <div className={fee === null ? "tcard-fee unknown" : "tcard-fee"}>
        {fee === null ? t.feeHidden : fmtFee(t, fee)}
      </div>
    </div>
  );
  return (
    <>
      <section className="card pad">
        <div className="eyebrow">{t.m_fee}</div>
        <T1 x={shown} fee={shown.fee} />
        <div className="vs" aria-hidden="true">VS</div>
        <T1 x={hidden} fee={q.done ? hidden.fee : null} />
        <p className="qtext">{t.feeQ}</p>
        <div className="two">
          {["higher", "lower"].map((o, i) => {
            let cls = "option fee-opt";
            if (q.done) {
              if (o === q.answer) cls += " correct";
              else if (q.picked === o) cls += " wrong";
              else cls += " reveal";
            }
            return (
              <button key={o} type="button" className={cls} aria-disabled={q.done} onClick={() => onPick(o)}>
                <span className="key" aria-hidden="true">{i + 1}</span>
                <span className="option-label">{o === "higher" ? `▲ ${t.higher}` : `▼ ${t.lower}`}</span>
              </button>
            );
          })}
        </div>
      </section>
      <p className="note">{t.feeNote}</p>
    </>
  );
}

function ResultExtra({ t, q }) {
  if (q.mode === "career" || q.mode === "whoami") {
    return (
      <div className="card pad">
        <div className="eyebrow">{t.fullCareer}</div>
        <div className="chips">
          {q.player.clubs.map((c, i) => (
            <span className="chip-club" key={i}>
              {c}
              {i < q.player.clubs.length - 1 && <span className="arrow"> →</span>}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (q.mode === "common") {
    return (
      <div className="card pad">
        <div className="eyebrow">{t.sharedClubs}</div>
        <div className="chips">
          {q.shared.map((c) => (
            <span className="chip-club" key={c}>{c}</span>
          ))}
        </div>
      </div>
    );
  }
  if (q.mode === "mystery") {
    return (
      <div className="card pad">
        <div className="eyebrow">{t.mysteryCap}</div>
        <div className="stack">
          {q.shown.map((p) => (
            <PlayerChip key={p.id} p={p} />
          ))}
        </div>
      </div>
    );
  }
  return null;
}

function Quiz({ t, lang, level, q, round, cfg, handlers }) {
  const resultRef = useRef(null);
  const nextRef = useRef(null);

  // After answering: bring the result into view and focus "Continue" so Enter works.
  useEffect(() => {
    if (!q.done) return;
    nextRef.current?.focus({ preventScroll: true });
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    resultRef.current?.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
  }, [q.done]);

  const diffLabel =
    q.mode === "career" || q.mode === "whoami"
      ? t.difficulty[q.player.difficulty - 1]
      : t.levels[LEVELS.indexOf(level)];
  const diffColor =
    q.mode === "career" || q.mode === "whoami" ? DIFF_COLORS[q.player.difficulty - 1] : LEVEL_COLORS[level];

  const banner = q.earned > 0;
  const name = q.mode === "fee" ? q.hidden.player : q.mode === "common" || q.mode === "mystery" ? q.answer : q.player.name;
  const meta =
    q.mode === "career" || q.mode === "whoami"
      ? `${q.player.nat} · ${q.player.era}`
      : q.mode === "fee"
        ? `${q.hidden.from} → ${q.hidden.to} · ${q.hidden.year} · ${fmtFee(t, q.hidden.fee)}`
        : "";

  return (
    <main className="wrap">
      <div className="qhead">
        <span className="qlabel">
          {t.question} {round}/{MAX_ROUNDS}
        </span>
        <span className="chip" style={{ "--c": diffColor }}>
          {diffLabel}
        </span>
      </div>

      {q.mode === "career" && (
        <CareerCard t={t} q={q} cfg={cfg} lang={lang} onReveal={handlers.reveal} onHint={handlers.hint} />
      )}
      {q.mode === "whoami" && <WhoAmICard t={t} q={q} cfg={cfg} level={level} lang={lang} />}
      {q.mode === "common" && <CommonCard t={t} q={q} />}
      {q.mode === "mystery" && <MysteryCard t={t} q={q} />}
      {q.mode === "fee" && <FeeCard t={t} q={q} onPick={handlers.answer} />}

      {q.mode !== "fee" && (
        <>
          <Options t={t} q={q} onPick={handlers.answer} clubs={q.mode === "common" || q.mode === "mystery"} />
          {(q.mode === "common" || q.mode === "mystery") && (
            <JokerButton t={t} q={q} cfg={cfg} onJoker={handlers.joker} />
          )}
          {q.mode === "whoami" && q.wrongs > 0 && !q.done && (
            <p className="note warn" role="status">{t.wrongNext}</p>
          )}
        </>
      )}

      {q.done && (
        <div ref={resultRef} className="result-block">
          <div className={banner ? "banner ok" : "banner bad"} role="status">
            <div>
              <div className="banner-title">{banner ? t.correct : t.wrong}</div>
              <div className="banner-name">{name}</div>
              {meta && <div className="banner-meta">{meta}</div>}
            </div>
            <div className="banner-score">{banner ? `+${q.earned}` : "+0"}</div>
          </div>
          <ResultExtra t={t} q={q} />
          <button ref={nextRef} type="button" className="btn btn-dark" onClick={handlers.next}>
            {round >= MAX_ROUNDS ? t.finish : t.next} →
          </button>
        </div>
      )}
    </main>
  );
}

function Result({ t, mode, level, total, best, isNewBest, log, onAgain, onMenu }) {
  const tier = getTierByShare(total, level, t.tiers);
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
        <div className="tier-modeline">
          {MODE_ICON[mode]} {t[`m_${mode}`]} · {t.levels[LEVELS.indexOf(level)]}
        </div>
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
      <button type="button" className="btn btn-ghost solid wide" onClick={onMenu}>
        ← {t.menuTitle}
      </button>
    </main>
  );
}

/* ───────────────────────── app ───────────────────────── */

export default function App() {
  const [lang, setLang] = useState(detectLang);
  const [level, setLevel] = useState(() => fromUrl("level", LEVELS) ?? store.get("footware:level", "medium"));
  const [phase, setPhase] = useState("menu"); // menu | playing | result
  const [mode, setMode] = useState("career");
  const [round, setRound] = useState(1);
  const [total, setTotal] = useState(0);
  const [log, setLog] = useState([]);
  const [used, setUsed] = useState([]);
  const [q, setQ] = useState(null);
  const [best, setBest] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const t = T[lang];
  const cfg = LEVEL_CFG[level] ?? LEVEL_CFG.medium;

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem("footware:lang", lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  function chooseLevel(l) {
    setLevel(l);
    store.set("footware:level", l);
  }

  function makeRound(m, n, usedList) {
    const recentKey = `footware:recent:${m}`;
    const recent = store.get(recentKey, []);
    if (m === "career") {
      const player = pickPlayer(n, usedList, players, recent, Math.random, cfg.seq);
      return { mode: m, player, options: buildOptions(player), answer: player.name, clubsShown: 1, hintsUsed: 0 };
    }
    if (m === "whoami") {
      return { ...makeWhoAmI(n, level, usedList, players, recent), step: 0, wrongs: 0, wrongPicks: [] };
    }
    if (m === "common") return makeCommon(level, usedList, players);
    if (m === "mystery") return makeMystery(level, usedList, players);
    return makeFee(level, usedList, transfers);
  }

  function startRound(m, n, usedList) {
    const base = makeRound(m, n, usedList);
    setQ({ ...base, removed: [], jokerUsed: false, done: false, picked: null, earned: 0 });
    setRound(n);
  }

  function startGame(m) {
    setMode(m);
    setUsed([]);
    setTotal(0);
    setLog([]);
    setIsNewBest(false);
    setBest(store.get(bestKey(m, level), 0));
    setPhase("playing");
    startRound(m, 1, []);
  }

  function finishRound(cur, correct, base) {
    const earned = correct ? applyLevel(base, level) : 0;
    setQ({ ...cur, done: true, earned });
    setTotal((s) => s + earned);
    const name =
      cur.mode === "fee" ? cur.hidden.player : cur.mode === "common" || cur.mode === "mystery" ? cur.answer : cur.player.name;
    setLog((l) => [...l, { name, correct, score: earned }]);
  }

  function answer(opt) {
    if (!q || q.done || q.removed.includes(opt)) return;
    const ok = opt === q.answer;

    if (q.mode === "whoami") {
      if (ok) return finishRound({ ...q, picked: opt }, true, WHOAMI_LADDER[q.step]);
      const wrongs = q.wrongs + 1;
      const next = {
        ...q,
        wrongs,
        wrongPicks: [...q.wrongPicks, opt],
        removed: [...q.removed, opt],
        step: Math.min(q.step + 1, WHOAMI_LADDER.length - 1),
      };
      if (wrongs > cfg.maxWrong) return finishRound({ ...next, picked: opt }, false, 0);
      setQ(next);
      return undefined;
    }

    let base = 0;
    if (ok) {
      if (q.mode === "career") base = calcScore(q.clubsShown, q.player.clubs.length, q.hintsUsed, cfg.hintCost);
      else base = q.jokerUsed ? 1000 : MAX_ROUND_SCORE;
    }
    return finishRound({ ...q, picked: opt }, ok, base);
  }

  function next() {
    const nextUsed = [...used, ...usedFor(q)];
    setUsed(nextUsed);
    if (round >= MAX_ROUNDS) {
      if (q.mode === "career" || q.mode === "whoami") {
        const key = `footware:recent:${q.mode}`;
        const ids = [...used, q.player.id];
        store.set(key, [...store.get(key, []), ...ids].slice(-24));
      }
      if (total > best) {
        setBest(total);
        setIsNewBest(true);
        store.set(bestKey(mode, level), total);
      }
      setPhase("result");
    } else {
      startRound(mode, round + 1, nextUsed);
    }
  }

  function usedFor(cur) {
    if (cur.mode === "career" || cur.mode === "whoami") return [cur.player.id];
    if (cur.mode === "common") return cur.usedIds;
    if (cur.mode === "mystery") return [cur.answer];
    return cur.usedIds;
  }

  function reveal() {
    setQ((cur) => (cur.clubsShown < cur.player.clubs.length ? { ...cur, clubsShown: cur.clubsShown + 1 } : cur));
  }

  function hint() {
    const clues = q.player.clues[lang] ?? q.player.clues.en;
    setQ((cur) => (cur.hintsUsed < clues.length ? { ...cur, hintsUsed: cur.hintsUsed + 1 } : cur));
  }

  function joker() {
    setQ((cur) => {
      if (cur.jokerUsed || cur.done) return cur;
      const wrong = cur.options.filter((o) => o !== cur.answer && !cur.removed.includes(o));
      const drop = wrong.sort(() => Math.random() - 0.5).slice(0, 2);
      return { ...cur, jokerUsed: true, removed: [...cur.removed, ...drop] };
    });
  }

  // Keyboard: 1–4 pick an answer (Enter on the focused "Continue" button advances).
  useEffect(() => {
    if (phase !== "playing" || !q) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= q.options.length) answer(q.options[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const handlers = { answer, next, reveal, hint, joker };

  return (
    <div className="app">
      <TopBar
        t={t}
        lang={lang}
        onLang={setLang}
        score={phase === "playing" ? total : null}
        onBack={phase === "menu" ? null : () => setPhase("menu")}
      />
      {phase === "playing" && (
        <div className="progress" aria-hidden="true">
          <div className="progress-bar" style={{ width: `${(round / MAX_ROUNDS) * 100}%` }} />
        </div>
      )}
      {phase === "menu" && <Menu t={t} level={level} onLevel={chooseLevel} onStart={startGame} />}
      {phase === "playing" && q && (
        <Quiz key={`${mode}-${round}`} t={t} lang={lang} level={level} q={q} round={round} cfg={cfg} handlers={handlers} />
      )}
      {phase === "result" && (
        <Result
          t={t}
          mode={mode}
          level={level}
          total={total}
          best={best}
          isNewBest={isNewBest}
          log={log}
          onAgain={() => startGame(mode)}
          onMenu={() => setPhase("menu")}
        />
      )}
    </div>
  );
}
