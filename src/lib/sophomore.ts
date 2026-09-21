const SOPH_RE =
  /\b(sophomores?\s+welcome|rising juniors?|class of 2028|graduating 2028|graduation year 2028|all class years|all years welcome|open to all (class )?years|underclassm[ae]n|first[-\s]?years? (and|&|or) sophomores?|freshm[ae]n and sophomores?|no (prior|previous) internships? required|does not require (a |prior |previous )?internship)\b/i;

const SENIOR_ONLY_RE =
  /\b(seniors? only|rising seniors? only|final[- ]year only|class of 2026 only|graduating 2026 only|must be (a )?senior)\b/i;

export function detectSophomore(text: string): boolean {
  if (SENIOR_ONLY_RE.test(text)) return false;
  if (SOPH_RE.test(text)) return true;
  if (/\bclass of 2028\b/.test(text)) return true;
  if (/\b(all undergraduates?|any class year|undergraduate students of any year)\b/i.test(text)) return true;
  return false;
}

export function sophomoreLabel(listing: { sophomore_eligible?: boolean; tags?: string[] }): boolean {
  return Boolean(listing.sophomore_eligible || listing.tags?.includes("sophomore-eligible"));
}
