import { applyHref } from "./apply";
import { dueLabel, formatDate } from "./dates";
import { rankListing, type Ranked } from "./rank";
import { sophomoreLabel } from "./sophomore";
import type { Listing, Profile } from "../types";

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  picks?: Ranked[];
};

function parseIntent(query: string, profile: Profile): Profile {
  const q = query.toLowerCase();
  const next: Profile = { ...profile };
  if (/\bsophomore|rising junior|class of 2028|’28|'28\b/.test(q)) next.sophomore = true;
  if (/\b(course\s*6|6-?3|eecs|cs\b|computer science|software|swe)\b/.test(q)) next.discipline = "swe";
  if (/\b(quant|trading)\b/.test(q)) next.discipline = "quant";
  if (/\b(hardware|ee\b|course\s*6-2)\b/.test(q)) next.discipline = "hardware";
  if (/\b(gtl|teaching lab|teach)\b/.test(q)) next.discipline = "teaching";
  if (/\b(iap|global classroom)\b/.test(q)) next.workType = "iap";
  if (/\bintern/.test(q)) next.workType = "internship";
  if (/\bremote\b/.test(q)) next.remote = "remote";
  if (/\b2028\b/.test(q)) next.gradYear = "2028";
  const skillHits = ["python", "react", "java", "c++", "ml", "machine learning", "typescript", "rust", "go"].filter((s) =>
    q.includes(s),
  );
  if (skillHits.length) next.skills = [...new Set([...next.skills.split(/[,;]/).map((s) => s.trim()), ...skillHits])].filter(Boolean).join(", ");
  return next;
}

function extraQueryBoost(listing: Listing, query: string): number {
  const q = query.toLowerCase();
  const blob = `${listing.title} ${listing.organization} ${listing.role_summary} ${listing.tags.join(" ")}`.toLowerCase();
  let n = 0;
  for (const word of q.split(/[^a-z0-9+#]+/).filter((w) => w.length > 2)) {
    if (blob.includes(word)) n += 3;
  }
  if (/\bno (prior|previous) intern/.test(q) && (sophomoreLabel(listing) || /no (prior|previous) intern/i.test(blob))) n += 16;
  if (/\bgtl|teaching\b/.test(q) && listing.tags.includes("teaching")) n += 20;
  if (/\bglobal classroom|iap\b/.test(q) && (listing.tags.includes("iap") || listing.work_type === "iap")) n += 20;
  if (/\bswe|software\b/.test(q) && listing.discipline === "swe") n += 10;
  return n;
}

export function answerQuery(query: string, listings: Listing[], profile: Profile): { text: string; picks: Ranked[] } {
  const intent = parseIntent(query, profile);
  const eligible = listings.filter((l) => applyHref(l));
  const ranked = eligible
    .map((listing) => {
      const base = rankListing(listing, intent);
      return { ...base, score: base.score + extraQueryBoost(listing, query) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (!ranked.length) {
    return {
      text: "I couldn’t find a public posting that matches. Try pasting a Handshake export, or loosen skills / sophomore.",
      picks: [],
    };
  }

  const lines = ranked.map((p, i) => {
    const href = applyHref(p.listing);
    const due = p.listing.date_due ? dueLabel(p.listing.date_due) : "deadline not posted";
    const why = p.reasons.length ? p.reasons.join("; ") : "Keyword match";
    return `${i + 1}. ${p.listing.title} · ${p.listing.organization} — ${due}. ${why}. Apply: ${href}`;
  });

  return {
    text: `Here’s a shortlist from the local radar (no login scrape). Posted ${formatDate(ranked[0].listing.date_posted)} is the freshest in this set.\n\n${lines.join("\n")}`,
    picks: ranked,
  };
}
