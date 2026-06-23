/** A person eligible for matching. */
export interface MatchPerson {
  id: string;
  gender: string; // "male" | "female" | other
  age?: number;
}

/** One 1:1 date within a round. */
export interface Pair {
  aId: string; // male
  bId: string; // female
}

/** The plan for a single round. */
export interface RoundPlan {
  round: number; // 1-based
  pairs: Pair[];
  byes: string[]; // participant ids sitting this round out
}

export interface ScheduleOptions {
  rounds: number; // desired number of rounds (e.g. 5)
  matchRule: "opposite_gender_nearest_age" | "opposite_gender_random";
  /** Seedable RNG for deterministic tests; defaults to Math.random. */
  rng?: () => number;
}

export interface ScheduleResult {
  rounds: RoundPlan[];
  maxRounds: number; // actual rounds produced (may be < requested)
  warnings: string[];
}
