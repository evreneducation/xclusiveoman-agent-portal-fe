import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import {
  LuArrowLeft,
  LuArrowRight,
  LuBusFront,
  LuCalendarDays,
  LuCamera,
  LuCheck,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuCircleCheck,
  LuCircleX,
  LuClipboardList,
  LuClock,
  LuCompass,
  LuHotel,
  LuMap,
  LuMapPin,
  LuMessageCircle,
  LuPlane,
  LuPlaneLanding,
  LuPlaneTakeoff,
  LuPlus,
  LuSparkles,
  LuTicket,
  LuUtensils,
  LuX,
} from 'react-icons/lu';
import { api } from '../api/client.js';
import { Button, Card, Checkbox, ErrorText, Select, TextInput } from '../components/ui.jsx';
import { formatCurrency, formatShortDate, formatTime, getSeatsLeft } from '../../shared/fdPackage/index.js';
import { computeNightsByCity, ITINERARY_ITEM_TYPE_META, itineraryHasItemType } from '../../shared/itinerary/index.js';

// Booking terms card below — body_html is admin-authored (TermsAndConditions.jsx,
// GET /site-terms) but still passes through an untrusted-input boundary
// before ever reaching dangerouslySetInnerHTML: DOMPurify strips <script>,
// event-handler attributes, javascript: URLs, etc. Same "small,
// dependency-free sanitize-before-render" wrapper CmsPage.jsx already uses
// for its own admin-authored body_html.
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
// the package's carousel images on the right (FD packages require a minimum
// of 4 — see MIN_CAROUSEL_IMAGES in fdPackagesAdmin.controller.js — but a
// package can have more; a 2x2-visible, horizontally scrollable strip
// (overflow-x-auto) is how the rest become reachable instead of hard-capping
// at 4 and hiding them). Hovering a photo zooms/dims it slightly and clicking
// any photo (hero or grid) opens it full-screen in the Lightbox above.
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
          gap lines. gap-3 (vs. the previous gap-1.5) gives that daylight
          enough room to actually register at a glance. */}
      <div className="mb-6 grid h-48 grid-cols-2 grid-rows-1 gap-3 sm:h-64">
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
            className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-agent-ink shadow-lg transition hover:scale-105 hover:bg-slate-100"
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
              className="group h-full min-h-0 w-full min-w-0 cursor-zoom-in overflow-hidden rounded-2xl bg-slate-100 shadow-md shadow-black/10"
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

// Consistent section header — small accent icon chip + bold title — used
// across every content card below so the page reads as one designed system
// instead of a stack of generic boxes. `icon` is a react-icons component
// (e.g. LuHotel), not an emoji, matching FlightDetailsSection's own icon chip.
function SectionHeading({ icon: Icon, children }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-agent-accent-soft text-agent-accent-dark">
        <Icon size={16} />
      </span>
      <h3 className="text-sm font-bold uppercase tracking-wide text-agent-ink">{children}</h3>
    </div>
  );
}

// Read-only mirror of the admin's Flights section (FdPackageEditor.jsx) —
// `flights` is resolveFlightDetails' output (fdPackages.model.js): null
// whenever the package doesn't have a flight included directly (either no
// flights at all, or they're only offered as add-ons), in which case this
// renders nothing at all rather than an empty/placeholder card. Collapsible
// like every other section here, default open, framer-motion height/opacity
// animation instead of an abrupt show/hide.
function FlightDetailsSection({ flights }) {
  const [open, setOpen] = useState(true);
  if (!flights) return null;

  const legs = [
    {
      key: 'onward',
      label: 'Onward',
      Icon: LuPlaneTakeoff,
      data: flights.onward,
      // Blue rather than the site's gold accent — Return already uses gold
      // below, and the two legs read better with two distinct colors than
      // one leg colored and the other left in the (now-removed) pale-green
      // neutral fill.
      iconBg: 'bg-sky-100',
      iconColor: 'text-sky-700',
    },
    {
      key: 'return',
      label: 'Return',
      Icon: LuPlaneLanding,
      data: flights.return,
      iconBg: 'bg-agent-accent-soft',
      iconColor: 'text-agent-accent-dark',
    },
  ];

  return (
    <Card className="border-white rounded-2xl p-5 sm:p-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-agent-accent-soft text-agent-accent-dark">
            <LuPlane size={16} />
          </span>
          <h3 className="text-sm font-bold uppercase tracking-wide text-agent-ink">Flight Details</h3>
        </div>
        <LuChevronDown
          size={18}
          className={`flex-none text-agent-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
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
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-agent-line-light pt-4 sm:grid-cols-2">
              {legs.map(({ key, label, Icon, data, iconBg, iconColor }) => (
                <div key={key} className="rounded-xl bg-slate-50 px-4 py-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${iconBg} ${iconColor}`}
                    >
                      <Icon size={16} />
                    </span>
                    <span className="text-sm font-bold text-agent-ink">{label}</span>
                  </div>
                  <div className="text-sm font-semibold text-agent-ink">{data.name}</div>
                  <div className="mt-0.5 text-xs text-agent-muted">
                    {data.source} → {data.destination}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-agent-muted">
                    <LuClock size={13} className="flex-none" />
                    Departure: {formatShortDate(data.departureDate)}
                    {formatTime(data.departureTime) && ` at ${formatTime(data.departureTime)}`}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// Quick-glance tabbed summary below the Flights section — Hotel/Sightseeing/
// Meals/Transfer, one "Overview" panel visible at a time. Deliberately a
// lighter-weight teaser than the full sections further down the page
// (HotelInformation, ItineraryTimeline, MealsSummary): it doesn't replace
// them, it just gives the agent a fast first look before scrolling.
// Sightseeing pulls real tour/activity items straight off the itinerary — a
// day with neither simply isn't shown, nothing invented for it. Meals/
// Transfer only render a real, data-backed line ("Meals as per itinerary" /
// "Transfers included") when the package actually has one — there's no
// per-meal or per-transfer detail to summarize here (that's what the
// existing Meals section below is for), so this stays a flat yes/no read.
const OVERVIEW_TABS = [
  { key: 'hotel', label: 'Hotel', icon: LuHotel },
  { key: 'sightseeing', label: 'Sightseeing', icon: LuCamera },
  { key: 'meals', label: 'Meals', icon: LuUtensils },
  { key: 'transfer', label: 'Transfer', icon: LuBusFront },
];

function ItineraryOverviewTabs({ departure }) {
  const [activeTab, setActiveTab] = useState('hotel');

  const sightseeingItems = (departure.itinerary || [])
    .flatMap((day) => day.items || [])
    .filter((item) => item.type === 'tour' || item.type === 'activity');
  const hasMeals = (departure.meals || []).length > 0;
  const hasTransfers = itineraryHasItemType(departure.itinerary, 'transfer');

  return (
    <Card className="border-white rounded-2xl p-5 sm:p-6">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {OVERVIEW_TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                active
                  ? 'border-agent-accent bg-agent-accent-soft'
                  : 'border-agent-line-light bg-white hover:bg-slate-50'
              }`}
            >
              <span
                className={`flex h-9 w-9 flex-none items-center justify-center rounded-full border ${
                  active
                    ? 'border-agent-accent bg-white text-agent-ink-dark'
                    : 'border-agent-line-light bg-slate-50 text-agent-muted'
                }`}
              >
                <Icon size={16} />
              </span>
              <div>
                <div className="text-sm font-bold text-agent-ink">{label}</div>
                <div className="text-[11px] font-medium text-agent-accent-dark">Tap to view</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-4">
        {activeTab === 'hotel' && <HotelOverviewPanel hotel={departure.hotel} />}
        {activeTab === 'sightseeing' && <SightseeingOverviewPanel items={sightseeingItems} />}
        {activeTab === 'meals' && <MealsOverviewPanel hasMeals={hasMeals} />}
        {activeTab === 'transfer' && <TransferOverviewPanel hasTransfers={hasTransfers} />}
      </div>
    </Card>
  );
}

function HotelOverviewPanel({ hotel }) {
  if (!hotel) {
    return <p className="text-sm text-agent-muted">No hotel selected for this package.</p>;
  }
  return (
    <div>
      <div className="mb-3 text-sm font-bold text-agent-ink">Hotel Overview</div>
      <div className="max-w-xs overflow-hidden rounded-xl border border-agent-line-light bg-white shadow-sm">
        <div className="relative h-40 w-full bg-slate-100">
          {hotel.images?.[0] ? (
            <img src={hotel.images[0]} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-agent-muted">
              <LuHotel size={28} />
            </div>
          )}
          {hotel.category != null && (
            <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-bold text-agent-ink shadow-sm">
              {hotel.category} <span className="text-agent-accent">★</span>
            </span>
          )}
        </div>
        <div className="p-3">
          <div className="text-sm font-bold text-agent-ink">{hotel.name}</div>
          <div className="mt-1 flex items-center gap-1 text-xs text-agent-muted">
            <LuMapPin size={12} className="flex-none text-agent-accent-dark" /> {hotel.city || '—'}
          </div>
          {hotel.boardBasisOptions?.[0] && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-agent-ink">
                Meal: {hotel.boardBasisOptions[0]}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SightseeingOverviewPanel({ items }) {
  if (items.length === 0) {
    return <p className="text-sm text-agent-muted">No sightseeing included in this package.</p>;
  }
  return (
    <div>
      <div className="mb-3 text-sm font-bold text-agent-ink">Sightseeing Overview</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item, idx) => (
          <div
            key={`${item.type}:${item.id}:${idx}`}
            className="overflow-hidden rounded-xl border border-agent-line-light bg-white shadow-sm"
          >
            <div className="h-24 w-full bg-slate-100">
              {item.images?.[0] ? (
                <img src={item.images[0]} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-agent-muted">
                  <LuCamera size={20} />
                </div>
              )}
            </div>
            <div className="p-2.5">
              <div className="text-xs font-bold leading-snug text-agent-ink">{item.name || 'Untitled'}</div>
              {item.city && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-agent-muted">
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
      <div className="mb-2 text-sm font-bold text-agent-ink">Meals Overview</div>
      {hasMeals ? (
        <ul className="space-y-1 text-sm text-agent-ink">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-agent-ink-dark" />
            Meals as per itinerary
          </li>
        </ul>
      ) : (
        <p className="text-sm text-agent-muted">No meals included in this package.</p>
      )}
    </div>
  );
}

function TransferOverviewPanel({ hasTransfers }) {
  return (
    <div>
      <div className="mb-2 text-sm font-bold text-agent-ink">Transfer Overview</div>
      {hasTransfers ? (
        <ul className="space-y-1 text-sm text-agent-ink">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-agent-ink-dark" />
            Transfers included
          </li>
        </ul>
      ) : (
        <p className="text-sm text-agent-muted">No transfers included in this package.</p>
      )}
    </div>
  );
}

function HotelInformation({ hotel }) {
  if (!hotel) return null;
  return (
    <Card className="border-white rounded-2xl p-5 sm:p-6">
      <SectionHeading icon={LuHotel}>Hotel information</SectionHeading>
      <div className="flex flex-col gap-4 sm:flex-row">
        {hotel.images?.[0] && (
          <img
            src={hotel.images[0]}
            alt=""
            className="h-40 w-full flex-none rounded-xl border border-agent-line-light object-cover object-center shadow-sm sm:h-28 sm:w-44"
          />
        )}
        <div>
          <div className="text-sm font-bold text-agent-ink">{hotel.name}</div>
          <div className="mt-0.5 text-xs text-agent-muted">
            {[hotel.city, hotel.state].filter(Boolean).join(', ') || '—'} {hotel.category ? `· ${hotel.category}★` : ''}
          </div>
          {hotel.boardBasisOptions?.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {hotel.boardBasisOptions.map((b) => (
                <span key={b} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-agent-ink">
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {hotel.description && <p className="mt-3 text-sm leading-relaxed text-agent-ink">{hotel.description}</p>}
    </Card>
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

// Per-item-type icon chip color, local to this file only — deliberately not
// added to shared/itinerary/index.js's ITINERARY_ITEM_TYPE_META (that meta
// is reused by admin/team/agent pages that each have their own unrelated
// theme, e.g. admin's indigo/purple — a color baked in there would leak
// into all of them). Gives each expanded day's item rows some actual color
// variety instead of every single row sharing one flat pale-green fill.
const ITINERARY_ITEM_TYPE_CHIP = {
  hotel: 'bg-sky-50 text-sky-600',
  tour: 'bg-amber-50 text-amber-600',
  transfer: 'bg-violet-50 text-violet-600',
  activity: 'bg-rose-50 text-rose-600',
};

// Each day is its own collapsible row (default collapsed) rather than an
// always-expanded vertical timeline — matches the reference layout: a "Day
// N" pill + bold title, a +/× toggle on the right, and the day's full item
// list only mounted once expanded. Same framer-motion height/opacity
// animation as every other collapsible section on this page.
function ItineraryDayRow({ day }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-agent-line-light">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
      >
        <span className="flex-none rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-agent-ink-dark">
          Day {day.dayNumber}
        </span>
        <span className="flex-1 text-sm font-bold text-agent-ink">{dayTitle(day)}</span>
        <LuPlus
          size={16}
          className={`flex-none text-agent-muted transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
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
            <div className="border-t border-agent-line-light px-4 py-3">
              {day.items?.length > 0 ? (
                <div className="space-y-1">
                  {day.items.map((item, itemIdx) => {
                    const meta = ITINERARY_ITEM_TYPE_META[item.type];
                    const chip = ITINERARY_ITEM_TYPE_CHIP[item.type] || 'bg-slate-100 text-agent-ink-dark';
                    return (
                      <div
                        key={`${item.type}:${item.id}:${itemIdx}`}
                        className="flex items-start gap-2.5 rounded-md border border-agent-line-light bg-white px-2.5 py-2"
                      >
                        <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-md text-xs ${chip}`}>
                          {meta?.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] font-semibold text-agent-ink">
                            {item.name || meta?.label || 'Item'}
                            {item.city ? ` · ${item.city}` : ''}
                          </span>
                          {item.type === 'hotel' && item.adults != null && (
                            <p className="mt-0.5 text-[11px] text-agent-muted">
                              {item.adults} {item.adults === 1 ? 'adult' : 'adults'} · {item.rooms} {item.rooms === 1 ? 'room' : 'rooms'}
                            </p>
                          )}
                          {item.note && <p className="mt-0.5 text-[11px] text-agent-muted">{item.note}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-agent-muted">Nothing planned yet.</p>
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
      <SectionHeading icon={LuMap}>Day-by-day itinerary</SectionHeading>
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
          <div key={meal.type} className="flex items-center justify-between rounded-xl border border-agent-line-light px-3.5 py-2.5">
            <div>
              <div className="text-sm font-semibold text-agent-ink">{meal.label}</div>
              <div className="text-xs text-agent-muted">
                {meal.people} {meal.people === 1 ? 'person' : 'people'} · {meal.days} {meal.days === 1 ? 'day' : 'days'} ·{' '}
                {formatCurrency(meal.pricePerDay)}/person/day
              </div>
            </div>
            <div className="text-sm font-bold text-agent-ink">{formatCurrency(meal.cost)}</div>
          </div>
        ))}
      </div>
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

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {inclusionLines.length > 0 && (
        <Card className="border-white rounded-2xl p-5 sm:p-6">
          <SectionHeading icon={LuCircleCheck}>Inclusions</SectionHeading>
          <ul className="list-disc space-y-1 pl-5 text-sm text-agent-ink">
            {inclusionLines.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </Card>
      )}
      {exclusionLines.length > 0 && (
        <Card className="border-white rounded-2xl p-5 sm:p-6">
          <SectionHeading icon={LuCircleX}>Exclusions</SectionHeading>
          <ul className="list-disc space-y-1 pl-5 text-sm text-agent-ink">
            {exclusionLines.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// Category heading + icon per add-on `type` (departures.controller.js's
// getDeparture derives this from whichever of activity_id/tour_id/
// transfer_id/flight_id is set on the fd_addons row) — fixed display order
// regardless of what order the API happens to return them in, so the
// section always reads Activities -> Tours -> Transfers -> Flights.
const ADDON_CATEGORY_META = {
  activity: { label: 'Activities', icon: LuSparkles },
  tour: { label: 'Tours', icon: LuCompass },
  transfer: { label: 'Transfers', icon: LuBusFront },
  flight: { label: 'Flights', icon: LuPlane },
};
const ADDON_CATEGORY_ORDER = ['activity', 'tour', 'transfer', 'flight'];

function groupAddonsByType(addons) {
  const groups = {};
  for (const addon of addons || []) {
    const type = addon.type || 'activity';
    (groups[type] ||= []).push(addon);
  }
  return groups;
}

// One collapsible category (e.g. "Tours (2)") inside the Add-ons card below
// — click the heading to reveal that category's own selectable add-ons,
// same collapsible/framer-motion pattern as every other section on this page.
function AddonCategorySection({ type, addons, selectedAddonIds, onToggle }) {
  const [open, setOpen] = useState(false);
  const meta = ADDON_CATEGORY_META[type] || { label: 'Other', icon: LuTicket };
  const Icon = meta.icon;
  const selectedCount = addons.filter((a) => selectedAddonIds.includes(a.id)).length;

  return (
    <div className="overflow-hidden rounded-xl border border-agent-line-light">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
      >
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-agent-accent-soft text-agent-accent-dark">
          <Icon size={16} />
        </span>
        <span className="flex-1 text-sm font-bold text-agent-ink">
          {meta.label} <span className="font-normal text-agent-muted">({addons.length})</span>
        </span>
        {selectedCount > 0 && (
          <span className="flex-none rounded-full bg-agent-accent-soft px-2 py-0.5 text-[10px] font-semibold text-agent-accent-dark">
            {selectedCount} selected
          </span>
        )}
        <LuChevronDown
          size={16}
          className={`flex-none text-agent-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
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
            <div className="space-y-2 border-t border-agent-line-light px-4 py-3">
              {addons.map((addon) => (
                <div
                  key={addon.id}
                  className={`rounded-xl border px-3.5 py-2.5 transition-colors ${
                    selectedAddonIds.includes(addon.id)
                      ? 'border-agent-accent bg-agent-accent-soft/50'
                      : 'border-agent-line-light hover:bg-slate-50'
                  }`}
                >
                  <Checkbox
                    checked={selectedAddonIds.includes(addon.id)}
                    onChange={() => onToggle(addon.id)}
                    label={addon.name}
                    hint={`+ ${formatCurrency(addon.pricePerPax)} pp`}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DepartureDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [departure, setDeparture] = useState(null);
  const [error, setError] = useState('');

  const [departureDateId, setDepartureDateId] = useState('');
  const [pax, setPax] = useState(2);
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  // Documented FD flow (Departure Details -> Traveler Details -> Confirm
  // Booking -> Payment): 'select' is this page's existing departure/pax/
  // add-ons form; 'travelers' is the new intermediate step below. Book Now
  // no longer books immediately — it only advances here, and the booking is
  // created (handleConfirmBooking) at the 'travelers' step instead.
  const [bookingStep, setBookingStep] = useState('select');
  // name/passportNo/roomShareGroup — the exact traveler shape the backend
  // already accepts (validation/schemas.js's bookingTravelerSchema, shared
  // with Admin Manual Booking) and the same three fields that flow's own
  // "Traveler details" step collects (wireframe Screen 22: Name / Passport
  // No. / Room share). `dob` is also in that schema but no UI anywhere in
  // this app has ever collected it (PackageBuilder's own TravelersEditor
  // doesn't either) — left alone here, not newly invented.
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

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <ErrorText>{error}</ErrorText>
      </div>
    );
  }
  if (!departure) {
    return <div className="p-8 text-sm text-agent-muted">Loading…</div>;
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

  return (
    <div className="mx-auto w-full max-w-[1600px] p-5 lg:p-8 xl:p-10">
      <HeroGallery
        heroImageUrl={departure.heroImageUrl}
        images={departure.images}
        onBack={() => navigate('/agent/departures')}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          {/* Basic details card */}
          <div className="rounded-2xl border border-white bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold leading-tight text-agent-ink sm:text-3xl">{departure.title}</h1>
                  {exLocation && (
                    <span className="rounded-md bg-agent-accent-soft px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-agent-accent-dark">
                      Ex-{exLocation}
                    </span>
                  )}
                </div>
                {nightsByCity.length > 0 && (
                  <p className="mt-1.5 text-sm text-agent-muted">
                    {nightsByCity.map((c) => `${c.nights}N ${c.city}`).join(' | ')}
                  </p>
                )}
                {tickItems.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-agent-line-light pt-4">
                    {tickItems.map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-agent-ink"
                      >
                        <LuCheck size={13} className="flex-none text-agent-ink-dark" /> {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-none rounded-xl bg-agent-accent-soft px-5 py-4 text-right">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-agent-muted">Starting at</div>
                <div className="text-2xl font-bold text-agent-ink">{formatCurrency(departure.ratePerPax)}</div>
                <div className="text-xs text-agent-muted">per person</div>
              </div>
            </div>
          </div>

          <FlightDetailsSection flights={departure.flights} />

          <ItineraryOverviewTabs departure={departure} />

          {departure.departureDates?.length > 0 && (
            <Card className="border-white rounded-2xl p-5 sm:p-6">
              <SectionHeading icon={LuCalendarDays}>Departure dates &amp; availability</SectionHeading>
              <div className="flex flex-wrap gap-2">
                {departure.departureDates.map((d) => (
                  <span
                    key={d.id}
                    className={`rounded-full border px-3.5 py-2 text-xs font-semibold ${
                      d.seatsLeft > 0
                        ? 'border-agent-accent/30 bg-agent-accent-soft text-agent-ink'
                        : 'border-agent-line-light bg-slate-100 text-agent-muted'
                    }`}
                  >
                    {formatShortDate(d.date)}
                    {d.location && ` · Ex-${d.location}`} ·{' '}
                    {d.seatsLeft > 0 ? `${d.seatsLeft} seats left` : 'Sold out'}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {departure.itinerary?.length > 0 && <ItineraryTimeline itinerary={departure.itinerary} />}

          <MealsSummary meals={departure.meals} />

          <InclusionsExclusionsSummary inclusions={departure.inclusions} exclusions={departure.exclusions} />

          <HotelInformation hotel={departure.hotel} />

          {departure.addons?.length > 0 && (
            <Card className="border-white rounded-2xl p-5 sm:p-6">
              <SectionHeading icon={LuTicket}>Included tours, transfers &amp; add-on activities</SectionHeading>
              <div className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2">
                {ADDON_CATEGORY_ORDER.filter((type) => addonsByType[type]?.length > 0).map((type) => (
                  <AddonCategorySection
                    key={type}
                    type={type}
                    addons={addonsByType[type]}
                    selectedAddonIds={selectedAddonIds}
                    onToggle={toggleAddon}
                  />
                ))}
              </div>
            </Card>
          )}

          {termsHtml && (
            <Card className="border-white rounded-2xl p-5 sm:p-6">
              <SectionHeading icon={LuClipboardList}>Booking terms</SectionHeading>
              {/* Admin-authored via TermsAndConditions.jsx's TipTap editor — no
                  @tailwindcss/typography plugin installed (see CmsPage.jsx's own
                  same note), so its headings/lists/etc. are hand-styled here via
                  child-element utility selectors instead of pulling in a second
                  new dependency alongside DOMPurify. */}
              <div
                className="text-sm leading-relaxed text-agent-ink [&_a]:text-agent-accent-dark [&_a]:underline [&_blockquote]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:border-agent-line-light [&_blockquote]:pl-3 [&_blockquote]:italic [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-1.5 [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-bold [&_hr]:my-4 [&_hr]:border-agent-line-light [&_img]:max-w-full [&_img]:rounded-md [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-agent-line-light [&_td]:p-2 [&_th]:border [&_th]:border-agent-line-light [&_th]:p-2 [&_th]:font-semibold [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(termsHtml) }}
              />
            </Card>
          )}
        </div>

        {/* Booking panel — sticky so it stays in view while the left column scrolls */}
        <div className="lg:sticky lg:top-6">
          <Card className="border-white shadow-lg shadow-black/5 rounded-2xl p-5 sm:p-6">
            {bookingResult ? (
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-agent-ink-dark">
                  Booking {bookingResult.status === 'waitlisted' ? 'waitlisted' : 'created'}!
                </p>
                <p>Status: {bookingResult.status}</p>
                <p>Total: {formatCurrency(bookingResult.totalPrice)}</p>
                {bookingResult.balanceDueDate && (
                  <p className="text-xs text-agent-muted">
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
                <div className="mb-4 flex items-center justify-between border-b border-agent-line-light pb-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-agent-muted">Traveler details</div>
                    <div className="text-base font-bold text-agent-ink">
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
                    <div key={idx} className="rounded-xl border border-agent-line-light p-3">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-agent-muted">
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

                <div className="my-3 space-y-1.5 rounded-xl bg-slate-50 px-3.5 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-agent-muted">Net rate ({formatCurrency(departure.ratePerPax)} × {pax} pax)</span>
                    <span className="font-medium text-agent-ink">{formatCurrency(departure.ratePerPax * pax)}</span>
                  </div>
                  {selectedAddonIds.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-agent-muted">
                        Add-ons ({selectedAddonIds.length} selected × {pax} pax)
                      </span>
                      <span className="font-medium text-agent-ink">+ {formatCurrency(addonTotalPerPax * pax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-agent-line-light pt-1.5 text-base font-bold text-agent-ink">
                    <span>Total</span>
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
              // date, pax, add-ons already selected above in the left
              // column). Book Now no longer books directly — it only
              // advances to the Traveler Details step above.
              <>
                <div className="mb-4 flex items-end justify-between border-b border-agent-line-light pb-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-agent-muted">Starting at</div>
                    <div className="text-2xl font-bold text-agent-ink">
                      {formatCurrency(departure.ratePerPax)}
                      <span className="text-sm font-normal text-agent-muted"> / pax</span>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      seatsLeft > 0 ? 'bg-agent-accent-soft text-agent-accent-dark' : 'bg-slate-100 text-agent-muted'
                    }`}
                  >
                    {seatsLeft > 0 ? `${seatsLeft} seats left` : 'Sold out'}
                  </span>
                </div>

                <div className="mb-3">
                  <div className="mb-1 text-xs font-semibold text-agent-muted">Departure date</div>
                  <Select value={departureDateId} onChange={(e) => setDepartureDateId(e.target.value)}>
                    {(departure.departureDates || []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {new Date(d.date).toLocaleDateString()}
                        {d.location && ` · Ex-${d.location}`} · {d.seatsLeft > 0 ? `${d.seatsLeft} seats left` : 'sold out — waitlist'}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="mb-3">
                  <div className="mb-1 text-xs font-semibold text-agent-muted">Pax</div>
                  <TextInput
                    type="number"
                    min={1}
                    max={20}
                    value={pax}
                    onChange={(e) => setPax(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>

                <div className="my-3 space-y-1.5 rounded-xl bg-slate-50 px-3.5 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-agent-muted">Net rate ({formatCurrency(departure.ratePerPax)} × {pax} pax)</span>
                    <span className="font-medium text-agent-ink">{formatCurrency(departure.ratePerPax * pax)}</span>
                  </div>
                  {selectedAddonIds.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-agent-muted">
                        Add-ons ({selectedAddonIds.length} selected × {pax} pax)
                      </span>
                      <span className="font-medium text-agent-ink">+ {formatCurrency(addonTotalPerPax * pax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-agent-line-light pt-1.5 text-base font-bold text-agent-ink">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>

                <ErrorText>{bookingError}</ErrorText>

                <Button
                  variant="accent"
                  className="mb-2 w-full gap-1.5 py-3 text-sm"
                  disabled={!departureDateId}
                  onClick={handleBookNowClick}
                >
                  Book Now <LuArrowRight size={15} />
                </Button>
                <Button className="mb-3 w-full gap-1.5" onClick={handleEnquireNow}>
                  <LuMessageCircle size={15} /> Enquire Now
                </Button>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
