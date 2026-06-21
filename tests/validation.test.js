/* Unit tests for the pure validation + ranking helpers.
   Run:  node tests/validation.test.js     (no dependencies) */
const assert = require("assert");
const V = require("../js/validation.js");

let passed = 0;
function test(name, fn) { fn(); passed++; console.log("  ok  " + name); }

/* ---- display name ---- */
test("name: valid", () => assert.strictEqual(V.validateName("AlpineFox").ok, true));
test("name: trims and accepts", () => {
  const r = V.validateName("  Abu_99 ");
  assert.strictEqual(r.ok, true); assert.strictEqual(r.value, "Abu_99");
});
test("name: too short", () => assert.strictEqual(V.validateName("ab").ok, false));
test("name: too long", () => assert.strictEqual(V.validateName("x".repeat(21)).ok, false));
test("name: empty", () => assert.strictEqual(V.validateName("").ok, false));
test("name: bad chars", () => assert.strictEqual(V.validateName("bad<name>").ok, false));
test("name: hyphen/underscore/space ok", () => assert.strictEqual(V.validateName("a-b c_d").ok, true));

/* ---- age group (fixed 'now' for determinism) ---- */
const NOW = new Date(2026, 5, 19);     // 2026-06-19 (month is 0-based here)
test("age: clearly adult", () => assert.strictEqual(V.ageGroup(1, 2000, NOW), "18_plus"));
test("age: teen 13-17", () => assert.strictEqual(V.ageGroup(1, 2011, NOW), "13_17"));
test("age: under 13", () => assert.strictEqual(V.ageGroup(1, 2015, NOW), "under_13"));
test("age: birthday not yet reached this year counts younger", () => {
  // born July 2013 -> on 2026-06-19 they are 12 -> under_13
  assert.strictEqual(V.ageGroup(7, 2013, NOW), "under_13");
  // born May 2013 -> already 13 -> 13_17
  assert.strictEqual(V.ageGroup(5, 2013, NOW), "13_17");
});

/* ---- birth sanity ---- */
test("birth: valid", () => assert.strictEqual(V.validBirth(6, 2000, NOW), true));
test("birth: bad month", () => assert.strictEqual(V.validBirth(13, 2000, NOW), false));
test("birth: future year", () => assert.strictEqual(V.validBirth(6, 2030, NOW), false));

/* ---- ranking tie-breaks (mirrors get_leaderboard order) ---- */
function rank(rows) { return rows.slice().sort(V.compareRuns); }
test("rank: carabiners win first", () => {
  const r = rank([
    { total_carabiners: 10, total_gear: 9, levels_completed: 5, status: "completed", completion_time_ms: 1000 },
    { total_carabiners: 20, total_gear: 0, levels_completed: 1, status: "game_over", completion_time_ms: null },
  ]);
  assert.strictEqual(r[0].total_carabiners, 20);
});
test("rank: gear breaks carabiner tie", () => {
  const r = rank([
    { total_carabiners: 20, total_gear: 1, levels_completed: 5, status: "completed", completion_time_ms: 1000 },
    { total_carabiners: 20, total_gear: 3, levels_completed: 5, status: "completed", completion_time_ms: 1000 },
  ]);
  assert.strictEqual(r[0].total_gear, 3);
});
test("rank: completed beats incomplete on equal stats", () => {
  const r = rank([
    { total_carabiners: 20, total_gear: 3, levels_completed: 5, status: "game_over", completion_time_ms: null },
    { total_carabiners: 20, total_gear: 3, levels_completed: 5, status: "completed", completion_time_ms: 99999 },
  ]);
  assert.strictEqual(r[0].status, "completed");
});
test("rank: faster time wins among completed", () => {
  const r = rank([
    { total_carabiners: 20, total_gear: 3, levels_completed: 5, status: "completed", completion_time_ms: 5000 },
    { total_carabiners: 20, total_gear: 3, levels_completed: 5, status: "completed", completion_time_ms: 3000 },
  ]);
  assert.strictEqual(r[0].completion_time_ms, 3000);
});
test("rank: earliest finish breaks full tie", () => {
  const r = rank([
    { total_carabiners: 1, total_gear: 0, levels_completed: 1, status: "completed", completion_time_ms: 1000, finished_at: "2026-06-19T10:00:00Z" },
    { total_carabiners: 1, total_gear: 0, levels_completed: 1, status: "completed", completion_time_ms: 1000, finished_at: "2026-06-19T09:00:00Z" },
  ]);
  assert.strictEqual(r[0].finished_at, "2026-06-19T09:00:00Z");
});

console.log("\nAll " + passed + " validation/ranking tests passed.");
