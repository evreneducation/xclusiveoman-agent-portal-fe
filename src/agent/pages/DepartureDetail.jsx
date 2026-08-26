import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import {
  LuArrowLeft,
  LuArrowRight,
  LuBinoculars,
  LuBuilding2,
  LuCalendarCheck2,
  LuCamera,
  LuCar,
  LuCheck,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuClock,
  LuDownload,
  LuHotel,
  LuMapPin,
  LuMessageCircle,
  LuMinus,
  LuPlane,
  LuPlaneLanding,
  LuPlaneTakeoff,
  LuPlus,
  LuSearch,
  LuUtensils,
  LuX,
} from 'react-icons/lu';
import { FaCircleCheck, FaCircleXmark } from 'react-icons/fa6';
import { api } from '../api/client.js';
import { Button, Card, ErrorText, TextInput } from '../components/ui.jsx';
import { formatCurrency, formatShortDate, formatTime, getSeatsLeft } from '../../shared/fdPackage/index.js';
import { computeNightsByCity, ITINERARY_ITEM_TYPE_META, itineraryHasItemType } from '../../shared/itinerary/index.js';
import { RichTextDisplay, isEmptyHtml } from '../../shared/components/RichTextEditor.jsx';

// Colour/type pass — matches Departures.jsx's own "Fixed Group Departures"
// reference restyle exactly (same hex literals, not the agent-ink/agent-muted
// tokens, which are still the portal's older teal identity used elsewhere —
// see tailwind.config.js's own comment on agent-bg/agent-accent). Kept local
// to this file the same way Departures.jsx keeps them local to its own card,
// rather than redefining agent-ink globally and risking every other
// not-yet-restyled agent page.
const INK = 'text-[#1B1B1B]';
const BODY = 'text-[#4B4844]';
const MUTED = 'text-[#6B6B65]';
const DIVIDER = 'border-[#E6E1D2]';
const SEATS_RED = '#EF4A3D';

function sanitizeHtml(html) {
  return DOMPurify.sanitize(html || '', { USE_PROFILES: { html: true } });
}

// Full-screen photo viewer opened by clicking any hero/carousel image below
// — `gallery` is the full ordered image list, `index` the one currently
// shown. Prev/Next wrap around; Escape or clicking the backdrop closes it.
// Body scroll is suspended while open so the page behind it can't scroll.
function Lightbox({ gallery, index, onClose, onNavigate }) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onNavigate(-1);
      else if (e.key === 'ArrowRight') onNavigate(1);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, onNavigate]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 sm:p-10"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <LuX size={20} />
      </button>
      {gallery.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(-1);
            }}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-4"
          >
            <LuChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(1);
            }}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-4"
          >
            <LuChevronRight size={22} />
          </button>
        </>
      )}
      <img
        src={gallery[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
      />
      {gallery.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">
          {index + 1} / {gallery.length}
        </div>
      )}
    </div>
  );
}

// Airbnb/Booking.com-style photo grid — one large hero image on the left,
// the package's carousel images on the right (2x2 when there are exactly 4,
// horizontally scrollable beyond that — FD packages require a minimum of 4,
// see MIN_CAROUSEL_IMAGES in fdPackagesAdmin.controller.js, but can have
// more). Hovering a photo zooms/dims it slightly and clicking any photo
// (hero or grid) opens it full-screen in the Lightbox above. print:hidden —
// a photo grid has no place in a printed itinerary (handleDownloadItinerary
// below).
//
// min-h-0/min-w-0 on every grid item below is load-bearing, not decoration:
// grid (and flex) items default to `min-height: auto`/`min-width: auto`,
// which lets an <img>'s own intrinsic aspect ratio force its cell (and the
// row/column track itself) to grow past the fixed h-48/h-64 the container
// asks for. overflow-hidden alone doesn't stop that growth — it only clips
// what's already an inflated box — so object-cover ends up scaling the
// image up to cover that bigger box, which is exactly what reads as
// "zoomed in". Pinning min-h-0/min-w-0 overrides that default so the
// fixed container height actually wins and object-cover only ever covers
// the real, intended cell size.
// The back button overlays the top-left corner of the hero image instead of
// sitting as a separate line above the gallery.
function HeroGallery({ heroImageUrl, images, onBack }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const gridImages = images || [];
  const gallery = [heroImageUrl, ...gridImages].filter(Boolean);
  const main = heroImageUrl || gridImages[0];

  function navigateLightbox(delta) {
    setLightboxIndex((i) => (i == null ? i : (i + delta + gallery.length) % gallery.length));
  }

  return (
    <>
      {/* Each tile owns its own rounding/clipping/shadow now (rather than the
          whole block sharing one outer rounded-2xl/overflow-hidden) so the
          hero photo and every grid photo read as separate rounded cards with
          real daylight between them, not one mosaic shape cut apart by thin
          gap lines. gap-3 gives that daylight enough room to actually
          register at a glance. */}
      <div className="mb-6 grid h-48 grid-cols-2 grid-rows-1 gap-3 sm:h-64 print:hidden">
        <div className="relative h-full min-h-0 w-full min-w-0 overflow-hidden rounded-2xl shadow-md shadow-black/10">
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            aria-label="View photo"
            className="group block h-full w-full cursor-zoom-in"
          >
            <img
              src={main}
              alt=""
              className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-105 group-hover:brightness-95"
            />
          </button>
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to departures"
            className={`absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg transition hover:scale-105 hover:bg-agent-bg ${INK}`}
          >
            <LuArrowLeft size={18} />
          </button>
        </div>
        <div className="grid h-full min-h-0 w-full min-w-0 grid-flow-col grid-rows-2 auto-cols-[46%] gap-3 overflow-x-auto scroll-smooth sm:auto-cols-[47%]">
          {gridImages.map((url, i) => (
            <button
              key={url + i}
              type="button"
              onClick={() => setLightboxIndex(i + 1)}
              aria-label="View photo"
              className="group h-full min-h-0 w-full min-w-0 cursor-zoom-in overflow-hidden rounded-2xl bg-agent-bg shadow-md shadow-black/10"
            >
              <img
                src={url}
                alt=""
                className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-110 group-hover:brightness-95"
              />
            </button>
          ))}
        </div>
      </div>
      {lightboxIndex != null && (
        <Lightbox
          gallery={gallery}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={navigateLightbox}
        />
      )}
    </>
  );
}

// One rounded pill *per row* of tick badges (Stay Included, Sightseeing
// Included, …) — each row its own standalone capsule stacked with a gap
// between them, rather than one shape stretched across every row (which
// reads as an odd half-pill hybrid the moment it wraps). Figuring out which
// items land on which row still needs real measurement first: an invisible
// copy of the same badges is laid out in a plain flex-wrap pass (measureRef
// below) purely to read each one's offsetTop — browsers expose no "which
// line did this flex item wrap onto" CSS selector, so there's no way to
// group them into rows without actually watching where they land. Once a
// row's items are known, that row's own capsule never wraps internally (it
// is, by construction, exactly the items that already fit on one line), so
// divide-x works on it directly with no leak/clamp workarounds needed —
// those were only ever necessary for a *single* box spanning multiple lines.
function TickBadges({ items }) {
  const measureRef = useRef(null);
  // Which row (0, 1, 2, …) each item landed in, from the hidden measuring
  // pass — null until the first measurement lands, in which case everything
  // renders as one row so there's no flash before that first measurement.
  const [rowOf, setRowOf] = useState(null);

  useLayoutEffect(() => {
    function measure() {
      const el = measureRef.current;
      if (!el || el.children.length === 0) return;
      const rows = [];
      let lastTop = null;
      let row = -1;
      Array.from(el.children).forEach((child) => {
        if (child.offsetTop !== lastTop) {
          row += 1;
          lastTop = child.offsetTop;
        }
        rows.push(row);
      });
      setRowOf(rows);
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [items]);

  const rows = rowOf
    ? items.reduce((acc, label, i) => {
        (acc[rowOf[i]] ||= []).push(label);
        return acc;
      }, [])
    : [items];

  return (
    <div className="relative">
      {/* Invisible — same badges, laid out flat so their natural wrap points
          can be read, but never painted or interactive. Absolutely
          positioned out of flow so it doesn't add empty space above the
          real rows below, while still measuring against that same width. */}
      <div ref={measureRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex flex-wrap opacity-0">
        {items.map((label) => (
          <span key={label} className="flex items-center gap-2 px-4 py-2 text-xs font-semibold">
            <span className="h-5 w-5 flex-none" />
            {label}
          </span>
        ))}
      </div>

      <div className="flex flex-col items-start gap-2">
        {rows.map((rowItems, rowIdx) => (
          <div
            key={rowIdx}
            className="inline-flex max-w-full flex-none divide-x divide-agent-accent/40 overflow-hidden rounded-full border border-agent-accent/50 bg-white"
          >
            {rowItems.map((label) => (
              <span key={label} className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold ${INK}`}>
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full border border-agent-accent/50 bg-agent-accent-soft">
                  <LuCheck size={11} className={INK} />
                </span>
                {label}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Consistent section header — small gold icon chip + bold serif-adjacent
// title — used across every content card below so the page reads as one
// designed system instead of a stack of generic boxes. `icon` is a
// react-icons component (e.g. LuHotel), not an emoji.
function SectionHeading({ icon: Icon, children }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-agent-accent-soft text-agent-accent-dark">
        <Icon size={16} />
      </span>
      <h3 className={`text-sm font-bold uppercase tracking-wide ${INK}`}>{children}</h3>
    </div>
  );
}

// Quick-glance tabbed summary — Hotel/Sightseeing/Meals/Transfer/Flight, one
// panel visible at a time, active tab filled gold like the reference. A
// lighter-weight teaser than the full sections further down the page
// (ItineraryTimeline, MealsSummary): it doesn't replace them, it just gives
// the agent a fast first look before scrolling. Sightseeing pulls real tour/
// activity items straight off the itinerary — a day with neither simply
// isn't shown, nothing invented for it. Meals/Transfer only render a real,
// data-backed line when the package actually has one.
const OVERVIEW_TABS = [
  { key: 'hotel', label: 'Hotel', icon: LuBuilding2 },
  { key: 'sightseeing', label: 'Sightseeing', icon: LuBinoculars },
  { key: 'meals', label: 'Meals', icon: LuUtensils },
  { key: 'transfer', label: 'Transfers', icon: LuCar },
  { key: 'flight', label: 'Flight', icon: LuPlane },
];

function ItineraryOverviewTabs({ departure }) {
  const [activeTab, setActiveTab] = useState('hotel');

  const sightseeingItems = (departure.itinerary || [])
    .flatMap((day) => day.items || [])
    .filter((item) => item.type === 'tour' || item.type === 'activity');
  const hasMeals = (departure.meals || []).length > 0;
  const hasTransfers = itineraryHasItemType(departure.itinerary, 'transfer');

  return (
    <Card className="border-white rounded-2xl p-5 sm:p-6 print:hidden">
      {/* Outer capsule around the whole tab row, on top of each tab's own
          individual capsule — two nested rounded-full shapes, not one. */}
      <div className="rounded-full border border-agent-accent/50 bg-white p-2">
        {/* flex, not a 2/5-col grid — a grid forces every tab into an equal
            share of the row regardless of its own label length, which is
            exactly what was truncating "Sightseeing"/"Transfers" down to
            "Sigh…"/"Tran…" while "Hotel"/"Meals"/"Flight" sat in the same-
            width column with room to spare. Each tab now sizes to its own
            content (flex-none, no truncate) and wraps to a new line only if
            it genuinely doesn't fit, matching the reference's full labels. */}
        {/* Compact enough that all 5 fit on one row within this card's
            actual (narrower-than-full-page) width — this card shares the
            page with the booking sidebar, not the full viewport, so the
            more generous padding/icon size that fit in isolation was
            pushing "Flight" onto its own second row, stretching the outer
            rounded-full capsule into an odd tall stadium shape sized for
            one row's worth of height. */}
        {/* justify-between spreads the tabs across the capsule's full width
            (using leftover space as gaps, not stretching each tab's own
            content-hugging size) instead of the row sitting left-aligned
            with dead space on the right — gap-2 still applies as the
            minimum/only gap if this ever wraps to a second row, where
            justify-between has nothing left to distribute within a row. */}
        <div className="flex flex-wrap justify-between gap-2">
          {OVERVIEW_TABS.map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`flex flex-none items-center gap-2 rounded-full border px-3 py-2 text-left transition-all duration-200 ${
                  active
                    ? 'border-agent-accent-dark bg-agent-accent shadow-sm shadow-agent-accent/30'
                    : 'border-agent-accent/50 bg-white hover:-translate-y-0.5 hover:border-agent-accent hover:shadow-md'
                }`}
              >
                {/* Icon itself stays dark on the cream circle in both states —
                    only the tab's own background (and the label's color)
                    switch for active — matching the reference exactly rather
                    than the previous white-silhouette-on-gold treatment. */}
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-agent-accent-soft">
                  <Icon size={15} className={INK} />
                </span>
                <span className={`whitespace-nowrap text-sm font-bold ${active ? 'text-white' : INK}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`mt-4 rounded-xl bg-agent-bg p-4`}>
        {activeTab === 'hotel' && <HotelOverviewPanel hotel={departure.hotel} />}
        {activeTab === 'sightseeing' && <SightseeingOverviewPanel items={sightseeingItems} />}
        {activeTab === 'meals' && <MealsOverviewPanel hasMeals={hasMeals} />}
        {activeTab === 'transfer' && <TransferOverviewPanel hasTransfers={hasTransfers} />}
        {activeTab === 'flight' && <FlightOverviewPanel flights={departure.flights} />}
      </div>
    </Card>
  );
}

function HotelOverviewPanel({ hotel }) {
  if (!hotel) {
    return <p className={`text-sm ${MUTED}`}>No hotel selected for this package.</p>;
  }
  return (
    <div>
      <div className={`mb-3 text-sm font-bold ${INK}`}>Hotel Overview</div>
      <div className={`max-w-xs overflow-hidden rounded-xl border ${DIVIDER} bg-white shadow-sm`}>
        <div className="relative h-40 w-full bg-agent-bg">
          {hotel.images?.[0] ? (
            <img src={hotel.images[0]} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className={`flex h-full w-full items-center justify-center ${MUTED}`}>
              <LuHotel size={28} />
            </div>
          )}
          {hotel.category != null && (
            <span className={`absolute right-2 top-2 flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-bold shadow-sm ${INK}`}>
              {hotel.category} <span className="text-agent-accent-dark">★</span>
            </span>
          )}
        </div>
        <div className="p-3">
          <div className={`font-serif text-sm font-bold ${INK}`}>{hotel.name}</div>
          <div className={`mt-1 flex items-center gap-1 text-xs ${MUTED}`}>
            <LuMapPin size={12} className="flex-none text-agent-accent-dark" /> {hotel.city || '—'}
          </div>
          {hotel.boardBasisOptions?.[0] && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={`rounded-full bg-agent-bg px-2.5 py-1 text-[11px] font-medium ${INK}`}>
                Meal: {hotel.boardBasisOptions[0]}
              </span>
            </div>
          )}
          <RichTextDisplay html={hotel.description} className={`mt-2 text-xs leading-relaxed ${BODY}`} />
        </div>
      </div>
    </div>
  );
}

function SightseeingOverviewPanel({ items }) {
  if (items.length === 0) {
    return <p className={`text-sm ${MUTED}`}>No sightseeing included in this package.</p>;
  }
  return (
    <div>
      <div className={`mb-3 text-sm font-bold ${INK}`}>Sightseeing Overview</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item, idx) => (
          <div
            key={`${item.type}:${item.id}:${idx}`}
            className={`overflow-hidden rounded-xl border ${DIVIDER} bg-white shadow-sm`}
          >
            <div className="h-24 w-full bg-agent-bg">
              {item.images?.[0] ? (
                <img src={item.images[0]} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className={`flex h-full w-full items-center justify-center ${MUTED}`}>
                  <LuCamera size={20} />
                </div>
              )}
            </div>
            <div className="p-2.5">
              <div className={`text-xs font-bold leading-snug ${INK}`}>{item.name || 'Untitled'}</div>
              {item.city && (
                <div className={`mt-1 flex items-center gap-1 text-[11px] ${MUTED}`}>
                  <LuMapPin size={11} className="flex-none text-agent-accent-dark" /> {item.city}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MealsOverviewPanel({ hasMeals }) {
  return (
    <div>
      <div className={`mb-2 text-sm font-bold ${INK}`}>Meals Overview</div>
      {hasMeals ? (
        <ul className={`space-y-1 text-sm ${INK}`}>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-agent-accent-dark" />
            Meals as per itinerary
          </li>
        </ul>
      ) : (
        <p className={`text-sm ${MUTED}`}>No meals included in this package.</p>
      )}
    </div>
  );
}

function TransferOverviewPanel({ hasTransfers }) {
  return (
    <div>
      <div className={`mb-2 text-sm font-bold ${INK}`}>Transfer Overview</div>
      {hasTransfers ? (
        <ul className={`space-y-1 text-sm ${INK}`}>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-agent-accent-dark" />
            Transfers included
          </li>
        </ul>
      ) : (
        <p className={`text-sm ${MUTED}`}>No transfers included in this package.</p>
      )}
    </div>
  );
}

// Folded into the tabs above (was its own always-visible card) — the
// reference design only ever surfaces flight details behind the Flight tab,
// same lightweight teaser treatment as every other OverviewPanel here.
function FlightOverviewPanel({ flights }) {
  if (!flights) {
    return <p className={`text-sm ${MUTED}`}>No flights included in this package.</p>;
  }
  const legs = [
    { key: 'onward', label: 'Onward', Icon: LuPlaneTakeoff, data: flights.onward },
    { key: 'return', label: 'Return', Icon: LuPlaneLanding, data: flights.return },
  ];
  return (
    <div>
      <div className={`mb-3 text-sm font-bold ${INK}`}>Flight Overview</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {legs.map(({ key, label, Icon, data }) => (
          <div key={key} className={`rounded-xl border ${DIVIDER} bg-white px-4 py-3`}>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-agent-accent-soft text-agent-accent-dark">
                <Icon size={15} />
              </span>
              <span className={`text-sm font-bold ${INK}`}>{label}</span>
            </div>
            <div className={`text-sm font-semibold ${INK}`}>{data.name}</div>
            <div className={`mt-0.5 text-xs ${MUTED}`}>
              {data.source} → {data.destination}
            </div>
            <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${MUTED}`}>
              <LuClock size={13} className="flex-none" />
              {formatShortDate(data.departureDate)}
              {formatTime(data.departureTime) && ` at ${formatTime(data.departureTime)}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Each day's one-line title, shown collapsed next to its "Day N" pill —
// the admin's own day note when there is one (e.g. "Arrival In Phu Quoc"),
// else the first named itinerary item on that day (e.g. a tour called
// "North Island Tour"), else a plain fallback. `itinerary` is the wire shape
// composed server-side (fdPackages.model.js's composeItinerary):
// [{ dayNumber, notes, items: [{ type, id, name, city, note }] }] — the same
// shape the admin's Day-by-day itinerary builder saves (see
// admin/pages/FdPackageEditor.jsx).
function dayTitle(day) {
  if (day.notes?.trim()) return day.notes.trim();
  const firstNamed = (day.items || []).find((item) => item.name);
  return firstNamed?.name || 'Itinerary details';
}

// One plain bullet line per item — "<name> · <city> (<note>)", or the
// hotel-only adults/rooms line when there's no note to fold it into instead.
// Deliberately just text, no per-type icon/chip anymore (that's the whole
// point of this restyle — a plain dotted list, not a card grid).
function itemBulletText(item, meta) {
  const parts = [item.name || meta?.label || 'Item'];
  if (item.city) parts.push(item.city);
  let text = parts.join(' · ');
  if (item.type === 'hotel' && item.adults != null) {
    text += ` (${item.adults} ${item.adults === 1 ? 'adult' : 'adults'} · ${item.rooms} ${item.rooms === 1 ? 'room' : 'rooms'})`;
  } else if (item.note) {
    text += ` (${item.note})`;
  }
  return text;
}

function ItineraryDayRow({ day }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-agent-accent/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-agent-bg"
      >
        <span className={`flex-none text-sm font-bold ${INK}`}>Day {day.dayNumber} :</span>
        <span className={`flex-1 text-sm ${INK}`}>{dayTitle(day)}</span>
        <LuChevronDown
          size={18}
          className={`flex-none text-agent-accent-dark transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
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
                        {/* Segment per item (dot-center to next dot-center), not a
                            ul-spanning border — a border on the <ul> runs the full box
                            height regardless of where the dots sit, so it overshoots
                            past the first/last dot. pb-2.5 (replacing space-y-2.5) folds
                            the inter-item gap into this li so `-bottom-2.5` can reach
                            exactly to the next item's dot center. */}
                        {!isLast && (
                          <span className="absolute -left-[22px] top-2.5 -bottom-2.5 w-0.5 bg-agent-accent/50" />
                        )}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ItineraryTimeline({ itinerary }) {
  return (
    <Card className="border-white rounded-2xl p-5 sm:p-6">
      <h3 className={`mb-4 text-base font-bold ${INK}`}>Day-by-Day Itinerary</h3>
      <div className="space-y-2.5">
        {itinerary.map((day) => (
          <ItineraryDayRow key={day.dayNumber} day={day} />
        ))}
      </div>
    </Card>
  );
}

// Read-only mirror of the admin's Meals section (FdPackageEditor.jsx) —
// already folded into departure.ratePerPax server-side (resolveRatePerPax),
// this is purely informational so the agent can see what's included and why.
function MealsSummary({ meals }) {
  if (!meals?.length) return null;
  return (
    <Card className="border-white rounded-2xl p-5 sm:p-6">
      <SectionHeading icon={LuUtensils}>Meals</SectionHeading>
      <div className="space-y-2">
        {meals.map((meal) => (
          <div key={meal.type} className={`flex items-center justify-between rounded-xl border ${DIVIDER} px-3.5 py-2.5`}>
            <div>
              <div className={`text-sm font-semibold ${INK}`}>{meal.label}</div>
              <div className={`text-xs ${MUTED}`}>
                {meal.people} {meal.people === 1 ? 'person' : 'people'} · {meal.days} {meal.days === 1 ? 'day' : 'days'} ·{' '}
                {formatCurrency(meal.pricePerDay)}/person/day
              </div>
            </div>
            <div className={`text-sm font-bold ${INK}`}>{formatCurrency(meal.cost)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// The FD package's own short description — admin-authored rich text in
// FdPackageEditor.jsx (fd_packages.short_description), already flowing
// through to this page via departure.shortDescription (departures.
// controller.js's toPublicPackage) but never actually rendered here until
// now. Same plain-bold-header treatment as Inclusions/Exclusions and
// Booking terms below, not the icon-chip SectionHeading — self-guards via
// isEmptyHtml the same way RichTextDisplay itself does, so a package with
// no description written yet just skips this card entirely.
function PackageDescription({ html }) {
  if (isEmptyHtml(html)) return null;
  return (
    <Card className="border-white rounded-2xl p-5 sm:p-6">
      <h3 className={`mb-3 text-base font-bold ${INK}`}>About this package</h3>
      <RichTextDisplay html={html} className={`text-sm leading-relaxed ${BODY}`} />
    </Card>
  );
}

// Client-facing Inclusions/Exclusions the admin curated in FdPackageEditor.jsx
// (dropdown-from-catalog + editable list, admin/components/
// InclusionExclusionList.jsx) — persisted as one newline-delimited string
// each, so this just splits it back into bullets for display. Read-only,
// same as MealsSummary above.
function splitLines(text) {
  return (text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function InclusionsExclusionsSummary({ inclusions, exclusions }) {
  const inclusionLines = splitLines(inclusions);
  const exclusionLines = splitLines(exclusions);
  if (inclusionLines.length === 0 && exclusionLines.length === 0) return null;
  // Only force the 2-column + divider layout when both sides actually have
  // content — a package with just Inclusions (or just Exclusions) used to
  // still get sm:grid-cols-2, leaving the other, empty column as dead white
  // space. With only one side present, that one column now spans full width
  // with no divider next to it.
  const hasBoth = inclusionLines.length > 0 && exclusionLines.length > 0;

  return (
    <Card className="border-white rounded-2xl p-5 sm:p-6">
      <div className={`grid grid-cols-1 gap-5 ${hasBoth ? `sm:grid-cols-2 sm:divide-x ${DIVIDER}` : ''}`}>
        {inclusionLines.length > 0 && (
          <div className={hasBoth ? 'sm:pr-6' : ''}>
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
          <div className={hasBoth ? 'sm:pl-6' : ''}>
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
    </Card>
  );
}

// Category label + closed-box placeholder per add-on `type` (departures.
// controller.js's getDeparture derives `type` from whichever of activity_id/
// tour_id/transfer_id/flight_id is set on the fd_addons row) — fixed display
// order regardless of what order the API happens to return them in, so the
// section always reads Activities -> Tours -> Transfers -> Flights.
// `selectLabel` is the singular/short form the reference design uses on the
// search box itself ("Select Activity", "Select Day Tours"), distinct from
// `label`'s plural category-name form used for the "N selected" badge.
const ADDON_CATEGORY_META = {
  activity: { label: 'Activities', selectLabel: 'Activity' },
  tour: { label: 'Tours', selectLabel: 'Day Tours' },
  transfer: { label: 'Transfers', selectLabel: 'Transfers' },
  flight: { label: 'Flights', selectLabel: 'Flights' },
};
const ADDON_CATEGORY_ORDER = ['activity', 'tour', 'transfer', 'flight'];

// type -> the catalog entity's plural route name (catalog.routes.js) — lets
// AddonDetailModal fetch the full catalog row for a given add-on via the
// existing generic GET /:entity/:id detail route.
const ADDON_TYPE_TO_PATH = { activity: 'activities', tour: 'tours', transfer: 'transfers', flight: 'flights' };

function groupAddonsByType(addons) {
  const groups = {};
  for (const addon of addons || []) {
    const type = addon.type || 'activity';
    (groups[type] ||= []).push(addon);
  }
  return groups;
}

// "View Details" popup for one add-on — lazy-fetches the full catalog row
// the moment it opens, since the departure/addons list itself only carries
// id/type/catalogId/name/pricePerPax (departures.controller.js), not
// description/images/city/duration. Same fixed-overlay + Escape/backdrop-
// click-to-close pattern as Lightbox above. Doubles as the actual add/remove
// control — Cancel just closes, Add(/Remove once already selected) toggles
// the add-on via the same onToggle the checklist rows use, then closes.
//
// `infoLines` shows whichever of duration/city/route the catalog row
// actually has (activities/tours have duration, transfers have city,
// flights have neither but do have source/destination) — the reference this
// was built from shows a fixed "Duration : … / Pickup Time : …" pair, but
// there's no pickup-time field anywhere in this app's catalog schema, so
// that's real available fields instead of a fabricated one.
function AddonDetailModal({ addon, selected, onToggle, onClose }) {
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    setDetail(null);
    setDetailError('');
    api
      .get(`/${ADDON_TYPE_TO_PATH[addon.type]}/${addon.catalogId}`)
      .then((res) => setDetail(res[addon.type]))
      .catch((err) => setDetailError(err.message));
  }, [addon.type, addon.catalogId]);

  const images = detail?.images || [];
  const [mainImage, ...restImages] = images;
  const infoLines = [];
  if (detail?.duration) infoLines.push({ label: 'Duration', value: detail.duration, icon: LuClock });
  if (detail?.city) infoLines.push({ label: 'City', value: detail.city, icon: LuMapPin });
  if (detail?.source || detail?.destination) {
    infoLines.push({ label: 'Route', value: `${detail.source} → ${detail.destination}`, icon: LuPlane });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-agent-bg p-5 shadow-2xl sm:p-6"
      >
        {!detail && !detailError && <p className={`text-sm ${MUTED}`}>Loading…</p>}
        {detailError && <p className="text-sm text-rose-600">{detailError}</p>}
        {detail && (
          <>
            {/* Gallery shape adapts to how many images the catalog row
                actually has: 1 -> a single centered photo (no empty second
                column), 2 -> equal side-by-side, 3+ -> one big photo on the
                left with the rest stacked on the right (scrolling past 2),
                matching the reference design's 3-image case exactly. */}
            {images.length === 1 && (
              <div className="mb-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setLightboxIndex(0)}
                  aria-label="View photo"
                  className="group h-48 w-full max-w-md min-h-0 cursor-zoom-in overflow-hidden rounded-2xl shadow-md shadow-black/10 sm:h-64"
                >
                  <img
                    src={images[0]}
                    alt=""
                    className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-105 group-hover:brightness-95"
                  />
                </button>
              </div>
            )}
            {images.length === 2 && (
              <div className="mb-5 grid h-48 grid-cols-2 gap-3 sm:h-64">
                {images.map((url, i) => (
                  <button
                    key={url + i}
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    aria-label="View photo"
                    className="group h-full min-h-0 w-full min-w-0 cursor-zoom-in overflow-hidden rounded-2xl shadow-md shadow-black/10"
                  >
                    <img
                      src={url}
                      alt=""
                      className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-105 group-hover:brightness-95"
                    />
                  </button>
                ))}
              </div>
            )}
            {images.length >= 3 && (
              <div className="mb-5 grid h-48 grid-cols-2 gap-3 sm:h-64">
                <button
                  type="button"
                  onClick={() => setLightboxIndex(0)}
                  aria-label="View photo"
                  className="group h-full min-h-0 w-full min-w-0 cursor-zoom-in overflow-hidden rounded-2xl shadow-md shadow-black/10"
                >
                  <img
                    src={mainImage}
                    alt=""
                    className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-105 group-hover:brightness-95"
                  />
                </button>
                <div className="grid h-full min-h-0 w-full min-w-0 grid-flow-row auto-rows-[47%] gap-3 overflow-y-auto scroll-smooth">
                  {restImages.map((url, i) => (
                    <button
                      key={url + i}
                      type="button"
                      onClick={() => setLightboxIndex(i + 1)}
                      aria-label="View photo"
                      className="group h-full min-h-0 w-full min-w-0 cursor-zoom-in overflow-hidden rounded-2xl bg-white shadow-md shadow-black/10"
                    >
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-110 group-hover:brightness-95"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={`flex flex-wrap items-start justify-between gap-3 border-b ${DIVIDER} pb-3`}>
              <h3 className={`text-2xl font-extrabold ${INK}`}>{addon.name}</h3>
              {infoLines.length > 0 && (
                <div className="flex flex-col items-end gap-1.5">
                  {infoLines.slice(0, 2).map((line) => (
                    <span
                      key={line.label}
                      className="inline-flex items-center gap-1.5 rounded-full bg-agent-accent-soft px-3 py-1 text-xs font-semibold text-agent-accent-dark"
                    >
                      <line.icon size={12} className="flex-none" />
                      {line.label} : {line.value}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <RichTextDisplay html={detail.description} className={`mt-3 text-sm leading-relaxed ${BODY}`} />

            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className={`rounded-full border ${DIVIDER} bg-white px-6 py-2.5 text-sm font-semibold ${INK} transition-colors hover:bg-agent-bg`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onToggle(addon.id);
                  onClose();
                }}
                className="rounded-full bg-agent-accent px-8 py-2.5 text-sm font-semibold text-white shadow-sm shadow-agent-accent/30 transition hover:opacity-90"
              >
                {selected ? 'Remove' : 'Add'}
              </button>
            </div>
          </>
        )}
      </div>
      {lightboxIndex != null && (
        <Lightbox
          gallery={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(delta) => setLightboxIndex((i) => (i + delta + images.length) % images.length)}
        />
      )}
    </div>
  );
}

// Search-combobox for one add-on category, matching the reference design:
// the closed box reads "Select Activity"/"Select Day Tours"/"Select
// Transfers" and doubles as a live-filter search input once focused; the
// open list shows at most 3 rows before scrolling (ADDON_LIST_MAX_HEIGHT),
// and a checked item is marked with a filled dot and floats to the top of
// the list, ahead of everything unchecked — both regardless of whatever the
// current search text matched. "View Details" opens AddonDetailModal above,
// without toggling selection.
const ADDON_LIST_MAX_HEIGHT = 148; // ~3 rows (each ~49px incl. divider)

function AddonSelect({ type, addons, selectedAddonIds, onToggle, onViewDetails }) {
  const meta = ADDON_CATEGORY_META[type] || { label: 'Other', selectLabel: 'Item' };
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const selectedCount = addons.filter((a) => selectedAddonIds.includes(a.id)).length;

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const filtered = addons.filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase()));
  // Checked items float to the top as a group, unchecked below — each group
  // otherwise keeping the catalog's own order.
  const sorted = [
    ...filtered.filter((a) => selectedAddonIds.includes(a.id)),
    ...filtered.filter((a) => !selectedAddonIds.includes(a.id)),
  ];

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-xl border bg-white px-4 py-3 transition-colors ${
          open ? 'border-agent-accent' : DIVIDER
        }`}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={`Select ${meta.selectLabel}`}
          className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${INK} placeholder:${MUTED}`}
        />
        {selectedCount > 0 && !open && (
          <span className="flex-none rounded-full bg-agent-accent-soft px-2 py-0.5 text-[10px] font-semibold text-agent-accent-dark">
            {selectedCount} selected
          </span>
        )}
        <LuSearch size={16} className={`flex-none ${MUTED}`} />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className={`absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border ${DIVIDER} bg-white shadow-lg`}
          >
            {sorted.length === 0 ? (
              <p className={`px-4 py-3 text-sm ${MUTED}`}>No matches.</p>
            ) : (
              <div className="overflow-y-auto" style={{ maxHeight: ADDON_LIST_MAX_HEIGHT }}>
                {sorted.map((addon) => {
                  const checked = selectedAddonIds.includes(addon.id);
                  return (
                    <div
                      key={addon.id}
                      className={`flex items-center gap-2.5 border-b px-4 py-2.5 last:border-b-0 ${DIVIDER} ${
                        checked ? 'bg-agent-accent-soft/40' : 'hover:bg-agent-bg'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onToggle(addon.id)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <span
                          className={`flex h-4 w-4 flex-none items-center justify-center rounded-full border-2 ${
                            checked ? 'border-agent-accent bg-agent-accent' : `${DIVIDER} bg-white`
                          }`}
                        >
                          {checked && <LuCheck size={10} className="text-white" />}
                        </span>
                        <span className={`min-w-0 flex-1 truncate text-sm ${INK}`}>{addon.name}</span>
                      </button>
                      {addon.catalogId && (
                        <button
                          type="button"
                          onClick={() => onViewDetails(addon)}
                          className="flex-none rounded-full border border-agent-accent/50 px-2.5 py-1 text-[11px] font-semibold text-agent-accent-dark transition-colors hover:bg-agent-accent-soft"
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Single-select searchable dropdown for departure city / departure date —
// same visual language as AddonSelect above (search-box trigger that doubles
// as a live filter, checked item floats to the top of the list), but
// single-select (radio, not checkbox) with the selection marker on the
// *right* of each row per the reference design, and picking a row closes the
// dropdown immediately — only one city (or date) is ever active at a time,
// unlike add-ons. `getStatus` is the date list's own "Sold Out" tag, shown
// beside a disabled row; city rows have no status. Generic over `options`
// via getKey/getLabel so both pickers below share one implementation.
const SELECT_LIST_MAX_HEIGHT = 240; // ~5 rows

function SearchSelectDropdown({ placeholder, options, selectedValue, getKey, getLabel, getStatus, getDisabled, onSelect }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const selectedOption = options.find((o) => getKey(o) === selectedValue);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const filtered = options.filter((o) => getLabel(o).toLowerCase().includes(query.trim().toLowerCase()));
  // Selected option floats to the top, same convention as AddonSelect.
  const sorted = [...filtered.filter((o) => getKey(o) === selectedValue), ...filtered.filter((o) => getKey(o) !== selectedValue)];

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-xl border bg-white px-4 py-3 transition-colors ${
          open ? 'border-agent-accent' : DIVIDER
        }`}
      >
        <input
          value={open ? query : selectedOption ? getLabel(selectedOption) : ''}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setQuery('');
            setOpen(true);
          }}
          placeholder={placeholder}
          className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${INK} placeholder:${MUTED}`}
        />
        <LuSearch size={16} className={`flex-none ${MUTED}`} />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className={`absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border ${DIVIDER} bg-white shadow-lg`}
          >
            {sorted.length === 0 ? (
              <p className={`px-4 py-3 text-sm ${MUTED}`}>No matches.</p>
            ) : (
              <div className="overflow-y-auto" style={{ maxHeight: SELECT_LIST_MAX_HEIGHT }}>
                {sorted.map((option) => {
                  const key = getKey(option);
                  const checked = key === selectedValue;
                  const disabled = getDisabled?.(option);
                  const status = getStatus?.(option);
                  return (
                    <button
                      type="button"
                      key={key}
                      disabled={disabled}
                      onClick={() => {
                        onSelect(option);
                        setOpen(false);
                        setQuery('');
                      }}
                      className={`flex w-full items-center gap-2.5 border-b px-4 py-2.5 text-left last:border-b-0 ${DIVIDER} ${
                        disabled ? 'cursor-not-allowed opacity-50' : checked ? 'bg-agent-accent-soft/40' : 'hover:bg-agent-bg'
                      }`}
                    >
                      <span className={`min-w-0 flex-1 truncate text-sm ${INK}`}>{getLabel(option)}</span>
                      {status && <span className={`flex-none text-xs font-semibold ${MUTED}`}>{status}</span>}
                      <span
                        className={`flex h-4 w-4 flex-none items-center justify-center rounded-full border-2 ${
                          checked ? 'border-agent-accent bg-agent-accent' : `${DIVIDER} bg-white`
                        }`}
                      >
                        {checked && <LuCheck size={10} className="text-white" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Adults/Child counter row — both feed into one combined `pax` (the only
// headcount FD bookings actually support server-side, see bookingSchema in
// validation/schemas.js; there's no separate child fare here, unlike Custom
// FIT's paxAdults/paxChildren), so a child still counts toward pax the same
// as an adult. Matches the reference's two-row layout without inventing
// pricing this app doesn't have. `hint` is the reference's own age-range
// caption under the label ("Above 13 Years" / "From 02 - 12 Years") — purely
// descriptive, not enforced anywhere since this app has no per-traveler age field.
function PaxCounter({ label, hint, value, onChange, min = 0 }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className={`text-base font-bold ${INK}`}>{label}</div>
        {hint && <div className={`text-xs ${MUTED}`}>{hint}</div>}
      </div>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-agent-accent/30 text-agent-accent transition hover:border-agent-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <LuMinus size={15} strokeWidth={3} />
        </button>
        <span className={`w-6 text-center text-lg font-extrabold ${INK}`}>{String(value).padStart(2, '0')}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-agent-accent/30 text-agent-accent transition hover:border-agent-accent"
        >
          <LuPlus size={15} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

export default function DepartureDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [departure, setDeparture] = useState(null);
  const [error, setError] = useState('');

  const [departureDateId, setDepartureDateId] = useState('');
  // Departure city — one step ahead of picking a date, since a package can
  // run from more than one origin city (each fd_departure_dates row already
  // carries its own `location`). '' means "no city filter yet"; the first
  // date-picker render below seeds it to whichever city the earliest date
  // uses, same "first upcoming date wins" convention exLocation already used.
  const [selectedCity, setSelectedCity] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const pax = adults + children;
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  // Which add-on's "View Details" popup (AddonDetailModal) is open, if any
  // — one piece of state shared across every AddonSelect category box below
  // so opening one always closes any other.
  const [detailAddon, setDetailAddon] = useState(null);
  // Documented FD flow (Departure Details -> Traveler Details -> Confirm
  // Booking -> Payment): 'select' is this page's existing departure/pax/
  // add-ons form; 'travelers' is the new intermediate step below. Book Now
  // no longer books immediately — it only advances here, and the booking is
  // created (handleConfirmBooking) at the 'travelers' step instead.
  const [bookingStep, setBookingStep] = useState('select');
  // name/passportNo/roomShareGroup — the exact traveler shape the backend
  // already accepts (validation/schemas.js's bookingTravelerSchema, shared
  // with Admin Manual Booking) and the same three fields that flow's own
  // "Traveler details" step collects. `dob` is also in that schema but no
  // UI anywhere in this app has ever collected it — left alone here, not
  // newly invented.
  const [travelers, setTravelers] = useState([
    { name: '', passportNo: '', roomShareGroup: '' },
    { name: '', passportNo: '', roomShareGroup: '' },
  ]);
  const [travelerError, setTravelerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [bookingError, setBookingError] = useState('');
  // Booking terms card below — the admin-authored Terms & Conditions
  // document (TermsAndConditions.jsx / site_terms, one shared document
  // across every departure, not per-package content), fetched separately
  // from the departure itself since it comes off its own endpoint. null
  // while loading/unset so the card stays hidden rather than flashing empty.
  const [termsHtml, setTermsHtml] = useState(null);

  useEffect(() => {
    api
      .get(`/departures/${id}`)
      .then(({ departure: d }) => {
        setDeparture(d);
        setDepartureDateId(d.departureDates?.[0]?.id || '');
        setSelectedCity(d.departureDates?.[0]?.location || '');
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    api
      .get('/site-terms')
      .then(({ terms }) => setTermsHtml(terms?.body_html || ''))
      .catch(() => setTermsHtml('')); // no terms saved yet, or a transient error — card just stays hidden
  }, []);

  useEffect(() => {
    setTravelers((list) => {
      const next = list.slice(0, pax);
      while (next.length < pax) next.push({ name: '', passportNo: '', roomShareGroup: '' });
      return next;
    });
  }, [pax]);

  const cities = useMemo(
    () => [...new Set((departure?.departureDates || []).map((d) => d.location).filter(Boolean))],
    [departure]
  );
  const datesForCity = useMemo(
    () => (departure?.departureDates || []).filter((d) => !selectedCity || d.location === selectedCity),
    [departure, selectedCity]
  );
  // Switching city resets the date pick to that city's own first date —
  // the previously-selected date almost certainly doesn't belong to it.
  function handleSelectCity(city) {
    setSelectedCity(city);
    const firstForCity = (departure?.departureDates || []).find((d) => d.location === city);
    setDepartureDateId(firstForCity?.id || '');
  }

  const selectedDate = departure?.departureDates?.find((d) => d.id === departureDateId);
  const addonTotalPerPax = useMemo(
    () =>
      (departure?.addons || [])
        .filter((a) => selectedAddonIds.includes(a.id))
        .reduce((sum, a) => sum + a.pricePerPax, 0),
    [departure, selectedAddonIds]
  );
  const total = departure ? (departure.ratePerPax + addonTotalPerPax) * pax : 0;
  const seatsLeft = getSeatsLeft(departure?.departureDates);
  // Booking panel's own seats-left bar tracks the currently-selected date
  // specifically (not the header's package-wide max above) — falls back to
  // that max only before a date's actually been picked.
  const selectedSeatsLeft = selectedDate ? selectedDate.seatsLeft : seatsLeft;
  const selectedSeatsTotal = selectedDate?.seatsTotal ?? 0;
  const seatsFilledPct =
    selectedSeatsTotal > 0 ? Math.min(100, Math.max(0, ((selectedSeatsTotal - selectedSeatsLeft) / selectedSeatsTotal) * 100)) : 0;

  function toggleAddon(addonId) {
    setSelectedAddonIds((ids) => (ids.includes(addonId) ? ids.filter((i) => i !== addonId) : [...ids, addonId]));
  }

  // Step 1 (Departure Details) -> Step 2 (Traveler Details). Departure
  // date/pax/add-ons stay exactly as selected — same component, same state,
  // nothing gets reset by switching steps.
  function handleBookNowClick() {
    if (!departureDateId) return;
    setTravelerError('');
    setBookingStep('travelers');
  }

  function handleBackToDetails() {
    setTravelerError('');
    setBookingStep('select');
  }

  function updateTraveler(idx, field, value) {
    setTravelers((list) => list.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  }

  // Step 2 (Traveler Details) -> booking creation — unchanged API/payload
  // shape (POST /departures/:id/bookings), just now sending every traveler
  // field the schema already accepts instead of name alone, and only once
  // every traveler actually has a name (bookingTravelerSchema requires it
  // server-side too; this just fails fast with a clear message instead of a
  // generic 400).
  async function handleConfirmBooking() {
    if (travelers.some((t) => !t.name.trim())) {
      setTravelerError('Enter a name for every traveler.');
      return;
    }
    setTravelerError('');
    setBookingError('');
    setSubmitting(true);
    try {
      const { booking } = await api.post(`/departures/${id}/bookings`, {
        departureDateId,
        pax,
        addonIds: selectedAddonIds,
        travelers: travelers.map((t) => ({
          name: t.name.trim(),
          passportNo: t.passportNo.trim() || undefined,
          roomShareGroup: t.roomShareGroup.trim() || undefined,
        })),
      });
      setBookingResult(booking);
    } catch (err) {
      setBookingError(err.message || 'Unable to complete booking');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEnquireNow() {
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.set('date', selectedDate.date);
      params.set('pax', String(pax));
      const { whatsappLink } = await api.get(`/departures/${id}/enquire?${params.toString()}`);
      window.open(whatsappLink, '_blank', 'noopener');
    } catch (err) {
      setBookingError(err.message || 'Unable to build WhatsApp link');
    }
  }

  // No server-side itinerary PDF exists for FD departures (unlike Custom
  // FIT's package_requests, see ItineraryPrint.jsx/itineraryPdf.service.js)
  // — this uses the browser's own print/save-as-PDF instead, real and
  // working without a new backend pipeline. print:hidden throughout this
  // file hides the interactive-only chrome (gallery, tabs, booking panel,
  // buttons) so what prints is just the itinerary content.
  function handleDownloadItinerary() {
    window.print();
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <ErrorText>{error}</ErrorText>
      </div>
    );
  }
  if (!departure) {
    return <div className={`p-8 text-sm ${MUTED}`}>Loading…</div>;
  }

  // "2N Phuket | 2N Krabi" — each day's city comes from whichever item on
  // that day actually carries one (hotel items only), tallied in first-seen
  // order. See computeNightsByCity in shared/itinerary/index.js.
  const nightsByCity = computeNightsByCity(departure.itinerary);
  // Earliest upcoming departure's location (listDepartureDates orders by
  // date ascending) — the "Ex-{location}" badge next to the title.
  const exLocation = departure.departureDates?.[0]?.location;
  // Add-ons grouped by category (Activities/Tours/Transfers/Flights) for the
  // "Included tours, transfers & add-on activities" section below.
  const addonsByType = groupAddonsByType(departure.addons);
  // Which of those categories actually have add-ons — drives both the map()
  // below and whether that section's grid is allowed to go 2-column (only
  // when there's more than one to show; a lone category otherwise leaves an
  // empty second column next to it).
  const visibleAddonTypes = ADDON_CATEGORY_ORDER.filter((type) => addonsByType[type]?.length > 0);
  // Stay/Sightseeing stay derived straight from the itinerary (same as
  // before) — everything else in this row comes from the admin-curated
  // Inclusions list (InclusionExclusionList.jsx), minus whatever already
  // reads as "Accommodation" or "Activity" since those two concepts are
  // exactly what Stay/Sightseeing already show; a line like "Tour as per
  // itinerary" or "VISA" isn't covered by either tick, so it's shown
  // verbatim instead. Meals gets its own tick too, straight off whether the
  // package actually has any (departure.meals, same check MealsSummary uses).
  const ALREADY_SHOWN_INCLUSION_KEYWORDS = ['accommodation', 'activity'];
  const extraInclusionTicks = splitLines(departure.inclusions).filter(
    (line) => !ALREADY_SHOWN_INCLUSION_KEYWORDS.some((kw) => line.toLowerCase().includes(kw))
  );
  const tickItems = [
    itineraryHasItemType(departure.itinerary, 'hotel') && 'Stay Included',
    (itineraryHasItemType(departure.itinerary, 'tour') || itineraryHasItemType(departure.itinerary, 'activity')) &&
      'Sightseeing Included',
    ...extraInclusionTicks,
    departure.meals?.length > 0 && 'Meals Included',
  ].filter(Boolean);

  // A decorative tall photo below the booking panel, matching the
  // reference's own — reuses a real package photo (the carousel image after
  // the one already shown as the gallery's 2nd tile, so it doesn't just
  // repeat what's already visible up top) rather than inventing stock art.
  const sideImage = (departure.images || [])[2] || departure.heroImageUrl;

  return (
    <div className="min-h-screen bg-agent-bg">
      <div className="mx-auto w-full max-w-[1600px] p-5 lg:p-8 xl:p-10">
        <HeroGallery
          heroImageUrl={departure.heroImageUrl}
          images={departure.images}
          onBack={() => navigate('/agent/departures')}
        />

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.7fr_1fr]">
          <div className="space-y-6">
            {/* Basic details card */}
            <div className={`rounded-2xl border border-white bg-white p-5 shadow-sm sm:p-6`}>
              {/* items-stretch (not items-start) — the price box needs to
                  match whatever height the left column ends up (1 vs 2 rows
                  of tick badges isn't fixed), not just sit pinned to the top
                  at its own short natural height with dead space below it. */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className={`text-4xl font-extrabold leading-tight sm:text-5xl ${INK}`}>
                      {departure.title}
                    </h1>
                    {exLocation && (
                      <span className="inline-flex flex-none items-center gap-2 rounded-full border border-agent-accent/50 bg-white px-4 py-2 text-sm font-semibold text-agent-accent-dark">
                        <LuPlane size={16} className="flex-none" />
                        Ex : {exLocation}
                      </span>
                    )}
                  </div>
                  {(nightsByCity.length > 0 || departure.duration) && (
                    <div className="mt-3 flex items-center gap-3">
                      <span className={`flex-none text-sm font-semibold ${MUTED}`}>
                        {nightsByCity.length > 0 ? nightsByCity.map((c) => `${c.nights}N ${c.city}`).join(' | ') : departure.duration}
                      </span>
                      <span className="h-px flex-1 bg-agent-accent/50" />
                    </div>
                  )}
                  {tickItems.length > 0 && (
                    <div className="mt-4">
                      <TickBadges items={tickItems} />
                    </div>
                  )}
                </div>
                <div className="flex w-full flex-none flex-col justify-center rounded-xl bg-agent-accent-soft px-6 py-5 sm:w-auto">
                  <div className={`border-b ${DIVIDER} pb-2 text-sm font-medium ${MUTED}`}>Starting at</div>
                  <div className={`mt-2 border-b ${DIVIDER} pb-2 text-4xl font-extrabold ${INK}`}>{formatCurrency(departure.ratePerPax)}</div>
                  <div className={`mt-2 text-sm font-medium ${MUTED}`}>Per Person Double Occupancy</div>
                </div>
              </div>
            </div>

            <ItineraryOverviewTabs departure={departure} />

            <PackageDescription html={departure.shortDescription} />

            {departure.departureDates?.length > 0 && (
              <Card className="border-white rounded-2xl p-5 sm:p-6">
                <h3 className={`mb-4 text-base font-bold ${INK}`}>Departure Dates &amp; Availability</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4">
                  {departure.departureDates.map((d, i) => {
                    // Deterministic (unlike TickBadges' flex-wrap divider —
                    // this is a fixed-column CSS grid, so which cells start
                    // a row is known up front from the index alone, no DOM
                    // measurement needed): a left divider on every cell
                    // except the first in its row, at both the 2-col mobile
                    // and 4-col desktop breakpoint.
                    const mobileBorder = i % 2 !== 0;
                    const desktopBorder = i % 4 !== 0;
                    return (
                      <div
                        key={d.id}
                        className={`space-y-1.5 px-4 py-1 first:pl-0 border-agent-accent/40 ${mobileBorder ? 'border-l' : 'border-l-0'} ${desktopBorder ? 'sm:border-l' : 'sm:border-l-0'} ${i >= 2 ? 'mt-3 sm:mt-0' : ''}`}
                      >
                        <div className={`flex items-center gap-2 text-sm font-semibold ${INK}`}>
                          <LuCalendarCheck2 size={16} className="flex-none text-agent-accent-dark" />
                          {formatShortDate(d.date)}
                        </div>
                        {d.location && (
                          <div className={`flex items-center gap-2 text-sm ${MUTED}`}>
                            <LuPlane size={15} className="flex-none" />
                            Ex-{d.location}
                          </div>
                        )}
                        <span
                          className="inline-block rounded-md px-2.5 py-1 text-xs font-bold text-white"
                          style={{ background: d.seatsLeft > 0 ? SEATS_RED : '#94A3B8' }}
                        >
                          {d.seatsLeft > 0 ? `${d.seatsLeft} seats left` : 'Sold out'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {departure.itinerary?.length > 0 && <ItineraryTimeline itinerary={departure.itinerary} />}

            <InclusionsExclusionsSummary inclusions={departure.inclusions} exclusions={departure.exclusions} />

            <MealsSummary meals={departure.meals} />

            {departure.addons?.length > 0 && (
              <Card className="border-white rounded-2xl p-5 sm:p-6">
                <h3 className={`mb-3 text-base font-bold ${INK}`}>Add on : Activities, Day Tours &amp; Transfers</h3>
                {/* Same "don't force 2 columns you can't fill" fix as
                    InclusionsExclusionsSummary above — a package with add-ons
                    in only one category (e.g. Activities alone) used to still
                    get sm:grid-cols-2, leaving an empty second column next to
                    its one real category card. */}
                <div
                  className={`grid grid-cols-1 items-start gap-4 ${visibleAddonTypes.length > 1 ? 'sm:grid-cols-2' : ''}`}
                >
                  {visibleAddonTypes.map((type) => (
                    <AddonSelect
                      key={type}
                      type={type}
                      addons={addonsByType[type]}
                      selectedAddonIds={selectedAddonIds}
                      onToggle={toggleAddon}
                      onViewDetails={setDetailAddon}
                    />
                  ))}
                </div>
              </Card>
            )}

            {detailAddon && (
              <AddonDetailModal
                addon={detailAddon}
                selected={selectedAddonIds.includes(detailAddon.id)}
                onToggle={toggleAddon}
                onClose={() => setDetailAddon(null)}
              />
            )}

            {termsHtml && (
              <Card className="border-white rounded-2xl p-5 sm:p-6">
                <h3 className={`mb-3 text-base font-bold ${INK}`}>Booking terms</h3>
                {/* Admin-authored via TermsAndConditions.jsx's TipTap editor — no
                    @tailwindcss/typography plugin installed (see CmsPage.jsx's own
                    same note), so its headings/lists/etc. are hand-styled here via
                    child-element utility selectors instead of pulling in a second
                    new dependency alongside DOMPurify. */}
                <div
                  className={`text-sm leading-relaxed ${INK} [&_a]:text-agent-accent-dark [&_a]:underline [&_blockquote]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:${DIVIDER.replace('border-', 'border-')} [&_blockquote]:pl-3 [&_blockquote]:italic [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-1.5 [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-bold [&_hr]:my-4 [&_img]:max-w-full [&_img]:rounded-md [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_table]:w-full [&_table]:border-collapse [&_td]:p-2 [&_th]:p-2 [&_th]:font-semibold [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5`}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(termsHtml) }}
                />
              </Card>
            )}
          </div>

          {/* Booking panel — sticky so it stays in view while the left column
              scrolls. Gold top accent marks it as the one primary conversion
              surface on the page. print:hidden — nothing here belongs in a
              printed itinerary. */}
          <div className="lg:sticky lg:top-6 print:hidden">
            <Card className="border-white border-t-4 border-t-agent-accent shadow-xl shadow-black/10 rounded-2xl p-5 sm:p-6">
              {bookingResult ? (
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-agent-accent-dark">
                    Booking {bookingResult.status === 'waitlisted' ? 'waitlisted' : 'created'}!
                  </p>
                  <p className={INK}>Status: {bookingResult.status}</p>
                  <p className={INK}>Total: {formatCurrency(bookingResult.totalPrice)}</p>
                  {bookingResult.balanceDueDate && (
                    <p className={`text-xs ${MUTED}`}>
                      Balance due {new Date(bookingResult.balanceDueDate).toLocaleDateString()}
                    </p>
                  )}
                  {bookingResult.status === 'waitlisted' ? (
                    <Button variant="accent" className="w-full" onClick={() => navigate('/agent/dashboard')}>
                      Back to dashboard
                    </Button>
                  ) : (
                    <Button
                      variant="accent"
                      className="w-full"
                      onClick={() => navigate(`/agent/payments/${bookingResult.id}`)}
                    >
                      Continue to Payment
                    </Button>
                  )}
                </div>
              ) : bookingStep === 'travelers' ? (
                // Step 2 — Traveler Details (documented flow: Departure
                // Details -> Traveler Details -> Confirm Booking -> Payment).
                // Departure date/pax/add-ons above are untouched — this is the
                // same component/state, just a different render branch.
                <>
                  <div className={`mb-4 flex items-center justify-between border-b ${DIVIDER} pb-4`}>
                    <div>
                      <div className={`text-[10px] font-semibold uppercase tracking-wide ${MUTED}`}>Traveler details</div>
                      <div className={`text-base font-bold ${INK}`}>
                        {pax} {pax === 1 ? 'traveler' : 'travelers'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleBackToDetails}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-agent-accent-dark hover:underline"
                    >
                      <LuArrowLeft size={13} /> Back
                    </button>
                  </div>

                  <div className="mb-3 space-y-3">
                    {travelers.map((t, idx) => (
                      <div key={idx} className={`rounded-xl border ${DIVIDER} p-3`}>
                        <div className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${MUTED}`}>
                          Traveler {idx + 1}
                        </div>
                        <div className="space-y-1.5">
                          <TextInput
                            placeholder="Full name"
                            value={t.name}
                            onChange={(e) => updateTraveler(idx, 'name', e.target.value)}
                          />
                          <TextInput
                            placeholder="Passport No. (optional)"
                            value={t.passportNo}
                            onChange={(e) => updateTraveler(idx, 'passportNo', e.target.value)}
                          />
                          <TextInput
                            placeholder="Room share (optional)"
                            value={t.roomShareGroup}
                            onChange={(e) => updateTraveler(idx, 'roomShareGroup', e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={`my-3 space-y-1.5 border-t ${DIVIDER} pt-3 text-sm`}>
                    <div className="flex justify-between">
                      <span className={MUTED}>Net Rate ({formatCurrency(departure.ratePerPax)} × {pax} pax)</span>
                      <span className={`font-medium ${INK}`}>{formatCurrency(departure.ratePerPax * pax)}</span>
                    </div>
                    {selectedAddonIds.length > 0 && (
                      <div className="flex justify-between">
                        <span className={MUTED}>
                          Add On Activity ({selectedAddonIds.length} selected × {pax} pax)
                        </span>
                        <span className={`font-medium ${INK}`}>+ {formatCurrency(addonTotalPerPax * pax)}</span>
                      </div>
                    )}
                    <div className={`flex justify-between border-t ${DIVIDER} pt-1.5 text-base font-bold ${INK}`}>
                      <span>Total Estimate</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>

                  <ErrorText>{travelerError || bookingError}</ErrorText>

                  <Button
                    variant="accent"
                    className="mb-2 w-full gap-1.5 py-3 text-sm"
                    disabled={submitting}
                    onClick={handleConfirmBooking}
                  >
                    {submitting ? 'Booking…' : 'Confirm Booking'}
                  </Button>
                </>
              ) : (
                // Step 1 — Departure Details' own booking panel (departure
                // city/date, pax, add-ons already selected above in the left
                // column). Book Now no longer books directly — it only
                // advances to the Traveler Details step above.
                <>
                  <div className={`border-b ${DIVIDER} pb-2 text-sm ${MUTED}`}>Starting at</div>
                  <div className={`mt-2 border-b ${DIVIDER} pb-2 text-4xl font-extrabold ${INK}`}>
                    {formatCurrency(departure.ratePerPax)}
                  </div>
                  <div className={`mt-2 text-sm ${MUTED}`}>Per Person Double Occupancy</div>

                  <div className="mb-4 mt-4">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: SEATS_RED }}>
                      <span className="h-2 w-2 flex-none rounded-full" style={{ background: SEATS_RED }} />
                      {selectedSeatsLeft > 0 ? `${selectedSeatsLeft} Seats Left` : 'Sold out'}
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-agent-accent-soft">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${seatsFilledPct}%`, background: SEATS_RED }}
                      />
                    </div>
                  </div>

                  {cities.length > 0 && (
                    <div className="mb-3">
                      <SearchSelectDropdown
                        placeholder="Select Departure City"
                        options={cities}
                        selectedValue={selectedCity}
                        getKey={(city) => city}
                        getLabel={(city) => `Ex: ${city}`}
                        onSelect={handleSelectCity}
                      />
                    </div>
                  )}

                  <div className="mb-4">
                    <SearchSelectDropdown
                      placeholder="Select Departure Dates"
                      options={datesForCity}
                      selectedValue={departureDateId}
                      getKey={(d) => d.id}
                      getLabel={(d) => `${formatShortDate(d.date)} | ${d.seatsLeft > 0 ? d.seatsLeft : 0} Seats Left`}
                      getStatus={(d) => (d.seatsLeft <= 0 ? 'Sold Out' : null)}
                      getDisabled={(d) => d.seatsLeft <= 0}
                      onSelect={(d) => setDepartureDateId(d.id)}
                    />
                  </div>

                  <div className={`mb-3 space-y-2.5 border-t ${DIVIDER} pt-3`}>
                    <PaxCounter label="Adults" hint="Above 13 Years" value={adults} onChange={setAdults} min={1} />
                    <PaxCounter label="Child" hint="From 02 - 12 Years" value={children} onChange={setChildren} min={0} />
                  </div>

                  <div className={`my-3 space-y-1.5 border-t ${DIVIDER} pt-3 text-sm`}>
                    <div className="flex justify-between">
                      <span className={MUTED}>Net Rate ({formatCurrency(departure.ratePerPax)} × {pax} pax)</span>
                      <span className={`font-medium ${INK}`}>{formatCurrency(departure.ratePerPax * pax)}/-</span>
                    </div>
                    {selectedAddonIds.length > 0 && (
                      <div className="flex justify-between">
                        <span className={MUTED}>
                          Add On Activity ({selectedAddonIds.length} selected × {pax} pax)
                        </span>
                        <span className={`font-medium ${INK}`}>+ {formatCurrency(addonTotalPerPax * pax)}/-</span>
                      </div>
                    )}
                    <div className={`flex justify-between border-t ${DIVIDER} pt-1.5 text-base font-bold ${INK}`}>
                      <span>Total Estimate</span>
                      <span>{formatCurrency(total)}/-</span>
                    </div>
                  </div>

                  <ErrorText>{bookingError}</ErrorText>

                  <Button
                    variant="accent"
                    className="mb-2 w-full gap-1.5 !rounded-full py-3 text-sm"
                    disabled={!departureDateId}
                    onClick={handleBookNowClick}
                  >
                    Book Now <LuArrowRight size={15} />
                  </Button>
                  {/* !text-[#1B1B1B] (Tailwind's !important prefix — same escape
                      hatch FdPackageEditor.jsx's own Select overrides already
                      use) beats Button's default-variant text-agent-ink on
                      specificity alone; a plain unprefixed override loses
                      that fight since .text-agent-ink happens to compile
                      later in the stylesheet regardless of class order. Same
                      reason !rounded-full is needed to beat Button's own
                      base rounded-md. */}
                  <Button className="mb-2 w-full gap-1.5 !rounded-full !text-[#1B1B1B]" onClick={handleEnquireNow}>
                    <LuMessageCircle size={15} /> Enquire Now
                  </Button>
                  <Button className="w-full gap-1.5 !rounded-full !text-[#1B1B1B]" onClick={handleDownloadItinerary}>
                    <LuDownload size={15} /> Download Itinerary
                  </Button>
                </>
              )}
            </Card>

            {sideImage && (
              <div className="mt-6 hidden overflow-hidden rounded-2xl shadow-md shadow-black/10 lg:block">
                <img src={sideImage} alt="" className="h-80 w-full object-cover" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
