import { FaCircleCheck, FaCircleXmark } from 'react-icons/fa6';
import { formatCurrency, splitLines } from '../../shared/fdPackage/index.js';
import { computeNightsByCity, dayTitle, itemBulletText, ITINERARY_ITEM_TYPE_META } from '../../shared/itinerary/index.js';

// Client-facing FD departure itinerary document — the server-side PDF export
// counterpart to Custom FIT's ItineraryDocument.jsx, but deliberately in the
// *new* cream/gold visual language DepartureDetail.jsx was redesigned into
// (this session's whole DepartureDetail.jsx restyle), not the older teal
// agent-ink one ItineraryDocument.jsx still uses — "the pdf ... will need to
// ... follow the pattern as we have built [it] now" was the explicit ask.
// Self-contained (no page chrome/state) so DepartureItineraryPrint.jsx can
// render it standalone for Puppeteer, same convention as ItineraryDocument.
//
// INK/BODY/MUTED/DIVIDER below deliberately re-declare DepartureDetail.jsx's
// own local color tokens rather than importing them — this renders inside a
// separate, isolated Puppeteer-navigated page (see DepartureItineraryPrint.
// jsx), so duplicating five one-line hex constants here is simpler and safer
// than a cross-cutting refactor of that already pixel-tuned page component.
const INK = 'text-[#1B1B1B]';
const BODY = 'text-[#4B4844]';
const MUTED = 'text-[#6B6B65]';
const DIVIDER = 'border-[#E6E1D2]';
const SEATS_RED = '#EF4A3D';

// Same dot-and-connector bullet list as DepartureDetail.jsx's own
// ItineraryDayRow, minus the collapse/chevron interaction — a PDF has no
// clicking, so every day just renders open. See that component's own doc
// comment for why the connector is a per-item segment (dot-center to next
// dot-center) rather than a border on the whole <ul>.
function DayRow({ day }) {
  return (
    <div className="overflow-hidden rounded-xl border border-agent-accent/40">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className={`flex-none text-sm font-bold ${INK}`}>Day {day.dayNumber} :</span>
        <span className={`flex-1 text-sm ${INK}`}>{dayTitle(day)}</span>
      </div>
      <div className="px-4 pb-4">
        {day.items?.length > 0 ? (
          <ul className="pl-5">
            {day.items.map((item, itemIdx) => {
              const meta = ITINERARY_ITEM_TYPE_META[item.type];
              const isLast = itemIdx === day.items.length - 1;
              return (
                <li
                  key={`${item.type}:${item.id}:${itemIdx}`}
                  className={`relative text-sm ${MUTED} ${isLast ? '' : 'pb-2.5'}`}
                >
                  {!isLast && <span className="absolute -left-[22px] top-2.5 -bottom-2.5 w-0.5 bg-agent-accent/50" />}
                  <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-agent-accent" />
                  {itemBulletText(item, meta)}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={`text-sm ${MUTED}`}>Nothing planned yet.</p>
        )}
      </div>
    </div>
  );
}

// `departure` is the exact shape GET /departures/:id (and this PDF's own
// data endpoint, getDepartureDataForPdf) return — see departures.
// controller.js's buildDepartureDetail — so this never needs its own
// bespoke data-shaping beyond what's already computed there.
export default function FdItineraryDocument({ departure }) {
  const nightsByCity = computeNightsByCity(departure.itinerary);
  const inclusionLines = splitLines(departure.inclusions);
  const exclusionLines = splitLines(departure.exclusions);
  const hasBothInclExcl = inclusionLines.length > 0 && exclusionLines.length > 0;
  const exLocation = departure.departureDates?.[0]?.location;

  return (
    <div className="mx-auto max-w-3xl bg-white p-8">
      {/* Header */}
      <div className={`mb-6 border-b ${DIVIDER} pb-5`}>
        <div className="flex items-center gap-3">
          <img src="/Xclusive_Oman_Logo_2.png" alt="Xclusive Oman" className="h-10 w-auto flex-none object-contain" />
          <div className={`text-xs font-semibold uppercase tracking-wide ${MUTED}`}>Day-by-Day Itinerary</div>
        </div>
        <h1 className={`mt-4 text-3xl font-extrabold leading-tight ${INK}`}>{departure.title}</h1>
        <div className={`mt-2 flex flex-wrap items-center gap-3 text-sm ${MUTED}`}>
          {exLocation && (
            <span className="inline-flex flex-none items-center gap-1.5 rounded-full border border-agent-accent/50 bg-white px-3 py-1 font-semibold text-agent-accent-dark">
              Ex : {exLocation}
            </span>
          )}
          {departure.duration && <span>{departure.duration}</span>}
          {nightsByCity.length > 0 && <span>{nightsByCity.map((c) => `${c.nights}N ${c.city}`).join(' | ')}</span>}
        </div>
        {departure.ratePerPax != null && (
          <div className={`mt-3 text-sm font-bold ${INK}`}>
            Starting at {formatCurrency(departure.ratePerPax)}{' '}
            <span className={`font-normal ${MUTED}`}>Per Person Double Occupancy</span>
          </div>
        )}
      </div>

      {/* Hotel */}
      {departure.hotel && (
        <div className="mb-6">
          <h2 className={`mb-2 text-base font-bold ${INK}`}>Hotel</h2>
          <div className={`rounded-xl border ${DIVIDER} px-4 py-3 text-sm ${BODY}`}>
            <span className={`font-semibold ${INK}`}>{departure.hotel.name}</span>
            {departure.hotel.city && ` · ${departure.hotel.city}`}
            {departure.hotel.category && ` · ${departure.hotel.category}★`}
          </div>
        </div>
      )}

      {/* Day-by-day itinerary — the whole point of this document */}
      {departure.itinerary?.length > 0 && (
        <div className="mb-6">
          <h2 className={`mb-3 text-base font-bold ${INK}`}>Day-by-Day Itinerary</h2>
          <div className="space-y-2.5">
            {departure.itinerary.map((day) => (
              <DayRow key={day.dayNumber} day={day} />
            ))}
          </div>
        </div>
      )}

      {/* Inclusions / Exclusions — same layout/icons as DepartureDetail.jsx's
          InclusionsExclusionsSummary. */}
      {(inclusionLines.length > 0 || exclusionLines.length > 0) && (
        <div className={`rounded-2xl border ${DIVIDER} p-5`}>
          <div className={`grid grid-cols-1 gap-5 ${hasBothInclExcl ? `sm:grid-cols-2 sm:divide-x ${DIVIDER}` : ''}`}>
            {inclusionLines.length > 0 && (
              <div className={hasBothInclExcl ? 'sm:pr-6' : ''}>
                <h3 className={`mb-3 text-base font-bold ${INK}`}>Inclusions</h3>
                <ul className="space-y-2 text-sm">
                  {inclusionLines.map((line, idx) => (
                    <li key={idx} className={`flex items-start gap-2 ${BODY}`}>
                      <FaCircleCheck size={16} className="mt-0.5 flex-none text-green-500" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {exclusionLines.length > 0 && (
              <div className={hasBothInclExcl ? 'sm:pl-6' : ''}>
                <h3 className={`mb-3 text-base font-bold ${INK}`}>Exclusions</h3>
                <ul className="space-y-2 text-sm">
                  {exclusionLines.map((line, idx) => (
                    <li key={idx} className={`flex items-start gap-2 ${BODY}`}>
                      <FaCircleXmark size={16} className="mt-0.5 flex-none" style={{ color: SEATS_RED }} />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
