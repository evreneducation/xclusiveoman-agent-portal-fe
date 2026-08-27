import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuBuilding2, LuCalendarDays, LuPlaneTakeoff, LuSparkles, LuStar } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Card, Checkbox, ErrorText, Select, TextInput } from '../components/ui.jsx';
import { getFdBadges } from '../../shared/fdPackage/index.js';

// "October 2026 - November 2026" — full month names (unlike the shared
// formatDateRange in ../../shared/fdPackage/index.js, which abbreviates to
// "Oct 2026" for DepartureDetail.jsx's tighter layout). Kept local to this
// card rather than changing that shared helper's output for every existing
// caller.
function formatMonthRange(dates) {
  if (!dates || dates.length === 0) return null;
  const sorted = [...dates].sort();
  const fmt = (iso) => new Date(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const from = fmt(sorted[0]);
  const to = fmt(sorted[sorted.length - 1]);
  return from === to ? from : `${from} - ${to}`;
}

const PRICE_BANDS = [
  { label: 'Any price', min: 0, max: Infinity },
  { label: 'Under ₹15,000', min: 0, max: 15000 },
  { label: '₹15,000 – ₹30,000', min: 15000, max: 30000 },
  { label: '₹30,000 – ₹50,000', min: 30000, max: 50000 },
  { label: 'Above ₹50,000', min: 50000, max: Infinity },
];

// Solid-fill premium badges for the card's image overlay — deliberately not
// the shared `Badge` component (../components/ui.jsx), which is a soft
// pale-pill treatment reused everywhere else in the portal (Bookings,
// Reviews, …). These sit directly on a dark photo/placeholder instead of a
// white card body, so they need real contrast — a solid gold/emerald/rose
// fill with white text — rather than that soft-pill look. Scoped to this one
// card only; ../components/ui.jsx itself is untouched, so nothing else in
// the portal is affected.
const CARD_BADGE_TONE = {
  amber: 'bg-agent-accent text-white',
  green: 'bg-emerald-500 text-white',
  red: 'bg-rose-600 text-white',
};

function CardBadge({ tone, children }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${
        CARD_BADGE_TONE[tone] || 'bg-slate-700 text-white'
      }`}
    >
      {children}
    </span>
  );
}

function DepartureCard({ d }) {
  const nextDate = d.nextDepartures?.[0];
  const seatsLeft = nextDate?.seatsLeft ?? 0;
  const seatsTotal = nextDate?.seatsTotal ?? 0;
  const isSoldOut = Boolean(nextDate) && seatsLeft <= 0;
  const seatsPct = seatsTotal > 0 ? Math.min(100, Math.max(0, (seatsLeft / seatsTotal) * 100)) : 0;

  // Sold Out is its own large centered ribbon over the image (below), not a
  // corner pill — Featured/Bestseller keep the small corner-badge treatment,
  // only shown when the package isn't sold out (matches the reference: the
  // sold-out card shows nothing but the ribbon).
  const badges = isSoldOut ? [] : getFdBadges(d);

  const monthRange = formatMonthRange((d.nextDepartures || []).map((nd) => nd.date));
  // "4N Thailand Getaway" — duration + destination, the reference card's
  // subtitle line under the title. Falls back to whichever piece the
  // package/listing actually has rather than needing a second fetch — the
  // listing endpoint (departures.controller.js#listDepartures) already
  // resolves destination (from the primary hotel's city) and flights/
  // hotelCategory alongside it, so every field this card needs comes back
  // in the one /departures request.
  const subtitle = [d.duration, d.destination].filter(Boolean).join(' ') + (d.destination ? ' Getaway' : '');

  return (
    // `group` on the Link itself so hover transitions read as one
    // coordinated gesture. Still fully clickable when sold out — an agent
    // may still want the detail page to check other departure dates.
    <Link to={`/agent/departures/${d.id}`} className="group block">
      <div
        className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm shadow-black/5 transition-all duration-300 ${
          isSoldOut
            ? 'border-agent-muted/30'
            : 'border-agent-line-light group-hover:-translate-y-1 group-hover:border-agent-accent/40 group-hover:shadow-xl group-hover:shadow-black/10'
        }`}
      >
        <div className="relative aspect-[4/3] flex-none overflow-hidden bg-[linear-gradient(135deg,#0B1130_0%,#181f45_100%)]">
          {d.heroImageUrl ? (
            <img
              src={d.heroImageUrl}
              alt=""
              className={`h-full w-full object-cover transition-transform duration-500 ease-out ${
                isSoldOut ? 'grayscale' : 'group-hover:scale-110'
              }`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-white/40">
              No cover image
            </div>
          )}
          {/* Sold-out packages get a permanent dark wash instead of the
              usual hover-only scrim, so the "unavailable" read holds even
              before the pointer arrives. */}
          <div
            className={`pointer-events-none absolute inset-0 ${
              isSoldOut ? 'bg-black/40' : 'bg-gradient-to-t from-black/30 via-transparent to-transparent'
            }`}
          />
          {isSoldOut ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-lg bg-[#EF4A3D] px-8 py-2.5 text-lg font-extrabold text-white shadow-lg">
                Sold Out
              </span>
            </div>
          ) : (
            badges.length > 0 && (
              <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <CardBadge key={b.label} tone={b.tone}>
                    {b.label}
                  </CardBadge>
                ))}
              </div>
            )
          )}
        </div>

        <div className="flex flex-col p-4">
          {/* Neutral warm-gray divider/subtitle instead of agent-line-light /
              agent-muted — both tokens still carry the portal's old teal
              tint (#D7EAE5 / #5F7D79), which read as an odd blue-green cast
              on the package name's own divider and the subtitle right under
              it. Scoped to just these two spots rather than swapping the
              tokens everywhere in the card. */}
          <div
            className={`border-b pb-2.5 font-serif text-xl font-bold leading-snug ${isSoldOut ? 'border-agent-line-light text-agent-muted' : 'border-agent-line-light text-agent-ink-dark'}`}
          >
            {d.title}
          </div>
          <div className={`mt-2.5 text-sm ${isSoldOut ? 'text-agent-muted/70' : 'text-agent-muted'}`}>{subtitle}</div>

          <div className={`mt-2.5 space-y-1.5 text-xs ${isSoldOut ? 'text-agent-muted/60' : 'text-agent-ink'}`}>
            {monthRange && (
              <div className="flex items-center gap-2">
                <LuCalendarDays size={13} className="flex-none" />
                {monthRange}
              </div>
            )}
            {d.flights ? (
              <div className="flex items-center gap-2">
                <LuPlaneTakeoff size={13} className="flex-none" />
                From {d.flights.onward.source}
                {d.flights.onward.name && ` | ${d.flights.onward.name} Flight`}
              </div>
            ) : d.theme ? (
              // No flights on this package — show the theme instead of
              // dropping the row (keeps every card in the grid the same row
              // count/height), a real package attribute rather than a
              // placeholder "not included" message.
              <div className="flex items-center gap-2">
                <LuSparkles size={13} className="flex-none" />
                {d.theme} Theme
              </div>
            ) : d.rating ? (
              <div className="flex items-center gap-2">
                <LuStar size={13} className="flex-none" />
                {Number(d.rating).toFixed(1)} Rating{d.reviewCount != null && ` (${d.reviewCount} reviews)`}
              </div>
            ) : null}
            {d.hotelCategory && (
              <div className="flex items-center gap-2">
                <LuBuilding2 size={13} className="flex-none" />
                {d.hotelCategory} Star Hotel
              </div>
            )}
          </div>

          {nextDate && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold">
                <span className={`flex items-center gap-1.5 ${isSoldOut ? 'text-agent-muted' : 'text-agent-ink-dark'}`}>
                  <span className={`h-2 w-2 rounded-full ${isSoldOut ? 'bg-agent-muted' : 'bg-[#EF4A3D]'}`} />
                  {isSoldOut ? '0 Seats Left' : `${seatsLeft} Seats Left`}
                </span>
                <span className="text-agent-muted">{seatsTotal} Total</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-agent-panel">
                <div
                  className={`h-full rounded-full ${isSoldOut ? '' : 'bg-[#EF4A3D]'}`}
                  style={{ width: `${isSoldOut ? 0 : seatsPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex items-end justify-between">
            <div>
              <div className="text-[11px] font-medium text-agent-muted">Starting at</div>
              <div className={`text-xl font-extrabold ${isSoldOut ? 'text-agent-muted' : 'text-agent-ink-dark'}`}>
                {d.ratePerPax != null ? `${Number(d.ratePerPax).toLocaleString('en-IN')}/-` : 'On request'}
              </div>
            </div>
            <span
              className={`flex-none rounded-full px-5 py-2.5 text-xs font-bold transition-colors ${
                isSoldOut
                  ? 'bg-gray-400 text-white'
                  : 'bg-agent-accent text-white shadow-sm shadow-agent-accent/30 group-hover:bg-agent-accent-dark'
              }`}
            >
              View Details
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Departures() {
  const [departures, setDepartures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [destination, setDestination] = useState('');
  const [duration, setDuration] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [priceBand, setPriceBand] = useState(0);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [bestsellerOnly, setBestsellerOnly] = useState(false);
  const [flashDealsOnly, setFlashDealsOnly] = useState(false);

  // The Fixed Group Departures listing shows only Published packages —
  // GET /departures already defaults to status=published server-side.
  useEffect(() => {
    setLoading(true);
    api
      .get('/departures')
      .then(({ departures: list }) => setDepartures(list))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const destinations = useMemo(
    () => [...new Set(departures.map((d) => d.destination).filter(Boolean))].sort(),
    [departures]
  );
  const durations = useMemo(
    () => [...new Set(departures.map((d) => d.duration).filter(Boolean))].sort(),
    [departures]
  );

  const filtered = useMemo(() => {
    const band = PRICE_BANDS[priceBand];
    const q = search.trim().toLowerCase();
    return departures.filter((d) => {
      if (q && !`${d.title} ${d.theme || ''} ${d.destination || ''}`.toLowerCase().includes(q)) return false;
      if (destination && d.destination !== destination) return false;
      if (duration && d.duration !== duration) return false;
      if (dateFrom && !(d.nextDepartures || []).some((nd) => nd.date >= dateFrom)) return false;
      const rate = Number(d.ratePerPax) || 0;
      if (rate < band.min || rate > band.max) return false;
      if (featuredOnly && !d.isFeatured) return false;
      if (bestsellerOnly && !d.isBestseller) return false;
      if (flashDealsOnly && !d.flashDeal) return false;
      return true;
    });
  }, [departures, search, destination, duration, dateFrom, priceBand, featuredOnly, bestsellerOnly, flashDealsOnly]);

  return (
    <div className="min-h-screen bg-agent-bg">
      {/* Flat cream canvas, no dark banner — the reference design's heading
          sits directly on the page background rather than a floating card
          pulled up over a separate hero block. */}
      <div className="mx-auto max-w-6xl px-5 pb-10 pt-8 lg:px-8">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-agent-accent-dark">
          <span className="h-px w-6 bg-agent-accent-dark" /> Curated Departures
        </div>
        <h2 className="font-serif text-4xl font-bold leading-tight text-agent-ink-dark sm:text-5xl">
          Fixed Group <span className="italic text-agent-accent-dark">Departure</span>
        </h2>
        <p className="mt-3 max-w-xl text-sm text-agent-muted">
          Net rate is calculated from each package's day-by-day itinerary. Featured and Bestseller packages are set
          by Xclusive Oman.
        </p>

        <div className="mt-6">
          <Card className="border-agent-line-light shadow-md shadow-black/5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <TextInput
                  placeholder="Search by name, theme, or destination…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={destination} onChange={(e) => setDestination(e.target.value)}>
                <option value="">All destinations</option>
                {destinations.map((dest) => (
                  <option key={dest} value={dest}>
                    {dest}
                  </option>
                ))}
              </Select>
              <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
                <option value="">Any duration</option>
                {durations.map((dur) => (
                  <option key={dur} value={dur}>
                    {dur}
                  </option>
                ))}
              </Select>
              <TextInput
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                title="Departing on or after"
              />
              <Select value={priceBand} onChange={(e) => setPriceBand(Number(e.target.value))}>
                {PRICE_BANDS.map((b, i) => (
                  <option key={b.label} value={i}>
                    {b.label}
                  </option>
                ))}
              </Select>
              <div className="flex flex-wrap items-center gap-4 lg:col-span-2">
                <Checkbox checked={featuredOnly} onChange={setFeaturedOnly} label="Featured only" />
                <Checkbox checked={bestsellerOnly} onChange={setBestsellerOnly} label="Bestseller only" />
                <Checkbox checked={flashDealsOnly} onChange={setFlashDealsOnly} label="Flash Deals only" />
              </div>
            </div>
          </Card>
        </div>

        <div className="pt-6">
          <ErrorText>{error}</ErrorText>
          {loading && <p className="text-sm text-agent-muted">Loading departures…</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-agent-muted">No departures match those filters.</p>
          )}

          {/* auto-fill/minmax instead of a fixed 3-column breakpoint split —
              a fixed lg:grid-cols-3 stretches each card to fill 1/3 of the
              (wide) content column, squashing the card's height:width ratio
              into something noticeably wider/shorter than the reference.
              Capping each column at 270px keeps cards the reference's own
              tall, narrow proportions no matter how wide the viewport is;
              more columns simply appear instead of wider ones. */}
          <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
            {filtered.map((d) => (
              <DepartureCard key={d.id} d={d} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
