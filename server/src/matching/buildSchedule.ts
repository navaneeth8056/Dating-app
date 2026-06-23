import { hungarian } from "./hungarian";
import type {
  MatchPerson,
  RoundPlan,
  ScheduleOptions,
  ScheduleResult,
  Pair,
} from "./types";

// Cost sentinels: realPair << BYE_COST << FORBIDDEN.
const BYE_COST = 100_000; // prefer real pairings over benching
const FORBIDDEN = 1_000_000_000; // never reuse a past pair / same-gender

const pairKey = (a: string, b: string) => `${a}|${b}`;

/**
 * Builds a full multi-round speed-dating schedule.
 *
 * Rules:
 *  - Only male<->female pairs (others are benched with a warning).
 *  - Each round is a min-cost matching minimizing total age gap
 *    (random tie-breaks); "opposite_gender_random" ignores age.
 *  - No pair repeats across rounds.
 *  - Uneven counts → byes, rotated as fairly as the matcher allows.
 *  - Rounds auto-capped when there aren't enough distinct partners.
 */
export function buildSchedule(
  people: MatchPerson[],
  options: ScheduleOptions
): ScheduleResult {
  const rng = options.rng ?? Math.random;
  const warnings: string[] = [];

  const males = people.filter((p) => p.gender === "male");
  const females = people.filter((p) => p.gender === "female");
  const others = people.filter(
    (p) => p.gender !== "male" && p.gender !== "female"
  );

  if (others.length > 0) {
    warnings.push(
      `${others.length} participant(s) have a gender other than male/female and can't be matched in opposite-gender mode; they will sit out.`
    );
  }

  const m = males.length;
  const f = females.length;

  if (m === 0 || f === 0) {
    warnings.push(
      "Need at least one male and one female to create any pairings."
    );
    return { rounds: [], maxRounds: 0, warnings };
  }

  const n = Math.max(m, f);
  // Distinct-partner ceiling for the smaller side is the larger side's size.
  const maxRounds = Math.min(options.rounds, n);

  const usePairs = options.matchRule === "opposite_gender_nearest_age";
  const used = new Set<string>(); // "maleId|femaleId" already dated
  const rounds: RoundPlan[] = [];

  for (let r = 0; r < maxRounds; r++) {
    // Build an n x n cost matrix: rows = males(+dummies), cols = females(+dummies).
    const cost: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      const male = i < m ? males[i] : null;
      for (let j = 0; j < n; j++) {
        const female = j < f ? females[j] : null;

        if (male && female) {
          if (used.has(pairKey(male.id, female.id))) {
            row.push(FORBIDDEN);
          } else {
            const jitter = rng(); // 0..1 random tie-break
            if (usePairs && male.age != null && female.age != null) {
              row.push(Math.abs(male.age - female.age) + jitter);
            } else {
              row.push(jitter);
            }
          }
        } else {
          // any pairing involving a dummy = a bye
          row.push(BYE_COST);
        }
      }
      cost.push(row);
    }

    const assignment = hungarian(cost);

    const pairs: Pair[] = [];
    const byeSet = new Set<string>();

    for (let i = 0; i < n; i++) {
      const j = assignment[i];
      const male = i < m ? males[i] : null;
      const female = j >= 0 && j < f ? females[j] : null;

      if (male && female && cost[i][j] < BYE_COST) {
        pairs.push({ aId: male.id, bId: female.id });
        used.add(pairKey(male.id, female.id));
      } else if (male) {
        byeSet.add(male.id);
      }
    }

    // Any female not used in a pair this round is also a bye.
    const pairedFemales = new Set(pairs.map((p) => p.bId));
    for (const female of females) {
      if (!pairedFemales.has(female.id)) byeSet.add(female.id);
    }

    // Benched "other" genders sit out every round.
    for (const o of others) byeSet.add(o.id);

    rounds.push({ round: r + 1, pairs, byes: [...byeSet] });
  }

  return { rounds, maxRounds: rounds.length, warnings };
}
