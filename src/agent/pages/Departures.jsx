import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, StarRating, TextInput } from '../components/ui.jsx';

export default function Departures() {
  const [departures, setDepartures] = useState([]);
  const [destination, setDestination] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [bestsellerOnly, setBestsellerOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (destination) params.set('destination', destination);
    if (featuredOnly) params.set('featured', 'true');
    if (bestsellerOnly) params.set('bestseller', 'true');

    setLoading(true);
    api
      .get(`/departures?${params.toString()}`)
      .then(({ departures: list }) => setDepartures(list))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [destination, featuredOnly, bestsellerOnly]);

  return (
    <div className="min-h-screen bg-[#eef1ef]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line-light bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
        <Link to="/agent/dashboard" className="text-sm font-bold text-ink">
          ← Xclusive Oman
        </Link>
        <Link to="/agent/dashboard">
          <Button>Dashboard</Button>
        </Link>
      </div>
      <div className="mx-auto max-w-6xl p-5 lg:p-8">
        <h2 className="mb-1 text-2xl font-bold">Fixed Group Departures</h2>
        <p className="mb-5 text-sm text-muted">
          Net rate reflects your agency's tier automatically. Featured and Bestseller packages are
          set by Xclusive Oman.
        </p>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <TextInput
            className="max-w-xs"
            placeholder="Search destination…"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={featuredOnly} onChange={(e) => setFeaturedOnly(e.target.checked)} />
            Featured only
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={bestsellerOnly} onChange={(e) => setBestsellerOnly(e.target.checked)} />
            Bestseller only
          </label>
        </div>

        {error && <p className="mb-4 text-sm text-[#a5162d]">{error}</p>}
        {loading && <p className="text-sm text-muted">Loading departures…</p>}
        {!loading && departures.length === 0 && (
          <p className="text-sm text-muted">No departures match those filters.</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departures.map((d) => {
            const nextDate = d.nextDepartures?.[0];
            return (
              <Link key={d.id} to={`/agent/departures/${d.id}`}>
                <Card className="h-full border-white transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="-mx-4 -mt-4 mb-3 flex h-24 items-center justify-center rounded-t-lg bg-[repeating-linear-gradient(45deg,#eee,#eee_6px,#f7f7f7_6px,#f7f7f7_12px)] font-mono text-[10px] text-[#999]">
                    IMAGE
                  </div>
                  <div className="mb-1.5 flex gap-1.5">
                    {d.isFeatured && <Badge tone="amber">★ Featured</Badge>}
                    {d.isBestseller && <Badge tone="green">Bestseller</Badge>}
                  </div>
                  <div className="text-sm font-bold">{d.title}</div>
                  <div className="mt-1 text-xs text-muted">
                    {d.duration} {d.theme ? `· ${d.theme}` : ''}
                    {nextDate ? ` · Dep. ${new Date(nextDate.date).toLocaleDateString()}` : ''}
                  </div>
                  <div className="mt-1.5">
                    <StarRating rating={Number(d.rating) || 0} reviewCount={d.reviewCount} />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {nextDate ? (
                      <span className="text-[11px] text-muted">
                        {nextDate.seatsLeft > 0 ? `${nextDate.seatsLeft} seats left` : 'On request'}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted">On request</span>
                    )}
                    <span className="text-sm font-bold">OMR {d.ratePerPax} pp</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
