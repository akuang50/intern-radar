import type { Profile } from "../types";

export default function ProfileBar({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
}) {
  const set = (patch: Partial<Profile>) => onChange({ ...profile, ...patch });
  return (
    <section className="rounded-2xl bg-card/80 p-4 ring-1 ring-line">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-signal">Your radar</p>
      <p className="mt-1 text-sm text-mute">Saved in this browser. Used for relevance sort and the apply chatbot.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-mute">
          Grad year
          <input
            value={profile.gradYear}
            onChange={(e) => set({ gradYear: e.target.value })}
            placeholder="2028"
            className="mt-1 w-full rounded-lg bg-paper px-2 py-2 text-sm font-medium normal-case tracking-normal text-ink ring-1 ring-line"
          />
        </label>
        <label className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-mute">
          Skills
          <input
            value={profile.skills}
            onChange={(e) => set({ skills: e.target.value })}
            placeholder="python, react, circuits"
            className="mt-1 w-full rounded-lg bg-paper px-2 py-2 text-sm font-medium normal-case tracking-normal text-ink ring-1 ring-line"
          />
        </label>
        <label className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-mute">
          Location
          <input
            value={profile.location}
            onChange={(e) => set({ location: e.target.value })}
            placeholder="Cambridge, Boston, NYC"
            className="mt-1 w-full rounded-lg bg-paper px-2 py-2 text-sm font-medium normal-case tracking-normal text-ink ring-1 ring-line"
          />
        </label>
        <label className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-mute">
          Work type
          <select
            value={profile.workType}
            onChange={(e) => set({ workType: e.target.value })}
            className="mt-1 w-full rounded-lg bg-paper px-2 py-2 text-sm font-medium normal-case tracking-normal text-ink ring-1 ring-line"
          >
            <option value="all">Any</option>
            <option value="internship">Internship</option>
            <option value="co-op">Co-op</option>
            <option value="research">Research</option>
            <option value="iap">IAP</option>
            <option value="teaching">Teaching</option>
            <option value="new-grad">New grad</option>
          </select>
        </label>
        <label className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-mute">
          Discipline
          <select
            value={profile.discipline}
            onChange={(e) => set({ discipline: e.target.value })}
            className="mt-1 w-full rounded-lg bg-paper px-2 py-2 text-sm font-medium normal-case tracking-normal text-ink ring-1 ring-line"
          >
            <option value="all">Any</option>
            <option value="swe">SWE</option>
            <option value="quant">Quant</option>
            <option value="hardware">Hardware</option>
            <option value="research">Research</option>
            <option value="teaching">Teaching</option>
            <option value="misti">MISTI</option>
            <option value="policy">Policy</option>
          </select>
        </label>
        <label className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-mute">
          Remote
          <select
            value={profile.remote}
            onChange={(e) => set({ remote: e.target.value })}
            className="mt-1 w-full rounded-lg bg-paper px-2 py-2 text-sm font-medium normal-case tracking-normal text-ink ring-1 ring-line"
          >
            <option value="all">Any</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={profile.sophomore}
          onChange={(e) => set({ sophomore: e.target.checked })}
        />
        I’m a sophomore / rising junior (class of 2028)
      </label>
    </section>
  );
}
