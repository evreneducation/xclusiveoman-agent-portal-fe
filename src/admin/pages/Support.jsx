import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, Select, Table, TextInput } from '../components/ui.jsx';

// Admin Support & Helpdesk (Task 18 — Screen 28, SUP-2). Ticket queue —
// search/filter/pagination follows the same convention every other admin
// list in this codebase uses (QuoteInbox.jsx, OperationsList.jsx,
// BookingsDocuments.jsx).

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
];
const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];
const STATUS_TONE = { open: 'amber', in_progress: 'teal', resolved: 'green' };
const PRIORITY_TONE = { low: 'grey', normal: 'teal', high: 'red' };

export default function Support() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
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
  function updatePriority(v) {
    setPriority(v);
    setPage(1);
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    params.set('page', String(page));

    api
      .get(`/admin/support/tickets?${params.toString()}`)
      .then(({ tickets, pagination: p }) => {
        setItems(tickets);
        setPagination(p);
      })
      .catch((err) => setError(err.message || 'Unable to load support tickets'))
      .finally(() => setLoading(false));
  }, [search, status, priority, page]);

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <h2 className="mb-1 text-3xl font-bold">Support &amp; Helpdesk</h2>
        <p className="mb-5 text-sm text-muted">Unified queue across every agency's support tickets — filter, assign, and reply.</p>

        <Card className="mb-5 border-white">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextInput
              className="lg:col-span-2"
              placeholder="Search subject, agency, or agent name…"
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
            <Select value={priority} onChange={(e) => updatePriority(e.target.value)}>
              {PRIORITY_OPTIONS.map((o) => (
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
          <p className="text-sm text-muted">No tickets match those filters.</p>
        ) : (
          <>
            <Table
              columns={['Subject', 'Agency', 'Raised by', 'Priority', 'Status', 'Assigned to', 'Created', '']}
              rows={items}
              renderRow={(t) => (
                <tr key={t.id} className="border-b border-line-light last:border-0">
                  <td className="px-3 py-2 font-semibold">{t.subject}</td>
                  <td className="px-3 py-2">{t.agencyName}</td>
                  <td className="px-3 py-2">{t.createdByName}</td>
                  <td className="px-3 py-2">
                    <Badge tone={PRIORITY_TONE[t.priority] || 'grey'}>{t.priority}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_TONE[t.status] || 'grey'}>{t.status.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="px-3 py-2">{t.assignedToName || <span className="text-muted">Unassigned</span>}</td>
                  <td className="px-3 py-2">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right">
                    <Link to={`/admin/support/${t.id}`} className="text-accent hover:underline">
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
