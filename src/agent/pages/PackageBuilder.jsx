import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card, Checkbox, ErrorText, FieldLabel, Select, Tag, TextInput } from '../components/ui.jsx';
import ItineraryTimeline from '../components/ItineraryTimeline.jsx';
import {
  ITINERARY_ITEM_TYPE_META,
  buildItineraryDays,
  buildSelectionPool,
  clampItineraryDays,
  computeDayCount,
  deserializeItinerary,
  findItineraryItemDay,
  itemsForDay,
  itineraryItemKey,
  moveItineraryItem,
  reconcileItineraryItems,
  resolveItemMeta,
  serializeItinerary,
  unassignedItems,
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

// FIT-1: destination/dates/pax + hotels/tours/transfers/extras are all
// managed together from Trip Details (hotels/tours/transfers/extras used to
// be their own wizard steps — merged in so agents can start placing items on
// the itinerary immediately instead of stepping through four pickers first),
// then Itinerary (FIT-5), then Review.
const STEPS = [
  { n: 1, label: 'Trip Details' },
  { n: 2, label: 'Itinerary' },
  { n: 3, label: 'Review & Submit' },
];

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

// Trip Details' own fields (FIT-1: destination, dates, pax) — one section
// among several the consolidated TripDetailsStep composite (below) renders
// together with hotel/tour/transfer/extra selection.
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

// Hotel selection (FIT-2), now a section within Trip Details rather than its
// own wizard step. Gated behind a star-category pick first — hotels don't
// load at all until a category is chosen, rather than dumping every hotel on
// screen at once. Single-select, matching the wireframe's one "Selected"
// card and the priced-quote summary later showing one hotel line item. No
// price is ever rendered here (FIT-6 blind pricing).
function HotelsStep({ hotels, starCategory, setStarCategory, cityFilter, setCityFilter, selectedHotelId, setSelectedHotelId }) {
  const inCategory = starCategory ? hotels.filter((h) => h.category === starCategory) : [];
  const filtered = cityFilter
    ? inCategory.filter((h) => (h.city || '').toLowerCase().includes(cityFilter.toLowerCase()))
    : inCategory;

  return (
    <Card label="Select a hotel" className="border-white">
      <FieldLabel>Star category *</FieldLabel>
      <div className="mb-4 flex flex-wrap gap-2">
        {HOTEL_STAR_CATEGORIES.map((cat) => (
          <button key={cat} type="button" onClick={() => setStarCategory(cat)}>
            <Tag active={starCategory === cat}>{cat}★</Tag>
          </button>
        ))}
      </div>

      {!starCategory ? (
        <p className="text-sm text-agent-muted">Select a star category above to see hotels.</p>
      ) : (
        <>
          <TextInput className="mb-4 max-w-xs" placeholder="Filter by city…" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
          {filtered.length === 0 && (
            <p className="text-sm text-agent-muted">No {starCategory}★ hotels available{cityFilter ? ' for that city' : ''}.</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((h) => {
              const selected = h.id === selectedHotelId;
              return (
                <div
                  key={h.id}
                  className={`flex flex-col rounded-lg border p-3 shadow-sm transition ${
                    selected ? 'border-agent-accent ring-2 ring-agent-accent/25' : 'border-agent-line-light'
                  }`}
                >
                  <CatalogImage url={h.images?.[0]} />
                  <div className="mt-2 text-sm font-bold">{h.name}</div>
                  <HotelStars category={h.category} />
                  <div className="mt-0.5 text-xs text-agent-muted">{[h.city, h.state].filter(Boolean).join(', ') || '—'}</div>
                  {h.description && <p className="mt-1 line-clamp-2 text-xs text-agent-muted">{h.description}</p>}
                  {h.roomTypes?.length > 0 && (
                    <p className="mt-1 text-[11px] text-agent-muted">Room types: {h.roomTypes.join(', ')}</p>
                  )}
                  <Button
                    variant={selected ? 'accent' : 'default'}
                    className="mt-3 w-full justify-center"
                    onClick={() => setSelectedHotelId(selected ? '' : h.id)}
                  >
                    {selected ? 'Selected ✓' : 'Select'}
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

// Lets an already-selected tour/transfer/extra be dropped straight onto a
// day from its own selection card — no detour through the separate
// Itinerary step for the common case of "I just picked this, put it on Day
// 3". Reordering within a day and moving between days still happens there;
// this is just a shortcut for the initial placement.
function AssignToDayControl({ type, id, dayCount, itineraryItems, assignItemToDay }) {
  if (dayCount === 0) {
    return <p className="mt-2 text-[11px] text-agent-muted">Set travel dates in Trip Details to assign this to a day.</p>;
  }
  const currentDay = findItineraryItemDay(itineraryItems, type, id);
  return (
    <div className="mt-2">
      <FieldLabel>Assign to day</FieldLabel>
      <Select value={currentDay ?? ''} onChange={(e) => assignItemToDay(type, id, e.target.value)}>
        <option value="">Unassigned</option>
        {Array.from({ length: dayCount }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            Day {n}
          </option>
        ))}
      </Select>
    </div>
  );
}

// Tour selection (FIT-3: multi-select checkboxes, no price), now a section
// within Trip Details rather than its own wizard step.
function ToursStep({ tours, cityFilter, setCityFilter, selectedTourIds, toggleTour, dayCount, itineraryItems, assignItemToDay }) {
  const filtered = cityFilter
    ? tours.filter((t) => (t.city || '').toLowerCase().includes(cityFilter.toLowerCase()))
    : tours;

  return (
    <Card label="Select tours (optional, multiple allowed)" className="border-white">
      <TextInput className="mb-4 max-w-xs" placeholder="Filter by city…" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
      {filtered.length === 0 && <p className="text-sm text-agent-muted">No tours available{cityFilter ? ' for that city' : ''}.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => {
          const selected = selectedTourIds.includes(t.id);
          return (
            <div key={t.id} className="rounded-lg border border-agent-line-light p-3 shadow-sm">
              <CatalogImage url={t.images?.[0]} />
              <div className="mt-2 text-sm font-bold">{t.name}</div>
              <div className="text-xs text-agent-muted">
                {t.city || '—'} {t.category ? `· ${t.category}` : ''} {t.duration ? `· ${t.duration}` : ''}
              </div>
              {t.description && <p className="mt-1 line-clamp-2 text-xs text-agent-muted">{t.description}</p>}
              <div className="mt-2">
                <Checkbox checked={selected} onChange={() => toggleTour(t.id)} label="Include this tour" />
              </div>
              {selected && (
                <AssignToDayControl type="tour" id={t.id} dayCount={dayCount} itineraryItems={itineraryItems} assignItemToDay={assignItemToDay} />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Transfer selection (FIT-4: multi-select checkboxes, no price), now a
// section within Trip Details rather than its own wizard step.
function TransfersStep({ transfers, selectedTransferIds, toggleTransfer, dayCount, itineraryItems, assignItemToDay }) {
  return (
    <Card label="Select transfers (optional, multiple allowed)" className="border-white">
      {transfers.length === 0 && <p className="text-sm text-agent-muted">No transfers available.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {transfers.map((tr) => {
          const selected = selectedTransferIds.includes(tr.id);
          return (
            <div key={tr.id} className="rounded-lg border border-agent-line-light p-3 shadow-sm">
              <div className="text-sm font-bold">{tr.name}</div>
              <div className="text-xs text-agent-muted">
                {tr.type ? tr.type.replace(/_/g, ' ') : '—'} {tr.vehicleClass ? `· ${tr.vehicleClass}` : ''} {tr.city ? `· ${tr.city}` : ''}
              </div>
              {tr.description && <p className="mt-1 text-xs text-agent-muted">{tr.description}</p>}
              <div className="mt-2">
                <Checkbox checked={selected} onChange={() => toggleTransfer(tr.id)} label="Include this transfer" />
              </div>
              {selected && (
                <AssignToDayControl type="transfer" id={tr.id} dayCount={dayCount} itineraryItems={itineraryItems} assignItemToDay={assignItemToDay} />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Extras selection, now a section within Trip Details rather than its own
// wizard step. The admin's Activities catalog is the pool of short add-on
// experiences (mirrors how FGD add-ons draw from activities/tours).
function ExtrasStep({ activities, selectedActivityIds, toggleActivity, dayCount, itineraryItems, assignItemToDay }) {
  return (
    <Card label="Select extras / add-ons (optional, multiple allowed)" className="border-white">
      {activities.length === 0 && <p className="text-sm text-agent-muted">No extras available.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {activities.map((a) => {
          const selected = selectedActivityIds.includes(a.id);
          return (
            <div key={a.id} className="rounded-lg border border-agent-line-light p-3 shadow-sm">
              <CatalogImage url={a.images?.[0]} />
              <div className="mt-2 text-sm font-bold">{a.name}</div>
              <div className="text-xs text-agent-muted">
                {a.city || '—'} {a.duration ? `· ${a.duration}` : ''}
              </div>
              {a.description && <p className="mt-1 line-clamp-2 text-xs text-agent-muted">{a.description}</p>}
              <div className="mt-2">
                <Checkbox checked={selected} onChange={() => toggleActivity(a.id)} label="Include this extra" />
              </div>
              {selected && (
                <AssignToDayControl type="activity" id={a.id} dayCount={dayCount} itineraryItems={itineraryItems} assignItemToDay={assignItemToDay} />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Step 1 — Trip Details. Consolidates the trip fields with hotel/tour/
// transfer/extra selection into one step (these were four separate wizard
// steps before) so agents can build the whole selection in one place, then
// move straight to arranging it into a day-wise itinerary.
function TripDetailsStep({
  form,
  update,
  hotels,
  starCategory,
  setStarCategory,
  hotelCityFilter,
  setHotelCityFilter,
  selectedHotelId,
  setSelectedHotelId,
  tours,
  tourCityFilter,
  setTourCityFilter,
  selectedTourIds,
  toggleTour,
  transfers,
  selectedTransferIds,
  toggleTransfer,
  activities,
  selectedActivityIds,
  toggleActivity,
  dayCount,
  itineraryItems,
  assignItemToDay,
}) {
  return (
    <div className="space-y-4">
      <TripFieldsCard form={form} update={update} />
      <HotelsStep
        hotels={hotels}
        starCategory={starCategory}
        setStarCategory={setStarCategory}
        cityFilter={hotelCityFilter}
        setCityFilter={setHotelCityFilter}
        selectedHotelId={selectedHotelId}
        setSelectedHotelId={setSelectedHotelId}
      />
      <ToursStep
        tours={tours}
        cityFilter={tourCityFilter}
        setCityFilter={setTourCityFilter}
        selectedTourIds={selectedTourIds}
        toggleTour={toggleTour}
        dayCount={dayCount}
        itineraryItems={itineraryItems}
        assignItemToDay={assignItemToDay}
      />
      <TransfersStep
        transfers={transfers}
        selectedTransferIds={selectedTransferIds}
        toggleTransfer={toggleTransfer}
        dayCount={dayCount}
        itineraryItems={itineraryItems}
        assignItemToDay={assignItemToDay}
      />
      <ExtrasStep
        activities={activities}
        selectedActivityIds={selectedActivityIds}
        toggleActivity={toggleActivity}
        dayCount={dayCount}
        itineraryItems={itineraryItems}
        assignItemToDay={assignItemToDay}
      />
    </div>
  );
}

// A single draggable placed/unplaced item — hotel/tour/transfer/extra —
// within the Itinerary step. Dropping directly on a chip (rather than the
// day's empty space) inserts before it, which is what lets ItineraryDayCard
// support reordering within a day, not just moving between days. Editable
// in two ways: its own short note (separate from the day's overall note),
// and — via ↩/🗑 — moved back to the unassigned tray or removed from the
// trip entirely (which also drops it from the itinerary via the
// reconciliation effect in the main component).
function ItineraryItemChip({ item, meta, isDragging, onDragStart, onDragEnd, onDropBefore, onNoteChange, onUnassign, onDelete }) {
  const typeMeta = ITINERARY_ITEM_TYPE_META[item.type];
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropBefore}
      className={`rounded-md border border-agent-line-light bg-white px-2.5 py-2 text-xs shadow-sm ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex cursor-grab items-center gap-2 active:cursor-grabbing">
        <span className="flex-none">{typeMeta?.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-agent-ink">{meta?.name || 'Unknown item'}</div>
          <div className="truncate text-[10px] text-agent-muted">
            {typeMeta?.label}
            {meta?.city ? ` · ${meta.city}` : ''}
          </div>
        </div>
        {onUnassign && (
          <button type="button" onClick={onUnassign} title="Move back to unassigned" className="flex-none text-agent-muted hover:text-agent-ink">
            ↩
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} title="Remove from this trip entirely" className="flex-none text-agent-muted hover:text-[#a5162d]">
            🗑
          </button>
        )}
      </div>
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

// One numbered timeline node — mirrors ItineraryTimeline's read-only layout,
// but each day is a drop target (moving items in) that also renders its
// items as drop targets themselves (reordering/moving individual items),
// plus a free-text notes field.
function ItineraryDayCard({
  dayNumber,
  items,
  notes,
  onNotesChange,
  resolveMeta,
  draggingKey,
  setDraggingKey,
  moveItem,
  updateNote,
  deleteItem,
  isLast,
}) {
  return (
    <div className="relative flex gap-4 pb-5 last:pb-0">
      {!isLast && <span className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-agent-line-light" />}
      <span className="relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-agent-ink text-xs font-bold text-white shadow-sm">
        {dayNumber}
      </span>
      <div className="flex-1 pt-0.5">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-agent-accent-dark">Day {dayNumber}</div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => moveItem(e.dataTransfer.getData('text/plain'), dayNumber)}
          className="mb-2 min-h-[52px] space-y-1.5 rounded-md border border-dashed border-agent-line-light bg-agent-panel/40 p-2"
        >
          {items.length === 0 ? (
            <p className="py-2 text-center text-[11px] text-agent-muted">Drag items here</p>
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
                onUnassign={() => moveItem(item.key, null)}
                onDelete={() => deleteItem(item.type, item.id)}
              />
            ))
          )}
        </div>
        <TextInput placeholder="Notes for this day (optional)…" value={notes} onChange={(e) => onNotesChange(e.target.value)} />
      </div>
    </div>
  );
}

// Step 2 — Day-wise Itinerary Planner (FIT-5). Days are auto-generated from
// Trip Details' Travel Start/End Date; every hotel/tour/transfer/extra
// selected back in Trip Details shows up here (in the unassigned tray until
// dragged onto a day) via the reconciliation effect in the main component below.
function ItineraryStep({
  dayCount,
  itineraryItems,
  setItineraryItems,
  dayNotes,
  setDayNotes,
  selectedHotel,
  selectedTours,
  selectedTransfers,
  selectedActivities,
  onDeleteItem,
}) {
  const [draggingKey, setDraggingKey] = useState(null);

  function resolveMeta(item) {
    return resolveItemMeta(item.type, item.id, {
      hotel: selectedHotel,
      tours: selectedTours,
      transfers: selectedTransfers,
      activities: selectedActivities,
    });
  }

  function moveItem(key, targetDay, targetIndex) {
    setItineraryItems((items) => moveItineraryItem(items, key, targetDay, targetIndex));
  }

  function updateNote(key, note) {
    setItineraryItems((items) => updateItineraryItemNote(items, key, note));
  }

  const pool = unassignedItems(itineraryItems);

  return (
    <Card label="Day-wise itinerary (optional)" className="border-white">
      <p className="mb-4 text-xs text-agent-muted">
        Drag your selected hotel, tours, transfers, and extras onto the day they happen, reorder within a day, or add
        a note for the day. This is included with your request exactly as arranged here.
      </p>

      {dayCount === 0 ? (
        <p className="rounded-md border border-dashed border-agent-line-light bg-agent-panel/40 p-4 text-center text-sm text-agent-muted">
          Set Travel Start Date and Travel End Date in Trip Details to build the day-wise itinerary.
        </p>
      ) : (
        <>
          <div className="mb-5">
            <FieldLabel>Unassigned items — drag onto a day below</FieldLabel>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => moveItem(e.dataTransfer.getData('text/plain'), null)}
              className="flex min-h-[56px] flex-wrap gap-2 rounded-md border border-dashed border-agent-line-light bg-agent-panel/40 p-2.5"
            >
              {pool.length === 0 ? (
                <p className="py-2 text-[11px] text-agent-muted">
                  {itineraryItems.length === 0
                    ? 'Select hotels/tours/transfers/extras in earlier steps to place them here.'
                    : 'Everything is placed on a day.'}
                </p>
              ) : (
                pool.map((item, idx) => (
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
                        moveItem(e.dataTransfer.getData('text/plain'), null, idx);
                      }}
                      onNoteChange={(note) => updateNote(item.key, note)}
                      onDelete={() => onDeleteItem(item.type, item.id)}
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
                deleteItem={onDeleteItem}
                isLast={dayNumber === dayCount}
              />
            ))}
          </div>
        </>
      )}
    </Card>
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
function ReviewStep({ form, selectedHotel, selectedTours, selectedTransfers, selectedActivities, itineraryDays, travelers, updateTraveler }) {
  return (
    <div className="space-y-4">
      <Card label="Trip summary" className="border-white">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase text-agent-muted">Destination</dt>
            <dd>{form.destination || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-agent-muted">Travel dates</dt>
            <dd>
              {form.dateFrom || '—'} → {form.dateTo || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-agent-muted">Adults</dt>
            <dd>{form.paxAdults || 0}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-agent-muted">Children</dt>
            <dd>{form.paxChildren || 0}</dd>
          </div>
        </dl>
      </Card>

      <Card label="Selected hotel" className="border-white">
        {selectedHotel ? (
          <div className="text-sm">
            <span className="font-semibold">{selectedHotel.name}</span> — {selectedHotel.city}
            {selectedHotel.category ? ` · ${selectedHotel.category}★` : ''}
          </div>
        ) : (
          <p className="text-sm text-agent-muted">No hotel selected.</p>
        )}
      </Card>

      <Card label="Selected tours" className="border-white">
        {selectedTours.length === 0 ? (
          <p className="text-sm text-agent-muted">No tours selected.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {selectedTours.map((t) => (
              <li key={t.id}>
                {t.name} — {t.city}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card label="Selected transfers" className="border-white">
        {selectedTransfers.length === 0 ? (
          <p className="text-sm text-agent-muted">No transfers selected.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {selectedTransfers.map((t) => (
              <li key={t.id}>{t.name}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card label="Selected extras" className="border-white">
        {selectedActivities.length === 0 ? (
          <p className="text-sm text-agent-muted">No extras selected.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {selectedActivities.map((a) => (
              <li key={a.id}>{a.name}</li>
            ))}
          </ul>
        )}
      </Card>

      <ItineraryTimeline days={itineraryDays} emptyLabel="No day-wise itinerary added — you can still submit without one." />

      <TravelersEditor travelers={travelers} updateTraveler={updateTraveler} />
    </div>
  );
}

function validateStep(step, { form, selectedHotelId, travelers }) {
  if (step === 1) {
    if (!form.destination.trim()) return 'Destination is required.';
    if (!form.dateFrom || !form.dateTo) return 'Travel start and end dates are required.';
    // String comparison, not Date parsing — both are plain "YYYY-MM-DD" from
    // <input type="date">, so lexicographic order already matches
    // chronological order (see the matching backend refine in schemas.js).
    if (form.dateTo < form.dateFrom) return 'End date cannot be earlier than the start date.';
    if (form.dateFrom < todayDateString()) return 'Start date cannot be in the past.';
    if (!form.paxAdults || Number(form.paxAdults) < 1) return 'At least one adult is required.';
    // Hotel selection moved into this same step (was its own wizard step).
    if (!selectedHotelId) return 'Select a hotel to continue.';
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

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ destination: '', dateFrom: '', dateTo: '', paxAdults: 2, paxChildren: 0 });

  const [hotels, setHotels] = useState([]);
  const [tours, setTours] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Hotels don't load until a star category is picked (see HotelsStep) —
  // '' means "none picked yet", not "show everything".
  const [starCategory, setStarCategory] = useState('');
  const [hotelCityFilter, setHotelCityFilter] = useState('');
  const [tourCityFilter, setTourCityFilter] = useState('');

  const [selectedHotelId, setSelectedHotelId] = useState('');
  const [selectedTourIds, setSelectedTourIds] = useState([]);
  const [selectedTransferIds, setSelectedTransferIds] = useState([]);
  const [selectedActivityIds, setSelectedActivityIds] = useState([]);
  // Rows are derived from form.paxAdults/paxChildren (see the sync effect
  // below) rather than started with a hardcoded default row.
  const [travelers, setTravelers] = useState([]);

  // Day-wise Itinerary Planner (FIT-5) — see shared/itinerary/index.js for
  // the shape. itineraryItems' dayNumber is kept in sync with the current
  // hotel/tour/transfer/extra selection and the day count implied by Trip
  // Details' dates by the two effects below, so the Itinerary step never has
  // to reconcile stale state itself.
  const [itineraryItems, setItineraryItems] = useState([]);
  const [dayNotes, setDayNotes] = useState({});

  // Draft Quotes (item 1) — "Continue Editing" opens /agent/package-builder/:id;
  // draftId then tracks which row "Save Draft" and "Submit Request" write to.
  const [draftId, setDraftId] = useState(draftIdParam || '');
  const [draftLoading, setDraftLoading] = useState(!!draftIdParam);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState('');

  useEffect(() => {
    Promise.all([api.get('/hotels'), api.get('/tours'), api.get('/transfers'), api.get('/activities')])
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
  // Editing" resumes exactly where the agent left off.
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
        });
        setSelectedHotelId(pr.hotels[0]?.id || '');
        // Pre-picks the star category the already-selected hotel belongs to,
        // so resuming a draft shows that hotel's card rather than the
        // "select a category first" prompt.
        setStarCategory(pr.hotels[0]?.category || '');
        setSelectedTourIds(pr.tours.map((t) => t.id));
        setSelectedTransferIds(pr.transfers.map((t) => t.id));
        setSelectedActivityIds(pr.activities.map((a) => a.id));
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

  // Keeps the Itinerary step's item pool in sync whenever the agent changes
  // their hotel/tour/transfer/extra picks in earlier steps — deselected
  // items drop out, newly-selected ones land in the unassigned tray.
  useEffect(() => {
    const pool = buildSelectionPool({
      hotelId: selectedHotelId,
      tourIds: selectedTourIds,
      transferIds: selectedTransferIds,
      activityIds: selectedActivityIds,
    });
    setItineraryItems((items) => reconcileItineraryItems(items, pool));
  }, [selectedHotelId, selectedTourIds, selectedTransferIds, selectedActivityIds]);

  const dayCount = computeDayCount(form.dateFrom, form.dateTo);

  // Sends anything assigned to a day that no longer exists (Travel End Date
  // moved earlier) back to the unassigned tray instead of losing it.
  useEffect(() => {
    setItineraryItems((items) => clampItineraryDays(items, dayCount));
  }, [dayCount]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateTraveler(idx, field, value) {
    setTravelers((list) => list.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  }

  // Item 1 — "Save Draft"/"Continue Editing" autosave. Deliberately skips
  // validateStep(): a half-built package (no destination yet, no hotel
  // picked) must still save without being blocked by the strict Submit rules.
  function buildDraftPayload() {
    return {
      destination: form.destination,
      dateFrom: form.dateFrom || null,
      dateTo: form.dateTo || null,
      paxAdults: Number(form.paxAdults) || 1,
      paxChildren: Number(form.paxChildren) || 0,
      hotelIds: selectedHotelId ? [selectedHotelId] : [],
      tourIds: selectedTourIds,
      transferIds: selectedTransferIds,
      activityIds: selectedActivityIds,
      travelers: travelers.map((t) => ({ name: t.name, passportNo: t.passportNo || undefined, isChild: t.type === 'child' })),
      itinerary: serializeItinerary(itineraryItems, dayNotes, dayCount),
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

  function toggleTour(id) {
    setSelectedTourIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }
  function toggleTransfer(id) {
    setSelectedTransferIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }
  function toggleActivity(id) {
    setSelectedActivityIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  // Inline "Assign to day" shortcut on a tour/transfer/extra's own selection
  // card (Trip Details) — same moveItineraryItem the drag-and-drop Itinerary
  // step uses, just driven by a <Select> instead of a drop event. Always
  // appends to the end of the target day; reordering still happens there.
  function assignItemToDay(type, id, dayNumberValue) {
    const targetDay = dayNumberValue === '' ? null : Number(dayNumberValue);
    setItineraryItems((items) => moveItineraryItem(items, itineraryItemKey(type, id), targetDay));
  }

  // "Delete" from the Itinerary step (🗑 on a chip) — removing an itinerary
  // item is really removing it from the trip: deselect it at the source
  // (Trip Details), and the reconciliation effect above drops it from
  // itineraryItems automatically, same as unchecking it there directly would.
  function deleteItineraryItem(type, id) {
    if (type === 'hotel') setSelectedHotelId((current) => (current === id ? '' : current));
    else if (type === 'tour') setSelectedTourIds((list) => list.filter((x) => x !== id));
    else if (type === 'transfer') setSelectedTransferIds((list) => list.filter((x) => x !== id));
    else if (type === 'activity') setSelectedActivityIds((list) => list.filter((x) => x !== id));
  }

  function goNext() {
    const validationError = validateStep(step, { form, selectedHotelId, travelers });
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
    const validationError = validateStep(3, { form, selectedHotelId, travelers });
    if (validationError) {
      setError(validationError);
      return;
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
        hotelIds: [selectedHotelId],
        tourIds: selectedTourIds,
        transferIds: selectedTransferIds,
        activityIds: selectedActivityIds,
        // Unfiltered — validateStep(3) above already guarantees every row
        // has a name (and adults have a passport), so all rows are real.
        travelers: travelers.map((t) => ({ name: t.name, passportNo: t.passportNo || undefined, isChild: t.type === 'child' })),
        itinerary: serializeItinerary(itineraryItems, dayNotes, dayCount),
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

  const selectedHotel = hotels.find((h) => h.id === selectedHotelId) || null;
  const selectedTours = tours.filter((t) => selectedTourIds.includes(t.id));
  const selectedTransfers = transfers.filter((t) => selectedTransferIds.includes(t.id));
  const selectedActivities = activities.filter((a) => selectedActivityIds.includes(a.id));

  function resolveItineraryMeta(item) {
    return resolveItemMeta(item.type, item.id, {
      hotel: selectedHotel,
      tours: selectedTours,
      transfers: selectedTransfers,
      activities: selectedActivities,
    });
  }
  const itineraryDays = buildItineraryDays(itineraryItems, dayNotes, dayCount, resolveItineraryMeta);

  return (
    <div className="mx-auto max-w-5xl p-5 lg:p-8">
      <h2 className="mb-1 text-2xl font-bold text-agent-ink">Custom FIT Package Builder</h2>
      <p className="mb-5 text-sm text-agent-muted">
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
              View My FIT Requests
            </Button>
            <Button onClick={() => navigate('/agent/dashboard')}>Back to Dashboard</Button>
          </div>
        </Card>
      ) : catalogLoading || draftLoading ? (
        <p className="text-sm text-agent-muted">Loading…</p>
      ) : (
        <>
          <StepIndicator step={step} />

          {step === 1 && (
            <TripDetailsStep
              form={form}
              update={update}
              hotels={hotels}
              starCategory={starCategory}
              setStarCategory={setStarCategory}
              hotelCityFilter={hotelCityFilter}
              setHotelCityFilter={setHotelCityFilter}
              selectedHotelId={selectedHotelId}
              setSelectedHotelId={setSelectedHotelId}
              tours={tours}
              tourCityFilter={tourCityFilter}
              setTourCityFilter={setTourCityFilter}
              selectedTourIds={selectedTourIds}
              toggleTour={toggleTour}
              transfers={transfers}
              selectedTransferIds={selectedTransferIds}
              toggleTransfer={toggleTransfer}
              activities={activities}
              selectedActivityIds={selectedActivityIds}
              toggleActivity={toggleActivity}
              dayCount={dayCount}
              itineraryItems={itineraryItems}
              assignItemToDay={assignItemToDay}
            />
          )}
          {step === 2 && (
            <ItineraryStep
              dayCount={dayCount}
              itineraryItems={itineraryItems}
              setItineraryItems={setItineraryItems}
              dayNotes={dayNotes}
              setDayNotes={setDayNotes}
              selectedHotel={selectedHotel}
              selectedTours={selectedTours}
              selectedTransfers={selectedTransfers}
              selectedActivities={selectedActivities}
              onDeleteItem={deleteItineraryItem}
            />
          )}
          {step === 3 && (
            <ReviewStep
              form={form}
              selectedHotel={selectedHotel}
              selectedTours={selectedTours}
              selectedTransfers={selectedTransfers}
              selectedActivities={selectedActivities}
              itineraryDays={itineraryDays}
              travelers={travelers}
              updateTraveler={updateTraveler}
            />
          )}

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
