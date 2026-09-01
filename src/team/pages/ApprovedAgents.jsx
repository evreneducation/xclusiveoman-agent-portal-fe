import { useEffect, useState } from 'react';
import { LuUserCheck, LuBuilding2, LuMail } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Card, EmptyState, ErrorText, LoadingState, PageHeader, TextInput } from '../components/ui.jsx';

// GET /admin/agencies — auto-scoped server-side to just this RM's own book
// (admin.controller.js#getAgencies: req.user.role === 'relationship_manager'
// forces agencyIds to their own assigned agencies) — "by his record", never
// a client-side filter here.
export default function ApprovedAgents() {
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .get('/admin/agencies?status=approved')
      .then((data) => setAgencies(data.agencies || []))
      .catch((err) => setError(err.message || 'Unable to load agencies'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = agencies.filter((a) => a.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-10">
      <PageHeader
        icon={LuUserCheck}
        title="Approved Agents"
        subtitle="Agencies assigned to you as their Relationship Manager."
        count={!loading ? agencies.length : null}
      />

      <TextInput placeholder="Search by agency name…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-5 max-w-sm" />

      <ErrorText>{error}</ErrorText>
      {loading && <LoadingState />}
      {!loading && filtered.length === 0 && !error && (
        <EmptyState icon={LuBuilding2}>No approved agencies assigned to you yet.</EmptyState>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((a) => (
          <Card key={a.id} className="transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-team-accent-soft text-team-accent-dark">
                  <LuBuilding2 size={15} />
                </span>
                <div>
                  <div className="text-sm font-bold text-team-ink">{a.name}</div>
                  <p className="text-xs text-team-muted">
                    {a.type?.replace(/_/g, ' ')} · {a.country}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-1 border-t border-team-line-light pt-3 text-[11px] text-team-muted">
              <div className="flex items-center gap-1.5">
                <LuMail size={12} className="flex-none" />
                {a.ownerName || '—'} {a.ownerEmail ? `(${a.ownerEmail})` : ''}
              </div>
              <div>Credit limit: {a.creditLimit ?? '—'} {a.currencyPreference || ''}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
