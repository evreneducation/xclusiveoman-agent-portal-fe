import DOMPurify from 'dompurify';
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

// Same DOMPurify pass DepartureDetail.jsx uses for the admin-authored
// "Booking terms" block — the terms HTML comes from the same site_terms row
// (carried through buildDepartureDetail's `terms` field for this token-authed
// print page, which can't call the session-only GET /site-terms itself).
function sanitizeHtml(html) {
  return DOMPurify.sanitize(html || '', { USE_PROFILES: { html: true } });
}

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
  const termsHtml = departure.terms || '';
  const hasTerms = termsHtml.replace(/<[^>]*>/g, '').trim().length > 0;

  return (
    // No outer padding — the server-side PDF export (itineraryPdf.service.js
    // #generateFdItineraryPdf) now passes real page.pdf() margins, which frame
    // every page including multi-page continuations; a padding here on top of
    // that would just double the top/left/right gap on page one only.
    <div className="mx-auto max-w-3xl bg-white">
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

      {/* Booking terms — the same admin-authored site_terms HTML the on-screen
          DepartureDetail.jsx renders in its "Booking terms" card, appended to
          the downloaded PDF. Child-element utility selectors hand-style the
          rich text (no @tailwindcss/typography plugin installed — same note as
          DepartureDetail.jsx's own copy of this block). `break-inside-avoid`
          on each heading keeps a heading from being stranded at a page break. */}
      {hasTerms && (
        <div className={`mt-6 rounded-2xl border ${DIVIDER} p-5`}>
          <h3 className={`mb-3 text-base font-bold ${INK}`}>Booking Terms &amp; Conditions</h3>
          <div
            className={`text-sm leading-relaxed ${BODY} [&_a]:text-agent-accent-dark [&_a]:underline [&_blockquote]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_blockquote]:italic [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:break-inside-avoid [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:break-inside-avoid [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-1.5 [&_h3]:mt-2 [&_h3]:break-inside-avoid [&_h3]:text-base [&_h3]:font-bold [&_hr]:my-4 [&_img]:max-w-full [&_img]:rounded-md [&_li]:break-inside-avoid [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_table]:w-full [&_table]:border-collapse [&_td]:p-2 [&_th]:p-2 [&_th]:font-semibold [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5`}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(termsHtml) }}
          />
        </div>
      )}
    </div>
  );
}
