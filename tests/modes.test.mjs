import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LEVELS, LEVEL_CFG, MAX_ROUNDS, applyLevel, getTierByShare } from "../src/game.js";
import { commonPairs, feePairs, makeCommon, makeFee, makeMystery, makeWhoAmI, mysteryClubs } from "../src/modes.js";
import { T } from "../src/i18n.js";

const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url), "utf8"));
const players = load("players.json");
const transfers = load("transfers.json");

test("every level has enough material for a 7-round game in every mode", () => {
  for (const level of LEVELS) {
    assert.ok(commonPairs(players, level).length >= 40, `common ${level}`);
    assert.ok(mysteryClubs(players, level).length >= MAX_ROUNDS, `mystery ${level}`);
    assert.ok(feePairs(transfers, level).length >= 20, `fee ${level}`);
  }
});

test("common club: exactly the right options, answer always shared, wrong never shared", () => {
  for (const level of LEVELS) {
    for (let g = 0; g < 150; g++) {
      const q = makeCommon(level, [], players);
      assert.equal(new Set(q.options).size, 4);
      assert.ok(q.shared.includes(q.answer));
      for (const o of q.options) {
        const both = q.a.clubs.includes(o) && q.b.clubs.includes(o);
        assert.equal(both, o === q.answer || q.shared.includes(o), `${q.a.id}/${q.b.id}/${o}`);
        if (o !== q.answer) assert.ok(!both, `ambiguous option ${o}`);
      }
    }
  }
});

test("mystery club: answer fits all shown players, no wrong option does", () => {
  for (const level of LEVELS) {
    for (let g = 0; g < 150; g++) {
      const q = makeMystery(level, [], players);
      assert.equal(new Set(q.options).size, 4);
      assert.ok(q.shown.every((p) => p.clubs.includes(q.answer)));
      for (const o of q.options) if (o !== q.answer) assert.ok(!q.shown.every((p) => p.clubs.includes(o)), `ambiguous ${o}`);
    }
  }
});

test("a full game never repeats a club / pair / player", () => {
  for (const level of LEVELS) {
    for (let g = 0; g < 60; g++) {
      let used = [], clubs = [], fees = [], hidden = [];
      for (let r = 1; r <= MAX_ROUNDS; r++) {
        const w = makeWhoAmI(r, level, used, players, []);
        used.push(w.player.id);
        assert.ok(w.options.includes(w.answer));
      }
      used = [];
      for (let r = 1; r <= MAX_ROUNDS; r++) {
        const c = makeCommon(level, used, players);
        used.push(...c.usedIds);
      }
      assert.equal(new Set(used).size, used.length, `common repeat ${level}`);
      for (let r = 1; r <= MAX_ROUNDS; r++) {
        const m = makeMystery(level, clubs, players);
        clubs.push(m.answer);
      }
      assert.equal(new Set(clubs).size, MAX_ROUNDS, `mystery repeat ${level}`);
      for (let r = 1; r <= MAX_ROUNDS; r++) {
        const f = makeFee(level, fees, transfers);
        fees.push(...f.usedIds);
        hidden.push(f.hidden.id);
      }
      assert.equal(new Set(hidden).size, hidden.length, `fee repeat ${level}`);
    }
  }
});

test("fee: answer matches the data, no ties, gap grows harder by level", () => {
  const gaps = {};
  for (const level of LEVELS) {
    const gs = [];
    for (let g = 0; g < 200; g++) {
      const q = makeFee(level, [], transfers);
      assert.notEqual(q.shown.fee, q.hidden.fee);
      assert.equal(q.answer, q.hidden.fee > q.shown.fee ? "higher" : "lower");
      gs.push(Math.abs(q.shown.fee - q.hidden.fee));
    }
    gaps[level] = gs.reduce((a, b) => a + b) / gs.length;
  }
  assert.ok(gaps.easy > gaps.medium && gaps.medium > gaps.hard, JSON.stringify(gaps));
});

test("levels: harder = higher multiplier and tougher players", () => {
  assert.ok(LEVEL_CFG.easy.mult < LEVEL_CFG.medium.mult && LEVEL_CFG.medium.mult < LEVEL_CFG.hard.mult);
  assert.equal(applyLevel(1000, "hard"), 1300);
  const avg = (lvl) => LEVEL_CFG[lvl].seq.reduce((a, b) => a + b) / MAX_ROUNDS;
  assert.ok(avg("easy") < avg("medium") && avg("medium") < avg("hard"));
});

test("tier depends on the share of the level's maximum", () => {
  const tiers = T.en.tiers;
  for (const level of LEVELS) {
    const max = MAX_ROUNDS * 1500 * LEVEL_CFG[level].mult;
    assert.equal(getTierByShare(max, level, tiers).title, tiers[0].title);
    assert.equal(getTierByShare(0, level, tiers).title, tiers[tiers.length - 1].title);
  }
});

test("transfers data is sane", () => {
  const ids = new Set();
  for (const t of transfers) {
    assert.ok(!ids.has(t.id)); ids.add(t.id);
    assert.ok(t.fee > 0 && t.year >= 1990 && t.player && t.from && t.to);
  }
});
