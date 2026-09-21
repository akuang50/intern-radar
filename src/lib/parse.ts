import { isApplyUrl } from "./apply";
import { detectSophomore } from "./sophomore";
import type { Listing } from "../types";

function hashId(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === "\t") {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function listingOf(partial: Partial<Listing> & { title?: string; organization?: string }): Listing | null {
  const title = String(partial.title || "").trim();
  const organization = String(partial.organization || "Unknown org").trim();
  if (!title) return null;
  const url = String(partial.apply_url || partial.source_url || "").trim();
  if (!isApplyUrl(url)) return null;
  const now = new Date().toISOString();
  const source = partial.source || "Handshake";
  const blob = `${title} ${partial.role_summary || ""}`;
  return {
    id: `manual:${hashId(`${organization}|${title}|${url}`)}`,
    title,
    organization,
    source,
    source_url: url,
    apply_url: url,
    date_posted: partial.date_posted || now,
    date_due: partial.date_due || null,
    grad_dates_targeted: partial.grad_dates_targeted || [],
    work_type: partial.work_type || "internship",
    discipline: partial.discipline || "other",
    location: partial.location || "Unspecified",
    remote_status: partial.remote_status || "unknown",
    skills_qualifications: partial.skills_qualifications || [],
    role_summary: partial.role_summary || "",
    tags: partial.tags || [],
    sophomore_eligible: partial.sophomore_eligible ?? detectSophomore(blob),
    first_seen_at: now,
    last_seen_at: now,
  };
}

function fromRecord(obj: Record<string, unknown>, fallbackSource: string): Listing | null {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const direct = obj[key];
      if (direct != null && String(direct).trim()) return String(direct).trim();
      const found = Object.keys(obj).find((k) => k.toLowerCase() === key.toLowerCase());
      if (found && obj[found] != null && String(obj[found]).trim()) return String(obj[found]).trim();
    }
    return "";
  };
  const skills = get("skills_qualifications", "skills", "qualifications");
  return listingOf({
    title: get("title", "Job Title", "Position Title", "role", "job"),
    organization: get("organization", "employer", "company", "Employer", "Company"),
    source: get("source") || fallbackSource,
    source_url: get("source_url", "url", "link", "Apply URL", "Job URL", "applyUrl"),
    date_posted: get("date_posted", "Date Posted", "posted") || null,
    date_due: get("date_due", "deadline", "Apply End", "Expiration Date", "due") || null,
    location: get("location", "Location"),
    work_type: get("work_type", "Employment Type") || "internship",
    role_summary: get("role_summary", "description", "Job Description"),
    skills_qualifications: skills
      ? skills.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
      : [],
    grad_dates_targeted: get("grad_dates_targeted", "class year", "graduation")
      ? get("grad_dates_targeted", "class year", "graduation").split(/[;,]/).map((s) => s.trim())
      : [],
  });
}

function fromFreeText(text: string, fallbackSource: string): Listing[] {
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const out: Listing[] = [];
  for (const block of blocks) {
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const title = lines[0];
    const orgLine = lines.find((l) => /^(at |org:|employer:|company:)/i.test(l));
    const organization = orgLine
      ? orgLine.replace(/^(at |org:|employer:|company:)/i, "").trim()
      : lines[1] || "Handshake";
    const url = lines.find((l) => /^https?:\/\//i.test(l)) || "";
    const dueLine = lines.find((l) => /due|deadline|apply by/i.test(l));
    const due = dueLine ? dueLine.replace(/.*?(due|deadline|apply by)\s*:?\s*/i, "") : "";
    const listing = listingOf({
      title,
      organization,
      source: fallbackSource,
      source_url: url,
      date_due: due || null,
      role_summary: lines.slice(2).filter((l) => l !== url).join(" "),
    });
    if (listing) out.push(listing);
  }
  return out;
}

export function parseImport(raw: string, fallbackSource: string): Listing[] {
  const text = raw.trim();
  if (!text) return [];

  if (text.startsWith("{") || text.startsWith("[")) {
    const json = JSON.parse(text) as unknown;
    const arr = Array.isArray(json)
      ? json
      : ((json as { listings?: unknown[]; jobs?: unknown[] }).listings ||
          (json as { jobs?: unknown[] }).jobs ||
          []);
    return (arr as Record<string, unknown>[])
      .map((row) => fromRecord(row, fallbackSource))
      .filter((x): x is Listing => Boolean(x));
  }

  const first = text.split(/\n/)[0] || "";
  if (first.includes(",") && /title|employer|company|job/i.test(first)) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const headers = splitCsvLine(lines[0]);
    return lines.slice(1).flatMap((line) => {
      const cols = splitCsvLine(line);
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        obj[h] = cols[i];
      });
      const listing = fromRecord(obj, fallbackSource);
      return listing ? [listing] : [];
    });
  }

  return fromFreeText(text, fallbackSource);
}
