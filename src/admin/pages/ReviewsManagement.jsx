import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, Button, Card, Select, Table, TextInput } from '../components/ui.jsx';

// Admin Reviews Management (Task 21 — Item 33, Screen 33, REV-3/REV-4).
// Same list/filter/pagination shape BookingsDocuments.jsx (Task 13) already
// established — search + Select filter(s) in a Card, Table below, "Page X
// of Y · N total" + Previous/Next pager. GET /admin/reviews returns the
// flat {rows, total, page, pageSize} shape this task's own spec asked for
// (not bookingsAdmin's {bookings, pagination:{...,totalPages}} wrapper), so
// totalPages is computed client-side from total/pageSize instead.

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'published', label: 'Published' },
  { value: 'hidden', label: 'Hidden' },
];

const RATING_OPTIONS = [
  { value: '', label: 'All ratings' },
  { value: '5', label: '5 stars' },
  { value: '4', label: '4 stars' },
  { value: '3', label: '3 stars' },
  { value: '2', label: '2 stars' },
  { value: '1', label: '1 star' },
];

const STATUS_TONE = { published: 'green', needs_review: 'amber', hidden: 'red' };
const STATUS_LABEL = { published: 'Published', needs_review: 'Needs review', hidden: 'Hidden' };

export default function ReviewsManagement() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [rating, setRating] = useState('');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Tracks which row currently has a publish/hide request in flight, so only
  // that row's buttons disable rather than the whole table.
  const [actingId, setActingId] = useState('');

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }
  function updateStatus(v) {
    setStatus(v);
    setPage(1);
  }
  function updateRating(v) {
    setRating(v);
    setPage(1);
  }

  function loadList() {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (rating) params.set('rating', rating);
    params.set('page', String(page));

    return api
      .get(`/admin/reviews?${params.toString()}`)
      .then(({ rows: r, total, page: p, pageSize }) => {
        setRows(r);
        setPagination({ total, page: p, pageSize });
      })
      .catch((err) => setError(err.message || 'Unable to load reviews'))
      .finally(() => setLoading(false));
  }

  // loadList() returns the api.get(...) promise chain (kept, unused here,
  // for symmetry with the rest of this file's async helpers) — passing it
  // directly as the effect callback would hand React a Promise where it
  // expects either nothing or a cleanup function, which React logs as
  // "destroy is not a function" and treats as a component-crashing error.
  // Wrapping it in a plain arrow function (same as BookingsDocuments.jsx's
  // own `() => { if (view === 'list') loadList(); }`) discards that return
  // value so the effect callback itself returns undefined.
  useEffect(() => {
    loadList();
  }, [search, status, rating, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Publish/hide are one-click, reversible toggles (not a delete) — no
  // confirmation modal, same convention Product/MICE Catalog's own Delete
  // buttons already use (no generic confirm-dialog component exists
  // anywhere in this admin console — see ProductCatalog.jsx's own note on
  // its one-off FD-package delete modal being the sole exception, for a
  // genuinely destructive action unlike this one).
  async function moderate(id, newStatus) {
    setActingId(id);
    setError('');
    try {
      const { review } = await api.patch(`/admin/reviews/${id}`, { status: newStatus });
      setRows((list) => list.map((r) => (r.id === id ? { ...r, status: review.status } : r)));
    } catch (err) {
      setError(err.message || 'Unable to update review status');
    } finally {
      setActingId('');
    }
  }

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / (pagination.pageSize || 20)));

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <div className="mb-5">
          <h2 className="mb-1 text-3xl font-bold">Reviews Management</h2>
          <p className="text-sm text-muted">
            Moderate agent-submitted trip reviews — publishing updates the package's rating shown to all agents.
          </p>
        </div>

        <Card className="mb-5 border-white">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextInput
              className="lg:col-span-2"
              placeholder="Search agency, package, or review text…"
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
            <Select value={rating} onChange={(e) => updateRating(e.target.value)}>
              {RATING_OPTIONS.map((o) => (
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
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">No reviews match those filters.</p>
        ) : (
          <>
            <Table
              columns={['Agency', 'Package', 'Booking', 'Rating', 'Review', 'Status', 'Submitted', '']}
              rows={rows}
              renderRow={(r) => (
                <tr key={r.id} className="border-b border-line-light last:border-0 align-top">
                  <td className="px-3 py-2 font-semibold">{r.agencyName}</td>
                  <td className="px-3 py-2">{r.packageTitle}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted">{r.bookingId.slice(0, 8)}…</td>
                  <td className="px-3 py-2">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</td>
                  <td className="px-3 py-2 max-w-xs">
                    <span className="line-clamp-3 text-[13px] text-ink">{r.reviewText || '—'}</span>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_TONE[r.status] || 'grey'}>{STATUS_LABEL[r.status] || r.status}</Badge>
                  </td>
                  <td className="px-3 py-2">{new Date(r.submittedAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      {r.status !== 'published' && (
                        <button
                          onClick={() => moderate(r.id, 'published')}
                          disabled={actingId === r.id}
                          className="text-accent hover:underline disabled:opacity-50"
                        >
                          Publish
                        </button>
                      )}
                      {r.status !== 'hidden' && (
                        <button
                          onClick={() => moderate(r.id, 'hidden')}
                          disabled={actingId === r.id}
                          className="text-[#a5162d] hover:underline disabled:opacity-50"
                        >
                          Hide
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            />

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted">
                Page {pagination.page} of {totalPages} · {pagination.total} total
              </span>
              <div className="flex gap-2">
                <Button disabled={pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <Button disabled={pagination.page >= totalPages} onClick={() => setPage((p) => p + 1)}>
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
