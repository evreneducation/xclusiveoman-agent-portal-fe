import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card, ErrorText, FieldLabel, Select, TextInput, Textarea } from '../components/ui.jsx';
import ItineraryTimeline from '../components/ItineraryTimeline.jsx';
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
// pitfalls. Same helper as PackageBuilder.jsx's todayDateString.
function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// MICE-1..MICE-7: Oman overview/content hub browsing happens on the catalog
// screens already reachable elsewhere in the portal — this wizard is the
// curation + submit half. Brought onto the same City & Days planner +
// day-wise itinerary model as the Custom FIT Package Builder
// (agent/pages/PackageBuilder.jsx) — Event Details -> Itinerary -> Review —
// rather than the old flat Hotels/Tours/Transfers/Activities step-per-type
// wizard. Still no traveller step (not applicable to MICE).
const STEPS = [
  { n: 1, label: 'Event Details' },
  { n: 2, label: 'Itinerary' },
  { n: 3, label: 'Review & Submit' },
];

// MICE-2/MICE-7: "up to 3 hotels" is still server-enforced (createMiceRfqSchema/
// draftMiceRfqSchema) — this is the client-side mirror of that cap, now
// counted as distinct hotels across the whole day-wise itinerary rather than
// a flat multi-select list.
const MAX_HOTELS = 3;

function StepIndicator({ step }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1.5">
      {STEPS.map((s) => (
        <span
          key={s.n}
          className={`rounded-full border px-3 py-1.5 font-mono text-[10px] font-semibold ${
            s.n === step
              ? 'border-agent-accent bg-agent-accent text-white'
              : s.n < step
                ? 'border-agent-ink bg-agent-ink text-white'
                : 'border-agent-line-light bg-white text-[#666]'
          }`}
        >
          {s.n} {s.label}
        </span>
      ))}
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

// Step 1 — event details (group size, event dates, hall capacity, seating
// style, AV needs, other requirements — same fields Screen 08 captures).
function EventDetailsStep({ form, update }) {
  return (
    <Card label="Event details" className="border-white">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldLabel>Destination *</FieldLabel>
          <TextInput placeholder="e.g. Muscat, Oman" value={form.destination} onChange={(e) => update('destination', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Event start date *</FieldLabel>
          <TextInput type="date" min={todayDateString()} value={form.eventDateFrom} onChange={(e) => update('eventDateFrom', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Event end date *</FieldLabel>
          {/* min= the selected Start Date (falling back to today when none is
              picked yet) disables every earlier date in the End Date
              calendar itself, on top of the auto-clear-on-conflict effect
              and validateStep's submit-time check below. */}
          <TextInput
            type="date"
            min={form.eventDateFrom || todayDateString()}
            value={form.eventDateTo}
            onChange={(e) => update('eventDateTo', e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Group size *</FieldLabel>
          <TextInput type="number" min="1" value={form.groupSize} onChange={(e) => update('groupSize', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Hall capacity needed</FieldLabel>
          <TextInput type="number" min="1" value={form.hallCapacityNeeded} onChange={(e) => update('hallCapacityNeeded', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Seating style</FieldLabel>
          <TextInput placeholder="e.g. Theatre, Banquet" value={form.seatingStyle} onChange={(e) => update('seatingStyle', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>AV / event needs</FieldLabel>
          <Textarea rows={2} value={form.avNeeds} onChange={(e) => update('avNeeds', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>Other requirements (optional)</FieldLabel>
          <Textarea
            rows={2}
            placeholder="e.g. dietary restrictions, branding on-site, gala theme…"
            value={form.otherRequirements}
            onChange={(e) => update('otherRequirements', e.target.value)}
          />
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Itinerary — City & Days planner + day-wise builder, same shape as
// PackageBuilder.jsx's Itinerary step (FIT-5).
// ---------------------------------------------------------------------------

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

// Adds a brand-new instance of a catalog item directly onto a day — every
// item is added straight onto the day (and city) it belongs to, filtered by
// that day's city, same model as PackageBuilder.jsx.
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
// whatever hotel was already there instead of stacking up multiple.
function setHotelForDay(items, dayNumber, hotelId) {
  const withoutOldHotel = items.filter((it) => !(it.dayNumber === dayNumber && it.type === 'hotel'));
  return addItineraryItem(withoutOldHotel, { type: 'hotel', id: hotelId, dayNumber });
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
// itinerary (resuming a draft) — `cityDays` itself isn't part of the
// persisted mice_rfq shape, only the per-day items are.
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

function CityDaysPlanner({ cityOptions, cityDays, dayCount, addCityRow, updateCityRow, removeCityRow }) {
  const allocated = sumCityDays(cityDays);
  const remaining = Math.max(0, dayCount - allocated);

  return (
    <Card label="Cities & days" className="border-white">
      <p className="mb-3 text-xs text-agent-muted">
        Pick the cities this event covers and how many days each gets — the day-wise itinerary below is built from
        this. Total days across all cities can't exceed the event length set in Event Details.
      </p>
      {dayCount === 0 ? (
        <p className="text-sm text-agent-muted">Set Event start date and Event end date in Event Details first.</p>
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

// A day's hotel section — single-select, filtered to that day's city. Still
// capped at MAX_HOTELS *distinct* hotels across the whole itinerary
// (MICE-2/MICE-7) — a hotel already used on another day is always
// selectable again here (that's reuse, not a new hotel), only a genuinely
// new 4th hotel is blocked once the cap is hit.
function DayHotelSection({ city, hotels, currentHotelId, selectedHotelIds, onSelect }) {
  const [open, setOpen] = useState(false);
  const inCity = hotels.filter((h) => (h.city || '').toLowerCase() === city.toLowerCase());
  const currentHotel = hotels.find((h) => h.id === currentHotelId) || null;
  const capReached = selectedHotelIds.length >= MAX_HOTELS;

  return (
    <div>
      <FieldLabel>Hotel</FieldLabel>
      {currentHotel ? (
        <div className="flex items-center justify-between rounded-md border border-agent-line-light bg-white px-3 py-2 text-xs">
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
      ) : (
        <p className="mb-1 text-[11px] text-agent-muted">No hotel selected for this day.</p>
      )}
      <Button className="mt-1.5" onClick={() => setOpen((o) => !o)}>
        {open ? 'Close' : currentHotel ? 'Change hotel' : '+ Add hotel'}
      </Button>
      {open && (
        <div className="mt-2 rounded-md border border-dashed border-agent-line-light p-2.5">
          <p className="mb-2 text-[10px] text-agent-muted">
            {selectedHotelIds.length} of {MAX_HOTELS} hotels used across this itinerary — the same hotel can be
            reused on multiple days.
          </p>
          {inCity.length === 0 ? (
            <p className="text-[11px] text-agent-muted">No hotels in {city}.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {inCity.map((h) => {
                const selected = h.id === currentHotelId;
                const alreadyUsed = selectedHotelIds.includes(h.id);
                const disabled = !selected && !alreadyUsed && capReached;
                return (
                  <div
                    key={h.id}
                    className={`rounded-md border p-2 text-xs ${
                      selected
                        ? 'border-agent-accent ring-1 ring-agent-accent/25'
                        : disabled
                          ? 'cursor-not-allowed border-agent-line-light opacity-50'
                          : 'border-agent-line-light'
                    }`}
                  >
                    <CatalogImage url={h.images?.[0]} />
                    <div className="mt-1.5 font-semibold text-agent-ink">{h.name}</div>
                    <div className="text-agent-muted">{h.category ? `${h.category}★` : ''}</div>
                    <Button
                      variant={selected ? 'accent' : 'default'}
                      disabled={disabled}
                      className="mt-1.5 w-full justify-center"
                      onClick={() => {
                        onSelect(selected ? '' : h.id);
                        setOpen(false);
                      }}
                    >
                      {selected ? 'Selected ✓' : disabled ? 'Limit reached' : 'Select'}
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

const DAY_SECTION_META = {
  tour: { label: 'Tours', addLabel: '+ Add tour' },
  transfer: { label: 'Transfers', addLabel: '+ Add transfer' },
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
      <FieldLabel>{meta.label}</FieldLabel>
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

// One numbered day node — mirrors PackageBuilder.jsx's DayPlanCard.
function DayPlanCard({ dayNumber, city, items, catalogs, selectedHotelIds, notes, onNotesChange, addItem, removeItem, updateNote, setHotel, isLast }) {
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
              selectedHotelIds={selectedHotelIds}
              onSelect={(hotelId) => setHotel(dayNumber, hotelId)}
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
  selectedHotelIds,
  addItemToDay,
  removeItemFromDay,
  updateItemNoteByKey,
  setHotelForDayNumber,
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
            Set Event start date and Event end date in Event Details to build the day-wise itinerary.
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
                selectedHotelIds={selectedHotelIds}
                notes={dayNotes[dayNumber] || ''}
                onNotesChange={(value) => setDayNotes((n) => ({ ...n, [dayNumber]: value }))}
                addItem={(type, id) => addItemToDay(dayNumber, type, id)}
                removeItem={removeItemFromDay}
                updateNote={updateItemNoteByKey}
                setHotel={setHotelForDayNumber}
                isLast={dayNumber === dayCount}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Step 3 — review & submit. No price/cost/markup fields anywhere (blind pricing).
function ReviewStep({ form, days }) {
  return (
    <div className="space-y-4">
      <Card label="Event summary" className="border-white">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase text-agent-muted">Destination</dt>
            <dd>{form.destination || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-agent-muted">Event dates</dt>
            <dd>
              {form.eventDateFrom || '—'} → {form.eventDateTo || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-agent-muted">Group size</dt>
            <dd>{form.groupSize || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-agent-muted">Hall capacity</dt>
            <dd>{form.hallCapacityNeeded || '—'}</dd>
          </div>
        </dl>
      </Card>

      <ItineraryTimeline days={days} emptyLabel="No day-wise itinerary added." />
    </div>
  );
}

function validateStep(step, { form, cityDays, itineraryItems }) {
  if (step === 1) {
    if (!form.destination.trim()) return 'Destination is required.';
    if (!form.eventDateFrom || !form.eventDateTo) return 'Event start and end dates are required.';
    // String comparison, not Date parsing — both are plain "YYYY-MM-DD" from
    // <input type="date">, so lexicographic order already matches
    // chronological order (see the matching backend refine in schemas.js).
    if (form.eventDateTo < form.eventDateFrom) return 'Event end date must be on or after the start date.';
    if (form.eventDateFrom < todayDateString()) return 'Event start date cannot be in the past.';
    if (!form.groupSize || Number(form.groupSize) < 1) return 'Group size is required.';
    return '';
  }
  if (step === 2) {
    if (cityDays.length === 0) return 'Add at least one city to build the itinerary.';
    if (!itineraryItems.some((it) => it.type === 'hotel')) return 'Select at least one hotel in your itinerary.';
    return '';
  }
  return '';
}

export default function MiceBuilder() {
  const navigate = useNavigate();
  const { id: draftIdParam } = useParams();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    destination: '', eventDateFrom: '', eventDateTo: '', groupSize: '',
    hallCapacityNeeded: '', seatingStyle: '', avNeeds: '', otherRequirements: '',
  });

  const [hotels, setHotels] = useState([]);
  const [tours, setTours] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // City & Days planner — [{ id, city, days }], sum of `days` never exceeds
  // the event's day count.
  const [cityDays, setCityDays] = useState([]);

  // Day-wise Itinerary Planner — items are the source of truth (hotel/tour/
  // transfer/extra selection happens by adding an item directly onto a day).
  const [itineraryItems, setItineraryItems] = useState([]);
  const [dayNotes, setDayNotes] = useState({});

  // MICE Drafts (item 1) — "Continue Editing" opens /agent/mice-builder/:id;
  // draftId then tracks which row "Save Draft" and "Submit Request" write to.
  const [draftId, setDraftId] = useState(draftIdParam || '');
  const [draftLoading, setDraftLoading] = useState(!!draftIdParam);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState('');

  useEffect(() => {
    // Only items curated into the MICE Catalog by Admin (is_mice_enabled)
    // may appear here — never the full Product Catalog. Same `?mice=true`
    // filter the Admin MICE Catalog Manager itself uses (MiceCatalog.jsx).
    // 0070_hotels_status.sql / 0072_tours_activities_transfers_status.sql —
    // additionally, only published rows.
    Promise.all([
      api.get('/hotels?mice=true&status=published'),
      api.get('/tours?mice=true&status=published'),
      api.get('/transfers?mice=true&status=published'),
      api.get('/activities?mice=true&status=published'),
    ])
      .then(([h, t, tr, a]) => {
        setHotels(h.hotels || []);
        setTours(t.tours || []);
        setTransfers(tr.transfers || []);
        setActivities(a.activities || []);
      })
      .catch((err) => setError(err.message || 'Unable to load catalog'))
      .finally(() => setCatalogLoading(false));
  }, []);

  // Loads a previously-saved draft's state into the wizard so "Continue
  // Editing" resumes exactly where the agent left off. cityDays isn't part
  // of the persisted mice_rfq shape (only per-day items are) — it's
  // reconstructed best-effort in a separate effect below, once catalogs have
  // also loaded.
  useEffect(() => {
    if (!draftIdParam) return;
    api
      .get(`/mice/rfqs/${draftIdParam}`)
      .then(({ miceRfq: mr }) => {
        if (mr.status !== 'draft') {
          // Already submitted — this link is stale; the read-only proposal view is the right place for it now.
          navigate(`/agent/mice-requests/${mr.id}`, { replace: true });
          return;
        }
        setForm({
          destination: mr.destination || '',
          eventDateFrom: mr.eventDateFrom ? mr.eventDateFrom.slice(0, 10) : '',
          eventDateTo: mr.eventDateTo ? mr.eventDateTo.slice(0, 10) : '',
          groupSize: mr.groupSize || '',
          hallCapacityNeeded: mr.hallCapacityNeeded || '',
          seatingStyle: mr.seatingStyle || '',
          avNeeds: mr.avNeeds || '',
          otherRequirements: mr.otherRequirements || '',
        });
        const { items, dayNotes: loadedDayNotes } = deserializeItinerary(mr.itinerary);
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
  // cityDays afterwards.
  const cityDaysDerivedRef = useRef(false);
  useEffect(() => {
    if (cityDaysDerivedRef.current) return;
    if (catalogLoading || draftLoading) return;
    cityDaysDerivedRef.current = true;
    if (!draftIdParam) return;
    const loadedDayCount = computeDayCount(form.eventDateFrom, form.eventDateTo);
    setCityDays(deriveCityDaysFromItems(itineraryItems, loadedDayCount, { hotels, tours, transfers, activities }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogLoading, draftLoading]);

  // If Event start date moves later than the already-picked end date, the
  // end date is no longer valid — clear it automatically.
  useEffect(() => {
    if (form.eventDateFrom && form.eventDateTo && form.eventDateTo < form.eventDateFrom) {
      setForm((f) => ({ ...f, eventDateTo: '' }));
    }
  }, [form.eventDateFrom]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayCount = computeDayCount(form.eventDateFrom, form.eventDateTo);
  const cityOptions = distinctCities(hotels, tours, transfers, activities);
  const dayCityMap = buildDayCityMap(cityDays, dayCount);

  // Keeps itineraryItems consistent with the current city plan: drops
  // anything sitting on a day beyond the current event length, and anything
  // whose own city no longer matches the city now assigned to its day.
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

  // Selection is derived from itineraryItems now, not the other way around —
  // deduped per type since the same catalog item can be added to more than
  // one day (most often the same hotel across a multi-day event).
  const selectedHotelIds = dedupeIdsByType(itineraryItems, 'hotel');
  const selectedTourIds = dedupeIdsByType(itineraryItems, 'tour');
  const selectedTransferIds = dedupeIdsByType(itineraryItems, 'transfer');
  const selectedActivityIds = dedupeIdsByType(itineraryItems, 'activity');

  // Item 1 — "Save Draft"/"Continue Editing" autosave. Deliberately skips
  // validateStep(): a half-built RFQ (no destination yet, no hotel picked)
  // must still save without being blocked by the strict Submit rules.
  function buildDraftPayload() {
    return {
      destination: form.destination,
      eventDateFrom: form.eventDateFrom || null,
      eventDateTo: form.eventDateTo || null,
      groupSize: form.groupSize ? Number(form.groupSize) : null,
      hallCapacityNeeded: form.hallCapacityNeeded ? Number(form.hallCapacityNeeded) : null,
      seatingStyle: form.seatingStyle || undefined,
      avNeeds: form.avNeeds || undefined,
      otherRequirements: form.otherRequirements || undefined,
      hotelIds: selectedHotelIds,
      tourIds: selectedTourIds,
      transferIds: selectedTransferIds,
      activityIds: selectedActivityIds,
      itinerary: serializeItinerary(itineraryItems, dayNotes, dayCount),
    };
  }

  async function saveDraft() {
    setError('');
    setSavingDraft(true);
    try {
      if (draftId) {
        await api.patch(`/mice/rfqs/${draftId}`, buildDraftPayload());
      } else {
        const { miceRfq } = await api.post('/mice/rfqs/draft', buildDraftPayload());
        setDraftId(miceRfq.id);
        navigate(`/agent/mice-builder/${miceRfq.id}`, { replace: true });
      }
      setDraftSavedAt(new Date());
    } catch (err) {
      setError(err.message || 'Unable to save draft');
    } finally {
      setSavingDraft(false);
    }
  }

  function goNext() {
    const validationError = validateStep(step, { form, cityDays, itineraryItems });
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setStep((s) => Math.min(STEPS.length, s + 1));
  }

  function goBack() {
    setError('');
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSubmit() {
    const step1Error = validateStep(1, { form, cityDays, itineraryItems });
    const step2Error = validateStep(2, { form, cityDays, itineraryItems });
    const validationError = step1Error || step2Error;
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        destination: form.destination,
        eventDateFrom: form.eventDateFrom,
        eventDateTo: form.eventDateTo,
        groupSize: Number(form.groupSize),
        hallCapacityNeeded: form.hallCapacityNeeded ? Number(form.hallCapacityNeeded) : undefined,
        seatingStyle: form.seatingStyle || undefined,
        avNeeds: form.avNeeds || undefined,
        otherRequirements: form.otherRequirements || undefined,
        hotelIds: selectedHotelIds,
        tourIds: selectedTourIds,
        transferIds: selectedTransferIds,
        activityIds: selectedActivityIds,
        itinerary: serializeItinerary(itineraryItems, dayNotes, dayCount),
      };
      // A draft opened via "Continue Editing" submits through its own row
      // (validated the same way — createMiceRfqSchema — just against an
      // existing 'draft' instead of creating a new 'submitted' one).
      const { miceRfq } = draftId
        ? await api.post(`/mice/rfqs/${draftId}/submit`, payload)
        : await api.post('/mice/rfqs', payload);
      setSubmittedId(miceRfq.id);
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
  // Every day 1..N, not just the ones with something on them — the Review
  // step's ItineraryTimeline renders every day as its own row/section.
  const fullItineraryDays = buildFullItineraryDays(itineraryItems, dayNotes, dayCount, resolveItineraryMeta);

  return (
    <div className="mx-auto max-w-5xl p-5 lg:p-8">
      <h2 className="mb-1 text-2xl font-bold text-agent-ink">Corporate Enquiry</h2>
      <p className="mb-5 text-sm text-agent-muted">
        Curate a MICE proposal for your client. Pricing is handled by Xclusive Oman once you submit — no
        cost or price is shown anywhere in this builder.
      </p>

      {submittedId ? (
        <Card label="Request submitted" className="border-white">
          <p className="text-sm text-agent-ink">
            Your MICE request has been submitted and is now with our team for pricing. You'll be notified
            once a proposal is ready.
          </p>
          <p className="mt-2 font-mono text-xs text-agent-muted">Reference: {submittedId}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="accent" onClick={() => navigate('/agent/mice-requests')}>
              View My MICE Requests
            </Button>
            <Button onClick={() => navigate('/agent/dashboard')}>Back to Dashboard</Button>
          </div>
        </Card>
      ) : catalogLoading || draftLoading ? (
        <p className="text-sm text-agent-muted">Loading…</p>
      ) : (
        <>
          <StepIndicator step={step} />

          {step === 1 && <EventDetailsStep form={form} update={update} />}
          {step === 2 && (
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
              selectedHotelIds={selectedHotelIds}
              addItemToDay={addItemToDay}
              removeItemFromDay={removeItemFromDay}
              updateItemNoteByKey={updateItemNoteByKey}
              setHotelForDayNumber={setHotelForDayNumber}
            />
          )}
          {step === 3 && <ReviewStep form={form} days={fullItineraryDays} />}

          <ErrorText>{error}</ErrorText>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <Button onClick={goBack} disabled={step === 1}>
              Back
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              {draftSavedAt && (
                <span className="text-[11px] text-agent-muted">Draft saved {draftSavedAt.toLocaleTimeString()}</span>
              )}
              <Button disabled={savingDraft} onClick={saveDraft}>
                {savingDraft ? 'Saving…' : 'Save Draft'}
              </Button>
              {step < STEPS.length ? (
                <Button variant="accent" onClick={goNext}>
                  Next
                </Button>
              ) : (
                <Button variant="accent" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
