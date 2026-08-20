import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Card, ErrorText, TextInput } from '../components/ui.jsx';

// Quotes & Pricing — one page, two tabs. Both endpoints are already scoped
// server-side to whoever's signed in (packageRequestsAdmin.controller.js /
// miceRfqsAdmin.controller.js's own quotesPricingScope): a Lead Manager
// only ever gets back requests assigned to them, a Relationship Manager
// only their own agencies' — this page never filters anything itself.
const KINDS = {
  fit: { label: 'FIT Quotes', endpoint: '/admin/package-requests', listKey: 'packageRequests', detailBase: '/team/quotes-pricing/fit' },
  mice: { label: 'MICE Requests', endpoint: '/admin/mice-rfqs', listKey: 'miceRfqs', detailBase: '/team/quotes-pricing/mice' },
};

const STATUS_TONE = {
  submitted: 'grey',
  assigned: 'amber',
  costed: 'amber',
  published: 'green',
  accepted: 'green',
  declined: 'red',
  revision_requested: 'amber',
};

function QuoteTab({ kind }) {
  const cfg = KINDS[kind];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .get(cfg.endpoint)
      .then((data) => setItems(data[cfg.listKey] || []))
      .catch((err) => setError(err.message || 'Unable to load'))
      .finally(() => setLoading(false));
  }, [cfg.endpoint, cfg.listKey]);

  const filtered = items.filter((it) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (it.agencyName || '').toLowerCase().includes(q) || (it.destination || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <TextInput placeholder="Search by agency or destination…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      {loading && <p className="text-xs text-team-muted">Loading…</p>}
      <ErrorText>{error}</ErrorText>
      {!loading && filtered.length === 0 && !error && (
        <Card>
          <p className="text-sm text-team-muted">Nothing here yet.</p>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((it) => (
          <Link key={it.id} to={`${cfg.detailBase}/${it.id}`}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-bold text-team-ink">{it.agencyName}</div>
                <Badge tone={STATUS_TONE[it.status] || 'grey'}>{it.status?.replace(/_/g, ' ')}</Badge>
              </div>
              <p className="mt-1.5 text-xs text-team-muted">{it.destination}</p>
              <p className="mt-1 text-[11px] text-team-muted">
                {kind === 'fit'
                  ? `${it.dateFrom || '—'} → ${it.dateTo || '—'} · ${(it.paxAdults || 0) + (it.paxChildren || 0)} pax`
                  : `${it.eventDateFrom || '—'} → ${it.eventDateTo || '—'} · ${it.groupSize || 0} pax`}
              </p>
              {it.leadManager && <p className="mt-2 text-[11px] text-team-muted">Lead Manager: {it.leadManager.fullName}</p>}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function QuotesPricing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = tabParam && KINDS[tabParam] ? tabParam : 'fit';

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-10">
      <h2 className="text-2xl font-bold text-team-ink">Quotes & Pricing</h2>
      <p className="mt-1.5 text-sm text-team-muted">FIT and MICE requests relevant to you.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {Object.entries(KINDS).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setSearchParams({ tab: key })}
            className={`rounded-t-lg border border-b-0 px-4 py-2.5 text-xs font-semibold ${
              tab === key ? 'border-team-line-light bg-team-panel text-team-ink' : 'border-transparent text-team-muted hover:text-team-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-b-lg rounded-tr-lg border border-team-line-light bg-team-panel p-5">
        <QuoteTab key={tab} kind={tab} />
      </div>
    </div>
  );
}
