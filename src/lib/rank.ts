import { applyHref } from "./apply";
import { daysUntil, isDueSoon } from "./dates";
import { sophomoreLabel } from "./sophomore";
import type { Listing, Profile } from "../types";

export const EMPTY_PROFILE: Profile = {
  gradYear: "",
  skills: "",
  workType: "all",
  discipline: "swe",
  location: "",
  remote: "all",
  sophomore: false,
};

const PROFILE_KEY = "intern-radar:profile";

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Profile) } : { ...EMPTY_PROFILE };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function saveProfile(profile: Profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function skillList(profile: Profile): string[] {
  return profile.skills
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export type Ranked = {
  listing: Listing;
  score: number;
  reasons: string[];
};

export function rankListing(listing: Listing, profile: Profile): Ranked {
  let score = 0;
  const reasons: string[] = [];
  const skills = skillList(profile);
  const blob = `${listing.title} ${listing.organization} ${listing.role_summary} ${listing.skills_qualifications.join(" ")} ${listing.tags.join(" ")}`.toLowerCase();

  if (listing.discipline === "swe" || /\b(software|swe|sde|engineer intern)\b/i.test(listing.title)) {
    score += profile.discipline === "swe" || !profile.discipline || profile.discipline === "all" ? 18 : 8;
    if (profile.discipline === "swe") reasons.push("SWE role");
  }
  if (profile.discipline && profile.discipline !== "all" && listing.discipline === profile.discipline) {
    score += 16;
    reasons.push(`Matches ${profile.discipline}`);
  }
  if (profile.workType && profile.workType !== "all" && listing.work_type === profile.workType) {
    score += 12;
    reasons.push(`Matches ${profile.workType}`);
  }

  const matched = skills.filter((s) => blob.includes(s) || listing.skills_qualifications.some((k) => k.toLowerCase().includes(s)));
  if (matched.length) {
    score += Math.min(24, matched.length * 8);
    reasons.push(`Matched ${matched.slice(0, 4).join(", ")}`);
  }

  if (profile.sophomore && sophomoreLabel(listing)) {
    score += 22;
    reasons.push("Sophomore-eligible");
  } else if (sophomoreLabel(listing) && (profile.gradYear === "2028" || profile.gradYear === "2029")) {
    score += 18;
    reasons.push("Sophomore-eligible");
  }

  if (profile.gradYear && listing.grad_dates_targeted.includes(profile.gradYear)) {
    score += 14;
    reasons.push(`Targets ${profile.gradYear}`);
  }

  if (profile.remote && profile.remote !== "all" && listing.remote_status === profile.remote) {
    score += 8;
    reasons.push(profile.remote);
  }
  if (profile.location.trim()) {
    const loc = profile.location.trim().toLowerCase();
    if (listing.location.toLowerCase().includes(loc)) {
      score += 10;
      reasons.push(`Near ${profile.location.trim()}`);
    }
  }

  if (isDueSoon(listing.date_due)) {
    score += 14;
    const d = daysUntil(listing.date_due);
    reasons.push(d === 0 ? "Due today" : `Due in ${d} day${d === 1 ? "" : "s"}`);
  }

  if (!applyHref(listing)) score -= 40;

  return { listing, score, reasons: reasons.slice(0, 4) };
}

export function sortByRelevance(listings: Listing[], profile: Profile): Ranked[] {
  return listings
    .map((l) => rankListing(l, profile))
    .sort((a, b) => b.score - a.score || (Date.parse(a.listing.date_due || "") || Infinity) - (Date.parse(b.listing.date_due || "") || Infinity));
}
