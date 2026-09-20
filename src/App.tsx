import { useEffect, useMemo, useRef, useState } from "react";
import { Radar, Search, Upload } from "lucide-react";
import PasteModal from "./components/PasteModal";
import { dueLabel, formatDate, formatWhen, isDueSoon, isExpired, isNewListing } from "./lib/dates";
import { EMPTY_FILTERS, matches, sortListings, uniqueSorted, type Filters } from "./lib/filters";
import { loadManualListings, loadStatusMap, saveManualListings, saveStatusMap } from "./lib/status";
import type { Listing, Meta, UserStatus } from "./types";

const STATUS_OPTIONS: UserStatus[] = ["saved", "applied", "seen", "not-interested"];

function statusFor(listing: Listing, map: Record<string, UserStatus>, previousRefreshed: string | null): UserStatus {
  if (map[listing.id]) return map[listing.id];
  if (isNewListing(listing.first_seen_at, previousRefreshed)) return "new";
  return "seen";
}

function Field({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-mute">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg bg-card px-2 py-2 text-sm font-medium normal-case tracking-normal text-ink ring-1 ring-line"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function App() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [statusMap, setStatusMap] = useState<Record<string, UserStatus>>({});
  const [manual, setManual] = useState<Listing[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStatusMap(loadStatusMap());
    setManual(loadManualListings<Listing>());
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/listings.json`).then((r) => {
        if (!r.ok) throw new Error(`Listings HTTP ${r.status}`);
        return r.json() as Promise<Listing[]>;
      }),
      fetch(`${base}data/meta.json`).then((r) => {
        if (!r.ok) throw new Error(`Meta HTTP ${r.status}`);
        return r.json() as Promise<Meta>;
      }),
    ])
      .then(([data, info]) => {
        setListings(Array.isArray(data) ? data : []);
        setMeta(info);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load listings");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const merged = useMemo(() => {
    const seen = new Set(listings.map((l) => l.id));
    return [...listings, ...manual.filter((m) => !seen.has(m.id))];
  }, [listings, manual]);

  const liveSources = meta?.sources.filter((s) => s.ok && s.count > 0) ?? [];
  const failedSources = meta?.sources.filter((s) => !s.ok) ?? [];

  const filtered = useMemo(() => {
    const rows = merged.filter((l) =>
      matches(l, filters, statusFor(l, statusMap, meta?.previousRefreshed ?? null), meta?.previousRefreshed ?? null),
    );
    return sortListings(rows);
  }, [merged, filters, statusMap, meta]);

  const setStatus = (id: string, status: UserStatus) => {
    const next = { ...statusMap, [id]: status };
    setStatusMap(next);
    saveStatusMap(next);
  };

  const dueWeek = merged.filter((l) => isDueSoon(l.date_due)).length;
  const newest = merged.filter((l) => isNewListing(l.first_seen_at, meta?.previousRefreshed ?? null)).length;

  return (
    <div className="mx-auto min-h-svh max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-signal">
            <Radar size={14} /> Intern Radar
          </p>
          <h1 className="font-display mt-2 max-w-xl text-4xl leading-tight sm:text-5xl">One scan for MIT-relevant internships</h1>
          <p className="mt-3 max-w-xl text-[1.02rem] leading-7 text-mute">
            Public job boards refresh twice a day. Handshake and MISTI host matches stay paste-only — no login scrape.
          </p>
        </div>
        <div className="rounded-2xl bg-card px-4 py-3 ring-1 ring-line">
          <p className="text-[0.7rem] uppercase tracking-[0.1em] text-mute">Last refreshed</p>
          <p className="mt-1 text-lg font-medium">{formatWhen(meta?.lastRefreshed ?? null)}</p>
          <p className="text-sm text-mute">
            {merged.length} listings · {dueWeek} due in 7 days · {newest} new
          </p>
        </div>
      </header>

      <div className="mt-8 rounded-2xl bg-card/80 p-4 ring-1 ring-line backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[16rem] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
            <input
              ref={searchRef}
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              placeholder="Search title, org, skills"
              className="w-full rounded-xl bg-paper py-2.5 pl-9 pr-3 text-sm ring-1 ring-line"
            />
          </label>
          <button
            type="button"
            onClick={() => setFilters({ ...filters, dueSoon: !filters.dueSoon })}
            className={`rounded-full px-3 py-2 text-sm ${filters.dueSoon ? "bg-due text-white" : "bg-paper ring-1 ring-line"}`}
          >
            Due soon
          </button>
          <button
            type="button"
            onClick={() => setFilters({ ...filters, hideExpired: !filters.hideExpired })}
            className={`rounded-full px-3 py-2 text-sm ${filters.hideExpired ? "bg-ink text-paper" : "bg-paper ring-1 ring-line"}`}
          >
            Hide closed
          </button>
          <button
            type="button"
            onClick={() => setPasteOpen(true)}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2 text-sm font-medium text-white"
          >
            <Upload size={15} /> Paste Handshake / MISTI
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Field
            label="Work type"
            value={filters.workType}
            onChange={(v) => setFilters({ ...filters, workType: v })}
            options={[
              { value: "all", label: "All" },
              ...uniqueSorted(merged.map((l) => l.work_type)).map((v) => ({ value: v, label: v })),
            ]}
          />
          <Field
            label="Discipline"
            value={filters.discipline}
            onChange={(v) => setFilters({ ...filters, discipline: v })}
            options={[
              { value: "all", label: "All" },
              ...uniqueSorted(merged.map((l) => l.discipline)).map((v) => ({ value: v, label: v })),
            ]}
          />
          <Field
            label="Grad year"
            value={filters.gradYear}
            onChange={(v) => setFilters({ ...filters, gradYear: v })}
            options={[
              { value: "all", label: "All" },
              ...uniqueSorted(merged.flatMap((l) => l.grad_dates_targeted)).map((v) => ({ value: v, label: v })),
            ]}
          />
          <Field
            label="Skills"
            value={filters.skill}
            onChange={(v) => setFilters({ ...filters, skill: v })}
            options={[
              { value: "all", label: "All" },
              ...uniqueSorted(merged.flatMap((l) => l.skills_qualifications)).map((v) => ({ value: v, label: v })),
            ]}
          />
          <Field
            label="Source"
            value={filters.source}
            onChange={(v) => setFilters({ ...filters, source: v })}
            options={[
              { value: "all", label: "All" },
              ...uniqueSorted(merged.map((l) => l.source)).map((v) => ({ value: v, label: v })),
            ]}
          />
          <Field
            label="Remote"
            value={filters.remote}
            onChange={(v) => setFilters({ ...filters, remote: v })}
            options={[
              { value: "all", label: "All" },
              ...uniqueSorted(merged.map((l) => l.remote_status)).map((v) => ({ value: v, label: v })),
            ]}
          />
          <Field
            label="Status"
            value={filters.status}
            onChange={(v) => setFilters({ ...filters, status: v })}
            options={[
              { value: "all", label: "All" },
              { value: "new", label: "New" },
              { value: "saved", label: "Saved" },
              { value: "applied", label: "Applied" },
              { value: "seen", label: "Seen" },
              { value: "not-interested", label: "Not interested" },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="mt-10 rounded-2xl bg-card p-10 text-center ring-1 ring-line">
          <p className="font-display text-2xl">Sweeping the boards…</p>
          <p className="mt-2 text-mute">Loading the committed listings feed.</p>
        </div>
      ) : error ? (
        <div className="mt-10 rounded-2xl bg-card p-10 ring-1 ring-due">
          <p className="font-display text-2xl">Couldn’t load the radar</p>
          <p className="mt-2 text-mute">{error}</p>
          <p className="mt-2 text-sm text-mute">
            If this is GitHub Pages, confirm the site is serving <code>data/listings.json</code> next to the hashed assets.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-card p-10 ring-1 ring-line">
          <p className="font-display text-2xl">Nothing in this slice</p>
          <p className="mt-2 max-w-lg text-mute">
            {merged.length
              ? "Filters are hiding every listing. Clear due-soon, pick All sources, or paste a Handshake export."
              : "The feed is empty. Run ingest or paste a Handshake / MISTI export."}
          </p>
          <button
            type="button"
            className="mt-4 rounded-full bg-ink px-4 py-2 text-sm text-paper"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            Reset filters
          </button>
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-mute">
            Sorted by due date · {filtered.length} shown
          </p>
          <div className="mt-3 hidden overflow-hidden rounded-2xl ring-1 ring-line md:block">
            <table className="scan-table bg-card">
              <thead>
                <tr>
                  <th>Due</th>
                  <th>Role</th>
                  <th>Org</th>
                  <th>Type</th>
                  <th>Skills</th>
                  <th>Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((listing) => {
                  const status = statusFor(listing, statusMap, meta?.previousRefreshed ?? null);
                  const open = openId === listing.id;
                  const due = isDueSoon(listing.date_due);
                  const expired = isExpired(listing.date_due);
                  const fresh = isNewListing(listing.first_seen_at, meta?.previousRefreshed ?? null);
                  return (
                    <ListingBlock
                      key={listing.id}
                      listing={listing}
                      status={status}
                      open={open}
                      due={due}
                      expired={expired}
                      fresh={fresh}
                      onToggle={() => setOpenId(open ? null : listing.id)}
                      onStatus={(s) => setStatus(listing.id, s)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid gap-3 md:hidden">
            {filtered.map((listing) => {
              const status = statusFor(listing, statusMap, meta?.previousRefreshed ?? null);
              const open = openId === listing.id;
              return (
                <article key={listing.id} className="rounded-2xl bg-card p-4 ring-1 ring-line">
                  <ListingBody
                    listing={listing}
                    status={status}
                    open={open}
                    due={isDueSoon(listing.date_due)}
                    expired={isExpired(listing.date_due)}
                    fresh={isNewListing(listing.first_seen_at, meta?.previousRefreshed ?? null)}
                    onToggle={() => setOpenId(open ? null : listing.id)}
                    onStatus={(s) => setStatus(listing.id, s)}
                  />
                </article>
              );
            })}
          </div>
        </>
      )}

      <footer className="mt-12 border-t border-line pt-6 text-sm leading-6 text-mute">
        <p>
          Live sources this refresh:{" "}
          {liveSources.length ? liveSources.map((s) => `${s.id} (${s.count})`).join(" · ") : "none yet"}
        </p>
        {failedSources.length ? (
          <p className="mt-1">Skipped (board missing or down): {failedSources.map((s) => s.id).join(", ")}</p>
        ) : null}
        <p className="mt-3 max-w-3xl">
          Handshake gap: there is no student-public API. Intern Radar will not store passwords, cookies, or SSO
          sessions. Use CAPD/Handshake CSV or JSON export, paste it here, or commit it to{" "}
          <code>data/uploads/</code> so Actions can merge it on the next 01:00 / 13:00 UTC sweep. Career-center API
          access remains a future option.
        </p>
      </footer>

      <PasteModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onSave={(rows) => {
          const next = [...rows, ...manual];
          setManual(next);
          saveManualListings(next);
        }}
      />
    </div>
  );
}

function ListingBlock({
  listing,
  status,
  open,
  due,
  expired,
  fresh,
  onToggle,
  onStatus,
}: {
  listing: Listing;
  status: UserStatus;
  open: boolean;
  due: boolean;
  expired: boolean;
  fresh: boolean;
  onToggle: () => void;
  onStatus: (s: UserStatus) => void;
}) {
  return (
    <>
      <tr>
        <td className="w-[8.5rem]">
          <span className={due ? "font-semibold text-due" : expired ? "text-closed" : ""}>
            {dueLabel(listing.date_due)}
          </span>
        </td>
        <td>
          <button type="button" onClick={onToggle} className="text-left font-medium hover:underline">
            {listing.title}
          </button>
          <div className="mt-1 flex flex-wrap gap-1">
            {fresh ? <Flag className="bg-new-soft text-new">New</Flag> : null}
            {due ? <Flag className="bg-due-soft text-due">Due soon</Flag> : null}
            {expired ? <Flag className="bg-paper text-closed">Closed</Flag> : null}
          </div>
        </td>
        <td>{listing.organization}</td>
        <td className="capitalize">
          {listing.discipline}
          <div className="text-xs text-mute">{listing.work_type}</div>
        </td>
        <td className="max-w-[12rem] text-sm text-mute">{listing.skills_qualifications.slice(0, 4).join(", ") || "—"}</td>
        <td>
          <a className="text-signal underline-offset-2 hover:underline" href={listing.source_url} target="_blank" rel="noreferrer">
            {listing.source}
          </a>
        </td>
        <td>
          <StatusSelect value={status} onChange={onStatus} />
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={7} className="bg-paper/70">
            <Detail listing={listing} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ListingBody({
  listing,
  status,
  open,
  due,
  expired,
  fresh,
  onToggle,
  onStatus,
}: {
  listing: Listing;
  status: UserStatus;
  open: boolean;
  due: boolean;
  expired: boolean;
  fresh: boolean;
  onToggle: () => void;
  onStatus: (s: UserStatus) => void;
}) {
  return (
    <>
      <p className={`text-sm ${due ? "font-semibold text-due" : expired ? "text-closed" : "text-mute"}`}>
        {dueLabel(listing.date_due)}
      </p>
      <button type="button" onClick={onToggle} className="mt-1 text-left text-lg font-medium">
        {listing.title}
      </button>
      <p className="text-sm text-mute">
        {listing.organization} · {listing.location}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {fresh ? <Flag className="bg-new-soft text-new">New</Flag> : null}
        {due ? <Flag className="bg-due-soft text-due">Due soon</Flag> : null}
        <Flag className="bg-signal-soft text-signal">{listing.discipline}</Flag>
      </div>
      <div className="mt-3">
        <StatusSelect value={status} onChange={onStatus} />
      </div>
      {open ? <Detail listing={listing} /> : null}
    </>
  );
}

function Detail({ listing }: { listing: Listing }) {
  return (
    <div className="max-w-3xl py-2 text-sm leading-6">
      <p>{listing.role_summary || "No description extracted — open the source posting."}</p>
      <p className="mt-2 text-mute">
        Posted {formatDate(listing.date_posted)} · Target grad {listing.grad_dates_targeted.join(", ") || "unspecified"} ·{" "}
        {listing.remote_status} · {listing.location}
      </p>
      {listing.skills_qualifications.length ? (
        <p className="mt-1 text-mute">Skills: {listing.skills_qualifications.join(" · ")}</p>
      ) : null}
      <a className="mt-2 inline-block text-signal underline" href={listing.source_url} target="_blank" rel="noreferrer">
        Open original posting
      </a>
    </div>
  );
}

function Flag({ children, className }: { children: string; className: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide ${className}`}>{children}</span>;
}

function StatusSelect({ value, onChange }: { value: UserStatus; onChange: (s: UserStatus) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as UserStatus)}
      className="rounded-lg bg-paper px-2 py-1 text-sm ring-1 ring-line"
    >
      <option value="new">New</option>
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {s.replace("-", " ")}
        </option>
      ))}
    </select>
  );
}
