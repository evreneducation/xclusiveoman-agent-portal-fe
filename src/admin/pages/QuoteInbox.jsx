import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, Select, Table, TextInput } from '../components/ui.jsx';

// Mirrors package_request_status (migrations 0016/0017) minus 'draft', which
// the inbox never shows (item 1 of this task).
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'costed', label: 'Costed' },
  { value: 'published', label: 'Published' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'revision_requested', label: 'Revision Requested' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
  { value: 'converted', label: 'Converted' },
];

const STATUS_TONE = {
  submitted: 'amber',
  assigned: 'grey',
  costed: 'grey',
  published: 'green',
  accepted: 'green',
  revision_requested: 'amber',
  declined: 'red',
  expired: 'red',
  converted: 'green',
};

function formatStatus(status) {
  return status.replace(/_/g, ' ');
}

export default function QuoteInbox() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [destination, setDestination] = useState('');
  const [submittedDate, setSubmittedDate] = useState('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter setters reset to page 1 in the same tick, so the fetch effect
  // below only ever runs once per filter change (not once with the stale
  // page then again after a reset).
  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }
  function updateStatus(v) {
    setStatus(v);
    setPage(1);
  }
  function updateDestination(v) {
    setDestination(v);
    setPage(1);
  }
  function updateSubmittedDate(v) {
    setSubmittedDate(v);
    setPage(1);
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (destination) params.set('destination', destination);
    if (submittedDate) {
      params.set('submittedFrom', submittedDate);
      params.set('submittedTo', submittedDate);
    }
    params.set('page', String(page));

    api
      .get(`/admin/package-requests?${params.toString()}`)
      .then(({ packageRequests, pagination: p }) => {
        setItems(packageRequests);
        setPagination(p);
      })
      .catch((err) => setError(err.message || 'Unable to load quote inbox'))
      .finally(() => setLoading(false));
  }, [search, status, destination, submittedDate, page]);

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <h2 className="mb-1 text-3xl font-bold">Quote Inbox — Custom FIT</h2>
        <p className="mb-5 text-sm text-muted">
          Every Custom FIT request submitted from the Agent Package Builder. Assign a Lead Manager to
          start working a request.
        </p>

        <Card className="mb-5 border-white">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextInput
              className="lg:col-span-2"
              placeholder="Search Quote ID, Agent, Agency, Destination…"
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
            <TextInput placeholder="Filter by destination…" value={destination} onChange={(e) => updateDestination(e.target.value)} />
            <div>
              <TextInput type="date" value={submittedDate} onChange={(e) => updateSubmittedDate(e.target.value)} />
              <p className="mt-1 text-[10px] text-muted">Submission date</p>
            </div>
          </div>
        </Card>

        {error && <p className="mb-4 text-sm text-[#a5162d]">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">No Custom FIT requests match those filters.</p>
        ) : (
          <>
            <Table
              columns={['Quote ID', 'Agency', 'Agent', 'Destination', 'Travel dates', 'Adults', 'Children', 'Submitted', 'Status', 'Lead Manager', '']}
              rows={items}
              renderRow={(item) => (
                <tr key={item.id} className="border-b border-line-light last:border-0">
                  <td className="px-3 py-2 font-mono text-[10px]">{item.id.slice(0, 8)}</td>
                  <td className="px-3 py-2 font-semibold">{item.agencyName}</td>
                  <td className="px-3 py-2">{item.agentName}</td>
                  <td className="px-3 py-2">{item.destination}</td>
                  <td className="px-3 py-2">
                    {new Date(item.dateFrom).toLocaleDateString()} – {new Date(item.dateTo).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">{item.paxAdults}</td>
                  <td className="px-3 py-2">{item.paxChildren}</td>
                  <td className="px-3 py-2">{new Date(item.submittedAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_TONE[item.status] || 'grey'}>{formatStatus(item.status)}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {item.leadManager ? item.leadManager.fullName : <span className="text-muted">Unassigned</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link to={`/admin/quote-inbox/${item.id}`} className="text-accent hover:underline">
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
