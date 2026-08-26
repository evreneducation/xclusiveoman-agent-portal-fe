import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, ErrorText, FieldLabel, Select, Table, Tag, TextInput } from '../components/ui.jsx';
import { InclusionExclusionList, itineraryHasItemType, linesFromText, textFromLines } from '../components/InclusionExclusionList.jsx';
import { formatCurrency } from '../../shared/fdPackage/index.js';
import { RichTextDisplay, RichTextEditor } from '../../shared/components/RichTextEditor.jsx';
import {
  ITINERARY_ITEM_TYPE_META,
  buildSelectionPool,
  computeDayCount,
  deserializeItinerary,
  itemsForDay,
  moveItineraryItem,
  reconcileItineraryItems,
  resolveItemMeta,
  serializeItinerary,
  unassignedItems,
  updateItineraryItemOccupancy,
  updateItineraryItemNote,
} from '../../shared/itinerary/index.js';

const STATUS_TONE = {
  submitted: 'amber',
  assigned: 'grey',
  costed: 'grey',
  published: 'green',
  accepted: 'green',
  revision_requested: 'amber',
  declined: 'red',
  expired: 'red',
  converted: 'green',
};

function formatStatus(status) {
  return status.replace(/_/g, ' ');
}

function CatalogGrid({ label, items, empty, renderMeta }) {
  return (
    <Card label={label} className="border-white">
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-line-light p-3 shadow-sm">
              {item.images?.[0] ? (
                <img src={item.images[0]} alt="" className="h-24 w-full rounded-md border border-line-light object-cover" />
              ) : item.images !== undefined ? (
                <div className="flex h-24 w-full items-center justify-center rounded-md border border-dashed border-line-light font-mono text-[9px] text-muted">
                  No image
                </div>
              ) : null}
              <div className="mt-2 text-sm font-bold">{item.name}</div>
              <div className="text-xs text-muted">{renderMeta(item)}</div>
              <RichTextDisplay html={item.description} className="mt-1 text-xs text-muted" />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function LeadManagerAssignment({ packageRequest, onUpdated }) {
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(packageRequest.leadManager?.id || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get('/admin/package-requests/lead-manager-candidates')
      .then(({ staff }) => setCandidates(staff))
      .catch((err) => setError(err.message || 'Unable to load staff'));
  }, []);

  useEffect(() => {
    setSelected(packageRequest.leadManager?.id || '');
  }, [packageRequest.leadManager]);

  async function handleAssign() {
    setError('');
    setSubmitting(true);
    try {
      const { packageRequest: updated } = await api.patch(`/admin/package-requests/${packageRequest.id}/lead-manager`, {
        leadManagerUserId: selected || null,
      });
      onUpdated(updated);
    } catch (err) {
      setError(err.message || 'Unable to assign Lead Manager');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label="Lead Manager" className="border-white">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <FieldLabel>Assign a Lead Manager</FieldLabel>
          <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Unassigned</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} — {c.role.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="accent" disabled={submitting} onClick={handleAssign}>
          {submitting ? 'Saving…' : 'Save Assignment'}
        </Button>
      </div>
      {packageRequest.leadManager && (
        <p className="mt-3 text-xs text-muted">
          Currently assigned to <span className="font-semibold text-ink">{packageRequest.leadManager.fullName}</span> (
          {packageRequest.leadManager.email})
        </p>
      )}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function sumPrices(items, key) {
  return (items || []).reduce((total, item) => total + (Number(item[key]) || 0), 0);
}

// capacity = adults per room for that occupancy type — mirrors the backend's
// roomsForOccupancy (src/utils/occupancy.js). Unset/unrecognized defaults to
// 'double' (2/room), same baseline the backend falls back to.
const OCCUPANCY_CAPACITY = { single: 1, double: 2, triple: 3 };

function roomsForOccupancy(totalAdults, occupancy) {
  const capacity = OCCUPANCY_CAPACITY[occupancy] || OCCUPANCY_CAPACITY.double;
  const n = Number(totalAdults) || 0;
  return n > 0 ? Math.ceil(n / capacity) : 1;
}

// Occupancy-tiered pricing (0061_hotel_occupancy_pricing.sql) — a hotel's
// cost for a given placement now depends on which occupancy tier was chosen
// (item.occupancy), not one flat pricePerNight regardless of tier. Hotels
// are still priced per itinerary-day placement (a hotel used on 3 days
// counts 3 times), unlike tours/transfers/extras below which still sum once
// per selected item — mirrors the backend's computeHotelCostAuto
// (packageRequestsAdmin.controller.js) so the two never drift. Uses each
// item's already-server-computed `rooms` (composeItinerary resolved it
// against packageRequest.paxAdults) rather than re-deriving it, since this
// reads the last-saved itinerary, not any in-progress edit in
// ItineraryEditor below (a separate component with its own local state). A
// hotel that doesn't offer the chosen tier contributes nothing for that
// placement, same as the backend — never silently priced off a different tier.
const OCCUPANCY_PRICE_FIELD = { single: 'singlePrice', double: 'doublePrice', triple: 'triplePrice' };

function computeHotelAuto(itinerary, hotels) {
  let total = 0;
  for (const day of itinerary || []) {
    for (const item of day.items || []) {
      if (item.type !== 'hotel') continue;
      const hotel = (hotels || []).find((h) => h.id === item.id);
      if (!hotel) continue;
      const field = OCCUPANCY_PRICE_FIELD[item.occupancy] || OCCUPANCY_PRICE_FIELD.double;
      const tierPrice = hotel[field];
      if (tierPrice == null) continue;
      total += Number(tierPrice) * (item.rooms || 1);
    }
  }
  return total;
}

// One Landing Cost Breakdown row: the Product Catalog auto total for this
// component, an editable override, and the effective total (override if
// set, otherwise auto) — matches item 2's "Auto: ₹60,000 / Editable: ₹58,500"
// example. An empty override input means "use the auto total".
function CostComponentField({ label, auto, value, onChange }) {
  const total = value !== '' ? Number(value) : auto;
  return (
    <div className="grid grid-cols-1 gap-2 rounded-md border border-line-light p-3 sm:grid-cols-3 sm:items-center">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted">Auto (Product Catalog): {formatCurrency(auto)}</div>
      </div>
      <div>
        <FieldLabel>Override</FieldLabel>
        <TextInput
          type="number"
          min="0"
          placeholder={`Auto — ${formatCurrency(auto)}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <div className="sm:text-right">
        <div className="text-[10px] font-semibold uppercase text-muted">{label} total</div>
        <div className="text-sm font-bold">{formatCurrency(total)}</div>
      </div>
    </div>
  );
}

const MARKUP_TYPES = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'fixed', label: 'Fixed Amount' },
];

// Landing Cost Breakdown, Editable Costing, Pricing & Markup, Quote Summary,
// Internal Notes, and Save Draft / Publish Quote (items 1-6) — one component
// since they all share the same live-recalculated figures and the same save.
// Inclusions/Exclusions editing (linesFromText/textFromLines/
// itineraryHasItemType/InclusionExclusionList) lives in admin/components/
// InclusionExclusionList.jsx — shared with FdPackageEditor.jsx, which needs
// the exact same behavior.

function CostingAndPublishing({ packageRequest, onUpdated }) {
  const [hotelCost, setHotelCost] = useState(packageRequest.costing?.hotels?.override ?? '');
  const [tourCost, setTourCost] = useState(packageRequest.costing?.tours?.override ?? '');
  const [transferCost, setTransferCost] = useState(packageRequest.costing?.transfers?.override ?? '');
  const [extraCost, setExtraCost] = useState(packageRequest.costing?.extras?.override ?? '');
  const [mealCost, setMealCost] = useState(packageRequest.costing?.meals?.override ?? '');
  const [visaCost, setVisaCost] = useState(packageRequest.costing?.visa?.override ?? '');
  const [markupType, setMarkupType] = useState(packageRequest.markupType || 'percentage');
  const [markupValue, setMarkupValue] = useState(packageRequest.markupValue ?? '');
  const [internalNotes, setInternalNotes] = useState(packageRequest.internalNotes || '');
  // Inclusions/Exclusions — client-facing, unlike internalNotes above: shown
  // read-only on the agent's own quote view once this quote is published
  // (agent/pages/QuoteDetail.jsx), same as Final Selling Price. Each is a
  // list of individually add/edit/removable points (InclusionExclusionList
  // below), not raw text — persisted as one point per line.
  //
  // A brand-new quote (nothing saved yet) seeds Inclusions from what the
  // agent actually put together — a hotel on any day adds "Accommodation", a
  // tour adds "Tour as per itinerary", a transfer adds "Travel as per
  // itinerary", an activity adds "Activity as per itinerary", a selected
  // lunch/dinner add-on adds "Meals", and the Visa checkbox adds "Visa" — so
  // the admin starts from a sensible default instead of a blank list, and
  // can still add more from the catalog dropdown or edit/remove any of
  // these same as a manually-added point (InclusionExclusionList below) —
  // the two ways of building this list aren't exclusive. Only fires once,
  // for an empty starting point; a quote that already has saved inclusions
  // (including one where the admin deliberately removed one of these) is
  // left exactly as saved.
  const [inclusions, setInclusions] = useState(() => {
    const saved = linesFromText(packageRequest.inclusions);
    if (saved.length > 0) return saved;
    const seeded = [];
    if (itineraryHasItemType(packageRequest.itinerary, 'hotel')) seeded.push('Accommodation');
    if (itineraryHasItemType(packageRequest.itinerary, 'tour')) seeded.push('Tour as per itinerary');
    if (itineraryHasItemType(packageRequest.itinerary, 'transfer')) seeded.push('Travel as per itinerary');
    if (itineraryHasItemType(packageRequest.itinerary, 'activity')) seeded.push('Activity as per itinerary');
    if (packageRequest.lunchMealId || packageRequest.dinnerMealId) seeded.push('Meals');
    if (packageRequest.visaEnabled) seeded.push('Visa');
    return seeded;
  });
  const [exclusions, setExclusions] = useState(() => linesFromText(packageRequest.exclusions));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');

  // Computed straight from the Product Catalog prices already on
  // packageRequest.hotels/tours/transfers/activities — recalculates on every
  // keystroke without a round trip, then persisted verbatim by the backend
  // (same formula) on save so the two never drift. Meals is the one
  // exception — nothing on this page can change the agent's lunch/dinner
  // selection live, so its auto figure is just read straight off
  // packageRequest.mealsCostAuto (computed fresh server-side on every GET)
  // rather than mirrored client-side like the other four. Visa (visaAuto) is
  // the same story — its headcount is fixed once the agent submits, nothing
  // here changes it live either.
  const totalPax = (packageRequest.paxAdults || 0) + (packageRequest.paxChildren || 0);
  const hotelAuto = computeHotelAuto(packageRequest.itinerary, packageRequest.hotels);
  const tourAuto = sumPrices(packageRequest.tours, 'price');
  const transferAuto = sumPrices(packageRequest.transfers, 'price');
  const extraAuto = sumPrices(packageRequest.activities, 'pricePerPax') * Math.max(totalPax, 1);
  const mealAuto = packageRequest.mealsCostAuto || 0;
  const visaAuto = packageRequest.visaCostAuto || 0;

  const hotelTotal = hotelCost !== '' ? Number(hotelCost) : hotelAuto;
  const tourTotal = tourCost !== '' ? Number(tourCost) : tourAuto;
  const transferTotal = transferCost !== '' ? Number(transferCost) : transferAuto;
  const extraTotal = extraCost !== '' ? Number(extraCost) : extraAuto;
  const mealTotal = mealCost !== '' ? Number(mealCost) : mealAuto;
  const visaTotal = visaCost !== '' ? Number(visaCost) : visaAuto;
  const landingCost = hotelTotal + tourTotal + transferTotal + extraTotal + mealTotal + visaTotal;

  const markupNumber = Number(markupValue) || 0;
  const markupAmount = markupType === 'percentage' ? (landingCost * markupNumber) / 100 : markupNumber;
  const sellPrice = landingCost + markupAmount;

  const isPublished = ['published', 'accepted', 'declined', 'expired', 'converted'].includes(packageRequest.status);

  function buildPayload() {
    return {
      hotelCost: hotelCost === '' ? null : Number(hotelCost),
      tourCost: tourCost === '' ? null : Number(tourCost),
      transferCost: transferCost === '' ? null : Number(transferCost),
      extraCost: extraCost === '' ? null : Number(extraCost),
      mealCost: mealCost === '' ? null : Number(mealCost),
      visaCost: visaCost === '' ? null : Number(visaCost),
      markupType,
      markupValue: markupNumber,
      internalNotes,
      inclusions: textFromLines(inclusions),
      exclusions: textFromLines(exclusions),
    };
  }

  async function saveDraft() {
    setError('');
    setSubmitting('draft');
    try {
      const { packageRequest: updated } = await api.patch(`/admin/package-requests/${packageRequest.id}/costing`, buildPayload());
      onUpdated(updated);
    } catch (err) {
      setError(err.message || 'Unable to save costing');
    } finally {
      setSubmitting('');
    }
  }

  // Item 9: block obviously-invalid publishes before the round trip, but the
  // backend re-validates against what actually got saved either way.
  async function publishQuote() {
    setError('');
    if (!packageRequest.leadManager) {
      setError('Assign a Lead Manager before publishing.');
      return;
    }
    if (!(landingCost > 0)) {
      setError('Landing Cost must be greater than zero before publishing.');
      return;
    }
    setSubmitting('publish');
    try {
      // Save first so costing/markup/notes are persisted even if the publish
      // step below fails validation — nothing the admin just typed is lost.
      const { packageRequest: saved } = await api.patch(`/admin/package-requests/${packageRequest.id}/costing`, buildPayload());
      onUpdated(saved);
      const { packageRequest: published } = await api.post(`/admin/package-requests/${packageRequest.id}/publish`);
      onUpdated(published);
    } catch (err) {
      setError(err.message || 'Unable to publish quote');
    } finally {
      setSubmitting('');
    }
  }

  return (
    <>
      <Card label="Landing Cost Breakdown" className="border-white">
        <p className="mb-3 text-xs text-muted">
          Auto-calculated from the selected items' Product Catalog prices. Override any component below — Landing
          Cost recalculates immediately.
        </p>
        <div className="space-y-3">
          <CostComponentField label="Hotels" auto={hotelAuto} value={hotelCost} onChange={setHotelCost} />
          <CostComponentField label="Tours" auto={tourAuto} value={tourCost} onChange={setTourCost} />
          <CostComponentField label="Transfers" auto={transferAuto} value={transferCost} onChange={setTransferCost} />
          <CostComponentField label="Extras" auto={extraAuto} value={extraCost} onChange={setExtraCost} />
          <CostComponentField label="Meals" auto={mealAuto} value={mealCost} onChange={setMealCost} />
          <CostComponentField label="Visa" auto={visaAuto} value={visaCost} onChange={setVisaCost} />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-md bg-panel px-4 py-3">
          <span className="text-sm font-semibold">Landing Cost</span>
          <span className="text-lg font-bold">{formatCurrency(landingCost)}</span>
        </div>
      </Card>

      <Card label="Pricing & Markup" className="border-white">
        <FieldLabel>Markup type</FieldLabel>
        <div className="mb-3 flex flex-wrap gap-2">
          {MARKUP_TYPES.map((m) => (
            <button key={m.value} type="button" onClick={() => setMarkupType(m.value)}>
              <Tag active={markupType === m.value}>{m.label}</Tag>
            </button>
          ))}
        </div>
        <div className="max-w-xs">
          <FieldLabel>{markupType === 'percentage' ? 'Percentage (%)' : 'Fixed amount (INR)'}</FieldLabel>
          <TextInput
            type="number"
            min="0"
            step={markupType === 'percentage' ? '0.1' : '1'}
            placeholder={markupType === 'percentage' ? 'e.g. 15' : 'e.g. 10000'}
            value={markupValue}
            onChange={(e) => setMarkupValue(e.target.value)}
          />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-md bg-panel px-4 py-3">
          <span className="text-sm font-semibold">Final Selling Price</span>
          <span className="text-lg font-bold text-accent">{formatCurrency(sellPrice)}</span>
        </div>
      </Card>

      <Card label="Quote summary" className="border-white">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-md bg-panel px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase text-muted">Landing Cost</dt>
            <dd className="text-base font-bold">{formatCurrency(landingCost)}</dd>
          </div>
          <div className="rounded-md bg-panel px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase text-muted">
              Markup {markupType === 'percentage' ? `(${markupNumber || 0}%)` : '(Fixed)'}
            </dt>
            <dd className="text-base font-bold">{formatCurrency(markupAmount)}</dd>
          </div>
          <div className="rounded-md bg-panel px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase text-muted">Final Selling Price</dt>
            <dd className="text-base font-bold text-accent">{formatCurrency(sellPrice)}</dd>
          </div>
        </dl>
      </Card>

      {/* Inclusions/Exclusions — client-facing, shown read-only on the
          agent's own quote view once this quote is published (agent/pages/
          QuoteDetail.jsx), same as Final Selling Price above. Each point is
          picked from the Product Catalog's Inclusions/Exclusions tab (or
          pre-seeded from the itinerary — see itineraryHasItemType above),
          then freely editable/removable in place. */}
      <Card label="Inclusions & Exclusions — shown to the agent once published" className="border-white">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InclusionExclusionList catalogEntityPath="inclusions" label="Inclusions" items={inclusions} onItemsChange={setInclusions} />
          <InclusionExclusionList catalogEntityPath="exclusions" label="Exclusions" items={exclusions} onItemsChange={setExclusions} />
        </div>
      </Card>

      <Card label="Internal notes — admin only, never shown to the agent" className="border-white">
        <RichTextEditor size="sm" value={internalNotes} onChange={setInternalNotes} />
      </Card>

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!!submitting} onClick={saveDraft}>
          {submitting === 'draft' ? 'Saving…' : 'Save Draft'}
        </Button>
        <Button variant="accent" disabled={!!submitting || isPublished} onClick={publishQuote}>
          {submitting === 'publish' ? 'Publishing…' : isPublished ? 'Published' : 'Publish Quote'}
        </Button>
        {packageRequest.publishedAt && (
          <span className="text-xs text-muted">
            Published {new Date(packageRequest.publishedAt).toLocaleString()}
            {packageRequest.publishedBy?.fullName ? ` by ${packageRequest.publishedBy.fullName}` : ''}
          </span>
        )}
      </div>
    </>
  );
}

const OCCUPANCY_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'triple', label: 'Triple' },
];

// Occupancy-tiered pricing (0061_hotel_occupancy_pricing.sql) — the picker
// only ever shows the tiers the selected hotel actually has priced
// (singlePrice/doublePrice/triplePrice), so admin can't pick a tier that
// silently prices at ₹0 (computeHotelAuto above already treats a missing
// tier as "no contribution"; this stops that mismatch from ever being
// picked in the first place). Falls back to showing every option
// (unfiltered) when `hotel` isn't loaded yet, rather than briefly rendering
// an empty dropdown.
function occupancyOptionsFor(hotel) {
  if (!hotel) return OCCUPANCY_OPTIONS;
  const available = OCCUPANCY_OPTIONS.filter((o) => hotel[OCCUPANCY_PRICE_FIELD[o.value]] != null);
  return available.length > 0 ? available : OCCUPANCY_OPTIONS;
}

// A single draggable placed/unplaced item — mirrors the agent builder's
// ItineraryItemChip (agent/pages/PackageBuilder.jsx), themed for the admin
// console. Dropping directly on a chip inserts before it, which is what lets
// ItineraryDayCard support reordering within a day. No delete control here
// (unlike the agent's chip) — the admin has no UI to deselect a hotel/tour/
// transfer/extra from the request itself, so there's nothing for a "remove
// from the trip entirely" action to do; only its own note (and, for hotels,
// occupancy) is editable. Occupancy drives the Landing Cost Breakdown's
// hotelAuto (see computeHotelAuto above) — the admin can correct what the
// agent set, same as they can override the note. `paxAdults` (Trip Details'
// fixed headcount) is what the occupancy pick actually divides into rooms —
// see roomsForOccupancy.
function ItineraryItemChip({ item, meta, isDragging, onDragStart, onDragEnd, onDropBefore, onNoteChange, onOccupancyChange, onUnassign, paxAdults }) {
  const typeMeta = ITINERARY_ITEM_TYPE_META[item.type];
  const rooms = roomsForOccupancy(paxAdults, item.occupancy);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropBefore}
      className={`rounded-md border border-line-light bg-white px-2.5 py-2 text-xs shadow-sm ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex cursor-grab items-center gap-2 active:cursor-grabbing">
        <span className="flex-none">{typeMeta?.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{meta?.name || 'Unknown item'}</div>
          <div className="truncate text-[10px] text-muted">
            {typeMeta?.label}
            {meta?.city ? ` · ${meta.city}` : ''}
          </div>
        </div>
        {onUnassign && (
          <button type="button" onClick={onUnassign} title="Move back to unassigned" className="flex-none text-muted hover:text-ink">
            ×
          </button>
        )}
      </div>
      {item.type === 'hotel' && onOccupancyChange && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase text-muted">Occupancy</span>
          <Select
            className="w-24 px-1.5 py-1 text-[11px]"
            value={item.occupancy || 'double'}
            onChange={(e) => onOccupancyChange(e.target.value)}
          >
            {occupancyOptionsFor(meta).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <span className="text-[10px] text-muted">
            {rooms} room{rooms === 1 ? '' : 's'}
          </span>
        </div>
      )}
      {onNoteChange && (
        <TextInput
          className="mt-1.5 px-2 py-1.5 text-[11px]"
          placeholder="Add a note (optional)…"
          value={item.note || ''}
          onChange={(e) => onNoteChange(e.target.value)}
        />
      )}
    </div>
  );
}

// One numbered timeline node, editable — same drop-target-within-a-drop-target
// structure as the agent builder's ItineraryDayCard.
function ItineraryDayCard({ dayNumber, items, notes, onNotesChange, resolveMeta, draggingKey, setDraggingKey, moveItem, updateNote, updateOccupancy, paxAdults, isLast }) {
  return (
    <div className="relative flex gap-4 pb-5 last:pb-0">
      {!isLast && <span className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-line-light" />}
      <span className="relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ink text-xs font-bold text-white shadow-sm">
        {dayNumber}
      </span>
      <div className="flex-1 pt-0.5">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-accent">Day {dayNumber}</div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => moveItem(e.dataTransfer.getData('text/plain'), dayNumber)}
          className="mb-2 min-h-[52px] space-y-1.5 rounded-md border border-dashed border-line-light bg-panel/40 p-2"
        >
          {items.length === 0 ? (
            <p className="py-2 text-center text-[11px] text-muted">Drag items here</p>
          ) : (
            items.map((item, idx) => (
              <ItineraryItemChip
                key={item.key}
                item={item}
                meta={resolveMeta(item)}
                isDragging={draggingKey === item.key}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', item.key);
                  setDraggingKey(item.key);
                }}
                onDragEnd={() => setDraggingKey(null)}
                onDropBefore={(e) => {
                  e.stopPropagation();
                  moveItem(e.dataTransfer.getData('text/plain'), dayNumber, idx);
                }}
                onNoteChange={(note) => updateNote(item.key, note)}
                onOccupancyChange={(occupancy) => updateOccupancy(item.key, occupancy)}
                onUnassign={() => moveItem(item.key, null)}
                paxAdults={paxAdults}
              />
            ))
          )}
        </div>
        <TextInput placeholder="Notes for this day (optional)…" value={notes} onChange={(e) => onNotesChange(e.target.value)} />
      </div>
    </div>
  );
}

// Day-wise Itinerary Planner (FIT-5) — admin edit. Reuses the exact same
// shared/itinerary helpers and drag-drop model as the agent builder; only
// the theming (admin ui.jsx components/classes) differs. Local state is
// seeded once from packageRequest.itinerary via lazy useState — deliberately
// not re-synced on every packageRequest prop update (same convention as
// CostingAndPublishing's override fields below), so an in-progress drag
// isn't wiped out by an unrelated save (e.g. Lead Manager assignment)
// elsewhere on this page re-fetching the request.
function ItineraryEditor({ packageRequest, onUpdated }) {
  const dayCount = computeDayCount(packageRequest.dateFrom, packageRequest.dateTo);
  const [itineraryItems, setItineraryItems] = useState(() => deserializeItinerary(packageRequest.itinerary).items);
  const [dayNotes, setDayNotes] = useState(() => deserializeItinerary(packageRequest.itinerary).dayNotes);
  const [draggingKey, setDraggingKey] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // The admin can't change *which* hotel/tours/transfers/extras are on this
  // request from here — only how they're arranged into days — so this only
  // ever adds/removes items if the underlying selections themselves change
  // (there's currently no admin UI that does that, but it keeps this correct
  // if that changes) rather than resyncing the whole editor.
  useEffect(() => {
    const pool = buildSelectionPool({
      hotelIds: packageRequest.hotels.map((h) => h.id),
      tourIds: packageRequest.tours.map((t) => t.id),
      transferIds: packageRequest.transfers.map((t) => t.id),
      activityIds: packageRequest.activities.map((a) => a.id),
    });
    setItineraryItems((items) => reconcileItineraryItems(items, pool));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageRequest.hotels, packageRequest.tours, packageRequest.transfers, packageRequest.activities]);

  function resolveMeta(item) {
    return resolveItemMeta(item.type, item.id, {
      hotels: packageRequest.hotels,
      tours: packageRequest.tours,
      transfers: packageRequest.transfers,
      activities: packageRequest.activities,
    });
  }

  function moveItem(key, targetDay, targetIndex) {
    setItineraryItems((items) => moveItineraryItem(items, key, targetDay, targetIndex));
  }

  function updateNote(key, note) {
    setItineraryItems((items) => updateItineraryItemNote(items, key, note));
  }

  function updateOccupancy(key, occupancy) {
    setItineraryItems((items) => updateItineraryItemOccupancy(items, key, occupancy));
  }

  async function save() {
    setError('');
    setSaving(true);
    try {
      const { packageRequest: updated } = await api.patch(`/admin/package-requests/${packageRequest.id}/itinerary`, {
        days: serializeItinerary(itineraryItems, dayNotes, dayCount),
      });
      onUpdated(updated);
    } catch (err) {
      setError(err.message || 'Unable to save itinerary');
    } finally {
      setSaving(false);
    }
  }

  const pool = unassignedItems(itineraryItems);

  return (
    <Card label="Day-wise itinerary" className="border-white">
      <p className="mb-4 text-xs text-muted">
        Drag the agent's selected hotel, tours, transfers, and extras onto the day they happen, reorder within a day,
        or edit the notes. Saved changes are shown back to the agent exactly as arranged here.
      </p>

      {dayCount === 0 ? (
        <p className="rounded-md border border-dashed border-line-light bg-panel/40 p-4 text-center text-sm text-muted">
          This request has no travel dates set — the itinerary can't be built until it does.
        </p>
      ) : (
        <>
          <div className="mb-5">
            <FieldLabel>Unassigned items</FieldLabel>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => moveItem(e.dataTransfer.getData('text/plain'), null)}
              className="flex min-h-[56px] flex-wrap gap-2 rounded-md border border-dashed border-line-light bg-panel/40 p-2.5"
            >
              {pool.length === 0 ? (
                <p className="py-2 text-[11px] text-muted">
                  {itineraryItems.length === 0
                    ? 'Nothing to place — the agent selected no hotel/tours/transfers/extras.'
                    : 'Everything is placed on a day.'}
                </p>
              ) : (
                pool.map((item) => (
                  <div key={item.key} className="w-full sm:w-64">
                    <ItineraryItemChip
                      item={item}
                      meta={resolveMeta(item)}
                      isDragging={draggingKey === item.key}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', item.key);
                        setDraggingKey(item.key);
                      }}
                      onDragEnd={() => setDraggingKey(null)}
                      onDropBefore={(e) => {
                        e.stopPropagation();
                        const idx = pool.findIndex((p) => p.key === item.key);
                        moveItem(e.dataTransfer.getData('text/plain'), null, idx);
                      }}
                      onNoteChange={(note) => updateNote(item.key, note)}
                      onOccupancyChange={(occupancy) => updateOccupancy(item.key, occupancy)}
                      paxAdults={packageRequest.paxAdults}
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            {Array.from({ length: dayCount }, (_, i) => i + 1).map((dayNumber) => (
              <ItineraryDayCard
                key={dayNumber}
                dayNumber={dayNumber}
                items={itemsForDay(itineraryItems, dayNumber)}
                notes={dayNotes[dayNumber] || ''}
                onNotesChange={(value) => setDayNotes((n) => ({ ...n, [dayNumber]: value }))}
                resolveMeta={resolveMeta}
                draggingKey={draggingKey}
                setDraggingKey={setDraggingKey}
                moveItem={moveItem}
                updateNote={updateNote}
                updateOccupancy={updateOccupancy}
                paxAdults={packageRequest.paxAdults}
                isLast={dayNumber === dayCount}
              />
            ))}
          </div>
        </>
      )}

      <ErrorText>{error}</ErrorText>
      <div className="mt-4">
        <Button variant="accent" disabled={saving || dayCount === 0} onClick={save}>
          {saving ? 'Saving…' : 'Save Itinerary'}
        </Button>
      </div>
    </Card>
  );
}

function ActivityHistory({ history }) {
  return (
    <Card label="Activity history" className="border-white">
      {!history || history.length === 0 ? (
        <p className="text-sm text-muted">No activity yet.</p>
      ) : (
        <ol className="space-y-3 border-l-2 border-line-light pl-4">
          {history.map((event, idx) => (
            <li key={idx} className="relative">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-ink" />
              <div className="text-sm font-semibold">{event.label}</div>
              <div className="text-xs text-muted">
                {event.at ? new Date(event.at).toLocaleString() : '—'}
                {event.by ? ` · ${event.by}` : ''}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default function QuoteInboxDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [packageRequest, setPackageRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    api
      .get(`/admin/package-requests/${id}`)
      .then(({ packageRequest: pr }) => setPackageRequest(pr))
      .catch((err) => setError(err.message || 'Unable to load request'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-5xl space-y-4 p-6 lg:p-10">
        <button onClick={() => navigate('/admin/quote-inbox')} className="text-xs text-muted hover:text-ink">
          ← Back to Quote Inbox
        </button>

        {loading && <p className="text-sm text-muted">Loading…</p>}
        <ErrorText>{error}</ErrorText>

        {packageRequest && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">Custom FIT Request</h2>
                <p className="font-mono text-xs text-muted">Quote ID: {packageRequest.id}</p>
              </div>
              <Badge tone={STATUS_TONE[packageRequest.status] || 'grey'}>{formatStatus(packageRequest.status)}</Badge>
            </div>

            <Card label="Trip information" className="border-white">
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Agency</dt>
                  <dd>{packageRequest.agencyName}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Agent</dt>
                  <dd>
                    {packageRequest.agentName}
                    <div className="text-xs text-muted">{packageRequest.agentEmail}</div>
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Submitted</dt>
                  <dd>{new Date(packageRequest.submittedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Destination</dt>
                  <dd>{packageRequest.destination}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Travel dates</dt>
                  <dd>
                    {new Date(packageRequest.dateFrom).toLocaleDateString()} – {new Date(packageRequest.dateTo).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Pax</dt>
                  <dd>
                    {packageRequest.paxAdults} adult{packageRequest.paxAdults === 1 ? '' : 's'}
                    {packageRequest.paxChildren ? `, ${packageRequest.paxChildren} child${packageRequest.paxChildren === 1 ? '' : 'ren'}` : ''}
                  </dd>
                </div>
              </dl>
            </Card>

            <LeadManagerAssignment packageRequest={packageRequest} onUpdated={setPackageRequest} />

            <Card label="Traveller details" className="border-white">
              {packageRequest.travelers.length === 0 ? (
                <p className="text-sm text-muted">No traveller details captured.</p>
              ) : (
                <Table
                  columns={['Name', 'Passport No.', 'DOB', 'Room share']}
                  rows={packageRequest.travelers}
                  renderRow={(t) => (
                    <tr key={t.id} className="border-b border-line-light last:border-0">
                      <td className="px-3 py-2 font-semibold">{t.name}</td>
                      <td className="px-3 py-2">{t.passportNo || '—'}</td>
                      <td className="px-3 py-2">{t.dob ? new Date(t.dob).toLocaleDateString() : '—'}</td>
                      <td className="px-3 py-2">{t.roomShareGroup || '—'}</td>
                    </tr>
                  )}
                />
              )}
            </Card>

            <CatalogGrid
              label="Selected hotel(s)"
              items={packageRequest.hotels}
              empty="No hotel selected."
              renderMeta={(h) => `${h.city || '—'}${h.category ? ` · ${h.category}★` : ''}`}
            />
            <CatalogGrid
              label="Selected tour(s)"
              items={packageRequest.tours}
              empty="No tours selected."
              renderMeta={(t) => `${t.city || '—'}${t.category ? ` · ${t.category}` : ''}${t.duration ? ` · ${t.duration}` : ''}`}
            />
            <CatalogGrid
              label="Selected transfer(s)"
              items={packageRequest.transfers}
              empty="No transfers selected."
              renderMeta={(t) => `${t.type ? t.type.replace(/_/g, ' ') : '—'}${t.vehicleClass ? ` · ${t.vehicleClass}` : ''}${t.city ? ` · ${t.city}` : ''}`}
            />
            <CatalogGrid
              label="Selected extras"
              items={packageRequest.activities}
              empty="No extras selected."
              renderMeta={(a) => `${a.city || '—'}${a.duration ? ` · ${a.duration}` : ''}`}
            />

            <ItineraryEditor packageRequest={packageRequest} onUpdated={setPackageRequest} />
            <CostingAndPublishing packageRequest={packageRequest} onUpdated={setPackageRequest} />
            <ActivityHistory history={packageRequest.activityHistory} />
          </>
        )}
      </div>
    </div>
  );
}
