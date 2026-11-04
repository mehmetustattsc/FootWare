// Validates src/data/players.json. Run: npm run validate
import { readFileSync } from "node:fs";

const file = new URL("../src/data/players.json", import.meta.url);
const players = JSON.parse(readFileSync(file, "utf8"));
const errors = [];
const err = (p, msg) => errors.push(`${p?.id ?? "?"}: ${msg}`);

const ids = new Set();
const names = new Set();
const counts = {};

for (const p of players) {
  if (!p.id || typeof p.id !== "string") err(p, "missing id");
  if (ids.has(p.id)) err(p, "duplicate id");
  ids.add(p.id);
  if (names.has(p.name)) err(p, "duplicate name");
  names.add(p.name);
  if (!p.name) err(p, "missing name");
  if (![1, 2, 3, 4, 5].includes(p.difficulty)) err(p, "difficulty must be 1-5");
  counts[p.difficulty] = (counts[p.difficulty] ?? 0) + 1;
  if (!/^[A-Z]{3}$/.test(p.nat ?? "")) err(p, "nat must be a 3-letter code");
  if (!p.era) err(p, "missing era");
  if (!Array.isArray(p.clubs) || p.clubs.length < 1) err(p, "needs at least 1 club");
  if (Array.isArray(p.clubs) && p.clubs.some((c) => !c || typeof c !== "string")) err(p, "empty club name");
  if (!Array.isArray(p.distractors) || p.distractors.length !== 3) err(p, "needs exactly 3 distractors");
  else {
    if (new Set(p.distractors).size !== 3) err(p, "distractors must be distinct");
    if (p.distractors.includes(p.name)) err(p, "distractor equals the answer");
  }
  for (const lang of ["tr", "en", "de", "fr"]) {
    const c = p.clues?.[lang];
    if (!Array.isArray(c) || c.length < 1) err(p, `clues.${lang} missing`);
  }
  const n = ["tr", "en", "de", "fr"].map((l) => p.clues?.[l]?.length ?? 0);
  if (new Set(n).size > 1) err(p, `clue counts differ between languages (${n.join("/")})`);
}

for (let d = 1; d <= 5; d++) {
  if ((counts[d] ?? 0) < 4) errors.push(`difficulty ${d}: only ${counts[d] ?? 0} players (need >= 4)`);
}

const transfers = JSON.parse(readFileSync(new URL("../src/data/transfers.json", import.meta.url), "utf8"));
const tids = new Set();
for (const t of transfers) {
  if (tids.has(t.id)) errors.push(`transfer ${t.id}: duplicate id`);
  tids.add(t.id);
  if (!(t.fee > 0) || !t.player || !t.from || !t.to || !(t.year >= 1990)) errors.push(`transfer ${t.id}: incomplete`);
}
if (transfers.length < 14) errors.push("need at least 14 transfers");

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n` + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log(`✓ ${transfers.length} transfers OK`);
console.log(`✓ ${players.length} players OK  (per difficulty: ${JSON.stringify(counts)})`);
