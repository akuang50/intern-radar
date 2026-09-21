import { useMemo, useState } from "react";
import { eventsOnDay, monthCells, monthMarks, utcDay } from "../lib/calendar";
import { dueLabel, formatDate } from "../lib/dates";
import type { Listing } from "../types";
import ApplyButton from "./ApplyButton";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarView({ listings }: { listings: Listing[] }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getUTCFullYear(), m: now.getUTCMonth() });
  const [selected, setSelected] = useState<string | null>(now.toISOString().slice(0, 10));

  const cells = useMemo(() => monthCells(cursor.y, cursor.m), [cursor]);
  const marks = useMemo(() => monthMarks(listings, cursor.y, cursor.m), [listings, cursor]);
  const hits = selected ? eventsOnDay(listings, selected) : [];
  const unknownDue = useMemo(() => listings.filter((l) => !utcDay(l.date_due)), [listings]);
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(cursor.y, cursor.m, 1)),
  );
  const today = now.toISOString().slice(0, 10);

  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(Date.UTC(c.y, c.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl">{label}</h2>
        <div className="flex gap-2">
          <button type="button" className="rounded-full px-3 py-1 text-sm ring-1 ring-line" onClick={() => shift(-1)}>
            Prev
          </button>
          <button
            type="button"
            className="rounded-full px-3 py-1 text-sm ring-1 ring-line"
            onClick={() => {
              setCursor({ y: now.getUTCFullYear(), m: now.getUTCMonth() });
              setSelected(today);
            }}
          >
            Today
          </button>
          <button type="button" className="rounded-full px-3 py-1 text-sm ring-1 ring-line" onClick={() => shift(1)}>
            Next
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm text-mute">
        <span className="mr-3 inline-flex items-center gap-1">
          <i className="inline-block h-2.5 w-2.5 rounded-full bg-signal" /> Posted
        </span>
        <span className="mr-3 inline-flex items-center gap-1">
          <i className="inline-block h-2.5 w-2.5 bg-due" /> Due
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="inline-block h-2.5 w-2.5 bg-due ring-2 ring-due" /> Due in 7 days
        </span>
        · Unknown deadlines stay below, never as fake due cells.
      </p>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[0.7rem] uppercase tracking-wide text-mute">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const mark = marks.get(day);
          const isSel = selected === day;
          const dueSoon = Boolean(mark?.dueSoon);
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelected(day)}
              className={`min-h-[3.6rem] rounded-xl p-1 text-left text-sm ring-1 ${
                dueSoon
                  ? "bg-due text-white ring-due shadow-[0_0_0_3px_rgb(180_83_9_/_0.28)]"
                  : isSel
                    ? "bg-signal-soft ring-signal"
                    : day === today
                      ? "bg-paper ring-signal/40"
                      : "bg-paper ring-line"
              }`}
            >
              <span className={`text-xs ${dueSoon ? "font-semibold" : ""}`}>{Number(day.slice(-2))}</span>
              <span className="mt-1 flex gap-1">
                {mark?.posted ? (
                  <i className={`inline-block h-2 w-2 rounded-full ${dueSoon ? "bg-white" : "bg-signal"}`} />
                ) : null}
                {mark?.due ? (
                  <i className={`inline-block h-2 w-2 ${dueSoon ? "bg-white ring-2 ring-white/70" : "bg-due"}`} />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-sm font-medium">{selected ? formatDate(selected + "T00:00:00.000Z") : "Pick a day"}</p>
        {!hits.length ? (
          <p className="text-sm text-mute">Nothing posted or due on this day (that we actually know).</p>
        ) : (
          hits.map((h) => (
            <div
              key={`${h.listing.id}-${h.posted ? "p" : ""}${h.due ? "d" : ""}`}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 ${
                h.dueSoon ? "bg-due-soft ring-1 ring-due" : "bg-paper"
              }`}
            >
              <div>
                <p className="font-medium">{h.listing.title}</p>
                <p className="text-sm text-mute">
                  {h.listing.organization}
                  {h.posted ? " · posted" : ""}
                  {h.due ? ` · due ${dueLabel(h.listing.date_due)}` : ""}
                  {h.dueSoon ? " · due within 7 days" : ""}
                </p>
              </div>
              <ApplyButton listing={h.listing} />
            </div>
          ))
        )}
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <h3 className="font-display text-xl">No due date posted</h3>
        <p className="mt-1 text-sm text-mute">
          {unknownDue.length
            ? `${unknownDue.length} role${unknownDue.length === 1 ? "" : "s"} stay on this list — we never invent a calendar deadline.`
            : "Every listing in this slice published a due date."}
        </p>
        <div className="mt-3 max-h-[28rem] space-y-2 overflow-auto">
          {unknownDue.map((listing) => (
            <div key={listing.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2">
              <div>
                <p className="font-medium">{listing.title}</p>
                <p className="text-sm text-mute">
                  {listing.organization}
                  {listing.date_posted ? ` · posted ${formatDate(listing.date_posted)}` : ""}
                </p>
              </div>
              <ApplyButton listing={listing} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
