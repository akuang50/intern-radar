import { useState } from "react";
import { answerQuery, type ChatMessage } from "../lib/chat";
import { dueLabel } from "../lib/dates";
import type { Listing, Profile } from "../types";
import ApplyButton from "./ApplyButton";

export default function ChatPanel({ listings, profile }: { listings: Listing[]; profile: Profile }) {
  const [input, setInput] = useState("I’m a sophomore Course 6 looking for SWE internships that don’t require prior internships.");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Ask in plain language. I only search the listings already on this page — no Handshake login, no invented deadlines.",
    },
  ]);

  const send = () => {
    const q = input.trim();
    if (!q) return;
    const result = answerQuery(q, listings, profile);
    setMessages((m) => [...m, { role: "user", text: q }, { role: "assistant", text: result.text, picks: result.picks }]);
    setInput("");
  };

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-line">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-signal">What should I apply to?</p>
      <p className="mt-1 text-sm text-mute">Local retrieval over the radar JSON. Works on GitHub Pages with no API key.</p>
      <div className="mt-3 max-h-80 space-y-3 overflow-auto">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "text-ink" : "text-mute"}>
            <p className="whitespace-pre-wrap text-sm leading-6">{msg.text}</p>
            {msg.picks?.length ? (
              <ul className="mt-2 space-y-2">
                {msg.picks.map((p) => (
                  <li key={p.listing.id} className="rounded-xl bg-paper px-3 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-ink">{p.listing.title}</p>
                        <p className="text-sm">
                          {p.listing.organization} · {p.listing.date_due ? dueLabel(p.listing.date_due) : "No due date posted"}
                        </p>
                        <p className="text-xs">{p.reasons.join(" · ") || "Keyword match"}</p>
                      </div>
                      <ApplyButton listing={p.listing} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          className="min-w-0 flex-1 rounded-xl bg-paper px-3 py-2 text-sm ring-1 ring-line"
        />
        <button type="button" onClick={send} className="rounded-full bg-ink px-4 py-2 text-sm text-paper">
          Ask
        </button>
      </div>
    </section>
  );
}
