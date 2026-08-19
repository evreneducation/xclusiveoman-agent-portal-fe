import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client.js';
import { Badge, Button, Card, ErrorText, FieldLabel, Table, TextInput } from '../components/ui.jsx';
import { FD_STATUS_TONE, formatCurrency, formatDateRange, getFdBadges } from '../../shared/fdPackage/index.js';

const TABS = [
  { key: 'fdPackages', label: 'FD Packages' },
  { key: 'hotels', label: 'Hotels' },
  { key: 'tours', label: 'Tours' },
  { key: 'activities', label: 'Activities' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'meals', label: 'Meals' },
  { key: 'visa', label: 'Visa' },
  { key: 'inclusionsExclusions', label: 'Inclusions & Exclusions' },
];

function FdPackageCard({ pkg, onDeleteRequest }) {
  const seatsTotal = pkg.seatsTotal ?? 0;
  const seatsBooked = pkg.seatsBooked ?? 0;
  const seatsLeft = Math.max(seatsTotal - seatsBooked, 0);
  const bookedPct = seatsTotal > 0 ? Math.min((seatsBooked / seatsTotal) * 100, 100) : 0;
  const dateRange = formatDateRange(pkg.firstDepartureDate, pkg.lastDepartureDate);
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
            <div className="text-[10px] text-muted">Net rate</div>
            <div className="text-base font-bold">{formatCurrency(pkg.ratePerPax)}</div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => onDeleteRequest(pkg)} className="text-xs text-[#a5162d] hover:underline">
              Delete
            </button>
            <Link to={`/admin/catalog/fd-packages/${pkg.id}`}>
              <Button variant="accent">Edit</Button>
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// No generic modal exists anywhere in the admin console yet (see the same
// note on Marketing.jsx's local Modal) — this is a small local one (overlay
// + centered Card-styled panel, same tokens as everywhere else) rather than
// the browser's native window.confirm, so the warning and any failure (e.g.
// a 409 because real bookings still exist — see deleteFdPackage's comment)
// render in-app instead of a native dialog/alert.
function DeleteFdPackageModal({ pkg, onCancel, onConfirmed }) {
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setError('');
    setDeleting(true);
    try {
      await api.del(`/admin/fd-packages/${pkg.id}`);
      onConfirmed(pkg.id);
    } catch (err) {
      setError(err.message || 'Unable to delete FD package');
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={deleting ? undefined : onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-line-light bg-white p-5 shadow-lg sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-ink">Delete FD package?</h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            aria-label="Close"
            className="text-lg leading-none text-muted hover:text-ink"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-ink">
          Delete <span className="font-semibold">“{pkg.title}”</span>? This also removes its itinerary, departure dates, and
          add-ons. This can’t be undone.
        </p>
        {error && (
          <div className="mt-3">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line-light pt-4">
          <Button onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FdPackagesTab() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState(null);

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
            <FdPackageCard key={pkg.id} pkg={pkg} onDeleteRequest={setPendingDelete} />
          ))}
        </div>
      )}
      {pendingDelete && (
        <DeleteFdPackageModal
          pkg={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirmed={(id) => {
            setItems((list) => list.filter((i) => i.id !== id));
            setPendingDelete(null);
          }}
        />
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

// Meals are a simple ancillary rate (no photos, no dedicated edit page) —
// unlike Activities/Transfers above, this stays as one self-contained tab
// with an inline add form, closer to the old pre-photo catalog pattern.
// Lunch and Dinner are independent entries — their own sub-tab, their own
// list, their own save — rather than one row holding both prices, since the
// two are managed independently (mirrors 0038_meals_split_type.sql on the
// backend). Only "price for 1 day" is captured/shown here — FdPackageEditor's
// Meals section treats it as the per-person-per-day rate, multiplying it by
// both headcount and day count (see computeMealsCost). The catalog's
// `price_per_person` column still exists but is no longer set from this UI.
const MEAL_TYPES = [
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
];

function mealPriceString(meal) {
  return meal ? String(meal.pricePerDay ?? meal.price_per_day ?? '') : '';
}

// Only one price entry is ever kept per meal type — this form both creates
// it (nothing exists yet for this mealType) and edits it in place (`existing`
// is that one row), rather than offering a separate "Add" flow that could
// pile up duplicates. Save is disabled until the field actually differs from
// what's persisted, and once it matches again (on load, or right after a
// successful save re-seeds it) shows "Saved" instead.
function MealForm({ mealType, existing, onSaved }) {
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Re-seed whenever the sub-tab changes or a freshly loaded/just-saved
  // `existing` shows up — a half-edited Lunch price must never get saved as
  // Dinner (or silently carry over onto a different entry) just because
  // either changed. onSaved below hands the parent the fresh row, which
  // flows back in as this same `existing` prop, so a successful save clears
  // the dirty state without a separate "last saved" copy to keep in sync.
  useEffect(() => {
    setPrice(mealPriceString(existing));
    setError('');
  }, [mealType, existing]);

  const label = mealType === 'lunch' ? 'Lunch' : 'Dinner';
  const savedPrice = mealPriceString(existing);
  const isDirty = price !== savedPrice;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        // Name/mealType only matter on create — FdPackageEditor's Meals
        // section resolves "the" lunch/dinner entry by mealType alone, not
        // by name, so name is just satisfying the backend's required field.
        ...(existing ? {} : { name: label, mealType }),
        ...(price !== '' ? { pricePerDay: Number(price) } : {}),
      };
      const { meal: saved } = existing
        ? await api.patch(`/admin/meals/${existing.id}`, payload)
        : await api.post('/admin/meals', payload);
      onSaved(saved);
    } catch (err) {
      setError(err.message || 'Unable to save meal price');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label={existing ? `Edit ${label.toLowerCase()} price` : `Add ${label.toLowerCase()}`} className="mt-4 border-white">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>{label} price for 1 day (₹)</FieldLabel>
          <TextInput type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="mt-2 flex items-center gap-3 sm:col-span-2">
          <Button variant="accent" type="submit" disabled={submitting || !isDirty}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
          {!submitting && !isDirty && savedPrice !== '' && <span className="text-xs font-semibold text-[#227647]">✓ Saved</span>}
        </div>
        <div className="sm:col-span-2">
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
    </Card>
  );
}

function MealsTab() {
  const [mealType, setMealType] = useState('lunch');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get(`/meals?${new URLSearchParams({ mealType }).toString()}`)
      .then(({ meals }) => setItems(meals))
      .finally(() => setLoading(false));
  }

  useEffect(load, [mealType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only one entry is ever kept per meal type — MealForm above edits it in
  // place once it exists, rather than adding another.
  const existing = items[0] || null;
  const label = mealType === 'lunch' ? 'Lunch' : 'Dinner';

  async function handleDelete() {
    await api.del(`/admin/meals/${existing.id}`);
    setItems([]);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {MEAL_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setMealType(t.key)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold ${
              mealType === t.key ? 'border-ink bg-ink text-white' : 'border-line-light bg-white text-[#666]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <>
          <MealForm mealType={mealType} existing={existing} onSaved={(saved) => setItems([saved])} />
          {existing && (
            <button onClick={handleDelete} className="mt-2 text-xs text-[#a5162d] hover:underline">
              Delete {label.toLowerCase()} price
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Product Catalog "Visa" tab — a single flat rate (per person), not a list
// like Meals' lunch/dinner types: there's only ever the one row, edited in
// place the same "create it if nothing exists yet, otherwise patch it"
// pattern as MealForm above, just without a type to switch between. Used by
// the agent Custom FIT Builder's Visa add-on (agent/pages/PackageBuilder.jsx)
// — the agent only ever sees a checkbox + headcount, never this price
// (blind pricing, same as every other catalog rate in that builder).
function visaPriceString(visa) {
  return visa ? String(visa.pricePerPerson ?? visa.price_per_person ?? '') : '';
}

function VisaForm({ existing, onSaved }) {
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPrice(visaPriceString(existing));
    setError('');
  }, [existing]);

  const savedPrice = visaPriceString(existing);
  const isDirty = price !== savedPrice;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = price !== '' ? { pricePerPerson: Number(price) } : {};
      const { visa: saved } = existing
        ? await api.patch(`/admin/visas/${existing.id}`, payload)
        : await api.post('/admin/visas', payload);
      onSaved(saved);
    } catch (err) {
      setError(err.message || 'Unable to save visa price');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label={existing ? 'Edit visa price' : 'Add visa price'} className="border-white">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>Visa price per person (₹)</FieldLabel>
          <TextInput type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="mt-2 flex items-center gap-3 sm:col-span-2">
          <Button variant="accent" type="submit" disabled={submitting || !isDirty}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
          {!submitting && !isDirty && savedPrice !== '' && <span className="text-xs font-semibold text-[#227647]">✓ Saved</span>}
        </div>
        <div className="sm:col-span-2">
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
    </Card>
  );
}

function VisaTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get('/visas')
      .then(({ visas }) => setItems(visas || []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // Only one entry is ever kept — VisaForm above edits it in place once it
  // exists, rather than adding another.
  const existing = items[0] || null;

  async function handleDelete() {
    await api.del(`/admin/visas/${existing.id}`);
    setItems([]);
  }

  return (
    <div>
      <p className="mb-4 text-xs text-muted">
        One flat rate, per person — this is what's used when an agent adds a Visa to a Custom FIT package.
      </p>
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <>
          <VisaForm existing={existing} onSaved={(saved) => setItems([saved])} />
          {existing && (
            <button onClick={handleDelete} className="mt-2 text-xs text-[#a5162d] hover:underline">
              Delete visa price
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Product Catalog "Inclusions & Exclusions" tab, next to Meals — reusable,
// name-only phrases the admin curates once (e.g. "Daily breakfast",
// "International flights") for reference when typing a quotation's
// client-facing Inclusions/Exclusions text in the Quote Inbox's Costing
// panel (agent/pages/QuoteDetail.jsx shows the final text there, read-only).
// Unlike Meals, there's no "one entry per type" limit — this is a plain
// growable list: add a name, remove it, nothing else to edit — so one
// component is reused for both Inclusions and Exclusions rather than two
// near-identical tabs.
const INCLUSION_EXCLUSION_TYPES = [
  { entityPath: 'inclusions', label: 'Inclusion' },
  { entityPath: 'exclusions', label: 'Exclusion' },
];

function NameOnlyCatalogList({ entityPath, label }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/${entityPath}`)
      .then((data) => setItems(data[entityPath] || []))
      .finally(() => setLoading(false));
  }, [entityPath]);

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError('');
    setSubmitting(true);
    try {
      // Singular response key, same convention as every other catalog
      // entity (e.g. POST /admin/meals -> { meal }) — catalogHandlersFor
      // derives it as entityPath.slice(0, -1).
      const data = await api.post(`/admin/${entityPath}`, { name: trimmed });
      setItems((list) => [data[entityPath.slice(0, -1)], ...list]);
      setName('');
    } catch (err) {
      setError(err.message || `Unable to add this ${label.toLowerCase()}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id) {
    await api.del(`/admin/${entityPath}/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="max-w-xs flex-1">
          <FieldLabel>{label} name</FieldLabel>
          <TextInput
            placeholder={label === 'Inclusion' ? 'e.g. Daily breakfast' : 'e.g. International flights'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button variant="accent" type="submit" disabled={submitting || !name.trim()}>
          {submitting ? 'Adding…' : `+ Add ${label.toLowerCase()}`}
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted">No {label.toLowerCase()}s added yet.</p>
      ) : (
        <ul className="divide-y divide-line-light rounded-lg border border-line-light bg-white">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{item.name}</span>
              <button onClick={() => handleRemove(item.id)} className="text-xs text-[#a5162d] hover:underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InclusionsExclusionsTab() {
  const [entityPath, setEntityPath] = useState('inclusions');
  const active = INCLUSION_EXCLUSION_TYPES.find((t) => t.entityPath === entityPath);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {INCLUSION_EXCLUSION_TYPES.map((t) => (
          <button
            key={t.entityPath}
            onClick={() => setEntityPath(t.entityPath)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold ${
              entityPath === t.entityPath ? 'border-ink bg-ink text-white' : 'border-line-light bg-white text-[#666]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* key= forces a clean remount on switch — each list's own loading/
          error/draft-name state should never carry over from the other. */}
      <NameOnlyCatalogList key={entityPath} entityPath={entityPath} label={active.label} />
    </div>
  );
}

export default function ProductCatalog() {
  const [tab, setTab] = useState('fdPackages');

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
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
        ) : tab === 'transfers' ? (
          <TransfersTab />
        ) : tab === 'meals' ? (
          <MealsTab />
        ) : tab === 'visa' ? (
          <VisaTab />
        ) : (
          <InclusionsExclusionsTab />
        )}
      </div>
    </div>
  );
}
