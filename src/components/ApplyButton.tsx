import { applyHref } from "../lib/apply";
import type { Listing } from "../types";

export default function ApplyButton({ listing }: { listing: Listing }) {
  const href = applyHref(listing);
  if (!href) {
    return <span className="text-xs text-closed">No apply link</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center rounded-full bg-signal px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
    >
      Apply
    </a>
  );
}
