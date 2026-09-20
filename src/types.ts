export type WorkType = "internship" | "co-op" | "part-time" | "research" | "new-grad";
export type Discipline = "swe" | "research" | "policy" | "hardware" | "misti" | "quant" | "other";
export type RemoteStatus = "remote" | "hybrid" | "onsite" | "unknown";
export type UserStatus = "new" | "seen" | "saved" | "applied" | "not-interested";

export type Listing = {
  id: string;
  title: string;
  organization: string;
  source: string;
  source_url: string;
  date_posted: string | null;
  date_due: string | null;
  grad_dates_targeted: string[];
  work_type: WorkType | string;
  discipline: Discipline | string;
  location: string;
  remote_status: RemoteStatus | string;
  skills_qualifications: string[];
  role_summary: string;
  first_seen_at: string;
  last_seen_at: string;
};

export type SourceReport = {
  id: string;
  ok: boolean;
  count: number;
  error: string | null;
};

export type Meta = {
  lastRefreshed: string | null;
  previousRefreshed: string | null;
  listingCount: number;
  handshake?: string;
  llmEnrichment?: { used: boolean; updated: number };
  sources: SourceReport[];
};
