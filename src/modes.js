// Question builders for the extra game modes. Pure: data in, plain objects out.
import { LEVEL_CFG, pickPlayer, shuffle } from "./game.js";

export const MODES = ["career", "whoami", "common", "mystery", "fee"];

// Points ladder for "Who am I?": the earlier you guess, the more you get.
export const WHOAMI_LADDER = [1500, 1200, 900, 600, 300];
export const WHOAMI_STEPS = ["meta", "count", "clue0", "clue1", "clue2"];

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
const uniq = (arr) => [...new Set(arr)];

/** club -> unique player ids */
export function buildClubIndex(players) {
  const idx = new Map();
  for (const p of players) {
    for (const c of uniq(p.clubs)) {
      if (!idx.has(c)) idx.set(c, []);
      idx.get(c).push(p.id);
    }
  }
  return idx;
}

/* ───────────── Who am I? ───────────── */
export function makeWhoAmI(round, level, used, pool, avoid, rnd = Math.random) {
  const player = pickPlayer(round, used, pool, avoid, rnd, LEVEL_CFG[level].seq);
  return { mode: "whoami", player, options: shuffle([player.name, ...player.distractors], rnd), answer: player.name };
}

/* ───────────── Common club ───────────── */
function pairInfo(a, b, idx) {
  const shared = uniq(a.clubs).filter((c) => b.clubs.includes(c));
  if (!shared.length) return null;
  const size = Math.max(...shared.map((c) => idx.get(c).length));
  return { shared, size, maxDiff: Math.max(a.difficulty, b.difficulty) };
}

function pairFitsLevel(info, level) {
  if (level === "easy") return info.maxDiff <= 2 && info.size >= 6;
  if (level === "medium") return info.maxDiff <= 4 && info.size >= 3;
  return info.maxDiff >= 3 || info.size <= 3; // hard
}

export function commonPairs(players, level) {
  const idx = buildClubIndex(players);
  const out = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const info = pairInfo(players[i], players[j], idx);
      if (info && pairFitsLevel(info, level)) out.push({ a: players[i], b: players[j], ...info });
    }
  }
  return out;
}

export function makeCommon(level, usedPlayerIds, players, rnd = Math.random) {
  const idx = buildClubIndex(players);
  let pairs = commonPairs(players, level).filter((p) => !usedPlayerIds.includes(p.a.id) && !usedPlayerIds.includes(p.b.id));
  if (!pairs.length) pairs = commonPairs(players, level);
  const { a, b, shared } = pick(pairs, rnd);
  const answer = pick(shared, rnd);
  const own = uniq([...a.clubs, ...b.clubs]).filter((c) => !shared.includes(c));
  const bigClubs = [...idx.entries()].sort((x, y) => y[1].length - x[1].length).map(([c]) => c)
    .filter((c) => !shared.includes(c) && !a.clubs.includes(c) && !b.clubs.includes(c));
  // easy: obviously-wrong big clubs; medium/hard: clubs the two players really played for
  const pool = level === "easy" ? [...bigClubs.slice(0, 10)] : [...own, ...bigClubs.slice(0, 6)];
  const wrong = shuffle(uniq(pool), rnd).slice(0, 3);
  for (const c of shuffle(bigClubs, rnd)) if (wrong.length < 3 && !wrong.includes(c)) wrong.push(c);
  return { mode: "common", a, b, shared, options: shuffle([answer, ...wrong], rnd), answer, usedIds: [a.id, b.id] };
}

/* ───────────── Mystery club ───────────── */
const SHOWN = { easy: 4, medium: 3, hard: 2 };

export function mysteryClubs(players, level) {
  const idx = buildClubIndex(players);
  const need = SHOWN[level];
  return [...idx.entries()].filter(([, ids]) => {
    if (ids.length < need) return false;
    if (level === "hard") return ids.length <= 4;
    if (level === "medium") return ids.length >= 3 && ids.length <= 8;
    return ids.length >= 4;
  }).map(([club, ids]) => ({ club, ids }));
}

export function makeMystery(level, usedClubs, players, rnd = Math.random) {
  const idx = buildClubIndex(players);
  const byId = new Map(players.map((p) => [p.id, p]));
  let cands = mysteryClubs(players, level).filter((c) => !usedClubs.includes(c.club));
  if (!cands.length) cands = mysteryClubs(players, level);
  const { club, ids } = pick(cands, rnd);
  const shownIds = shuffle(ids, rnd).slice(0, SHOWN[level]);
  const shown = shownIds.map((id) => byId.get(id));
  // a wrong option must never fit all shown players
  const fitsAll = (c) => shown.every((p) => p.clubs.includes(c));
  const others = [...idx.keys()].filter((c) => c !== club && !fitsAll(c));
  const plausible = uniq(shown.flatMap((p) => p.clubs)).filter((c) => others.includes(c));
  const famous = others.sort((x, y) => idx.get(y).length - idx.get(x).length);
  const pool = level === "easy" ? famous.slice(0, 12) : [...plausible, ...famous.slice(0, 8)];
  const wrong = shuffle(uniq(pool), rnd).slice(0, 3);
  for (const c of shuffle(famous, rnd)) if (wrong.length < 3 && !wrong.includes(c)) wrong.push(c);
  return { mode: "mystery", shown, options: shuffle([club, ...wrong], rnd), answer: club };
}

/* ───────────── Transfer fee: higher or lower ───────────── */
const GAP = { easy: [40, Infinity], medium: [12, 40], hard: [0.01, 12] };

export function feePairs(transfers, level) {
  const [lo, hi] = GAP[level];
  const out = [];
  for (const x of transfers) {
    for (const y of transfers) {
      const gap = Math.abs(x.fee - y.fee);
      if (x.id !== y.id && gap >= lo && gap < hi) out.push({ shown: x, hidden: y });
    }
  }
  return out;
}

export function makeFee(level, usedIds, transfers, rnd = Math.random) {
  // prefer two fresh transfers, then at least a fresh hidden one, then anything
  const all = feePairs(transfers, level);
  let pairs = all.filter((p) => !usedIds.includes(p.hidden.id) && !usedIds.includes(p.shown.id));
  if (!pairs.length) pairs = all.filter((p) => !usedIds.includes(p.hidden.id));
  if (!pairs.length) pairs = all;
  const { shown, hidden } = pick(pairs, rnd);
  return { mode: "fee", shown, hidden, options: ["higher", "lower"], answer: hidden.fee > shown.fee ? "higher" : "lower", usedIds: [shown.id, hidden.id] };
}
