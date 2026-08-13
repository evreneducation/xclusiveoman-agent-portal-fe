import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Card, Checkbox, ErrorText, Select, StarRating, TextInput } from '../components/ui.jsx';
import { formatCurrency, formatShortDate, getFdBadges, getSeatsLeft } from '../../shared/fdPackage/index.js';

const PRICE_BANDS = [
  { label: 'Any price', min: 0, max: Infinity },
  { label: 'Under ₹15,000', min: 0, max: 15000 },
  { label: '₹15,000 – ₹30,000', min: 15000, max: 30000 },
  { label: '₹30,000 – ₹50,000', min: 30000, max: 50000 },
  { label: 'Above ₹50,000', min: 50000, max: Infinity },
];

function DepartureCard({ d }) {
  const nextDate = d.nextDepartures?.[0];
  const seatsLeft = getSeatsLeft(d.nextDepartures);
  const badges = getFdBadges(d);

  return (
    <Link to={`/agent/departures/${d.id}`}>
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-agent-line-light bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="relative h-36 flex-none bg-agent-panel">
          {d.heroImageUrl ? (
            <img src={d.heroImageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-[10px] text-agent-muted">No image</div>
          )}
          <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <Badge key={b.label} tone={b.tone}>
                {b.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <div className="text-sm font-bold text-agent-ink">{d.title}</div>
          <div className="mt-1 text-xs text-agent-muted">
            {d.destination || 'Destination TBA'} · {d.duration || '—'} {d.theme ? `· ${d.theme}` : ''}
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

          <div className="mt-auto flex items-center justify-between pt-3">
            {nextDate ? (
              <span className="text-[11px] font-semibold text-agent-accent-dark">
                {seatsLeft > 0 ? `${seatsLeft} seats left` : 'Sold out'}
              </span>
            ) : (
              <span className="text-[11px] text-agent-muted">On request</span>
            )}
            <span className="text-sm font-bold text-agent-ink">
              {formatCurrency(d.ratePerPax)} <span className="font-normal text-agent-muted">pp</span>
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
    <div className="mx-auto max-w-6xl p-5 lg:p-8">
      <h2 className="mb-1 text-2xl font-bold text-agent-ink">Fixed Group Departures</h2>
      <p className="mb-5 text-sm text-agent-muted">
        Net rate is calculated from each package's day-by-day itinerary. Featured and Bestseller packages are set by Xclusive Oman.
      </p>

      <Card className="mb-5 border-white">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <TextInput placeholder="Search by name, theme, or destination…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
          <TextInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Departing on or after" />
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

      <ErrorText>{error}</ErrorText>
      {loading && <p className="text-sm text-agent-muted">Loading departures…</p>}
      {!loading && filtered.length === 0 && <p className="text-sm text-agent-muted">No departures match those filters.</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((d) => (
          <DepartureCard key={d.id} d={d} />
        ))}
      </div>
    </div>
  );
}
