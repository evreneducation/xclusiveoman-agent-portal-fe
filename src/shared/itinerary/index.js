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
//   items: [{ key: "type:id", type, id, dayNumber: number|null, position, note? }]
//   dayNotes: { [dayNumber]: string }
// `dayNumber: null` means "not yet placed on a day" (the unassigned pool).
// `note` is a short per-item annotation ("9am pickup"), separate from the
// day's own overall note in `dayNotes`. Server wire shape (what both GET
// responses and the itinerary save payload use):
//   [{ dayNumber, notes, items: [{ type, id, note?, name?, city?, images? }] }]

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

// The pool of placeable items, in selection order — hotels first (plural now
// that the agent builder can pick a different hotel per day, so a trip can
// have more than one), then tours/transfers/activities in whatever order
// they were selected.
export function buildSelectionPool({ hotelIds = [], tourIds = [], transferIds = [], activityIds = [] }) {
  const pool = [];
  for (const id of hotelIds) pool.push({ type: 'hotel', id });
  for (const id of tourIds) pool.push({ type: 'tour', id });
  for (const id of transferIds) pool.push({ type: 'transfer', id });
  for (const id of activityIds) pool.push({ type: 'activity', id });
  return pool;
}

// Keeps `items` in sync with the current selection pool whenever the agent
// changes their hotel/tour/transfer/extra picks elsewhere in the builder:
// drops items for anything deselected, and adds newly-selected items to the
// unassigned tray (dayNumber: null) rather than guessing a day for them.
//
// Matches by (type, id) pair rather than exact `key` membership — the agent
// builder can now place the *same* catalog item (typically a hotel) on more
// than one day, which produces several items sharing a (type, id) but each
// with its own unique `key` (see deserializeItinerary below). Matching on
// `key` alone would only ever keep one of those duplicates; matching on the
// pair keeps every existing instance alive as long as its (type, id) is
// still selected, and only adds a fresh instance for a pool entry that has
// none yet.
export function reconcileItineraryItems(items, pool) {
  const pairKey = (type, id) => itineraryItemKey(type, id);
  const poolPairs = new Set(pool.map((p) => pairKey(p.type, p.id)));
  const kept = items.filter((it) => poolPairs.has(pairKey(it.type, it.id)));
  const keptPairs = new Set(kept.map((it) => pairKey(it.type, it.id)));
  const additions = pool
    .filter((p) => !keptPairs.has(pairKey(p.type, p.id)))
    .map((p, idx) => ({
      key: itineraryItemKey(p.type, p.id),
      type: p.type,
      id: p.id,
      dayNumber: null,
      position: kept.length + idx,
      note: '',
    }));
  return [...kept, ...additions];
}

// Updates a single item's per-item note, by key — the counterpart to
// moveItineraryItem for the one other thing an itinerary item's own chip can
// edit directly (which day/position it's on being the other, handled by
// moveItineraryItem).
export function updateItineraryItemNote(items, key, note) {
  return items.map((it) => (it.key === key ? { ...it, note } : it));
}

// Same shape, for a hotel item's occupancy (Single/Double/Triple — Custom
// FIT only, see roomsForOccupancy) — used by the admin's Quote Inbox
// itinerary editor (QuoteInboxDetail.jsx), which edits existing items by key
// rather than by (dayNumber, type) the way the agent builder's own dedicated
// hotel section does.
export function updateItineraryItemOccupancy(items, key, occupancy) {
  return items.map((it) => (it.key === key ? { ...it, occupancy } : it));
}

// Sends anything assigned to a day beyond the current trip length back to
// the unassigned tray instead of silently discarding it — e.g. shortening
// Travel End Date after Day 5 already had a tour on it.
export function clampItineraryDays(items, dayCount) {
  return items.map((it) => (it.dayNumber != null && it.dayNumber > dayCount ? { ...it, dayNumber: null } : it));
}

// Looks up where a specific item currently sits, by type+id rather than its
// derived key — used by inline "assign to day" controls (rendered right on
// a tour/transfer/extra's own selection card) that only know the item's
// type/id, not its key. Returns null for "not placed yet" (or not in
// `items` at all, e.g. the reconciliation effect hasn't caught up to a
// just-toggled selection on this render).
export function findItineraryItemDay(items, type, id) {
  return items.find((it) => it.key === itineraryItemKey(type, id))?.dayNumber ?? null;
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
    const dayItems = itemsForDay(items, n).map((it) => ({
      type: it.type,
      id: it.id,
      note: it.note || '',
      // Hotel occupancy — two different shapes, each set by only one
      // builder (see schemas.js's itineraryDaySchema for the full story):
      // `adults` — FD packages (admin/pages/FdPackageEditor.jsx).
      // `occupancy` — Custom FIT (agent/pages/PackageBuilder.jsx,
      // admin/pages/QuoteInboxDetail.jsx). Omitted otherwise so neither
      // rides along on the other builder's items, or on MICE's.
      ...(it.type === 'hotel' && it.adults ? { adults: it.adults } : {}),
      ...(it.type === 'hotel' && it.occupancy ? { occupancy: it.occupancy } : {}),
    }));
    const notes = (dayNotes[n] || '').trim();
    if (!notes && dayItems.length === 0) continue;
    days.push({ dayNumber: n, notes, items: dayItems });
  }
  return days;
}

// Builder state -> the full printable/PDF-style itinerary document shape
// (ItineraryDocument.jsx), with each item enriched via `resolveMeta` instead
// of stripped to {type, id}. Every day 1..dayCount is included even when
// empty, so an untouched day still gets its own row/section instead of
// silently vanishing from the document — unlike serializeItinerary, which
// omits empty days since the backend only persists what's actually on a day.
export function buildFullItineraryDays(items, dayNotes, dayCount, resolveMeta) {
  const days = [];
  for (let n = 1; n <= dayCount; n++) {
    days.push({
      dayNumber: n,
      notes: (dayNotes[n] || '').trim(),
      items: itemsForDay(items, n).map((it) => ({ ...(resolveMeta(it) || {}), type: it.type, id: it.id, note: it.note || '' })),
    });
  }
  return days;
}

// The backend's enriched wire shape -> builder state, for hydrating an
// editable session (resuming a draft, or the admin itinerary editor) from
// what's already been saved. Read-only views (Review step, QuoteDetail,
// admin's read-only fallback) can render the wire shape directly and never
// need this.
//
// Keys are always `type:id:dayNumber:index` rather than plain `type:id` —
// the agent builder can save the same catalog item (typically a hotel) on
// more than one day, and a plain `type:id` key would collide across those
// rows. `key` is purely local UI identity (drag/move/note-edit targets,
// React list keys) — it's never sent back to the server, since
// serializeItinerary strips items back down to `{type, id, note}`.
export function deserializeItinerary(itinerary) {
  const items = [];
  const dayNotes = {};
  for (const day of itinerary || []) {
    dayNotes[day.dayNumber] = day.notes || '';
    (day.items || []).forEach((it, idx) => {
      items.push({
        key: `${itineraryItemKey(it.type, it.id)}:${day.dayNumber}:${idx}`,
        type: it.type,
        id: it.id,
        dayNumber: day.dayNumber,
        position: idx,
        note: it.note || '',
        // Hotel occupancy — see serializeItinerary above.
        ...(it.type === 'hotel' && it.adults ? { adults: it.adults } : {}),
        ...(it.type === 'hotel' && it.occupancy ? { occupancy: it.occupancy } : {}),
      });
    });
  }
  return { items, dayNotes };
}

// Looks up an item's display info (name/city/images) from whichever local
// catalog pool matches its type — used by the *editable* builder UIs, where
// items only carry {type, id} until rendered (the read-only wire shape
// already comes back enriched from the backend, via composeItinerary there).
// `hotels` is plural — a trip can now have more than one (the agent builder
// picks a hotel per day) — resolved the same way tours/transfers/activities
// already are.
export function resolveItemMeta(type, id, { hotels, tours, transfers, activities }) {
  if (type === 'hotel') return (hotels || []).find((h) => h.id === id) || null;
  if (type === 'tour') return (tours || []).find((t) => t.id === id) || null;
  if (type === 'transfer') return (transfers || []).find((t) => t.id === id) || null;
  if (type === 'activity') return (activities || []).find((a) => a.id === id) || null;
  return null;
}

// True if any day of a composed itinerary ({dayNumber, notes, items:
// [{type, ...}]}) carries an item of this type — e.g. itineraryHasItemType
// in admin/components/InclusionExclusionList.jsx, hoisted here so read-only
// pages outside admin (agent/pages/DepartureDetail.jsx) can check "does this
// package actually include a hotel/tour/activity" too, without importing an
// admin component into the agent tree.
export function itineraryHasItemType(itinerary, type) {
  return (itinerary || []).some((day) => (day.items || []).some((item) => item.type === type));
}

// "2N Phuket | 2N Krabi" style nights-by-city summary for the departure
// detail page's basic-details card (DepartureDetail.jsx) — walks the
// composed itinerary day by day, takes each day's city from whichever item
// on that day actually carries one (only hotel items do — see
// composeItinerary's `city: ref?.city ?? null` in fdPackages.model.js), and
// tallies how many days land on each city, in first-seen order. A day with
// no hotel item (and so no resolvable city) is simply not counted — it
// doesn't break the running city or introduce an "unknown" entry.
// Each day's one-line title — the admin's own day note when there is one
// (e.g. "Arrival In Phu Quoc"), else the first named itinerary item on that
// day (e.g. a tour called "North Island Tour"), else a plain fallback.
// `day` is one entry of the composed wire shape (fdPackages.model.js's
// composeItinerary): { dayNumber, notes, items: [{ type, id, name, city,
// note }] } — same shape the admin's Day-by-day itinerary builder saves
// (admin/pages/FdPackageEditor.jsx). Shared by DepartureDetail.jsx's own
// day rows and FdItineraryDocument.jsx's PDF rendering of the same data, so
// the two never drift on how a day's title is derived.
export function dayTitle(day) {
  if (day.notes?.trim()) return day.notes.trim();
  const firstNamed = (day.items || []).find((item) => item.name);
  return firstNamed?.name || 'Itinerary details';
}

// One plain bullet line per itinerary item — "<name> · <city> (<note>)", or
// the hotel-only adults/rooms line when there's no note to fold it into
// instead. `meta` is ITINERARY_ITEM_TYPE_META[item.type] above. Shared by
// DepartureDetail.jsx and FdItineraryDocument.jsx for the same reason as
// dayTitle just above.
export function itemBulletText(item, meta) {
  const parts = [item.name || meta?.label || 'Item'];
  if (item.city) parts.push(item.city);
  let text = parts.join(' · ');
  if (item.type === 'hotel' && item.adults != null) {
    text += ` (${item.adults} ${item.adults === 1 ? 'adult' : 'adults'} · ${item.rooms} ${item.rooms === 1 ? 'room' : 'rooms'})`;
  } else if (item.note) {
    text += ` (${item.note})`;
  }
  return text;
}

export function computeNightsByCity(itinerary) {
  const order = [];
  const nightsByCity = new Map();
  for (const day of itinerary || []) {
    const city = (day.items || []).map((item) => item.city).find(Boolean);
    if (!city) continue;
    if (!nightsByCity.has(city)) {
      nightsByCity.set(city, 0);
      order.push(city);
    }
    nightsByCity.set(city, nightsByCity.get(city) + 1);
  }
  return order.map((city) => ({ city, nights: nightsByCity.get(city) }));
}
