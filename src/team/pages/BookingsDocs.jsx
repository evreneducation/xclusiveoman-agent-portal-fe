import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuClipboardCheck } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Badge, Card, EmptyState, ErrorText, LoadingState, PageHeader, TextInput } from '../components/ui.jsx';

const STATUS_TONE = {
  confirmed: 'green',
  pending: 'amber',
  cancelled: 'red',
};

// GET /admin/bookings — already scoped server-side for a Relationship
// Manager (bookingsAdmin.controller.js#listBookings: only their own
// assigned agencies); a Lead Manager sees the full list, same as any other
// STAFF_ROLE, since Bookings & Docs has no per-LM assignment concept.
export default function BookingsDocs() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .get('/admin/bookings')
      .then((data) => setBookings(data.bookings || []))
      .catch((err) => setError(err.message || 'Unable to load bookings'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = bookings.filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (b.agencyName || '').toLowerCase().includes(q) || (b.packageTitle || '').toLowerCase().includes(q);
  });

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-10">
      <PageHeader
        icon={LuClipboardCheck}
        title="Bookings & Docs"
        subtitle="Fixed Group Departure bookings and traveler documents."
        count={!loading ? bookings.length : null}
      />

      <TextInput
        placeholder="Search by agency or package…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-5 max-w-sm"
      />

      <ErrorText>{error}</ErrorText>
      {loading && <LoadingState />}
      {!loading && filtered.length === 0 && !error && <EmptyState icon={LuClipboardCheck}>No bookings found.</EmptyState>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((b) => (
          <Link key={b.id} to={`/team/bookings-docs/${b.id}`}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-bold text-team-ink">{b.agencyName}</div>
                <Badge tone={STATUS_TONE[b.status] || 'grey'}>{b.status}</Badge>
              </div>
              <p className="mt-1.5 text-xs text-team-muted">{b.packageTitle}</p>
              <p className="mt-1 text-[11px] text-team-muted">
                {b.departureDate} · {b.departureLocation} · {b.pax} pax
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
