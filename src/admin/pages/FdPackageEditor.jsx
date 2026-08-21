import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Button, Card, Checkbox, FieldLabel, Select, Tag, Table, TextInput } from '../components/ui.jsx';
import { ImageUpload } from '../components/ImageUpload.jsx';
import { InclusionExclusionList, itineraryHasItemType, linesFromText, textFromLines } from '../components/InclusionExclusionList.jsx';
import { FD_THEMES, formatCurrency, parseDurationDays } from '../../shared/fdPackage/index.js';
import {
  ITINERARY_ITEM_TYPE_META,
  deserializeItinerary,
  itemsForDay,
  itineraryItemKey,
  serializeItinerary,
  updateItineraryItemNote,
} from '../../shared/itinerary/index.js';

// The backend's validateBody() middleware already returns a human-readable
// `message` (e.g. "Rate gold must be a valid number"). This is a fallback for
// endpoints/errors that only carry the raw zod { fieldErrors } shape, so the
// admin never just sees "Request failed (400)".
function describeApiError(err) {
  if (err.message) return err.message;
  const fieldErrors = err.data?.details?.fieldErrors;
  if (fieldErrors && Object.keys(fieldErrors).length) {
    return Object.entries(fieldErrors)
      .map(([field, messages]) => `${field}: ${messages[0]}`)
      .join('; ');
  }
  return 'Something went wrong. Please try again.';
}

function HeroImageUpload({ packageId, value, onUploaded }) {
  async function upload(file) {
    const formData = new FormData();
    formData.append('image', file);
    const { fdPackage } = await api.postForm(`/admin/fd-packages/${packageId}/hero-image`, formData);
    return fdPackage.heroImageUrl;
  }

  return (
    <ImageUpload
      label="Hero image"
      value={value}
      onChange={onUploaded}
      onUpload={upload}
      disabled={!packageId}
      disabledHint="Setting up…"
    />
  );
}

// Mandatory gallery size for an FD package's own carousel — enforced here
// (the hint below) and again in handlePublish's findCarouselImagesError, the
// same "frontend-only gate checked again right before Publish" pattern
// findItineraryPublishError already uses for the day-by-day itinerary.
const MIN_CAROUSEL_IMAGES = 4;

function CarouselImagesUpload({ packageId, images, onChange }) {
  async function upload(files) {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    const { fdPackage } = await api.postForm(`/admin/fd-packages/${packageId}/images`, formData);
    return fdPackage.images;
  }

  async function remove(url) {
    const { fdPackage } = await api.del(`/admin/fd-packages/${packageId}/images/${encodeURIComponent(url)}`);
    onChange(fdPackage.images);
  }

  return (
    <ImageUpload
      label="Carousel images"
      required
      multiple
      value={images}
      onChange={onChange}
      onUpload={upload}
      onRemove={remove}
      disabled={!packageId}
      disabledHint="Setting up…"
      hint={
        images.length < MIN_CAROUSEL_IMAGES
          ? `Upload at least ${MIN_CAROUSEL_IMAGES} images (${images.length}/${MIN_CAROUSEL_IMAGES} so far). The first image is used as the primary listing photo.`
          : undefined
      }
    />
  );
}

// Task 2 (spacing) — short text fields (Title/Duration/Suitable age/Theme/
// Short description) are grouped into their own compact grid first, and the
// two image dropzones (naturally tall) are grouped into a second grid below
// them — previously Theme sat next to Hero Image in the same grid row,
// which forced Theme's cell to stretch to the dropzone's full height and
// left a big empty gap under the theme tags. No field was removed, only
// reordered/regrouped.
function BasicsForm({ form, update, packageId }) {
  return (
    <Card label="Basics" className="border-white">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>Title</FieldLabel>
          <TextInput value={form.title || ''} onChange={(e) => update('title', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Duration (days)</FieldLabel>
          <TextInput
            type="number"
            min="1"
            placeholder="Enter number of days"
            value={form.duration || ''}
            onChange={(e) => update('duration', e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Suitable age (min)</FieldLabel>
          <TextInput type="number" value={form.suitableAgeMin || ''} onChange={(e) => update('suitableAgeMin', Number(e.target.value))} />
        </div>
        <div>
          <FieldLabel>Theme</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {FD_THEMES.map((t) => (
              <button key={t} type="button" onClick={() => update('theme', t)}>
                <Tag active={form.theme === t}>{t}</Tag>
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>Short description</FieldLabel>
          <TextInput value={form.shortDescription || ''} onChange={(e) => update('shortDescription', e.target.value)} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <HeroImageUpload packageId={packageId} value={form.heroImageUrl} onUploaded={(url) => update('heroImageUrl', url)} />
        {/* images (carousel) now lives in `form` like every other field —
            previously it had its own parallel `images` state that never
            synced back into `form`, so clicking Save/Publish afterward sent
            a stale `form.images` in the PATCH body and silently overwrote
            the images the upload endpoint had already saved to the DB. */}
        <CarouselImagesUpload packageId={packageId} images={form.images || []} onChange={(imgs) => update('images', imgs)} />
      </div>
    </Card>
  );
}

// Net rate per pax is auto-calculated live from what's placed in the
// day-by-day itinerary above (hotel nights + tours + transfers + extras —
// see computeItineraryNetRate/computeNetRatePerPax) plus any meals selected
// just below it, as soon as either changes — no need to click "Save
// Itinerary" first. Admin can still set a specific sell price via Edit; that
// override is saved with the rest of the form (Save as Draft / Publish) and
// takes over from the computed value until "Reset to automatic" clears it.
// Deposit amount and balance-due lead time are no longer package-level
// settings either — every booking now uses a fixed lead time server-side.
function PricingForm({ form, update, computedRatePerPax }) {
  const [editing, setEditing] = useState(false);
  const isOverridden = form.ratePerPax != null;
  const effective = isOverridden ? form.ratePerPax : computedRatePerPax;

  return (
    <Card label="Pricing" className="border-white">
      <FieldLabel>Net rate (per pax)</FieldLabel>
      {editing ? (
        <div className="flex items-center gap-2">
          <TextInput
            type="number"
            className="w-40"
            autoFocus
            placeholder="From itinerary"
            value={form.ratePerPax ?? ''}
            onChange={(e) => update('ratePerPax', e.target.value === '' ? null : Number(e.target.value))}
          />
          <Button onClick={() => setEditing(false)}>Done</Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-40 items-center rounded-md border border-line-light bg-panel/40 px-3 text-sm font-semibold text-ink">
            {effective != null ? formatCurrency(effective) : '—'}
          </div>
          <Button onClick={() => setEditing(true)}>Edit</Button>
          {isOverridden && (
            <button
              type="button"
              className="text-[11px] text-muted underline hover:text-ink"
              onClick={() => update('ratePerPax', null)}
            >
              Reset to automatic
            </button>
          )}
        </div>
      )}
      <p className="mt-1 text-[11px] text-muted">
        {isOverridden ? 'Manually set — saved with the rest of this form.' : 'Calculated automatically from the itinerary and meals above.'}
      </p>
    </Card>
  );
}

// Task 5 — the "Add-ons" enable-toggle that used to live here is gone: the
// Add-ons & Inclusions section (AddonsManager) now always renders once a
// package exists, since it's opt-in per item by checkbox anyway.
function MerchandisingForm({ form, update }) {
  return (
    <Card label="Merchandising & discovery attributes" className="border-white">
      <Checkbox checked={!!form.isFeatured} onChange={(v) => update('isFeatured', v)} label="Mark as Featured / Highly Recommended" />
      <Checkbox checked={!!form.isBestseller} onChange={(v) => update('isBestseller', v)} label="Mark as Bestseller" />
    </Card>
  );
}

function DepartureDatesManager({ fdPackageId, dates, onChange }) {
  const toast = useToast();
  const [date, setDate] = useState('');
  const [seatsTotal, setSeatsTotal] = useState(20);
  const [location, setLocation] = useState('');
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    api.get('/departure-locations').then((d) => setLocations(d.locations || []));
  }, []);

  async function add() {
    if (!date) return;
    if (!location) {
      toast.error('Select a location for this departure date.');
      return;
    }
    try {
      const { departureDate } = await api.post(`/admin/fd-packages/${fdPackageId}/departure-dates`, {
        date,
        seatsTotal,
        location,
      });
      onChange([...dates, departureDate]);
      setDate('');
      setLocation('');
    } catch (err) {
      toast.error(err.message || 'Unable to add departure date');
    }
  }

  async function remove(id) {
    await api.del(`/admin/fd-packages/${fdPackageId}/departure-dates/${id}`);
    onChange(dates.filter((d) => d.id !== id));
  }

  return (
    <Card label="Departure dates & inventory" className="border-white">
      <Table
        columns={['Date', 'Location', 'Seats', '']}
        rows={dates}
        renderRow={(d) => (
          <tr key={d.id} className="border-b border-line-light last:border-0">
            <td className="px-3 py-2">{new Date(d.date).toLocaleDateString()}</td>
            <td className="px-3 py-2">{d.location || '—'}</td>
            <td className="px-3 py-2">
              {d.seats_booked ?? d.seatsBooked ?? 0} / {d.seats_total ?? d.seatsTotal}
            </td>
            <td className="px-3 py-2 text-right">
              <button onClick={() => remove(d.id)} className="text-[#a5162d] hover:underline">
                Remove
              </button>
            </td>
          </tr>
        )}
      />
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <FieldLabel>Date</FieldLabel>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Location *</FieldLabel>
          <Select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">Select location…</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel>Seats</FieldLabel>
          <TextInput type="number" value={seatsTotal} onChange={(e) => setSeatsTotal(Number(e.target.value))} />
        </div>
        <Button onClick={add} disabled={!date || !location}>
          + Add departure date
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Day-by-day itinerary builder — mirrors the agent Custom FIT Builder's
// Itinerary step (agent/pages/PackageBuilder.jsx's DayPlanCard): a numbered
// day-timeline where each day picks its own hotel (single-select) plus
// tours/transfers/extras (multi-select) straight from the catalog, instead of
// one free-text line per day. Unlike the agent builder there's no City & Days
// planner step first — an FD package doesn't carry per-package trip dates or
// a multi-city plan the way a Custom FIT quote does, so every day just picks
// from the full catalog.
//
// NOTE: the wire shape this now saves — { dayNumber, notes, items: [{type,
// id, note}] } — matches the Custom FIT itinerary shape already used by
// admin/pages/QuoteInboxDetail.jsx and agent/pages/PackageBuilder.jsx (see
// shared/itinerary/index.js). PUT /admin/fd-packages/:id/itinerary currently
// only accepts/returns the older { dayNumber, description } shape — the
// backend needs updating to accept/persist this richer shape before Save
// Itinerary here round-trips end to end.
// ---------------------------------------------------------------------------

// How long to wait after the admin stops changing Duration before checking
// whether shrinking it just orphaned any day content. Debounced (rather than
// reacting to every keystroke) so typing "10 Days" doesn't briefly check
// against "1 Day" and pop a confirmation.
const DURATION_SYNC_DELAY_MS = 600;

function addItineraryItem(items, { type, id, dayNumber }) {
  const dayItems = itemsForDay(items, dayNumber);
  const newItem = {
    key: `${itineraryItemKey(type, id)}:${dayNumber}:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    id,
    dayNumber,
    position: dayItems.length,
    note: '',
  };
  return [...items, newItem];
}

function removeItineraryItemByKey(items, key) {
  const removing = items.find((it) => it.key === key);
  if (!removing) return items;
  const rest = items.filter((it) => it.key !== key);
  const remainingInDay = itemsForDay(rest, removing.dayNumber).map((it, idx) => ({ ...it, position: idx }));
  const others = rest.filter((it) => it.dayNumber !== removing.dayNumber);
  return [...others, ...remainingInDay];
}

// Hotel is single-select per day — choosing a new hotel for a day replaces
// whatever hotel was already there instead of stacking up multiple. No
// occupancy/headcount is captured here anymore (0061_hotel_occupancy_pricing.sql,
// Task 6) — real pax is only known once an agent actually books
// (agent/pages/DepartureDetail.jsx's Traveler Details step), so admin just
// picks the hotel and its per-pax rate is resolved automatically below.
function setHotelForDay(items, dayNumber, hotelId) {
  const withoutOldHotel = items.filter((it) => !(it.dayNumber === dayNumber && it.type === 'hotel'));
  return addItineraryItem(withoutOldHotel, { type: 'hotel', id: hotelId, dayNumber });
}

// Mirrors the backend's resolveHotelPerPaxRate (fdPackages.model.js): a
// hotel's per-pax nightly rate is its double-occupancy room price ÷ 2 (the
// "2 adults share a room" baseline this app already assumed everywhere
// before occupancy pricing existed), falling back to single (÷1) then
// triple (÷3) if the hotel doesn't offer double. Returns null (not 0) when
// none of the three are priced, so callers can tell "free" apart from "not
// priced yet".
const HOTEL_OCCUPANCY_PRIORITY = [
  { field: 'double_price', capacity: 2 },
  { field: 'single_price', capacity: 1 },
  { field: 'triple_price', capacity: 3 },
];

function resolveHotelPerPaxRate(hotel) {
  if (!hotel) return null;
  for (const { field, capacity } of HOTEL_OCCUPANCY_PRIORITY) {
    if (hotel[field] != null) return Number(hotel[field]) / capacity;
  }
  return null;
}

// Mirrors the backend's computeNetRatePerPax (fdPackages.model.js) so the
// "auto" net rate updates live as items are added/removed, without waiting
// on "Save Itinerary" or a round trip. `catalogs` is the plural
// {hotels, tours, transfers, activities} shape ItineraryManager already
// fetches; catalog rows come straight off the DB (snake_case), same as the
// backend reads them.
const ITINERARY_CATALOG_KEY = { hotel: 'hotels', tour: 'tours', transfer: 'transfers', activity: 'activities' };
const ITINERARY_PRICE_FIELD = { tour: 'price', transfer: 'price', activity: 'price_per_pax' };

function computeItineraryNetRate(items, catalogs) {
  return items.reduce((total, it) => {
    const list = catalogs[ITINERARY_CATALOG_KEY[it.type]] || [];
    const ref = list.find((c) => c.id === it.id);
    if (!ref) return total;
    if (it.type === 'hotel') {
      const perPax = resolveHotelPerPaxRate(ref);
      return perPax != null ? total + perPax : total;
    }
    const field = ITINERARY_PRICE_FIELD[it.type];
    return total + (Number(ref[field]) || 0);
  }, 0);
}

const HOTEL_STAR_CATEGORIES = [3, 4, 5];

function HotelStars({ category }) {
  return (
    <span className="tracking-tight text-accent">
      {'★'.repeat(category)}
      <span className="text-line-light">{'★'.repeat(Math.max(0, 5 - category))}</span>
    </span>
  );
}

function CatalogImage({ url }) {
  return url ? (
    <img src={url} alt="" className="h-24 w-full rounded-md border border-line-light object-cover" />
  ) : (
    <div className="flex h-24 w-full items-center justify-center rounded-md border border-dashed border-line-light font-mono text-[9px] text-muted">
      No image
    </div>
  );
}

// A placed hotel/tour/transfer/extra on a specific day.
function PlacedItemChip({ item, meta, onNoteChange, onRemove }) {
  const typeMeta = ITINERARY_ITEM_TYPE_META[item.type];
  const priceField = ITINERARY_PRICE_FIELD[item.type];
  const price = meta?.[priceField];
  return (
    <div className="rounded-md border border-line-light bg-white px-2.5 py-2 text-xs shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex-none">{typeMeta?.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-ink">{meta?.name || 'Unknown item'}</div>
          <div className="truncate text-[10px] text-muted">
            {typeMeta?.label}
            {meta?.city ? ` · ${meta.city}` : ''}
          </div>
        </div>
        {price != null && <span className="flex-none text-[11px] font-semibold text-ink">{formatCurrency(price)}</span>}
        <button type="button" onClick={onRemove} title="Remove" className="flex-none text-muted hover:text-[#a5162d]">
          🗑
        </button>
      </div>
      <TextInput
        className="mt-1.5 px-2 py-1.5 text-[11px]"
        placeholder="Add a note (optional)…"
        value={item.note || ''}
        onChange={(e) => onNoteChange(e.target.value)}
      />
    </div>
  );
}

// A day's hotel section — single-select, gated behind a star-category pick
// first. Choosing a hotel replaces whatever was already selected for this
// day. No occupancy/headcount input anymore (Task 6) — admin just picks the
// hotel; its per-pax rate is resolved from whichever occupancy price it has
// (resolveHotelPerPaxRate, double -> single -> triple priority), since real
// pax is only known once an agent books.
function DayHotelSection({ hotels, currentHotelId, onSelect }) {
  const [open, setOpen] = useState(false);
  const [starCategory, setStarCategory] = useState('');
  const filtered = starCategory ? hotels.filter((h) => h.category === starCategory) : hotels;
  const currentHotel = hotels.find((h) => h.id === currentHotelId) || null;
  const perPaxRate = resolveHotelPerPaxRate(currentHotel);

  return (
    <div>
      <FieldLabel>Hotel</FieldLabel>
      {currentHotel ? (
        <div className="rounded-md border border-line-light bg-white px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-ink">{currentHotel.name}</div>
              <div className="text-muted">
                {currentHotel.category ? `${currentHotel.category}★ · ` : ''}
                {currentHotel.city}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {perPaxRate != null && <span className="font-semibold text-ink">{formatCurrency(perPaxRate)}/pax/night</span>}
              <button type="button" onClick={() => onSelect('')} title="Remove" className="flex-none text-muted hover:text-[#a5162d]">
                🗑
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mb-1 text-[11px] text-muted">No hotel selected for this day.</p>
      )}
      <Button className="mt-1.5" onClick={() => setOpen((o) => !o)}>
        {open ? 'Close' : currentHotel ? 'Change hotel' : '+ Add hotel'}
      </Button>
      {open && (
        <div className="mt-2 rounded-md border border-dashed border-line-light p-2.5">
          <div className="mb-2 flex flex-wrap gap-2">
            {HOTEL_STAR_CATEGORIES.map((cat) => (
              <button key={cat} type="button" onClick={() => setStarCategory((c) => (c === cat ? '' : cat))}>
                <Tag active={starCategory === cat}>{cat}★</Tag>
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="text-[11px] text-muted">No hotels{starCategory ? ` at ${starCategory}★` : ''}.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filtered.map((h) => {
                const selected = h.id === currentHotelId;
                return (
                  <div
                    key={h.id}
                    className={`rounded-md border p-2 text-xs ${selected ? 'border-accent ring-1 ring-accent/25' : 'border-line-light'}`}
                  >
                    <CatalogImage url={h.images?.[0]} />
                    <div className="mt-1.5 font-semibold text-ink">{h.name}</div>
                    <div className="flex items-center justify-between">
                      <HotelStars category={h.category} />
                      {resolveHotelPerPaxRate(h) != null && (
                        <span className="font-semibold text-ink">{formatCurrency(resolveHotelPerPaxRate(h))}/pax/night</span>
                      )}
                    </div>
                    <Button
                      variant={selected ? 'accent' : 'default'}
                      className="mt-1.5 w-full justify-center"
                      onClick={() => {
                        onSelect(selected ? '' : h.id);
                        setOpen(false);
                      }}
                    >
                      {selected ? 'Selected ✓' : 'Select'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Tours and Transfers are marked required (mirrors the agent Custom FIT
// Builder's per-day requirement) — findItineraryPublishError below blocks
// publishing until every day has at least one of each. Activities stay
// optional. `required` only decorates the field label — kept separate from
// `label` itself so the lowercased "No {label} in the catalog yet."
// empty-state message below doesn't pick up a stray asterisk.
const DAY_SECTION_META = {
  tour: { label: 'Tours', addLabel: '+ Add tour', required: true },
  transfer: { label: 'Transfers', addLabel: '+ Add transfer', required: true },
  activity: { label: 'Activities', addLabel: '+ Add activity' },
};

// A day's tours/transfers/activities section — multi-add. Reusable across all
// three types since they share the same "toggle catalog card in/out of this
// day" shape.
function DayCatalogSection({ type, catalog, placedItems, onAdd, onRemove, onNoteChange }) {
  const [open, setOpen] = useState(false);
  const meta = DAY_SECTION_META[type];
  const placedByItemId = new Map(placedItems.map((it) => [it.id, it]));

  return (
    <div>
      <FieldLabel>
        {meta.label}
        {meta.required && ' *'}
      </FieldLabel>
      {placedItems.length === 0 ? (
        <p className="mb-1 text-[11px] text-muted">None added for this day.</p>
      ) : (
        <div className="mb-1.5 space-y-1.5">
          {placedItems.map((it) => (
            <PlacedItemChip
              key={it.key}
              item={it}
              meta={catalog.find((c) => c.id === it.id)}
              onRemove={() => onRemove(it.key)}
              onNoteChange={(note) => onNoteChange(it.key, note)}
            />
          ))}
        </div>
      )}
      <Button onClick={() => setOpen((o) => !o)}>{open ? 'Close' : meta.addLabel}</Button>
      {open && (
        <div className="mt-2 rounded-md border border-dashed border-line-light p-2.5">
          {catalog.length === 0 ? (
            <p className="text-[11px] text-muted">No {meta.label.toLowerCase()} in the catalog yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {catalog.map((item) => {
                const placed = placedByItemId.get(item.id);
                return (
                  <div
                    key={item.id}
                    className={`rounded-md border p-2 text-xs ${placed ? 'border-accent ring-1 ring-accent/25' : 'border-line-light'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-ink">{item.name}</div>
                      {item[ITINERARY_PRICE_FIELD[type]] != null && (
                        <span className="flex-none font-semibold text-ink">{formatCurrency(item[ITINERARY_PRICE_FIELD[type]])}</span>
                      )}
                    </div>
                    <div className="text-muted">
                      {item.city ? `${item.city} · ` : ''}
                      {type === 'tour' && `${item.category ? item.category + ' · ' : ''}${item.duration || ''}`}
                      {type === 'transfer' && `${item.type ? item.type.replace(/_/g, ' ') : ''}${item.vehicle_class ? ' · ' + item.vehicle_class : ''}`}
                      {type === 'activity' && (item.duration || '')}
                    </div>
                    <Button
                      variant={placed ? 'accent' : 'default'}
                      className="mt-1.5 w-full justify-center"
                      onClick={() => (placed ? onRemove(placed.key) : onAdd(item.id))}
                    >
                      {placed ? 'Added ✓ (tap to remove)' : 'Add'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// A single day's content — each section adds directly from the catalog
// instead of dragging from a pre-selected pool, since an FD package has no
// separate "agent selection" step the way a Custom FIT quote does. Task 6 —
// previously all days rendered stacked in one numbered-node timeline; now
// ItineraryManager below shows one day at a time behind a tab bar, so this
// no longer carries its own circle-badge/connector chrome — the tab itself
// is what identifies which day this is.
function DayPlanCard({ dayNumber, items, catalogs, notes, onNotesChange, addItem, removeItem, updateNote, setHotel }) {
  const hotelItem = items.find((it) => it.type === 'hotel') || null;
  const tourItems = items.filter((it) => it.type === 'tour');
  const transferItems = items.filter((it) => it.type === 'transfer');
  const activityItems = items.filter((it) => it.type === 'activity');

  return (
    <div className="space-y-3">
      <DayHotelSection
        hotels={catalogs.hotels}
        currentHotelId={hotelItem?.id || ''}
        onSelect={(hotelId) => setHotel(dayNumber, hotelId)}
      />
      <DayCatalogSection
        type="tour"
        catalog={catalogs.tours}
        placedItems={tourItems}
        onAdd={(id) => addItem('tour', id)}
        onRemove={removeItem}
        onNoteChange={updateNote}
      />
      <DayCatalogSection
        type="transfer"
        catalog={catalogs.transfers}
        placedItems={transferItems}
        onAdd={(id) => addItem('transfer', id)}
        onRemove={removeItem}
        onNoteChange={updateNote}
      />
      <DayCatalogSection
        type="activity"
        catalog={catalogs.activities}
        placedItems={activityItems}
        onAdd={(id) => addItem('activity', id)}
        onRemove={removeItem}
        onNoteChange={updateNote}
      />
      <TextInput placeholder="Notes for this day (optional)…" value={notes} onChange={(e) => onNotesChange(e.target.value)} />
    </div>
  );
}

// A day is "complete" once it has both a tour and a transfer — the same two
// requirements findItineraryPublishError enforces before publishing — used
// here purely to decorate each tab with a ✓ so admin can see progress across
// days without having to click through all of them.
function isDayComplete(items) {
  return items.some((it) => it.type === 'tour') && items.some((it) => it.type === 'transfer');
}

function ItineraryManager({ fdPackageId, itinerary, duration, onChange, onComputedRateChange }) {
  const [itineraryItems, setItineraryItems] = useState(() => deserializeItinerary(itinerary).items);
  const [dayNotes, setDayNotes] = useState(() => deserializeItinerary(itinerary).dayNotes);
  const [saving, setSaving] = useState(false);

  const [hotels, setHotels] = useState([]);
  const [tours, setTours] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const dayCount = parseDurationDays(duration) || 0;
  // Tracks the day count content was last checked against, so shrinking
  // Duration only prompts once per change rather than on every render.
  const lastSyncedDays = useRef(dayCount);

  // Task 6 — tabs to switch between days instead of one long stacked list.
  // Clamped down whenever Duration shrinks past the currently active tab
  // (e.g. was on Day 8, Duration drops to 5 days) so the tab bar never sits
  // on a day that no longer exists.
  const [activeDay, setActiveDay] = useState(1);
  useEffect(() => {
    if (dayCount > 0 && activeDay > dayCount) setActiveDay(dayCount);
  }, [dayCount, activeDay]);

  useEffect(() => {
    Promise.all([api.get('/hotels'), api.get('/tours'), api.get('/transfers'), api.get('/activities')])
      .then(([h, t, tr, a]) => {
        setHotels(h.hotels || []);
        setTours(t.tours || []);
        setTransfers(tr.transfers || []);
        setActivities(a.activities || []);
      })
      .finally(() => setCatalogLoading(false));
  }, []);

  // Recomputed live on every itinerary edit — no need to click "Save
  // Itinerary" first. Skipped until catalogs finish loading so the price
  // doesn't flash to ₹0 while hotels/tours/transfers/activities are still
  // in flight.
  useEffect(() => {
    if (catalogLoading) return;
    onComputedRateChange?.(computeItineraryNetRate(itineraryItems, { hotels, tours, transfers, activities }));
  }, [itineraryItems, hotels, tours, transfers, activities, catalogLoading, onComputedRateChange]);

  // Reload from the DB whenever the parent hands us a freshly fetched (or
  // just-saved) itinerary — e.g. opening the editor for an existing package.
  useEffect(() => {
    const { items, dayNotes: loaded } = deserializeItinerary(itinerary);
    setItineraryItems(items);
    setDayNotes(loaded);
  }, [itinerary]);

  // Days are just 1..dayCount, rendered straight off itineraryItems/dayNotes
  // — there's no separate "days" list to grow/trim the way the old free-text
  // builder had. Shrinking Duration past days that already have content still
  // needs a confirmation before that content is dropped, though.
  useEffect(() => {
    if (!dayCount || dayCount >= lastSyncedDays.current) {
      lastSyncedDays.current = dayCount;
      return;
    }
    const timer = setTimeout(() => {
      const hasOrphanedContent =
        itineraryItems.some((it) => it.dayNumber > dayCount) ||
        Object.entries(dayNotes).some(([day, note]) => Number(day) > dayCount && (note || '').trim());
      if (hasOrphanedContent) {
        const ok = window.confirm(
          `Reducing the duration removes itinerary content on Day ${dayCount + 1} onward. Remove it?`
        );
        if (!ok) return; // leave as-is; retried once Duration settles on a smaller value
      }
      setItineraryItems((items) => items.filter((it) => it.dayNumber <= dayCount));
      setDayNotes((notes) => Object.fromEntries(Object.entries(notes).filter(([day]) => Number(day) <= dayCount)));
      lastSyncedDays.current = dayCount;
    }, DURATION_SYNC_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayCount]);

  function addItemToDay(dayNumber, type, id) {
    setItineraryItems((items) => addItineraryItem(items, { type, id, dayNumber }));
  }

  function removeItemFromDay(key) {
    setItineraryItems((items) => removeItineraryItemByKey(items, key));
  }

  function updateItemNoteByKey(key, note) {
    setItineraryItems((items) => updateItineraryItemNote(items, key, note));
  }

  function setHotelForDayNumber(dayNumber, hotelId) {
    setItineraryItems((items) =>
      hotelId ? setHotelForDay(items, dayNumber, hotelId) : items.filter((it) => !(it.dayNumber === dayNumber && it.type === 'hotel')),
    );
  }

  async function save() {
    setSaving(true);
    try {
      const days = serializeItinerary(itineraryItems, dayNotes, dayCount);
      const { itinerary: saved } = await api.put(`/admin/fd-packages/${fdPackageId}/itinerary`, { days });
      onChange(saved);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card label="Day-by-day itinerary builder" className="border-white">
      <p className="mb-3 text-[10px] text-muted">
        {dayCount
          ? `${dayCount} day${dayCount === 1 ? '' : 's'}, generated from Duration above. Each day picks its own hotel plus tours/transfers/activities straight from the catalog.`
          : 'Set a Duration above (e.g. "7N/8D") to generate day sections.'}
      </p>
      {dayCount === 0 ? (
        <p className="rounded-md border border-dashed border-line-light bg-panel/40 p-4 text-center text-sm text-muted">
          Set a Duration above to start building the itinerary.
        </p>
      ) : catalogLoading ? (
        <p className="text-sm text-muted">Loading catalog…</p>
      ) : (
        <div>
          {/* Task 6 — tabs, one per day, instead of a long stacked list. ✓
              marks a day that already has both a tour and a transfer (what
              publishing actually requires — see isDayComplete). */}
          <div className="mb-3 flex flex-wrap gap-1.5 border-b border-line-light pb-2">
            {Array.from({ length: dayCount }, (_, i) => i + 1).map((dayNumber) => {
              const complete = isDayComplete(itemsForDay(itineraryItems, dayNumber));
              return (
                <button key={dayNumber} type="button" onClick={() => setActiveDay(dayNumber)}>
                  <Tag active={activeDay === dayNumber}>
                    Day {dayNumber}
                    {complete ? ' ✓' : ''}
                  </Tag>
                </button>
              );
            })}
          </div>
          <DayPlanCard
            dayNumber={activeDay}
            items={itemsForDay(itineraryItems, activeDay)}
            catalogs={{ hotels, tours, transfers, activities }}
            notes={dayNotes[activeDay] || ''}
            onNotesChange={(value) => setDayNotes((n) => ({ ...n, [activeDay]: value }))}
            addItem={(type, id) => addItemToDay(activeDay, type, id)}
            removeItem={removeItemFromDay}
            updateNote={updateItemNoteByKey}
            setHotel={setHotelForDayNumber}
          />
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button variant="accent" disabled={saving || dayCount === 0} onClick={save}>
          {saving ? 'Saving…' : 'Save Itinerary'}
        </Button>
      </div>
    </Card>
  );
}

// Task 5 — one catalog-item checkbox per row, straight from the Product
// Catalog; checking it creates a real fd_addons row (price read
// automatically off the item, never typed by hand), unchecking removes it.
// Reused for Activities/Tours/Transfers below (AddonsManager) — only the
// catalog list, id field, and display price field differ per type.
const ADDON_ID_FIELD = { activity: 'activityId', tour: 'tourId', transfer: 'transferId' };
const ADDON_PRICE_FIELD = { activity: 'price_per_pax', tour: 'price', transfer: 'price' };

function AddonCheckboxGroup({ type, label, catalog, addons, onToggle }) {
  const idField = ADDON_ID_FIELD[type];
  const priceField = ADDON_PRICE_FIELD[type];
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {catalog.length === 0 ? (
        <p className="text-[11px] text-muted">No {label.toLowerCase()} in the catalog yet.</p>
      ) : (
        <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-md border border-line-light p-2">
          {catalog.map((item) => {
            const existing = addons.find((a) => a[idField] === item.id);
            return (
              <Checkbox
                key={item.id}
                checked={!!existing}
                onChange={() => onToggle(type, item, existing)}
                label={item.name}
                hint={item[priceField] != null ? `${formatCurrency(item[priceField])} / pax` : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// Task 4/5 — replaces both the old AddonsManager (freeform name+price
// entry) and the separate Meals card that used to sit below this section:
// Activities/Tours/Transfers are now real fd_addons rows picked by
// checkbox, priced straight from the catalog; Visa and Meals (Lunch/Dinner)
// are simple "included or not" checkboxes on the package itself
// (form.visaEnabled / lunchMealId / dinnerMealId) — no manual price entry
// and, for meals, no headcount/day-count either, since a real pax is only
// known once an agent actually books (agent/pages/DepartureDetail.jsx's
// Traveler Details step). Meals/Visa cost is computed here purely for the
// live Net rate preview (mirrors the backend's own resolveRatePerPax /
// computeFdMealsPerPax, utils/meals.js — kept in sync by hand since this is
// a client-side preview, not the source of truth); the real charge is
// resolved server-side at booking time either way.
function AddonsManager({ fdPackageId, addons, onChange, form, update, duration, onComputedRateChange }) {
  const [activities, setActivities] = useState([]);
  const [tours, setTours] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [meals, setMeals] = useState([]);
  const [visa, setVisa] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/activities'), api.get('/tours'), api.get('/transfers'), api.get('/meals'), api.get('/visas')])
      .then(([a, t, tr, m, v]) => {
        setActivities(a.activities || []);
        setTours(t.tours || []);
        setTransfers(tr.transfers || []);
        setMeals(m.meals || []);
        setVisa((v.visas || [])[0] || null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggleAddon(type, item, existing) {
    if (existing) {
      await api.del(`/admin/fd-packages/${fdPackageId}/addons/${existing.id}`);
      onChange(addons.filter((a) => a.id !== existing.id));
    } else {
      const { addon } = await api.post(`/admin/fd-packages/${fdPackageId}/addons`, { [ADDON_ID_FIELD[type]]: item.id });
      onChange([...addons, addon]);
    }
  }

  // "The" lunch/dinner/visa entry — one catalog row is expected per
  // meal_type (and Visa has only ever the one row), so there's nothing else
  // for the admin to choose between — see MealsManager's old identical
  // comment, this replaces it.
  const lunchMeal = meals.find((m) => m.meal_type === 'lunch');
  const dinnerMeal = meals.find((m) => m.meal_type === 'dinner');
  const dayCount = parseDurationDays(duration);

  function mealPerPax(meal, mealId) {
    return meal && mealId && dayCount ? Number(meal.price_per_day || 0) * dayCount : 0;
  }
  const mealsAndVisaPerPax =
    mealPerPax(lunchMeal, form.lunchMealId) +
    mealPerPax(dinnerMeal, form.dinnerMealId) +
    (form.visaEnabled ? Number(visa?.price_per_person || 0) : 0);

  useEffect(() => {
    if (loading) return;
    onComputedRateChange?.(mealsAndVisaPerPax);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealsAndVisaPerPax, loading]);

  return (
    <Card label="Add-ons & Inclusions" className="border-white">
      {loading ? (
        <p className="text-sm text-muted">Loading catalog…</p>
      ) : (
        <div className="space-y-4">
          <AddonCheckboxGroup type="activity" label="Activities" catalog={activities} addons={addons} onToggle={toggleAddon} />
          <AddonCheckboxGroup type="tour" label="Tours" catalog={tours} addons={addons} onToggle={toggleAddon} />
          <AddonCheckboxGroup type="transfer" label="Transfers" catalog={transfers} addons={addons} onToggle={toggleAddon} />

          <div>
            <FieldLabel>Visa</FieldLabel>
            <Checkbox
              checked={!!form.visaEnabled}
              onChange={(v) => update('visaEnabled', v)}
              label="Visa assistance included"
              hint={visa?.price_per_person != null ? `${formatCurrency(visa.price_per_person)} / pax` : 'No visa price configured in the catalog yet'}
            />
          </div>

          <div>
            <FieldLabel>Meals</FieldLabel>
            <div className="space-y-1.5">
              <Checkbox
                checked={form.lunchMealId != null}
                onChange={(v) => update('lunchMealId', v ? (lunchMeal?.id ?? null) : null)}
                label="Lunch included"
                hint={lunchMeal?.price_per_day != null ? `${formatCurrency(lunchMeal.price_per_day)} / pax / day` : 'No lunch price configured yet'}
              />
              <Checkbox
                checked={form.dinnerMealId != null}
                onChange={(v) => update('dinnerMealId', v ? (dinnerMeal?.id ?? null) : null)}
                label="Dinner included"
                hint={dinnerMeal?.price_per_day != null ? `${formatCurrency(dinnerMeal.price_per_day)} / pax / day` : 'No dinner price configured yet'}
              />
            </div>
          </div>

          {mealsAndVisaPerPax > 0 && (
            <p className="text-xs text-muted">
              Meals + visa add {formatCurrency(mealsAndVisaPerPax)}/pax to the Net rate below.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// Inclusions/Exclusions — client-facing, shown read-only to the agent once
// this package is published (agent/pages/DepartureDetail.jsx), same
// dropdown-from-catalog + editable-list behavior as the Custom FIT Quote
// Inbox (admin/pages/QuoteInboxDetail.jsx) via the shared
// InclusionExclusionList. Persisted as plain fields on `form` — one
// newline-delimited string each — so they ride along with the rest of Save
// as Draft/Publish Package, no separate save step.
function InclusionsExclusionsForm({ form, update }) {
  return (
    <Card label="Inclusions & Exclusions" className="border-white">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InclusionExclusionList
          catalogEntityPath="inclusions"
          label="Inclusions"
          items={linesFromText(form.inclusions)}
          onItemsChange={(items) => update('inclusions', textFromLines(items))}
        />
        <InclusionExclusionList
          catalogEntityPath="exclusions"
          label="Exclusions"
          items={linesFromText(form.exclusions)}
          onItemsChange={(items) => update('exclusions', textFromLines(items))}
        />
      </div>
    </Card>
  );
}

// The backend's `ratePerPax` is the resolved/effective price (override, or
// the itinerary total when there isn't one) — useful for display elsewhere,
// but the editor needs to know whether an override actually exists so it can
// decide "auto" vs "edit" mode. Reshape it into `ratePerPax: rateOverride`
// (raw, nullable) so `form.ratePerPax` always means exactly what a PATCH
// will persist to rate_per_pax, matching PricingForm's expectations.
function toFormState(fdPackage) {
  return { ...fdPackage, ratePerPax: fdPackage.rateOverride ?? null };
}

export default function FdPackageEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = id === 'new';

  const [form, setForm] = useState({});
  const [packageId, setPackageId] = useState(isNew ? null : id);
  const [dates, setDates] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [addons, setAddons] = useState([]);
  const [submitting, setSubmitting] = useState('');
  // Live "auto" net rate — the itinerary total (ItineraryManager) plus any
  // included meals/visa (AddonsManager), each reported independently as
  // they're edited so neither has to wait on the other or on a save round
  // trip. Both start at null ("still calculating") rather than 0, so the
  // Net rate field shows "—" instead of flashing ₹0 before either has
  // finished its first pass. Kept separate from `form` so this never gets
  // sent back to the server as if it were the override.
  const [itineraryRatePerPax, setItineraryRatePerPax] = useState(null);
  const [mealsRatePerPax, setMealsRatePerPax] = useState(null);
  const computedRatePerPax =
    itineraryRatePerPax == null || mealsRatePerPax == null ? null : itineraryRatePerPax + mealsRatePerPax;

  // Task 2 — auto-save to draft. `hasUserEditedRef` is set only by update()
  // below (a real, user-driven field change) — never by the initial load's
  // own setForm(toFormState(...)), so opening an existing package doesn't
  // immediately re-PATCH back the exact data it just loaded.
  const hasUserEditedRef = useRef(false);
  const autosaveTimerRef = useRef(null);
  const [autosaving, setAutosaving] = useState(false);

  useEffect(() => {
    if (isNew) {
      // Create the draft immediately on open rather than waiting for an
      // explicit "Save as Draft" click, so hero image / carousel images /
      // departure dates / itinerary / add-ons are usable right away instead
      // of being gated behind a manual save first.
      api
        .post('/admin/fd-packages', { title: 'New FD Package', status: 'draft' })
        .then(({ fdPackage }) => {
          setForm(toFormState(fdPackage));
          setPackageId(fdPackage.id);
          navigate(`/admin/catalog/fd-packages/${fdPackage.id}`, { replace: true });
        })
        .catch((err) => toast.error(err.message || 'Unable to start a new FD package'));
      return;
    }
    api.get(`/admin/fd-packages/${id}`).then(({ fdPackage }) => {
      setForm(toFormState(fdPackage));
      setPackageId(fdPackage.id);
      setDates(fdPackage.departureDates || []);
      setItinerary(fdPackage.itinerary || []);
      setAddons(fdPackage.addons || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  function update(key, value) {
    hasUserEditedRef.current = true;
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Debounced ~1s after the admin stops changing anything on `form`
  // (Basics/Merchandising/Pricing/Inclusions, all wired through update()
  // above) — reuses the same PATCH endpoint "Save as Draft" used to call
  // directly, just fired automatically instead of on a button click. Never
  // touches `status` itself (unlike handleSave('draft')/('published') below)
  // so autosaving a field on an already-published package can't silently
  // knock it back to draft.
  useEffect(() => {
    if (!packageId || !hasUserEditedRef.current) return undefined;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      setAutosaving(true);
      try {
        await api.patch(`/admin/fd-packages/${packageId}`, form);
      } catch (err) {
        toast.error(describeApiError(err));
      } finally {
        setAutosaving(false);
      }
    }, 1000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, packageId]);

  // Inclusions default-seed — same idea as the Custom FIT Quote Inbox
  // (QuoteInboxDetail.jsx's CostingAndPublishing): while Inclusions is
  // completely empty, keep it filled in from what's actually in the
  // package — a hotel on any day adds "Accommodation", a tour adds "Tour as
  // per itinerary", a transfer adds "Travel as per itinerary", an activity
  // adds "Activity as per itinerary", an included lunch/dinner adds
  // "Meals", and (Task 5) a checked Visa adds "Visa assistance" — FD
  // packages get their own visa_enabled flag now, same idea as Custom FIT's
  // agent-facing one. Re-evaluated whenever the itinerary/meals/visa change
  // (unlike the Quote Inbox's one-shot seed on mount) since this editor
  // builds up the itinerary progressively in the same session rather than
  // loading it fully formed already — stops the moment Inclusions has any
  // point of its own, admin-added or previously seeded.
  useEffect(() => {
    if (linesFromText(form.inclusions).length > 0) return;
    const seeded = [];
    if (itineraryHasItemType(itinerary, 'hotel')) seeded.push('Accommodation');
    if (itineraryHasItemType(itinerary, 'tour')) seeded.push('Tour as per itinerary');
    if (itineraryHasItemType(itinerary, 'transfer')) seeded.push('Travel as per itinerary');
    if (itineraryHasItemType(itinerary, 'activity')) seeded.push('Activity as per itinerary');
    if (form.lunchMealId || form.dinnerMealId) seeded.push('Meals');
    if (form.visaEnabled) seeded.push('Visa assistance');
    if (seeded.length > 0) update('inclusions', textFromLines(seeded));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itinerary, form.lunchMealId, form.dinnerMealId, form.visaEnabled, form.inclusions]);

  // Blind pricing aside, the itinerary is the one thing PRD explicitly
  // requires before a package goes live (FGD-2 / ADM-6 catalog screens both
  // show the full day-by-day plan). Checked against `itinerary` — the last
  // saved state from "Save Itinerary" above — not any unsaved in-progress edit.
  // `itinerary` is now the { dayNumber, notes, items } shape (see
  // ItineraryManager above) — days with neither notes nor items are omitted
  // entirely rather than kept as an empty row, so "every day has content" is
  // checked by looking each day 1..targetDays up rather than by length.
  function findItineraryPublishError() {
    if (!itinerary.length) return 'Add the day-by-day itinerary before publishing.';
    const targetDays = parseDurationDays(form.duration);
    if (!targetDays) return null;
    const byDay = new Map(itinerary.map((d) => [d.dayNumber, d]));
    for (let n = 1; n <= targetDays; n++) {
      const day = byDay.get(n);
      const items = day?.items || [];
      const hasContent = (day?.notes || '').trim() || items.length > 0;
      if (!hasContent) return `Day ${n} is missing itinerary details. Fill in every day before publishing.`;
      // Every day needs its own tour and transfer, not just somewhere in the
      // package — mirrors the agent Custom FIT Builder's per-day requirement
      // (see PackageBuilder.jsx's validateStep).
      if (!items.some((it) => it.type === 'tour')) return `Day ${n} needs at least one tour before publishing.`;
      if (!items.some((it) => it.type === 'transfer')) return `Day ${n} needs at least one transfer before publishing.`;
    }
    return null;
  }

  // Mirrors findItineraryPublishError just above — checked once more, right
  // before Publish, since CarouselImagesUpload's own inline hint only warns
  // rather than blocking anything on its own.
  function findCarouselImagesError() {
    if ((form.images || []).length < MIN_CAROUSEL_IMAGES) {
      return `Add at least ${MIN_CAROUSEL_IMAGES} carousel images before publishing.`;
    }
    return null;
  }

  // Task 2 — "Save as Draft" is gone (autosave above covers it); this is now
  // just the one remaining explicit action, publishing.
  async function handlePublish() {
    const itineraryError = findItineraryPublishError();
    if (itineraryError) {
      toast.error(itineraryError);
      return;
    }
    const carouselImagesError = findCarouselImagesError();
    if (carouselImagesError) {
      toast.error(carouselImagesError);
      return;
    }
    setSubmitting('published');
    try {
      const payload = { ...form, status: 'published' };
      if (!packageId) {
        const { fdPackage } = await api.post('/admin/fd-packages', payload);
        setPackageId(fdPackage.id);
        navigate(`/admin/catalog/fd-packages/${fdPackage.id}`, { replace: true });
      } else {
        const { fdPackage } = await api.patch(`/admin/fd-packages/${packageId}`, payload);
        setForm(toFormState(fdPackage));
      }
      toast.success('FD package published');
    } catch (err) {
      toast.error(describeApiError(err));
    } finally {
      setSubmitting('');
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-4xl space-y-4 p-6 lg:p-10">
        <button onClick={() => navigate('/admin/catalog')} className="text-xs text-muted hover:text-ink">
          ← Back to catalog
        </button>
        <h2 className="text-3xl font-bold">{isNew ? 'Add FD Package' : `Edit — ${form.title || ''}`}</h2>

        <BasicsForm form={form} update={update} packageId={packageId} />

        {packageId && (
          <>
            <DepartureDatesManager fdPackageId={packageId} dates={dates} onChange={setDates} />
            <ItineraryManager
              fdPackageId={packageId}
              itinerary={itinerary}
              duration={form.duration}
              onChange={setItinerary}
              onComputedRateChange={setItineraryRatePerPax}
            />
            {/* Moved below the day-by-day itinerary builder (Task 3) — was
                previously right after Basics. */}
            <MerchandisingForm form={form} update={update} />
            {/* Task 4/5 — replaces both the old (gated-behind-a-toggle)
                AddonsManager and the separate Meals card that used to sit
                below this section; now always renders, each item opt-in by
                its own checkbox. */}
            <AddonsManager
              fdPackageId={packageId}
              addons={addons}
              onChange={setAddons}
              form={form}
              update={update}
              duration={form.duration}
              onComputedRateChange={setMealsRatePerPax}
            />
          </>
        )}
        {!packageId && <p className="text-xs text-muted">Setting up…</p>}

        {/* Summarizes what's already been built above (itinerary + add-ons/
            inclusions) — same reason it's pre-seeded from those, see the
            effect above. */}
        <InclusionsExclusionsForm form={form} update={update} />

        {/* Rendered last — the net rate is computed from the itinerary and
            meals above, so it reads naturally as a summary once everything
            else is set. */}
        <PricingForm form={form} update={update} computedRatePerPax={computedRatePerPax} />

        <div className="flex items-center justify-end gap-2">
          {/* Task 2 — replaces "Save as Draft": every field above autosaves
              a moment after you stop typing, nothing to click. */}
          <span className="text-[11px] text-muted">{autosaving ? 'Saving…' : 'All changes saved'}</span>
          <Button variant="accent" disabled={!!submitting} onClick={handlePublish}>
            {submitting === 'published' ? 'Publishing…' : 'Publish Package'}
          </Button>
        </div>
      </div>
    </div>
  );
}
