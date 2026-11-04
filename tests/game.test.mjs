import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_ROUNDS, buildOptions, calcScore, getTier, isCorrect, pickPlayer, shuffle,
} from "../src/game.js";
import { T, LANGS } from "../src/i18n.js";

const players = JSON.parse(readFileSync(new URL("../src/data/players.json", import.meta.url), "utf8"));

test("the correct answer is always among the options, exactly once", () => {
  for (const p of players) {
    for (let i = 0; i < 5; i++) {
      const opts = buildOptions(p);
      assert.equal(opts.length, 4, p.id);
      assert.equal(new Set(opts).size, 4, p.id);
      assert.equal(opts.filter((o) => isCorrect(p, o)).length, 1, p.id);
    }
  }
});

test("shuffle keeps all elements", () => {
  const a = [1, 2, 3, 4, 5, 6];
  assert.deepEqual([...shuffle(a)].sort(), a);
});

test("a game never repeats a player", () => {
  for (let g = 0; g < 200; g++) {
    const used = [];
    for (let r = 1; r <= MAX_ROUNDS; r++) used.push(pickPlayer(r, used, players).id);
    assert.equal(new Set(used).size, MAX_ROUNDS);
  }
});

test("difficulty never drops sharply and ends hard", () => {
  for (let g = 0; g < 100; g++) {
    const used = [];
    const diffs = [];
    for (let r = 1; r <= MAX_ROUNDS; r++) {
      const p = pickPlayer(r, used, players);
      used.push(p.id);
      diffs.push(p.difficulty);
    }
    assert.equal(diffs[0], 1);
    assert.equal(diffs[MAX_ROUNDS - 1], 5);
  }
});

test("recently seen players are avoided when alternatives exist", () => {
  const avoid = players.filter((p) => p.difficulty === 1).slice(0, 3).map((p) => p.id);
  for (let i = 0; i < 100; i++) {
    assert.ok(!avoid.includes(pickPlayer(1, [], players, avoid).id));
  }
});

test("scoring: more reveals / hints = fewer points, bounded", () => {
  assert.equal(calcScore(1, 5, 0), 1500);
  assert.ok(calcScore(5, 5, 0) < calcScore(2, 5, 0));
  assert.equal(calcScore(1, 5, 2), 1300);
  assert.equal(calcScore(5, 5, 20), 50);
  assert.equal(calcScore(1, 1, 0), 1500);
});

test("max possible total reaches the top tier", () => {
  for (const lang of LANGS) {
    const tiers = T[lang].tiers;
    assert.equal(getTier(MAX_ROUNDS * 1500, tiers).title, tiers[0].title);
    assert.equal(getTier(0, tiers).title, tiers[tiers.length - 1].title);
  }
});

test("all languages define the same keys", () => {
  const keys = Object.keys(T.en).sort();
  for (const lang of LANGS) {
    assert.deepEqual(Object.keys(T[lang]).sort(), keys, lang);
    assert.equal(T[lang].tiers.length, T.en.tiers.length);
    assert.equal(T[lang].difficulty.length, 5);
  }
});
