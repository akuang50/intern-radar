#!/usr/bin/env node
/**
 * Twice-daily ingest for Intern Radar.
 * Public ATS JSON + public MIT pages + committed Handshake/MISTI uploads.
 * Never logs into Handshake or other gated portals.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_OUT = join(ROOT, "public", "data");
const UPLOADS = join(ROOT, "data", "uploads");
const SOURCES_PATH = join(ROOT, "data", "sources.json");
const UA =
  "intern-radar/0.1 (+https://github.com/akuang50/intern-radar; MIT student internship aggregator)";

const TITLE_RE =
  /\b(intern(?:ship)?s?|co-?ops?|new\s*grads?|university\s*grads?|early\s*career|undergrad(?:uate)?s?|summer\s*analyst|research\s*assistant|\breu\b|\burop\b|\bmisti\b)\b/i;
const EXCLUDE_RE =
  /\b(recruiter|recruiting|senior staff|staff software|principal|director|manager of|head of)\b/i;
const SKILL_WORDS = [
  "python",
  "javascript",
  "typescript",
  "react",
  "node",
  "java",
  "c++",
  "c#",
  "rust",
  "go",
  "golang",
  "sql",
  "pytorch",
  "tensorflow",
  "machine learning",
  "deep learning",
  "nlp",
  "llm",
  "cuda",
  "fpga",
  "verilog",
  "vhdl",
  "matlab",
  "cadence",
  "solidworks",
  "ros",
  "embedded",
  "firmware",
  "hardware",
  "circuit",
  "pcb",
  "systems",
  "distributed",
  "backend",
  "frontend",
  "full-stack",
  "fullstack",
  "ios",
  "android",
  "swift",
  "kotlin",
  "aws",
  "gcp",
  "azure",
  "kubernetes",
  "docker",
  "security",
  "cryptography",
  "policy",
  "economics",
  "statistics",
  "r ",
  "stata",
  "gis",
  "cad",
  "mechanical",
  "electrical",
  "aerospace",
  "biology",
  "chemistry",
  "physics",
  "quantum",
];

const MISTI_FALLBACK = [
  ["MIT-Africa", "January 15"],
  ["MIT-Arab World", "December 1"],
  ["MIT-Australia & NZ", "December 1"],
  ["MIT-Belgium", "December 1"],
  ["MIT-Brazil", "Closed"],
  ["MIT-Chile", "March 15"],
  ["MIT-China, Hong Kong, and Taiwan", "December 1"],
  ["MIT-Denmark, Sweden, Norway", "January 1"],
  ["MIT-Eurasia", "December 1"],
  ["MIT-France", "December 1"],
  ["MIT-Germany", "December 1"],
  ["MIT-India, Nepal, Bhutan", "February 15"],
  ["MIT-Israel", "Closed"],
  ["MIT-Italy", "January 15"],
  ["MIT-Japan", "November 1"],
  ["MIT-Korea", "December 1"],
  ["MIT-MEET", "Closed"],
  ["MIT-Mexico", "December 1"],
  ["MIT-Netherlands", "December 1"],
  ["MIT-Portugal", "December 1"],
  ["MIT-Singapore", "December 1"],
  ["MIT-Spain", "December 1"],
  ["MIT-Switzerland", "November 15"],
  ["MIT-Ukraine", "January 15"],
  ["MIT-UK", "December 1"],
];

function hashId(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function nowIso() {
  return new Date().toISOString();
}

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref", "gh_src"].forEach((k) =>
      u.searchParams.delete(k),
    );
    return u.toString();
  } catch {
    return String(url || "").split("#")[0];
  }
}

function dedupKey(listing) {
  return [normalize(listing.organization), normalize(listing.title), canonicalUrl(listing.source_url)].join(
    "|",
  );
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripHtml(s) {
  let t = decodeEntities(decodeEntities(s || ""));
  t = t.replace(/<script[\s\S]*?<\/script>/gi, " ");
  t = t.replace(/<style[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function firstSentences(text, max = 280) {
  const t = stripHtml(text).replace(/^[\s\W]+/, "");
  if (!t) return "";
  const parts = t.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  return parts.length > max ? parts.slice(0, max - 1).trim() + "…" : parts;
}

function looksIntern(title, extra = "") {
  if (EXCLUDE_RE.test(title)) return false;
  if (TITLE_RE.test(title)) return true;
  return /\b(intern(?:ship)?s?|co-?ops?|new\s*grads?)\b/i.test(extra);
}

function isApplyUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (!u.hostname.includes(".")) return false;
    if (/example\.invalid$|localhost$/i.test(u.hostname)) return false;
    if (/joinhandshake\.com$/i.test(u.hostname) && (u.pathname === "/" || u.pathname === "")) return false;
    return true;
  } catch {
    return false;
  }
}

function detectSophomore(text) {
  const t = String(text || "");
  if (/\b(seniors? only|rising seniors? only|final[- ]year only)\b/i.test(t)) return false;
  return /\b(sophomores?\s+welcome|rising juniors?|class of 2028|graduating 2028|all class years|all years welcome|open to all (class )?years|underclassm[ae]n|first[-\s]?years? (and|&|or) sophomores?|no (prior|previous) internships? required|all undergraduates?|any class year)\b/i.test(
    t,
  );
}

function disciplineOf(title, text) {
  const t = `${title} ${text}`.toLowerCase();
  if (/\b(global teaching|gtl|teaching lab)\b/.test(t)) return "teaching";
  if (/\b(global classroom|\biap\b)\b/.test(t) && /\bmisti\b/.test(t)) return "misti";
  if (/\bmisti\b/.test(t)) return "misti";
  if (/\b(software|swe\b|sde\b|developer intern|frontend|backend|fullstack|full-stack|ml intern|machine learning intern|data intern|security intern|computer science|site reliability|sre intern|engineer intern|engineering intern)\b/.test(t))
    return "swe";
  if (/\b(quant|quantitative|trading intern|summer analyst)\b/.test(t)) return "quant";
  if (/\b(hardware|electrical engineer|mechanical engineer|firmware|fpga|asic|silicon intern|robotics intern|aerospace intern)\b/.test(t))
    return "hardware";
  if (/\b(public policy|policy intern|geopolitics|international affairs)\b/.test(t)) return "policy";
  if (/\b(research|reu|urop|phd intern|scientist intern)\b/.test(t)) return "research";
  return "other";
}

function workTypeOf(title, extra = "") {
  const t = `${title} ${extra}`.toLowerCase();
  if (/\b(global teaching|gtl)\b/.test(t)) return "teaching";
  if (/\b(global classroom|\biap\b)\b/.test(t)) return "iap";
  if (/\bco-?op\b/.test(t)) return "co-op";
  if (/\bresearch\b/.test(t) && !/\bintern/.test(t)) return "research";
  if (/\bpart[-\s]?time\b/.test(t)) return "part-time";
  if (/\bnew\s*grad|university\s*grad|campus hire\b/.test(t)) return "new-grad";
  return "internship";
}

function remoteOf(location, extra = "") {
  const t = `${location} ${extra}`.toLowerCase();
  if (/\bremote\b/.test(t) && /\bhybrid\b/.test(t)) return "hybrid";
  if (/\bremote\b/.test(t)) return "remote";
  if (/\bhybrid\b/.test(t)) return "hybrid";
  if (location && location.trim()) return "onsite";
  return "unknown";
}

function extractSkills(text) {
  const lower = ` ${text.toLowerCase()} `;
  const found = [];
  for (const skill of SKILL_WORDS) {
    if (lower.includes(skill)) found.push(skill.trim());
  }
  return [...new Set(found)].slice(0, 8);
}

function extractGradYears(text) {
  const years = new Set();
  const body = String(text || "");
  for (const m of body.matchAll(/\b(20[2-3]\d)\b/g)) {
    const y = Number(m[1]);
    if (y >= 2026 && y <= 2032) years.add(String(y));
  }
  for (const m of body.matchAll(/\b(class of|graduating|graduate in|graduation)\D{0,8}(20[2-3]\d)/gi)) {
    years.add(m[2]);
  }
  return [...years].sort();
}

function parseFlexibleDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString();
  const s = String(raw).trim();
  if (!s || /^closed$/i.test(s)) return null;
  const m = s.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?/i,
  );
  if (m) {
    const year = m[3] ? Number(m[3]) : inferYear(m[1], Number(m[2]));
    if (year < 2020) return null;
    const d = new Date(Date.UTC(year, monthIndex(m[1]), Number(m[2])));
    return d.toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s) || /20\d{2}/.test(s)) {
    const iso = Date.parse(s);
    if (!Number.isNaN(iso)) return new Date(iso).toISOString();
  }
  return null;
}

function monthIndex(name) {
  return [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].indexOf(name.toLowerCase());
}

function inferYear(monthName, day) {
  const now = new Date();
  const month = monthIndex(monthName);
  const candidate = new Date(Date.UTC(now.getUTCFullYear(), month, day));
  if (candidate.getTime() + 86400000 * 3 < now.getTime()) return now.getUTCFullYear() + 1;
  return now.getUTCFullYear();
}

function extractDue(text, explicit) {
  const body = String(text || "");
  const m = body.match(
    /\b(deadline|apply by|applications? due|application closes|closes? on|closing date)[:\s]+(.{0,48}?)(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*20\d{2})?)/i,
  );
  if (m) return parseFlexibleDate(m[3]);
  if (!explicit) return null;
  const published = parseFlexibleDate(explicit);
  if (!published) return null;
  if (!body) return published;
  const needle = String(explicit).replace(/,.*/, "").toLowerCase();
  if (needle && body.toLowerCase().includes(needle.slice(0, 12))) return published;
  return published;
}

function makeListing(partial, now) {
  const title = String(partial.title || "").trim();
  const organization = String(partial.organization || "").trim();
  const apply_url = canonicalUrl(partial.apply_url || partial.source_url || "");
  const source_url = canonicalUrl(partial.source_url || apply_url);
  if (!isApplyUrl(apply_url) && !isApplyUrl(source_url)) return null;
  const href = isApplyUrl(apply_url) ? apply_url : source_url;
  const location = String(partial.location || "").trim() || "Unspecified";
  const blob = `${title} ${partial.role_summary || ""} ${partial.raw || ""}`;
  const tags = new Set(partial.tags || []);
  const discipline = partial.discipline || disciplineOf(title, blob);
  tags.add(discipline);
  if (partial.work_type) tags.add(partial.work_type);
  const sophomore_eligible = partial.sophomore_eligible ?? detectSophomore(blob);
  if (sophomore_eligible) tags.add("sophomore-eligible");
  const explicitDue = Object.prototype.hasOwnProperty.call(partial, "date_due");
  return {
    id: `${partial.source}:${hashId(`${organization}|${title}|${href}`)}`,
    title,
    organization,
    source: partial.source,
    source_url: isApplyUrl(source_url) ? source_url : href,
    apply_url: href,
    date_posted: parseFlexibleDate(partial.date_posted) || null,
    date_due: explicitDue && partial.date_due == null ? null : extractDue(blob, partial.date_due),
    grad_dates_targeted: partial.grad_dates_targeted || extractGradYears(blob),
    work_type: partial.work_type || workTypeOf(title, blob),
    discipline,
    location,
    remote_status: partial.remote_status || remoteOf(location, blob),
    skills_qualifications: partial.skills_qualifications || extractSkills(blob),
    role_summary: partial.role_summary || firstSentences(partial.raw || title),
    tags: [...tags],
    sophomore_eligible,
    first_seen_at: partial.first_seen_at || now,
    last_seen_at: now,
  };
}

async function fetchText(url, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "application/json, text/html;q=0.8, */*;q=0.5" },
    });
    const text = await r.text();
    return { ok: r.ok, status: r.status, text };
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson(url, ms) {
  const res = await fetchText(url, ms);
  if (!res.ok) return { ...res, json: null };
  try {
    return { ...res, json: JSON.parse(res.text) };
  } catch (err) {
    return { ok: false, status: res.status, text: res.text, json: null, error: err.message };
  }
}

async function mapPool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => worker()));
  return out;
}

async function greenhouseBoard(board, now) {
  const listUrl = `https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs`;
  const res = await fetchJson(listUrl);
  if (!res.ok || !res.json) {
    return {
      report: { id: `greenhouse:${board.token}`, ok: false, count: 0, error: `HTTP ${res.status}` },
      listings: [],
    };
  }
  const jobs = res.json.jobs || [];
  const matches = jobs.filter((j) => {
    const emp = Array.isArray(j.metadata)
      ? j.metadata
          .filter((m) => /employ|commitment|university|student|intern/i.test(String(m.name || "")))
          .map((m) => String(m.value || ""))
          .join(" ")
      : "";
    return looksIntern(j.title || "", emp);
  });
  const detailed = [];
  if (matches.length && matches.length <= 40 && jobs.length <= 250) {
    const withContent = await fetchJson(`${listUrl}?content=true`, 20000);
    const byId = new Map((withContent.json?.jobs || []).map((j) => [j.id, j]));
    for (const j of matches) detailed.push(byId.get(j.id) || j);
  } else {
    await mapPool(matches.slice(0, 50), 4, async (j) => {
      const one = await fetchJson(`${listUrl}/${j.id}`);
      detailed.push(one.json || j);
    });
  }
  const listings = detailed
    .filter(Boolean)
    .map((j) => {
      const html = decodeEntities(j.content || "");
      const loc = j.location?.name || (j.offices || []).map((o) => o.name).filter(Boolean).join("; ");
      return makeListing(
        {
          title: j.title,
          organization: j.company_name || board.name,
          source: "Greenhouse",
          source_url: j.absolute_url,
          apply_url: j.absolute_url,
          date_posted: j.first_published || j.updated_at,
          date_due: j.application_deadline,
          location: loc,
          raw: `${j.title} ${stripHtml(html)}`,
          role_summary: firstSentences(html),
        },
        now,
      );
    })
    .filter(Boolean);
  return {
    report: { id: `greenhouse:${board.token}`, ok: true, count: listings.length, error: null },
    listings,
  };
}

async function leverBoard(board, now) {
  const url = `https://api.lever.co/v0/postings/${board.token}?mode=json`;
  let res = await fetchJson(url, 40000);
  if (res.status === 404) {
    res = await fetchJson(`https://api.eu.lever.co/v0/postings/${board.token}?mode=json`, 20000);
  }
  if (!res.ok || !Array.isArray(res.json)) {
    return {
      report: { id: `lever:${board.token}`, ok: false, count: 0, error: `HTTP ${res.status}` },
      listings: [],
    };
  }
  const listings = res.json
    .filter((j) => {
      const extra = `${j.categories?.commitment || ""} ${j.categories?.team || ""} ${j.text || ""}`;
      return looksIntern(j.text || j.title || "", extra);
    })
    .map((j) => {
      const desc = stripHtml(j.descriptionPlain || j.description || "");
      const lists = (j.lists || []).map((l) => stripHtml(`${l.text || ""} ${(l.content || "")}`)).join(" ");
      const loc = j.categories?.location || j.country || "";
      return makeListing(
        {
          title: j.text || j.title,
          organization: board.name,
          source: "Lever",
          source_url: j.hostedUrl || j.applyUrl,
          apply_url: j.applyUrl || j.hostedUrl,
          date_posted: j.createdAt ? new Date(j.createdAt).toISOString() : null,
          location: loc,
          work_type: workTypeOf(j.text || "", j.categories?.commitment || ""),
          raw: `${j.text} ${desc} ${lists}`,
          role_summary: firstSentences(desc),
        },
        now,
      );
    })
    .filter(Boolean);
  return {
    report: { id: `lever:${board.token}`, ok: true, count: listings.length, error: null },
    listings,
  };
}

async function ashbyBoard(board, now) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${board.token}`;
  const res = await fetchJson(url);
  if (!res.ok || !res.json) {
    return {
      report: { id: `ashby:${board.token}`, ok: false, count: 0, error: `HTTP ${res.status}` },
      listings: [],
    };
  }
  const jobs = res.json.jobs || [];
  const listings = jobs
    .filter((j) => looksIntern(j.title || "", `${j.employmentType || ""} ${j.department || ""}`))
    .map((j) => {
      const loc = j.location || (j.isRemote ? "Remote" : "");
      const raw = `${j.title} ${j.descriptionPlain || stripHtml(j.descriptionHtml || "")}`;
      return makeListing(
        {
          title: j.title,
          organization: board.name,
          source: "Ashby",
          source_url: j.jobUrl || j.applyUrl,
          apply_url: j.applyUrl || j.jobUrl,
          date_posted: j.publishedAt,
          location: loc,
          remote_status: j.workplaceType?.toLowerCase() || remoteOf(loc, j.isRemote ? "remote" : ""),
          raw,
          role_summary: firstSentences(j.descriptionPlain || j.descriptionHtml || ""),
        },
        now,
      );
    })
    .filter(Boolean);
  return {
    report: { id: `ashby:${board.token}`, ok: true, count: listings.length, error: null },
    listings,
  };
}

function nextDeadline(label) {
  if (!label || /^closed$/i.test(label)) return null;
  return parseFlexibleDate(label);
}

async function ingestMisti(now) {
  const url = "https://misti.mit.edu/internships";
  const res = await fetchText(url, 15000);
  const rows = [];
  if (res.ok) {
    const text = stripHtml(res.text);
    for (const [name] of MISTI_FALLBACK) {
      const re = new RegExp(
        `${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+([A-Za-z]+\\s+\\d{1,2}(?:st|nd|rd|th)?(?: and rolling thereafter)?|Closed)`,
        "i",
      );
      const m = text.match(re);
      rows.push([name, m ? m[1] : null]);
    }
  }
  const used = rows.some(([, d]) => d) ? rows : MISTI_FALLBACK;
  const listings = used.map(([name, deadline]) =>
    makeListing(
      {
        title: `${name} internship`,
        organization: "MIT MISTI",
        source: "MISTI",
        source_url: url,
        apply_url: "https://mistiapply.mit.edu/",
        date_due: nextDeadline(deadline || "Closed"),
        location: name.replace(/^MIT-/, ""),
        work_type: "internship",
        discipline: "misti",
        tags: ["misti", "internship", /^closed$/i.test(deadline || "") ? "closed" : ""].filter(Boolean),
        sophomore_eligible: true,
        grad_dates_targeted: [],
        skills_qualifications: ["language", "culture course", "international"],
        role_summary:
          "MISTI matches MIT students to internships abroad at companies, labs, and universities. Launchpad is rolling for most countries; paste a listing if you have a specific host from the portal.",
        raw: `${name} ${deadline || ""}`,
      },
      now,
    ),
  ).filter(Boolean);
  return {
    report: { id: "mit:misti", ok: res.ok, count: listings.length, error: res.ok ? null : `HTTP ${res.status}` },
    listings,
  };
}

async function ingestHaystack(now) {
  const url =
    "https://www.haystack.mit.edu/haystack-public-outreach/research-experiences-for-undergraduates-reu/";
  const res = await fetchText(url, 15000);
  const text = res.ok ? stripHtml(res.text) : "";
  const due = extractDue(text);
  const listing = makeListing(
    {
      title: "MIT Haystack Observatory REU",
      organization: "MIT Haystack Observatory",
      source: "MIT REU",
      source_url: url,
      date_due: due,
      location: "Westford, MA",
      work_type: "research",
      discipline: "research",
      grad_dates_targeted: ["2026", "2027", "2028"],
      skills_qualifications: ["python", "physics", "electrical", "computer science"],
      role_summary:
        "Ten-week NSF REU in science, engineering, and computer science at Haystack Observatory. US citizenship or permanent residency required for NSF-supported seats.",
      raw: text.slice(0, 4000),
    },
    now,
  );
  return {
    report: { id: "mit:haystack-reu", ok: res.ok, count: 1, error: res.ok ? null : `HTTP ${res.status}` },
    listings: [listing].filter(Boolean),
  };
}

async function ingestLincoln(now) {
  const url = "https://www.ll.mit.edu/careers/student-opportunities";
  const res = await fetchText(url, 15000);
  const listing = makeListing(
    {
      title: "Student opportunities (summer / co-op / thesis)",
      organization: "MIT Lincoln Laboratory",
      source: "MIT Lincoln Lab",
      source_url: url,
      location: "Lexington, MA",
      work_type: "internship",
      discipline: "research",
      skills_qualifications: ["systems", "hardware", "security", "electrical"],
      role_summary:
        "Lincoln Lab posts summer internships, co-ops, and thesis research for undergraduates and graduate students. Individual requisitions live on this public careers page.",
      raw: res.ok ? stripHtml(res.text).slice(0, 3000) : "",
    },
    now,
  );
  return {
    report: {
      id: "mit:lincoln-lab",
      ok: res.ok,
      count: 1,
      error: res.ok ? null : `HTTP ${res.status}`,
    },
    listings: [listing].filter(Boolean),
  };
}

async function ingestUropCapd(now) {
  const listings = [
    makeListing(
      {
        title: "UROP — Undergraduate Research Opportunities Program",
        organization: "MIT UROP",
        source: "MIT UROP",
        source_url: "https://urop.mit.edu/",
        apply_url: "https://urop.mit.edu/",
        location: "Cambridge, MA",
        work_type: "research",
        discipline: "research",
        role_summary:
          "MIT’s home for undergraduate research partnerships with faculty. Individual UROP jobs are posted on the UROP site (some views require MIT login; this card is the public program entry).",
      },
      now,
    ),
    makeListing(
      {
        title: "CAPD jobs & internships (Handshake export)",
        organization: "MIT CAPD",
        source: "MIT CAPD",
        source_url: "https://capd.mit.edu/jobs-and-internships/",
        apply_url: "https://capd.mit.edu/jobs-and-internships/",
        location: "Cambridge, MA / Handshake",
        work_type: "internship",
        discipline: "other",
        role_summary:
          "CAPD points at Handshake for most employer postings. Those listings are gated — export CSV/JSON from Handshake and paste or drop the file here. Intern Radar will not log in for you.",
      },
      now,
    ),
  ].filter(Boolean);
  return { report: { id: "mit:urop-capd", ok: true, count: listings.length, error: null }, listings };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  const src = String(text).replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => String(x).trim()));
}

function listingFromUnknown(obj, source, now) {
  const title = obj.title || obj["Job Title"] || obj["Position Title"] || obj.role || obj.job || "";
  const organization =
    obj.organization || obj.employer || obj.company || obj["Employer"] || obj["Company"] || source;
  const url =
    obj.source_url || obj.url || obj.link || obj["Apply URL"] || obj["Job URL"] || obj.applyUrl || "";
  if (!title || !isApplyUrl(url)) return null;
  return makeListing(
    {
      title,
      organization,
      source: obj.source || source,
      source_url: url,
      apply_url: url,
      date_posted: obj.date_posted || obj["Date Posted"] || obj.posted,
      date_due: obj.date_due || obj.deadline || obj["Apply End"] || obj["Expiration Date"],
      location: obj.location || obj["Location"] || "",
      work_type: obj.work_type,
      discipline: obj.discipline,
      skills_qualifications: Array.isArray(obj.skills_qualifications)
        ? obj.skills_qualifications
        : String(obj.skills || obj.qualifications || "")
            .split(/[;,]/)
            .map((s) => s.trim())
            .filter(Boolean),
      role_summary: obj.role_summary || obj.description || obj["Job Description"] || "",
      raw: JSON.stringify(obj),
    },
    now,
  );
}

const CLASSROOM_FALLBACK = [
  ["Systems Thinking for Innovation in Angola", "https://misti.mit.edu/systems-thinking-innovation-angola", "Luanda, Angola", "October 22, 2026"],
  ["Race, Place, and Modernity in the Americas", "https://misti.mit.edu/race-place-and-modernity-americas", "São Paulo, Brazil", "September 30, 2026"],
  ["IAP Chinese Abroad", "https://misti.mit.edu/iap-chinese-abroad", "Shanghai, China", "October 12, 2026"],
  ["Literary London", "https://misti.mit.edu/literary-london", "London, England", "October 1, 2026"],
  ["Berlin: Cultures and Countercultures", "https://misti.mit.edu/berlin-cultures-and-countercultures", "Berlin, Germany", "September 30, 2026"],
  ["MIT in Greece", "https://misti.mit.edu/mit-in-greece", "Greece", "October 8, 2026"],
  ["Urban Futures Lab", "https://misti.mit.edu/urban-futures-lab", "Hong Kong", "October 5, 2026"],
  ["From the Forum to the Cypher", "https://misti.mit.edu/forum-to-the-cypher", "Rome and Bologna, Italy", "September 30, 2026"],
  ["The Making of Roman Pompeii", "https://misti.mit.edu/making-roman-pompeii", "Rome and Pompeii, Italy", "October 8, 2026"],
  ["The Practical Field Lab in Kenya", "https://misti.mit.edu/practical-field-lab-kenya", "Nyeri, Kenya", "October 14, 2026"],
  ["Acoustic Cue Analysis of Speech in English and Korean", "https://misti.mit.edu/acoustic-cue-analysis-korea", "Seoul, South Korea", "September 24, 2026"],
  ["Indigenous Environmental Planning - Aotearoa New Zealand", "https://misti.mit.edu/indigenous-environmental-planning", "Auckland, New Zealand", "October 26, 2026"],
  ["Rambax Senegal Study Tour", "https://misti.mit.edu/rambax-senegal-study-tour", "Dakar, Senegal", "October 1, 2026"],
  ["21L.590: The Spanish Incubator", "https://misti.mit.edu/spanish-incubator", "Madrid, Spain", "October 14, 2026"],
];

const GTL_COUNTRIES = [
  ["MISTI Africa GTL", "https://misti.mit.edu/mit-africa", "Angola, Cape Verde, Ghana, Ivory Coast, South Africa, Botswana, Rwanda"],
  ["MISTI Korea GTL", "https://misti.mit.edu/mit-korea", "Korea"],
  ["MISTI South Asia GTL", "https://misti.mit.edu/mit-india", "Bhutan, India"],
  ["MISTI Eurasia GTL", "https://misti.mit.edu/mit-eurasia", "Armenia, Cyprus, Georgia, Kazakhstan"],
  ["MISTI Germany GTL", "https://misti.mit.edu/mit-germany", "Germany, Austria"],
  ["MISTI Italy GTL", "https://misti.mit.edu/mit-italy", "Italy"],
  ["MISTI Portugal GTL", "https://misti.mit.edu/portugal", "Portugal"],
  ["MISTI Spain GTL", "https://misti.mit.edu/mit-spain", "Spain, Andorra"],
  ["MISTI UK GTL", "https://misti.mit.edu/mit-united-kingdom", "England, Scotland, Wales"],
  ["MISTI Peru GTL", "https://misti.mit.edu/peru", "Peru"],
  ["MISTI Uruguay GTL", "https://misti.mit.edu/argentina-uruguay", "Uruguay"],
  ["MISTI Mexico GTL", "https://misti.mit.edu/mit-mexico", "Mexico"],
];

async function ingestIapPrograms(now) {
  const classroomUrl = "https://misti.mit.edu/types-programs/global-classroom";
  const gtlUrl = "https://misti.mit.edu/types-programs/global-teaching-labs";
  const applyPortal = "https://mistiapply.mit.edu/";
  let classroomRes = { ok: false, status: 0, text: "" };
  let gtlRes = { ok: false, status: 0, text: "" };
  try {
    [classroomRes, gtlRes] = await Promise.all([fetchText(classroomUrl, 15000), fetchText(gtlUrl, 15000)]);
  } catch {
    /* skip */
  }
  const classroomText = classroomRes.ok ? stripHtml(classroomRes.text) : "";
  const gtlText = gtlRes.ok ? stripHtml(gtlRes.text) : "";
  const listings = [];
  const gtlDueMatch = gtlText.match(
    /Final deadline:\s*(?:[A-Za-z]+,\s*)?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*20\d{2})/i,
  );
  const gtlOpenMatch = gtlText.match(
    /Application opens:\s*(?:[A-Za-z]+,\s*)?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*20\d{2})/i,
  );
  const gtlDue = parseFlexibleDate(gtlDueMatch?.[1]) || extractDue(gtlText);
  const gtlPosted = parseFlexibleDate(gtlOpenMatch?.[1]);

  listings.push(
    makeListing(
      {
        title: "IAP Global Classroom (MISTI)",
        organization: "MIT MISTI",
        source: "MISTI IAP",
        source_url: classroomUrl,
        apply_url: classroomUrl,
        date_due: null,
        location: "IAP abroad",
        work_type: "iap",
        discipline: "misti",
        tags: ["misti", "iap", "global-classroom"],
        sophomore_eligible: true,
        skills_qualifications: ["language", "culture", "research"],
        role_summary:
          "2–3 week IAP courses abroad with MIT faculty. IAP 2027 programs are listed on the public Global Classroom page; apply on each program page.",
        raw: classroomText.slice(0, 4000),
      },
      now,
    ),
  );

  for (const [title, url, location, deadline] of CLASSROOM_FALLBACK) {
    const idx = classroomText.toLowerCase().indexOf(title.toLowerCase());
    const slice = idx >= 0 ? classroomText.slice(idx, idx + 700) : "";
    const scraped = slice.match(
      /Application (?:Deadline|Closes)[:\s]+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2})/i,
    );
    listings.push(
      makeListing(
        {
          title: `Global Classroom — ${title}`,
          organization: "MIT MISTI",
          source: "MISTI IAP",
          source_url: url,
          apply_url: url,
            date_due: parseFlexibleDate(scraped?.[1] ? `${scraped[1]}, 2026` : deadline) || parseFlexibleDate(deadline),
          location,
          work_type: "iap",
          discipline: "misti",
          tags: ["misti", "iap", "global-classroom"],
          sophomore_eligible: true,
          skills_qualifications: ["language", "culture"],
          role_summary: `IAP 2027 Global Classroom in ${location}. Official program page includes requirements and how to apply.`,
          raw: `${title} ${deadline} ${slice.slice(0, 400)}`,
        },
        now,
      ),
    );
  }

  listings.push(
    makeListing(
      {
        title: "Global Teaching Labs (GTL) — IAP",
        organization: "MIT MISTI",
        source: "MISTI GTL",
        source_url: gtlUrl,
        apply_url: applyPortal,
        date_posted: gtlPosted,
        date_due: gtlDue,
        location: "IAP teaching abroad",
        work_type: "teaching",
        discipline: "teaching",
        tags: ["misti", "iap", "teaching", "gtl"],
        sophomore_eligible: true,
        skills_qualifications: ["teaching", "stem", "communication"],
        role_summary:
          "Teach STEM abroad for 3–4 weeks in January. Public MISTI page lists the application window; apply on the MISTI portal. Sophomores are generally eligible; first-years are limited to selected countries.",
        raw: gtlText.slice(0, 4000),
      },
      now,
    ),
  );

  for (const [title, url, location] of GTL_COUNTRIES) {
    listings.push(
      makeListing(
        {
          title,
          organization: "MIT MISTI",
          source: "MISTI GTL",
          source_url: url,
          apply_url: applyPortal,
          date_posted: gtlPosted,
          date_due: gtlDue,
          location,
          work_type: "teaching",
          discipline: "teaching",
          tags: ["misti", "iap", "teaching", "gtl"],
          sophomore_eligible: true,
          skills_qualifications: ["teaching", "stem"],
          role_summary: `Country GTL placements for IAP. Details on the public country page; apply at ${applyPortal}.`,
          raw: title,
        },
        now,
      ),
    );
  }

  const cleaned = listings.filter(Boolean);
  return {
    report: {
      id: "mit:iap-gtl",
      ok: Boolean(classroomRes.ok || gtlRes.ok),
      count: cleaned.length,
      error: classroomRes.ok || gtlRes.ok ? null : `classroom HTTP ${classroomRes.status}; gtl HTTP ${gtlRes.status}`,
    },
    listings: cleaned,
  };
}

async function ingestUploads(now) {
  let files = [];
  try {
    files = (await readdir(UPLOADS)).filter((f) => /\.(json|csv)$/i.test(f) && !f.startsWith("."));
  } catch {
    return { report: { id: "uploads", ok: true, count: 0, error: null }, listings: [] };
  }
  const listings = [];
  for (const file of files) {
    const full = join(UPLOADS, file);
    const text = await readFile(full, "utf8");
    const source = /misti/i.test(file) ? "MISTI paste" : /handshake/i.test(file) ? "Handshake" : "Upload";
    if (extname(file).toLowerCase() === ".json") {
      const json = JSON.parse(text);
      const arr = Array.isArray(json) ? json : json.listings || json.jobs || [];
      for (const row of arr) {
        const listing = listingFromUnknown(row, source, now);
        if (listing) listings.push(listing);
      }
    } else {
      const rows = parseCsv(text);
      if (!rows.length) continue;
      const headers = rows[0].map((h) => h.trim());
      for (const values of rows.slice(1)) {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = values[i];
        });
        const listing = listingFromUnknown(obj, source, now);
        if (listing) listings.push(listing);
      }
    }
  }
  return { report: { id: "uploads:handshake-misti", ok: true, count: listings.length, error: null }, listings };
}

async function enrichWithLlm(listings) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { used: false, updated: 0 };
  const need = listings
    .filter((l) => !l.date_due || !l.role_summary || l.skills_qualifications.length === 0)
    .slice(0, 25);
  if (!need.length) return { used: true, updated: 0 };
  try {
    const payload = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Extract JSON array of {id, date_due (ISO or null), role_summary (1-2 sentences), skills (string array), grad_years (string array)} for these internship postings:\n${JSON.stringify(
            need.map((l) => ({
              id: l.id,
              title: l.title,
              organization: l.organization,
              summary: l.role_summary,
            })),
          )}`,
        },
      ],
    };
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return { used: true, updated: 0 };
    const data = await r.json();
    const text = data.content?.map((c) => c.text).join("\n") || "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return { used: true, updated: 0 };
    const parsed = JSON.parse(match[0]);
    const byId = new Map(listings.map((l) => [l.id, l]));
    let updated = 0;
    for (const row of parsed) {
      const listing = byId.get(row.id);
      if (!listing) continue;
      if (row.role_summary) listing.role_summary = firstSentences(row.role_summary);
      if (Array.isArray(row.skills) && listing.skills_qualifications.length === 0) {
        listing.skills_qualifications = row.skills.slice(0, 8);
      }
      if (Array.isArray(row.grad_years) && listing.grad_dates_targeted.length === 0) {
        listing.grad_dates_targeted = row.grad_years.map(String);
      }
      updated++;
    }
    return { used: true, updated };
  } catch {
    return { used: true, updated: 0 };
  }
}

function mergeListings(previous, incoming, now) {
  const prevByKey = new Map(previous.map((l) => [dedupKey(l), l]));
  const seen = new Set();
  const out = [];
  for (const listing of incoming) {
    const key = dedupKey(listing);
    if (seen.has(key)) continue;
    seen.add(key);
    const prev = prevByKey.get(key);
    if (prev) {
      listing.first_seen_at = prev.first_seen_at || listing.first_seen_at;
      listing.id = prev.id;
    }
    listing.last_seen_at = now;
    out.push(listing);
    prevByKey.delete(key);
  }
  for (const prev of prevByKey.values()) {
    const manual = /handshake|paste|upload/i.test(prev.source);
    if (manual) out.push(prev);
  }
  return out;
}

async function loadPrevious() {
  try {
    const raw = await readFile(join(DATA_OUT, "listings.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function loadMeta() {
  try {
    return JSON.parse(await readFile(join(DATA_OUT, "meta.json"), "utf8"));
  } catch {
    return {};
  }
}

function catchBoard(id, promise) {
  return Promise.resolve(promise).catch((err) => ({
    report: { id, ok: false, count: 0, error: String(err?.message || err) },
    listings: [],
  }));
}

async function main() {
  const now = nowIso();
  const sources = JSON.parse(await readFile(SOURCES_PATH, "utf8"));
  const previous = await loadPrevious();
  const prevMeta = await loadMeta();
  const reports = [];
  const incoming = [];

  const gh = await mapPool(sources.greenhouse, 5, (b) =>
    catchBoard(`greenhouse:${b.token}`, greenhouseBoard(b, now)),
  );
  const lv = await mapPool(sources.lever, 4, (b) => catchBoard(`lever:${b.token}`, leverBoard(b, now)));
  const as = await mapPool(sources.ashby, 4, (b) => catchBoard(`ashby:${b.token}`, ashbyBoard(b, now)));
  const extras = await Promise.all([
    catchBoard("mit:misti", ingestMisti(now)),
    catchBoard("mit:iap-gtl", ingestIapPrograms(now)),
    catchBoard("mit:haystack-reu", ingestHaystack(now)),
    catchBoard("mit:lincoln-lab", ingestLincoln(now)),
    catchBoard("mit:urop-capd", ingestUropCapd(now)),
    catchBoard("uploads:handshake-misti", ingestUploads(now)),
  ]);

  for (const batch of [...gh, ...lv, ...as, ...extras]) {
    reports.push(batch.report);
    incoming.push(...batch.listings.filter((l) => l && (isApplyUrl(l.apply_url) || isApplyUrl(l.source_url))));
  }

  const merged = mergeListings(previous, incoming, now).filter(
    (l) => isApplyUrl(l.apply_url) || isApplyUrl(l.source_url),
  );
  const llm = await enrichWithLlm(merged);
  merged.sort((a, b) => {
    const ad = a.date_due ? Date.parse(a.date_due) : Infinity;
    const bd = b.date_due ? Date.parse(b.date_due) : Infinity;
    return ad - bd;
  });

  const meta = {
    lastRefreshed: now,
    previousRefreshed: prevMeta.lastRefreshed || null,
    listingCount: merged.length,
    llmEnrichment: llm,
    handshake:
      "Handshake stays paste/CSV/JSON only. No login, cookies, or SSO scrape. Drop exports in data/uploads/ or use the on-site paste box (local to this browser).",
    sources: reports.sort((a, b) => a.id.localeCompare(b.id)),
  };

  await writeFile(join(DATA_OUT, "listings.json"), JSON.stringify(merged, null, 2) + "\n");
  await writeFile(join(DATA_OUT, "meta.json"), JSON.stringify(meta, null, 2) + "\n");

  const ok = reports.filter((r) => r.ok && r.count > 0).length;
  const fail = reports.filter((r) => !r.ok).length;
  console.log(
    `ingest ${merged.length} listings · ${ok} live sources · ${fail} skipped · llm ${llm.used ? llm.updated : "off"}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
