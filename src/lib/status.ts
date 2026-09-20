import type { UserStatus } from "../types";

const KEY = "intern-radar:status";
const MANUAL_KEY = "intern-radar:manual";

export function loadStatusMap(): Record<string, UserStatus> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, UserStatus>) : {};
  } catch {
    return {};
  }
}

export function saveStatusMap(map: Record<string, UserStatus>) {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function loadManualListings<T>(): T[] {
  try {
    const raw = localStorage.getItem(MANUAL_KEY);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function saveManualListings<T>(listings: T[]) {
  localStorage.setItem(MANUAL_KEY, JSON.stringify(listings));
}
