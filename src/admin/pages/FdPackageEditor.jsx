import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Button, Card, Checkbox, FieldLabel, Select, Tag, Table, TextInput } from '../components/ui.jsx';
import { ImageUpload } from '../components/ImageUpload.jsx';
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
      multiple
      value={images}
      onChange={onChange}
      onUpload={upload}
      onRemove={remove}
      disabled={!packageId}
      disabledHint="Setting up…"
    />
  );
}

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
          <FieldLabel>Theme</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {FD_THEMES.map((t) => (
              <button key={t} type="button" onClick={() => update('theme', t)}>
                <Tag active={form.theme === t}>{t}</Tag>
              </button>
            ))}
          </div>
        </div>
        <HeroImageUpload packageId={packageId} value={form.heroImageUrl} onUploaded={(url) => update('heroImageUrl', url)} />
        {/* images (carousel) now lives in `form` like every other field —
            previously it had its own parallel `images` state that never
            synced back into `form`, so clicking Save/Publish afterward sent
            a stale `form.images` in the PATCH body and silently overwrote
            the images the upload endpoint had already saved to the DB. */}
        <CarouselImagesUpload packageId={packageId} images={form.images || []} onChange={(imgs) => update('images', imgs)} />
        <div className="sm:col-span-2">
          <FieldLabel>Short description</FieldLabel>
          <TextInput value={form.shortDescription || ''} onChange={(e) => update('shortDescription', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Suitable age (min)</FieldLabel>
          <TextInput type="number" value={form.suitableAgeMin || ''} onChange={(e) => update('suitableAgeMin', Number(e.target.value))} />
        </div>
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

function MerchandisingForm({ form, update, addonsEnabled, onToggleAddons }) {
  return (
    <Card label="Merchandising & discovery attributes" className="border-white">
      <Checkbox checked={!!form.isFeatured} onChange={(v) => update('isFeatured', v)} label="Mark as Featured / Highly Recommended" />
      <Checkbox checked={!!form.isBestseller} onChange={(v) => update('isBestseller', v)} label="Mark as Bestseller" />
      <Checkbox
        checked={addonsEnabled}
        onChange={onToggleAddons}
        label="Add-ons"
        hint="Attach priced add-on activities/tours to this package"
      />
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

// A fresh hotel placement with no occupancy set yet defaults to 2 adults (1
// room) — matches roomsForAdults' own "unset = 1 room" fallback used for
// pricing, just made explicit here so the Adults field never opens blank.
const DEFAULT_HOTEL_ADULTS = 2;

// Hotel is single-select per day — choosing a new hotel for a day replaces
// whatever hotel was already there instead of stacking up multiple. Carries
// over the previous hotel's occupancy (if any) rather than resetting it, so
// swapping hotels on a day doesn't silently drop an adults count the admin
// already set.
function setHotelForDay(items, dayNumber, hotelId) {
  const existingHotel = items.find((it) => it.dayNumber === dayNumber && it.type === 'hotel');
  const withoutOldHotel = items.filter((it) => !(it.dayNumber === dayNumber && it.type === 'hotel'));
  const withNewHotel = addItineraryItem(withoutOldHotel, { type: 'hotel', id: hotelId, dayNumber });
  const lastIdx = withNewHotel.length - 1;
  withNewHotel[lastIdx] = { ...withNewHotel[lastIdx], adults: existingHotel?.adults ?? DEFAULT_HOTEL_ADULTS };
  return withNewHotel;
}

function updateHotelAdults(items, dayNumber, adults) {
  return items.map((it) => (it.dayNumber === dayNumber && it.type === 'hotel' ? { ...it, adults } : it));
}

// Mirrors the backend's roomsForAdults (fdPackages.model.js): a room holds
// up to 2 adults at the hotel's single price_per_night rate; 3+ adults just
// means more rooms, not a higher rate per room. Unset defaults to 1 room.
function roomsForAdults(adults) {
  const n = Number(adults) || 0;
  return n > 0 ? Math.ceil(n / 2) : 1;
}

// Mirrors the backend's computeNetRatePerPax (fdPackages.model.js) so the
// "auto" net rate updates live as items are added/removed, without waiting
// on "Save Itinerary" or a round trip. `catalogs` is the plural
// {hotels, tours, transfers, activities} shape ItineraryManager already
// fetches; catalog rows come straight off the DB (snake_case), same as the
// backend reads them.
const ITINERARY_CATALOG_KEY = { hotel: 'hotels', tour: 'tours', transfer: 'transfers', activity: 'activities' };
const ITINERARY_PRICE_FIELD = { hotel: 'price_per_night', tour: 'price', transfer: 'price', activity: 'price_per_pax' };

function computeItineraryNetRate(items, catalogs) {
  return items.reduce((total, it) => {
    const list = catalogs[ITINERARY_CATALOG_KEY[it.type]] || [];
    const field = ITINERARY_PRICE_FIELD[it.type];
    const ref = list.find((c) => c.id === it.id);
    if (!ref) return total;
    const price = Number(ref[field]) || 0;
    const multiplier = it.type === 'hotel' ? roomsForAdults(it.adults) : 1;
    return total + price * multiplier;
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
// day. Occupancy (adults sharing the room) lives here too, right under the
// selected hotel — price_per_night is a single-room rate (up to 2 adults),
// so the line total shown is price_per_night × rooms, not the flat nightly
// rate, once occupancy pushes it past 1 room (see roomsForAdults).
function DayHotelSection({ hotels, currentHotelId, currentAdults, onSelect, onAdultsChange }) {
  const [open, setOpen] = useState(false);
  const [starCategory, setStarCategory] = useState('');
  const filtered = starCategory ? hotels.filter((h) => h.category === starCategory) : hotels;
  const currentHotel = hotels.find((h) => h.id === currentHotelId) || null;
  const rooms = roomsForAdults(currentAdults);
  const hotelTotal = currentHotel?.price_per_night != null ? Number(currentHotel.price_per_night) * rooms : null;

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
              {hotelTotal != null && <span className="font-semibold text-ink">{formatCurrency(hotelTotal)}</span>}
              <button type="button" onClick={() => onSelect('')} title="Remove" className="flex-none text-muted hover:text-[#a5162d]">
                🗑
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line-light pt-2">
            <span className="text-[11px] font-semibold uppercase text-muted">Adults</span>
            <TextInput
              type="number"
              min="1"
              className="w-20 px-2 py-1.5 text-xs"
              value={currentAdults ?? ''}
              onChange={(e) => onAdultsChange(e.target.value === '' ? null : Number(e.target.value))}
            />
            <span className="text-[11px] text-muted">
              {rooms} room{rooms === 1 ? '' : 's'} at {formatCurrency(currentHotel.price_per_night)}/room/night
            </span>
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
                      {h.price_per_night != null && <span className="font-semibold text-ink">{formatCurrency(h.price_per_night)}/night</span>}
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
// publishing until every day has at least one of each. Extras stay optional.
// `required` only decorates the field label — kept separate from `label`
// itself so the lowercased "No {label} in the catalog yet." empty-state
// message below doesn't pick up a stray asterisk.
const DAY_SECTION_META = {
  tour: { label: 'Tours', addLabel: '+ Add tour', required: true },
  transfer: { label: 'Transfers', addLabel: '+ Add transfer', required: true },
  activity: { label: 'Extras', addLabel: '+ Add extra' },
};

// A day's tours/transfers/extras section — multi-add. Reusable across all
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

// One numbered timeline node — the same layout as QuoteInboxDetail.jsx's
// ItineraryDayCard (circle badge + connecting line + "Day N" heading), except
// each section here adds directly from the catalog instead of dragging from
// a pre-selected pool — an FD package has no separate "agent selection" step
// the way a Custom FIT quote does.
function DayPlanCard({ dayNumber, items, catalogs, notes, onNotesChange, addItem, removeItem, updateNote, setHotel, setHotelAdults, isLast }) {
  const hotelItem = items.find((it) => it.type === 'hotel') || null;
  const tourItems = items.filter((it) => it.type === 'tour');
  const transferItems = items.filter((it) => it.type === 'transfer');
  const activityItems = items.filter((it) => it.type === 'activity');

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      {!isLast && <span className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-line-light" />}
      <span className="relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ink text-xs font-bold text-white shadow-sm">
        {dayNumber}
      </span>
      <div className="flex-1 space-y-3 pt-0.5">
        <div className="text-xs font-bold uppercase tracking-wide text-accent">Day {dayNumber}</div>
        <DayHotelSection
          hotels={catalogs.hotels}
          currentHotelId={hotelItem?.id || ''}
          currentAdults={hotelItem?.adults}
          onSelect={(hotelId) => setHotel(dayNumber, hotelId)}
          onAdultsChange={(adults) => setHotelAdults(dayNumber, adults)}
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
    </div>
  );
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

  function setHotelAdultsForDayNumber(dayNumber, adults) {
    setItineraryItems((items) => updateHotelAdults(items, dayNumber, adults));
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
          ? `${dayCount} day${dayCount === 1 ? '' : 's'}, generated from Duration above. Each day picks its own hotel plus tours/transfers/extras straight from the catalog.`
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
          {Array.from({ length: dayCount }, (_, i) => i + 1).map((dayNumber) => (
            <DayPlanCard
              key={dayNumber}
              dayNumber={dayNumber}
              items={itemsForDay(itineraryItems, dayNumber)}
              catalogs={{ hotels, tours, transfers, activities }}
              notes={dayNotes[dayNumber] || ''}
              onNotesChange={(value) => setDayNotes((n) => ({ ...n, [dayNumber]: value }))}
              addItem={(type, id) => addItemToDay(dayNumber, type, id)}
              removeItem={removeItemFromDay}
              updateNote={updateItemNoteByKey}
              setHotel={setHotelForDayNumber}
              setHotelAdults={setHotelAdultsForDayNumber}
              isLast={dayNumber === dayCount}
            />
          ))}
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

function AddonsManager({ fdPackageId, addons, onChange }) {
  const [activities, setActivities] = useState([]);
  const [tours, setTours] = useState([]);
  const [selection, setSelection] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('');

  useEffect(() => {
    api.get('/activities').then((d) => setActivities(d.activities));
    api.get('/tours').then((d) => setTours(d.tours));
  }, []);

  async function add() {
    if (!selection || !location || !price) return;
    const [kind, id] = selection.split(':');
    const payload =
      kind === 'activity'
        ? { activityId: id, location, pricePerPax: Number(price) }
        : { tourId: id, location, pricePerPax: Number(price) };
    const { addon } = await api.post(`/admin/fd-packages/${fdPackageId}/addons`, payload);
    const name = (kind === 'activity' ? activities : tours).find((x) => x.id === id)?.name;
    onChange([...addons, { ...addon, name }]);
    setSelection('');
    setLocation('');
    setPrice('');
  }

  async function remove(id) {
    await api.del(`/admin/fd-packages/${fdPackageId}/addons/${id}`);
    onChange(addons.filter((a) => a.id !== id));
  }

  return (
    <Card label="Add-on activities & tours" className="border-white">
      <p className="mb-3 text-xs text-muted">
        The same activity/tour can be added more than once with a different departure location and price —
        e.g. a tour priced differently ex-Muscat vs ex-Salalah.
      </p>
      <Table
        columns={['Name', 'Location', 'Price / pax', '']}
        rows={addons}
        renderRow={(a) => (
          <tr key={a.id} className="border-b border-line-light last:border-0">
            <td className="px-3 py-2">{a.name}</td>
            <td className="px-3 py-2">{a.location || '—'}</td>
            <td className="px-3 py-2">₹{a.pricePerPax}</td>
            <td className="px-3 py-2 text-right">
              <button onClick={() => remove(a.id)} className="text-[#a5162d] hover:underline">
                Remove
              </button>
            </td>
          </tr>
        )}
      />
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <FieldLabel>Activity / tour</FieldLabel>
          <Select value={selection} onChange={(e) => setSelection(e.target.value)}>
            <option value="">Select…</option>
            {activities.map((a) => (
              <option key={a.id} value={`activity:${a.id}`}>
                {a.name}
              </option>
            ))}
            {tours.map((t) => (
              <option key={t.id} value={`tour:${t.id}`}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel>Departure location</FieldLabel>
          <TextInput placeholder="e.g. Muscat" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Price per pax</FieldLabel>
          <TextInput type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <Button onClick={add}>+ Add add-on</Button>
      </div>
    </Card>
  );
}

// One meal type's fields (Lunch or Dinner) — just a headcount and a day
// count; there's no picking a specific catalog entry, `meal` is resolved
// automatically by MealsManager (the one meals-catalog row of that
// meal_type). Reusable since Lunch and Dinner are otherwise identical. Shows
// the live cost (price_per_day × people × days — mirrors computeMealsCost on
// the backend; the catalog only captures a "price for 1 day" now, treated as
// the per-person-per-day rate). `enabled` is separate local UI state in the
// parent so checking the box doesn't depend on a price already existing, and
// Checkbox itself renders no children — the detail fields are a sibling,
// shown only while enabled.
function MealSection({ label, meal, enabled, onToggle, people, days, onFieldChange }) {
  const cost = meal && people && days ? Number(meal.price_per_day) * Number(people) * Number(days) : 0;

  return (
    <div>
      <Checkbox checked={enabled} onChange={onToggle} label={label} />
      {enabled &&
        (meal ? (
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Number of people</FieldLabel>
              <TextInput type="number" value={people ?? ''} onChange={(e) => onFieldChange({ people: e.target.value, days })} />
            </div>
            <div>
              <FieldLabel>Number of {label.toLowerCase()} days</FieldLabel>
              <TextInput type="number" value={days ?? ''} onChange={(e) => onFieldChange({ people, days: e.target.value })} />
            </div>
            <p className="sm:col-span-2 text-[11px] text-muted">
              {formatCurrency(meal.price_per_day)}/person/day · {label} cost: {formatCurrency(cost)}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted">No {label.toLowerCase()} price configured in the catalog yet.</p>
        ))}
    </div>
  );
}

// Optional lunch/dinner add-ons — either, both, or neither. Just a headcount
// and a day count per type; the price comes straight from that meal_type's
// catalog entry (see meals tab), not a picker. The combined cost feeds live
// into the auto-computed Net rate (see PricingForm) the same way the
// itinerary does, via onComputedRateChange; nothing here is persisted
// separately, it's just more fields on `form` saved with Save as Draft/Publish.
function MealsManager({ form, update, onComputedRateChange }) {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lunchEnabled, setLunchEnabled] = useState(false);
  const [dinnerEnabled, setDinnerEnabled] = useState(false);

  useEffect(() => {
    api.get('/meals').then((d) => setMeals(d.meals || [])).finally(() => setLoading(false));
  }, []);

  // Sync the toggles once this package's data has actually loaded (form.id
  // shows up) — not on every keystroke elsewhere in the form, and not before
  // there's anything to sync from.
  useEffect(() => {
    if (form.id == null) return;
    setLunchEnabled(form.lunchMealId != null);
    setDinnerEnabled(form.dinnerMealId != null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id]);

  // "The" lunch/dinner entry — one catalog row is expected per meal_type
  // (see the meals tab), so there's nothing for the admin to choose between.
  const lunchMeal = meals.find((m) => m.meal_type === 'lunch');
  const dinnerMeal = meals.find((m) => m.meal_type === 'dinner');

  function mealCost(meal, people, days) {
    return meal && people && days ? Number(meal.price_per_day) * Number(people) * Number(days) : 0;
  }
  const mealsTotal = mealCost(lunchMeal, form.lunchPeople, form.lunchDays) + mealCost(dinnerMeal, form.dinnerPeople, form.dinnerDays);

  useEffect(() => {
    if (loading) return;
    onComputedRateChange?.(mealsTotal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealsTotal, loading]);

  function toggleMeal(prefix, setEnabled, meal, checked) {
    setEnabled(checked);
    if (checked) {
      update(`${prefix}MealId`, meal?.id ?? null);
    } else {
      update(`${prefix}MealId`, null);
      update(`${prefix}People`, null);
      update(`${prefix}Days`, null);
    }
  }

  function fieldChange(prefix, { people, days }) {
    update(`${prefix}People`, people === '' ? null : Number(people));
    update(`${prefix}Days`, days === '' ? null : Number(days));
  }

  return (
    <Card label="Meals" className="border-white">
      {loading ? (
        <p className="text-sm text-muted">Loading meal options…</p>
      ) : (
        <div className="space-y-3">
          <MealSection
            label="Lunch"
            meal={lunchMeal}
            enabled={lunchEnabled}
            onToggle={(checked) => toggleMeal('lunch', setLunchEnabled, lunchMeal, checked)}
            people={form.lunchPeople}
            days={form.lunchDays}
            onFieldChange={(next) => fieldChange('lunch', next)}
          />
          <MealSection
            label="Dinner"
            meal={dinnerMeal}
            enabled={dinnerEnabled}
            onToggle={(checked) => toggleMeal('dinner', setDinnerEnabled, dinnerMeal, checked)}
            people={form.dinnerPeople}
            days={form.dinnerDays}
            onFieldChange={(next) => fieldChange('dinner', next)}
          />
          {(lunchEnabled || dinnerEnabled) && (
            <p className="text-sm font-semibold text-ink">Meals total: {formatCurrency(mealsTotal)}</p>
          )}
        </div>
      )}
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
  const [addonsEnabled, setAddonsEnabled] = useState(false);
  const [submitting, setSubmitting] = useState('');
  // Live "auto" net rate — the itinerary total (ItineraryManager) plus any
  // selected meals (MealsManager), each reported independently as they're
  // edited so neither has to wait on the other or on a save round trip.
  // Both start at null ("still calculating") rather than 0, so the Net rate
  // field shows "—" instead of flashing ₹0 before either has finished its
  // first pass. Kept separate from `form` so this never gets sent back to
  // the server as if it were the override.
  const [itineraryRatePerPax, setItineraryRatePerPax] = useState(null);
  const [mealsRatePerPax, setMealsRatePerPax] = useState(null);
  const computedRatePerPax =
    itineraryRatePerPax == null || mealsRatePerPax == null ? null : itineraryRatePerPax + mealsRatePerPax;

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
      setAddonsEnabled((fdPackage.addons || []).length > 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

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

  async function handleSave(status) {
    if (status === 'published') {
      const itineraryError = findItineraryPublishError();
      if (itineraryError) {
        toast.error(itineraryError);
        return;
      }
    }
    setSubmitting(status);
    try {
      const payload = { ...form, status };
      if (!packageId) {
        const { fdPackage } = await api.post('/admin/fd-packages', payload);
        setPackageId(fdPackage.id);
        navigate(`/admin/catalog/fd-packages/${fdPackage.id}`, { replace: true });
      } else {
        const { fdPackage } = await api.patch(`/admin/fd-packages/${packageId}`, payload);
        setForm(toFormState(fdPackage));
      }
      toast.success(status === 'published' ? 'FD package published' : 'Draft saved');
    } catch (err) {
      toast.error(describeApiError(err));
    } finally {
      setSubmitting('');
    }
  }

  return (
    <div className="min-h-screen bg-[#eef1f7]">
      <div className="mx-auto max-w-4xl space-y-4 p-6 lg:p-10">
        <button onClick={() => navigate('/admin/catalog')} className="text-xs text-muted hover:text-ink">
          ← Back to catalog
        </button>
        <h2 className="text-3xl font-bold">{isNew ? 'Add FD Package' : `Edit — ${form.title || ''}`}</h2>

        <BasicsForm form={form} update={update} packageId={packageId} />
        <MerchandisingForm form={form} update={update} addonsEnabled={addonsEnabled} onToggleAddons={setAddonsEnabled} />

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
            {addonsEnabled && <AddonsManager fdPackageId={packageId} addons={addons} onChange={setAddons} />}
          </>
        )}
        {!packageId && <p className="text-xs text-muted">Setting up…</p>}

        {/* Just above Pricing — its live cost feeds into the same computed
            Net rate, alongside the itinerary total above. */}
        <MealsManager form={form} update={update} onComputedRateChange={setMealsRatePerPax} />

        {/* Rendered last — the net rate is computed from the itinerary and
            meals above, so it reads naturally as a summary once everything
            else is set. */}
        <PricingForm form={form} update={update} computedRatePerPax={computedRatePerPax} />

        <div className="flex justify-end gap-2">
          <Button disabled={!!submitting} onClick={() => handleSave('draft')}>
            {submitting === 'draft' ? 'Saving…' : 'Save as Draft'}
          </Button>
          <Button variant="accent" disabled={!!submitting} onClick={() => handleSave('published')}>
            {submitting === 'published' ? 'Publishing…' : 'Publish Package'}
          </Button>
        </div>
      </div>
    </div>
  );
}
