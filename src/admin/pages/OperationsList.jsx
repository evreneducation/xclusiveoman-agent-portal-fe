import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, Select, Table, TextInput } from '../components/ui.jsx';

// Admin FD Operations Tracker (Task 12 — Screen 19). FD-only by construction
// on the backend (source_type = 'fd_package') — this list never shows
// package_request/mice_rfq bookings, matching requirement I4.

const STAGE_OPTIONS = [
  { value: '', label: 'All stages' },
  { value: 'booking_confirmed', label: 'Booking Confirmed' },
  { value: 'docs_collected', label: 'Documents Collected' },
  { value: 'supplier_coordination', label: 'Supplier Coordination' },
  { value: 'visa_processing', label: 'Visa Processing' },
  { value: 'driver_sent', label: 'Driver / Pickup Sent' },
  { value: 'trip_live', label: 'Trip Live' },
  { value: 'completed', label: 'Completed / Review' },
];

const STAGE_TONE = {
  booking_confirmed: 'grey',
  docs_collected: 'amber',
  supplier_coordination: 'amber',
  visa_processing: 'amber',
  driver_sent: 'amber',
  trip_live: 'green',
  completed: 'green',
};

const STAGE_LABEL = Object.fromEntries(STAGE_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]));

export default function OperationsList() {
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }
  function updateStage(v) {
    setStage(v);
    setPage(1);
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (stage) params.set('stage', stage);
    params.set('page', String(page));

    api
      .get(`/admin/operations/departures?${params.toString()}`)
      .then(({ departures, pagination: p }) => {
        setItems(departures);
        setPagination(p);
      })
      .catch((err) => setError(err.message || 'Unable to load FD Operations Tracker'))
      .finally(() => setLoading(false));
  }, [search, stage, page]);

  return (
    <div className="min-h-screen bg-[#eef1f7]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <h2 className="mb-1 text-3xl font-bold">FD Operations Tracker</h2>
        <p className="mb-5 text-sm text-muted">
          Upcoming and active Fixed Departure trips — track document collection, supplier coordination, visa
          processing, driver dispatch and trip status through to completion.
        </p>

        <Card className="mb-5 border-white">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <TextInput
              className="lg:col-span-2"
              placeholder="Search package name…"
              value={search}
              onChange={(e) => updateSearch(e.target.value)}
            />
            <Select value={stage} onChange={(e) => updateStage(e.target.value)}>
              {STAGE_OPTIONS.map((o) => (
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
          <p className="text-sm text-muted">No FD departures match those filters.</p>
        ) : (
          <>
            <Table
              columns={['Package', 'Departure date', 'Location', 'Pax', 'Agencies', 'Current stage', '']}
              rows={items}
              renderRow={(item) => (
                <tr key={item.departureDateId} className="border-b border-line-light last:border-0">
                  <td className="px-3 py-2 font-semibold">{item.packageTitle}</td>
                  <td className="px-3 py-2">{new Date(item.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{item.location}</td>
                  <td className="px-3 py-2">{item.paxTotal}</td>
                  <td className="px-3 py-2">{item.agencyCount}</td>
                  <td className="px-3 py-2">
                    <Badge tone={STAGE_TONE[item.currentStage] || 'grey'}>
                      {STAGE_LABEL[item.currentStage] || item.currentStage}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link to={`/admin/operations/${item.departureDateId}`} className="text-accent hover:underline">
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
