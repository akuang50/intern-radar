const BAD_HOSTS = /example\.invalid$|localhost$|^joinhandshake\.com$/i;

export function isApplyUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (!u.hostname.includes(".")) return false;
    if (BAD_HOSTS.test(u.hostname)) return false;
    if (/joinhandshake\.com$/i.test(u.hostname) && (u.pathname === "/" || u.pathname === "")) return false;
    return true;
  } catch {
    return false;
  }
}

export function applyHref(listing: { apply_url?: string; source_url?: string }): string | null {
  if (isApplyUrl(listing.apply_url)) return listing.apply_url as string;
  if (isApplyUrl(listing.source_url)) return listing.source_url as string;
  return null;
}
