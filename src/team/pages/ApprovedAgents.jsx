import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, Card, ErrorText, TextInput } from '../components/ui.jsx';

const TIER_TONE = { gold: 'amber', silver: 'grey', bronze: 'grey' };

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
      <h2 className="text-2xl font-bold text-team-ink">Approved Agents</h2>
      <p className="mt-1.5 text-sm text-team-muted">Agencies assigned to you as their Relationship Manager.</p>

      <TextInput placeholder="Search by agency name…" value={search} onChange={(e) => setSearch(e.target.value)} className="mt-5 max-w-sm" />

      {loading && <p className="mt-4 text-xs text-team-muted">Loading…</p>}
      <ErrorText>{error}</ErrorText>
      {!loading && filtered.length === 0 && !error && (
        <Card className="mt-4">
          <p className="text-sm text-team-muted">No approved agencies assigned to you yet.</p>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((a) => (
          <Card key={a.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-bold text-team-ink">{a.name}</div>
              {a.tier && <Badge tone={TIER_TONE[a.tier] || 'grey'}>{a.tier}</Badge>}
            </div>
            <p className="mt-1.5 text-xs text-team-muted">
              {a.type?.replace(/_/g, ' ')} · {a.country}
            </p>
            <div className="mt-3 space-y-1 text-[11px] text-team-muted">
              <div>Owner: {a.ownerName || '—'} {a.ownerEmail ? `(${a.ownerEmail})` : ''}</div>
              <div>Credit limit: {a.creditLimit ?? '—'} {a.currencyPreference || ''}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
