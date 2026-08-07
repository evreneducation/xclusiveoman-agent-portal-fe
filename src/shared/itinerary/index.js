// Shared Day-wise Itinerary Planner domain helpers (FIT-5: "Itinerary
// auto-build — Compiled day-by-day, drag-drop reorder").
//
// Both the Agent Custom FIT Builder (agent/pages/PackageBuilder.jsx, plus the
// read-only view in agent/pages/QuoteDetail.jsx) and the Admin Quote Inbox
// (admin/pages/QuoteInboxDetail.jsx) need the exact same day-card/drag-drop
// state machine — the whole point of this feature is that what the agent
// builds and what the admin edits are the same rows, round-tripped through
// the same shape. Pure data/functions only, no JSX — mirrors shared/fdPackage.
//
// Editable state shape used by the two builder UIs:
//   items: [{ key: "type:id", type, id, dayNumber: number|null, position }]
//   dayNotes: { [dayNumber]: string }
// `dayNumber: null` means "not yet placed on a day" (the unassigned pool).
// Server wire shape (what both GET responses and the itinerary save payload
// use): [{ dayNumber, notes, items: [{ type, id, name?, city?, images? }] }]

export const ITINERARY_ITEM_TYPES = ['hotel', 'tour', 'transfer', 'activity'];

export const ITINERARY_ITEM_TYPE_META = {
  hotel: { label: 'Hotel', icon: '🏨' },
  tour: { label: 'Tour', icon: '🎫' },
  transfer: { label: 'Transfer', icon: '🚐' },
  activity: { label: 'Extra', icon: '⭐' },
};

export function itineraryItemKey(type, id) {
  return `${type}:${id}`;
}

// Inclusive day count between two ISO date strings — Day 1..N. Missing or
// invalid dates yield 0 so callers can tell "no trip dates yet" apart from a
// genuine 1-day trip.
export function computeDayCount(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return 0;
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000);
  return Math.max(diffDays + 1, 1);
}

// The pool of placeable items, in selection order — single hotel first (the
// builder is single-select for hotels), then tours/transfers/activities in
// whatever order they were selected.
export function buildSelectionPool({ hotelId, tourIds = [], transferIds = [], activityIds = [] }) {
  const pool = [];
  if (hotelId) pool.push({ type: 'hotel', id: hotelId });
  for (const id of tourIds) pool.push({ type: 'tour', id });
  for (const id of transferIds) pool.push({ type: 'transfer', id });
  for (const id of activityIds) pool.push({ type: 'activity', id });
  return pool;
}

// Keeps `items` in sync with the current selection pool whenever the agent
// changes their hotel/tour/transfer/extra picks elsewhere in the builder:
// drops items for anything deselected, and adds newly-selected items to the
// unassigned tray (dayNumber: null) rather than guessing a day for them.
export function reconcileItineraryItems(items, pool) {
  const poolKeys = new Set(pool.map((p) => itineraryItemKey(p.type, p.id)));
  const kept = items.filter((it) => poolKeys.has(it.key));
  const keptKeys = new Set(kept.map((it) => it.key));
  const additions = pool
    .filter((p) => !keptKeys.has(itineraryItemKey(p.type, p.id)))
    .map((p, idx) => ({
      key: itineraryItemKey(p.type, p.id),
      type: p.type,
      id: p.id,
      dayNumber: null,
      position: kept.length + idx,
    }));
  return [...kept, ...additions];
}

// Sends anything assigned to a day beyond the current trip length back to
// the unassigned tray instead of silently discarding it — e.g. shortening
// Travel End Date after Day 5 already had a tour on it.
export function clampItineraryDays(items, dayCount) {
  return items.map((it) => (it.dayNumber != null && it.dayNumber > dayCount ? { ...it, dayNumber: null } : it));
}

export function itemsForDay(items, dayNumber) {
  return items.filter((it) => it.dayNumber === dayNumber).sort((a, b) => a.position - b.position);
}

export function unassignedItems(items) {
  return itemsForDay(items, null);
}

// The one drag-and-drop primitive both builder UIs call on drop: moves
// `key` into `targetDay` (or back to the unassigned tray if null) at
// `targetIndex` (end of that group if omitted), renumbering positions in the
// destination group so they stay a dense 0..n-1 sequence. Reordering within
// a day is just a same-day move with a different targetIndex.
export function moveItineraryItem(items, key, targetDay, targetIndex) {
  const moving = items.find((it) => it.key === key);
  if (!moving) return items;

  const rest = items.filter((it) => it.key !== key);
  const destGroup = itemsForDay(rest, targetDay);
  const insertAt = targetIndex == null ? destGroup.length : Math.max(0, Math.min(targetIndex, destGroup.length));
  destGroup.splice(insertAt, 0, { ...moving, dayNumber: targetDay });
  const renumberedDest = destGroup.map((it, idx) => ({ ...it, position: idx }));

  const others = rest.filter((it) => it.dayNumber !== targetDay);
  return [...others, ...renumberedDest];
}

// Builder state -> the wire shape POSTed/PATCHed to the backend. Days with
// neither notes nor items are omitted entirely — an untouched Day 7 needs no
// row, matching the backend's "only persist what's actually on the day" model.
export function serializeItinerary(items, dayNotes, dayCount) {
  const days = [];
  for (let n = 1; n <= dayCount; n++) {
    const dayItems = itemsForDay(items, n).map((it) => ({ type: it.type, id: it.id }));
    const notes = (dayNotes[n] || '').trim();
    if (!notes && dayItems.length === 0) continue;
    days.push({ dayNumber: n, notes, items: dayItems });
  }
  return days;
}

// Builder state -> the same wire shape as serializeItinerary, but with each
// item enriched via `resolveMeta` instead of stripped to {type, id} — used
// for a live, pre-submit preview (PackageBuilder's Review step) that renders
// through the exact same read-only <ItineraryTimeline> as the post-submit
// view, so "preview" and "what actually gets submitted" can't drift apart.
export function buildItineraryDays(items, dayNotes, dayCount, resolveMeta) {
  const days = [];
  for (let n = 1; n <= dayCount; n++) {
    const dayItems = itemsForDay(items, n);
    const notes = (dayNotes[n] || '').trim();
    if (!notes && dayItems.length === 0) continue;
    days.push({
      dayNumber: n,
      notes,
      items: dayItems.map((it) => ({ type: it.type, id: it.id, ...(resolveMeta(it) || {}) })),
    });
  }
  return days;
}

// The backend's enriched wire shape -> builder state, for hydrating an
// editable session (resuming a draft, or the admin itinerary editor) from
// what's already been saved. Read-only views (Review step, QuoteDetail,
// admin's read-only fallback) can render the wire shape directly and never
// need this.
export function deserializeItinerary(itinerary) {
  const items = [];
  const dayNotes = {};
  for (const day of itinerary || []) {
    dayNotes[day.dayNumber] = day.notes || '';
    (day.items || []).forEach((it, idx) => {
      items.push({
        key: itineraryItemKey(it.type, it.id),
        type: it.type,
        id: it.id,
        dayNumber: day.dayNumber,
        position: idx,
      });
    });
  }
  return { items, dayNotes };
}

// Looks up an item's display info (name/city/images) from whichever local
// catalog pool matches its type — used by the *editable* builder UIs, where
// items only carry {type, id} until rendered (the read-only wire shape
// already comes back enriched from the backend, via composeItinerary there).
export function resolveItemMeta(type, id, { hotel, tours, transfers, activities }) {
  if (type === 'hotel') return hotel && hotel.id === id ? hotel : null;
  if (type === 'tour') return (tours || []).find((t) => t.id === id) || null;
  if (type === 'transfer') return (transfers || []).find((t) => t.id === id) || null;
  if (type === 'activity') return (activities || []).find((a) => a.id === id) || null;
  return null;
}
