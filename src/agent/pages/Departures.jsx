import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuArrowRight, LuPlaneTakeoff } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Card, Checkbox, ErrorText, Select, StarRating, TextInput } from '../components/ui.jsx';
import { formatCurrency, formatShortDate, getFdBadges, getSeatsLeft } from '../../shared/fdPackage/index.js';

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
  const seatsLeft = getSeatsLeft(d.nextDepartures);
  const badges = getFdBadges(d);
  const isFeatured = badges.some((b) => b.tone === 'amber');

  return (
    // `group` on the Link itself (rather than the div below) so every
    // hover-driven child transition — image zoom, gradient overlay, title
    // color, border/shadow, the arrow's forward nudge — reads as one
    // coordinated "the whole card is reacting" gesture instead of separate
    // pieces animating on their own.
    // No h-full/flex-1/mt-auto height-stretching below — the grid this
    // renders into uses items-start (see the grid className further down),
    // so each card is only ever as tall as its own content. A card without
    // flight details (mt-auto's job used to be "reach down to match the
    // tallest sibling in the row") no longer needs to reach anywhere; it's
    // simply a shorter card, rather than a same-height card with a big dead
    // gap between its date line and its footer.
    <Link to={`/agent/departures/${d.id}`} className="group block">
      <div
        className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-md shadow-black/5 transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-2xl group-hover:shadow-agent-ink/15 ${
          isFeatured
            ? 'border-agent-accent/50 ring-1 ring-agent-accent/30 group-hover:ring-agent-accent/70'
            : 'border-agent-line-light group-hover:border-agent-accent/40'
        }`}
      >
        {/* Dark navy placeholder (matching the hero's own gradient) rather
            than a pale panel fill — a missing cover photo reads as a deliberate
            premium "coming soon" plate instead of an empty pastel box. */}
        <div className="relative h-40 flex-none overflow-hidden bg-[linear-gradient(135deg,#0B1130_0%,#181f45_100%)]">
          {d.heroImageUrl ? (
            <img
              src={d.heroImageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-white/40">
              No cover image
            </div>
          )}
          {/* Permanent, subtle bottom-up scrim — gives the seats-left pill
              real contrast against any photo and adds a touch of depth to
              the placeholder gradient too, not just a hover effect. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <CardBadge key={b.label} tone={b.tone}>
                {b.label}
              </CardBadge>
            ))}
          </div>
          {nextDate && seatsLeft > 0 && (
            <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              {seatsLeft} seats left
            </span>
          )}
        </div>

        <div className="flex flex-col p-4">
          {/* Flight summary sits beside the title, on its own row, instead
              of a separate block further down — that way a flight-less
              card and a flight-having card stay exactly the same height
              (nothing added below), and there's no dead space to fill when
              a package has no flights (nothing rendered here at all, same
              as before flights existed on this card). Onward's own route
              stands in for "this package flies" — the reverse Return leg
              isn't worth a second badge's width in a spot this tight;
              full Onward+Return detail is still one tap away on the
              departure detail page's own Flight Details section. */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 font-serif text-base font-bold leading-snug text-agent-ink transition-colors duration-300 group-hover:text-agent-accent-dark">
              {d.title}
            </div>
            {d.flights && (
              <span className="flex flex-none items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700">
                <LuPlaneTakeoff size={11} className="flex-none" />
                <span className="max-w-[100px] truncate">
                  {d.flights.onward.source} → {d.flights.onward.destination}
                </span>
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-agent-muted">
            <span>{d.destination || 'Destination TBA'}</span>
            {d.duration && <span>· {d.duration}</span>}
            {d.theme && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-agent-ink">
                {d.theme}
              </span>
            )}
          </div>
          <div className="mt-1.5">
            <StarRating rating={Number(d.rating) || 0} reviewCount={d.reviewCount} />
          </div>

          <div className="mt-2 text-[11px] text-agent-muted">
            {nextDate ? (
              <>
                📅 {formatShortDate(nextDate.date)}
                {nextDate.location && ` · Ex-${nextDate.location}`}
                {d.nextDepartures.length > 1 && ` · +${d.nextDepartures.length - 1} more date${d.nextDepartures.length > 2 ? 's' : ''}`}
              </>
            ) : (
              'No departure dates scheduled'
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            {nextDate ? (
              <span className="text-[11px] font-semibold text-agent-accent-dark">
                {seatsLeft > 0 ? `${seatsLeft} seats left` : 'Sold out'}
              </span>
            ) : (
              <span className="text-[11px] text-agent-muted">On request</span>
            )}
            <span className="flex items-center gap-1 text-sm font-bold text-agent-ink">
              {formatCurrency(d.ratePerPax)} <span className="font-normal text-agent-muted">pp</span>
              <LuArrowRight
                size={14}
                className="text-agent-accent-dark transition-transform duration-300 group-hover:translate-x-1"
              />
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
      {/* Full-bleed dark hero — a deliberate one-off outside the shared
          agent-* light palette (same "premium banner" treatment as the
          admin/agent sidebars' own dark gradients), so this listing's own
          filter panel below can "float" over its lower edge instead of
          everything sitting flat on one plain white page. */}
      <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0B1130_0%,#141B3D_55%,#1B1440_100%)] text-white">
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-14 lg:px-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-agent-accent">
            <span className="h-px w-6 bg-agent-accent" /> Curated Departures
          </div>
          <h2 className="font-serif text-4xl font-bold leading-tight sm:text-5xl">Fixed Group Departures</h2>
          <p className="mt-3 max-w-xl text-sm text-white/70">
            Net rate is calculated from each package's day-by-day itinerary. Featured and Bestseller packages are
            set by Xclusive Oman.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-10 lg:px-8">
        {/* Negative margin pulls this panel up over the hero's bottom
            padding — the "floating card" effect — without needing the hero
            and the rest of the page to share one flat background. */}
        <div className="relative z-10 -mt-14">
          <Card className="border-white shadow-xl shadow-black/10">
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

          <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((d) => (
              <DepartureCard key={d.id} d={d} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
