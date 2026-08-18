import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, Select, Table, TextInput } from '../components/ui.jsx';
import ManualBookingWizard from '../components/ManualBookingWizard.jsx';
import { formatCurrency } from '../../shared/fdPackage/index.js';

// Admin Bookings & Documents — Manual Booking Flow (Task 13 — Screen 22) and
// Client Documents & Visa Processing (Task 14 — Screen 23). FD-only
// (source_type='fd_package'); see bookingsAdmin.model.js's own comment for
// why. Each row's "Documents" link opens BookingDetailAdmin.jsx, Task 14's
// own traveler-document/visa/voucher management screen.

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

export default function BookingsDocuments() {
  const [view, setView] = useState('list'); // 'list' | 'wizard'
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }
  function updateStatus(v) {
    setStatus(v);
    setPage(1);
  }

  function loadList() {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    params.set('page', String(page));

    return api
      .get(`/admin/bookings?${params.toString()}`)
      .then(({ bookings, pagination: p }) => {
        setItems(bookings);
        setPagination(p);
      })
      .catch((err) => setError(err.message || 'Unable to load bookings'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (view === 'list') loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page, view]);

  if (view === 'wizard') {
    return (
      <div className="min-h-screen bg-[#eef1f7]">
        <div className="mx-auto max-w-4xl p-6 lg:p-10">
          <ManualBookingWizard
            onClose={() => setView('list')}
            onCreated={() => {
              setPage(1);
              loadList();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef1f7]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="mb-1 text-3xl font-bold">Bookings & Documents</h2>
            <p className="text-sm text-muted">Every Fixed Departure booking, self-service or manually created on an agency's behalf.</p>
          </div>
          <Button variant="accent" onClick={() => setView('wizard')}>
            + New Manual Booking
          </Button>
        </div>

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
          <p className="text-sm text-muted">No bookings match those filters.</p>
        ) : (
          <>
            <Table
              columns={[
                'Agency',
                'Package',
                'Departure',
                'Location',
                'Pax',
                'Total',
                'Deposit',
                'Balance',
                'Status',
                'Created via',
                'Created',
                '',
              ]}
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
                  <td className="px-3 py-2 text-right">
                    <Link to={`/admin/bookings/${b.id}`} className="text-accent hover:underline">
                      Documents
                    </Link>
                  </td>
                </tr>
              )}
            />

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
              </span>
              <div className="flex gap-2">
                <Button disabled={pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <Button disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
