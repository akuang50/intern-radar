import { applyHref } from "./apply";
import { isDueSoon } from "./dates";
import type { Listing } from "../types";

export function utcDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

export type DayHit = {
  listing: Listing;
  posted: boolean;
  due: boolean;
  dueSoon: boolean;
};

export function eventsOnDay(listings: Listing[], day: string): DayHit[] {
  const hits: DayHit[] = [];
  for (const listing of listings) {
    if (!applyHref(listing)) continue;
    const posted = utcDay(listing.date_posted) === day;
    const due = utcDay(listing.date_due) === day;
    if (!posted && !due) continue;
    hits.push({
      listing,
      posted,
      due,
      dueSoon: Boolean(due && isDueSoon(listing.date_due)),
    });
  }
  return hits.sort((a, b) => Number(b.dueSoon) - Number(a.dueSoon) || a.listing.title.localeCompare(b.listing.title));
}

export function monthCells(year: number, monthIndex: number): (string | null)[] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startPad = first.getUTCDay();
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    const stamp = new Date(Date.UTC(year, monthIndex, d)).toISOString().slice(0, 10);
    cells.push(stamp);
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function monthMarks(listings: Listing[], year: number, monthIndex: number) {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const marks = new Map<string, { posted: boolean; due: boolean; dueSoon: boolean }>();
  for (const listing of listings) {
    const posted = utcDay(listing.date_posted);
    const due = utcDay(listing.date_due);
    if (posted?.startsWith(prefix)) {
      const cur = marks.get(posted) || { posted: false, due: false, dueSoon: false };
      cur.posted = true;
      marks.set(posted, cur);
    }
    if (due?.startsWith(prefix)) {
      const cur = marks.get(due) || { posted: false, due: false, dueSoon: false };
      cur.due = true;
      if (isDueSoon(listing.date_due)) cur.dueSoon = true;
      marks.set(due, cur);
    }
  }
  return marks;
}
