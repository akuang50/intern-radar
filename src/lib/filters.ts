import type { Listing, UserStatus } from "../types";
import { isDueSoon, isExpired, isNewListing } from "./dates";

export type Filters = {
  query: string;
  dueSoon: boolean;
  hideExpired: boolean;
  workType: string;
  discipline: string;
  source: string;
  gradYear: string;
  skill: string;
  status: string;
  remote: string;
};

export const EMPTY_FILTERS: Filters = {
  query: "",
  dueSoon: false,
  hideExpired: true,
  workType: "all",
  discipline: "all",
  source: "all",
  gradYear: "all",
  skill: "all",
  status: "all",
  remote: "all",
};

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function matches(
  listing: Listing,
  filters: Filters,
  status: UserStatus,
  previousRefreshed: string | null,
): boolean {
  if (filters.hideExpired && isExpired(listing.date_due) && status !== "applied" && status !== "saved") {
    return false;
  }
  if (filters.dueSoon && !isDueSoon(listing.date_due)) return false;
  if (filters.workType !== "all" && listing.work_type !== filters.workType) return false;
  if (filters.discipline !== "all" && listing.discipline !== filters.discipline) return false;
  if (filters.source !== "all" && listing.source !== filters.source) return false;
  if (filters.remote !== "all" && listing.remote_status !== filters.remote) return false;
  if (filters.gradYear !== "all" && !listing.grad_dates_targeted.includes(filters.gradYear)) return false;
  if (filters.skill !== "all") {
    const hit = listing.skills_qualifications.some((s) => s.toLowerCase() === filters.skill.toLowerCase());
    if (!hit) return false;
  }
  if (filters.status === "new" && !isNewListing(listing.first_seen_at, previousRefreshed) && status !== "new") {
    return false;
  } else if (filters.status !== "all" && filters.status !== "new" && status !== filters.status) {
    return false;
  }
  if (filters.query.trim()) {
    const q = filters.query.trim().toLowerCase();
    const blob = [
      listing.title,
      listing.organization,
      listing.skills_qualifications.join(" "),
      listing.role_summary,
      listing.location,
    ]
      .join(" ")
      .toLowerCase();
    if (!blob.includes(q)) return false;
  }
  return true;
}

export function sortListings(listings: Listing[]): Listing[] {
  return [...listings].sort((a, b) => {
    const ad = a.date_due ? Date.parse(a.date_due) : Infinity;
    const bd = b.date_due ? Date.parse(b.date_due) : Infinity;
    if (ad !== bd) return ad - bd;
    const ap = a.date_posted ? Date.parse(a.date_posted) : 0;
    const bp = b.date_posted ? Date.parse(b.date_posted) : 0;
    return bp - ap;
  });
}
