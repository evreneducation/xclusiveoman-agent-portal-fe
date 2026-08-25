import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card, Checkbox, ErrorText, FieldLabel, Select, Tag, TextInput } from '../components/ui.jsx';
import ItineraryDocument from '../components/ItineraryDocument.jsx';
import {
  ITINERARY_ITEM_TYPE_META,
  buildFullItineraryDays,
  computeDayCount,
  deserializeItinerary,
  itemsForDay,
  itineraryItemKey,
  resolveItemMeta,
  serializeItinerary,
  updateItineraryItemNote,
} from '../../shared/itinerary/index.js';

// Today, as a "YYYY-MM-DD" string in the browser's local timezone — matches
// what <input type="date"> reads/writes, so it can be used directly as a
// `min` bound and in string comparisons without any Date-object timezone
// pitfalls. (Not toISOString().slice(0, 10) — that's UTC and can read as
// "tomorrow" or "yesterday" depending on the agent's local time of day.)
function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// FIT-1: Trip Details is just destination/dates/pax — hotel/tours/transfers/
// extras selection now happens inside Itinerary (FIT-5), city by city, day by
// day, instead of upfront here.
//
// The builder used to gate these three behind a tab-style step indicator
// (only one section mounted at a time, Back/Next to move between them). It's
// now a single scrolling page with all three sections stacked and numbered —
// SectionHeading below is what replaces the old StepIndicator tabs; `n` here
// is just the heading's own number, unrelated to any navigation state.
function SectionHeading({ n, title, subtitle }) {
  return (
    <div className="mb-3 mt-9 flex items-start gap-3 first:mt-0">
      <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-agent-accent text-sm font-bold text-white shadow-sm">
        {n}
      </span>
      <div>
        <h3 className="text-lg font-bold text-agent-ink">{title}</h3>
        {subtitle && <p className="text-xs text-agent-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

function CatalogImage({ url }) {
  return url ? (
    <img src={url} alt="" className="h-28 w-full rounded-md border border-agent-line-light object-cover" />
  ) : (
    <div className="flex h-28 w-full items-center justify-center rounded-md border border-dashed border-agent-line-light font-mono text-[9px] text-agent-muted">
      No image
    </div>
  );
}

// Trip Details (FIT-1) — destination, dates, pax only.
function TripFieldsCard({ form, update }) {
  return (
    <Card label="Trip details" className="border-white">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldLabel>Destination *</FieldLabel>
          <TextInput placeholder="e.g. Muscat, Oman" value={form.destination} onChange={(e) => update('destination', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Travel start date *</FieldLabel>
          <TextInput type="date" min={todayDateString()} value={form.dateFrom} onChange={(e) => update('dateFrom', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Travel end date *</FieldLabel>
          {/* min= the selected Start Date (falling back to today when none is
              picked yet) disables every earlier date in the End Date
              calendar itself, on top of the auto-clear-on-conflict effect
              and validateStep's submit-time check below. */}
          <TextInput
            type="date"
            min={form.dateFrom || todayDateString()}
            value={form.dateTo}
            onChange={(e) => update('dateTo', e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Adults *</FieldLabel>
          <TextInput type="number" min="1" value={form.paxAdults} onChange={(e) => update('paxAdults', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Children</FieldLabel>
          <TextInput type="number" min="0" value={form.paxChildren} onChange={(e) => update('paxChildren', e.target.value)} />
        </div>
      </div>
    </Card>
  );
}

// Star categories the Product Catalog actually supports (admin/lib/
// hotelForm.js's STAR_OPTIONS) — no "Luxury" tier exists in the hotels
// schema (just a plain 3/4/5 `category` column), so the picker only offers
// what the catalog can actually filter on.
const HOTEL_STAR_CATEGORIES = [3, 4, 5];

// Renamed from the obvious "StarRating" to avoid confusion with agent/
// components/ui.jsx's StarRating, which renders a numeric review rating
// (rating + review count) — hotels have neither; this just turns the plain
// 3/4/5 `category` column into star glyphs.
function HotelStars({ category }) {
  return (
    <span className="tracking-tight text-agent-accent-dark">
      {'★'.repeat(category)}
      <span className="text-agent-line-light">{'★'.repeat(Math.max(0, 5 - category))}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Itinerary (FIT-5) — city/day allocation + day-wise builder
// ---------------------------------------------------------------------------

// The "city from the DB stored city" the City & Days planner picks from —
// every distinct, non-empty city already present across the loaded catalogs,
// not free text. Sorted for a stable, scannable dropdown.
function distinctCities(...catalogs) {
  const set = new Set();
  for (const list of catalogs) {
    for (const item of list) {
      if (item.city) set.add(item.city);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function sumCityDays(cityDays) {
  return cityDays.reduce((total, row) => total + (Number(row.days) || 0), 0);
}

// cityDays -> { [dayNumber]: city|null } for days 1..dayCount. Walks the
// rows cumulatively: the first row's days claim Day 1..N, the next row's
// days claim the following block, and so on. Days past the allocated total
// (cityDays can total less than dayCount, never more — see updateCityRow's
// clamping) map to null, meaning "no city assigned to this day yet".
function buildDayCityMap(cityDays, dayCount) {
  const map = {};
  let day = 1;
  for (const row of cityDays) {
    const rowDays = Math.max(0, Number(row.days) || 0);
    for (let i = 0; i < rowDays && day <= dayCount; i++, day++) {
      map[day] = row.city;
    }
  }
  for (; day <= dayCount; day++) map[day] = null;
  return map;
}

let cityRowSeq = 0;
function nextCityRowId() {
  cityRowSeq += 1;
  return `city-${cityRowSeq}-${Date.now()}`;
}

// Adds a brand-new instance of a catalog item directly onto a day. Unlike
// the old select-then-drag model, items in this builder never pass through
// an "unassigned" tray — every item is added straight onto the day (and
// city) it belongs to, so this always appends to the end of that day's list.
// The same catalog item (typically a hotel) can be added to more than one
// day, so the key includes the day and a random suffix rather than being a
// plain `type:id`.
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

// Removes one item by its (unique, per-instance) key and renumbers the
// remaining items in that day so positions stay a dense 0..n-1 sequence.
function removeItineraryItemByKey(items, key) {
  const removing = items.find((it) => it.key === key);
  if (!removing) return items;
  const rest = items.filter((it) => it.key !== key);
  const remainingInDay = itemsForDay(rest, removing.dayNumber).map((it, idx) => ({ ...it, position: idx }));
  const others = rest.filter((it) => it.dayNumber !== removing.dayNumber);
  return [...others, ...remainingInDay];
}

// Hotel is single-select per day — choosing a new hotel for a day replaces
// whatever hotel was already there instead of stacking up multiple. Carries
// over the previous hotel's occupancy (if any) rather than resetting it, so
// swapping hotels on a day doesn't silently drop an occupancy already set.
function setHotelForDay(items, dayNumber, hotelId) {
  const existingHotel = items.find((it) => it.dayNumber === dayNumber && it.type === 'hotel');
  const withoutOldHotel = items.filter((it) => !(it.dayNumber === dayNumber && it.type === 'hotel'));
  const withNewHotel = addItineraryItem(withoutOldHotel, { type: 'hotel', id: hotelId, dayNumber });
  const lastIdx = withNewHotel.length - 1;
  withNewHotel[lastIdx] = { ...withNewHotel[lastIdx], occupancy: existingHotel?.occupancy ?? DEFAULT_OCCUPANCY };
  return withNewHotel;
}

function updateHotelOccupancy(items, dayNumber, occupancy) {
  return items.map((it) => (it.dayNumber === dayNumber && it.type === 'hotel' ? { ...it, occupancy } : it));
}

// A fresh hotel placement with no occupancy set yet defaults to Double —
// matches roomsForOccupancy's own unset-fallback (src/utils/occupancy.js),
// just made explicit here so the Occupancy field never opens blank.
const DEFAULT_OCCUPANCY = 'double';

const OCCUPANCY_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'triple', label: 'Triple' },
];
const OCCUPANCY_CAPACITY = { single: 1, double: 2, triple: 3 };

// Mirrors the backend's roomsForOccupancy (src/utils/occupancy.js): headcount
// is already known from Trip Details (paxAdults) — the Occupancy pick just
// says how that fixed headcount splits into rooms. This builder never shows
// price (Xclusive Oman prices the request after submission — see the page
// header), so this only drives the "N room(s)" display, not any cost figure.
function roomsForOccupancy(paxAdults, occupancy) {
  const capacity = OCCUPANCY_CAPACITY[occupancy] || OCCUPANCY_CAPACITY.double;
  const n = Number(paxAdults) || 0;
  return n > 0 ? Math.ceil(n / capacity) : 1;
}

function dedupeIdsByType(items, type) {
  const ids = [];
  const seen = new Set();
  for (const it of items) {
    if (it.type === type && !seen.has(it.id)) {
      seen.add(it.id);
      ids.push(it.id);
    }
  }
  return ids;
}

// Best-effort reconstruction of city/day blocks from an already-saved
// itinerary (resuming a draft saved before this feature existed, or one left
// with under-filled days) — `cityDays` itself isn't part of the persisted
// package-request shape, only the per-day items are. Walks day 1..dayCount,
// reads the city of whichever item already occupies that day, and collapses
// consecutive same-city runs into rows; a day with no items yet breaks the
// run and is left for the agent to fill in manually.
function deriveCityDaysFromItems(items, dayCount, catalogs) {
  const rows = [];
  let current = null;
  for (let day = 1; day <= dayCount; day++) {
    let city = null;
    for (const it of itemsForDay(items, day)) {
      const meta = resolveItemMeta(it.type, it.id, catalogs);
      if (meta?.city) {
        city = meta.city;
        break;
      }
    }
    if (city && current && current.city === city) {
      current.days += 1;
    } else if (city) {
      current = { id: nextCityRowId(), city, days: 1 };
      rows.push(current);
    } else {
      current = null;
    }
  }
  return rows;
}

// City & Days planner — the first thing the agent fills in on Itinerary.
// Each row is a city (picked from the catalogs' own city values) plus how
// many days of the trip it gets; the day-wise itinerary below is generated
// straight from this allocation.
function CityDaysPlanner({ cityOptions, cityDays, dayCount, addCityRow, updateCityRow, removeCityRow }) {
  const allocated = sumCityDays(cityDays);
  const remaining = Math.max(0, dayCount - allocated);

  return (
    <Card label="Cities & days" className="border-white">
      <p className="mb-3 text-xs text-agent-muted">
        Pick the cities this trip covers and how many days each gets — the day-wise itinerary below is built from
        this. Total days across all cities can't exceed the trip length set in Trip Details.
      </p>
      {dayCount === 0 ? (
        <p className="text-sm text-agent-muted">Set Travel Start Date and Travel End Date in Trip Details first.</p>
      ) : (
        <>
          <div className="mb-3 text-xs font-semibold text-agent-ink">
            {allocated} of {dayCount} day{dayCount === 1 ? '' : 's'} allocated
            {remaining > 0 && <span className="font-normal text-agent-muted"> · {remaining} remaining</span>}
          </div>
          {cityDays.length === 0 && <p className="mb-2 text-sm text-agent-muted">No cities added yet.</p>}
          <div className="space-y-2">
            {cityDays.map((row, idx) => (
              <div key={row.id} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[180px] flex-1">
                  <FieldLabel>City {idx + 1} *</FieldLabel>
                  <Select value={row.city} onChange={(e) => updateCityRow(row.id, 'city', e.target.value)}>
                    <option value="">Select a city…</option>
                    {cityOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-28">
                  <FieldLabel>Days *</FieldLabel>
                  <TextInput
                    type="number"
                    min="1"
                    value={row.days}
                    onChange={(e) => updateCityRow(row.id, 'days', e.target.value)}
                  />
                </div>
                <Button onClick={() => removeCityRow(row.id)} title="Remove this city">
                  🗑
                </Button>
              </div>
            ))}
          </div>
          <Button className="mt-3" disabled={remaining === 0} onClick={addCityRow}>
            + Add city
          </Button>
        </>
      )}
    </Card>
  );
}

// A placed hotel/tour/transfer/extra on a specific day — a trimmed,
// non-draggable version of the old ItineraryItemChip (there's no
// drag-and-drop between days anymore: every item is added directly to the
// day it belongs to, filtered by that day's city).
function PlacedItemChip({ item, meta, onNoteChange, onRemove }) {
  const typeMeta = ITINERARY_ITEM_TYPE_META[item.type];
  return (
    <div className="rounded-md border border-agent-line-light bg-white px-2.5 py-2 text-xs shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex-none">{typeMeta?.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-agent-ink">{meta?.name || 'Unknown item'}</div>
          <div className="truncate text-[10px] text-agent-muted">
            {typeMeta?.label}
            {meta?.city ? ` · ${meta.city}` : ''}
          </div>
        </div>
        <button type="button" onClick={onRemove} title="Remove" className="flex-none text-agent-muted hover:text-[#a5162d]">
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

// A day's hotel section — single-select, filtered to that day's city, gated
// behind a star-category pick first (matching the old HotelsStep). Choosing
// a hotel replaces whatever was already selected for this day. Occupancy
// lives here too — Single/Double/Triple, since headcount is already known
// from Trip Details (paxAdults). No price shown anywhere in this builder
// (Xclusive Oman prices the request after submission), so this only shows
// the resulting room count, not a cost.
function DayHotelSection({ city, hotels, currentHotelId, currentOccupancy, paxAdults, onSelect, onOccupancyChange }) {
  const [open, setOpen] = useState(false);
  const [starCategory, setStarCategory] = useState('');
  const inCity = hotels.filter((h) => (h.city || '').toLowerCase() === city.toLowerCase());
  const filtered = starCategory ? inCity.filter((h) => h.category === starCategory) : inCity;
  const currentHotel = hotels.find((h) => h.id === currentHotelId) || null;
  const rooms = roomsForOccupancy(paxAdults, currentOccupancy);

  return (
    <div>
      <FieldLabel>Hotel</FieldLabel>
      {currentHotel ? (
        <div className="rounded-md border border-agent-line-light bg-white px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-agent-ink">{currentHotel.name}</div>
              <div className="text-agent-muted">
                {currentHotel.category ? `${currentHotel.category}★ · ` : ''}
                {currentHotel.city}
              </div>
            </div>
            <button type="button" onClick={() => onSelect('')} title="Remove" className="flex-none text-agent-muted hover:text-[#a5162d]">
              🗑
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-agent-line-light pt-2">
            <span className="text-[11px] font-semibold uppercase text-agent-muted">Occupancy</span>
            <Select
              className="w-28 px-2 py-1.5 text-xs"
              value={currentOccupancy || DEFAULT_OCCUPANCY}
              onChange={(e) => onOccupancyChange(e.target.value)}
            >
              {OCCUPANCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <span className="text-[11px] text-agent-muted">
              {rooms} room{rooms === 1 ? '' : 's'} for {paxAdults || 0} adult{paxAdults === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      ) : (
        <p className="mb-1 text-[11px] text-agent-muted">No hotel selected for this day.</p>
      )}
      <Button className="mt-1.5" onClick={() => setOpen((o) => !o)}>
        {open ? 'Close' : currentHotel ? 'Change hotel' : '+ Add hotel'}
      </Button>
      {open && (
        <div className="mt-2 rounded-md border border-dashed border-agent-line-light p-2.5">
          <div className="mb-2 flex flex-wrap gap-2">
            {HOTEL_STAR_CATEGORIES.map((cat) => (
              <button key={cat} type="button" onClick={() => setStarCategory((c) => (c === cat ? '' : cat))}>
                <Tag active={starCategory === cat}>{cat}★</Tag>
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="text-[11px] text-agent-muted">
              No hotels in {city}
              {starCategory ? ` at ${starCategory}★` : ''}.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filtered.map((h) => {
                const selected = h.id === currentHotelId;
                return (
                  <div
                    key={h.id}
                    className={`rounded-md border p-2 text-xs ${selected ? 'border-agent-accent ring-1 ring-agent-accent/25' : 'border-agent-line-light'}`}
                  >
                    <CatalogImage url={h.images?.[0]} />
                    <div className="mt-1.5 font-semibold text-agent-ink">{h.name}</div>
                    <HotelStars category={h.category} />
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

// Tours and Transfers are marked required (matching the "*" convention used
// elsewhere in this builder, e.g. "City *") — validateStep(2) below blocks
// moving past Itinerary until every day has at least one of each. Extras
// stay optional. `required` only decorates the field label — kept separate
// from `label` itself so the lowercased "No {label} available…" empty-state
// message below doesn't pick up a stray asterisk.
const DAY_SECTION_META = {
  tour: { label: 'Tours', addLabel: '+ Add tour', required: true },
  transfer: { label: 'Transfers', addLabel: '+ Add transfer', required: true },
  activity: { label: 'Extras', addLabel: '+ Add extra' },
};

// A day's tours/transfers/extras section — multi-add, filtered to that
// day's city. Reusable across all three types since they share the same
// "toggle catalog card in/out of this day" shape.
function DayCatalogSection({ type, city, catalog, placedItems, onAdd, onRemove, onNoteChange }) {
  const [open, setOpen] = useState(false);
  const meta = DAY_SECTION_META[type];
  const inCity = catalog.filter((item) => (item.city || '').toLowerCase() === city.toLowerCase());
  const placedByItemId = new Map(placedItems.map((it) => [it.id, it]));

  return (
    <div>
      <FieldLabel>
        {meta.label}
        {meta.required && ' *'}
      </FieldLabel>
      {placedItems.length === 0 ? (
        <p className="mb-1 text-[11px] text-agent-muted">None added for this day.</p>
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
        <div className="mt-2 rounded-md border border-dashed border-agent-line-light p-2.5">
          {inCity.length === 0 ? (
            <p className="text-[11px] text-agent-muted">
              No {meta.label.toLowerCase()} available in {city}.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {inCity.map((item) => {
                const placed = placedByItemId.get(item.id);
                return (
                  <div
                    key={item.id}
                    className={`rounded-md border p-2 text-xs ${placed ? 'border-agent-accent ring-1 ring-agent-accent/25' : 'border-agent-line-light'}`}
                  >
                    <div className="font-semibold text-agent-ink">{item.name}</div>
                    <div className="text-agent-muted">
                      {type === 'tour' && `${item.category ? item.category + ' · ' : ''}${item.duration || ''}`}
                      {type === 'transfer' && `${item.type ? item.type.replace(/_/g, ' ') : ''}${item.vehicleClass ? ' · ' + item.vehicleClass : ''}`}
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

// One numbered day node — mirrors the old ItineraryDayCard's timeline
// layout, but each section adds directly from that day's city-filtered
// catalog instead of dragging from a shared unassigned tray.
function DayPlanCard({ dayNumber, city, items, catalogs, notes, onNotesChange, addItem, removeItem, updateNote, setHotel, setHotelOccupancy, paxAdults, isLast }) {
  const hotelItem = items.find((it) => it.type === 'hotel') || null;
  const tourItems = items.filter((it) => it.type === 'tour');
  const transferItems = items.filter((it) => it.type === 'transfer');
  const activityItems = items.filter((it) => it.type === 'activity');

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      {!isLast && <span className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-agent-line-light" />}
      <span className="relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-agent-ink text-xs font-bold text-white shadow-sm">
        {dayNumber}
      </span>
      <div className="flex-1 space-y-3 pt-0.5">
        <div className="text-xs font-bold uppercase tracking-wide text-agent-accent-dark">
          Day {dayNumber}
          {city ? ` — ${city}` : ''}
        </div>
        {!city ? (
          <p className="rounded-md border border-dashed border-agent-line-light bg-agent-panel/40 p-3 text-center text-[11px] text-agent-muted">
            Add a city above to plan this day.
          </p>
        ) : (
          <>
            <DayHotelSection
              city={city}
              hotels={catalogs.hotels}
              currentHotelId={hotelItem?.id || ''}
              currentOccupancy={hotelItem?.occupancy}
              paxAdults={paxAdults}
              onSelect={(hotelId) => setHotel(dayNumber, hotelId)}
              onOccupancyChange={(occupancy) => setHotelOccupancy(dayNumber, occupancy)}
            />
            <DayCatalogSection
              type="tour"
              city={city}
              catalog={catalogs.tours}
              placedItems={tourItems}
              onAdd={(id) => addItem('tour', id)}
              onRemove={removeItem}
              onNoteChange={updateNote}
            />
            <DayCatalogSection
              type="transfer"
              city={city}
              catalog={catalogs.transfers}
              placedItems={transferItems}
              onAdd={(id) => addItem('transfer', id)}
              onRemove={removeItem}
              onNoteChange={updateNote}
            />
            <DayCatalogSection
              type="activity"
              city={city}
              catalog={catalogs.activities}
              placedItems={activityItems}
              onAdd={(id) => addItem('activity', id)}
              onRemove={removeItem}
              onNoteChange={updateNote}
            />
            <TextInput placeholder="Notes for this day (optional)…" value={notes} onChange={(e) => onNotesChange(e.target.value)} />
          </>
        )}
      </div>
    </div>
  );
}

// One meal type's fields (Lunch or Dinner) — just a headcount and a day
// count, same as FD Packages' MealSection (admin/pages/FdPackageEditor.jsx):
// there's no picking a specific catalog entry, `meal` is resolved
// automatically (the one meals-catalog row of that meal_type, admin-priced —
// see the Meals tab in Product Catalog). No price shown anywhere — Xclusive
// Oman prices this after submission, same as every other component in this
// builder. `maxPeople` is the trip's own total pax (Trip Details) — meals
// can't feed more people than are actually going.
function CustomFitMealSection({ label, meal, enabled, onToggle, people, days, maxPeople, onFieldChange }) {
  return (
    <div>
      <Checkbox checked={enabled} onChange={onToggle} label={label} />
      {enabled &&
        (meal ? (
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Number of people</FieldLabel>
              <TextInput
                type="number"
                min="1"
                max={maxPeople || undefined}
                value={people ?? ''}
                onChange={(e) => onFieldChange({ people: e.target.value, days })}
              />
              {maxPeople > 0 && <p className="mt-1 text-[10px] text-agent-muted">Up to {maxPeople} (this trip's total pax).</p>}
            </div>
            <div>
              <FieldLabel>Number of {label.toLowerCase()} days</FieldLabel>
              <TextInput type="number" min="1" value={days ?? ''} onChange={(e) => onFieldChange({ people, days: e.target.value })} />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-agent-muted">No {label.toLowerCase()} option in the catalog yet.</p>
        ))}
    </div>
  );
}

// Optional lunch/dinner add-ons — either, both, or neither. Mirrors FD
// Packages' MealsManager, minus any price (this builder never shows cost —
// see the page header). Fields live directly on `form` (lunchMealId/People/
// Days, dinnerMealId/People/Days) so they ride along with every existing
// Save Draft/Submit payload without a separate save step.
function MealsCard({ meals, form, update }) {
  const [lunchEnabled, setLunchEnabled] = useState(false);
  const [dinnerEnabled, setDinnerEnabled] = useState(false);

  // Seeds once on mount from `form` (the lifted, already-loaded source of
  // truth — this whole step only ever mounts after both the catalog and any
  // resumed draft have finished loading, see PackageBuilder's
  // catalogLoading/draftLoading gate). Re-fires correctly if the agent
  // navigates away from Step 2 and back, since ItineraryStep unmounts too.
  useEffect(() => {
    setLunchEnabled(form.lunchMealId != null);
    setDinnerEnabled(form.dinnerMealId != null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lunchMeal = meals.find((m) => m.meal_type === 'lunch');
  const dinnerMeal = meals.find((m) => m.meal_type === 'dinner');
  // Trip Details' own headcount — meals feed everyone traveling, not just
  // adults (unlike hotel occupancy, which is adults-only room capacity).
  const maxPeople = Math.max(0, (Number(form.paxAdults) || 0) + (Number(form.paxChildren) || 0));

  function toggleMeal(prefix, setEnabled, meal, checked) {
    setEnabled(checked);
    if (checked) {
      update(`${prefix}MealId`, meal?.id ?? null);
      // Defaults to "everyone going" rather than opening blank — already
      // within the cap by construction, the agent can only lower it from here.
      update(`${prefix}People`, maxPeople || null);
    } else {
      update(`${prefix}MealId`, null);
      update(`${prefix}People`, null);
      update(`${prefix}Days`, null);
    }
  }

  function fieldChange(prefix, { people, days }) {
    const peopleNumber = people === '' ? null : Math.min(Number(people), maxPeople || Number(people));
    update(`${prefix}People`, peopleNumber);
    update(`${prefix}Days`, days === '' ? null : Number(days));
  }

  return (
    <Card label="Meals" className="border-white">
      <p className="mb-3 text-xs text-agent-muted">
        Optional lunch/dinner add-ons for this trip — Xclusive Oman prices these after submission, same as
        everything else here.
      </p>
      <div className="space-y-3">
        <CustomFitMealSection
          label="Lunch"
          meal={lunchMeal}
          enabled={lunchEnabled}
          onToggle={(checked) => toggleMeal('lunch', setLunchEnabled, lunchMeal, checked)}
          people={form.lunchPeople}
          days={form.lunchDays}
          maxPeople={maxPeople}
          onFieldChange={(next) => fieldChange('lunch', next)}
        />
        <CustomFitMealSection
          label="Dinner"
          meal={dinnerMeal}
          enabled={dinnerEnabled}
          onToggle={(checked) => toggleMeal('dinner', setDinnerEnabled, dinnerMeal, checked)}
          people={form.dinnerPeople}
          days={form.dinnerDays}
          maxPeople={maxPeople}
          onFieldChange={(next) => fieldChange('dinner', next)}
        />
      </div>
    </Card>
  );
}

// Optional Visa add-on — a checkbox plus an adults-only headcount, no
// catalog entry to pick (there's only ever the one Visa row, priced by the
// admin — see Product Catalog's Visa tab). Mirrors MealsCard's toggle
// pattern above, minus the days field and minus a choice between two types.
// Capped to paxAdults specifically (not total pax like Meals, which feeds
// everyone travelling) since Visa only ever applies to the trip's adult
// travellers.
function VisaCard({ form, update }) {
  const [enabled, setEnabled] = useState(false);

  // Seeds once on mount from `form`, same reasoning as MealsCard above.
  useEffect(() => {
    setEnabled(!!form.visaEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxAdults = Math.max(0, Number(form.paxAdults) || 0);

  function toggle(checked) {
    setEnabled(checked);
    update('visaEnabled', checked);
    // Defaults to "every adult travelling" rather than opening blank —
    // already within the cap by construction, the agent can only lower it.
    update('visaPeople', checked ? maxAdults || null : null);
  }

  function onPeopleChange(value) {
    const peopleNumber = value === '' ? null : Math.min(Number(value), maxAdults || Number(value));
    update('visaPeople', peopleNumber);
  }

  return (
    <Card label="Visa" className="border-white">
      <p className="mb-3 text-xs text-agent-muted">
        Optional visa add-on for this trip's adult travellers — Xclusive Oman prices this after submission, same
        as everything else here.
      </p>
      <Checkbox checked={enabled} onChange={toggle} label="Include Visa" />
      {enabled && (
        <div className="mt-2 max-w-xs">
          <FieldLabel>Number of adults</FieldLabel>
          <TextInput
            type="number"
            min="1"
            max={maxAdults || undefined}
            value={form.visaPeople ?? ''}
            onChange={(e) => onPeopleChange(e.target.value)}
          />
          {maxAdults > 0 && <p className="mt-1 text-[10px] text-agent-muted">Up to {maxAdults} (this trip's adults).</p>}
        </div>
      )}
    </Card>
  );
}

// Step 2 — City & Days planner + day-wise itinerary built from it (FIT-5).
function ItineraryStep({
  dayCount,
  cityOptions,
  cityDays,
  addCityRow,
  updateCityRow,
  removeCityRow,
  dayCityMap,
  itineraryItems,
  dayNotes,
  setDayNotes,
  hotels,
  tours,
  transfers,
  activities,
  meals,
  form,
  update,
  addItemToDay,
  removeItemFromDay,
  updateItemNoteByKey,
  setHotelForDayNumber,
  setHotelOccupancyForDayNumber,
}) {
  return (
    <div className="space-y-4">
      <CityDaysPlanner
        cityOptions={cityOptions}
        cityDays={cityDays}
        dayCount={dayCount}
        addCityRow={addCityRow}
        updateCityRow={updateCityRow}
        removeCityRow={removeCityRow}
      />

      <Card label="Day-wise itinerary" className="border-white">
        {dayCount === 0 ? (
          <p className="rounded-md border border-dashed border-agent-line-light bg-agent-panel/40 p-4 text-center text-sm text-agent-muted">
            Set Travel Start Date and Travel End Date in Trip Details to build the day-wise itinerary.
          </p>
        ) : cityDays.length === 0 ? (
          <p className="rounded-md border border-dashed border-agent-line-light bg-agent-panel/40 p-4 text-center text-sm text-agent-muted">
            Add at least one city above to start planning your days.
          </p>
        ) : (
          <div>
            {Array.from({ length: dayCount }, (_, i) => i + 1).map((dayNumber) => (
              <DayPlanCard
                key={dayNumber}
                dayNumber={dayNumber}
                city={dayCityMap[dayNumber]}
                items={itemsForDay(itineraryItems, dayNumber)}
                catalogs={{ hotels, tours, transfers, activities }}
                notes={dayNotes[dayNumber] || ''}
                onNotesChange={(value) => setDayNotes((n) => ({ ...n, [dayNumber]: value }))}
                addItem={(type, id) => addItemToDay(dayNumber, type, id)}
                removeItem={removeItemFromDay}
                updateNote={updateItemNoteByKey}
                setHotel={setHotelForDayNumber}
                setHotelOccupancy={setHotelOccupancyForDayNumber}
                paxAdults={Number(form.paxAdults) || 0}
                isLast={dayNumber === dayCount}
              />
            ))}
          </div>
        )}
      </Card>

      <MealsCard meals={meals} form={form} update={update} />

      <VisaCard form={form} update={update} />
    </div>
  );
}

// Traveller Details rows are entirely derived from Trip Details' adult/child
// counts (no manual add/remove) — passport only ever applies to adults, so
// each row carries a `type` rather than relying on array position.
function TravelersEditor({ travelers, updateTraveler }) {
  const indexed = travelers.map((t, idx) => ({ ...t, idx }));
  const adults = indexed.filter((t) => t.type === 'adult');
  const children = indexed.filter((t) => t.type === 'child');

  function renderRow(t) {
    return (
      <div key={t.idx} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[160px]">
          <FieldLabel>Name *</FieldLabel>
          <TextInput value={t.name} onChange={(e) => updateTraveler(t.idx, 'name', e.target.value)} />
        </div>
        {t.type === 'adult' ? (
          <div className="flex-1 min-w-[160px]">
            <FieldLabel>Passport no. *</FieldLabel>
            <TextInput value={t.passportNo || ''} onChange={(e) => updateTraveler(t.idx, 'passportNo', e.target.value)} />
          </div>
        ) : (
          <span className="mb-2.5 text-[11px] text-agent-muted">Passport not required for children</span>
        )}
      </div>
    );
  }

  return (
    <Card label="Traveller details" className="border-white">
      <p className="mb-3 text-xs text-agent-muted">
        One row per traveller, matching the adult/child count from Trip details. Name is required for everyone —
        passport number is required for adults only.
      </p>
      {adults.length === 0 && children.length === 0 ? (
        <p className="text-sm text-agent-muted">Set the number of adults/children in Trip details to add traveller rows.</p>
      ) : (
        <div className="space-y-4">
          {adults.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase text-agent-muted">Adults ({adults.length})</div>
              <div className="space-y-2">{adults.map(renderRow)}</div>
            </div>
          )}
          {children.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase text-agent-muted">Children ({children.length})</div>
              <div className="space-y-2">{children.map(renderRow)}</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// Step 3 — review & submit. No price/cost/markup fields anywhere (FIT-6).
function ReviewStep({ form, dayCount, hotels, days, selectedCounts, travelers, updateTraveler, downloadingPdf, onDownloadPdf }) {
  return (
    <div className="space-y-4">
      {/* Redesigned to read like a real client-facing itinerary document
          (see ItineraryDocument.jsx) rather than a wizard-review checklist.
          "Download PDF" renders this same document server-side (Puppeteer —
          see itineraryPdf.service.js) instead of the browser's own
          print-to-PDF, so the .print:hidden below is now just a fallback in
          case an agent uses their browser's own Ctrl+P on this page. */}
      <div className="flex justify-end print:hidden">
        <Button variant="accent" onClick={onDownloadPdf} disabled={downloadingPdf}>
          {downloadingPdf ? 'Generating PDF…' : '⬇️ Download PDF'}
        </Button>
      </div>

      <ItineraryDocument
        destination={form.destination}
        dateFrom={form.dateFrom}
        dateTo={form.dateTo}
        paxAdults={Number(form.paxAdults) || 0}
        paxChildren={Number(form.paxChildren) || 0}
        dayCount={dayCount}
        hotels={hotels}
        days={days}
        selectedCounts={selectedCounts}
      />

      {/* Traveller details is data entry, not part of the client-facing
          document — still required before Submit (validateStep(3)), just
          kept out of the printed/PDF output. */}
      <div className="print:hidden">
        <TravelersEditor travelers={travelers} updateTraveler={updateTraveler} />
      </div>
    </div>
  );
}

function validateStep(step, { form, cityDays, itineraryItems, travelers, dayCount }) {
  if (step === 1) {
    if (!form.destination.trim()) return 'Destination is required.';
    if (!form.dateFrom || !form.dateTo) return 'Travel start and end dates are required.';
    // String comparison, not Date parsing — both are plain "YYYY-MM-DD" from
    // <input type="date">, so lexicographic order already matches
    // chronological order (see the matching backend refine in schemas.js).
    if (form.dateTo < form.dateFrom) return 'End date cannot be earlier than the start date.';
    if (form.dateFrom < todayDateString()) return 'Start date cannot be in the past.';
    if (!form.paxAdults || Number(form.paxAdults) < 1) return 'At least one adult is required.';
    return '';
  }
  if (step === 2) {
    if (cityDays.length === 0) return 'Add at least one city to build the itinerary.';
    // Hotel selection now happens per day inside Itinerary (was its own
    // Trip Details gate before) — still mandatory before moving on.
    if (!itineraryItems.some((it) => it.type === 'hotel')) return 'Select at least one hotel in your itinerary.';
    // Every day needs at least one tour and one transfer of its own, not
    // just somewhere in the trip — mirrors the day-by-day granularity the
    // rest of Itinerary already works at (hotel is trip-wide since the same
    // hotel usually covers a whole city stay; tours/transfers are what
    // actually varies day to day).
    for (let day = 1; day <= dayCount; day++) {
      const dayItems = itemsForDay(itineraryItems, day);
      if (!dayItems.some((it) => it.type === 'tour')) return `Day ${day} needs at least one tour.`;
      if (!dayItems.some((it) => it.type === 'transfer')) return `Day ${day} needs at least one transfer.`;
    }
    return '';
  }
  if (step === 3) {
    if (travelers.some((t) => !t.name.trim())) return 'Enter a name for every traveller.';
    if (travelers.some((t) => t.type === 'adult' && !(t.passportNo || '').trim())) {
      return 'Enter a passport number for every adult traveller.';
    }
    return '';
  }
  return '';
}

// Traveller Details rows are derived from Trip Details' adult/child counts,
// not manually added/removed — this resizes one type's group to match,
// keeping already-entered rows (by position within that type) and only
// adding/dropping from the end when the count changes.
function resizeTravelerGroup(list, count, type) {
  if (list.length === count) return list;
  if (list.length > count) return list.slice(0, count);
  const additions = Array.from({ length: count - list.length }, () => ({ name: '', passportNo: '', type }));
  return [...list, ...additions];
}

export default function PackageBuilder() {
  const navigate = useNavigate();
  const { id: draftIdParam } = useParams();

  const [form, setForm] = useState({ destination: '', dateFrom: '', dateTo: '', paxAdults: 2, paxChildren: 0 });

  const [hotels, setHotels] = useState([]);
  const [tours, setTours] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [meals, setMeals] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // City & Days planner (FIT-1/FIT-5 merge) — [{ id, city, days }], sum of
  // `days` never exceeds the trip's day count (see updateCityRow's clamp).
  const [cityDays, setCityDays] = useState([]);

  // Rows are derived from form.paxAdults/paxChildren (see the sync effect
  // below) rather than started with a hardcoded default row.
  const [travelers, setTravelers] = useState([]);

  // Day-wise Itinerary Planner (FIT-5) — items are the source of truth now
  // (hotel/tour/transfer/extra selection happens by adding an item directly
  // onto a day), not just a placement layer over a separate upfront
  // selection. See shared/itinerary/index.js for the item shape.
  const [itineraryItems, setItineraryItems] = useState([]);
  const [dayNotes, setDayNotes] = useState({});

  // Draft Quotes (item 1) — "Continue Editing" opens /agent/package-builder/:id;
  // draftId then tracks which row "Save Draft" and "Submit Request" write to.
  const [draftId, setDraftId] = useState(draftIdParam || '');
  const [draftLoading, setDraftLoading] = useState(!!draftIdParam);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState('');

  useEffect(() => {
    Promise.all([api.get('/hotels'), api.get('/tours'), api.get('/transfers'), api.get('/activities'), api.get('/meals')])
      .then(([h, t, tr, a, m]) => {
        setHotels(h.hotels || []);
        setTours(t.tours || []);
        setTransfers(tr.transfers || []);
        setActivities(a.activities || []);
        setMeals(m.meals || []);
      })
      .catch((err) => setError(err.message || 'Unable to load catalog'))
      .finally(() => setCatalogLoading(false));
  }, []);

  // Loads a previously-saved draft's state into the wizard so "Continue
  // Editing" resumes exactly where the agent left off. cityDays isn't part
  // of the persisted shape (only per-day items are) — it's reconstructed
  // best-effort in a separate effect below, once catalogs have also loaded.
  useEffect(() => {
    if (!draftIdParam) return;
    api
      .get(`/package-requests/${draftIdParam}`)
      .then(({ packageRequest: pr }) => {
        if (pr.status !== 'draft') {
          // Already submitted — this link is stale; the read-only quote view is the right place for it now.
          navigate(`/agent/fit-requests/${pr.id}`, { replace: true });
          return;
        }
        setForm({
          destination: pr.destination || '',
          dateFrom: pr.dateFrom ? pr.dateFrom.slice(0, 10) : '',
          dateTo: pr.dateTo ? pr.dateTo.slice(0, 10) : '',
          paxAdults: pr.paxAdults || 1,
          paxChildren: pr.paxChildren || 0,
          lunchMealId: pr.lunchMealId ?? null,
          lunchPeople: pr.lunchPeople ?? null,
          lunchDays: pr.lunchDays ?? null,
          dinnerMealId: pr.dinnerMealId ?? null,
          dinnerPeople: pr.dinnerPeople ?? null,
          dinnerDays: pr.dinnerDays ?? null,
          visaEnabled: pr.visaEnabled ?? false,
          visaPeople: pr.visaPeople ?? null,
        });
        // Bucket by isChild rather than array position — DB order isn't
        // guaranteed to match adults-then-children (see migration 0023).
        const loadedAdults = pr.travelers
          .filter((t) => !t.isChild)
          .map((t) => ({ name: t.name, passportNo: t.passportNo || '', type: 'adult' }));
        const loadedChildren = pr.travelers
          .filter((t) => t.isChild)
          .map((t) => ({ name: t.name, passportNo: t.passportNo || '', type: 'child' }));
        setTravelers([
          ...resizeTravelerGroup(loadedAdults, pr.paxAdults || 0, 'adult'),
          ...resizeTravelerGroup(loadedChildren, pr.paxChildren || 0, 'child'),
        ]);
        const { items, dayNotes: loadedDayNotes } = deserializeItinerary(pr.itinerary);
        setItineraryItems(items);
        setDayNotes(loadedDayNotes);
      })
      .catch((err) => setError(err.message || 'Unable to load this draft'))
      .finally(() => setDraftLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftIdParam]);

  // Reconstructs cityDays from the resumed draft's itineraryItems, once both
  // the catalogs and the draft (if any) have finished loading — runs exactly
  // once (guarded by the ref) so it never fights the agent's own edits to
  // cityDays afterwards. A brand-new draft has nothing to derive from and
  // simply starts with an empty cityDays for the agent to fill in.
  const cityDaysDerivedRef = useRef(false);
  useEffect(() => {
    if (cityDaysDerivedRef.current) return;
    if (catalogLoading || draftLoading) return;
    cityDaysDerivedRef.current = true;
    if (!draftIdParam) return;
    const loadedDayCount = computeDayCount(form.dateFrom, form.dateTo);
    setCityDays(deriveCityDaysFromItems(itineraryItems, loadedDayCount, { hotels, tours, transfers, activities }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogLoading, draftLoading]);

  // Traveller Details rows always match Trip Details' adult/child counts —
  // grows/shrinks each group independently as those fields change, keeping
  // whatever the agent already typed in the rows that remain.
  useEffect(() => {
    const adultsCount = Math.max(0, Number(form.paxAdults) || 0);
    const childrenCount = Math.max(0, Number(form.paxChildren) || 0);
    setTravelers((current) => [
      ...resizeTravelerGroup(current.filter((t) => t.type === 'adult'), adultsCount, 'adult'),
      ...resizeTravelerGroup(current.filter((t) => t.type === 'child'), childrenCount, 'child'),
    ]);
  }, [form.paxAdults, form.paxChildren]);

  // If Start Date moves later than the already-picked End Date, the End Date
  // is no longer valid — clear it automatically rather than leaving a
  // backwards range sitting in the form (the <input min> above stops most of
  // this at the picker level, but doesn't retroactively clear a value that
  // was valid before Start Date changed). Deliberately one-directional: a
  // shortened End Date can't ever make Start Date invalid.
  useEffect(() => {
    if (form.dateFrom && form.dateTo && form.dateTo < form.dateFrom) {
      setForm((f) => ({ ...f, dateTo: '' }));
    }
  }, [form.dateFrom]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayCount = computeDayCount(form.dateFrom, form.dateTo);
  const cityOptions = distinctCities(hotels, tours, transfers, activities);
  const dayCityMap = buildDayCityMap(cityDays, dayCount);

  // Keeps itineraryItems consistent with the current city plan: drops
  // anything sitting on a day beyond the current trip length (End Date moved
  // earlier), and anything whose own city no longer matches the city now
  // assigned to its day (a cityDays row was edited/removed/reordered) —
  // there's no "unassigned tray" to send orphaned items back to in this
  // model, so they're simply dropped.
  useEffect(() => {
    const map = buildDayCityMap(cityDays, dayCount);
    setItineraryItems((items) =>
      items.filter((it) => {
        if (it.dayNumber == null || it.dayNumber > dayCount) return false;
        const city = map[it.dayNumber];
        if (!city) return false;
        const meta = resolveItemMeta(it.type, it.id, { hotels, tours, transfers, activities });
        return !!meta && (meta.city || '').toLowerCase() === city.toLowerCase();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityDays, dayCount]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateTraveler(idx, field, value) {
    setTravelers((list) => list.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  }

  function addCityRow() {
    setCityDays((rows) => {
      const remaining = Math.max(0, dayCount - sumCityDays(rows));
      if (remaining === 0) return rows;
      return [...rows, { id: nextCityRowId(), city: '', days: 1 }];
    });
  }

  function updateCityRow(id, field, value) {
    setCityDays((rows) => {
      if (field === 'city') return rows.map((r) => (r.id === id ? { ...r, city: value } : r));
      const otherSum = rows.filter((r) => r.id !== id).reduce((total, r) => total + (Number(r.days) || 0), 0);
      const maxAllowed = Math.max(1, dayCount - otherSum);
      const clamped = Math.min(Math.max(1, Number(value) || 1), maxAllowed);
      return rows.map((r) => (r.id === id ? { ...r, days: clamped } : r));
    });
  }

  function removeCityRow(id) {
    setCityDays((rows) => rows.filter((r) => r.id !== id));
  }

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

  function setHotelOccupancyForDayNumber(dayNumber, occupancy) {
    setItineraryItems((items) => updateHotelOccupancy(items, dayNumber, occupancy));
  }

  // Selection is derived from itineraryItems now, not the other way around —
  // deduped per type since the same catalog item can be added to more than
  // one day (most often the same hotel across a multi-day city stay).
  const selectedHotelIds = dedupeIdsByType(itineraryItems, 'hotel');
  const selectedTourIds = dedupeIdsByType(itineraryItems, 'tour');
  const selectedTransferIds = dedupeIdsByType(itineraryItems, 'transfer');
  const selectedActivityIds = dedupeIdsByType(itineraryItems, 'activity');

  // Item 1 — "Save Draft"/"Continue Editing" autosave. Deliberately skips
  // validateStep(): a half-built package (no destination yet, no city added)
  // must still save without being blocked by the strict Submit rules.
  function buildDraftPayload() {
    return {
      destination: form.destination,
      dateFrom: form.dateFrom || null,
      dateTo: form.dateTo || null,
      paxAdults: Number(form.paxAdults) || 1,
      paxChildren: Number(form.paxChildren) || 0,
      hotelIds: selectedHotelIds,
      tourIds: selectedTourIds,
      transferIds: selectedTransferIds,
      activityIds: selectedActivityIds,
      travelers: travelers.map((t) => ({ name: t.name, passportNo: t.passportNo || undefined, isChild: t.type === 'child' })),
      itinerary: serializeItinerary(itineraryItems, dayNotes, dayCount),
      lunchMealId: form.lunchMealId ?? null,
      lunchPeople: form.lunchPeople ?? null,
      lunchDays: form.lunchDays ?? null,
      dinnerMealId: form.dinnerMealId ?? null,
      dinnerPeople: form.dinnerPeople ?? null,
      dinnerDays: form.dinnerDays ?? null,
      visaEnabled: !!form.visaEnabled,
      visaPeople: form.visaPeople ?? null,
    };
  }

  async function saveDraft() {
    setError('');
    setSavingDraft(true);
    try {
      if (draftId) {
        await api.patch(`/package-requests/${draftId}`, buildDraftPayload());
      } else {
        const { packageRequest } = await api.post('/package-requests/draft', buildDraftPayload());
        setDraftId(packageRequest.id);
        navigate(`/agent/package-builder/${packageRequest.id}`, { replace: true });
      }
      setDraftSavedAt(new Date());
    } catch (err) {
      setError(err.message || 'Unable to save draft');
    } finally {
      setSavingDraft(false);
    }
  }

  // Server-side PDF export (itineraryPdf.service.js on the backend) replaces
  // the old window.print() flow — that relied on the agent's own browser/OS
  // print engine, which drifted from the on-screen Tailwind design (dropped
  // shadows/backgrounds, different flex/grid rounding). The download
  // endpoint renders this same package request's ItineraryDocument in a real
  // headless Chromium instead, so it needs the request saved server-side
  // first — syncs the current in-progress edits to the draft row (creating
  // it if this session never saved one) immediately before requesting the
  // PDF, so what downloads always matches what's on screen right now.
  async function handleDownloadPdf() {
    setError('');
    setDownloadingPdf(true);
    try {
      let id = draftId;
      if (id) {
        await api.patch(`/package-requests/${id}`, buildDraftPayload());
      } else {
        const { packageRequest } = await api.post('/package-requests/draft', buildDraftPayload());
        id = packageRequest.id;
        setDraftId(id);
        navigate(`/agent/package-builder/${id}`, { replace: true });
      }

      const blob = await api.getBlob(`/package-requests/${id}/itinerary.pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `itinerary-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Unable to generate PDF');
    } finally {
      setDownloadingPdf(false);
    }
  }

  // Everything renders on one page now (no more Back/Next step-gating), so
  // Submit is the only place left to enforce the same three rule-sets the
  // old wizard used to check one at a time on each "Next" click — run them
  // in the same 1 -> 2 -> 3 order so the first error an agent sees is always
  // the one closest to the top of the page.
  async function handleSubmit() {
    for (const s of [1, 2, 3]) {
      const validationError = validateStep(s, { form, cityDays, itineraryItems, travelers, dayCount });
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        destination: form.destination,
        dateFrom: form.dateFrom,
        dateTo: form.dateTo,
        paxAdults: Number(form.paxAdults),
        paxChildren: Number(form.paxChildren) || 0,
        hotelIds: selectedHotelIds,
        tourIds: selectedTourIds,
        transferIds: selectedTransferIds,
        activityIds: selectedActivityIds,
        // Unfiltered — validateStep(3) above already guarantees every row
        // has a name (and adults have a passport), so all rows are real.
        travelers: travelers.map((t) => ({ name: t.name, passportNo: t.passportNo || undefined, isChild: t.type === 'child' })),
        itinerary: serializeItinerary(itineraryItems, dayNotes, dayCount),
        lunchMealId: form.lunchMealId ?? null,
        lunchPeople: form.lunchPeople ?? null,
        lunchDays: form.lunchDays ?? null,
        dinnerMealId: form.dinnerMealId ?? null,
        dinnerPeople: form.dinnerPeople ?? null,
        dinnerDays: form.dinnerDays ?? null,
        visaEnabled: !!form.visaEnabled,
        visaPeople: form.visaPeople ?? null,
      };
      // A draft opened via "Continue Editing" submits through its own row
      // (validated the same way — createPackageRequestSchema — just against
      // an existing 'draft' instead of creating a new 'submitted' one).
      const { packageRequest } = draftId
        ? await api.post(`/package-requests/${draftId}/submit`, payload)
        : await api.post('/package-requests', payload);
      setSubmittedId(packageRequest.id);
    } catch (err) {
      setError(err.message || 'Unable to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedHotels = hotels.filter((h) => selectedHotelIds.includes(h.id));
  const selectedTours = tours.filter((t) => selectedTourIds.includes(t.id));
  const selectedTransfers = transfers.filter((t) => selectedTransferIds.includes(t.id));
  const selectedActivities = activities.filter((a) => selectedActivityIds.includes(a.id));

  function resolveItineraryMeta(item) {
    return resolveItemMeta(item.type, item.id, {
      hotels: selectedHotels,
      tours: selectedTours,
      transfers: selectedTransfers,
      activities: selectedActivities,
    });
  }
  // Every day 1..N, not just the ones with something on them (unlike
  // buildItineraryDays, used for the draft/submit payload) — the printable
  // document renders every day as its own row/section, same as the sample.
  const fullItineraryDays = buildFullItineraryDays(itineraryItems, dayNotes, dayCount, resolveItineraryMeta);
  const selectedCounts = {
    hotels: selectedHotels.length,
    tours: selectedTours.length,
    transfers: selectedTransfers.length,
    activities: selectedActivities.length,
  };

  // Each hotel row in the printable document shows how many itinerary days
  // it actually appears on (a proxy for nights), rather than the trip-wide
  // night count — there can be more than one hotel now, one per day.
  const hotelNightsById = {};
  for (const it of itineraryItems) {
    if (it.type === 'hotel') hotelNightsById[it.id] = (hotelNightsById[it.id] || 0) + 1;
  }
  const hotelsForDocument = selectedHotels.map((h) => ({ ...h, nights: hotelNightsById[h.id] || 0 }));

  return (
    <div className="mx-auto max-w-5xl p-5 lg:p-8">
      <h2 className="mb-1 text-2xl font-bold text-agent-ink print:hidden">Package Builder</h2>
      <p className="mb-5 text-sm text-agent-muted print:hidden">
        Build a personalised package for your client. Pricing is handled by Xclusive Oman once you submit
        — no cost or price is shown anywhere in this builder.
      </p>

      {submittedId ? (
        <Card label="Request submitted" className="border-white">
          <p className="text-sm text-agent-ink">
            Your Custom FIT request has been submitted and is now with our team for pricing. You'll be
            notified once a quote is ready.
          </p>
          <p className="mt-2 font-mono text-xs text-agent-muted">Reference: {submittedId}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="accent" onClick={() => navigate('/agent/fit-requests')}>
              View My Requests
            </Button>
            <Button onClick={() => navigate('/agent/dashboard')}>Back to Dashboard</Button>
          </div>
        </Card>
      ) : catalogLoading || draftLoading ? (
        <p className="text-sm text-agent-muted">Loading…</p>
      ) : (
        <>
          {/* Single scrolling page — all three sections stacked and numbered,
              instead of the old Back/Next wizard that mounted one at a time.
              Trip Details and Itinerary are print:hidden (same as they were
              implicitly, by not being mounted, whenever step 3 used to print)
              — only the Review & Submit section's ItineraryDocument is meant
              to appear in the PDF/print output. */}
          <div className="print:hidden">
            <SectionHeading n={1} title="Trip Details" subtitle="Destination, travel dates, and pax." />
            <TripFieldsCard form={form} update={update} />
          </div>

          <div className="print:hidden">
            <SectionHeading n={2} title="Itinerary" subtitle="Cities, days, and what's booked on each day." />
            <ItineraryStep
              dayCount={dayCount}
              cityOptions={cityOptions}
              cityDays={cityDays}
              addCityRow={addCityRow}
              updateCityRow={updateCityRow}
              removeCityRow={removeCityRow}
              dayCityMap={dayCityMap}
              itineraryItems={itineraryItems}
              dayNotes={dayNotes}
              setDayNotes={setDayNotes}
              hotels={hotels}
              tours={tours}
              transfers={transfers}
              activities={activities}
              meals={meals}
              form={form}
              update={update}
              addItemToDay={addItemToDay}
              removeItemFromDay={removeItemFromDay}
              updateItemNoteByKey={updateItemNoteByKey}
              setHotelForDayNumber={setHotelForDayNumber}
              setHotelOccupancyForDayNumber={setHotelOccupancyForDayNumber}
            />
          </div>

          <div className="print:hidden">
            <SectionHeading n={3} title="Review & Submit" subtitle="Check the itinerary and traveller details, then submit." />
          </div>
          <ReviewStep
            form={form}
            dayCount={dayCount}
            hotels={hotelsForDocument}
            days={fullItineraryDays}
            selectedCounts={selectedCounts}
            travelers={travelers}
            updateTraveler={updateTraveler}
            downloadingPdf={downloadingPdf}
            onDownloadPdf={handleDownloadPdf}
          />

          <div className="print:hidden">
            <ErrorText>{error}</ErrorText>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {draftSavedAt && (
                <span className="text-[11px] text-agent-muted">Draft saved {draftSavedAt.toLocaleTimeString()}</span>
              )}
              <Button disabled={savingDraft} onClick={saveDraft}>
                {savingDraft ? 'Saving…' : 'Save Draft'}
              </Button>
              <Button variant="accent" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Request'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
