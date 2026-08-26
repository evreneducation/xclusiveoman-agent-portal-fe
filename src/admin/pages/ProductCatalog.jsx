import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LuBriefcase,
  LuBusFront,
  LuCompass,
  LuEye,
  LuHotel,
  LuListChecks,
  LuPencil,
  LuPersonStanding,
  LuSend,
  LuShieldCheck,
  LuTrash2,
  LuUtensils,
} from 'react-icons/lu';
import { api } from '../api/client.js';
import { Button, Card, ErrorText, FieldLabel, Pagination, Table, TextInput } from '../components/ui.jsx';
import { formatCurrency, formatDateRange, formatTime, getFdBadges } from '../../shared/fdPackage/index.js';
import { RichTextDisplay, isEmptyHtml } from '../../shared/components/RichTextEditor.jsx';

const TABS = [
  { key: 'fdPackages', label: 'FD Packages', icon: LuBriefcase },
  { key: 'hotels', label: 'Hotels', icon: LuHotel },
  { key: 'tours', label: 'Tours', icon: LuCompass },
  { key: 'activities', label: 'Activities', icon: LuPersonStanding },
  { key: 'transfers', label: 'Transfers', icon: LuBusFront },
  { key: 'meals', label: 'Meals', icon: LuUtensils },
  { key: 'visa', label: 'Visa', icon: LuShieldCheck },
  { key: 'flights', label: 'Flights', icon: LuSend },
  { key: 'inclusionsExclusions', label: 'Inclusions & Exclusions', icon: LuListChecks },
];

// Solid-fill premium badges for the card's image overlay — same reasoning
// as agent/pages/Departures.jsx's own CardBadge: the shared `Badge`
// component (../components/ui.jsx) is a soft pale-pill treatment meant for
// sitting on a white card body, and needs real contrast to read on a dark
// photo/placeholder instead. Deliberately kept in the admin console's own
// indigo/purple identity (no gold/teal borrowed from the agent portal's
// separate brand) — "Featured" reads as the console's own accent gradient
// rather than agent's gold, consistent with every other admin premium
// treatment (ContentManagement.jsx's gradient headings, etc.).
const CARD_BADGE_TONE = {
  amber: 'bg-gradient-to-r from-accent to-accent-dark text-white',
  green: 'bg-emerald-500 text-white',
  red: 'bg-rose-600 text-white',
};
const STATUS_BADGE_SOLID = {
  draft: 'bg-slate-600 text-white',
  published: 'bg-emerald-500 text-white',
  closed: 'bg-rose-600 text-white',
};

// draft/published badge for Hotels/Tours/Activities/Transfers table rows
// (0070_hotels_status.sql / 0072_tours_activities_transfers_status.sql) —
// reuses the same STATUS_BADGE_SOLID palette FdPackagesTab's own status pill
// already established. `status` can come back undefined from a stale cached
// response shape; defaults to "published" rather than showing a blank pill,
// since that's what every one of these rows already was before the column
// existed.
function StatusBadge({ status }) {
  const value = status || 'published';
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
        STATUS_BADGE_SOLID[value] || 'bg-slate-700 text-white'
      }`}
    >
      {value}
    </span>
  );
}

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

// No shared Modal component exists yet (see this file's own local `Modal`
// below, and the same local-Modal convention in Marketing.jsx/
// AgentApprovals.jsx/Employees.jsx) — this is a bespoke small one (overlay
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

const PAGE_SIZE = 10;

// Small local overlay-modal shell, same convention as AgentApprovals.jsx/
// Employees.jsx's own local Modal (and Marketing.jsx's before those) — no
// shared Modal component exists yet, so each page that needs one defines
// its own rather than reaching for the browser's native window.confirm.
function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-line-light bg-white p-5 shadow-lg sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-lg leading-none text-muted hover:text-ink">
            ×
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line-light pt-4">{footer}</div>}
      </div>
    </div>
  );
}

function FieldTile({ label, children }) {
  return (
    <div className="rounded-md bg-panel px-3 py-2">
      <div className="text-[10px] font-semibold uppercase text-muted">{label}</div>
      <div>{children}</div>
    </div>
  );
}

// "View" — a quick read-only glance (same View/Edit split as the Agent
// Approvals and Employees tables): "Edit" below still opens the full
// FdPackageEditor route, which already does far more than a modal should
// try to replicate (itinerary builder, departure dates, addons, images).
function FdPackagePreviewModal({ pkg, onClose }) {
  const dateRange = formatDateRange(pkg.firstDepartureDate, pkg.lastDepartureDate);
  const badges = getFdBadges(pkg);
  const seatsTotal = pkg.seatsTotal ?? 0;
  const seatsBooked = pkg.seatsBooked ?? 0;

  return (
    <Modal title={pkg.title} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            STATUS_BADGE_SOLID[pkg.status] || 'bg-slate-700 text-white'
          }`}
        >
          {pkg.status}
        </span>
        {badges.map((b) => (
          <CardBadge key={b.label} tone={b.tone}>
            {b.label}
          </CardBadge>
        ))}
      </div>

      {pkg.heroImageUrl && <img src={pkg.heroImageUrl} alt="" className="mb-4 h-40 w-full rounded-lg object-cover" />}

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <FieldTile label="Hotel">{pkg.hotelName || '—'}</FieldTile>
        <FieldTile label="Theme">{pkg.theme || '—'}</FieldTile>
        <FieldTile label="Duration">{pkg.duration || '—'}</FieldTile>
        <FieldTile label="Departure dates">{dateRange || 'No dates yet'}</FieldTile>
        <FieldTile label="Net rate">{formatCurrency(pkg.ratePerPax)}</FieldTile>
        <FieldTile label="Seats">
          {seatsTotal > 0 ? `${Math.max(seatsTotal - seatsBooked, 0)} left of ${seatsTotal}` : '—'}
        </FieldTile>
      </div>
    </Modal>
  );
}

// Table (not the FdPackageCard grid the other simple catalog tabs use) —
// FD packages carry enough operational data per row (theme, departure
// window, net rate, status) that a scannable table reads better here than a
// photo grid at this list size, and the reference this was built against
// (a dense, paginated ops list) called for one explicitly. Search and
// pagination (10/page) are both fully server-side — see
// fdPackagesAdmin.controller.js#list.
function FdPackagesTab() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewing, setPreviewing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));

    api
      .get(`/admin/fd-packages?${params.toString()}`)
      .then(({ fdPackages, pagination: p }) => {
        setItems(fdPackages);
        setPagination(p);
      })
      .catch((err) => setError(err.message || 'Unable to load FD packages'))
      .finally(() => setLoading(false));
  }, [search, page]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <TextInput className="flex-1" placeholder="Search FD packages…" value={search} onChange={(e) => updateSearch(e.target.value)} />
        <Link to="/admin/catalog/fd-packages/new">
          <Button variant="accent">+ Add New FD Package</Button>
        </Link>
      </div>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted">{search ? 'No FD packages match that search.' : 'No FD packages yet.'}</p>
      ) : (
        <>
          <Table
            columns={['Package Name', 'Theme', 'Departure Dates', 'Net Rate', 'Status', { label: 'Actions', align: 'right' }]}
            rows={items}
            renderRow={(pkg) => {
              const dateRange = formatDateRange(pkg.firstDepartureDate, pkg.lastDepartureDate);
              return (
                <tr key={pkg.id} className="border-b border-line-light transition-colors last:border-0 hover:bg-panel/50">
                  <td className="px-3 py-3 align-middle">
                    <div className="font-semibold text-ink">{pkg.title}</div>
                    {pkg.hotelName && <div className="text-[11px] text-muted">{pkg.hotelName}</div>}
                  </td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap">{pkg.theme || '—'}</td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap">{dateRange || '—'}</td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap">{formatCurrency(pkg.ratePerPax)}</td>
                  <td className="px-3 py-3 align-middle">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        STATUS_BADGE_SOLID[pkg.status] || 'bg-slate-700 text-white'
                      }`}
                    >
                      {pkg.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="flex flex-nowrap items-center justify-end gap-2">
                      <Button size="sm" className="whitespace-nowrap" onClick={() => setPreviewing(pkg)}>
                        <LuEye className="mr-1.5 flex-shrink-0" size={14} />
                        View
                      </Button>
                      <Link to={`/admin/catalog/fd-packages/${pkg.id}`}>
                        <Button size="sm" variant="accent" className="whitespace-nowrap">
                          <LuPencil className="mr-1.5 flex-shrink-0" size={14} />
                          Edit
                        </Button>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(pkg)}
                        aria-label={`Delete ${pkg.title}`}
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]"
                      >
                        <LuTrash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }}
          />

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pagination.pageSize}
            onChange={setPage}
            itemLabel="FD packages"
          />
        </>
      )}

      {previewing && <FdPackagePreviewModal pkg={previewing} onClose={() => setPreviewing(null)} />}
      {pendingDelete && (
        <DeleteFdPackageModal
          pkg={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirmed={(id) => {
            setItems((list) => list.filter((i) => i.id !== id));
            setPendingDelete(null);
            setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
          }}
        />
      )}
    </div>
  );
}

// Small generic confirm-before-delete modal, reusing the local Modal/
// FieldTile shell above — HotelsTab's own delete used to fire straight off
// a single click with no confirmation step at all; a standalone icon button
// (this table's Delete action) is easier to mis-click than the old card's
// inline text link was, so a confirm step is worth adding here even though
// it wasn't asked for outright.
function ConfirmDeleteModal({ title, message, onCancel, onConfirm }) {
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setError('');
    setDeleting(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message || 'Unable to delete');
      setDeleting(false);
    }
  }

  return (
    <Modal
      title={title}
      onClose={deleting ? () => {} : onCancel}
      footer={
        <>
          <Button onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink">{message}</p>
      {error && (
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </Modal>
  );
}

function HotelPreviewModal({ hotel, onClose }) {
  return (
    <Modal title={hotel.name} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      {hotel.images?.[0] && <img src={hotel.images[0]} alt="" className="mb-4 h-40 w-full rounded-lg object-cover" />}
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <FieldTile label="Location">{[hotel.city, hotel.state].filter(Boolean).join(', ') || '—'}</FieldTile>
        <FieldTile label="Category">{hotel.category ? `${hotel.category}★` : '—'}</FieldTile>
        <FieldTile label="Address">{hotel.address || '—'}</FieldTile>
        <FieldTile label="Email">{hotel.email || '—'}</FieldTile>
        <FieldTile label="Price / night">{formatCurrency(hotel.price_per_night)}</FieldTile>
        <FieldTile label="MICE enabled">{hotel.is_mice_enabled ? 'Yes' : 'No'}</FieldTile>
      </div>
      {!isEmptyHtml(hotel.description) && (
        <div className="mt-4">
          <FieldLabel>Description</FieldLabel>
          <RichTextDisplay html={hotel.description} className="text-ink" />
        </div>
      )}
    </Modal>
  );
}

// Table — same reasoning, and same server-side search/pagination (10/page),
// as FdPackagesTab above. Tours/Activities/Transfers below were converted to
// this same shape too (they used to be a card grid).
function HotelsTab() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewing, setPreviewing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));

    api
      .get(`/hotels?${params.toString()}`)
      .then(({ hotels, pagination: p }) => {
        setItems(hotels);
        setPagination(p);
      })
      .catch((err) => setError(err.message || 'Unable to load hotels'))
      .finally(() => setLoading(false));
  }, [search, page]);

  async function handleDelete(id) {
    await api.del(`/admin/hotels/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
    setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
    setPendingDelete(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <TextInput className="flex-1" placeholder="Search hotels…" value={search} onChange={(e) => updateSearch(e.target.value)} />
        <Link to="/admin/catalog/hotels/new">
          <Button variant="accent">+ Add New Hotel</Button>
        </Link>
      </div>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted">{search ? 'No hotels match that search.' : 'No hotels yet.'}</p>
      ) : (
        <>
          <Table
            columns={['Hotel Name', 'Location', 'Category', 'Price / Night', 'MICE', 'Status', { label: 'Actions', align: 'right' }]}
            rows={items}
            renderRow={(hotel) => (
              <tr key={hotel.id} className="border-b border-line-light transition-colors last:border-0 hover:bg-panel/50">
                <td className="px-3 py-3 align-middle font-semibold text-ink">{hotel.name}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">
                  {[hotel.city, hotel.state].filter(Boolean).join(', ') || '—'}
                </td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">{hotel.category ? `${hotel.category}★` : '—'}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">{formatCurrency(hotel.price_per_night)}</td>
                <td className="px-3 py-3 align-middle">
                  {hotel.is_mice_enabled ? (
                    <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                      Yes
                    </span>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-3 align-middle">
                  <StatusBadge status={hotel.status} />
                </td>
                <td className="px-3 py-3 align-middle">
                  <div className="flex flex-nowrap items-center justify-end gap-2">
                    <Button size="sm" className="whitespace-nowrap" onClick={() => setPreviewing(hotel)}>
                      <LuEye className="mr-1.5 flex-shrink-0" size={14} />
                      View
                    </Button>
                    <Link to={`/admin/catalog/hotels/${hotel.id}`}>
                      <Button size="sm" variant="accent" className="whitespace-nowrap">
                        <LuPencil className="mr-1.5 flex-shrink-0" size={14} />
                        Edit
                      </Button>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(hotel)}
                      aria-label={`Delete ${hotel.name}`}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]"
                    >
                      <LuTrash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          />

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pagination.pageSize}
            onChange={setPage}
            itemLabel="hotels"
          />
        </>
      )}

      {previewing && <HotelPreviewModal hotel={previewing} onClose={() => setPreviewing(null)} />}
      {pendingDelete && (
        <ConfirmDeleteModal
          title="Delete hotel?"
          message={
            <>
              Delete <span className="font-semibold">"{pendingDelete.name}"</span>? This can't be undone.
            </>
          }
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => handleDelete(pendingDelete.id)}
        />
      )}
    </div>
  );
}

function TourPreviewModal({ tour, onClose }) {
  return (
    <Modal title={tour.name} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="mb-4">
        <StatusBadge status={tour.status} />
      </div>
      {tour.images?.[0] && <img src={tour.images[0]} alt="" className="mb-4 h-40 w-full rounded-lg object-cover" />}
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <FieldTile label="City">{tour.city || '—'}</FieldTile>
        <FieldTile label="Duration">{tour.duration || '—'}</FieldTile>
        <FieldTile label="Category">{tour.category || '—'}</FieldTile>
        <FieldTile label="Price">{formatCurrency(tour.price)}</FieldTile>
        <FieldTile label="Suitable age (min)">{tour.suitable_age_min ?? '—'}</FieldTile>
        <FieldTile label="Bestseller">{tour.is_bestseller ? 'Yes' : 'No'}</FieldTile>
      </div>
      {!isEmptyHtml(tour.description) && (
        <div className="mt-4">
          <FieldLabel>Description</FieldLabel>
          <RichTextDisplay html={tour.description} className="text-ink" />
        </div>
      )}
    </Modal>
  );
}

// Table (not the CatalogCard grid this used to be) — same reasoning, and
// same server-side search/pagination (10/page), as HotelsTab above.
function ToursTab() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewing, setPreviewing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));

    api
      .get(`/tours?${params.toString()}`)
      .then(({ tours, pagination: p }) => {
        setItems(tours);
        setPagination(p);
      })
      .catch((err) => setError(err.message || 'Unable to load tours'))
      .finally(() => setLoading(false));
  }, [search, page]);

  async function handleDelete(id) {
    await api.del(`/admin/tours/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
    setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
    setPendingDelete(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <TextInput className="flex-1" placeholder="Search tours…" value={search} onChange={(e) => updateSearch(e.target.value)} />
        <Link to="/admin/catalog/tours/new">
          <Button variant="accent">+ Add New Tour</Button>
        </Link>
      </div>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted">{search ? 'No tours match that search.' : 'No tours yet.'}</p>
      ) : (
        <>
          <Table
            columns={['Tour Name', 'City', 'Duration', 'Category', 'Price', 'Status', { label: 'Actions', align: 'right' }]}
            rows={items}
            renderRow={(tour) => (
              <tr key={tour.id} className="border-b border-line-light transition-colors last:border-0 hover:bg-panel/50">
                <td className="px-3 py-3 align-middle font-semibold text-ink">{tour.name}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">{tour.city || '—'}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">{tour.duration || '—'}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">{tour.category || '—'}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">{formatCurrency(tour.price)}</td>
                <td className="px-3 py-3 align-middle">
                  <StatusBadge status={tour.status} />
                </td>
                <td className="px-3 py-3 align-middle">
                  <div className="flex flex-nowrap items-center justify-end gap-2">
                    <Button size="sm" className="whitespace-nowrap" onClick={() => setPreviewing(tour)}>
                      <LuEye className="mr-1.5 flex-shrink-0" size={14} />
                      View
                    </Button>
                    <Link to={`/admin/catalog/tours/${tour.id}`}>
                      <Button size="sm" variant="accent" className="whitespace-nowrap">
                        <LuPencil className="mr-1.5 flex-shrink-0" size={14} />
                        Edit
                      </Button>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(tour)}
                      aria-label={`Delete ${tour.name}`}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]"
                    >
                      <LuTrash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          />

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pagination.pageSize}
            onChange={setPage}
            itemLabel="tours"
          />
        </>
      )}

      {previewing && <TourPreviewModal tour={previewing} onClose={() => setPreviewing(null)} />}
      {pendingDelete && (
        <ConfirmDeleteModal
          title="Delete tour?"
          message={
            <>
              Delete <span className="font-semibold">"{pendingDelete.name}"</span>? This can't be undone.
            </>
          }
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => handleDelete(pendingDelete.id)}
        />
      )}
    </div>
  );
}

function ActivityPreviewModal({ activity, onClose }) {
  const pricePerPax = activity.pricePerPax ?? activity.price_per_pax;
  const isBestseller = activity.isBestseller ?? activity.is_bestseller;
  return (
    <Modal title={activity.name} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="mb-4">
        <StatusBadge status={activity.status} />
      </div>
      {activity.images?.[0] && <img src={activity.images[0]} alt="" className="mb-4 h-40 w-full rounded-lg object-cover" />}
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <FieldTile label="City">{activity.city || '—'}</FieldTile>
        <FieldTile label="Duration">{activity.duration || '—'}</FieldTile>
        <FieldTile label="Price per pax">{formatCurrency(pricePerPax)}</FieldTile>
        <FieldTile label="Bestseller">{isBestseller ? 'Yes' : 'No'}</FieldTile>
      </div>
      {!isEmptyHtml(activity.description) && (
        <div className="mt-4">
          <FieldLabel>Description</FieldLabel>
          <RichTextDisplay html={activity.description} className="text-ink" />
        </div>
      )}
    </Modal>
  );
}

// Table (not the CatalogCard grid this used to be) — same reasoning, and
// same server-side search/pagination (10/page), as HotelsTab above.
function ActivitiesTab() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewing, setPreviewing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));

    api
      .get(`/activities?${params.toString()}`)
      .then(({ activities, pagination: p }) => {
        setItems(activities);
        setPagination(p);
      })
      .catch((err) => setError(err.message || 'Unable to load activities'))
      .finally(() => setLoading(false));
  }, [search, page]);

  async function handleDelete(id) {
    await api.del(`/admin/activities/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
    setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
    setPendingDelete(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <TextInput className="flex-1" placeholder="Search activities…" value={search} onChange={(e) => updateSearch(e.target.value)} />
        <Link to="/admin/catalog/activities/new">
          <Button variant="accent">+ Add New Activity</Button>
        </Link>
      </div>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted">{search ? 'No activities match that search.' : 'No activities yet.'}</p>
      ) : (
        <>
          <Table
            columns={['Activity Name', 'City', 'Duration', 'Price per pax', 'Status', { label: 'Actions', align: 'right' }]}
            rows={items}
            renderRow={(activity) => (
              <tr key={activity.id} className="border-b border-line-light transition-colors last:border-0 hover:bg-panel/50">
                <td className="px-3 py-3 align-middle font-semibold text-ink">{activity.name}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">{activity.city || '—'}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">{activity.duration || '—'}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">
                  {formatCurrency(activity.pricePerPax ?? activity.price_per_pax)}
                </td>
                <td className="px-3 py-3 align-middle">
                  <StatusBadge status={activity.status} />
                </td>
                <td className="px-3 py-3 align-middle">
                  <div className="flex flex-nowrap items-center justify-end gap-2">
                    <Button size="sm" className="whitespace-nowrap" onClick={() => setPreviewing(activity)}>
                      <LuEye className="mr-1.5 flex-shrink-0" size={14} />
                      View
                    </Button>
                    <Link to={`/admin/catalog/activities/${activity.id}`}>
                      <Button size="sm" variant="accent" className="whitespace-nowrap">
                        <LuPencil className="mr-1.5 flex-shrink-0" size={14} />
                        Edit
                      </Button>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(activity)}
                      aria-label={`Delete ${activity.name}`}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]"
                    >
                      <LuTrash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          />

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pagination.pageSize}
            onChange={setPage}
            itemLabel="activities"
          />
        </>
      )}

      {previewing && <ActivityPreviewModal activity={previewing} onClose={() => setPreviewing(null)} />}
      {pendingDelete && (
        <ConfirmDeleteModal
          title="Delete activity?"
          message={
            <>
              Delete <span className="font-semibold">"{pendingDelete.name}"</span>? This can't be undone.
            </>
          }
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => handleDelete(pendingDelete.id)}
        />
      )}
    </div>
  );
}

function TransferPreviewModal({ transfer, onClose }) {
  const vehicleClass = transfer.vehicleClass || transfer.vehicle_class;
  return (
    <Modal title={transfer.name} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="mb-4">
        <StatusBadge status={transfer.status} />
      </div>
      {transfer.images?.[0] && <img src={transfer.images[0]} alt="" className="mb-4 h-40 w-full rounded-lg object-cover" />}
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <FieldTile label="Type">{transfer.type || '—'}</FieldTile>
        <FieldTile label="Vehicle class">{vehicleClass || '—'}</FieldTile>
        <FieldTile label="City">{transfer.city || '—'}</FieldTile>
        <FieldTile label="Price">{formatCurrency(transfer.price)}</FieldTile>
      </div>
      {!isEmptyHtml(transfer.description) && (
        <div className="mt-4">
          <FieldLabel>Description</FieldLabel>
          <RichTextDisplay html={transfer.description} className="text-ink" />
        </div>
      )}
    </Modal>
  );
}

// Table (not the CatalogCard grid this used to be) — same reasoning, and
// same server-side search/pagination (10/page), as HotelsTab above.
function TransfersTab() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewing, setPreviewing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));

    api
      .get(`/transfers?${params.toString()}`)
      .then(({ transfers, pagination: p }) => {
        setItems(transfers);
        setPagination(p);
      })
      .catch((err) => setError(err.message || 'Unable to load transfers'))
      .finally(() => setLoading(false));
  }, [search, page]);

  async function handleDelete(id) {
    await api.del(`/admin/transfers/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
    setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
    setPendingDelete(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <TextInput className="flex-1" placeholder="Search transfers…" value={search} onChange={(e) => updateSearch(e.target.value)} />
        <Link to="/admin/catalog/transfers/new">
          <Button variant="accent">+ Add New Transfer</Button>
        </Link>
      </div>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted">{search ? 'No transfers match that search.' : 'No transfers yet.'}</p>
      ) : (
        <>
          <Table
            columns={['Name', 'Type', 'Vehicle Class', 'City', 'Price', 'Status', { label: 'Actions', align: 'right' }]}
            rows={items}
            renderRow={(transfer) => (
              <tr key={transfer.id} className="border-b border-line-light transition-colors last:border-0 hover:bg-panel/50">
                <td className="px-3 py-3 align-middle font-semibold text-ink">{transfer.name}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">{transfer.type || '—'}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">{transfer.vehicleClass || transfer.vehicle_class || '—'}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">{transfer.city || '—'}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">{formatCurrency(transfer.price)}</td>
                <td className="px-3 py-3 align-middle">
                  <StatusBadge status={transfer.status} />
                </td>
                <td className="px-3 py-3 align-middle">
                  <div className="flex flex-nowrap items-center justify-end gap-2">
                    <Button size="sm" className="whitespace-nowrap" onClick={() => setPreviewing(transfer)}>
                      <LuEye className="mr-1.5 flex-shrink-0" size={14} />
                      View
                    </Button>
                    <Link to={`/admin/catalog/transfers/${transfer.id}`}>
                      <Button size="sm" variant="accent" className="whitespace-nowrap">
                        <LuPencil className="mr-1.5 flex-shrink-0" size={14} />
                        Edit
                      </Button>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(transfer)}
                      aria-label={`Delete ${transfer.name}`}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]"
                    >
                      <LuTrash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          />

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pagination.pageSize}
            onChange={setPage}
            itemLabel="transfers"
          />
        </>
      )}

      {previewing && <TransferPreviewModal transfer={previewing} onClose={() => setPreviewing(null)} />}
      {pendingDelete && (
        <ConfirmDeleteModal
          title="Delete transfer?"
          message={
            <>
              Delete <span className="font-semibold">"{pendingDelete.name}"</span>? This can't be undone.
            </>
          }
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => handleDelete(pendingDelete.id)}
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

// Product Catalog "Flights" tab — unlike Meals/Visa above (one row edited in
// place), any number of flights can be added; Onward/Return is a sub-tab
// exactly like Meals' Lunch/Dinner, but selects which of two lists to show
// and which `isFlightOnward` a new entry is saved with, rather than which
// one row to edit. Backed by a plain growable table (0063_flights_catalog.sql),
// same "add form + list with delete" shape as NameOnlyCatalogList, just with
// more than one field to fill in per entry.
const FLIGHT_DIRECTIONS = [
  { key: 'onward', label: 'Onward', isFlightOnward: true },
  { key: 'return', label: 'Return', isFlightOnward: false },
];

const EMPTY_FLIGHT_FORM = { name: '', source: '', destination: '', departureDate: '', departureTime: '', price: '' };

// Today, as a "YYYY-MM-DD" string in the browser's local timezone — matches
// what <input type="date"> reads/writes, so it can be used directly as a
// `min` bound and in string comparisons without any Date-object timezone
// pitfalls. Same helper/convention as PackageBuilder.jsx's and
// MiceBuilder.jsx's todayDateString — that's the "shared calendar" rule this
// mirrors: a departure date can't be picked (via `min`) or submitted (the
// check in handleSubmit below) before today.
function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// flights list row (snake_case, straight off the API) -> this form's
// camelCase field shape. departure_date/departure_time both come back as
// plain strings (see PackageBuilder.jsx's/MiceBuilder.jsx's own
// `.slice(0, 10)` prefill convention) — sliced down to what their
// `<input type="date">`/`<input type="time">` counterparts expect
// ("YYYY-MM-DD" and "HH:MM"; departure_time carries a trailing ":SS" from
// Postgres' TIME column that the time input doesn't want).
function flightToForm(flight) {
  return {
    name: flight.name || '',
    source: flight.source || '',
    destination: flight.destination || '',
    departureDate: flight.departure_date ? flight.departure_date.slice(0, 10) : '',
    departureTime: flight.departure_time ? flight.departure_time.slice(0, 5) : '',
    price: flight.price != null ? String(flight.price) : '',
  };
}

// Re-mounted (key={direction} in FlightsTab below) on every sub-tab switch —
// so a half-typed Onward flight never ends up submitted as a Return one (or
// vice versa) just because the admin switched tabs mid-entry — and again on
// every edit/cancel-edit so the field values below always reset to match
// whichever flight (or none) is currently being edited.
function FlightForm({ isFlightOnward, directionLabel, editingFlight, onAdded, onSaved, onCancelEdit }) {
  const [form, setForm] = useState(() => (editingFlight ? flightToForm(editingFlight) : EMPTY_FLIGHT_FORM));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (
      !form.name.trim() ||
      !form.source.trim() ||
      !form.destination.trim() ||
      !form.departureDate ||
      !form.departureTime
    ) {
      setError('Please fill in all fields.');
      return;
    }
    if (form.departureDate < todayDateString()) {
      setError('Departure date cannot be in the past.');
      return;
    }
    setSubmitting(true);
    try {
      // Optional, same as Tours/Transfers' own price fields — omitted
      // entirely (rather than sent as an empty string) when left blank, so
      // it can still be added/saved without a price and priced in later.
      const payload = { ...form, isFlightOnward };
      if (form.price !== '') {
        payload.price = Number(form.price);
      } else {
        delete payload.price;
      }
      if (editingFlight) {
        const { flight } = await api.patch(`/admin/flights/${editingFlight.id}`, payload);
        onSaved(flight);
      } else {
        const { flight } = await api.post('/admin/flights', payload);
        onAdded(flight);
        setForm(EMPTY_FLIGHT_FORM);
      }
    } catch (err) {
      setError(err.message || `Unable to ${editingFlight ? 'save' : 'add'} flight`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card
      label={editingFlight ? `Edit ${directionLabel.toLowerCase()} flight` : `Add ${directionLabel.toLowerCase()} flight`}
      className="mb-4 border-white"
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <div>
          <FieldLabel>Flight name</FieldLabel>
          <TextInput value={form.name} onChange={(e) => update('name', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Source</FieldLabel>
          <TextInput value={form.source} onChange={(e) => update('source', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Destination</FieldLabel>
          <TextInput value={form.destination} onChange={(e) => update('destination', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Departure date</FieldLabel>
          <TextInput
            type="date"
            min={todayDateString()}
            value={form.departureDate}
            onChange={(e) => update('departureDate', e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Departure time</FieldLabel>
          <TextInput
            type="time"
            value={form.departureTime}
            onChange={(e) => update('departureTime', e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Price (₹)</FieldLabel>
          <TextInput type="number" min="0" value={form.price} onChange={(e) => update('price', e.target.value)} />
        </div>
        <div className="flex items-center gap-3 sm:col-span-6">
          <Button variant="accent" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : editingFlight ? 'Save changes' : `+ Add ${directionLabel.toLowerCase()} flight`}
          </Button>
          {editingFlight && (
            <button type="button" onClick={onCancelEdit} className="text-xs font-semibold text-[#666] hover:underline">
              Cancel
            </button>
          )}
        </div>
        <div className="sm:col-span-6">
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
    </Card>
  );
}

function FlightsTab() {
  const [direction, setDirection] = useState('onward');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  // The flight row currently being edited (or null for the plain "add"
  // form above) — cleared on every direction switch below, same as the
  // half-typed-entry guard that already reset the add form on tab switch.
  const [editingFlight, setEditingFlight] = useState(null);
  const active = FLIGHT_DIRECTIONS.find((d) => d.key === direction);

  function load() {
    setLoading(true);
    api
      .get(`/flights?isFlightOnward=${active.isFlightOnward}`)
      .then(({ flights }) => setItems(flights))
      .finally(() => setLoading(false));
  }

  useEffect(load, [direction]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDirectionChange(key) {
    setDirection(key);
    setEditingFlight(null);
  }

  async function handleDelete(id) {
    await api.del(`/admin/flights/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
    if (editingFlight?.id === id) setEditingFlight(null);
  }

  function handleSaved(saved) {
    setItems((list) => list.map((i) => (i.id === saved.id ? saved : i)));
    setEditingFlight(null);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FLIGHT_DIRECTIONS.map((d) => (
          <button
            key={d.key}
            onClick={() => handleDirectionChange(d.key)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold ${
              direction === d.key ? 'border-ink bg-ink text-white' : 'border-line-light bg-white text-[#666]'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <FlightForm
        key={`${direction}:${editingFlight?.id || 'new'}`}
        isFlightOnward={active.isFlightOnward}
        directionLabel={active.label}
        editingFlight={editingFlight}
        onAdded={(flight) => setItems((list) => [flight, ...list])}
        onSaved={handleSaved}
        onCancelEdit={() => setEditingFlight(null)}
      />

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted">No {active.label.toLowerCase()} flights added yet.</p>
      ) : (
        <Table
          columns={['Flight', 'Source', 'Destination', 'Departure date', 'Departure time', 'Price', '']}
          rows={items}
          renderRow={(flight) => (
            <tr key={flight.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2 font-semibold">{flight.name}</td>
              <td className="px-3 py-2">{flight.source}</td>
              <td className="px-3 py-2">{flight.destination}</td>
              <td className="px-3 py-2">{new Date(flight.departure_date).toLocaleDateString()}</td>
              <td className="px-3 py-2">{formatTime(flight.departure_time) || '—'}</td>
              <td className="px-3 py-2">{flight.price != null ? `₹${flight.price}` : '—'}</td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => setEditingFlight(flight)}
                  className="mr-3 text-xs text-[#4F46E5] hover:underline"
                >
                  Edit
                </button>
                <button onClick={() => handleDelete(flight.id)} className="text-xs text-[#a5162d] hover:underline">
                  Delete
                </button>
              </td>
            </tr>
          )}
        />
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
        <h2 className="mb-6 text-3xl font-bold text-ink">Product Catalog</h2>

        {/* Tab pills float directly on the page background — each one is
            already its own small white/gradient pill, so wrapping the whole
            row in a second bordered/shadowed white panel just stacked
            white-on-white without adding anything. Each tab's own search +
            "+ Add New X" row (FdPackagesTab, HotelsTab, …) renders as a
            separate, equally unwrapped row right below, exactly the same
            "plain page, individually-styled controls" layout. */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-transparent bg-gradient-to-r from-accent to-[#7C3AED] text-white shadow-sm shadow-accent/25'
                    : 'border-line-light bg-white text-[#666] hover:border-accent/40 hover:text-accent'
                }`}
              >
                <Icon size={14} className="flex-none" />
                {t.label}
              </button>
            );
          })}
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
        ) : tab === 'flights' ? (
          <FlightsTab />
        ) : (
          <InclusionsExclusionsTab />
        )}
      </div>
    </div>
  );
}
