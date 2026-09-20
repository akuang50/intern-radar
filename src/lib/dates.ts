export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

export function isDueSoon(iso: string | null): boolean {
  const d = daysUntil(iso);
  return d !== null && d >= 0 && d <= 7;
}

export function isExpired(iso: string | null): boolean {
  const d = daysUntil(iso);
  return d !== null && d < 0;
}

export function isNewListing(firstSeen: string, previousRefreshed: string | null): boolean {
  const first = Date.parse(firstSeen);
  if (Number.isNaN(first)) return false;
  if (!previousRefreshed) return Date.now() - first < 36 * 3600000;
  const prev = Date.parse(previousRefreshed);
  if (Number.isNaN(prev)) return Date.now() - first < 36 * 3600000;
  return first > prev;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(t);
}

export function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(t);
}

export function dueLabel(iso: string | null): string {
  const d = daysUntil(iso);
  if (d === null) return "No due date";
  if (d < 0) return "Closed";
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  if (d <= 7) return `${d} days left`;
  return formatDate(iso);
}
