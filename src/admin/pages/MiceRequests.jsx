import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, Select, Table, TextInput } from '../components/ui.jsx';

// Mirrors mice_rfq_status (migration 0024). Costing/RFP-dispatch/publishing
// aren't implemented yet (a later task), so only 'submitted' is reachable
// today — the rest are listed now so the filter doesn't need rework then.
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'rfp_dispatched', label: 'RFP Dispatched' },
  { value: 'supplier_responses_pending', label: 'Supplier Responses Pending' },
  { value: 'supplier_responses_received', label: 'Supplier Responses Received' },
  { value: 'costed', label: 'Costed' },
  { value: 'published', label: 'Published' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
  { value: 'converted', label: 'Converted' },
];

const STATUS_TONE = {
  submitted: 'amber',
  rfp_dispatched: 'grey',
  supplier_responses_pending: 'grey',
  supplier_responses_received: 'grey',
  costed: 'grey',
  published: 'green',
  accepted: 'green',
  negotiating: 'amber',
  declined: 'red',
  expired: 'red',
  converted: 'green',
};

function formatStatus(status) {
  return status.replace(/_/g, ' ');
}

export default function MiceRequests() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter setters reset to page 1 in the same tick, so the fetch effect
  // below only ever runs once per filter change (not once with the stale
  // page then again after a reset) — same pattern as the Custom FIT inbox.
  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }
  function updateStatus(v) {
    setStatus(v);
    setPage(1);
  }
  function updateEventDate(v) {
    setEventDate(v);
    setPage(1);
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (eventDate) {
      params.set('eventFrom', eventDate);
      params.set('eventTo', eventDate);
    }
    params.set('page', String(page));

    api
      .get(`/admin/mice-rfqs?${params.toString()}`)
      .then(({ miceRfqs, pagination: p }) => {
        setItems(miceRfqs);
        setPagination(p);
      })
      .catch((err) => setError(err.message || 'Unable to load MICE requests'))
      .finally(() => setLoading(false));
  }, [search, status, eventDate, page]);

  return (
    <div className="min-h-screen bg-[#eef1f7]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <h2 className="mb-1 text-3xl font-bold">MICE Requests</h2>
        <p className="mb-5 text-sm text-muted">
          Every MICE RFQ submitted from the Agent MICE Curation screen. Assign a Lead Manager to start
          working a request.
        </p>

        <Card className="mb-5 border-white">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextInput
              className="lg:col-span-2"
              placeholder="Search Quote ID, Company, Destination…"
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
            <div>
              <TextInput type="date" value={eventDate} onChange={(e) => updateEventDate(e.target.value)} />
              <p className="mt-1 text-[10px] text-muted">Event date</p>
            </div>
          </div>
        </Card>

        {error && <p className="mb-4 text-sm text-[#a5162d]">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">No MICE requests match those filters.</p>
        ) : (
          <>
            <Table
              columns={['Quote ID', 'Company / Client', 'Destination', 'Event dates', 'Group size', 'Status', 'Lead Manager', '']}
              rows={items}
              renderRow={(item) => (
                <tr key={item.id} className="border-b border-line-light last:border-0">
                  <td className="px-3 py-2 font-mono text-[10px]">{item.id.slice(0, 8)}</td>
                  <td className="px-3 py-2 font-semibold">{item.agencyName}</td>
                  <td className="px-3 py-2">{item.destination}</td>
                  <td className="px-3 py-2">
                    {new Date(item.eventDateFrom).toLocaleDateString()} – {new Date(item.eventDateTo).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">{item.groupSize}</td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_TONE[item.status] || 'grey'}>{formatStatus(item.status)}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {item.leadManager ? item.leadManager.fullName : <span className="text-muted">Unassigned</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link to={`/admin/mice-requests/${item.id}`} className="text-accent hover:underline">
                      View
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
