import { useMemo, useState } from "react";
import { parseImport } from "../lib/parse";
import type { Listing } from "../types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (listings: Listing[]) => void;
};

export default function PasteModal({ open, onClose, onSave }: Props) {
  const [raw, setRaw] = useState("");
  const [source, setSource] = useState("Handshake");
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    try {
      return parseImport(raw, source);
    } catch (err) {
      return err instanceof Error ? err.message : "Could not parse";
    }
  }, [raw, source]);

  if (!open) return null;

  const listings = Array.isArray(preview) ? preview : [];
  const parseError = typeof preview === "string" ? preview : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="paste-title"
        className="max-h-[92svh] w-full max-w-2xl overflow-auto rounded-2xl bg-card p-5 shadow-xl ring-1 ring-line"
      >
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-signal">Manual import</p>
        <h2 id="paste-title" className="font-display mt-1 text-2xl">
          Handshake & MISTI paste
        </h2>
        <p className="mt-2 text-sm leading-6 text-mute">
          Handshake and most MISTI host matches sit behind login. Export CSV/JSON, or paste rows here. Nothing is
          scraped; listings stay in this browser unless you also commit a file to{" "}
          <code className="rounded bg-paper px-1">data/uploads/</code>.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["Handshake", "MISTI paste", "Other"] as const).map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setSource(label)}
              className={`rounded-full px-3 py-1 text-sm ${
                source === label ? "bg-ink text-paper" : "bg-paper text-ink ring-1 ring-line"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-medium">
          JSON, CSV, or one listing per paragraph
          <textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setError(null);
            }}
            rows={10}
            className="mt-2 w-full rounded-xl bg-paper p-3 font-mono text-sm ring-1 ring-line"
            placeholder={'Software Engineering Intern\nAcme Robotics\nhttps://...\nApply by Oct 30'}
          />
        </label>

        <label className="mt-3 block text-sm">
          Or choose a file
          <input
            type="file"
            accept=".json,.csv,application/json,text/csv"
            className="mt-2 block w-full text-sm"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setRaw(await file.text());
            }}
          />
        </label>

        {parseError ? (
          <p className="mt-3 text-sm text-due">{parseError}</p>
        ) : (
          <p className="mt-3 text-sm text-mute">
            {listings.length ? `${listings.length} listing${listings.length === 1 ? "" : "s"} ready.` : "Nothing parsed yet."}
          </p>
        )}

        {listings.slice(0, 4).map((l) => (
          <div key={l.id} className="mt-2 rounded-xl bg-paper px-3 py-2 text-sm">
            <strong>{l.title}</strong>
            <span className="text-mute"> · {l.organization}</span>
          </div>
        ))}

        {error ? <p className="mt-3 text-sm text-due">{error}</p> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm ring-1 ring-line">
            Cancel
          </button>
          <button
            type="button"
            className="rounded-full bg-signal px-4 py-2 text-sm font-medium text-white"
            onClick={() => {
              if (!listings.length) {
                setError("Paste JSON, CSV, or a few paragraphs first.");
                return;
              }
              onSave(listings);
              setRaw("");
              onClose();
            }}
          >
            Add to my radar
          </button>
        </div>
      </div>
    </div>
  );
}
