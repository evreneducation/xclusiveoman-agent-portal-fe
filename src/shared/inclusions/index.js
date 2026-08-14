// Package Inclusions — a client-facing bullet list shown under an
// "Inclusions" heading on the Custom FIT Builder's Review step and the
// exported PDF (agent/components/ItineraryDocument.jsx), auto-populated from
// whatever the agent has added to the Day-wise Itinerary Planner
// (hotel/tour/transfer/activity, shared/itinerary/index.js) plus Meals.
// Every line stays individually editable/removable in the builder — see
// reconcileInclusions below for how that survives further itinerary edits.
//
// State shape used by the builder UI:
//   inclusions: [{ id, sourceKey: string|null, text: string }]
//   dismissedKeys: string[]
// `sourceKey` ties a line back to the itinerary item/meal it was generated
// from — `null` for a line the agent typed in by hand (never touched by
// reconciliation). `dismissedKeys` is the set of sourceKeys the agent has
// removed, so a still-selected item's line is never silently added back.
//
// Wire shape (draft save / submit payload, and the backend's own response —
// see 0047_package_request_inclusions.sql on the backend):
//   { items: [{ sourceKey, text }], dismissedKeys: [] }

import { ITINERARY_ITEM_TYPE_META, resolveItemMeta } from '../itinerary/index.js';

let inclusionSeq = 0;
function nextInclusionId() {
  inclusionSeq += 1;
  return `inclusion-${inclusionSeq}-${Date.now()}`;
}

const OCCUPANCY_LABELS = { single: 'Single', double: 'Double', triple: 'Triple' };

// One inclusion candidate per itinerary item, keyed by that item's own
// (already-unique) `key` — so the same hotel placed on two different days
// gets its own line for each day, matching how the itinerary itself treats them.
function lineForItem(item) {
  const typeMeta = ITINERARY_ITEM_TYPE_META[item.type];
  const sourceKey = `item:${item.key}`;
  if (!item.meta) return { sourceKey, text: `${typeMeta?.label || 'Item'} — Day ${item.dayNumber}` };
  if (item.type === 'hotel') {
    const occupancy = item.occupancy ? OCCUPANCY_LABELS[item.occupancy] : null;
    return {
      sourceKey,
      text: `${item.meta.name}${item.meta.city ? ` (${item.meta.city})` : ''} — Day ${item.dayNumber} stay${occupancy ? `, ${occupancy} occupancy` : ''}`,
    };
  }
  return { sourceKey, text: `${item.meta.name} — Day ${item.dayNumber} (${typeMeta?.label || 'Item'})` };
}

// Builder state (itineraryItems + the Meals card's fields on `form`) ->
// candidate inclusion lines: [{ sourceKey, text }]. Pure derivation, no
// editing state involved — reconcileInclusions below is what merges this
// against what the agent has already edited/removed.
export function buildDefaultInclusions(itineraryItems, catalogs, form) {
  const lines = itineraryItems
    .filter((it) => it.dayNumber != null)
    .map((it) => lineForItem({ ...it, meta: resolveItemMeta(it.type, it.id, catalogs) }))
    .filter((line) => line);

  const totalPax = (Number(form?.paxAdults) || 0) + (Number(form?.paxChildren) || 0);
  if (form?.lunchMealId) {
    lines.push({ sourceKey: 'meal:lunch', text: `Lunch for ${form.lunchPeople || totalPax || 0} pax${form.lunchDays ? `, ${form.lunchDays} day${form.lunchDays === 1 ? '' : 's'}` : ''}` });
  }
  if (form?.dinnerMealId) {
    lines.push({ sourceKey: 'meal:dinner', text: `Dinner for ${form.dinnerPeople || totalPax || 0} pax${form.dinnerDays ? `, ${form.dinnerDays} day${form.dinnerDays === 1 ? '' : 's'}` : ''}` });
  }
  return lines;
}

// Reconciles the agent's editable inclusions list against the current set of
// default candidates: adds exactly one line per candidate that has neither
// an existing line nor a prior dismissal, and otherwise leaves `inclusions`
// completely untouched — an already-present line keeps whatever text the
// agent edited it to, and a line whose source item was since removed from
// the itinerary is left in place rather than silently deleted (Inclusions is
// the agent's own editable summary, not a live mirror of the itinerary — see
// PackageBuilder.jsx's ItineraryStep). Returns the same array reference when
// there's nothing new to add, so callers can skip a state update.
export function reconcileInclusions(inclusions, defaults, dismissedKeys) {
  const dismissed = new Set(dismissedKeys);
  const existingSources = new Set(inclusions.filter((i) => i.sourceKey).map((i) => i.sourceKey));
  const additions = defaults
    .filter((d) => !existingSources.has(d.sourceKey) && !dismissed.has(d.sourceKey))
    .map((d) => ({ id: nextInclusionId(), sourceKey: d.sourceKey, text: d.text }));
  return additions.length ? [...inclusions, ...additions] : inclusions;
}

export function updateInclusionText(inclusions, id, text) {
  return inclusions.map((i) => (i.id === id ? { ...i, text } : i));
}

// Removing a line is permanent (until the agent re-adds it by hand) even
// while its source item stays selected in the itinerary — the caller must
// also fold the removed line's sourceKey into `dismissedKeys` so the next
// reconciliation pass doesn't just add it straight back.
export function removeInclusion(inclusions, id) {
  return inclusions.filter((i) => i.id !== id);
}

export function addCustomInclusion(inclusions, text) {
  return [...inclusions, { id: nextInclusionId(), sourceKey: null, text }];
}

// Builder state -> the wire shape POSTed/PATCHed to the backend. Blank lines
// (an agent who cleared the text box rather than deleting the row) are
// dropped rather than saved as empty bullets.
export function serializeInclusions(inclusions, dismissedKeys) {
  return {
    items: inclusions.filter((i) => (i.text || '').trim()).map((i) => ({ sourceKey: i.sourceKey ?? null, text: i.text.trim() })),
    dismissedKeys: dismissedKeys || [],
  };
}

// The backend's wire shape -> builder state, for hydrating an editable
// session (resuming a draft). Read-only views (Review step's already-loaded
// document, QuoteDetail, PDF) never need this — they just render `text`.
export function deserializeInclusions(wire) {
  const items = (wire?.items || []).map((i) => ({ id: nextInclusionId(), sourceKey: i.sourceKey ?? null, text: i.text || '' }));
  return { inclusions: items, dismissedKeys: wire?.dismissedKeys || [] };
}

// Plain display strings, in order — what ItineraryDocument.jsx (and so the
// PDF, which just renders that same component) prints under "Inclusions".
export function inclusionTexts(inclusions) {
  return inclusions.filter((i) => (i.text || '').trim()).map((i) => i.text.trim());
}
