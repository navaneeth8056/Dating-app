/**
 * Run with:  npx tsx src/matching/buildSchedule.test.ts
 * Plain Node assertions — no test runner needed.
 */
import assert from "node:assert";
import { buildSchedule } from "./buildSchedule";
import type { MatchPerson } from "./types";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

const mk = (
  prefix: string,
  gender: string,
  ages: number[]
): MatchPerson[] =>
  ages.map((age, i) => ({ id: `${prefix}${i}`, gender, age }));

// Helpers
const allPairKeys = (res: ReturnType<typeof buildSchedule>) =>
  res.rounds.flatMap((r) => r.pairs.map((p) => `${p.aId}|${p.bId}`));

const totalAgeGap = (
  res: ReturnType<typeof buildSchedule>,
  people: MatchPerson[],
  round = 0
) => {
  const byId = new Map(people.map((p) => [p.id, p]));
  return res.rounds[round].pairs.reduce(
    (sum, p) =>
      sum + Math.abs((byId.get(p.aId)!.age ?? 0) - (byId.get(p.bId)!.age ?? 0)),
    0
  );
};

console.log("buildSchedule tests:");

test("equal 6+6 → 5 full rounds, no repeats, all opposite-gender", () => {
  const people = [
    ...mk("M", "male", [25, 27, 29, 31, 33, 35]),
    ...mk("F", "female", [24, 26, 28, 30, 32, 34]),
  ];
  const res = buildSchedule(people, {
    rounds: 5,
    matchRule: "opposite_gender_nearest_age",
  });
  assert.equal(res.maxRounds, 5);
  for (const r of res.rounds) {
    assert.equal(r.pairs.length, 6, "6 pairs each round");
    assert.equal(r.byes.length, 0, "no byes when equal");
  }
  const keys = allPairKeys(res);
  assert.equal(new Set(keys).size, keys.length, "no repeated pairs");
  // every pair is M<->F
  for (const r of res.rounds)
    for (const p of r.pairs) {
      assert.ok(p.aId.startsWith("M") && p.bId.startsWith("F"));
    }
});

test("uneven 2+4 → capped at 4 rounds, 2 pairs + 2 byes, no repeats", () => {
  const people = [
    ...mk("M", "male", [30, 40]),
    ...mk("F", "female", [22, 28, 34, 44]),
  ];
  const res = buildSchedule(people, {
    rounds: 5,
    matchRule: "opposite_gender_nearest_age",
  });
  assert.equal(res.maxRounds, 4, "capped to larger side size");
  for (const r of res.rounds) {
    assert.equal(r.pairs.length, 2);
    assert.equal(r.byes.length, 2, "2 benched each round");
  }
  const keys = allPairKeys(res);
  assert.equal(new Set(keys).size, keys.length, "no repeated pairs");
  // each male meets 4 distinct females across the event
  const maleMeets = new Map<string, Set<string>>();
  for (const r of res.rounds)
    for (const p of r.pairs) {
      if (!maleMeets.has(p.aId)) maleMeets.set(p.aId, new Set());
      maleMeets.get(p.aId)!.add(p.bId);
    }
  for (const set of maleMeets.values())
    assert.equal(set.size, 4, "each male met 4 distinct females");
});

test("tiny 1+1 → exactly 1 round, 1 pair, no byes", () => {
  const people = [...mk("M", "male", [30]), ...mk("F", "female", [29])];
  const res = buildSchedule(people, {
    rounds: 5,
    matchRule: "opposite_gender_nearest_age",
  });
  assert.equal(res.maxRounds, 1);
  assert.equal(res.rounds[0].pairs.length, 1);
  assert.equal(res.rounds[0].byes.length, 0);
});

test("nearest-age picks the minimal-gap matching", () => {
  const males = mk("M", "male", [20, 30, 40]);
  const females = mk("F", "female", [21, 31, 41]);
  const res = buildSchedule([...males, ...females], {
    rounds: 1,
    matchRule: "opposite_gender_nearest_age",
  });
  // optimal pairing is (20,21),(30,31),(40,41) → total gap 3
  assert.equal(totalAgeGap(res, [...males, ...females]), 3);
});

test("no male or no female → 0 rounds + warning", () => {
  const res = buildSchedule(mk("F", "female", [25, 26, 27]), {
    rounds: 5,
    matchRule: "opposite_gender_nearest_age",
  });
  assert.equal(res.maxRounds, 0);
  assert.ok(res.warnings.some((w) => w.includes("at least one")));
});

test("non-binary genders are benched every round with a warning", () => {
  const people = [
    ...mk("M", "male", [25, 27]),
    ...mk("F", "female", [24, 26]),
    { id: "X0", gender: "other", age: 30 },
  ];
  const res = buildSchedule(people, {
    rounds: 5,
    matchRule: "opposite_gender_nearest_age",
  });
  assert.ok(res.warnings.some((w) => w.toLowerCase().includes("other")));
  for (const r of res.rounds) assert.ok(r.byes.includes("X0"));
});

test("odd 3+3 → 3 rounds, everyone meets 3 distinct, no repeats", () => {
  const people = [
    ...mk("M", "male", [20, 25, 30]),
    ...mk("F", "female", [22, 27, 32]),
  ];
  const res = buildSchedule(people, {
    rounds: 5,
    matchRule: "opposite_gender_nearest_age",
  });
  assert.equal(res.maxRounds, 3);
  const keys = allPairKeys(res);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys.length, 9, "3 pairs x 3 rounds");
});

console.log(`\nAll ${passed} matching tests passed ✅`);
