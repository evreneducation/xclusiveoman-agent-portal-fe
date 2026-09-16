import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuCreditCard, LuPackage, LuUsers } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Badge, Button, Card, Pagination, Select, Table, TextInput } from '../components/ui.jsx';
import ManualBookingWizard from '../components/ManualBookingWizard.jsx';
import { formatCurrency } from '../../shared/fdPackage/index.js';

// Admin Bookings & Documents — Manual Booking Flow (Task 13 — Screen 22) and
// Booking & Visa Processing (Task 14 — Screen 23). FD-only
// (source_type='fd_package'); see bookingsAdmin.model.js's own comment for
// why. Each row's "Documents" link opens BookingDetailAdmin.jsx, Task 14's
// own traveler-document/visa/voucher management screen.
//
// Split into three tabs, all reading the same underlying bookings — there's
// no separate "payments" or "agent" table yet, each booking already carries
// its own payment status/amounts, agency, and package:
//   - Payments: one row per booking, oriented around its payment status —
//     the original flat list, backend-paginated exactly as before.
//   - Agent:    bookings grouped by agency, so booking volume/value per
//     agency is visible at a glance instead of scanning the flat list.
//   - Package:  bookings grouped by FD package, same idea.
// Each tab's "View Details" cross-references the other two — a payment's
// modal shows the agent and package behind it, an agent's modal shows every
// payment/package they've booked, and a package's modal shows every agent/
// payment booked against it.

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending_payment', label: 'Pending payment' },
  { value: 'deposit_paid', label: 'Deposit paid' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'balance_due', label: 'Balance due' },
  { value: 'fully_paid', label: 'Fully paid' },
  { value: 'amendment_requested', label: 'Amendment requested' },
  { value: 'cancellation_requested', label: 'Cancellation requested' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
  { value: 'waitlisted', label: 'Waitlisted' },
];

const STATUS_TONE = {
  pending_payment: 'amber',
  deposit_paid: 'amber',
  confirmed: 'green',
  balance_due: 'amber',
  fully_paid: 'green',
  amendment_requested: 'amber',
  cancellation_requested: 'red',
  cancelled: 'red',
  completed: 'grey',
  waitlisted: 'amber',
};

const CREATED_VIA_LABEL = { self_service: 'Self-service', manual_admin: 'Manual (admin)' };

// agencies.status (AgentApprovals.jsx's own STATUS_BADGE) — reused here so
// the Agent tab's approval-status badge matches Agent Approvals exactly.
const AGENCY_STATUS_TONE = { pending: 'amber', approved: 'green', rejected: 'red', suspended: 'grey' };

const TABS = [
  { key: 'payments', label: 'Payments', icon: LuCreditCard },
  { key: 'agents', label: 'Agent', icon: LuUsers },
  { key: 'packages', label: 'Package', icon: LuPackage },
];

// Same local Modal every other admin page hand-rolls (AgentApprovals.jsx,
// ProductCatalog.jsx, Marketing.jsx, Employees.jsx) — no shared component
// exists in components/ui.jsx yet.
function Modal({ title, onClose, children, footer, size = 'md' }) {
  const sizeClass = size === 'xl' ? 'max-w-4xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className={`relative z-10 flex max-h-[85vh] w-full ${sizeClass} flex-col rounded-lg border border-line-light bg-white p-5 shadow-lg sm:p-6`}>
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
      <div className="text-sm text-ink">{children ?? '—'}</div>
    </div>
  );
}

function SectionLabel({ children }) {
  return <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-muted first:mt-0">{children}</h4>;
}

function StatusBreakdown({ statusCounts }) {
  const entries = Object.entries(statusCounts);
  if (entries.length === 0) return <span className="text-xs text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([s, count]) => (
        <Badge key={s} tone={STATUS_TONE[s] || 'grey'}>
          {count} {s.replace(/_/g, ' ')}
        </Badge>
      ))}
    </div>
  );
}

// Pages through GET /admin/bookings at the max page size until every
// booking matching `filters` has been fetched — the Agent/Package tabs need
// the *full* set to aggregate by agency/package client-side, unlike the
// Payments tab which shows the backend's own page directly. Capped at 30
// pages (3,000 bookings); past that this should move server-side instead.
async function fetchAllBookings(filters = {}) {
  const pageSize = 100;
  const MAX_PAGES = 30;
  let all = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ ...filters, page: String(page), pageSize: String(pageSize) });
    const { bookings, pagination } = await api.get(`/admin/bookings?${params.toString()}`);
    all = all.concat(bookings);
    if (page >= pagination.totalPages) break;
  }
  return all;
}

// Groups bookings by `keyField` (agencyId or fdPackageId) for the Agent/
// Package tabs, rolling up the same payment totals each individual booking
// already carries. Sorted by booking count, busiest first.
function aggregateBookings(bookings, keyField, nameField) {
  const map = new Map();
  for (const b of bookings) {
    const key = b[keyField];
    if (key == null) continue;
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: b[nameField],
        bookings: [],
        totalValue: 0,
        totalDeposit: 0,
        totalBalance: 0,
        totalPax: 0,
        statusCounts: {},
        lastBookingAt: b.createdAt,
      });
    }
    const entry = map.get(key);
    entry.bookings.push(b);
    entry.totalValue += b.totalPrice;
    entry.totalDeposit += b.depositPaid;
    entry.totalBalance += b.balanceDue;
    entry.totalPax += b.pax;
    entry.statusCounts[b.status] = (entry.statusCounts[b.status] || 0) + 1;
    if (new Date(b.createdAt) > new Date(entry.lastBookingAt)) entry.lastBookingAt = b.createdAt;
  }
  return Array.from(map.values()).sort((a, b) => b.bookings.length - a.bookings.length);
}

// Reused inside the Agent/Package "View Details" modals below — the list of
// bookings that make up that agent's or package's roll-up, with whichever
// of Agency/Package isn't the modal's own subject shown per row (so an
// agent's modal shows each booking's package, and vice versa).
function BookingRowsTable({ bookings, agencyColumn, packageColumn }) {
  return (
    <Table
      columns={[...(agencyColumn ? ['Agency'] : []), ...(packageColumn ? ['Package'] : []), 'Departure', 'Pax', 'Total', 'Deposit', 'Balance', 'Status', 'Created', '']}
      rows={bookings}
      renderRow={(b) => (
        <tr key={b.id} className="border-b border-line-light last:border-0">
          {agencyColumn && <td className="px-3 py-2 font-semibold">{b.agencyName}</td>}
          {packageColumn && <td className="px-3 py-2">{b.packageTitle}</td>}
          <td className="px-3 py-2">{new Date(b.departureDate).toLocaleDateString()}</td>
          <td className="px-3 py-2">{b.pax}</td>
          <td className="px-3 py-2">{formatCurrency(b.totalPrice)}</td>
          <td className="px-3 py-2">{formatCurrency(b.depositPaid)}</td>
          <td className="px-3 py-2">{formatCurrency(b.balanceDue)}</td>
          <td className="px-3 py-2">
            <Badge tone={STATUS_TONE[b.status] || 'grey'}>{b.status.replace(/_/g, ' ')}</Badge>
          </td>
          <td className="px-3 py-2">{new Date(b.createdAt).toLocaleDateString()}</td>
          <td className="px-3 py-2 text-right">
            <Link to={`/admin/bookings/${b.id}`} className="text-accent hover:underline">
              Documents
            </Link>
          </td>
        </tr>
      )}
    />
  );
}

// Payments tab's "View Details" — one booking's payment breakdown plus the
// agent who booked it and the package it's for, resolved from the
// agencies/fd-packages lookups the parent loaded once on mount.
function BookingDetailsModal({ booking, agency, fdPackage, onClose }) {
  return (
    <Modal
      title="Payment details"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Link to={`/admin/bookings/${booking.id}`} className="mr-auto text-sm font-semibold text-accent hover:underline">
            Open Documents &amp; Visa Processing →
          </Link>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <SectionLabel>Payment</SectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <FieldTile label="Status">
          <Badge tone={STATUS_TONE[booking.status] || 'grey'}>{booking.status.replace(/_/g, ' ')}</Badge>
        </FieldTile>
        <FieldTile label="Total price">{formatCurrency(booking.totalPrice)}</FieldTile>
        <FieldTile label="Deposit paid">{formatCurrency(booking.depositPaid)}</FieldTile>
        <FieldTile label="Balance due">{formatCurrency(booking.balanceDue)}</FieldTile>
        <FieldTile label="Balance due date">{booking.balanceDueDate ? new Date(booking.balanceDueDate).toLocaleDateString() : '—'}</FieldTile>
        <FieldTile label="Pax">{booking.pax}</FieldTile>
        <FieldTile label="Departure">
          {new Date(booking.departureDate).toLocaleDateString()} · {booking.departureLocation}
        </FieldTile>
        <FieldTile label="Created via">{CREATED_VIA_LABEL[booking.createdVia] || booking.createdVia}</FieldTile>
        <FieldTile label="Created by">{booking.createdByName}</FieldTile>
        <FieldTile label="Created">{new Date(booking.createdAt).toLocaleDateString()}</FieldTile>
      </div>

      <SectionLabel>Agent</SectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <FieldTile label="Agency">{booking.agencyName}</FieldTile>
        <FieldTile label="Type">{agency?.type || '—'}</FieldTile>
        <FieldTile label="Country">{agency?.country || '—'}</FieldTile>
        <FieldTile label="License no.">{agency?.licenseNumber || '—'}</FieldTile>
        <FieldTile label="Approval status">
          {agency ? <Badge tone={AGENCY_STATUS_TONE[agency.status] || 'grey'}>{agency.status}</Badge> : '—'}
        </FieldTile>
        <FieldTile label="Relationship manager">{agency?.rmName || '—'}</FieldTile>
      </div>

      <SectionLabel>Package</SectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <FieldTile label="Title">{booking.packageTitle}</FieldTile>
        <FieldTile label="Theme">{fdPackage?.theme || '—'}</FieldTile>
        <FieldTile label="Duration">{fdPackage?.duration || '—'}</FieldTile>
        <FieldTile label="Hotel">{fdPackage?.hotelName || '—'}</FieldTile>
        <FieldTile label="Package status">{fdPackage?.status || '—'}</FieldTile>
      </div>
    </Modal>
  );
}

// Agent tab's "View Details" — the agency's own profile plus every booking
// (payment + package) rolled up under it.
function AgentDetailsModal({ row, agency, onClose }) {
  return (
    <Modal title={row.name} onClose={onClose} size="xl" footer={<Button onClick={onClose}>Close</Button>}>
      <SectionLabel>Agent</SectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <FieldTile label="Agency">{row.name}</FieldTile>
        <FieldTile label="Type">{agency?.type || '—'}</FieldTile>
        <FieldTile label="Country">{agency?.country || '—'}</FieldTile>
        <FieldTile label="License no.">{agency?.licenseNumber || '—'}</FieldTile>
        <FieldTile label="Approval status">
          {agency ? <Badge tone={AGENCY_STATUS_TONE[agency.status] || 'grey'}>{agency.status}</Badge> : '—'}
        </FieldTile>
        <FieldTile label="Credit limit">{agency?.creditLimit != null ? formatCurrency(agency.creditLimit) : '—'}</FieldTile>
        <FieldTile label="Relationship manager">{agency?.rmName || '—'}</FieldTile>
        <FieldTile label="Owner">{agency?.ownerName || '—'}</FieldTile>
      </div>

      <SectionLabel>Bookings &amp; payments ({row.bookings.length})</SectionLabel>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <FieldTile label="Total value">{formatCurrency(row.totalValue)}</FieldTile>
        <FieldTile label="Deposit paid">{formatCurrency(row.totalDeposit)}</FieldTile>
        <FieldTile label="Balance due">{formatCurrency(row.totalBalance)}</FieldTile>
        <FieldTile label="Total pax">{row.totalPax}</FieldTile>
      </div>
      <BookingRowsTable bookings={row.bookings} packageColumn />
    </Modal>
  );
}

// Package tab's "View Details" — the package's own profile plus every
// booking (agent + payment) rolled up under it.
function PackageDetailsModal({ row, fdPackage, onClose }) {
  return (
    <Modal title={row.name} onClose={onClose} size="xl" footer={<Button onClick={onClose}>Close</Button>}>
      <SectionLabel>Package</SectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <FieldTile label="Title">{row.name}</FieldTile>
        <FieldTile label="Theme">{fdPackage?.theme || '—'}</FieldTile>
        <FieldTile label="Duration">{fdPackage?.duration || '—'}</FieldTile>
        <FieldTile label="Hotel">{fdPackage?.hotelName || '—'}</FieldTile>
        <FieldTile label="Package status">{fdPackage?.status || '—'}</FieldTile>
        <FieldTile label="Rate per pax">{fdPackage?.ratePerPax != null ? formatCurrency(fdPackage.ratePerPax) : '—'}</FieldTile>
      </div>

      <SectionLabel>Bookings, agents &amp; payments ({row.bookings.length})</SectionLabel>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <FieldTile label="Total value">{formatCurrency(row.totalValue)}</FieldTile>
        <FieldTile label="Deposit paid">{formatCurrency(row.totalDeposit)}</FieldTile>
        <FieldTile label="Balance due">{formatCurrency(row.totalBalance)}</FieldTile>
        <FieldTile label="Total pax">{row.totalPax}</FieldTile>
      </div>
      <BookingRowsTable bookings={row.bookings} agencyColumn />
    </Modal>
  );
}

// Tab 1 — one row per booking, oriented around its payment status. Same
// backend-paginated search/status filters the page always had; only the
// "View Details" action and its modal are new.
function PaymentsTab({ agenciesById, packagesById }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }
  function updateStatus(v) {
    setStatus(v);
    setPage(1);
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    params.set('page', String(page));

    api
      .get(`/admin/bookings?${params.toString()}`)
      .then(({ bookings, pagination: p }) => {
        setItems(bookings);
        setPagination(p);
      })
      .catch((err) => setError(err.message || 'Unable to load bookings'))
      .finally(() => setLoading(false));
  }, [search, status, page]);

  return (
    <>
      <Card className="mb-5 border-white">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextInput
            className="lg:col-span-2"
            placeholder="Search agency or package name…"
            value={search}
            onChange={(e) => updateSearch(e.target.value)}
          />
          <Select value={status} onChange={(e) => updateStatus(e.target.value)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {error && <p className="mb-4 text-sm text-[#a5162d]">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">No payments match those filters.</p>
      ) : (
        <>
          <Table
            columns={['Agency', 'Package', 'Departure', 'Location', 'Pax', 'Total', 'Deposit', 'Balance', 'Status', 'Created via', 'Created', '']}
            rows={items}
            renderRow={(b) => (
              <tr key={b.id} className="border-b border-line-light last:border-0">
                <td className="px-3 py-2 font-semibold">{b.agencyName}</td>
                <td className="px-3 py-2">{b.packageTitle}</td>
                <td className="px-3 py-2">{new Date(b.departureDate).toLocaleDateString()}</td>
                <td className="px-3 py-2">{b.departureLocation}</td>
                <td className="px-3 py-2">{b.pax}</td>
                <td className="px-3 py-2">{formatCurrency(b.totalPrice)}</td>
                <td className="px-3 py-2">{formatCurrency(b.depositPaid)}</td>
                <td className="px-3 py-2">{formatCurrency(b.balanceDue)}</td>
                <td className="px-3 py-2">
                  <Badge tone={STATUS_TONE[b.status] || 'grey'}>{b.status.replace(/_/g, ' ')}</Badge>
                </td>
                <td className="px-3 py-2">{CREATED_VIA_LABEL[b.createdVia] || b.createdVia}</td>
                <td className="px-3 py-2">{new Date(b.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button type="button" onClick={() => setSelected(b)} className="mr-3 text-accent hover:underline">
                    View Details
                  </button>
                  <Link to={`/admin/bookings/${b.id}`} className="text-accent hover:underline">
                    Documents
                  </Link>
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
            itemLabel="payments"
          />
        </>
      )}

      {selected && (
        <BookingDetailsModal
          booking={selected}
          agency={agenciesById.get(selected.agencyId)}
          fdPackage={packagesById.get(selected.fdPackageId)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

// Tab 2 — bookings grouped by agency. Loads the *full* booking set once
// (fetchAllBookings) since aggregation happens client-side; search then
// filters the already-aggregated rows rather than re-fetching per keystroke.
function AgentsTab({ agenciesById }) {
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchAllBookings()
      .then(setAllBookings)
      .catch((err) => setError(err.message || 'Unable to load bookings'))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => aggregateBookings(allBookings, 'agencyId', 'agencyName'), [allBookings]);
  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => r.name?.toLowerCase().includes(needle));
  }, [rows, search]);
  const selectedRow = rows.find((r) => r.key === selectedKey) || null;

  return (
    <>
      <Card className="mb-5 border-white">
        <TextInput placeholder="Search agency…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>

      {error && <p className="mb-4 text-sm text-[#a5162d]">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : filteredRows.length === 0 ? (
        <p className="text-sm text-muted">No agents have made bookings yet.</p>
      ) : (
        <Table
          columns={['Agency', 'Bookings', 'Total value', 'Deposit paid', 'Balance due', 'Statuses', 'Last booking', '']}
          rows={filteredRows}
          renderRow={(r) => (
            <tr key={r.key} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2 font-semibold">{r.name}</td>
              <td className="px-3 py-2">{r.bookings.length}</td>
              <td className="px-3 py-2">{formatCurrency(r.totalValue)}</td>
              <td className="px-3 py-2">{formatCurrency(r.totalDeposit)}</td>
              <td className="px-3 py-2">{formatCurrency(r.totalBalance)}</td>
              <td className="px-3 py-2">
                <StatusBreakdown statusCounts={r.statusCounts} />
              </td>
              <td className="px-3 py-2">{new Date(r.lastBookingAt).toLocaleDateString()}</td>
              <td className="px-3 py-2 text-right">
                <button type="button" onClick={() => setSelectedKey(r.key)} className="text-accent hover:underline">
                  View Details
                </button>
              </td>
            </tr>
          )}
        />
      )}

      {selectedRow && <AgentDetailsModal row={selectedRow} agency={agenciesById.get(selectedRow.key)} onClose={() => setSelectedKey(null)} />}
    </>
  );
}

// Tab 3 — bookings grouped by FD package. Same full-fetch + client-side
// aggregation approach as AgentsTab above.
function PackagesTab({ packagesById }) {
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchAllBookings()
      .then(setAllBookings)
      .catch((err) => setError(err.message || 'Unable to load bookings'))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => aggregateBookings(allBookings, 'fdPackageId', 'packageTitle'), [allBookings]);
  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => r.name?.toLowerCase().includes(needle));
  }, [rows, search]);
  const selectedRow = rows.find((r) => r.key === selectedKey) || null;

  return (
    <>
      <Card className="mb-5 border-white">
        <TextInput placeholder="Search package…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>

      {error && <p className="mb-4 text-sm text-[#a5162d]">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : filteredRows.length === 0 ? (
        <p className="text-sm text-muted">No packages have been booked yet.</p>
      ) : (
        <Table
          columns={['Package', 'Bookings', 'Total pax', 'Total value', 'Deposit paid', 'Balance due', 'Statuses', 'Last booking', '']}
          rows={filteredRows}
          renderRow={(r) => (
            <tr key={r.key} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2 font-semibold">{r.name}</td>
              <td className="px-3 py-2">{r.bookings.length}</td>
              <td className="px-3 py-2">{r.totalPax}</td>
              <td className="px-3 py-2">{formatCurrency(r.totalValue)}</td>
              <td className="px-3 py-2">{formatCurrency(r.totalDeposit)}</td>
              <td className="px-3 py-2">{formatCurrency(r.totalBalance)}</td>
              <td className="px-3 py-2">
                <StatusBreakdown statusCounts={r.statusCounts} />
              </td>
              <td className="px-3 py-2">{new Date(r.lastBookingAt).toLocaleDateString()}</td>
              <td className="px-3 py-2 text-right">
                <button type="button" onClick={() => setSelectedKey(r.key)} className="text-accent hover:underline">
                  View Details
                </button>
              </td>
            </tr>
          )}
        />
      )}

      {selectedRow && <PackageDetailsModal row={selectedRow} fdPackage={packagesById.get(selectedRow.key)} onClose={() => setSelectedKey(null)} />}
    </>
  );
}

export default function BookingsDocuments() {
  const [view, setView] = useState('list'); // 'list' | 'wizard'
  const [tab, setTab] = useState('payments');

  // Loaded once, shared by all three tabs — the Payments tab's "View
  // Details" and the Agent/Package tabs' own row data all cross-reference
  // the same agency/package lookups instead of each re-fetching them.
  const [agenciesById, setAgenciesById] = useState(new Map());
  const [packagesById, setPackagesById] = useState(new Map());

  useEffect(() => {
    if (view !== 'list') return;
    api
      .get('/admin/agencies')
      .then(({ agencies }) => setAgenciesById(new Map((agencies || []).map((a) => [a.id, a]))))
      .catch(() => {});
    api
      .get('/admin/fd-packages')
      .then(({ fdPackages }) => setPackagesById(new Map((fdPackages || []).map((p) => [p.id, p]))))
      .catch(() => {});
  }, [view]);

  if (view === 'wizard') {
    return (
      <div className="min-h-screen bg-[#F4F7FF]">
        <div className="mx-auto max-w-4xl p-6 lg:p-10">
          {/* onCreated is intentionally a no-op here — the wizard shows its
              own success step (step 7) after creating and stays open until
              the admin clicks its own Close, at which point onClose below
              switches back to 'list' and PaymentsTab remounts fresh (its own
              effect always loads page 1 on mount), same as this page always
              did. */}
          <ManualBookingWizard onClose={() => setView('list')} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="mb-1 text-3xl font-bold">Booking & Visa Processing</h2>
            <p className="text-sm text-muted">
              Every Fixed Departure booking, self-service or manually created on an agency's behalf — by payment, by agent, or by package.
            </p>
          </div>
          <Button variant="accent" onClick={() => setView('wizard')}>
            + New Manual Booking
          </Button>
        </div>

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

        {tab === 'payments' && <PaymentsTab agenciesById={agenciesById} packagesById={packagesById} />}
        {tab === 'agents' && <AgentsTab agenciesById={agenciesById} />}
        {tab === 'packages' && <PackagesTab packagesById={packagesById} />}
      </div>
    </div>
  );
}
