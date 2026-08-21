import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuTruck } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Badge, Card, EmptyState, ErrorText, LoadingState, PageHeader, TextInput } from '../components/ui.jsx';

const STAGE_LABELS = {
  docs_collected: 'Documents Collected',
  supplier_coordination: 'Supplier Coordination',
  visa_processing: 'Visa Processing',
  driver_sent: 'Driver / Pickup Sent',
  trip_live: 'Trip Live',
  completed: 'Completed / Review',
};

export default function FdOperations() {
  const [departures, setDepartures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .get('/admin/operations/departures')
      .then((data) => setDepartures(data.departures || data.items || []))
      .catch((err) => setError(err.message || 'Unable to load departures'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = departures.filter((d) => (d.packageTitle || '').toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-10">
      <PageHeader
        icon={LuTruck}
        title="FD Operation"
        subtitle="Track upcoming departures through to dispatch."
        count={!loading ? departures.length : null}
      />

      <TextInput placeholder="Search by package…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-5 max-w-sm" />

      <ErrorText>{error}</ErrorText>
      {loading && <LoadingState />}
      {!loading && filtered.length === 0 && !error && <EmptyState icon={LuTruck}>No departures with bookings yet.</EmptyState>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((d) => (
          <Link key={d.departureDateId} to={`/team/fd-operations/${d.departureDateId}`}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-bold text-team-ink">{d.packageTitle}</div>
                <Badge tone={d.currentStage === 'completed' ? 'green' : 'amber'}>{STAGE_LABELS[d.currentStage] || d.currentStage}</Badge>
              </div>
              <p className="mt-1.5 text-xs text-team-muted">
                {d.date} · {d.location}
              </p>
              <p className="mt-1 text-[11px] text-team-muted">
                {d.paxTotal} pax · {d.agencyCount} agencies
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
