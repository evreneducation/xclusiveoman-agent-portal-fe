import { formatShortDate } from '../../shared/fdPackage/index.js';
import { ITINERARY_ITEM_TYPE_META } from '../../shared/itinerary/index.js';

// Client-facing "Detailed Itinerary" document — the Custom FIT Builder's
// Review & Submit step, redesigned to read like a real travel-agency
// itinerary PDF instead of a wizard-review checklist. Deliberately
// self-contained (no wizard state, no Card/Button chrome) so it can be
// reused as-is for PDF export later, or dropped into QuoteDetail.jsx's
// post-submission view — same document either side of Submit.
//
// FIT-6 (blind pricing) applies here as much as anywhere else in the
// builder: no cost, markup, or price field exists anywhere in this
// component, only selection counts and a "pricing is handled after
// submission" line.
function SectionBar({ children }) {
  return (
    <div className="mb-3 inline-block rounded-sm bg-agent-ink px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white print:bg-black">
      {children}
    </div>
  );
}

function Th({ children, className = '' }) {
  return (
    <th className={`border border-agent-line-light bg-agent-panel px-3 py-2 text-left text-[11px] font-semibold uppercase text-agent-muted print:bg-white ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }) {
  return <td className={`border border-agent-line-light px-3 py-2 align-top ${className}`}>{children}</td>;
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-md border border-agent-line-light bg-agent-panel px-3 py-2.5 text-center print:bg-white">
      <div className="text-lg font-bold text-agent-ink">{value}</div>
      <div className="text-[10px] font-semibold uppercase text-agent-muted">{label}</div>
    </div>
  );
}

// `hotels` is plural — the agent builder picks a hotel per day now, so a
// trip can have more than one (e.g. a different hotel per city). Rendered as
// one row per hotel, in whatever order the caller provides ("chronological
// order" just falls out of that). Each hotel entry may carry its own
// `nights` (how many itinerary days it actually appears on) — falls back to
// the trip-wide `nights` below when not given.
export default function ItineraryDocument({
  destination,
  dateFrom,
  dateTo,
  paxAdults,
  paxChildren,
  dayCount,
  hotels,
  days,
  selectedCounts,
  inclusions,
}) {
  const nights = Math.max(dayCount - 1, 0);
  const totalPax = (paxAdults || 0) + (paxChildren || 0);
  // No "number of rooms" field exists anywhere in the builder yet — double
  // occupancy is the standard assumption this stands in for until one does.
  const rooms = Math.max(1, Math.ceil((paxAdults || 1) / 2));
  const hotelRows = hotels || [];

  return (
    <div className="rounded-lg border border-agent-line-light bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none sm:p-8">
      {/* 1. Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-agent-line-light pb-4">
        <div className="flex items-center gap-3">
          <img src="/Xclusive_Oman_Logo_2.png" alt="Xclusive Oman" className="h-10 w-auto flex-none object-contain" />
          <div className="text-xs text-agent-muted">Custom FIT Itinerary</div>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-agent-ink">Detailed Itinerary</h2>
          <p className="mt-1 text-xs text-agent-muted">
            {destination ? `${destination} · ` : ''}
            {dateFrom ? formatShortDate(dateFrom) : '—'} – {dateTo ? formatShortDate(dateTo) : '—'}
            {dayCount > 0 && ` · ${nights} Night${nights === 1 ? '' : 's'}`} · {totalPax || 0} Pax
          </p>
        </div>
      </div>

      {/* 2. Trip Details */}
      <div className="mb-6">
        <SectionBar>Trip Details</SectionBar>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th>Arrival Date</Th>
              <Th>Departure Date</Th>
              <Th>Number of Nights</Th>
              <Th>Persons (PAX)</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>{dateFrom ? formatShortDate(dateFrom) : '—'}</Td>
              <Td>{dateTo ? formatShortDate(dateTo) : '—'}</Td>
              <Td>{dayCount > 0 ? nights : '—'}</Td>
              <Td>{totalPax || '—'}</Td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1.5 text-[11px] text-agent-muted">
          {paxAdults || 0} Adult{paxAdults === 1 ? '' : 's'}
          {paxChildren ? `, ${paxChildren} Child${paxChildren === 1 ? '' : 'ren'}` : ''}
        </p>
      </div>

      {/* 3. Accommodation Details */}
      <div className="mb-6">
        <SectionBar>Accommodation Details</SectionBar>
        {hotelRows.length === 0 ? (
          <p className="text-sm text-agent-muted">No hotel selected yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <Th>Hotel Name</Th>
                <Th>Star Rating</Th>
                <Th>Location</Th>
                <Th>Rooms</Th>
                <Th>Adults</Th>
                <Th>Children</Th>
                <Th>Nights</Th>
              </tr>
            </thead>
            <tbody>
              {hotelRows.map((h) => (
                <tr key={h.id}>
                  <Td className="font-semibold text-agent-ink">{h.name}</Td>
                  <Td>{h.category ? `${h.category}★` : '—'}</Td>
                  <Td>{[h.city, h.state].filter(Boolean).join(', ') || '—'}</Td>
                  <Td>{rooms}</Td>
                  <Td>{paxAdults || 0}</Td>
                  <Td>{paxChildren || 0}</Td>
                  <Td>{h.nights ?? (dayCount > 0 ? nights : '—')}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 4. Daily Itinerary — sourced straight from the Day-wise Itinerary
          Planner (shared/itinerary's buildFullItineraryDays), every day
          1..N rendered even when empty so the document reads the same shape
          as the sample (a "Leisure Day"-style placeholder rather than a gap). */}
      <div className="mb-6">
        <SectionBar>Daily Itinerary</SectionBar>
        {days.length === 0 ? (
          <p className="text-sm text-agent-muted">Set Travel Start/End Date in Trip Details to generate the day-wise itinerary.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <Th className="w-20">Day</Th>
                <Th>Description</Th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.dayNumber}>
                  <Td className="font-semibold text-agent-ink">Day {day.dayNumber}</Td>
                  <Td>
                    {day.items.length === 0 && !day.notes ? (
                      <span className="text-agent-muted">No activities planned for this day yet.</span>
                    ) : (
                      <div className="space-y-0.5">
                        {day.items.map((item, idx) => {
                          const typeMeta = ITINERARY_ITEM_TYPE_META[item.type];
                          return (
                            <div key={`${item.type}:${item.id}:${idx}`}>
                              {item.name || typeMeta?.label || 'Item'}
                              {item.note && <span className="text-agent-muted"> — {item.note}</span>}
                            </div>
                          );
                        })}
                        {day.notes && <div className="text-agent-muted">{day.notes}</div>}
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 5. Inclusions — the agent's own editable summary of everything added
          to the itinerary/meals above (shared/inclusions/index.js), printed
          the same on screen and in the exported PDF (ItineraryPrint.jsx
          passes this same `inclusions` array through unchanged). */}
      <div className="mb-6">
        <SectionBar>Inclusions</SectionBar>
        {!inclusions || inclusions.length === 0 ? (
          <p className="text-sm text-agent-muted">Nothing added yet.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-agent-ink">
            {inclusions.map((text, idx) => (
              <li key={idx}>{text}</li>
            ))}
          </ul>
        )}
      </div>

      {/* 6. Summary — FIT-6 blind pricing: counts only, never a price. */}
      <div>
        <SectionBar>Package Summary</SectionBar>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile label="Hotels Selected" value={selectedCounts.hotels} />
          <SummaryTile label="Tours Selected" value={selectedCounts.tours} />
          <SummaryTile label="Transfers Selected" value={selectedCounts.transfers} />
          <SummaryTile label="Extras Selected" value={selectedCounts.activities} />
        </div>
        <p className="mt-3 rounded-md bg-agent-panel px-3 py-2.5 text-xs text-agent-muted print:bg-white print:border print:border-agent-line-light">
          Pricing will be prepared by Xclusive Oman after submission — no cost, markup, or price is shown here.
        </p>
      </div>
    </div>
  );
}
