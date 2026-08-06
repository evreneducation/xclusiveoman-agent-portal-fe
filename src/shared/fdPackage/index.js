// Shared FD (Fixed Group Departure) package domain helpers.
//
// Both the Admin catalog (ProductCatalog.jsx / FdPackageEditor.jsx) and the
// Agent portal (Departures.jsx / DepartureDetail.jsx) render FD package
// cards/detail pages independently, and had each grown their own copies of
// pricing, date, seat-count, and badge logic — which had already drifted
// (the agent listing card formatted price with thousands separators, the
// agent detail page didn't). This module is the single source of truth for
// that domain logic so admin and agent can't disagree on it again.
//
// Pure data/functions only — no JSX. Each portal's <Badge>/<Card> primitives
// stay in their own themed component kit (src/admin/components/ui.jsx,
// src/agent/components/ui.jsx); this module only supplies what to render.

export const FD_THEMES = ['Culture', 'Adventure', 'Nature'];

export const FD_STATUS_TONE = { published: 'green', draft: 'grey', closed: 'red' };

// 45999 -> "₹45,999" — Indian digit grouping, whole-rupee rates.
export function formatCurrency(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

// "2026-09-14" -> "14 Sep 2026"
export function formatShortDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// "2026-07-15", "2026-10-02" -> "Jul 2026 – Oct 2026" (or a single "Jul 2026"
// when every departure date falls in the same month).
export function formatDateRange(fromIso, toIso) {
  if (!fromIso) return null;
  const fmt = (iso) => new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  const from = fmt(fromIso);
  const to = toIso ? fmt(toIso) : from;
  return from === to ? from : `${from} – ${to}`;
}

// "7N/8D", "3 Days / 2 Nights", "10 Days" -> 8, 3, 10 — the trip's total day
// count, i.e. how many sections the Day-by-Day Itinerary Builder should have.
// Matches a digit run immediately (allowing whitespace) followed by a
// "D"/"Day"/"Days" token, so it works with either the nights-first ("7N/8D")
// or days-first ("3 Days / 2 Nights") convention used across the wireframes.
// Returns null when the duration text has no recognizable day count, so
// callers know to leave the itinerary structure untouched rather than reset it.
export function parseDurationDays(duration) {
  if (!duration) return null;
  const match = String(duration).match(/(\d+)\s*d(?:ay)?s?\b/i);
  if (!match) return null;
  const days = Number(match[1]);
  return Number.isFinite(days) && days > 0 ? days : null;
}

// The cheapest tier is the headline "Starting at" price on admin's catalog card.
export function getStartingRate(pkg) {
  const rates = [pkg.rateGold, pkg.rateSilver, pkg.rateBronze].filter((r) => r != null);
  return rates.length ? Math.min(...rates) : null;
}

// Accepts departure-date rows in either shape that flows through this app:
// the agent API's per-date { seatsLeft }, or admin's aggregate
// { seatsTotal, seatsBooked }. Returns the most seats bookable right now.
export function getSeatsLeft(dates) {
  if (!dates || dates.length === 0) return 0;
  return dates.reduce((max, d) => {
    const left = d.seatsLeft ?? Math.max((d.seatsTotal ?? 0) - (d.seatsBooked ?? 0), 0);
    return Math.max(max, left);
  }, 0);
}

// Featured / Bestseller / Flash Deal badges, in the priority both portals
// display them. Fields that are absent/false (e.g. flashDeal — no backend
// support yet) are simply skipped rather than needing a guard at each call site.
export function getFdBadges(pkg) {
  const badges = [];
  if (pkg.isFeatured) badges.push({ tone: 'amber', label: '★ Featured' });
  if (pkg.isBestseller) badges.push({ tone: 'green', label: 'Bestseller' });
  if (pkg.flashDeal) badges.push({ tone: 'red', label: '⚡ Flash Deal' });
  return badges;
}
