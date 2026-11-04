// Pure game logic – no React, no JSON import, so it can be unit-tested with plain Node.

export const MAX_ROUNDS = 7;
// Target difficulty (1 easy … 5 legendary) for each round.
export const DIFF_SEQUENCE = [1, 2, 2, 3, 3, 4, 5];
export const MAX_ROUND_SCORE = 1500;

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The correct answer is always player.name; wrong answers come from player.distractors. */
export function buildOptions(player, rnd = Math.random) {
  return shuffle([player.name, ...player.distractors], rnd);
}

export function isCorrect(player, option) {
  return option === player.name;
}

/**
 * Pick the player for a round.
 *  - never returns a player already used in this game (while any is left)
 *  - prefers the round's target difficulty, then the nearest difficulty
 *  - prefers players not seen in the last few games (`avoid`)
 */
export function pickPlayer(roundNum, usedIds, pool, avoid = [], rnd = Math.random) {
  const target = DIFF_SEQUENCE[roundNum - 1] ?? 3;
  const unused = pool.filter((p) => !usedIds.includes(p.id));
  const source = unused.length ? unused : pool;

  const fresh = source.filter((p) => !avoid.includes(p.id));
  const candidates = fresh.length ? fresh : source;

  const dist = (p) => Math.abs(p.difficulty - target);
  const best = Math.min(...candidates.map(dist));
  const tier = candidates.filter((p) => dist(p) === best);
  return tier[Math.floor(rnd() * tier.length)];
}

/**
 * Fewer clubs revealed and fewer hints used = more points.
 * Uses (shown-1)/(total-1) so one-club players are not punished for having only one club.
 */
export function calcScore(clubsShown, totalClubs, hintsUsed) {
  const frac = totalClubs <= 1 ? 0 : (clubsShown - 1) / (totalClubs - 1);
  const base = frac <= 0.2 ? 1500 : frac <= 0.5 ? 1000 : frac <= 0.8 ? 600 : 300;
  return Math.max(50, base - hintsUsed * 100);
}

export function getTier(score, tiers) {
  return tiers.find((t) => score >= t.min) ?? tiers[tiers.length - 1];
}
