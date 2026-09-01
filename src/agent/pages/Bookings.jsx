import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, ErrorText, Table } from '../components/ui.jsx';

const SOURCE_LABEL = { fd_package: 'Fixed Departure', package_request: 'Custom FIT', mice_rfq: 'MICE' };
const STATUS_TONE = {
  pending_payment: 'amber',
  deposit_paid: 'teal',
  confirmed: 'green',
  balance_due: 'amber',
  fully_paid: 'green',
  amendment_requested: 'amber',
  cancellation_requested: 'red',
  cancelled: 'red',
  completed: 'grey',
  waitlisted: 'amber',
};

// Reuses the existing GET /bookings ("My Bookings") endpoint — no new API.
export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/bookings')
      .then(({ bookings: list }) => setBookings(list))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-5 lg:p-8">
      <h2 className="mb-1 text-2xl font-bold text-agent-ink">Bookings</h2>
      <p className="mb-5 text-sm text-agent-muted">Every booking your agency has made across Fixed Departures, Custom FIT, and MICE.</p>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className="text-sm text-agent-muted">Loading…</p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-agent-muted">No bookings yet.</p>
      ) : (
        <Table
          columns={['Booking', 'Type', 'Pax', 'Total', 'Balance Due', 'Status', 'Created', '']}
          rows={bookings}
          renderRow={(b) => (
            <tr key={b.id} className="border-b border-agent-line-light last:border-0">
              <td className="px-3 py-2 font-mono text-[10px]">{b.id.slice(0, 8)}</td>
              <td className="px-3 py-2">{SOURCE_LABEL[b.sourceType] || b.sourceType}</td>
              <td className="px-3 py-2">{b.pax ?? '—'}</td>
              <td className="px-3 py-2">₹{b.totalPrice}</td>
              <td className="px-3 py-2">₹{b.balanceDue}</td>
              <td className="px-3 py-2">
                <Badge tone={STATUS_TONE[b.status] || 'grey'}>{b.status?.replace(/_/g, ' ')}</Badge>
              </td>
              <td className="px-3 py-2">{new Date(b.createdAt).toLocaleDateString()}</td>
              <td className="px-3 py-2 text-right">
                {/* Documents (Task 14) only exist for FD bookings today — see
                    documents.model.js's own FD-only scoping. */}
                {b.sourceType === 'fd_package' && (
                  <Link to={`/agent/bookings/${b.id}`} className="text-agent-accent hover:underline">
                    Documents
                  </Link>
                )}
              </td>
            </tr>
          )}
        />
      )}
    </div>
  );
}
