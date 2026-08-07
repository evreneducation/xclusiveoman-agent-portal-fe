import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client.js';
import { Badge, Button, Table, TextInput } from '../components/ui.jsx';
import { FD_STATUS_TONE, formatCurrency, formatDateRange, getFdBadges, getStartingRate } from '../../shared/fdPackage/index.js';

const TABS = [
  { key: 'fdPackages', label: 'FD Packages' },
  { key: 'hotels', label: 'Hotels' },
  { key: 'tours', label: 'Tours' },
  { key: 'activities', label: 'Activities' },
  { key: 'transfers', label: 'Transfers' },
];

function FdPackageCard({ pkg }) {
  const seatsTotal = pkg.seatsTotal ?? 0;
  const seatsBooked = pkg.seatsBooked ?? 0;
  const seatsLeft = Math.max(seatsTotal - seatsBooked, 0);
  const bookedPct = seatsTotal > 0 ? Math.min((seatsBooked / seatsTotal) * 100, 100) : 0;
  const dateRange = formatDateRange(pkg.firstDepartureDate, pkg.lastDepartureDate);
  const rate = getStartingRate(pkg);
  const badges = getFdBadges(pkg);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex h-full flex-col overflow-hidden rounded-lg border border-line-light bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative h-40 flex-none bg-panel">
        {pkg.heroImageUrl ? (
          <img src={pkg.heroImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-[10px] text-muted">No hero image</div>
        )}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          <Badge tone={FD_STATUS_TONE[pkg.status] || 'grey'}>{pkg.status}</Badge>
          {badges.map((b) => (
            <Badge key={b.label} tone={b.tone}>
              {b.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {pkg.hotelName && <div className="text-[11px] font-semibold uppercase text-accent">{pkg.hotelName}</div>}
        <div className="mt-0.5 text-sm font-bold leading-snug">{pkg.title}</div>
        <div className="mt-1 text-xs text-muted">
          {[pkg.duration, pkg.theme].filter(Boolean).join(' · ') || '—'}
        </div>

        {dateRange && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
            <span>📅</span>
            {dateRange}
          </div>
        )}

        <div className="mt-3">
          {seatsTotal > 0 ? (
            <>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel">
                <div className="h-full rounded-full bg-[#a5162d]" style={{ width: `${bookedPct}%` }} />
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#a5162d]">{seatsLeft} seats left</span>
                <span className="text-muted">{seatsTotal} total</span>
              </div>
            </>
          ) : (
            <p className="text-[11px] text-muted">No departure dates yet</p>
          )}
        </div>

        <div className="mt-3 flex flex-1 items-end justify-between gap-2">
          <div>
            <div className="text-[10px] text-muted">Starting at</div>
            <div className="text-base font-bold">{formatCurrency(rate)}</div>
          </div>
          <Link to={`/admin/catalog/fd-packages/${pkg.id}`}>
            <Button variant="accent">Edit</Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function FdPackagesTab() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/admin/fd-packages')
      .then(({ fdPackages }) => setItems(fdPackages))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <TextInput className="max-w-xs" placeholder="Search FD packages…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Link to="/admin/catalog/fd-packages/new">
          <Button variant="accent">+ Add New FD Package</Button>
        </Link>
      </div>
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted">No FD packages match that search.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pkg) => (
            <FdPackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </div>
  );
}

function HotelsTab() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get(`/hotels${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      .then(({ hotels }) => setItems(hotels))
      .finally(() => setLoading(false));
  }

  useEffect(load, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id) {
    await api.del(`/admin/hotels/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <TextInput className="max-w-xs" placeholder="Search hotels…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Link to="/admin/catalog/hotels/new">
          <Button variant="accent">+ Add New Hotel</Button>
        </Link>
      </div>
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <Table
          columns={['', 'Hotel', 'City', 'State', 'Star', 'Email', 'Price / night', '']}
          rows={items}
          renderRow={(hotel) => (
            <tr key={hotel.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2">
                {hotel.images?.[0] ? (
                  <img src={hotel.images[0]} alt="" className="h-10 w-10 rounded-md border border-line-light object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-line-light font-mono text-[8px] text-muted">
                    No image
                  </div>
                )}
              </td>
              <td className="px-3 py-2 font-semibold">{hotel.name}</td>
              <td className="px-3 py-2">{hotel.city || '—'}</td>
              <td className="px-3 py-2">{hotel.state || '—'}</td>
              <td className="px-3 py-2">{hotel.category ? <Badge tone="amber">{hotel.category}★</Badge> : '—'}</td>
              <td className="px-3 py-2">{hotel.email || '—'}</td>
              <td className="px-3 py-2">{hotel.price_per_night != null ? `₹${hotel.price_per_night}` : '—'}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-3">
                  <Link to={`/admin/catalog/hotels/${hotel.id}`} className="text-accent hover:underline">
                    Edit
                  </Link>
                  <button onClick={() => handleDelete(hotel.id)} className="text-[#a5162d] hover:underline">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
      )}
    </div>
  );
}

function ToursTab() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get(`/tours${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      .then(({ tours }) => setItems(tours))
      .finally(() => setLoading(false));
  }

  useEffect(load, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id) {
    await api.del(`/admin/tours/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <TextInput className="max-w-xs" placeholder="Search tours…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Link to="/admin/catalog/tours/new">
          <Button variant="accent">+ Add New Tour</Button>
        </Link>
      </div>
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <Table
          columns={['', 'Tour', 'City', 'Category', 'Duration', 'Price (INR)', '']}
          rows={items}
          renderRow={(tour) => (
            <tr key={tour.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2">
                {tour.images?.[0] ? (
                  <img src={tour.images[0]} alt="" className="h-10 w-10 rounded-md border border-line-light object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-line-light font-mono text-[8px] text-muted">
                    No image
                  </div>
                )}
              </td>
              <td className="px-3 py-2 font-semibold">{tour.name}</td>
              <td className="px-3 py-2">{tour.city || '—'}</td>
              <td className="px-3 py-2">{tour.category ? <Badge tone="amber">{tour.category}</Badge> : '—'}</td>
              <td className="px-3 py-2">{tour.duration || '—'}</td>
              <td className="px-3 py-2">{tour.price != null ? `₹${tour.price}` : '—'}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-3">
                  <Link to={`/admin/catalog/tours/${tour.id}`} className="text-accent hover:underline">
                    Edit
                  </Link>
                  <button onClick={() => handleDelete(tour.id)} className="text-[#a5162d] hover:underline">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
      )}
    </div>
  );
}

// Gets its own dedicated tab (mirroring HotelsTab/ToursTab) instead of the
// old generic SimpleEntityTab — activities now have a photo option, which
// means a thumbnail column here and a real edit page (ActivityEditor.jsx)
// instead of the previous add-only inline form.
function ActivitiesTab() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get(`/activities${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      .then(({ activities }) => setItems(activities))
      .finally(() => setLoading(false));
  }

  useEffect(load, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id) {
    await api.del(`/admin/activities/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <TextInput className="max-w-xs" placeholder="Search activities…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Link to="/admin/catalog/activities/new">
          <Button variant="accent">+ Add New Activity</Button>
        </Link>
      </div>
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <Table
          columns={['', 'Activity', 'City', 'Duration', 'Price per pax', '']}
          rows={items}
          renderRow={(activity) => (
            <tr key={activity.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2">
                {activity.images?.[0] ? (
                  <img src={activity.images[0]} alt="" className="h-10 w-10 rounded-md border border-line-light object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-line-light font-mono text-[8px] text-muted">
                    No image
                  </div>
                )}
              </td>
              <td className="px-3 py-2 font-semibold">{activity.name}</td>
              <td className="px-3 py-2">{activity.city || '—'}</td>
              <td className="px-3 py-2">{activity.duration || '—'}</td>
              <td className="px-3 py-2">
                {(activity.pricePerPax ?? activity.price_per_pax) != null ? `₹${activity.pricePerPax ?? activity.price_per_pax}` : '—'}
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-3">
                  <Link to={`/admin/catalog/activities/${activity.id}`} className="text-accent hover:underline">
                    Edit
                  </Link>
                  <button onClick={() => handleDelete(activity.id)} className="text-[#a5162d] hover:underline">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
      )}
    </div>
  );
}

// Gets its own dedicated tab for the same reason as ActivitiesTab above —
// photos + a real edit page (TransferEditor.jsx) replacing the old add-only
// inline form.
function TransfersTab() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get(`/transfers${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      .then(({ transfers }) => setItems(transfers))
      .finally(() => setLoading(false));
  }

  useEffect(load, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id) {
    await api.del(`/admin/transfers/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <TextInput className="max-w-xs" placeholder="Search transfers…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Link to="/admin/catalog/transfers/new">
          <Button variant="accent">+ Add New Transfer</Button>
        </Link>
      </div>
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <Table
          columns={['', 'Transfer', 'Type', 'City', 'Price', '']}
          rows={items}
          renderRow={(transfer) => (
            <tr key={transfer.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2">
                {transfer.images?.[0] ? (
                  <img src={transfer.images[0]} alt="" className="h-10 w-10 rounded-md border border-line-light object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-line-light font-mono text-[8px] text-muted">
                    No image
                  </div>
                )}
              </td>
              <td className="px-3 py-2 font-semibold">{transfer.name}</td>
              <td className="px-3 py-2">{transfer.type ? <Badge tone="amber">{transfer.type}</Badge> : '—'}</td>
              <td className="px-3 py-2">{transfer.city || '—'}</td>
              <td className="px-3 py-2">{transfer.price != null ? `₹${transfer.price}` : '—'}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-3">
                  <Link to={`/admin/catalog/transfers/${transfer.id}`} className="text-accent hover:underline">
                    Edit
                  </Link>
                  <button onClick={() => handleDelete(transfer.id)} className="text-[#a5162d] hover:underline">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
      )}
    </div>
  );
}

export default function ProductCatalog() {
  const [tab, setTab] = useState('fdPackages');

  return (
    <div className="min-h-screen bg-[#eef1f7]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <h2 className="mb-5 text-3xl font-bold">Product Catalog</h2>
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                tab === t.key ? 'border-ink bg-ink text-white' : 'border-line-light bg-white text-[#666]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'fdPackages' ? (
          <FdPackagesTab />
        ) : tab === 'hotels' ? (
          <HotelsTab />
        ) : tab === 'tours' ? (
          <ToursTab />
        ) : tab === 'activities' ? (
          <ActivitiesTab />
        ) : (
          <TransfersTab />
        )}
      </div>
    </div>
  );
}
